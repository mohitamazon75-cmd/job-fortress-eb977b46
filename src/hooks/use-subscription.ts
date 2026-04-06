import { useState, useEffect } from 'react';

export type SubscriptionTier = 'free' | 'pro' | 'pro_monthly';

interface SubscriptionState {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  loading: boolean;
}

/**
 * Hook to fetch the current user's subscription tier.
 * TEMPORARILY: Returns all users as Pro for testing purposes.
 */
export function useSubscription(): SubscriptionState {
  const [state] = useState<SubscriptionState>({
    tier: 'pro',
    isActive: true,
    expiresAt: null,
    loading: false,
  });

  return state;
}

/** Check if a feature requires Pro tier — DISABLED for testing */
export const PRO_FEATURES = new Set<string>([]);

export function requiresPro(_featureId: string): boolean {
  return false;
}
