/**
 * @fileoverview Checkout button 0.1.x compatibility
 * @description Verifies the checkout buttons still send the 0.1.x request fields
 * (priceId, dynamic pricing, currency, mode, metadata.billingConfigKey) and the
 * additive StripeOrder fields (billingConfigKey, lineItems).
 *
 * @version 0.1.0
 * @since 0.1.45
 * @author AMBROISE PARK Consulting
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkoutSpy = vi.fn(async (_options: Record<string, unknown>) => ({
  sessionId: 'cs_test',
  sessionUrl: null,
  success: true,
}));
let clickHandler: (() => Promise<void>) | undefined;

vi.mock('@donotdev/components', () => ({
  Button: (props: { onClick: () => Promise<void>; children?: unknown }) => {
    clickHandler = props.onClick;
    return null;
  },
  Card: (props: { children?: unknown }) => props.children ?? null,
  Stack: (props: { children?: unknown }) => props.children ?? null,
  Badge: () => null,
  BADGE_VARIANT: { DEFAULT: 'default', DESTRUCTIVE: 'destructive' },
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('@donotdev/core', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  isDev: () => false,
  redirectToExternalUrlWithErrorHandling: vi.fn(),
  maybeTranslate: (_t: unknown, s: string) => s,
  translateArray: () => [],
}));

vi.mock('../useBillingAuth', () => ({ useBillingAuth: () => ({}) }));
vi.mock('../useStripeBilling', () => ({
  useStripeBilling: (method: string) =>
    method === 'checkout' ? checkoutSpy : 'ready',
}));

const { StripeCheckoutButton } = await import(
  '../components/StripeCheckoutButton'
);
const { PurchaseButton } = await import('../components/PurchaseButton');
const { SubscriptionButton } = await import('../components/SubscriptionButton');
const { ProductCard } = await import('../components/ProductCard');

async function click(element: React.ReactElement) {
  clickHandler = undefined;
  renderToStaticMarkup(element);
  if (!clickHandler) throw new Error('Button was not rendered');
  await clickHandler();
}

function lastOptions() {
  return checkoutSpy.mock.calls.at(-1)?.[0];
}

describe('checkout buttons: 0.1.x compatibility', () => {
  beforeEach(() => checkoutSpy.mockClear());

  it('StripeCheckoutButton forwards 0.1.x fixed pricing', async () => {
    await click(
      <StripeCheckoutButton
        configKey="lifetime"
        priceId="price_123"
        mode="payment"
        successUrl="https://app.test/ok"
        cancelUrl="https://app.test/ko"
        metadata={{ source: 'pricing' }}
        allowPromotionCodes={false}
      />
    );
    expect(lastOptions()).toEqual({
      billingConfigKey: 'lifetime',
      lineItems: undefined,
      priceId: 'price_123',
      unitAmount: undefined,
      productName: undefined,
      currency: undefined,
      mode: 'payment',
      successUrl: 'https://app.test/ok',
      cancelUrl: 'https://app.test/ko',
      metadata: { source: 'pricing' },
      allowPromotionCodes: false,
    });
  });

  it('StripeCheckoutButton forwards 0.1.x dynamic pricing with metadata.billingConfigKey', async () => {
    await click(
      <StripeCheckoutButton
        unitAmount={2500}
        productName="Credits"
        currency="usd"
        mode="payment"
        metadata={{ billingConfigKey: 'credits' }}
      />
    );
    expect(lastOptions()).toMatchObject({
      billingConfigKey: undefined,
      unitAmount: 2500,
      productName: 'Credits',
      currency: 'usd',
      mode: 'payment',
      metadata: { billingConfigKey: 'credits' },
    });
  });

  it('StripeCheckoutButton accepts configKey alone (server resolves the price)', async () => {
    const onError = vi.fn();
    await click(
      <StripeCheckoutButton configKey="pro" mode="subscription" onError={onError} />
    );
    expect(onError).not.toHaveBeenCalled();
    expect(lastOptions()).toMatchObject({
      billingConfigKey: 'pro',
      mode: 'subscription',
    });
  });

  it('StripeCheckoutButton sends StripeOrder lineItems', async () => {
    await click(
      <StripeCheckoutButton
        configKey="shop_order"
        mode="payment"
        lineItems={[{ productId: 'serum-30ml', quantity: 24 }]}
      />
    );
    expect(lastOptions()).toMatchObject({
      billingConfigKey: 'shop_order',
      lineItems: [{ productId: 'serum-30ml', quantity: 24 }],
    });
  });

  it('StripeCheckoutButton keeps the 0.1.x error without configKey, priceId or dynamic pricing', async () => {
    const onError = vi.fn();
    await click(<StripeCheckoutButton mode="payment" onError={onError} />);
    expect(checkoutSpy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('PurchaseButton sends config.priceId and config metadata', async () => {
    await click(
      <PurchaseButton
        configKey="early_bird"
        config={{
          type: 'StripePayment',
          name: 'Early bird',
          price: '49€',
          currency: 'EUR',
          priceId: 'price_early',
          tier: 'premium',
          duration: 'lifetime',
          allowPromotionCodes: true,
          metadata: { campaign: 'launch' },
        }}
      />
    );
    expect(lastOptions()).toMatchObject({
      billingConfigKey: 'early_bird',
      priceId: 'price_early',
      mode: 'payment',
      metadata: { tier: 'premium', duration: 'lifetime', campaign: 'launch' },
    });
  });

  it('SubscriptionButton sends config.priceId and subscription mode', async () => {
    await click(
      <SubscriptionButton
        configKey="pro_monthly"
        config={{
          type: 'StripeSubscription',
          name: 'Pro',
          price: '29€',
          currency: 'EUR',
          priceId: 'price_pro',
          tier: 'pro',
          duration: '1month',
        }}
      />
    );
    expect(lastOptions()).toMatchObject({
      billingConfigKey: 'pro_monthly',
      priceId: 'price_pro',
      mode: 'subscription',
      allowPromotionCodes: true,
    });
  });

  it('ProductCard forwards priceId and allowPromotionCodes', async () => {
    await click(
      <ProductCard
        configKey="early_bird"
        id="early_bird"
        name="Early bird"
        price="49€"
        currency="EUR"
        description=""
        features={[]}
        mode="payment"
        priceId="price_early"
        allowPromotionCodes={false}
      />
    );
    expect(lastOptions()).toMatchObject({
      billingConfigKey: 'early_bird',
      priceId: 'price_early',
      mode: 'payment',
      allowPromotionCodes: false,
    });
  });
});
