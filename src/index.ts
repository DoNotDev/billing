// packages/features/billing/src/index.ts

/**
 * @fileoverview Billing package
 * @description Stripe billing and subscription package for DoNotDev framework. Provides Stripe integration, subscription management, and billing components.
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// Core Billing Hooks
export { useStripeBilling, type BillingAuthState } from './useStripeBilling';
export { useBillingAuth } from './useBillingAuth';

// Public "Lego Block" Components
export {
  ProductCard,
  SecurityNotice,
  StripeCheckoutButton,
  SubscriptionManager,
} from './components';

// Public Types - Note: BillingConfig and SubscriptionPlan are app-specific
// Use StripeBackConfig from @donotdev/core/types for billing configuration
// Use Subscription interface from @donotdev/core/types for subscription data

// Component Prop Types
export type {
  ProductCardProps,
  SecurityNoticeProps,
  StripeCheckoutButtonProps,
  SubscriptionManagerProps,
} from './components';

// Note: Internal components (PurchaseButton, SubscriptionButton) and
// utility hooks (useSecurityNotice) are intentionally not re-exported.
