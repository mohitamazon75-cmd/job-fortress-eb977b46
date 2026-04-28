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

    // CRITICAL: subscribe to onAuthStateChange BEFORE calling getSession() and
    // give the OAuth callback a brief grace window before redirecting to /auth.
    // Otherwise, returning from Google to a guarded route can race the session
    // hydration and bounce the user back to login (the loop reported 2026-04-28).
    let redirectTimer: number | undefined;
    let decided = false;

    const finalizeNoSession = () => {
      if (decided) return;
      decided = true;
      navigate('/auth', { replace: true });
    };

    const onSession = (s: Session | null) => {
      setSession(s);
      setLoading(false);
      if (s) {
        if (redirectTimer) window.clearTimeout(redirectTimer);
        decided = true;
        if (requiredRole) {
          checkUserRole(s.user.id);
        } else {
          setIsAuthorized(true);
        }
      } else if (requiredRole === undefined) {
        setIsAuthorized(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      onSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      onSession(session);
      if (!session) {
        // Wait briefly for OAuth callback to land via the listener above.
        redirectTimer = window.setTimeout(finalizeNoSession, 1500);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [navigate, requiredRole]);

  const checkUserRole = async (userId: string) => {
    try {
      // SECURITY FIX: Look up the actual role from user_roles (not subscription tier).
      // The server (admin-dashboard edge function) uses has_role(); the client must match.
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', requiredRole as 'admin' | 'user')
        .maybeSingle();

      if (error || !data) {
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
