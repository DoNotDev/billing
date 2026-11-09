# Billing

**Most is pre-configured.** Create Stripe config files. Framework handles checkout, webhooks, subscriptions, and loading UX.

---

## Standard Use

**Environment:**
```bash
# apps/<app>/.env (frontend, public)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# .dndev.secrets (project root, gitignored)
STRIPE_SECRET_KEY=<stripe_secret_key>
STRIPE_WEBHOOK_SECRET=whsec_xxx  # From 'stripe listen' or Stripe Dashboard -> Webhooks
```

**Stripe Dashboard:** Create products, copy Price IDs (`price_...`). StripeOrder items need no Stripe products: lines are priced by the app.

**Request shape:** the client sends `billingConfigKey` (StripeOrder adds `lineItems: [{ productId, quantity }]`). The user always comes from the auth context. Single-price items (StripePayment / StripeSubscription) also accept the 0.1.x fields: `priceId` (must match the back config `priceId` when it has one; defaults to it), dynamic pricing `unitAmount` + `productName` (capped by the back config `maxUnitAmount`, not for subscriptions) and `mode` (defaults to the item type). 0.1.x calls (`checkout({ priceId, mode, metadata: { billingConfigKey } })`) work unchanged.

---

## Automatic UX (Zero Config)

**The hook handles loading overlays automatically for redirect operations:**

```tsx
// Just call the method - framework handles the rest
const checkout = useStripeBilling('checkout', authState);
const openCustomerPortal = useStripeBilling('openCustomerPortal', authState);

// Checkout -> Shows "Redirecting to Stripe" / "Initializing secure payment..."
await checkout({ billingConfigKey: 'pro_plan' }); // single product / subscription
await checkout({ billingConfigKey: 'shop_order', lineItems: cart }); // StripeOrder

// Portal -> Shows "Redirecting to Stripe" / "Opening billing portal..."
await openCustomerPortal();
```

**What happens automatically:**
- Blocking fullscreen overlay during Firebase Functions cold start
- Operation-specific messaging (checkout vs portal)
- Translated in all 8 supported languages
- Clean removal on redirect or error

**Optional:** Use `loading` state if you want to disable your own buttons:
```tsx
const loading = useStripeBilling('loading', authState);
<Button disabled={loading}>Purchase</Button>
```

---

## Advanced: Frontend Config

```typescript
// src/config/stripeFrontConfig.ts
export const stripeFrontConfig: StripeFrontConfig = {
  pro_plan: {
    name: 'Pro Plan',
    price: 29,
    currency: 'USD',
    priceId: 'price_1234567890', // sent by PurchaseButton / SubscriptionButton; must match the back config
    allowPromotionCodes: true,
  },
};
```

---

## Advanced: Backend Config

```typescript
// functions/src/config/stripeBackConfig.ts
export const stripeBackConfig: StripeBackConfig = {
  pro_plan: {
    type: 'StripeSubscription', // or 'StripePayment' (one-time, grants a tier)
    name: 'Pro',
    price: 2900, // In cents
    currency: 'EUR',
    priceId: process.env.STRIPE_PRICE_PRO_PLAN!, // charged price (or set maxUnitAmount for client dynamic pricing)
    tier: 'pro',
    duration: '1month',
    onSubscriptionCreated: async (userId, metadata) => { /* Grant features */ },
  },
};
```

The tier is granted when the session is paid (`payment_status` `paid` or `no_payment_required`). A delayed method (SEPA debit) completes the session unpaid: the tier is granted on `checkout.session.async_payment_succeeded`, and nothing is granted if the debit fails.

**Entry points (same behaviour on every provider):**

| Provider | Checkout | Webhook |
|---|---|---|
| Firebase | `createCheckoutSession(config)` | `createStripeWebhook(config)` |
| Supabase | `createCheckoutSession(config)` | `createStripeWebhook(config)` (+ `webhook_events` migration) |
| Vercel | `createCheckoutSession(config, { backend })` | `createStripeWebhook(config, { backend })` |

Vercel `backend: 'firebase' | 'supabase'` selects token verification, rate limiting, user claims and idempotency storage. Import from `@donotdev/functions/{firebase|supabase|vercel}`.

---

