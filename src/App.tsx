import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { supabase } from "@/integrations/supabase/client";

// Lazy-loaded routes — split per-route bundles so the landing page ships small.
// Eager: Index (landing), Auth (entry), NotFound (catch-all).
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const AdvancedBeta = lazy(() => import("./pages/AdvancedBeta"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ShareScan = lazy(() => import("./pages/ShareScan"));
const ChallengeResult = lazy(() => import("./pages/ChallengeResult"));
const DiagnosticPage = lazy(() => import("./pages/Diagnostic"));
const DiagnosticShare = lazy(() => import("./pages/DiagnosticShare"));
const ObituaryPage = lazy(() => import("./pages/Obituary"));
const ResultsChoose = lazy(() => import("./pages/ResultsChoose"));
const ResultsModelB = lazy(() => import("./pages/ResultsModelB"));
const Methodology = lazy(() => import("./pages/Methodology"));
const PreviewLiveMarketCard = lazy(() => import("./pages/PreviewLiveMarketCard"));

const queryClient = new QueryClient();

/**
 * Lightweight skeleton fallback while a route chunk loads.
 * Mimics typical page chrome (top bar, hero block, content rows) so the
 * user perceives near-instant navigation instead of a blank spinner screen.
 */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar skeleton */}
      <div className="border-b border-border/50 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="h-6 w-28 rounded-md bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
      {/* Hero skeleton */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-8 space-y-4">
        <div className="h-10 w-3/4 rounded-lg bg-muted animate-pulse" />
        <div className="h-10 w-1/2 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-muted/70 animate-pulse mt-6" />
        <div className="h-4 w-1/2 rounded bg-muted/70 animate-pulse" />
      </div>
      {/* Content rows */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 space-y-3">
        <div className="h-24 w-full rounded-2xl bg-muted/60 animate-pulse" />
        <div className="h-24 w-full rounded-2xl bg-muted/60 animate-pulse" />
        <div className="h-24 w-full rounded-2xl bg-muted/60 animate-pulse" />
      </div>
      {/* Visually-hidden status for screen readers */}
      <span className="sr-only" role="status" aria-live="polite">Loading page…</span>
    </div>
  );
}

/**
 * Detects orphaned JWTs (user deleted but token still cached)
 * via event-driven onAuthStateChange instead of polling.
 * Validates once on mount, then reacts to auth events only.
 */
function useStaleSessionRecovery() {
  useEffect(() => {
    let recovered = false;

    const validateSession = async () => {
      if (recovered) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.auth.getUser();
      if (error && (error.message?.includes("user_not_found") || error.status === 403)) {
        recovered = true;
        console.warn("[StaleSessionRecovery] Orphaned JWT detected — signing out");
        await supabase.auth.signOut();
        window.location.reload();
      }
    };

    // Validate once on mount
    validateSession();

    // React to auth state changes (token refresh, sign-in, etc.) — no polling
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        validateSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}

const App = () => {
  useStaleSessionRecovery();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <ErrorBoundary scope="app">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<ErrorBoundary scope="landing"><Index /></ErrorBoundary>} />
                <Route path="/advanced-beta" element={<ErrorBoundary scope="advanced-beta"><AdvancedBeta /></ErrorBoundary>} />
                <Route path="/auth" element={<ErrorBoundary scope="auth"><Auth /></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary scope="reset-password"><ResetPassword /></ErrorBoundary>} />
                <Route path="/terms" element={<ErrorBoundary scope="terms"><Terms /></ErrorBoundary>} />
                <Route path="/privacy" element={<ErrorBoundary scope="privacy"><Privacy /></ErrorBoundary>} />
                <Route path="/pricing" element={<ErrorBoundary scope="pricing"><Pricing /></ErrorBoundary>} />
                <Route path="/methodology" element={<ErrorBoundary scope="methodology"><Methodology /></ErrorBoundary>} />
                <Route path="/share/:scanId" element={<ErrorBoundary scope="share"><ShareScan /></ErrorBoundary>} />
                <Route path="/share/challenge/:challengeCode" element={<ErrorBoundary scope="challenge"><ChallengeResult /></ErrorBoundary>} />
                <Route path="/admin/monitor" element={<AuthGuard requiredRole="admin">{() => <ErrorBoundary scope="admin"><AdminDashboard /></ErrorBoundary>}</AuthGuard>} />
                {/* Diagnostic feature */}
                <Route path="/diagnostic" element={<ErrorBoundary scope="diagnostic"><DiagnosticPage /></ErrorBoundary>} />
                <Route path="/diagnostic/:token" element={<ErrorBoundary scope="diagnostic-share"><DiagnosticShare /></ErrorBoundary>} />
                <Route path="/obituary" element={<ErrorBoundary scope="obituary"><ObituaryPage /></ErrorBoundary>} />
                <Route path="/results/choose" element={<ErrorBoundary scope="results-choose"><ResultsChoose /></ErrorBoundary>} />
                <Route path="/results/model-b" element={<ErrorBoundary scope="results"><ResultsModelB /></ErrorBoundary>} />
                {/* Phase 2B-iii-a preview route — isolated component verification, no carousel wiring. */}
                <Route path="/preview/live-market-card" element={<ErrorBoundary scope="preview-live-market"><PreviewLiveMarketCard /></ErrorBoundary>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
