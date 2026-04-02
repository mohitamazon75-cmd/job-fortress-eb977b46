import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BetaWelcomeScreen from "./BetaWelcomeScreen";
import BetaChildSetup from "./BetaChildSetup";
import BetaChildList from "./BetaChildList";
import BetaFaceScanner from "./BetaFaceScanner";
import BetaScanResult from "./BetaScanResult";
import BetaChildHistory from "./BetaChildHistory";

const BETA_FEEDBACK_EMAIL = "hello@firstthenflourish.com";

// ── Beta Banner ───────────────────────────────────────────────────────────────
function BetaBanner({ onDismiss }) {
  return (
    <div className="w-full flex items-center justify-between gap-2 px-4 py-2 bg-amber-100 border-b border-amber-200">
      <p className="text-xs font-medium text-amber-800 leading-tight">
        🧪 Beta Feature — Your feedback helps us improve
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`mailto:${BETA_FEEDBACK_EMAIL}?subject=PulseCheck%20Beta%20Feedback`}
          className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap border border-amber-300 rounded-md px-2 py-0.5 transition-colors hover:bg-amber-200"
        >
          Give Feedback
        </a>
        <button onClick={onDismiss} className="text-amber-600 hover:text-amber-900 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function WellnessBetaRoot() {
  const [phase, setPhase]               = useState(null);
  const [children, setChildren]         = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [bannerVisible, setBannerVisible] = useState(true); // session-only

  // ── On mount: load all students ───────────────────────────────────────────
  useEffect(() => {
    async function loadStudents() {
      try {
        const { data, error } = await supabase
          .from("pulse_beta_students")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) throw error;

        const rows = data ?? [];
        setChildren(rows);
        setPhase(rows.length > 0 ? "child-list" : "welcome");
      } catch (err) {
        console.error("[WellnessBeta] Failed to load students:", err);
        setPhase("welcome");
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, []);

  if (loading || phase === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Render current phase screen ───────────────────────────────────────────
  function renderPhase() {
    switch (phase) {
      case "welcome":
        return <BetaWelcomeScreen onGetStarted={() => setPhase("setup")} />;

      case "child-list":
        return (
          <BetaChildList
            children={children}
            onAddChild={() => setPhase("setup")}
            onCheckin={(child) => { setSelectedChild(child); setPhase("scanning"); }}
            onViewHistory={(child) => { setSelectedChild(child); setPhase("history"); }}
          />
        );

      case "setup":
        return (
          <BetaChildSetup
            onSaved={(newChild) => { setChildren((prev) => [...prev, newChild]); setPhase("child-list"); }}
            onCancel={() => setPhase(children.length > 0 ? "child-list" : "welcome")}
          />
        );

      case "scanning":
        return (
          <BetaFaceScanner
            child={selectedChild}
            onComplete={(result) => { setLastScanResult(result); setPhase("scan-result"); }}
            onCancel={() => setPhase("child-list")}
          />
        );

      case "scan-result":
        return (
          <BetaScanResult
            child={selectedChild}
            result={lastScanResult}
            onDone={() => setPhase("child-list")}
          />
        );

      case "history":
        return <BetaChildHistory child={selectedChild} onBack={() => setPhase("child-list")} />;

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {bannerVisible && <BetaBanner onDismiss={() => setBannerVisible(false)} />}
      <div className="flex-1">
        {renderPhase()}
      </div>
    </div>
  );
}
