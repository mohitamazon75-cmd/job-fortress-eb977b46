import { useState } from "react";
import { CardShell, CardHead, CardBody, EmotionStrip, SectionLabel, CardNav, Badge } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, { emoji: string; bg: string; badgeBg: string; badgeColor: string }> = {
  revenue: { emoji: "📈", bg: "var(--mb-green-tint)", badgeBg: "var(--mb-green-tint)", badgeColor: "var(--mb-green)" },
  people: { emoji: "👥", bg: "var(--mb-navy-tint)", badgeBg: "var(--mb-navy-tint)", badgeColor: "var(--mb-navy)" },
  globe: { emoji: "🌏", bg: "var(--mb-amber-tint)", badgeBg: "var(--mb-amber-tint)", badgeColor: "var(--mb-amber)" },
  shield: { emoji: "🛡️", bg: "var(--mb-navy-tint)", badgeBg: "var(--mb-navy-tint)", badgeColor: "var(--mb-navy)" },
};

export default function Card7HumanAdvantage({ cardData, onBack, copyFallback, analysisId }: { cardData: any; onBack: () => void; copyFallback?: (text: string) => void; analysisId?: string | null }) {
  const d = cardData.card7_human;
  const [insightIndex, setInsightIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [copied, setCopied] = useState(false);

  const logEvent = async (platform: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.functions.invoke("log-ab-event", { body: { analysis_id: analysisId, user_id: user?.id, event_type: "share_clicked", metadata: { platform } } });
    } catch {}
  };

  const refreshInsight = () => {
    setFading(true);
    setTimeout(() => { setInsightIndex(p => (p + 1) % Math.max(insights.length, 1)); setFading(false); }, 220);
  };

  const handleCopy = (text: string) => {
    if (copyFallback) {
      copyFallback(text);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const insights = d?.insights || [];
  const advantages = d?.advantages || [];
  const scoreTags = d?.score_tags || [];
  const mission = d?.twenty_four_hour_mission;

  return (
    <CardShell>
      <CardHead badges={<><Badge label="07 · Hope anchoring" variant="navy" /><Badge label="5 daily insights · refreshes" variant="navy" /></>} title={d?.headline || ""} sub={d?.subline || ""} />
      <CardBody>
        {/* Hope emotional arc */}
        {d?.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "2px solid rgba(26,107,60,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.7, margin: 0 }}>🌟 {d.hope_bridge}</p>
          </div>
        )}
        {d?.fear_hook && (
          <div style={{ background: "var(--mb-amber-tint)", border: "1.5px solid rgba(139,90,0,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-amber)", lineHeight: 1.6, margin: 0 }}>⚡ {d.fear_hook}</p>
          </div>
        )}

        {/* Insight rotator */}
        <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid var(--mb-navy-tint2)", borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-navy)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mb-navy)", animation: "mbPulse 2.5s infinite" }} />
              Today's human edge · 4 Apr 2026
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 800, color: "var(--mb-navy)" }}>{insightIndex + 1} / {Math.max(insights.length, 1)}</span>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "var(--mb-navy)", lineHeight: 1.75, fontStyle: "italic", minHeight: 56, opacity: fading ? 0 : 1, transition: "opacity 0.22s" }}>
            {insights[insightIndex] || ""}
          </div>
          <button onClick={refreshInsight} disabled={fading} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-navy)", cursor: fading ? "not-allowed" : "pointer", opacity: fading ? 0.5 : 1, padding: "8px 16px", borderRadius: 20, border: "1.5px solid var(--mb-navy-tint2)", background: "white", marginTop: 14, minHeight: 44, transition: "opacity 0.15s" }}>
            ↻ Refresh insight
          </button>
        </div>

        {/* Advantages */}
        <SectionLabel label="What AI cannot take from you" />
        {advantages.map((a: any, i: number) => {
          const ic = iconMap[a.icon_type] || iconMap.revenue;
          return (
            <div key={i} style={{ display: "flex", gap: 14, padding: "15px 0", borderBottom: i < advantages.length - 1 ? "1.5px solid var(--mb-rule)" : "none", alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: ic.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>{ic.emoji}</div>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 5 }}>{a.title}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontWeight: 500 }}>{a.body}</div>
                <span style={{ display: "inline-block", marginTop: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 20, background: ic.badgeBg, color: ic.badgeColor }}>{a.proof_label}</span>
              </div>
            </div>
          );
        })}

        {/* Manifesto */}
        {d?.manifesto && (
          <div style={{ borderLeft: "4px solid var(--mb-navy)", background: "linear-gradient(90deg, var(--mb-navy-tint), transparent)", borderRadius: "0 14px 14px 0", padding: "18px 22px", marginTop: 20, marginBottom: 18 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 8 }}>YOUR MANIFESTO</div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.75, margin: 0, fontStyle: "italic" }}>{d.manifesto}</p>
          </div>
        )}

        {/* 24-Hour Mission — Urgency CTA */}
        {mission && (
          <div style={{ background: "linear-gradient(135deg, var(--mb-green-tint), var(--mb-navy-tint))", border: "2px solid rgba(26,107,60,0.25)", borderRadius: 16, padding: 20, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mb-green)" }}>YOUR 24-HOUR MISSION</span>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, marginBottom: 8, margin: 0 }}>{mission.action}</p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink2)", lineHeight: 1.6, marginBottom: 8, margin: "8px 0" }}>{mission.why}</p>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-green)", padding: "8px 12px", background: "rgba(26,107,60,0.08)", borderRadius: 8, border: "1px solid rgba(26,107,60,0.15)" }}>
              ✅ Expected result: {mission.expected_result}
            </div>
          </div>
        )}

        {/* Share card */}
        <div style={{ background: "var(--mb-navy)", borderRadius: 16, padding: 24, textAlign: "center", marginTop: 20, marginBottom: 18 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>{cardData.jobbachao_score}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 6, marginBottom: 16, fontWeight: 600 }}>JobBachao Score · {cardData.user?.name} · India 2026</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {scoreTags.map((t: string, i: number) => (
              <span key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}>{t}</span>
            ))}
          </div>
          <div className="mb-share-row" style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => { logEvent("whatsapp"); window.open(`https://wa.me/?text=${encodeURIComponent(d?.whatsapp_message || "")}`, "_blank"); }} style={{ background: "#25D366", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, padding: "10px 18px", borderRadius: 20, border: "none", cursor: "pointer", minHeight: 48 }}>💬 WhatsApp</button>
            <button onClick={() => { logEvent("linkedin"); window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://jobbachao.com")}`, "_blank"); }} style={{ background: "#0A66C2", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, padding: "10px 18px", borderRadius: 20, border: "none", cursor: "pointer", minHeight: 48 }}>💼 LinkedIn</button>
            <button onClick={() => { logEvent("copy"); handleCopy(d?.score_card_text || ""); }} style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 20, border: "1.5px solid rgba(255,255,255,0.2)", cursor: "pointer", minHeight: 48 }}>{copied ? "✓ Copied!" : "Copy score card"}</button>
          </div>
        </div>

        {/* Score footer */}
        <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 800, color: "var(--mb-ink)" }}>Score: {cardData.jobbachao_score} / 100</div>
            <div style={{ fontSize: 12, color: "var(--mb-ink2)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, marginTop: 2 }}>Risk-aware · Shield-strong · Pivot-ready · Human-anchored</div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {scoreTags.map((t: string, i: number) => (
              <span key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)" }}>{t}</span>
            ))}
          </div>
        </div>

        <CardNav onBack={onBack} nextLabel="Journey complete ✓" />
      </CardBody>

      <style>{`
        @media (max-width: 640px) {
          .mb-share-row { flex-direction: column !important; }
          .mb-share-row button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>
    </CardShell>
  );
}
