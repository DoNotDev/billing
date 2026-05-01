// packages/features/billing/src/components/StripeCheckoutButton.tsx

/**
 * @fileoverview StripeCheckoutButton component
 * @description Unified Stripe checkout button component
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useState } from 'react';

import { Button, cn, type ButtonProps } from '@donotdev/components';
import {
  useTranslation,
  isDev,
  redirectToExternalUrlWithErrorHandling,
  type CheckoutMode,
} from '@donotdev/core';

import { useBillingAuth } from '../useBillingAuth';
import { useStripeBilling } from '../useStripeBilling';

/** Props for the StripeCheckoutButton component. */
export interface StripeCheckoutButtonProps extends Omit<
  ButtonProps,
  'onClick' | 'children' | 'onError'
> {
  /** Configuration key from stripeFrontConfig (passed as billingConfigKey to backend) */
  configKey?: string;
  /** Stripe price ID (fixed pricing mode) */
  priceId?: string;
  /** Amount in cents (dynamic pricing mode) */
  unitAmount?: number;
  /** Product name for Stripe checkout (dynamic pricing mode) */
  productName?: string;
  /** Currency code, defaults to 'eur' (dynamic pricing mode) */
  currency?: string;
  /** Payment mode */
  mode: CheckoutMode;
  /** Success redirect URL */
  successUrl?: string;
  /** Cancel redirect URL */
  cancelUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
  /** Allow promotion codes */
  allowPromotionCodes?: boolean;
  /** Loading text */
  loadingText?: string;
  /** Button content */
  children?: React.ReactNode;
  /** Error callback for checkout errors */
  onError?: (error: Error) => void;
}

/**
 * Unified Stripe checkout button component
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Use Cases:**
 * - Direct integration when you have a Stripe price ID
 * - Custom checkout flows with full control
 * - When you need to handle both payments and subscriptions in one component
 * - Building custom billing interfaces
 *
 * **When to use:**
 * - You have a specific Stripe price ID
 * - You want full control over the checkout process
 * - You're building custom billing pages
 * - You need to handle both one-time and recurring payments
 *
 * **Example:**
 * ```tsx
 * <StripeCheckoutButton
 * priceId="price_1234567890"
 * mode="payment"
 * successUrl="/success"
 * cancelUrl="/cancel"
 * >
 * Buy Now - $99
 * </StripeCheckoutButton>
 * ```
 */
export function StripeCheckoutButton({
  configKey,
  priceId,
  unitAmount,
  productName,
  currency,
  mode,
  successUrl,
  cancelUrl,
  metadata = {},
  allowPromotionCodes = true,
  variant = 'primary',
  className,
  disabled,
  loadingText,
  icon,
  children,
  onError,
  ...buttonProps
}: StripeCheckoutButtonProps) {
  const { t } = useTranslation('billing');
  const authState = useBillingAuth();
  const checkout = useStripeBilling('checkout', authState);
  const status = useStripeBilling('status', authState);
  const loading = status === 'initializing';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultLoadingText = loadingText || t('components.buttons.processing');
  const defaultChildren =
    children ||
    (mode === 'payment'
      ? t('components.buttons.purchase')
      : t('components.buttons.subscribe'));

  const handleClick = async () => {
    // Validate: either priceId or (unitAmount + productName) required
    if (!priceId && !(unitAmount && productName)) {
      onError?.(
        new Error(
          'StripeCheckoutButton: either priceId or (unitAmount + productName) required'
        )
      );
      return;
    }
    if (loading || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await checkout({
        priceId,
        unitAmount,
        productName,
        currency,
        mode,
        successUrl,
        cancelUrl,
        metadata: {
          ...metadata,
          // Server values AFTER spread — cannot be overwritten by client
          ...(configKey && { billingConfigKey: configKey }),
        },
        allowPromotionCodes,
      });

      if (result.sessionUrl) {
        await redirectToExternalUrlWithErrorHandling(
          result.sessionUrl,
          {},
          'Failed to redirect to payment page'
        );
      } else if (isDev()) {
        console.warn('[StripeCheckoutButton] No session URL returned', result);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Checkout failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        {...buttonProps}
        onClick={handleClick}
        disabled={disabled || loading || isSubmitting}
        variant={variant}
        className={cn('dndev-w-full', className)}
        icon={icon}
      >
        {loading || isSubmitting ? defaultLoadingText : defaultChildren}
      </Button>
    </>
  );
}
