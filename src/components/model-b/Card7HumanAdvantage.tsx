import { useEffect, useMemo, useRef, useState } from "react";
import { CardShell, CardHead, CardBody, SectionLabel, CardNav, Badge } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, { emoji: string; bg: string; badgeBg: string; badgeColor: string }> = {
  revenue: { emoji: "📈", bg: "var(--mb-green-tint)", badgeBg: "var(--mb-green-tint)", badgeColor: "var(--mb-green)" },
  people: { emoji: "👥", bg: "var(--mb-navy-tint)", badgeBg: "var(--mb-navy-tint)", badgeColor: "var(--mb-navy)" },
  globe: { emoji: "🌏", bg: "var(--mb-amber-tint)", badgeBg: "var(--mb-amber-tint)", badgeColor: "var(--mb-amber)" },
  shield: { emoji: "🛡️", bg: "var(--mb-navy-tint)", badgeBg: "var(--mb-navy-tint)", badgeColor: "var(--mb-navy)" },
};

// ── WhatsApp Score Snapshot — honest one-time send ───────────────────────
// Trust note: we don't yet operate a weekly-alert pipeline keyed off phone
// numbers, so we don't promise one. This block opens a pre-filled WhatsApp
// message the user can send to themselves (or a friend) as a snapshot of
// their score — useful, shareable, and truthful about what it does.
function WhatsAppCaptureBlock({ score }: { score: number }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    try {
      const cleaned = phone.replace(/\D/g, "");
      const msg = `My JobBachao career score: ${score}/100. AI is reshaping my role — this is where I stand today. Check yours: https://jobbachao.com`;
      // wa.me/<number> opens chat with that specific number, pre-filled.
      window.open(`https://wa.me/91${cleaned}?text=${encodeURIComponent(msg)}`, "_blank");
      setSent(true);
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div style={{ margin: "16px 0", padding: "14px 18px", borderRadius: 14, background: "rgba(37,211,102,0.08)", border: "1.5px solid rgba(37,211,102,0.25)", textAlign: "center" }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>📲</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: "#16a34a" }}>WhatsApp opened</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginTop: 4 }}>Hit send in WhatsApp to save your score snapshot. Re-scan in 30 days to track how it shifts.</div>
      </div>
    );
  }

  return (
    <div style={{ margin: "16px 0", padding: "16px 18px", borderRadius: 14, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)" }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 4 }}>📲 Send your score to your WhatsApp</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", marginBottom: 12 }}>One-tap snapshot — saves your number {score}/100 to your own chat so you can re-scan later and compare. We don't store your number.</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 10, overflow: "hidden", flex: 1 }}>
          <span style={{ padding: "0 10px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-ink3)", borderRight: "1.5px solid var(--mb-rule)", lineHeight: "44px" }}>+91</span>
          <input type="tel" placeholder="10-digit mobile number" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ border: "none", outline: "none", padding: "0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink)", flex: 1, height: 44, background: "transparent" }} />
        </div>
        <button onClick={handleSubmit} disabled={loading || phone.length < 10} style={{ padding: "0 16px", height: 44, borderRadius: 10, background: phone.length >= 10 ? "#25D366" : "var(--mb-rule)", color: phone.length >= 10 ? "white" : "var(--mb-ink3)", border: "none", cursor: phone.length >= 10 ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, transition: "all 150ms", flexShrink: 0 }}>{loading ? "..." : "Notify me"}</button>
      </div>
    </div>
  );
}

