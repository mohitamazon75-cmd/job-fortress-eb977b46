import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AuthGuardProps {
  children: (session: Session) => React.ReactNode;
  fallback?: React.ReactNode;
  requiredRole?: 'admin' | 'user';
}

// DEV BYPASS: only skips auth when VITE_ENABLE_DEV_AUTH_BYPASS=true is explicitly set.
// import.meta.env.DEV must NOT be used here — it would leak into any `build:dev` output.
const IS_LOCAL_DEV = import.meta.env.VITE_ENABLE_DEV_AUTH_BYPASS === 'true';
const DEV_SESSION = {
  user: {
    id: 'dev-test-user',
    email: 'test@localhost.dev',
    role: 'authenticated',
    user_metadata: { subscription_tier: 'pro' },
  },
  access_token: 'dev-token',
  refresh_token: 'dev-refresh',
} as unknown as Session;

export default function AuthGuard({ children, fallback, requiredRole }: AuthGuardProps) {
  const [session, setSession] = useState<Session | null>(IS_LOCAL_DEV ? DEV_SESSION : null);
  const [loading, setLoading] = useState(!IS_LOCAL_DEV);
  const [isAuthorized, setIsAuthorized] = useState(!requiredRole || IS_LOCAL_DEV);
  const navigate = useNavigate();

  useEffect(() => {
    // On localhost: skip all auth checks — use dummy session directly
    if (IS_LOCAL_DEV) {
      setIsAuthorized(true);
      return;
    }

    // P1-3 FIX: Only update session state here — don't navigate on sign-out.
    // Navigation is handled by Index.tsx's own auth listener to avoid race conditions.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (requiredRole && session) {
        checkUserRole(session.user.id);
      } else {
        setIsAuthorized(!requiredRole);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        navigate('/auth', { replace: true });
      } else if (requiredRole) {
        checkUserRole(session.user.id);
      } else {
        setIsAuthorized(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, requiredRole]);

  const checkUserRole = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        setIsAuthorized(false);
        navigate('/', { replace: true });
        return;
      }

      // Map subscription_tier to role: 'pro'/'enterprise' tier = admin access
      const effectiveRole = (profile as { subscription_tier?: string }).subscription_tier === 'pro' || (profile as { subscription_tier?: string }).subscription_tier === 'enterprise' ? 'admin' : 'user';
      if (requiredRole && effectiveRole !== requiredRole) {
        setIsAuthorized(false);
        navigate('/', { replace: true });
        return;
      }

      setIsAuthorized(true);
    } catch {
      setIsAuthorized(false);
      navigate('/', { replace: true });
    }
  };

  if (loading) return fallback || null;
  if (!session || !isAuthorized) return null;

  return <>{children(session)}</>;
}
