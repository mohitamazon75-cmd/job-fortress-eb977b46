import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdvancedBeta from "./pages/AdvancedBeta";
import Pricing from "./pages/Pricing";
import ShareScan from "./pages/ShareScan";
import ChallengeResult from "./pages/ChallengeResult";
import DiagnosticPage from "./pages/Diagnostic";
import DiagnosticShare from "./pages/DiagnosticShare";
import ObituaryPage from "./pages/Obituary";
import ResultsChoose from "./pages/ResultsChoose";
import ResultsModelB from "./pages/ResultsModelB";
import Methodology from "./pages/Methodology";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

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
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
