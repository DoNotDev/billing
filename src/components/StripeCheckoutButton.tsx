// packages/features/billing/src/components/StripeCheckoutButton.tsx

/**
 * @fileoverview StripeCheckoutButton component
 * @description Unified Stripe checkout button component
 *
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useState } from 'react';

import { Button, cn, type ButtonProps } from '@donotdev/components';
import {
  useTranslation,
  isDev,
  redirectToExternalUrlWithErrorHandling,
  type CheckoutLineItemInput,
  type CheckoutMode,
} from '@donotdev/core';

import { useBillingAuth } from '../useBillingAuth';
import { useStripeBilling } from '../useStripeBilling';

/** Props for the StripeCheckoutButton component. */
export interface StripeCheckoutButtonProps extends Omit<
  ButtonProps,
  'onClick' | 'children' | 'onError'
> {
  /** Key in the app's StripeBackConfig (sent as billingConfigKey, also in metadata). Overrides `metadata.billingConfigKey`. */
  configKey?: string;
  /** Requested lines (StripeOrder). Omitted: the server uses the single product `[{ productId: configKey, quantity: 1 }]`. */
  lineItems?: CheckoutLineItemInput[];
  /** Payment mode. Sent to the server; selects the default label (purchase / subscribe). Ignored for StripeOrder. */
  mode: CheckoutMode;
  /** Stripe price ID (fixed pricing mode). Must match the back config priceId when it has one. */
  priceId?: string;
  /** Currency code (dynamic pricing mode). Omitted: the back config currency. */
  currency?: string;
  /** Success redirect URL */
  successUrl?: string;
  /** Cancel redirect URL */
  cancelUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
  /** Show the promotion code field (single-price items; StripeOrder uses its back config) */
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
 * @version 0.2.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * Requires a `configKey` (key in the app's StripeBackConfig) or a `priceId`; otherwise `onError` is called
 * and no request is sent. With a `configKey` and no `priceId`, the server uses
 * the back config priceId. StripeOrder items take `lineItems` and are priced on
 * the server (priceId / mode are ignored for them).
 *
 * **Example (single product or subscription, priced by the back config):**
 * ```tsx
 * <StripeCheckoutButton configKey="lifetime" mode="payment" successUrl="/success" cancelUrl="/cancel">
 *   Buy Now
 * </StripeCheckoutButton>
 * ```
 *
 * **Example (explicit Stripe price ID):**
 * ```tsx
 * <StripeCheckoutButton
 *   configKey="lifetime"
 *   priceId="price_1234567890"
 *   mode="payment"
 *   successUrl="/success"
 *   cancelUrl="/cancel"
 * >
 *   Buy Now - $99
 * </StripeCheckoutButton>
 * ```
 *
 * **Example (StripeOrder cart):**
 * ```tsx
 * <StripeCheckoutButton
 *   configKey="shop_order"
 *   mode="payment"
 *   lineItems={[{ productId: 'serum-30ml', quantity: 24 }]}
 * />
 * ```
 */
export function StripeCheckoutButton({
  configKey,
  lineItems,
  priceId,
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
    // Validate: a config key (server-resolved price) or priceId required
    const hasConfigKey = !!(configKey || metadata.billingConfigKey);
    if (!hasConfigKey && !priceId) {
      onError?.(
        new Error(
          'StripeCheckoutButton: configKey or priceId required'
        )
      );
      return;
    }
    if (loading || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await checkout({
        billingConfigKey: configKey,
        lineItems,
        priceId,
        currency,
        mode,
        successUrl,
        cancelUrl,
        metadata,
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
