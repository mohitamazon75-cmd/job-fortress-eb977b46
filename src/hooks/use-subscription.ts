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
 * Admin / founder emails that always have Pro access (so testing premium
 * features doesn't require running through Razorpay every time).
 * Keep this list short — production users go through real subscriptions.
 */
const ADMIN_PRO_EMAILS = new Set<string>([
  'mohit@jobbachao.com',
  'mo@jobbachao.com',
  'mohit@naukribachao.com',
  'mo@naukribachao.com',
]);

/**
 * Features that require an active Pro subscription. Any featureId not in this
 * set renders for free users automatically (used by `requiresPro`).
 */
export const PRO_FEATURES = new Set<string>([
  'cheat_sheet',
  'skill_upgrade_plan',
  'career_pivot_full',
  'resume_weaponizer',
  'salary_negotiation',
  'side_hustles',
  'ai_coach_unlimited',
  'weekly_brief',
  'monthly_rescan',
]);

export function requiresPro(featureId: string): boolean {
  return PRO_FEATURES.has(featureId);
}

/**
 * Reads the current user's subscription tier from the `profiles` table.
 * Falls back to 'free' for anonymous users or any error condition.
 *
 * Listens to `subscription-updated` window events (dispatched by the
 * Razorpay success handler) so a successful purchase upgrades the UI
 * without a page refresh.
 */
export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    isActive: false,
    expiresAt: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setState({ tier: 'free', isActive: false, expiresAt: null, loading: false });
          }
          return;
        }

        // Admin / founder whitelist — always Pro
        const email = user.email?.toLowerCase() ?? '';
        if (ADMIN_PRO_EMAILS.has(email)) {
          if (!cancelled) {
            setState({ tier: 'pro', isActive: true, expiresAt: null, loading: false });
          }
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_expires_at')
          .eq('id', user.id)
          .maybeSingle();

        const tier = (profile?.subscription_tier as SubscriptionTier) ?? 'free';
        const expiresAt = profile?.subscription_expires_at ?? null;
        const isActive =
          (tier === 'pro' || tier === 'pro_monthly') &&
          (!expiresAt || new Date(expiresAt) > new Date());

        if (!cancelled) {
          setState({
            tier: isActive ? tier : 'free',
            isActive,
            expiresAt,
            loading: false,
          });
        }
      } catch (err) {
        console.warn('[useSubscription] Failed to load tier — defaulting to free:', err);
        if (!cancelled) {
          setState({ tier: 'free', isActive: false, expiresAt: null, loading: false });
        }
      }
    };

    load();

    // React to auth changes and to the post-payment custom event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load());
    const onUpdate = () => load();
    window.addEventListener('subscription-updated', onUpdate);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener('subscription-updated', onUpdate);
    };
  }, []);

  return state;
}
