// packages/features/billing/src/components/ProductCard.tsx

/**
 * @fileoverview ProductCard Component
 * @description Reusable product card component for displaying products with purchase/subscription buttons
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { Crown, Check } from 'lucide-react';

import { Card, Badge, BADGE_VARIANT, Stack } from '@donotdev/components';
import {
  useTranslation,
  maybeTranslate,
  translateArray,
  type CheckoutMode,
} from '@donotdev/core';

import { PurchaseButton } from './PurchaseButton';
import { SubscriptionButton } from './SubscriptionButton';

/** Props for the ProductCard component. */
export interface ProductCardProps {
  namespace?: string;
  configKey: string; // Key from stripeFrontConfig (e.g., 'early_bird')
  id: string;
  name: string;
  price: string; // Display price (e.g., "2,000€")
  currency: string;
  description: string;
  features: string[];
  popular?: boolean;
  limitedTime?: boolean;
  /** Selects the button: PurchaseButton (payment) or SubscriptionButton (subscription). */
  mode: CheckoutMode;
  /** Stripe price ID (fixed pricing). Omitted: the server uses the back config priceId of `configKey`. */
  priceId?: string;
  /** Not forwarded by ProductCard (unchanged since 0.1.x). For dynamic pricing use StripeCheckoutButton. */
  unitAmount?: number;
  /** Not forwarded by ProductCard (unchanged since 0.1.x). For dynamic pricing use StripeCheckoutButton. */
  productName?: string;
  allowPromotionCodes?: boolean;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
  className?: string;
}

/**
 * ProductCard - Displays a product with features and purchase/subscription button
 *
 * This is a high-level component designed for building pricing tables and product showcases.
 * It internally composes `PurchaseButton` and `SubscriptionButton` to handle the checkout process.
 * Use `ProductCard` for standard pricing layouts instead of manually using the low-level buttons.
 *
 * Uses framework components with smart defaults for styling and translation.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function ProductCard({
  namespace = 'billing',
  configKey,
  id,
  name,
  price,
  currency,
  description,
  features,
  popular = false,
  limitedTime = false,
  mode,
  priceId,
  allowPromotionCodes = true,
  metadata = {},
  successUrl = '/billing/success',
  cancelUrl = '/purchase',
  className = '',
}: ProductCardProps) {
  const { t } = useTranslation([namespace, 'billing']);
  const priceDisplay = price === 'Free' ? 'Free' : price;
  const intervalText = mode === 'subscription' ? '/month' : '';

  // Smart translation: auto-detects keys vs plain strings
  const translatedName = maybeTranslate(t, name);
  const translatedDescription = maybeTranslate(t, description);

  // Handle features: if it's an array of translation keys, translate them
  // Otherwise if it's a string key (like "products.earlyBird.features"), use translateArray
  const translatedFeatures = Array.isArray(features)
    ? features.map((f) => maybeTranslate(t, f))
    : features
      ? translateArray(t, features, 10) // Max 10 features
      : [];

  return (
    <Card
      className={className}
      style={{
        position: 'relative',
        ...(popular && {
          boxShadow: 'var(--shadow-xl)',
          transform: 'scale(1.05)',
        }),
      }}
      title={
        <div style={{ textAlign: 'center' }}>
          <Stack align="center" style={{ marginBottom: 'var(--gap-md)' }}>
            <Crown
              className="dndev-size-touch"
              style={{ color: 'var(--warning)' }}
            />
          </Stack>
          <Stack
            direction="row"
            align="center"
            justify="center"
            gap="tight"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            {translatedName}
            {limitedTime && (
              <Badge as="span" variant={BADGE_VARIANT.DESTRUCTIVE}>
                {t('billing:components.productCard.limitedTime')}
              </Badge>
            )}
          </Stack>
          <div
            style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 700,
              color: 'var(--primary)',
            }}
          >
            {priceDisplay}
            {price !== 'Free' && (
              <span
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 400,
                  color: 'var(--muted-foreground)',
                }}
              >
                {intervalText} {t('billing:components.productCard.exclVat')}
              </span>
            )}
          </div>
        </div>
      }
      subtitle={translatedDescription}
    >
      <Stack as="ul" gap="tight" style={{ marginBottom: 'var(--gap-lg)' }}>
        {translatedFeatures.map((feature, index) => (
          <Stack as="li" key={index} direction="row" align="start">
            <Check
              className="dndev-size-md"
              style={{
                color: 'var(--success)',
                marginInlineEnd: 'var(--gap-md)',
                marginTop: '0.125rem',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>{feature}</span>
          </Stack>
        ))}
      </Stack>

      {mode === 'payment' ? (
        <PurchaseButton
          configKey={configKey}
          config={{
            type: 'StripePayment',
            name,
            price,
            currency,
            priceId,
            tier: 'premium',
            duration: 'lifetime',
            metadata,
            allowPromotionCodes,
          }}
          allowPromotionCodes={allowPromotionCodes}
          successUrl={successUrl}
          cancelUrl={cancelUrl}
          variant={popular ? 'primary' : 'outline'}
          className="dndev-w-full"
          icon={Crown}
        >
          {t('billing:components.productCard.purchaseNow')}
        </PurchaseButton>
      ) : (
        <SubscriptionButton
          configKey={configKey}
          config={{
            type: 'StripeSubscription',
            name,
            price,
            currency,
            priceId: priceId!, // Subscriptions require priceId (price_data not supported)
            tier: 'pro',
            duration: '1year',
            metadata,
            allowPromotionCodes,
          }}
          successUrl={successUrl}
          cancelUrl={cancelUrl}
          variant={popular ? 'primary' : 'outline'}
          className="dndev-w-full"
          icon={Crown}
        >
          {t('billing:components.productCard.subscribeNow')}
        </SubscriptionButton>
      )}
      {popular && (
        <div
          style={{
            position: 'absolute',
            top: '-0.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <Badge variant={BADGE_VARIANT.DEFAULT}>
            <Crown
              style={{
                width: '0.75rem',
                height: '0.75rem',
                marginInlineEnd: '0.25rem',
              }}
            />
            {t('billing:components.productCard.mostPopular')}
          </Badge>
        </div>
      )}
    </Card>
  );
}
