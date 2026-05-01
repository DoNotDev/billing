'use client';
// packages/features/billing/src/components/SecurityNotice.tsx

/**
 * @fileoverview Security Notice Component
 * @description Displays security information about payment processing with dismissible functionality
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { Shield, Lock, CreditCard, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Card, Button, BUTTON_VARIANT, Stack } from '@donotdev/components';
import { useTranslation } from '@donotdev/core';

/** Props for the SecurityNotice component. */
export interface SecurityNoticeProps {
  /** Whether the notice can be dismissed */
  dismissible?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Whether to show the notice (controlled by parent) */
  show?: boolean;
  /** Callback when notice is dismissed */
  onDismiss?: () => void;
}

/**
 * SecurityNotice - Payment Security Information Component
 *
 * Displays security information about payment processing with:
 * - Stripe security branding
 * - Dismissible functionality with localStorage persistence
 * - i18n support for billing namespace
 * Security icons and information
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 * @example
 * ```tsx
 * <SecurityNotice
 * dismissible={true}
 * onDismiss={() => console.log('Notice dismissed')}
 * />
 * ```
 */
export function SecurityNotice({
  dismissible = true,
  className = '',
  show = true,
  onDismiss,
}: SecurityNoticeProps) {
  const { t } = useTranslation('billing');
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for dismissal state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const dismissed = localStorage.getItem(
          'billing-security-notice-dismissed'
        );
        if (dismissed === 'true') {
          setIsDismissed(true);
        }
      } catch {
        // localStorage may be unavailable (private browsing, storage quota, etc.)
      }
    }
  }, []);

  // Handle dismissal
  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('billing-security-notice-dismissed', 'true');
      } catch {
        // localStorage may be unavailable (private browsing, storage quota, etc.)
      }
    }
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't render if dismissed or not visible (use prop directly for reactivity)
  if (!show || isDismissed) {
    return null;
  }

  return (
    <Card
      className={className}
      style={{
        border: '1px solid var(--primary)',
        backgroundColor: 'var(--primary)',
        opacity: 'var(--opacity-subtle)',
      }}
    >
      <div style={{ padding: 'var(--gap-md)' }}>
        <Stack direction="row" align="start" justify="between">
          <Stack direction="row" align="start" gap="tight">
            <div className="dndev-flex-shrink-0">
              <Shield
                className="dndev-size-md"
                style={{ color: 'var(--primary)' }}
              />
            </div>
            <div className="dndev-flex-1">
              <h3
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                }}
              >
                {t('security.title', 'Secure Payment Processing')}
              </h3>
              <div
                style={{
                  marginTop: 'var(--gap-md)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--muted-foreground)',
                }}
              >
                <p style={{ marginBottom: 'var(--gap-md)' }}>
                  {t(
                    'security.description',
                    'Your payment information is processed securely by Stripe, a PCI DSS Level 1 certified payment processor.'
                  )}
                </p>
                <Stack
                  direction="row"
                  align="center"
                  gap="tight"
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  <Stack direction="row" align="center" gap="tight">
                    <Lock className="dndev-size-md" />
                    <span>
                      {t('security.encrypted', '256-bit SSL encryption')}
                    </span>
                  </Stack>
                  <Stack direction="row" align="center" gap="tight">
                    <CreditCard className="dndev-size-md" />
                    <span>{t('security.stripe', 'Powered by Stripe')}</span>
                  </Stack>
                </Stack>
              </div>
            </div>
          </Stack>
          {dismissible && (
            <Button
              variant={BUTTON_VARIANT.GHOST}
              onClick={handleDismiss}
              className="dndev-flex-shrink-0 dndev-size-touch"
              aria-label={t('security.dismiss', 'Dismiss security notice')}
            >
              <X className="dndev-size-md" />
            </Button>
          )}
        </Stack>
      </div>
    </Card>
  );
}

/**
 * Hook to manage security notice dismissal state
 *
 * @returns Object with dismissal state and methods
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export function useSecurityNotice() {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const dismissed = localStorage.getItem(
          'billing-security-notice-dismissed'
        );
        setIsDismissed(dismissed === 'true');
      } catch {
        // localStorage may be unavailable (private browsing, storage quota, etc.)
      }
    }
  }, []);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('billing-security-notice-dismissed', 'true');
      } catch {
        // localStorage may be unavailable (private browsing, storage quota, etc.)
      }
    }
    setIsDismissed(true);
  };

  const reset = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('billing-security-notice-dismissed');
      } catch {
        // localStorage may be unavailable (private browsing, storage quota, etc.)
      }
    }
    setIsDismissed(false);
  };

  return {
    isDismissed,
    dismiss,
    reset,
  };
}
