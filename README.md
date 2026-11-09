# @donotdev/billing

Production-ready billing system with Stripe integration and durable webhook idempotency.

## Features

- ✅ One-time payments and subscriptions
- ✅ Automatic webhook processing
- ✅ Durable webhook idempotency (Firestore or Postgres)
- ✅ Customizable hooks for business logic
- ✅ React components and templates
- ✅ Zero configuration required

## Quick Start

### 1. Install Dependencies

```bash
bun add @donotdev/billing @donotdev/types
```

### 2. Configure Your Products

**Important:** Frontend and backend configs are split for security and separation of concerns.

#### Backend Config (Functions)

```typescript
// apps/your-app/functions/src/config/stripeBackConfig.ts
import type { StripeBackConfig } from '@donotdev/types';

export const stripeBackConfig: StripeBackConfig = {
  web_dev_course: {
    type: 'StripePayment',
    name: 'Web Development Masterclass',
    price: 29900, // In cents (299.00 USD)
    currency: 'USD',
    priceId: process.env.STRIPE_PRICE_COURSE!,
    tier: 'course_access',
    duration: 'lifetime',
    description: 'Complete course with lifetime access',

    // Custom hook - grant course access after payment
    onPurchaseSuccess: async (userId, metadata) => {
      await grantCourseAccess(userId, 'web-dev-masterclass');
      await sendWelcomeEmail(userId);
    },
  },
  pro_monthly: {
    type: 'StripeSubscription',
    name: 'Pro Plan',
    price: 2900, // In cents (29.00 USD)
    currency: 'USD',
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    tier: 'pro',
    duration: '1month',
    description: 'Monthly subscription with all features',

    onSubscriptionCreated: async (userId, metadata) => {
      await enableProFeatures(userId);
      await sendWelcomeEmail(userId);
    },
  },
};
```

#### Frontend Config (App)

```typescript
// apps/your-app/src/config/stripeFrontConfig.ts
import type { StripeFrontConfig } from '@donotdev/types';

export const stripeFrontConfig: StripeFrontConfig = {
  web_dev_course: {
    name: 'Web Development Masterclass',
    price: 299, // Display price (in currency units)
    currency: 'USD',
    priceId: import.meta.env.VITE_STRIPE_PRICE_COURSE || '',
    description: 'Complete course with lifetime access',
    features: [
      '50+ hours of video content',
      'Lifetime access',
      'Downloadable resources',
      'Community support',
    ],
  },
  pro_monthly: {
    name: 'Pro Plan',
    price: 29, // Display price (in currency units)
    currency: 'USD',
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || '',
    description: 'Monthly subscription with all features',
    features: [
      'All premium features',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
    ],
  },
};
```

### 3. Create Webhook Handler

```typescript
// apps/your-app/functions/src/index.ts
import {
  createCheckoutSession,
  createStripeWebhook,
} from '@donotdev/functions/firebase';
import { stripeBackConfig } from './config/stripeBackConfig.js';

export const createCheckout = createCheckoutSession(stripeBackConfig);
export const handleStripeWebhook = createStripeWebhook(stripeBackConfig);
```

### 4. Create Frontend Page

```typescript
// apps/your-app/src/pages/PricingPage.tsx
import { PaymentTemplate } from '@donotdev/templates';
import { stripeFrontConfig } from '../config/stripeFrontConfig';

export default function PricingPage() {
  return (
    <PaymentTemplate
      namespace="pricing"
      meta={{
        namespace: 'pricing',
        auth: { required: true },
        title: 'Pricing',
      }}
      billing={stripeFrontConfig}
      successUrl="/success"
      cancelUrl="/pricing"
    />
  );
}
```

### 5. Configure App

```typescript
// apps/your-app/src/App.tsx
import { stripeFrontConfig } from './config/stripeFrontConfig';

const APP_CONFIG = {
  // ... other config
  billing: {
    config: stripeFrontConfig,
    functions: {
      createCheckout: 'createCheckout',
      webhook: 'handleStripeWebhook',
    },
  },
};
```

