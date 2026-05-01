// packages/features/billing/src/useBillingAuth.ts

/**
 * @fileoverview Safe auth state hook for billing components
 * @description Provides BillingAuthState internally so billing components
 * don't need consumers to wire up auth manually. Uses the same sync import
 * pattern as @donotdev/ui's useAuthSafe — see that file for rationale.
 *
 * ## CRITICAL: DO NOT USE DYNAMIC IMPORTS
 *
 * This file MUST use sync `import * as authModule from '@donotdev/auth'`
 * at module level. See packages/ui/src/utils/useAuthSafe.ts for full explanation.
 *
 * @version 0.1.0
 * @since 0.0.7
 * @author AMBROISE PARK Consulting
 */

import * as authModule from '@donotdev/auth';
import { FEATURE_STATUS } from '@donotdev/core';

import type { BillingAuthState } from './useStripeBilling';

// Sync import — bundler aliases to empty module if not installed.
// Decision made ONCE at module load time, never changes.
const realUseAuth = authModule?.useAuth as
  | (<K extends keyof import('@donotdev/core').AuthAPI>(
      key: K
    ) => import('@donotdev/core').AuthAPI[K])
  | undefined;

/**
 * Returns a BillingAuthState object by reading auth state internally.
 *
 * - If @donotdev/auth installed -> uses real useAuth hook
 * - If not installed -> returns degraded state (null user, 'degraded' status)
 *
 * This removes the need for consumers to pass authState to every billing component.
 *
 * @returns BillingAuthState with user and status
 *
 * @example
 * ```typescript
 * // Inside a billing component:
 * const authState = useBillingAuth();
 * const checkout = useStripeBilling('checkout', authState);
 * ```
 *
 * @version 0.1.0
 * @since 0.0.7
 * @author AMBROISE PARK Consulting
 */
export function useBillingAuth(): BillingAuthState {
  if (realUseAuth) {
    return {
      user: realUseAuth('user'),
      status: realUseAuth('status'),
    };
  }
  return {
    user: null,
    status: FEATURE_STATUS.DEGRADED,
  };
}
