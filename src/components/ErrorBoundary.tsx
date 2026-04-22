import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional scope label shown in the UI ("dashboard", "scan", etc.). */
  scope?: string;
  /** Optional custom fallback. Receives the error and a soft-reset handler. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: '' };
  }

  /** Soft retry — re-mounts children without nuking session state. */
  private softReset = () => {
    this.setState({ hasError: false, error: null, errorId: '' });
  };

  /** Hard reset — clears app state and navigates home. Last resort. */
  private hardReset = () => {
    try {
      sessionStorage.removeItem('jb_pending_input');
      sessionStorage.removeItem('jb_lazy_retry_once');
      localStorage.removeItem('anon_scan_ids');
      localStorage.removeItem('anon_scans');

      const message = this.state.error?.message || '';
      const isAuthError = message.includes('auth') ||
                          message.includes('JWT') ||
                          message.includes('session') ||
                          message.includes('token');

      if (isAuthError) {
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
    console.error(`[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ''}] Uncaught error:`, message, error?.stack);
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
    if (this.state.hasError && this.state.error) {
      // Custom fallback wins if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.softReset);
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">💥</span>
            </div>
            <h1 className="text-2xl font-black text-foreground">Something Went Wrong</h1>
            <p className="text-muted-foreground text-sm">
              {this.props.scope
                ? `The ${this.props.scope} hit an unexpected error. You can retry, or start over from the home page.`
                : 'An unexpected error occurred. Try again, or start over from the home page.'}
            </p>
            <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
              Error ID: {this.state.errorId || Date.now().toString(36).toUpperCase()}
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-muted-foreground bg-muted/60 rounded-lg p-3 break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.softReset}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={this.hardReset}
                className="px-6 py-3 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted transition-all"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