### 6. Deploy

```bash
firebase deploy --only functions
```

**That's it!** Your billing system is live. 🎉

**Summary:**

- **Backend**: `stripeBackConfig.ts` (with hooks) → Functions
- **Frontend**: `stripeFrontConfig.ts` (display only) → App
- **Security**: Frontend config has no hooks/secrets, safe to bundle

---

## Idempotency

Every webhook entry point stores processed Stripe events durably, so a redelivered event never runs your hooks twice in a row:

- **Firebase:** Firestore collection `webhook_idempotency`
- **Supabase:** table `webhook_events` (migration `20250101000005_webhook_events.sql`)
- **Vercel:** the store of the `backend` you pass

Delivery is **at least once**: a hook that throws makes the webhook answer non-2xx so Stripe retries, and a hook can run again if the event could not be recorded after it succeeded. Write hooks so a second run is a no-op (key on `orderId` / `ctx.eventId`, or check the state you are about to set).

Processed events are kept 30 days (Stripe resends events up to 30 days old). Supabase prunes them with a daily pg_cron job. On Firebase, enable the TTL policy once:

```bash
gcloud firestore fields ttls update expiresAt --collection-group=webhook_idempotency --enable-ttl --project=<PROJECT_ID>
```

Firestore rules: keep the collection server-only.

```javascript
match /webhook_idempotency/{document=**} {
  allow read, write: if false;
}
```

---

## Common Use Cases

### SaaS Subscription Plans

```typescript
// Backend: apps/your-app/functions/src/config/stripeBackConfig.ts
export const stripeBackConfig: StripeBackConfig = {
  starter_monthly: {
    type: 'StripeSubscription',
    name: 'Starter',
    price: 1900, // In cents (19.00 USD)
    currency: 'USD',
    priceId: 'price_starter_monthly',
    tier: 'starter',
    duration: '1month',
    onSubscriptionCreated: async (userId) => {
      await enableFeatures(userId, ['feature1', 'feature2']);
    },
  },
  pro_monthly: {
    type: 'StripeSubscription',
    name: 'Pro',
    price: 4900, // In cents (49.00 USD)
    currency: 'USD',
    priceId: 'price_pro_monthly',
    tier: 'pro',
    duration: '1month',
    onSubscriptionCreated: async (userId) => {
      await enableFeatures(userId, ['feature1', 'feature2', 'feature3']);
    },
  },
};

// Frontend: apps/your-app/src/config/stripeFrontConfig.ts
export const stripeFrontConfig: StripeFrontConfig = {
  starter_monthly: {
    name: 'Starter',
    price: 19, // Display price
    currency: 'USD',
    priceId: import.meta.env.VITE_STRIPE_PRICE_STARTER_MONTHLY || '',
    description: 'Perfect for getting started',
    features: ['Feature 1', 'Feature 2'],
  },
  pro_monthly: {
    name: 'Pro',
    price: 49, // Display price
    currency: 'USD',
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || '',
    description: 'For growing businesses',
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
  },
};
```

### Digital Products (Courses, eBooks)

```typescript
// Backend: functions/src/config/stripeBackConfig.ts
export const stripeBackConfig: StripeBackConfig = {
  react_course: {
    type: 'StripePayment',
    name: 'React Masterclass',
    price: 19900, // In cents (199.00 USD)
    currency: 'USD',
    priceId: process.env.STRIPE_PRICE_REACT_COURSE!,
    tier: 'course_react',
    duration: 'lifetime',
    onPurchaseSuccess: async (userId, metadata) => {
      await grantCourseAccess(userId, 'react-masterclass');
      await sendCourseCredentials(userId);
    },
  },
};

// Frontend: src/config/stripeFrontConfig.ts
export const stripeFrontConfig: StripeFrontConfig = {
  react_course: {
    name: 'React Masterclass',
    price: 199, // Display price
    currency: 'USD',
    priceId: import.meta.env.VITE_STRIPE_PRICE_REACT_COURSE || '',
    description: 'Complete React course with lifetime access',
    features: ['50+ hours', 'Downloadable resources', 'Community support'],
  },
};
```

