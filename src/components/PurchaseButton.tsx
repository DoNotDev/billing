// packages/features/billing/src/components/PurchaseButton.tsx

/**
 * @fileoverview PurchaseButton component
 * @description One-time purchase button for Stripe frontend config integration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useTranslation, type StripePayment } from '@donotdev/core';

import { StripeCheckoutButton } from './StripeCheckoutButton';
import type { StripeCheckoutButtonProps } from './StripeCheckoutButton';

/** Props for the PurchaseButton component. */
export interface PurchaseButtonProps extends Omit<
  StripeCheckoutButtonProps,
  'mode' | 'priceId' | 'lineItems'
> {
  configKey: string;
  /** Front-config item. `priceId` is sent to the server; `tier`, `duration` and `metadata` are copied to the checkout metadata. */
  config: StripePayment;
}

/**
 * One-time purchase button for Stripe frontend config integration
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Use Cases:**
 * - One-time payments (lifetime access, digital products, courses)
 * - Integration with StripeFrontConfig configuration system
 * - When you want to use predefined product configurations
 * - Product cards and pricing tables
 *
 * **When to use:**
 * - You have a stripeFrontConfig with product definitions
 * - You want one-time payments (not recurring)
 * - You're using the framework's billing system
 * - You want automatic metadata handling from config
 *
 * **Example:**
 * ```tsx
 * import { stripeFrontConfig } from '../config/stripeFrontConfig';
 *
 * <PurchaseButton
 * configKey="early_bird"
 * config={stripeFrontConfig.early_bird}
 * successUrl="/purchase/success"
 * >
 * Get Early Bird Access - $49
 * </PurchaseButton>
 * ```
 */
export function PurchaseButton({
  config,
  children,
  ...props
}: PurchaseButtonProps) {
  const { t } = useTranslation('billing');

  return (
    <StripeCheckoutButton
      {...props}
      priceId={config.priceId}
      mode="payment"
      metadata={{
        tier: config.tier,
        duration: config.duration,
        ...config.metadata,
        ...props.metadata,
      }}
    >
      {children || t('components.buttons.purchase')}
    </StripeCheckoutButton>
  );
}
