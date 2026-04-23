import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionLabel } from "./SharedUI";

interface Props {
  role: string;
  industry: string;
  city: string;
  metroTier: "tier1" | "tier2" | string;
  yearsExperience: string;
  country?: string;
}

interface SalaryFitResult {
  status: "ok" | "input_invalid" | "no_data";
  verdict?: "underpaid" | "fair" | "overpaid" | "outlier_high" | "unverified";
  market_range_lpa?: { min: number; median: number; max: number };
  user_ctc_lpa?: number;
  delta_pct?: number;
  percentile?: number;
  headline?: string;
  rationale?: string[];
  next_steps?: string[];
  data_confidence?: "high" | "medium" | "low";
  citations?: Array<{ title: string; url: string }>;
}

const VERDICT_STYLE: Record<string, { bg: string; border: string; color: string; emoji: string }> = {
  underpaid: { bg: "var(--mb-red-tint)", border: "rgba(174,40,40,0.25)", color: "var(--mb-red)", emoji: "📉" },
  overpaid: { bg: "var(--mb-green-tint)", border: "rgba(26,107,60,0.25)", color: "var(--mb-green)", emoji: "📈" },
  fair: { bg: "var(--mb-navy-tint)", border: "rgba(26,58,107,0.2)", color: "var(--mb-navy)", emoji: "⚖️" },
  outlier_high: { bg: "var(--mb-amber-tint)", border: "rgba(139,90,0,0.25)", color: "var(--mb-amber)", emoji: "⚠️" },
  unverified: { bg: "var(--mb-paper)", border: "var(--mb-rule)", color: "var(--mb-ink2)", emoji: "🔍" },
};

export default function SalaryFitWidget({ role, industry, city, metroTier, yearsExperience, country }: Props) {
  const [ctcInput, setCtcInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SalaryFitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const ctc = parseFloat(ctcInput);
    if (!Number.isFinite(ctc) || ctc <= 0) {
      setError("Please enter your annual CTC in lakhs (e.g. 18.5).");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("salary-fit", {
        body: {
          user_ctc_lpa: ctc,
          role,
          industry,
          city,
          metro_tier: metroTier === "tier2" ? "tier2" : "tier1",
          years_experience: yearsExperience,
          country: country || "IN",
        },
      });
      if (fnErr) throw fnErr;
      setResult(data as SalaryFitResult);
    } catch (e) {
      setError("Couldn't benchmark right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setCtcInput(""); setError(null); };

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionLabel label="AM I PAID FAIRLY? · personalised benchmark" />

      {!result && (
        <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid rgba(26,58,107,0.18)", borderRadius: 14, padding: "16px 18px" }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-ink2)", margin: 0, marginBottom: 12, lineHeight: 1.6 }}>
            Enter your current annual CTC and we'll benchmark it against live market data for your role, city, and experience.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: "var(--mb-ink2)", fontSize: 14 }}>₹</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 18.5"
                value={ctcInput}
                onChange={(e) => setCtcInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                style={{
                  width: "100%",
                  padding: "11px 56px 11px 26px",
                  borderRadius: 10,
                  border: "1.5px solid var(--mb-rule)",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--mb-ink)",
                  background: "white",
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: "var(--mb-ink3)", fontSize: 12, letterSpacing: "0.04em" }}>LPA</span>
            </div>
            <button
              onClick={submit}
              disabled={loading || !ctcInput}
              style={{
                padding: "0 20px",
                borderRadius: 10,
                background: loading || !ctcInput ? "var(--mb-rule)" : "var(--mb-ink)",
                color: "white",
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 800,
                fontSize: 13,
                border: "none",
                cursor: loading || !ctcInput ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                letterSpacing: "0.02em",
              }}
            >
              {loading ? "Checking…" : "Check fit"}
            </button>
          </div>
          {error && (
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--mb-red)", margin: 0, marginTop: 8 }}>{error}</p>
          )}
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--mb-ink3)", margin: 0, marginTop: 10 }}>
            Private — never stored or shown to anyone else. Used only to compute your fit.
          </p>
        </div>
      )}

      {result && result.status === "input_invalid" && (
        <div style={{ background: "var(--mb-amber-tint)", border: "1.5px solid rgba(139,90,0,0.25)", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-amber)", margin: 0 }}>
            {result.headline || "Please re-check your input."}
          </p>
          <button onClick={reset} style={resetBtn}>Try again</button>
        </div>
      )}

      {result && result.status === "no_data" && (
        <div style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--mb-ink2)", margin: 0 }}>
            {result.headline || "We couldn't find enough data to benchmark this role yet."}
          </p>
          <button onClick={reset} style={resetBtn}>Try a different role</button>
        </div>
      )}

      {result && result.status === "ok" && result.verdict && (
        <VerdictPanel result={result} onReset={reset} />
      )}
    </div>
  );
}

