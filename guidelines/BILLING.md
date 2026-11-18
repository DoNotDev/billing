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

**Request shape:** the client sends `billingConfigKey` (StripeOrder adds `lineItems: [{ productId, quantity }]`). The user always comes from the auth context. Single-price items (StripePayment / StripeSubscription) also accept the 0.1.x fields: `priceId` (must match the back config `priceId` when it has one; defaults to it) and `mode` (defaults to the item type). 0.1.x calls (`checkout({ priceId, mode, metadata: { billingConfigKey } })`) work unchanged.

---

## Ownership: Billing Produces Access Updates

Auth owns canonical `SubscriptionClaimsSchema`, `SubscriptionClaims`, `UserSubscription`, statuses and defaults in core. Billing consumes this contract and produces access updates; billing constants/schemas retain compatibility re-exports. Auth decoding must not depend on billing. There is only one persisted access representation: `customClaims.subscription` (Supabase: `app_metadata.subscription`), not a separate billing access store or flat tier.

Generic access requires only `tier: string`, `status: string`, `subscriptionEnd: ISO timestamp | null`, `updatedAt: ISO timestamp`; `features` / `isDefault` are optional. Optional nullable `subscriptionId` / `customerId` and optional `cancelAtPeriodEnd` are deprecated compatibility projections. Generic grants need no billing IDs. Billing's `SubscriptionDataSchema` retains its required paid fields; `updateUserSubscription` validates canonical claims before writing and preserves actual billing IDs when present. A one-time checkout may have no customer; it writes null instead of substituting a user ID.

