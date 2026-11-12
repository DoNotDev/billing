'use client';
// packages/features/billing/src/components/SubscriptionManager.tsx

/**
 * @fileoverview Subscription Manager Component
 * @description Complete subscription management UI for user profile
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { AlertCircle, CreditCard, AlertTriangle } from 'lucide-react';
import React, { useState, lazy, Suspense, type ComponentType } from 'react';

import type { FeatureGuardProps } from '@donotdev/auth';
import {
  Card,
  Button,
  BUTTON_VARIANT,
  Badge,
  BADGE_VARIANT,
  Stack,
} from '@donotdev/components';
import { SUBSCRIPTION_STATUS, useTranslation } from '@donotdev/core';

import { useBillingAuth } from '../useBillingAuth';
import { useStripeBilling } from '../useStripeBilling';

// Lazy load @donotdev/auth - package is optional

type GuardComponent = ComponentType<FeatureGuardProps>;
const NullComponent: GuardComponent = () => null;

const FeatureGuard = lazy<GuardComponent>(async () => {
  try {
    const module = await import('@donotdev/auth');
    return { default: module.FeatureGuard };
  } catch {
    return { default: NullComponent };
  }
});

interface FallbackComponentProps {
  className?: string;
  isSignedIn: boolean;
  signInRequiredText: string;
  noSubscriptionText: string;
}

function SubscriptionFallback({
  className,
  isSignedIn,
  signInRequiredText,
  noSubscriptionText,
}: FallbackComponentProps) {
  return (
    <Card className={className}>
      <p style={{ color: 'var(--muted-foreground)' }}>
        {!isSignedIn ? signInRequiredText : noSubscriptionText}
      </p>
    </Card>
  );
}

/** Props for the SubscriptionManager component. */
export interface SubscriptionManagerProps {
  /** Available plans for upgrade/downgrade */
  availablePlans?: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    priceId: string;
    billingConfigKey: string;
  }>;
  /** Show plan change UI */
  allowPlanChange?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when subscription is cancelled successfully */
  onCancelSuccess?: (endsAt: string) => void;
  /** Callback when plan is changed successfully */
  onPlanChangeSuccess?: () => void;
}

