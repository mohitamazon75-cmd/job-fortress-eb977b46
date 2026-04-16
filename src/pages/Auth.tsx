import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle, Zap } from 'lucide-react';

const POST_AUTH_REDIRECT_KEY = 'jb_post_auth_redirect';

function getStoredAnonymousScanIds(): string[] {
  const ids = new Set<string>();

  try {
    const legacyIds = JSON.parse(localStorage.getItem('anon_scan_ids') || '[]');
    if (Array.isArray(legacyIds)) {
      legacyIds.forEach((value) => {
        if (typeof value === 'string' && value) ids.add(value);
      });
    }
  } catch {}

  try {
    const storedScans = JSON.parse(localStorage.getItem('anon_scans') || '[]');
    if (Array.isArray(storedScans)) {
      storedScans.forEach((entry) => {
        if (typeof entry === 'string' && entry) ids.add(entry);
        if (entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id) ids.add(entry.id);
      });
    }
  } catch {}

  return Array.from(ids);
}

function clearStoredAnonymousScans() {
  localStorage.removeItem('anon_scan_ids');
  localStorage.removeItem('anon_scans');
}

function consumePostAuthRedirect(): string | null {
  const redirect = sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
  if (!redirect) return null;
  sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  return redirect.startsWith('/') ? redirect : null;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let handled = false;

    const finishAuthFlow = async () => {
      if (handled) return;
      handled = true;

      try {
        const storedScanIds = getStoredAnonymousScanIds();
        if (storedScanIds.length > 0) {
          const { error: migrateError } = await supabase.functions.invoke('migrate-anon-scans', {
            body: { scanIds: storedScanIds },
          });

          if (!migrateError) {
            clearStoredAnonymousScans();
          } else {
            console.debug('[auth] anon scan migration failed (non-fatal):', migrateError);
          }
        }
      } catch (e) {
        console.debug('[auth] anon scan migration failed (non-fatal):', e);
      }

      const redirect = consumePostAuthRedirect();
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      const hasPending = sessionStorage.getItem('jb_pending_input');
      navigate('/', { replace: true, state: hasPending ? { fromAuth: true } : undefined });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void finishAuthFlow();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        void finishAuthFlow();
      }
    });

    return () => {
      handled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // DEV BYPASS: on localhost, any email/password goes straight through
    if (isLocalhost) {
      navigate('/', { replace: true });
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setSuccess('Check your email for a verification link to complete signup.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email first');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess('Password reset link sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      setError(error.message || 'Google sign-in failed');
    }
    setLoading(false);
  };

  // Dev-only: anonymous sign-in for local testing without email/password
  const handleDevLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Dev login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-foreground">
            Job<span className="text-primary">Bachao</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isLogin ? 'Sign in to access your career analysis' : 'Create an account to get started'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm text-primary bg-primary/10 rounded-lg px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          {isLogin && (
            <button
              onClick={handleForgotPassword}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </button>
          )}

          {/* Dev-only quick login — only shows on localhost */}
          {isLocalhost && (
            <div className="mt-3 pt-3 border-t border-dashed border-border/50">
              <button
                onClick={handleDevLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 text-amber-600 text-xs font-semibold hover:bg-amber-500/10 transition-colors disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                Quick Test Login (localhost only)
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-primary font-semibold">{isLogin ? 'Sign Up' : 'Sign In'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
