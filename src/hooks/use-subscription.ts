import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionTier = 'free' | 'pro' | 'pro_monthly';

interface SubscriptionState {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  loading: boolean;
}

/**
 * Hook to fetch the current user's subscription tier from profiles.
 * Returns { tier, isActive, expiresAt, loading }.
 */
export function useSubscription(): SubscriptionState {
  const readTestUnlock = (): SubscriptionState | null => {
    try {
      if (sessionStorage.getItem('jb_test_pro_unlock') !== '1') return null;

      const storedTier = sessionStorage.getItem('jb_test_pro_tier');
      const tier: SubscriptionTier = storedTier === 'pro_monthly' ? 'pro_monthly' : 'pro';

      return {
        tier,
        isActive: true,
        expiresAt: null,
        loading: false,
      };
    } catch {
      return null;
    }
  };

  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    isActive: false,
    expiresAt: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const testUnlockState = readTestUnlock();
      if (testUnlockState) {
        if (!cancelled) setState(testUnlockState);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) {
          setState(s => ({ ...s, loading: false }));
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_expires_at')
          .eq('id', user.id)
          .single();

        if (cancelled) return;

        if (profileError || !profile) {
          setState(s => ({ ...s, loading: false }));
          return;
        }

        const tier = (profile.subscription_tier as SubscriptionTier) || 'free';
        const expiresAt = profile.subscription_expires_at || null;
        const isActive = tier !== 'free' && (!expiresAt || new Date(expiresAt) > new Date());

        setState({ tier, isActive, expiresAt, loading: false });
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
        if (!cancelled) {
          setState(s => ({ ...s, loading: false }));
        }
      }
    };

    fetch();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetch();
    });

    const syncTestUnlock = () => {
      const testUnlockState = readTestUnlock();
      if (testUnlockState) {
        setState(testUnlockState);
      } else {
        fetch();
      }
    };

    window.addEventListener('subscription-updated', syncTestUnlock);
    window.addEventListener('storage', syncTestUnlock);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener('subscription-updated', syncTestUnlock);
      window.removeEventListener('storage', syncTestUnlock);
    };
  }, []);

  return state;
}

/** Check if a feature requires Pro tier */
export const PRO_FEATURES = new Set([
  'ai-dossier',
  'side-hustles',
  'weekly-brief',
  'rescan',
  'career-coach',
  'resume-weaponizer',
  'interview-cheatsheet',
  'skill-upgrade-plan',
  'career-pivot',
]);

export function requiresPro(featureId: string): boolean {
  return PRO_FEATURES.has(featureId);
}