/**
 * Subscription manager component for user profile
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function SubscriptionManager({
  availablePlans = [],
  allowPlanChange = false,
  className = '',
  onCancelSuccess,
  onPlanChangeSuccess,
}: SubscriptionManagerProps) {
  const { t } = useTranslation('billing');
  const authState = useBillingAuth();
  const user = authState.user;
  const cancelSubscription = useStripeBilling('cancelSubscription', authState);
  const changePlan = useStripeBilling('changePlan', authState);
  const openCustomerPortal = useStripeBilling('openCustomerPortal', authState);
  const status = useStripeBilling('status', authState);
  const loading = status === 'initializing';
  const error = useStripeBilling('error', authState);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const subscription = user?.customClaims?.subscription;

  const handleCancel = async () => {
    setIsSubmitting(true);
    try {
      const result = await cancelSubscription();
      setShowCancelConfirm(false);
      const endDate = new Date(result.endsAt).toLocaleDateString();
      onCancelSuccess?.(endDate);
    } catch (err) {
      // Error is already handled by the hook's error state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePlan = async (priceId: string, configKey: string) => {
    setIsSubmitting(true);
    try {
      await changePlan(priceId, configKey);
      onPlanChangeSuccess?.();
    } catch (err) {
      // Error is already handled by the hook's error state
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (statusValue: string) => {
    switch (statusValue) {
      case SUBSCRIPTION_STATUS.ACTIVE:
        return (
          <Badge>{t('components.subscriptionManager.status.active')}</Badge>
        );
      case SUBSCRIPTION_STATUS.CANCELED:
        return (
          <Badge variant={BADGE_VARIANT.DESTRUCTIVE}>
            {t('components.subscriptionManager.status.cancelled')}
          </Badge>
        );
      case SUBSCRIPTION_STATUS.PAST_DUE:
        return (
          <Badge variant={BADGE_VARIANT.DESTRUCTIVE}>
            {t('components.subscriptionManager.status.pastDue')}
          </Badge>
        );
      case SUBSCRIPTION_STATUS.TRIALING:
        return (
          <Badge variant={BADGE_VARIANT.SECONDARY}>
            {t('components.subscriptionManager.status.trialing')}
          </Badge>
        );
      default:
        return <Badge variant={BADGE_VARIANT.OUTLINE}>{statusValue}</Badge>;
    }
  };

  const signInRequiredText = t('components.subscriptionManager.signInRequired');
  const noSubscriptionText = t('components.subscriptionManager.noSubscription');
  const isSignedIn = !!user;

  const fallbackProps = {
    className,
    isSignedIn,
    signInRequiredText,
    noSubscriptionText,
  };

  return (
    <Suspense fallback={<SubscriptionFallback {...fallbackProps} />}>
      {}
      <FeatureGuard
        subscription
        fallback={() => <SubscriptionFallback {...fallbackProps} />}
      >
        <Card
          className={className}
          title={t('components.subscriptionManager.title')}
        >
          <Stack>
            {/* Current Plan */}
            <div>
              <h3
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  marginBottom: 'var(--gap-md)',
                }}
              >
                {t('components.subscriptionManager.currentPlan')}
              </h3>
              <Stack
                direction="row"
                align="center"
                justify="between"
                style={{
                  padding: 'var(--gap-md)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div>
                  <p style={{ fontWeight: 600 }}>{subscription?.tier}</p>
                  <p
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {subscription?.status &&
                      getStatusBadge(subscription.status)}
                  </p>
                </div>
                {subscription?.cancelAtPeriodEnd && (
                  <Stack
                    direction="row"
                    align="center"
                    style={{ color: 'var(--warning)' }}
                  >
                    <AlertTriangle
                      className="dndev-size-md"
                      style={{ marginInlineEnd: 'var(--gap-md)' }}
                    />
                    <span style={{ fontSize: 'var(--font-size-sm)' }}>
                      {t('components.subscriptionManager.ends')}{' '}
                      {subscription?.subscriptionEnd
                        ? new Date(
                            subscription.subscriptionEnd
                          ).toLocaleDateString()
                        : ''}
                    </span>
                  </Stack>
                )}
              </Stack>
            </div>

            {/* Actions */}
            <Stack gap="large">
              <Button
                variant={BUTTON_VARIANT.OUTLINE}
                className="dndev-w-full"
                onClick={() => openCustomerPortal()}
                disabled={loading || isSubmitting}
                icon={CreditCard}
              >
                {t('components.subscriptionManager.managePaymentMethod')}
              </Button>

              {!subscription?.cancelAtPeriodEnd && (
                <Button
                  variant={BUTTON_VARIANT.DESTRUCTIVE}
                  className="dndev-w-full"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={loading || isSubmitting}
                  icon={AlertCircle}
                >
                  {t('components.subscriptionManager.cancelSubscription')}
                </Button>
              )}
            </Stack>

            {/* Cancel Confirmation */}
            {showCancelConfirm && (
              <div
                className="dndev-surface"
                data-variant="default"
                style={{
                  padding: 'var(--gap-md)',
                  border: '1px solid var(--warning)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--muted)',
                }}
              >
                <p
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--gap-md)',
                  }}
                >
                  {t('components.subscriptionManager.cancelConfirm', {
                    date: subscription?.subscriptionEnd
                      ? new Date(
                          subscription.subscriptionEnd
                        ).toLocaleDateString()
                      : '',
                  })}
                </p>
                <Stack direction="row" gap="tight">
                  <Button
                    variant={BUTTON_VARIANT.DESTRUCTIVE}
                    onClick={handleCancel}
                    disabled={loading || isSubmitting}
                  >
                    {t('components.subscriptionManager.yesCancel')}
                  </Button>
                  <Button
                    variant={BUTTON_VARIANT.OUTLINE}
                    onClick={() => setShowCancelConfirm(false)}
                  >
                    {t('components.subscriptionManager.noKeep')}
                  </Button>
                </Stack>
              </div>
            )}

            {/* Plan Change Options */}
            {allowPlanChange && availablePlans.length > 0 && (
              <div>
                <h3
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500,
                    marginBottom: 'var(--gap-md)',
                  }}
                >
                  {t('components.subscriptionManager.changePlan')}
                </h3>
                <Stack gap="tight">
                  {availablePlans.map((plan) => (
                    <button
                      key={plan.id}
                      className="dndev-w-full"
                      style={{
                        padding: 'var(--gap-md)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        textAlign: 'start',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() =>
                        handleChangePlan(plan.priceId, plan.billingConfigKey)
                      }
                      disabled={
                        loading ||
                        isSubmitting ||
                        subscription?.tier === plan.id
                      }
                    >
                      <Stack direction="row" justify="between" align="center">
                        <div>
                          <p style={{ fontWeight: 500 }}>{plan.name}</p>
                          <p
                            style={{
                              fontSize: 'var(--font-size-sm)',
                              color: 'var(--muted-foreground)',
                            }}
                          >
                            {plan.currency === 'EUR' ? '\u20ac' : '$'}
                            {plan.price}/month
                          </p>
                        </div>
                        {subscription?.tier === plan.id && (
                          <Badge variant={BADGE_VARIANT.SECONDARY}>
                            {t('components.subscriptionManager.current')}
                          </Badge>
                        )}
                      </Stack>
                    </button>
                  ))}
                </Stack>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div
                className="dndev-surface"
                data-variant="destructive"
                style={{
                  padding: 'var(--gap-md)',
                  backgroundColor: 'var(--muted)',
                  border: '1px solid var(--destructive)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <p
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--destructive-foreground)',
                  }}
                >
                  {error}
                </p>
              </div>
            )}
          </Stack>
        </Card>
      </FeatureGuard>
    </Suspense>
  );
}
