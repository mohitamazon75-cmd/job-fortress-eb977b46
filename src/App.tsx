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

const queryClient = new QueryClient();

/** Lightweight fallback while a route chunk is loading. */
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading…</p>
      </div>
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
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/advanced-beta" element={<AdvancedBeta />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/methodology" element={<Methodology />} />
                <Route path="/share/:scanId" element={<ShareScan />} />
                <Route path="/share/challenge/:challengeCode" element={<ChallengeResult />} />
                <Route path="/admin/monitor" element={<AuthGuard requiredRole="admin">{() => <AdminDashboard />}</AuthGuard>} />
                {/* Diagnostic feature */}
                <Route path="/diagnostic" element={<DiagnosticPage />} />
                <Route path="/diagnostic/:token" element={<DiagnosticShare />} />
                <Route path="/obituary" element={<ObituaryPage />} />
                <Route path="/results/choose" element={<ResultsChoose />} />
                <Route path="/results/model-b" element={<ResultsModelB />} />
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
