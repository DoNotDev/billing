# Stripe Setup Guide for DoNotDev Framework

This guide shows how to configure Stripe for your DoNotDev framework demo app, including metadata handling for GitHub access management.

## 1. Stripe Dashboard Setup

### Create Products and Prices

1. **Go to Stripe Dashboard** → Products
2. **Create Products:**
   - **Early Bird Lifetime** - `price_early_bird_lifetime`
   - **Yearly Subscription** - `price_yearly_subscription`
   - **Monthly Subscription** - `price_monthly_subscription`

3. **Configure Prices:**
   ```
   Early Bird Lifetime: $299 (one-time)
   Yearly Subscription: $99/year
   Monthly Subscription: $19/month
   ```

### Set Up Webhooks

1. **Go to Stripe Dashboard** → Webhooks
2. **Add Endpoint:** `https://your-domain.com/api/stripe/webhook`
3. **Select Events:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

4. **Copy Webhook Secret** for environment variables

## 2. Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=<stripe_secret_key>
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# GitHub Integration (for webhook processing)
GITHUB_TOKEN=<github_personal_access_token>
GITHUB_ORG=your-org-name
GITHUB_TEAM_ID=123456789
```

## 3. Firebase Functions Setup

### Webhook Handler Function

```typescript
// functions/src/stripe/webhook.ts
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { Octokit } from '@octokit/rest';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const stripeWebhook = onRequest({ cors: true }, async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const payload = JSON.stringify(req.body);

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err}`);
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { metadata } = session;
  const githubId = metadata.githubId;
  const priceId = metadata.priceId;

  if (!githubId) {
    console.error('No GitHub ID in metadata');
    return;
  }

  // Determine access level based on price
  const accessLevel = getAccessLevel(priceId);

  if (accessLevel) {
    await grantGitHubAccess(githubId, accessLevel);
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const { metadata } = subscription;
  const githubId = metadata.githubId;
  const priceId = subscription.items.data[0].price.id;

  if (!githubId) {
    console.error('No GitHub ID in subscription metadata');
    return;
  }

  const accessLevel = getAccessLevel(priceId);

  if (accessLevel) {
    await grantGitHubAccess(githubId, accessLevel);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Handle subscription changes (upgrade/downgrade)
  const { metadata } = subscription;
  const githubId = metadata.githubId;
  const priceId = subscription.items.data[0].price.id;

  if (!githubId) return;

  const accessLevel = getAccessLevel(priceId);

  if (accessLevel) {
    await grantGitHubAccess(githubId, accessLevel);
  } else {
    await revokeGitHubAccess(githubId);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { metadata } = subscription;
  const githubId = metadata.githubId;

  if (!githubId) return;

  await revokeGitHubAccess(githubId);
}

function getAccessLevel(priceId: string): string | null {
  switch (priceId) {
    case 'price_early_bird_lifetime':
      return 'lifetime';
    case 'price_yearly_subscription':
      return 'yearly';
    case 'price_monthly_subscription':
      return 'monthly';
    default:
      return null;
  }
}

async function grantGitHubAccess(githubId: string, accessLevel: string) {
  try {
    // Add user to GitHub team
    await octokit.teams.addOrUpdateMembershipForUserInOrg({
      org: process.env.GITHUB_ORG!,
      team_slug: process.env.GITHUB_TEAM_ID!,
      username: githubId,
      role: 'member',
    });

    // Update Firebase custom claims
    await updateUserClaims(githubId, {
      subscriptionTier: accessLevel,
      githubAccess: true,
      accessGrantedAt: Date.now(),
    });

    console.log(`Granted ${accessLevel} access to GitHub user: ${githubId}`);
  } catch (error) {
    console.error('Failed to grant GitHub access:', error);
  }
}

async function revokeGitHubAccess(githubId: string) {
  try {
    // Remove user from GitHub team
    await octokit.teams.removeMembershipForUserInOrg({
      org: process.env.GITHUB_ORG!,
      team_slug: process.env.GITHUB_TEAM_ID!,
      username: githubId,
    });

    // Update Firebase custom claims
    await updateUserClaims(githubId, {
      subscriptionTier: 'free',
      githubAccess: false,
      accessRevokedAt: Date.now(),
    });

    console.log(`Revoked GitHub access for user: ${githubId}`);
  } catch (error) {
    console.error('Failed to revoke GitHub access:', error);
  }
}

async function updateUserClaims(githubId: string, claims: any) {
  // Find user by GitHub ID and update custom claims
  // Implementation depends on your user lookup strategy
}
```

## 4. Usage in Your Demo App

### Pricing Page Component

```typescript
// apps/demo/src/pages/PricingPage.tsx
import { StripePurchase, StripeSubscription } from '@donotdev/billing';

export function PricingPage() {
  return (
    <div className="pricing-grid">
      <div className="pricing-card">
        <h3>Early Bird Lifetime</h3>
        <p className="price">$299</p>
        <p>One-time payment, lifetime access</p>
        <StripePurchase
          priceId="price_early_bird_lifetime"
          successUrl="/purchase/success?tier=lifetime"
          cancelUrl="/pricing"
        >
          Get Lifetime Access
        </StripePurchase>
      </div>

      <div className="pricing-card">
        <h3>Yearly Subscription</h3>
        <p className="price">$99/year</p>
        <p>Full access for one year</p>
        <StripeSubscription
          priceId="price_yearly_subscription"
          successUrl="/billing/success?tier=yearly"
          cancelUrl="/pricing"
        >
          Subscribe Yearly
        </StripeSubscription>
      </div>

      <div className="pricing-card">
        <h3>Monthly Subscription</h3>
        <p className="price">$19/month</p>
        <p>Full access monthly</p>
        <StripeSubscription
          priceId="price_monthly_subscription"
          successUrl="/billing/success?tier=monthly"
          cancelUrl="/pricing"
        >
          Subscribe Monthly
        </StripeSubscription>
      </div>
    </div>
  );
}
```

## 5. Metadata Flow

### What Gets Sent to Stripe

```typescript
// Automatically included in checkout session
{
  type: 'purchase' | 'subscription',
  githubId: 'github_username',        // From Firebase Auth
  authProvider: 'github.com',         // From Firebase Auth
  userId: 'firebase_uid',             // From Firebase Auth
  // ... any custom metadata you pass
}
```

### What Stripe Sends Back

```typescript
// In webhook payload
{
  id: 'cs_...',
  metadata: {
    type: 'purchase',
    githubId: 'github_username',
    authProvider: 'github.com',
    userId: 'firebase_uid',
    priceId: 'price_early_bird_lifetime'
  },
  // ... other Stripe data
}
```

## 6. Testing

### Test Webhook Locally

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:5001/your-project/europe-west1/stripeWebhook

# Test webhook
stripe trigger checkout.session.completed
```

### Test with Test Data

```typescript
// Test with GitHub test user
const testMetadata = {
  githubId: 'test-github-user',
  type: 'purchase',
  priceId: 'price_early_bird_lifetime',
};
```

## 7. Production Checklist

- [ ] Stripe products and prices created
- [ ] Webhook endpoint configured
- [ ] GitHub token with team management permissions
- [ ] Firebase Functions deployed
- [ ] Environment variables set
- [ ] Test webhook processing
- [ ] Verify GitHub team access works
- [ ] Test subscription lifecycle (create/update/cancel)

This setup ensures that when someone purchases your framework, they automatically get GitHub access to your private repository based on their subscription tier!
