import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorId: '' };
  }

  private hardReset = () => {
    try {
      // Always clear app-specific scan state
      sessionStorage.removeItem('jb_pending_input');
      sessionStorage.removeItem('jb_lazy_retry_once');
      localStorage.removeItem('anon_scan_ids');

      // Only clear auth tokens if this is an auth-related error
      const message = this.state.error?.message || '';
      const isAuthError = message.includes('auth') ||
                          message.includes('JWT') ||
                          message.includes('session') ||
                          message.includes('token');

      if (isAuthError) {
        // Remove stale auth/session keys only for auth errors
        for (const key of Object.keys(localStorage)) {
          if (key.includes('-auth-token') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch {}

    window.location.href = '/';
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString(36).toUpperCase(),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const message = error?.message || 'Unknown error';
    console.error('[ErrorBoundary] Uncaught error:', message, error?.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);

    // Auto-recover once for stale lazy chunk errors after deploys
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message);
    if (isChunkError) {
      const hasRetried = (() => {
        try { return sessionStorage.getItem('jb_error_boundary_retry') === '1'; } catch { return false; }
      })();
      if (!hasRetried) {
        try { sessionStorage.setItem('jb_error_boundary_retry', '1'); } catch {}
        this.hardReset();
      }
    } else {
      try { sessionStorage.removeItem('jb_error_boundary_retry'); } catch {}
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">💥</span>
            </div>
            <h1 className="text-2xl font-black text-foreground">Something Went Wrong</h1>
            <p className="text-muted-foreground text-sm">
              We reset local app state to recover from stale cache/session errors.
            </p>
            <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
              Error ID: {this.state.errorId || Date.now().toString(36).toUpperCase()}
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-muted-foreground bg-muted/60 rounded-lg p-3 break-words">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.hardReset}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all"
            >
              Start Over
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
