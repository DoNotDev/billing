'use client';
// packages/features/billing/src/useStripeBilling.ts

/**
 * @fileoverview useStripeBilling Hook - Single entry point for all Stripe billing operations
 * @description React hook for accessing billing state and methods. Provides property-based access
 * to checkout, subscription management, and billing state. Matches useAuth pattern for consistency.
 *
 * **Automatic Overlay System:**
 * For redirect operations (checkout, portal), the hook automatically shows a fullscreen blocking
 * overlay with operation-specific i18n messaging. Zero consumer configuration required.
 *
 * **Architecture (matches useAuth pattern):**
 * - useStripeBilling (React entry point) ← THIS FILE
 * - Single entry point for all billing operations (checkout + subscription management)
 * - Local state for loading/error (no store needed)
 * - Callable provider for Stripe integration (configureProviders({ callable: adapter }))
 *
 * **Usage:**
 * ```typescript
 * // Get auth state first (required)
 * const user = useAuth('user');
 * const status = useAuth('status');
 * const authState = { user, status };
 *
 * // Methods - framework handles overlay automatically for redirects
 * const checkout = useStripeBilling('checkout', authState);
 * await checkout({ priceId: 'price_123', mode: 'subscription' });
 * // → Shows "Redirecting to Stripe" / "Initializing secure payment..."
 *
 * const openCustomerPortal = useStripeBilling('openCustomerPortal', authState);
 * await openCustomerPortal();
 * // → Shows "Redirecting to Stripe" / "Opening billing portal..."
 *
 * // Optional: Loading state for custom button disabling
 * const loading = useStripeBilling('loading', authState);
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { useState, useCallback, useRef } from 'react';

import type {
  AuthUser,
  BillingAPI,
  CheckoutOptions,
  StripeCheckoutRequest,
  StripeCheckoutResponse,
  FeatureStatus,
} from '@donotdev/core';
import {
  DEGRADED_BILLING_API,
  FEATURE_STATUS,
  isClient,
  isDev,
  handleError,
  getProvider,
  FRAMEWORK_FEATURES,
  redirectToExternalUrlWithErrorHandling,
  useFeatureConsent,
  useOverlay,
  useTranslation,
} from '@donotdev/core';

// checkoutErrorNotified moved to useRef inside the hook (was module-scoped, shared across instances)

/**
 * Get a callable function invoker from the provider registry.
 * Consumer must configure via configureProviders({ callable: adapter }).
 */
function getCallable<TReq, TRes>(functionName: string) {
  const callable = getProvider('callable');
  return {
    callable: async (data: TReq) => ({
      data: await callable.call<TReq, TRes>(functionName, data),
    }),
  };
}

