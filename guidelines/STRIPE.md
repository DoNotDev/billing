# Stripe Setup

## Prerequisites
- Stripe account (https://dashboard.stripe.com)
- `@donotdev/billing` installed

## 1. Get API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Publishable key** (`pk_test_...`) -> `.env`
3. Copy your **Secret key** (`<stripe_secret_key>`) -> `supabase/functions/.env` or `functions/.env`

> **Security:** Never commit secret keys. Stripe also supports restricted keys (`rk_test_...`, `rk_live_...`) for tighter permissions.

## 2. Configure Webhook

The endpoint must use API version `2025-02-24.acacia`, the same as `STRIPE_API_VERSION` in the functions env. Event payloads follow the endpoint's version, not the SDK's. StripeOrder needs acacia or later; subscription handling reads `invoice.subscription` and `subscription.current_period_end`, which `2025-03-31.basil` removed, so do not use basil or later.

The Dashboard only creates endpoints on the latest API version, and an endpoint's version cannot be changed afterwards. Create it with the API:

```bash
curl https://api.stripe.com/v1/webhook_endpoints -u "$STRIPE_SECRET_KEY:" \
  -d url="<ENDPOINT_URL>" \
  -d api_version=2025-02-24.acacia \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.async_payment_succeeded" \
  -d "enabled_events[]=checkout.session.async_payment_failed" \
  -d "enabled_events[]=checkout.session.expired" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_succeeded" \
  -d "enabled_events[]=invoice.payment_failed"
```

`<ENDPOINT_URL>`:
- Supabase: `https://{{PROJECT_ID}}.supabase.co/functions/v1/stripe-webhook`
- Firebase: `https://europe-west1-{{PROJECT_ID}}.cloudfunctions.net/stripeWebhook` (replace `europe-west1` with your region if different)
- Vercel: `https://{{DOMAIN}}/api/billing/stripe-webhook` (route exporting `createStripeWebhook(config, { backend })`)

The response's `secret` (`whsec_...`) is the signing secret -> `STRIPE_WEBHOOK_SECRET` in the functions env.

**Async payment events are required** for every item type, not only StripeOrder: a session paid by a delayed method (SEPA debit) completes unpaid, and StripePayment / StripeSubscription grant the tier on `checkout.session.async_payment_succeeded`. Apps set up on 0.1.x with `checkout.session.completed` only must add both `async_payment_*` events (`POST /v1/webhook_endpoints/<id>` with `enabled_events[]`).

**Idempotency** is durable and keeps processed events 30 days (Stripe resends events up to 30 days old):
- **Supabase:** apply the `webhook_events` migration (CLI template `20250101000005_webhook_events.sql`, or `WEBHOOK_EVENTS_SQL` from `@donotdev/functions/supabase`). Its functions only accept `service_role`; a daily pg_cron job deletes events older than 30 days. Deploy `stripe-webhook` with JWT verification off (`[functions.stripe-webhook] verify_jwt = false`).
- **Firebase:** events live in Firestore `webhook_idempotency`. Enable the TTL policy once so expired events are deleted: `gcloud firestore fields ttls update expiresAt --collection-group=webhook_idempotency --enable-ttl --project=<PROJECT_ID>`.

## 2b. StripeOrder (B2B shop)

- **Tax:** `tax.mode: 'manual'` -> create Tax Rates (Dashboard -> Tax rates) as **exclusive** and list their IDs; checkout rejects an inclusive rate, which would carve VAT out of the price. `tax.mode: 'automatic'` -> enable Stripe Tax and add your registrations; reverse charge then follows the buyer's tax ID.
- **Payment methods:** create a Payment Method Configuration (Dashboard -> Settings -> Payment methods) with card and/or SEPA debit, set its ID as `paymentMethodConfiguration`. SEPA payments complete later: the order is paid on `checkout.session.async_payment_succeeded`.
- **Shipping:** create Shipping Rates and list their IDs in `shipping.shippingRateIds` (at most 5). `allowedCountries` are uppercase ISO codes (`FR`, `DE`).
- **Metadata:** at most 50 keys including the server's own, keys up to 40 characters, values up to 500 characters (Stripe limits, checked before the session is created).
- **Invoices:** `invoiceCreation: true` generates a post-payment invoice (Stripe pricing applies).

## 3. Environment Variables

### App `.env` (public)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Functions `.env` (secret)
```
STRIPE_SECRET_KEY=<stripe_secret_key>
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_VERSION=2025-02-24.acacia  # same as the webhook endpoint
```

## 4. Test Clocks (Optional)

For subscription testing without waiting for real billing cycles:
1. Go to https://dashboard.stripe.com/test/test-clocks
2. Create a test clock
3. Create customers attached to the test clock
4. Advance time to trigger billing events

## 5. Verify

```bash
dndev setup          # Validates key formats + health check
dndev doctor         # Full health check for all providers
```

Check that:
- Publishable key format is valid
- Secret key format is valid
- Key modes match (both test or both live)