Self-service claim setters cannot write `subscription`, even if mistakenly allowlisted; removers cannot clear it. Supabase self-service writes patch only allowed keys, and removals send null tombstones, so they do not replay stale access metadata. Supabase Auth [merges metadata and deletes null keys](https://github.com/supabase/auth/blob/master/internal/models/user.go) (`UpdateAppMetaData`). Firebase read/replace claim writes and billing read/merge/write helpers are not transactional: preservation of unrelated claims applies to the read snapshot, not concurrent updates. All writers need shared serialization to guarantee concurrent grant/revoke integrity; these helpers do not supply it.

Tier guards/provider `hasTier()` are hierarchical and compare raw tier, regardless of status or expiry. Unknown/unconfigured tiers deny; malformed present subscriptions fail/deny. `isActive` checks only `status === 'active'`; expiry is not automatically enforced. Legacy/custom status strings remain accepted, without adding trial/grace policy. To revoke access, write a complete free subscription or explicitly clear the key; changing status alone is insufficient. For the generic server grant/revoke path, see [Authentication](../../auth/guidelines/AUTH.md#access-subscriptions-auth-owned).

After a server/webhook change, explicitly refresh in the affected browser:

```typescript
import { getProvider } from '@donotdev/core';

const token = await getProvider('auth').refreshToken();
if (token === null) throw new Error('Auth refresh failed');
```

This existing provider method applies canonical state before successful resolution; it is not a `useAuth` selector. A webhook/setter cannot remotely force another user's browser to refresh. Fresh page metadata from Supabase `getUser()` does not update JWT claims used by direct RLS `auth.jwt()`; immediate revocation needs authoritative policy at the protected operation.

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
    priceId: process.env.STRIPE_PRICE_PRO_PLAN!, // charged price
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

## Advanced: Read-only StripeOrder return verification

A success URL flag is not payment confirmation. Send `{ sessionId, billingConfigKey }` to an authenticated server handler. The framework's `verifyOrderCheckoutAlgorithm` (from `@donotdev/functions` / `@donotdev/functions/shared`, also exported by `/supabase`) retrieves provider state and checks the server config, session ID/mode, server metadata and **persisted** order/session binding. Retrieval is a separate dependency: existing `StripeSessionProvider` implementations need no new methods.

Use the existing handler boundary; this example is an app factory, not a new framework endpoint:

```typescript
import type Stripe from 'stripe';
import * as v from 'valibot';
import type { StripeBackConfig } from '@donotdev/core/server';
import {
  createSupabaseHandler,
  verifyOrderCheckoutAlgorithm,
} from '@donotdev/functions/supabase';
import type { VerifyOrderCheckoutDependencies } from '@donotdev/functions/supabase';

// App wires its server config, server Stripe client and authoritative read-only resolver.
export function createVerifyCheckoutHandler(
  billingConfig: StripeBackConfig,
  stripe: Stripe,
  resolveOrderBinding: VerifyOrderCheckoutDependencies['resolveOrderBinding']
) {
  return createSupabaseHandler(
    'verify-order-checkout',
    v.unknown(), // semantic validation happens inside the algorithm, not before it
    (request, ctx) => verifyOrderCheckoutAlgorithm(request, {
      userId: ctx.uid, // verified auth context, never request.userId
      billingConfig,
      retrieveStripeSession: (id) => stripe.checkout.sessions.retrieve(id),
      resolveOrderBinding,
    })
  );
}
```

- The app must persist `{ orderId, userId, sessionId, billingConfigKey }` after checkout creation, before relying on return verification. The resolver receives `{ sessionId, billingConfigKey, userId }`, reads authoritative app storage scoped to that owner/config, and returns the binding or `null`/`undefined`. Every field is independently checked. Missing, foreign or mismatched bindings fail closed with the same public error; metadata is **never** a fallback. Dependency failures expose no provider/storage details. The framework's existing server logger records only fixed `stage` (`validation`, `auth`, `config`, `binding`, `provider`, `response`) and `category` (`invalid`, `rejected`, `unavailable`) labels, distinguishing dependency unavailability from rejected bindings without logging errors, identifiers, credentials or customer metadata. Logger failures never replace the safe public error; the app still owns resolver/storage and provider availability.
- Use `v.unknown()` at this handler boundary: the algorithm still mandatorily validates the parsed value using `VerifyOrderCheckoutRequestSchema`. Using that schema directly in `createSupabaseHandler` instead returns detailed validation errors before the algorithm runs. For requests reaching the algorithm, malformed semantic payloads, missing/foreign/mismatched bindings and provider failures all map to HTTP 403 with `{ "error": "Checkout verification denied" }`. Method, authentication, authorization, rate limit, body-size and JSON parsing behavior belong to the base handler and are outside this uniform algorithm contract. Currently invalid JSON is parsed as `{}` by that handler and then rejected by the algorithm; do not rely on this transport behavior as part of the uniform contract. Diagnostics contain fixed stage/category labels only.
- Only `{ sessionId, orderId, billingConfigKey, sessionStatus, paymentStatus }` is returned. No customer details, arbitrary metadata, payment intents or fulfillment assertions leave this path. The core exports additive `VerifyOrderCheckoutRequest` / `VerifyOrderCheckoutResult`, their schemas and `validateVerifyOrderCheckoutRequest` / `validateVerifyOrderCheckoutResult` safe-parse helpers.
- `sessionStatus` is `open | complete | expired`; `paymentStatus` is `paid | unpaid | no_payment_required`. A complete/unpaid session is still awaiting payment. A complete session with paid/no-payment-required state is payment confirmation, **not** fulfillment confirmation. Expiration is represented separately; never treat a redirect or session completion alone as paid. See the [provider session contract](https://docs.stripe.com/api/checkout/sessions/object).
- Verification performs no writes and invokes no hooks. `onOrderPaid` and the existing webhook path remain the fulfillment boundary; no parallel lifecycle is introduced. Return-before-webhook and reload may report payment settled while app order processing remains pending. Read fulfillment state separately through an authorized app operation.
- App adoption remains required: remove flag-authorized success/cart clearing, pass the session reference, and present payment and order-processing states separately. Preserve carts initially; any later reconciliation must follow the app's paid checkout snapshot policy, never clear newer cart contents based on this result. Existing `ProcessPaymentSuccess*` declarations and checkout/webhook call signatures are unchanged.

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