---

## Environment Variables

### Required

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=<stripe_secret_key>
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_API_VERSION=2025-08-27.basil  # REQUIRED - No fallback

# Stripe Price IDs
VITE_STRIPE_PRICE_COURSE=price_xxx
VITE_STRIPE_PRICE_PRO_MONTHLY=price_xxx
VITE_STRIPE_PRICE_PRO_YEARLY=price_xxx

# Frontend
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### Optional (Firebase)

If not running in Firebase Functions environment:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="<firebase_private_key>"
```

---

## Components

### PurchaseButton

```typescript
import { PurchaseButton } from '@donotdev/billing';
import { stripeFrontConfig } from '../config/stripeFrontConfig';

<PurchaseButton
  configKey="react_course"
  config={stripeFrontConfig.react_course}
  successUrl="/success"
  cancelUrl="/pricing"
/>
```

### SubscriptionButton

```typescript
import { SubscriptionButton } from '@donotdev/billing';
import { stripeFrontConfig } from '../config/stripeFrontConfig';

<SubscriptionButton
  configKey="pro_monthly"
  config={stripeFrontConfig.pro_monthly}
  successUrl="/success"
  cancelUrl="/pricing"
/>
```

### PaymentTemplate

Auto-renders all products from your frontend config:

```typescript
import { PaymentTemplate } from '@donotdev/templates';
import { stripeFrontConfig } from '../config/stripeFrontConfig';

<PaymentTemplate
  namespace="pricing"
  meta={{ namespace: 'pricing', auth: { required: true } }}
  billing={stripeFrontConfig}
  successUrl="/success"
  cancelUrl="/pricing"
/>
```

---

## Custom Hooks

All hooks are **optional** and run **after** subscription updates:

### One-Time Payments

```typescript
onPurchaseSuccess?: (userId: string, metadata: any) => Promise<void>;
onPurchaseFailure?: (userId: string, metadata: any) => Promise<void>;
```

**Example:**

```typescript
onPurchaseSuccess: async (userId, metadata) => {
  // Grant access to purchased content
  await database.update('users', userId, {
    hasCourseAccess: true,
    purchasedAt: new Date(),
  });

  // Send confirmation email
  await sendEmail(userId, 'purchase-confirmation');

  // Track analytics
  await analytics.track('purchase_completed', { userId, product: 'course' });
};
```

### Subscriptions

```typescript
onSubscriptionCreated?: (userId: string, metadata: any) => Promise<void>;
onSubscriptionRenewed?: (userId: string, metadata: any) => Promise<void>;
onSubscriptionCancelled?: (userId: string, metadata: any) => Promise<void>;
onPaymentFailed?: (userId: string, metadata: any) => Promise<void>;
```

**Example:**

```typescript
onSubscriptionCreated: async (userId, metadata) => {
  // Enable premium features
  await database.update('users', userId, {
    tier: 'pro',
    features: ['advanced-analytics', 'priority-support'],
  });

  // Send welcome email
  await sendEmail(userId, 'welcome-pro-plan');
};