## Advanced: StripeOrder (multi-line, one-time, B2B)

```typescript
export const stripeBackConfig: StripeBackConfig = {
  shop_order: {
    type: 'StripeOrder',
    name: 'Order',
    currency: 'eur',
    tax: { mode: 'manual', taxRateIds: ['txr_...'] }, // or { mode: 'automatic' } (Stripe Tax)
    taxIdCollection: 'optional',          // 'disabled' | 'optional' | 'required'
    billingAddressCollection: 'required',
    shipping: { allowedCountries: ['FR', 'BE'], shippingRateIds: ['shr_...'] },
    customerCreation: 'always',
    invoiceCreation: true,                // post-payment Stripe invoice
    paymentMethodConfiguration: 'pmc_...', // card, SEPA debit... (omit = account default)
    allowPromotionCodes: false,           // orders: back config only

    // Server pricing: unit amounts excl. VAT, smallest currency unit. Create the pending order here.
    resolveLineItems: async (items, { userId }) => {
      const order = await createPendingOrder(userId, items); // app code
      return { orderId: order.id, lineItems: order.lines }; // [{ productId, name, unitAmount, quantity }]
    },
    // Card: at checkout completion. SEPA debit: when the debit succeeds.
    onOrderPaid: async (session, lineItems, { orderId }) => {
      await markOrderPaid(orderId, session); // must be idempotent on orderId
    },
    onOrderPaymentFailed: async (session, { orderId }) => { /* async debit failed */ },
    onOrderExpired: async (session, { orderId }) => { /* release the pending order */ },
  },
};
```

- Per-order options: `resolveLineItems` may return `session` next to `orderId` / `lineItems` when the choice depends on the buyer or the order: `taxRateIds` (manual tax; replaces `tax.taxRateIds`, `[]` = no tax, e.g. EU B2B reverse charge; each must be exclusive), `paymentMethodTypes` (`['card']`, `['sepa_debit']`; replaces `paymentMethodConfiguration`), `expiresAt` (Unix seconds, 30 min – 24 h from now), `invoiceFooter` (needs `invoiceCreation`). Validated before Stripe is called.
- Custom entry point (app request shape, e.g. extra fields such as a delivery address): build a handler with `createSupabaseHandler` and call `createCheckoutAlgorithm(request, ctx.uid, provider, authProvider, config)` with your own `StripeSessionProvider` (all exported from `@donotdev/functions/supabase`).
- `session` is a `CheckoutSessionSnapshot`: amounts, buyer email/name/business name, billing address, tax IDs, shipping, `invoiceId`, `paymentIntentId`.
- `lineItems` are read back from Stripe (`PaidLineItem`: productId, quantity, subtotal, tax, total).
- Server metadata `userId`, `billingConfigKey`, `orderId` is set on the session, the payment intent and the invoice; client metadata cannot overwrite it.
- Requires Stripe API version `2025-02-24.acacia` (`STRIPE_API_VERSION`, default, and the webhook endpoint): order events from an older endpoint version are rejected. Payloads follow the endpoint's version, not the SDK's.
- Delivery is at least once. A hook that throws makes the webhook answer non-2xx and Stripe retries it. A hook can also run again after it succeeded, if the event could not be recorded as processed. Every hook must be idempotent on `orderId` / `ctx.eventId` (e.g. `markOrderPaid` no-ops on a paid order).
- A delivery that arrives while another delivery of the same event is still running gets non-2xx, so Stripe retries it later instead of the event being lost.

---

## Advanced: Components & Hooks

```tsx
import { useStripeBilling } from '@donotdev/billing';
import { SubscriptionTemplate, PaymentTemplate } from '@donotdev/templates';
import { ProductCard, SubscriptionManager } from '@donotdev/billing';

// Auth state required
const user = useAuth('user');
const status = useAuth('status');
const authState = { user, status };

// Methods - framework handles overlay automatically
const checkout = useStripeBilling('checkout', authState);
const openCustomerPortal = useStripeBilling('openCustomerPortal', authState);

// Optional state access
const loading = useStripeBilling('loading', authState);
const error = useStripeBilling('error', authState);
```

---

**Create config files, get billing with best-in-class UX. Framework handles the rest.**
