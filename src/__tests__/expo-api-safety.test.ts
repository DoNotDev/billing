/**
 * @fileoverview Expo API Safety Net — Billing Package
 * @description Verifies that all @donotdev/billing APIs consumed by @donotdev/expo exist.
 * If any test fails after a framework change, the expo package WILL break.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { describe, it, expect, vi } from 'vitest';

const createMockStore = () => {
  const state: Record<string, any> = {};
  const store: any = (selector?: any) => (selector ? selector(state) : state);
  store.getState = () => state;
  store.setState = (partial: any) =>
    Object.assign(
      state,
      typeof partial === 'function' ? partial(state) : partial
    );
  store.subscribe = vi.fn(() => vi.fn());
  store.destroy = vi.fn();
  return store;
};

vi.mock('@donotdev/core', () => ({
  FEATURE_STATUS: {
    INITIALIZING: 'initializing',
    READY: 'ready',
    DEGRADED: 'degraded',
    ERROR: 'error',
  },
  FRAMEWORK_FEATURES: { BILLING: 'billing' },
  SUBSCRIPTION_STATUS: {},
  handleError: vi.fn(),
  isClient: () => false,
  isDev: () => false,
  useFeatureConsent: () => true,
  useTranslation: () => ({ t: (k: string) => k }),
  createDoNotDevStore: vi.fn(() => createMockStore()),
  createSingleton: vi.fn((factory: any) => factory),
  getDndevConfig: () => ({}),
  getStorageManager: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  })),
}));

vi.mock('@donotdev/auth', () => ({
  useAuth: vi.fn(() => null),
}));

import * as mod from '@donotdev/billing';

describe('Expo API Safety Net — @donotdev/billing', () => {
  it('exports useStripeBilling hook', () => {
    expect(mod.useStripeBilling).toBeDefined();
    expect(typeof mod.useStripeBilling).toBe('function');
  });
});
