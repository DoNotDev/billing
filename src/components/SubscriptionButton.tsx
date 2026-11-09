// packages/features/billing/src/components/SubscriptionButton.tsx

/**
 * @fileoverview SubscriptionButton component
 * @description Subscription button for recurring billing
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useTranslation, type StripeSubscription } from '@donotdev/core';

import { StripeCheckoutButton } from './StripeCheckoutButton';
import type { StripeCheckoutButtonProps } from './StripeCheckoutButton';

/** Props for the SubscriptionButton component. */
export interface SubscriptionButtonProps extends Omit<
  StripeCheckoutButtonProps,
  'mode' | 'priceId' | 'lineItems'
> {
  configKey: string;
  /** Front-config item. `priceId` is sent to the server; `tier`, `duration` and `metadata` are copied to the checkout metadata. */
  config: StripeSubscription;
}

/**
 * Subscription button for recurring billing
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Use Cases:**
 * - Recurring subscriptions (monthly/yearly plans)
 * - SaaS applications with tiered pricing
 * - Integration with StripeFrontConfig configuration system
 * - Subscription management and upgrades
 *
 * **When to use:**
 * - You have a stripeFrontConfig with subscription definitions
 * - You want recurring payments (monthly/yearly)
 * - You're building SaaS applications
 * - You want automatic promotion codes and subscription features
 *
 * **Example:**
 * ```tsx
 * import { stripeFrontConfig } from '../config/stripeFrontConfig';
 *
 * <SubscriptionButton
 * configKey="pro_monthly"
 * config={stripeFrontConfig.pro_monthly}
 * successUrl="/subscription/success"
 * >
 * Subscribe to Pro - $29/month
 * </SubscriptionButton>
 * ```
 */
export function SubscriptionButton({
  config,
  children,
  ...props
}: SubscriptionButtonProps) {
  const { t } = useTranslation('billing');

  return (
    <StripeCheckoutButton
      {...props}
      priceId={config.priceId}
      mode="subscription"
      allowPromotionCodes={true}
      metadata={{
        tier: config.tier,
        duration: config.duration,
        ...config.metadata,
        ...props.metadata,
      }}
    >
      {children || t('components.buttons.subscribe')}
    </StripeCheckoutButton>
  );
}