const resetBtn: React.CSSProperties = {
  marginTop: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700,
  background: "transparent", border: "1px solid var(--mb-rule)", borderRadius: 8,
  padding: "6px 12px", cursor: "pointer", color: "var(--mb-ink2)",
};

function VerdictPanel({ result, onReset }: { result: SalaryFitResult; onReset: () => void }) {
  const v = VERDICT_STYLE[result.verdict || "unverified"];
  const range = result.market_range_lpa!;
  const userCtc = result.user_ctc_lpa!;
  // Position user marker on the band (clamped 0–100%)
  const span = Math.max(range.max - range.min, 0.01);
  const markerPct = Math.max(0, Math.min(100, ((userCtc - range.min) / span) * 100));
  const medianPct = Math.max(0, Math.min(100, ((range.median - range.min) / span) * 100));

  return (
    <div style={{ background: v.bg, border: `1.5px solid ${v.border}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{v.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 800, color: v.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Verdict · {result.verdict?.replace("_", " ")}
            {result.data_confidence && (
              <span style={{ marginLeft: 8, opacity: 0.7, fontWeight: 700 }}>· confidence: {result.data_confidence}</span>
            )}
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.4 }}>
            {result.headline}
          </div>
        </div>
      </div>

      {/* Range bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: "var(--mb-ink3)", marginBottom: 6 }}>
          <span>₹{range.min}L</span>
          <span style={{ color: "var(--mb-ink2)" }}>median ₹{range.median}L</span>
          <span>₹{range.max}L</span>
        </div>
        <div style={{ position: "relative", height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 5 }}>
          {/* Median tick */}
          <div style={{ position: "absolute", left: `${medianPct}%`, top: -2, width: 2, height: 14, background: "var(--mb-ink2)", opacity: 0.5 }} />
          {/* User marker */}
          <div title={`You: ₹${userCtc}L`} style={{ position: "absolute", left: `calc(${markerPct}% - 8px)`, top: -4, width: 16, height: 18, background: v.color, borderRadius: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }} />
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: v.color, marginTop: 6, textAlign: "center" }}>
          You: ₹{userCtc}L · ~{result.percentile}th percentile
        </div>
      </div>

      {result.rationale && result.rationale.length > 0 && (
        <ul style={{ margin: "0 0 12px 0", padding: 0, listStyle: "none" }}>
          {result.rationale.map((r, i) => (
            <li key={i} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.6, marginBottom: 4, paddingLeft: 14, position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: v.color }}>•</span>{r}
            </li>
          ))}
        </ul>
      )}

      {result.next_steps && result.next_steps.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-ink)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>What to do</div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {result.next_steps.map((s, i) => (
              <li key={i} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--mb-ink)", lineHeight: 1.6, marginBottom: 4, fontWeight: 600 }}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {result.citations && result.citations.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "var(--mb-ink3)", cursor: "pointer" }}>Sources ({result.citations.length})</summary>
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 16 }}>
            {result.citations.map((c, i) => (
              <li key={i} style={{ fontSize: 11, marginBottom: 2 }}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--mb-navy)", textDecoration: "underline" }}>{c.title || c.url}</a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <button onClick={onReset} style={{ ...resetBtn, marginTop: 10 }}>Re-check with different number</button>
    </div>
  );
}