// ── Intelligence Block (re-usable shell) ─────────────────────────────────
function IntelBlock({ kicker, title, body, accent, source, children }: {
  kicker: string; title: string; body?: string; accent: "navy" | "green" | "amber" | "red";
  source?: string; children?: React.ReactNode;
}) {
  const palette = {
    navy:  { bg: "var(--mb-navy-tint)",  border: "var(--mb-navy-tint2)",        kc: "var(--mb-navy)"  },
    green: { bg: "var(--mb-green-tint)", border: "rgba(26,107,60,0.25)",        kc: "var(--mb-green)" },
    amber: { bg: "var(--mb-amber-tint)", border: "rgba(139,90,0,0.25)",         kc: "var(--mb-amber)" },
    red:   { bg: "var(--mb-red-tint)",   border: "rgba(174,40,40,0.25)",        kc: "var(--mb-red)"   },
  }[accent];

  return (
    <div style={{ background: palette.bg, border: `1.5px solid ${palette.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: palette.kc }}>{kicker}</span>
        {source && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--mb-ink3)", fontWeight: 700 }}>{source}</span>}
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.35, marginBottom: body ? 6 : 0 }}>{title}</div>
      {body && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "var(--mb-ink2)", lineHeight: 1.65, fontWeight: 500 }}>{body}</div>}
      {children}
    </div>
  );
}

// ── Script card with copy / open / save CTA ──────────────────────────────
function ScriptCard({ s, onCopy, onSave }: {
  s: { kind: string; label: string; body: string; cta_label?: string; cta_url?: string };
  onCopy: (text: string, key: string) => void;
  onSave: (s: any) => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    onCopy(s.body, s.kind);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const cta = s.cta_label || "Copy";
  return (
    <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-navy)" }}>{s.label}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: "var(--mb-ink3)" }}>{s.kind.replace("_", " ")}</span>
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "var(--mb-ink)", lineHeight: 1.65, fontWeight: 500, marginBottom: 12 }}>"{s.body}"</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={handleCopy} style={{ flex: 1, minHeight: 40, padding: "0 14px", background: copied ? "var(--mb-green)" : "var(--mb-navy)", color: "white", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 800, cursor: "pointer", transition: "background 150ms" }}>
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
        {s.cta_url && (
          <a href={s.cta_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minHeight: 40, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "white", color: "var(--mb-navy)", border: "1.5px solid var(--mb-navy)", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
            🔗 {cta}
          </a>
        )}
        <button onClick={() => onSave(s)} style={{ minHeight: 40, padding: "0 14px", background: "white", color: "var(--mb-ink2)", border: "1.5px solid var(--mb-rule)", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          ⭐ Save
        </button>
      </div>
    </div>
  );
}

export default function Card7HumanAdvantage({ cardData, onBack, onNext, copyFallback, analysisId }: { cardData: any; onBack: () => void; onNext?: () => void; copyFallback?: (text: string) => void; analysisId?: string | null }) {
  const d = cardData?.card7_human || {};
  const advantages = useMemo(() => Array.isArray(d?.advantages) ? d.advantages : [], [d]);
  const scoreTags: string[] = Array.isArray(d?.score_tags) ? d.score_tags : [];

  const [copied, setCopied] = useState(false);
  const [savedKinds, setSavedKinds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("jb_human_edge_saved") || "[]"); } catch { return []; }
  });
  const [bundle, setBundle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // ── Resolve human-edge intelligence ──
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const role = cardData?.user?.current_title || cardData?.user?.target_role || "";
        const city = cardData?.user?.location || "";
        const yrs = cardData?.user?.years_experience || "";
        const skills: string[] = (cardData?.card3_shield?.skills || [])
          .map((s: any) => s?.skill || s?.name || s).filter(Boolean).slice(0, 8);
        const topAdv = advantages?.[0]?.proof_label || advantages?.[0]?.title || "";

        if (!analysisId || !role) {
          setLoading(false);
          return;
        }

        const { data, error: fnErr } = await supabase.functions.invoke("human-edge-resolver", {
          body: { scan_id: analysisId, role, skills, city, years_experience: yrs, top_advantage: topAdv, current_score: cardData?.jobbachao_score },
        });
        if (fnErr) throw fnErr;
        if (data?.bundle) setBundle(data.bundle);
        else setError("Intelligence unavailable — showing baseline guidance.");
      } catch (e: any) {
        console.warn("human-edge-resolver failed", e);
        setError("Intelligence unavailable — showing baseline guidance.");
      } finally {
        setLoading(false);
      }
    })();
  }, [analysisId, cardData, advantages]);

  const logEvent = async (platform: string, extra: Record<string, unknown> = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.functions.invoke("log-ab-event", { body: { analysis_id: analysisId, user_id: user?.id, event_type: "share_clicked", metadata: { platform, ...extra } } });
    } catch {}
  };

  const handleCopy = (text: string, key: string) => {
    if (copyFallback) copyFallback(text);
    else if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
    logEvent("script_copy", { kind: key });
  };

  const handleSaveScript = (s: any) => {
    setSavedKinds(prev => {
      const next = prev.includes(s.kind) ? prev.filter(k => k !== s.kind) : [...prev, s.kind];
      try { localStorage.setItem("jb_human_edge_saved", JSON.stringify(next)); } catch {}
      return next;
    });
    logEvent("script_saved", { kind: s.kind });
  };

  const sc = bundle?.scarcity;
  const dm = bundle?.demand;
  const hl = bundle?.half_life;
  const scripts: any[] = Array.isArray(bundle?.scripts) ? bundle.scripts : [];

  return (
    <CardShell>
      <CardHead
        badges={<>
          <Badge label="07 · Your human edge" variant="navy" />
          <Badge label={loading ? "Computing intelligence…" : (bundle ? "Live · Apr 2026" : "Baseline guidance")} variant={bundle ? "green" : "amber"} />
        </>}
        title={d?.headline || "Your edge is specific. Use it before the half-life closes."}
        sub={d?.subline || "AI does execution. You hold what cannot be replicated — for now."}
      />
      <CardBody>

        {/* ── Scarcity — what makes you hard to replace ───────────────── */}
        {sc && (
          <IntelBlock
            kicker="01 · Scarcity index"
            accent="navy"
            source={sc.source === "cohort_db" ? `n=${sc.evidence_count} cohort` : "deterministic baseline"}
            title={sc.percentile_label}
            body={`Your combination — ${sc.combo_label} — costs the market ${sc.replacement_cost} to replace. That is your floor in any negotiation.`}
          />
        )}

        {/* ── Live demand — proof that the market wants you now ───────── */}
        {dm && (
          <IntelBlock
            kicker="02 · Live market demand"
            accent="green"
            source={dm.source === "adzuna_live" ? "Adzuna · live" : "—"}
            title={dm.open_roles_14d != null
              ? `${dm.open_roles_14d.toLocaleString("en-IN")} roles posted in the last 14 days${dm.median_label ? ` · median ${dm.median_label}` : ""}`
              : "Live demand data not available right now"}
            body={dm.open_roles_14d != null
              ? `Use this number when a recruiter asks "why now?" — it is the only number that beats every counter-offer.`
              : `We could not pull live counts; rely on the negotiation script below.`}
          >
            {dm.search_url && (
              <a href={dm.search_url} target="_blank" rel="noopener noreferrer" onClick={() => logEvent("live_jobs_open")}
                 style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 14px", borderRadius: 20, background: "white", color: "var(--mb-green)", border: "1.5px solid rgba(26,107,60,0.35)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
                🔗 See live roles on LinkedIn
              </a>
            )}
          </IntelBlock>
        )}

        {/* ── Half-life — the urgency ─────────────────────────────────── */}
        {hl && (
          <IntelBlock
            kicker="03 · Moat half-life"
            accent={hl.months <= 12 ? "red" : hl.months <= 24 ? "amber" : "navy"}
            source={`risk index ${hl.risk_score}/100`}
            title={`This advantage stays scarce for ${hl.expires_label}. Action window: ${hl.action_window}.`}
            body={hl.drivers?.length ? `Why it decays — ${hl.drivers.slice(0,2).join(" · ")}.` : undefined}
          >
            {/* mini half-life bar */}
            <div style={{ marginTop: 12, height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.max(8, Math.min(100, 100 - (hl.risk_score || 50)))}%`,
                background: hl.months <= 12 ? "var(--mb-red)" : hl.months <= 24 ? "var(--mb-amber)" : "var(--mb-green)",
                transition: "width 600ms ease",
              }} />
            </div>
          </IntelBlock>
        )}

        {/* ── Loading / fallback ──────────────────────────────────────── */}
        {loading && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--mb-ink3)", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, background: "var(--mb-paper)", border: "1.5px dashed var(--mb-rule)", borderRadius: 12, marginBottom: 14 }}>
            Computing scarcity index, live demand & moat half-life…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: "12px 14px", color: "var(--mb-amber)", fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 700, background: "var(--mb-amber-tint)", border: "1.5px solid rgba(139,90,0,0.25)", borderRadius: 10, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* ── Leverage scripts — the action layer ─────────────────────── */}
        {scripts.length > 0 && (
          <>
            <SectionLabel label="04 · Leverage scripts · copy & deploy" />
            {scripts.map((s, i) => (
              <ScriptCard key={s.kind + i} s={s} onCopy={handleCopy} onSave={handleSaveScript} />
            ))}
            {savedKinds.length > 0 && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: "var(--mb-ink3)", textAlign: "right", marginTop: 4, fontWeight: 600 }}>
                ⭐ {savedKinds.length} script{savedKinds.length === 1 ? "" : "s"} saved to plan
              </div>
            )}
          </>
        )}

        {/* ── Cohort signal ───────────────────────────────────────────── */}
        {bundle?.cohort_signal && (
          <div style={{ margin: "20px 0 16px", padding: "12px 16px", background: "var(--mb-paper)", borderLeft: "3px solid var(--mb-navy)", borderRadius: "0 10px 10px 0" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-navy)" }}>Cohort signal</span>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink)", lineHeight: 1.6, marginTop: 4, fontWeight: 600 }}>{bundle.cohort_signal}</div>
          </div>
        )}

        {/* ── Original advantage list (kept as evidence trail) ────────── */}
        {advantages.length > 0 && (
          <>
            <SectionLabel label="Evidence · what AI cannot take from you" />
            {advantages.map((a: any, i: number) => {
              const ic = iconMap[a.icon_type] || iconMap.revenue;
              return (
                <div key={i} style={{ display: "flex", gap: 14, padding: "13px 0", borderBottom: i < advantages.length - 1 ? "1.5px solid var(--mb-rule)" : "none", alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: ic.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>{ic.emoji}</div>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 4 }}>{a.title}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.65, fontWeight: 500 }}>{a.body}</div>
                    {a.proof_label && <span style={{ display: "inline-block", marginTop: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: ic.badgeBg, color: ic.badgeColor }}>{a.proof_label}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── Share card (unchanged) ─────────────────────────────────── */}
        <div style={{ background: "var(--mb-navy)", borderRadius: 16, padding: 24, textAlign: "center", marginTop: 24, marginBottom: 18 }}>
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
            <button onClick={() => { logEvent("copy"); handleCopy(d?.score_card_text || "", "score_card"); }} style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 20, border: "1.5px solid rgba(255,255,255,0.2)", cursor: "pointer", minHeight: 48 }}>{copied ? "✓ Copied!" : "Copy score card"}</button>
          </div>
        </div>

        {/* ── Score footer ───────────────────────────────────────────── */}
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

        <WhatsAppCaptureBlock score={cardData.jobbachao_score} />

        <CardNav onBack={onBack} onNext={onNext} nextLabel="Open tools →" />
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
