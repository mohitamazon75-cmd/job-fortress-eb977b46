import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRequestMutex } from "@/hooks/use-request-mutex";
import RiskIQLanding from "@/components/riskiq/RiskIQLanding";
import RiskIQFormScreen from "@/components/riskiq/RiskIQForm";
import RiskIQAnalyzing from "@/components/riskiq/RiskIQAnalyzing";
import RiskIQReveal from "@/components/riskiq/RiskIQReveal";
import RiskIQDashboard from "@/components/riskiq/RiskIQDashboard";
import type { RiskIQForm, RiskIQResult } from "@/components/riskiq/RiskIQTypes";

type Phase = "landing" | "form" | "analyzing" | "reveal" | "dashboard";

export default function AdvancedBeta() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [form, setForm] = useState<RiskIQForm>({ role: "", industry: "", experience: "", city: "", education: "" });
  const [result, setResult] = useState<RiskIQResult | null>(null);
  const [error, setError] = useState("");
  const { withMutex } = useRequestMutex();

  // Dossier state - loaded in parallel
  const [dossier, setDossier] = useState<string>("");
  const [dossierLoading, setDossierLoading] = useState(false);
  const dossierAbortRef = useRef<AbortController | null>(null);

  // DEPRECATED: Bluff Boss and Fake It removed (gimmick functions per Phase A pivot)
  // const [bluffData, setBluffData] = useState<any>(null);
  // const [bluffLoading, setBluffLoading] = useState(false);
  // const [fakeItData, setFakeItData] = useState<any>(null);
  // const [fakeItLoading, setFakeItLoading] = useState(false);

  // Stream the dossier from ai-dossier edge function
  const streamDossier = useCallback(async (reportData: RiskIQResult) => {
    setDossierLoading(true);
    setDossier("");

    if (dossierAbortRef.current) {
      dossierAbortRef.current.abort();
    }
    dossierAbortRef.current = new AbortController();

    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!baseUrl) throw new Error('VITE_SUPABASE_URL is not configured');
      const response = await fetch(
        `${baseUrl}/functions/v1/ai-dossier`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ report: reportData }),
          signal: dossierAbortRef.current.signal,
        }
      );

      if (!response.ok || !response.body) {
        console.error("Dossier stream failed:", response.status);
        setDossierLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setDossier(fullContent);
            }
          } catch {
            // Partial JSON, continue
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Dossier stream error:", e);
      }
    } finally {
      setDossierLoading(false);
    }
  }, []);

  // DEPRECATED: Bluff Boss and Fake It removed (gimmick functions per Phase A pivot)
  // const fetchBluffBoss = useCallback(async (_reportData: RiskIQResult, formData: RiskIQForm) => {
  //   ...
  // }, []);
  // const fetchFakeIt = useCallback(async (reportData: RiskIQResult, formData: RiskIQForm) => {
  //   ...
  // }, []);

  const handleSubmit = useCallback(async (formData: RiskIQForm, profileText: string) => {
    await withMutex("riskiq-submit", async () => {
      setForm(formData);
      setPhase("analyzing");
      setError("");
      setDossier("");
      setBluffData(null);
      setFakeItData(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("riskiq-analyse", {
          body: { profile: formData, raw_text: profileText || undefined },
        });

        if (fnError) {
          const msg = fnError.message || "";
          if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
            throw new Error("Rate limit reached. Please wait a few minutes before trying again.");
          }
          if (msg.includes("402") || msg.toLowerCase().includes("payment")) {
            throw new Error("Service temporarily unavailable. Please try again later.");
          }
          throw new Error(fnError.message);
        }
        if (data?.error) {
          if (data.error.includes("rate") || data.error.includes("limit")) {
            throw new Error("Rate limit reached. Please wait a few minutes before trying again.");
          }
          throw new Error(data.error);
        }

        const reportData = data as RiskIQResult;
        setResult(reportData);

        // ═══ Fire enrichment call in parallel ═══
        streamDossier(reportData);
        // DEPRECATED: fetchBluffBoss and fetchFakeIt removed (gimmick functions)
        // fetchBluffBoss(reportData, formData);
        // fetchFakeIt(reportData, formData);

        await new Promise(r => setTimeout(r, 400));
        setPhase("reveal");
      } catch (e: any) {
        const message = e.message || "Analysis failed";
        if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("network")) {
          setError("Network error — check your connection and try again.");
        } else if (message.includes("timeout") || message.includes("Timeout")) {
          setError("Analysis timed out. This can happen for complex profiles — please try again.");
        } else {
          setError(message);
        }
        setPhase("form");
      }
    });
  }, [withMutex, streamDossier]);

  const handleReset = useCallback(() => {
    if (dossierAbortRef.current) {
      dossierAbortRef.current.abort();
    }
    setPhase("landing");
    setForm({ role: "", industry: "", experience: "", city: "", education: "" });
    setResult(null);
    setError("");
    setDossier("");
    setDossierLoading(false);
    setBluffData(null);
    setBluffLoading(false);
    setFakeItData(null);
    setFakeItLoading(false);
  }, []);

  switch (phase) {
    case "landing":
      return <RiskIQLanding onStart={() => setPhase("form")} />;
    case "form":
      return <RiskIQFormScreen onSubmit={handleSubmit} onBack={() => setPhase("landing")} error={error} />;
    case "analyzing":
      return <RiskIQAnalyzing role={form.role} />;
    case "reveal":
      return result ? <RiskIQReveal result={result} onContinue={() => setPhase("dashboard")} /> : null;
    case "dashboard":
      return result ? (
        <RiskIQDashboard
          result={result}
          form={form}
          onReset={handleReset}
          dossier={dossier}
          dossierLoading={dossierLoading}
          bluffData={null}
          bluffLoading={false}
          fakeItData={null}
          fakeItLoading={false}
        />
      ) : null;
    default:
      return null;
  }
}