onSubscriptionCancelled: async (userId, metadata) => {
  // Schedule downgrade at period end
  await database.update('users', userId, {
    scheduledDowngrade: true,
    downgradeTo: 'free',
  });

  // Send cancellation email with feedback request
  await sendEmail(userId, 'subscription-cancelled');
};
```

### Hook Error Handling

Hooks are wrapped in try-catch blocks. If a hook fails:

- ✅ Error is logged (non-critical)
- ✅ Webhook continues processing
- ✅ Subscription is still updated
- ✅ User is not affected

Example:

```typescript
onPurchaseSuccess: async (userId, metadata) => {
  // Grant access to external service
  await sendToSlack(userId); // If Slack API fails...

  // Result:
  // - Error logged: "Hook failed (non-critical)"
  // - User subscription still updated
  // - User still gets access
  // - You can retry manually later
};
```

---

## TypeScript Types

```typescript
import type {
  StripeFrontConfig, // Frontend config (display only)
  StripeBackConfig, // Backend config (with hooks)
  StripePayment,
  StripeSubscription,
} from '@donotdev/types';
```

**Note:** Frontend and backend configs are separate:

- **Frontend (`StripeFrontConfig`)**: Display-only, safe to bundle in client code
- **Backend (`StripeBackConfig`)**: Includes hooks and business logic, must stay in functions

---

## Testing

### Test Webhooks (Stripe CLI)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:5001/YOUR-PROJECT/europe-west1/stripeWebhook

# Trigger test webhook
stripe trigger checkout.session.completed
```

### Test Idempotency

Resend an event that was already delivered (`stripe trigger` creates a new event each time):

```bash
stripe events resend evt_...   # logs "Already processed"
```

---

## Architecture

```
User clicks "Purchase"
  ↓
Frontend calls Stripe directly (no proxy needed)
  ↓
User completes payment on Stripe
  ↓
Stripe sends webhook to your endpoint
  ↓
Framework processes webhook:
  ├─ Verifies signature ✅
  ├─ Reserves the event (Firestore or Postgres) ✅
  ├─ Updates user subscription (customClaims) ✅
  ├─ Calls your custom hooks ✅
  └─ Marks event as processed ✅
  ↓
User has access ✅
```

---

## Troubleshooting

### "Webhook signature verification failed"

**Check:**

1. `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Using raw request body (not parsed JSON)
3. Webhook endpoint URL is correct

### "Unknown billing config key"

**Check:**

1. `billingConfigKey` in metadata matches your `stripeBackConfig` keys
2. You're passing `configKey` to components (not `config.name`)
3. Backend config (`stripeBackConfig`) has the matching key

### Duplicate Processing

**With Firestore:** Should never happen (production-ready)

**Without Firestore:** Possible on function restart (rare)

**Solution:** Enable Firestore for production (> 100 transactions/day)

---

## Advanced

### Custom Metadata

Pass custom data to hooks:

```typescript
import { stripeFrontConfig } from '../config/stripeFrontConfig';

<PurchaseButton
  configKey="react_course"
  config={stripeFrontConfig.react_course}
  metadata={{
    referralCode: 'FRIEND20',
    campaignId: 'summer-sale',
  }}
/>
```

Access in hooks:

```typescript
onPurchaseSuccess: async (userId, metadata) => {
  if (metadata.referralCode) {
    await rewardReferrer(metadata.referralCode);
  }
  await trackCampaign(metadata.campaignId);
};
```

### Idempotency Store

Webhook entry points wire the durable store of their backend. Custom handlers use the same contract:

```typescript
import { createFirestoreIdempotencyStore } from '@donotdev/functions/firebase';
// Supabase: createSupabaseIdempotencyStore(supabaseAdmin) from '@donotdev/functions/supabase'

const store = createFirestoreIdempotencyStore();
const reservation = await store.reserve('evt_123');

if (reservation.state === 'in_progress') {
  // Another delivery is running it: answer non-2xx so Stripe retries later
  throw new Error('Event in progress');
}
if (reservation.state === 'reserved') {
  try {
    await handle(); // must be idempotent: it can run again
  } catch (error) {
    await store.release('evt_123', reservation.ownerToken); // let the retry run
    throw error;
  }
  await store.markProcessed('evt_123', reservation.ownerToken);
}
// state 'processed': already handled, answer 2xx
```

---