/**
 * Auth state passed from parent component.
 * Required for billing to work - removes race condition from dynamic import.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface BillingAuthState {
  user: AuthUser | null;
  status: FeatureStatus;
}

/**
 * React hook for Stripe billing with property-based access
 *
 * Single entry point for all Stripe billing operations (checkout and subscription management).
 * Uses local state for loading/error (no store needed). Lazy loads Firebase SDK only when methods are called.
 *
 * **IMPORTANT:** Auth state must be passed from parent component to avoid race conditions.
 * The hook returns `isAvailable: false` until auth status is `ready`.
 *
 * **Property-based access (matches useAuth pattern):**
 * ```typescript
 * // ✅ First, get auth state from useAuth
 * const user = useAuth('user');
 * const status = useAuth('status'); // 'initializing' | 'ready' | 'degraded' | 'error'
 * const authState = { user, status };
 *
 * // ✅ State (reactive, re-renders on change)
 * const billingStatus = useStripeBilling('status', authState);
 * const error = useStripeBilling('error', authState);
 * const isAvailable = useStripeBilling('isAvailable', authState);
 *
 * // ✅ Checkout (stable, never re-renders)
 * const checkout = useStripeBilling('checkout', authState);
 * await checkout({ priceId: 'price_123', mode: 'subscription' });
 *
 * // ✅ Subscription management (stable, never re-renders)
 * const cancelSubscription = useStripeBilling('cancelSubscription', authState);
 * const changePlan = useStripeBilling('changePlan', authState);
 * const refreshStatus = useStripeBilling('refreshStatus', authState);
 * const openCustomerPortal = useStripeBilling('openCustomerPortal', authState);
 * ```
 *
 * **How it works:**
 * - Auth state must be passed as second param (reactive to auth changes)
 * - State properties (loading, error) → Local useState (reactive)
 * - Methods (checkout, cancelSubscription, changePlan, etc.) → useCallback (stable)
 * - Firebase SDK → Lazy loaded only when methods are called (improves initial load performance)
 *
 * @template K - The property key from BillingAPI
 * @param key - Property name to access (loading, error, checkout, cancelSubscription, changePlan, refreshStatus, openCustomerPortal, clearError, isAvailable)
 * @param authState - Auth state from useAuth hook (user, status)
 * @returns The value of the specified property
 *
 * @example
 * ```typescript
 * // Get auth state first (required)
 * const user = useAuth('user');
 * const status = useAuth('status');
 * const authState = { user, status };
 *
 * // Check if billing is available before showing UI
 * const isAvailable = useStripeBilling('isAvailable', authState);
 * if (!isAvailable) return null; // Wait for auth
 *
 * // Get billing status (re-renders when status changes)
 * const billingStatus = useStripeBilling('status', authState);
 * if (billingStatus === 'initializing') return <Spinner />;
 *
 * // Get checkout method (stable, never re-renders)
 * const checkout = useStripeBilling('checkout', authState);
 * await checkout({ priceId: 'price_123', mode: 'subscription' });
 * ```
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useStripeBilling<K extends keyof BillingAPI>(
  key: K,
  authState?: BillingAuthState
): BillingAPI[K] {
  // Extract auth state from params (or use degraded defaults)
  const user = authState?.user ?? null;
  const authStatus = authState?.status ?? FEATURE_STATUS.DEGRADED;
  const authReady = authStatus === FEATURE_STATUS.READY;

  const canProceed = useFeatureConsent(FRAMEWORK_FEATURES.BILLING);
  const { t } = useTranslation('billing');

  // ✅ ALL HOOKS MUST BE CALLED UNCONDITIONALLY (Rules of Hooks)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showRedirectOverlay = useOverlay('showRedirectOverlay');
  const hideRedirectOverlay = useOverlay('hideRedirectOverlay');
  const checkoutErrorNotifiedRef = useRef(false);

  // ==========================================================================
  // Service Methods (Async - Billing operations)
  // ✅ ALL useCallback hooks MUST be called unconditionally (Rules of Hooks)
  // ==========================================================================

  const checkout = useCallback(
    async (options: CheckoutOptions): Promise<StripeCheckoutResponse> => {
      if (!isClient() || !canProceed) {
        throw new Error(t('errors.not_available'));
      }

      if (!user) {
        const error = handleError(new Error('User must be authenticated'), {
          userMessage: t('errors.unauthenticated'),
          severity: 'warning',
        });
        setError(error.message);
        throw error;
      }

      setLoading(true);
      setError(null);

      showRedirectOverlay('stripe-checkout');

      try {
        const { callable: createCheckoutSession } = await getCallable<
          StripeCheckoutRequest,
          StripeCheckoutResponse
        >('createCheckoutSession');

        // Extract GitHub provider data from authenticated session
        const githubProvider = user.providerData?.find(
          (p: { providerId: string }) => p.providerId === 'github.com'
        );
        // displayName is the GitHub display name (not the login/username)
        const githubDisplayName = githubProvider?.displayName;
        const githubUid = githubProvider?.uid;

        // C1 fix: userId removed from client payload — server must use context.uid
        const request: StripeCheckoutRequest = {
          priceId: options.priceId,
          unitAmount: options.unitAmount,
          productName: options.productName,
          currency: options.currency,
          userEmail: user.email || '',
          customerEmail: user.email || '',
          metadata: {
            ...(githubDisplayName && { githubDisplayName }), // Only add if GitHub is linked
            ...(githubUid && { githubUid }), // GitHub user ID for extra verification
            ...options.metadata,
          },
          successUrl:
            options.successUrl ||
            `${typeof window !== 'undefined' ? window.location.origin : ''}/billing/success`,
          cancelUrl:
            options.cancelUrl ||
            (typeof window !== 'undefined' ? window.location.href : ''),
          allowPromotionCodes: options.allowPromotionCodes ?? true,
          mode: options.mode,
        };

        if (isDev()) {
          console.log('[useStripeBilling] calling createCheckoutSession', {
            priceId: request.priceId,
            mode: request.mode,
          });
        }

        const result = await createCheckoutSession(request);

        const {
          sessionId,
          sessionUrl,
          success,
          error: serverError,
        } = result.data;

        if (success === false) {
          hideRedirectOverlay();
          const errorMsg = serverError || t('errors.server_error');
          setError(errorMsg);
          throw new Error(errorMsg);
        }

        if (!sessionUrl) {
          throw new Error(t('errors.no_checkout_url'));
        }

        // Reset error notification flag on success
        checkoutErrorNotifiedRef.current = false;

        // Don't hide overlay on success - redirect will happen and overlay stays visible
        return {
          sessionId,
          sessionUrl,
          success: true,
          error: undefined,
        };
      } catch (err) {
        // Hide overlay on error
        hideRedirectOverlay();

        // Only show error notification once per session
        if (!checkoutErrorNotifiedRef.current) {
          const error = handleError(err, {
            userMessage: t('errors.checkout_failed'),
            context: { priceId: options.priceId, mode: options.mode },
            severity: 'error',
          });
          setError(error.message);
          checkoutErrorNotifiedRef.current = true;
          throw error;
        } else {
          // Already notified, just set error state and throw
          const error =
            err instanceof Error ? err : new Error(t('errors.checkout_failed'));
          setError(error.message);
          throw error;
        }
      } finally {
        setLoading(false);
      }
    },
    [user, canProceed, showRedirectOverlay, hideRedirectOverlay]
  );

  const cancelSubscription = useCallback(async () => {
    if (!user) throw new Error(t('errors.unauthenticated'));

    setLoading(true);
    setError(null);

    try {
      const { callable: cancel } = await getCallable<
        Record<string, never>,
        { success: boolean; endsAt: string }
      >('cancelSubscription');

      const result = await cancel({} as Record<string, never>);
      return result.data;
    } catch (err) {
      const error = handleError(err, {
        userMessage: t('errors.cancel_failed'),
        context: { operation: 'cancelSubscription', userId: user.id },
        severity: 'error',
      });
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const changePlan = useCallback(
    async (newPriceId: string, billingConfigKey: string) => {
      if (!user) throw new Error(t('errors.unauthenticated'));

      setLoading(true);
      setError(null);

      try {
        const { callable: change } = await getCallable<
          { newPriceId: string; billingConfigKey: string },
          { success: boolean }
        >('changePlan');

        const result = await change({
          newPriceId,
          billingConfigKey,
        });
        return result.data;
      } catch (err) {
        const error = handleError(err, {
          userMessage: t('errors.change_plan_failed'),
          context: {
            operation: 'changePlan',
            userId: user.id,
            newPriceId,
            billingConfigKey,
          },
          severity: 'error',
        });
        setError(error.message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const refreshStatus = useCallback(async () => {
    if (!user) throw new Error(t('errors.unauthenticated'));

    setLoading(true);
    setError(null);

    try {
      const { callable: refresh } = await getCallable<
        Record<string, never>,
        void
      >('refreshSubscriptionStatus');

      await refresh({} as Record<string, never>);
    } catch (err) {
      const error = handleError(err, {
        userMessage: t('errors.refresh_failed'),
        context: { operation: 'refreshStatus', userId: user.id },
        severity: 'error',
      });
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const openCustomerPortal = useCallback(
    async (returnUrl?: string) => {
      if (!user) throw new Error(t('errors.unauthenticated'));

      setLoading(true);
      setError(null);

      showRedirectOverlay('stripe-portal');

      try {
        const { callable: portal } = await getCallable<
          { returnUrl?: string },
          { url: string }
        >('createCustomerPortal');

        const result = await portal({
          returnUrl:
            returnUrl ||
            (typeof window !== 'undefined' ? window.location.href : ''),
        });

        // Don't hide overlay on success - redirect will happen and overlay stays visible
        await redirectToExternalUrlWithErrorHandling(
          result.data.url,
          {},
          'Failed to redirect to customer portal'
        );
      } catch (err) {
        // Hide overlay on error
        hideRedirectOverlay();

        const error = handleError(err, {
          userMessage: t('errors.portal_failed'),
          context: { operation: 'openCustomerPortal', userId: user.id },
          severity: 'error',
        });
        setError(error.message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user, showRedirectOverlay, hideRedirectOverlay]
  );

  const clearError = useCallback(() => {
    setError(null);
    checkoutErrorNotifiedRef.current = false; // Reset notification flag
  }, []);

  const methods = {
    checkout,
    cancelSubscription,
    changePlan,
    refreshStatus,
    openCustomerPortal,
    clearError,
  };

  // ==========================================================================
  // NOW conditionally return values (hooks already called above)
  // ==========================================================================

  // Graceful degradation: SSR or no consent/feature enabled → return degraded API
  if (!isClient() || !canProceed) {
    return DEGRADED_BILLING_API[key];
  }

  // Compute status based on current state
  const computedStatus = !authReady
    ? FEATURE_STATUS.INITIALIZING
    : FEATURE_STATUS.READY;

  // Return unified status
  if (key === 'status') {
    return computedStatus as BillingAPI[K];
  }

  // Return isAvailable (true only when auth is ready AND billing feature enabled)
  // This prevents UI from enabling checkout before auth state is resolved
  if (key === 'isAvailable') {
    return !!authReady as BillingAPI[K];
  }

  if (key === 'error') {
    return error as BillingAPI[K];
  }

  // Return loading state (exposed for consumers who want to know if any operation is in progress)
  if (key === 'loading') {
    return loading as BillingAPI[K];
  }

  // Return method
  if (key in methods) {
    return methods[key as keyof typeof methods] as BillingAPI[K];
  }

  // Fallback (should never happen with proper types)
  return DEGRADED_BILLING_API[key];
}
