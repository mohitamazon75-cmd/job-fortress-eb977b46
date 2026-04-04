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

  return (
    <CardShell>
      <CardHead badges={<><Badge label="07 · Hope anchoring" variant="navy" /><Badge label="5 daily insights · refreshes" variant="navy" /></>} title={d?.headline || ""} sub={d?.subline || ""} />
      <CardBody>
        <EmotionStrip bgColor="var(--mb-navy-tint)" borderColor="var(--mb-navy-tint2)" icon="🌱" textColor="var(--mb-navy)" message={d?.emotion_message || ""} />

        {/* Insight rotator */}
        <div style={{ background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)", borderRadius: 12, padding: 15, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, color: "var(--mb-navy)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--mb-navy)", animation: "mbPulse 2.5s infinite" }} />
              Today's human edge · 4 Apr 2026
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: "var(--mb-navy)" }}>{insightIndex + 1} / 5</span>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, color: "var(--mb-navy)", lineHeight: 1.75, fontStyle: "italic", minHeight: 56, opacity: fading ? 0 : 1, transition: "opacity 0.22s" }}>
            {insights[insightIndex] || ""}
          </div>
          <button onClick={refreshInsight} disabled={fading} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "var(--mb-navy)", cursor: fading ? "default" : "pointer", padding: "7px 14px", borderRadius: 20, border: "1px solid var(--mb-navy-tint2)", background: "white", marginTop: 12, minHeight: 44 }}>
            ↻ Refresh insight
          </button>
        </div>

        {/* Advantages */}
        <SectionLabel label="Irreplaceable advantages — extracted from your actual resume" />
        {advantages.map((a: any, i: number) => {
          const ic = iconMap[a.icon_type] || iconMap.revenue;
          return (
            <div key={i} style={{ display: "flex", gap: 13, padding: "13px 0", borderBottom: i < advantages.length - 1 ? "1px solid var(--mb-rule)" : "none", alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: ic.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>{ic.emoji}</div>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-ink)", marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.65 }}>{a.body}</div>
                <span style={{ display: "inline-block", marginTop: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: ic.badgeBg, color: ic.badgeColor }}>{a.proof_label}</span>
              </div>
            </div>
          );
        })}

        {/* Share card */}
        <div style={{ background: "var(--mb-navy)", borderRadius: 14, padding: 20, textAlign: "center", marginTop: 16, marginBottom: 14 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 700, color: "white" }}>{cardData.jobbachao_score}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 5, marginBottom: 14 }}>JobBachao Score · {cardData.user?.name} · India 2026</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {scoreTags.map((t: string, i: number) => (
              <span key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>{t}</span>
            ))}
          </div>
          <div className="mb-share-row" style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => { logEvent("whatsapp"); window.open(`https://wa.me/?text=${encodeURIComponent(d?.whatsapp_message || "")}`, "_blank"); }} style={{ background: "#25D366", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, padding: "9px 16px", borderRadius: 20, border: "none", cursor: "pointer", minHeight: 44 }}>💬 WhatsApp</button>
            <button onClick={() => { logEvent("linkedin"); window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://jobbachao.com")}`, "_blank"); }} style={{ background: "#0A66C2", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, padding: "9px 16px", borderRadius: 20, border: "none", cursor: "pointer", minHeight: 44 }}>💼 LinkedIn</button>
            <button onClick={() => { logEvent("copy"); handleCopy(d?.score_card_text || ""); }} style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, padding: "9px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", minHeight: 44 }}>{copied ? "✓ Copied!" : "Copy score card"}</button>
          </div>
        </div>

        {/* Score footer */}
        <div style={{ padding: "15px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, fontWeight: 700, color: "var(--mb-ink)" }}>Score: {cardData.jobbachao_score} / 100</div>
            <div style={{ fontSize: 10, color: "var(--mb-ink3)", fontFamily: "'DM Sans', sans-serif" }}>Risk-aware · Shield-strong · Pivot-ready · Human-anchored</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {scoreTags.map((t: string, i: number) => (
              <span key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "var(--mb-green-tint)", color: "var(--mb-green)" }}>{t}</span>
            ))}
          </div>
        </div>

        <CardNav onBack={onBack} nextLabel="Journey complete ✓" />
      </CardBody>

      {/* Mobile share stack */}
      <style>{`
        @media (max-width: 640px) {
          .mb-share-row { flex-direction: column !important; }
          .mb-share-row button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>
    </CardShell>
  );
}
