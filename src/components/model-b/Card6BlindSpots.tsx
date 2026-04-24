import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CardShell, CardHead, CardBody, SectionLabel, CardNav, Badge } from "./SharedUI";

// ─── Types ─────────────────────────────────────────────────────
type Severity = "CRITICAL" | "SERIOUS" | "MODERATE";
interface BlindSpot {
  title?: string;
  gap?: string;
  body?: string;
  fix?: string;
  severity?: Severity | string;
  peer_benchmark?: string;
  resource_url?: string;
  number?: number;
}
interface Resource { title: string; url: string; type: string; time_estimate: string; free?: boolean }
interface Bundle {
  gap_title: string;
  why_it_matters: string;
  time_estimate_total: string;
  resources: Resource[];
  credential: { name: string; url: string; value: string; time_estimate: string };
  weekend_project: { title: string; description: string; time_estimate: string };
  cohort_signal: string;
}

const TYPE_LABEL: Record<string, { label: string; icon: string }> = {
  course: { label: "Course", icon: "🎓" },
  video: { label: "Video", icon: "▶️" },
  docs: { label: "Read", icon: "📖" },
};

// ─── Per-gap action row ─────────────────────────────────────────
function GapRow({
  bs,
  index,
  isLast,
  role,
  skills,
  onComplete,
  isComplete,
}: {
  bs: BlindSpot;
  index: number;
  isLast: boolean;
  role: string;
  skills: string[];
  onComplete: (gapKey: string, gapTitle: string, severity: string) => void;
  isComplete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  const sevConfig: Record<string, { bg: string; color: string; border: string; icon: string; barBg: string; barHover: string }> = {
    CRITICAL: { bg: "var(--mb-red-tint)", color: "var(--mb-red)", border: "rgba(174,40,40,0.25)", icon: "🔴", barBg: "var(--mb-red)", barHover: "#8a1f1f" },
    SERIOUS: { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.25)", icon: "🟡", barBg: "var(--mb-amber)", barHover: "#6b4500" },
    MODERATE: { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)", border: "var(--mb-navy-tint2)", icon: "🔵", barBg: "var(--mb-navy)", barHover: "#0c2a4a" },
  };
  const sev = sevConfig[(bs.severity as string) || "MODERATE"] || sevConfig.MODERATE;
  const title = bs.title || bs.gap || "Gap";
  const gapKey = `${index}_${title.toLowerCase().slice(0, 40).replace(/\s+/g, "_")}`;

  // ── P0-3: Time-boxed prescription. Convert diagnosis → prescription tone.
  // Severity drives both the time window and the effort budget so users feel
  // the fix is achievable inside one weekend / one evening.
  const sevName = String(bs.severity || "MODERATE").toUpperCase();
  const prescription =
    sevName === "CRITICAL"
      ? { when: "Fix this Sunday", duration: "30 min", color: "var(--mb-red)", bg: "var(--mb-red-tint)", border: "rgba(174,40,40,0.25)" }
      : sevName === "SERIOUS"
      ? { when: "Fix this week", duration: "1 hour", color: "var(--mb-amber)", bg: "var(--mb-amber-tint)", border: "rgba(139,90,0,0.25)" }
      : { when: "Fix next weekend", duration: "45 min", color: "var(--mb-navy)", bg: "var(--mb-navy-tint)", border: "var(--mb-navy-tint2)" };

  const fetchBundle = useCallback(async () => {
    if (bundle || loading) return;
    setLoading(true); setErr(false);
    try {
      const { data, error } = await supabase.functions.invoke("learning-path-resolver", {
        body: { gap_title: title, gap_body: bs.body || bs.fix, severity: bs.severity, role, skills },
      });
      if (error) throw error;
      const b = (data as any)?.bundle as Bundle | undefined;
      if (!b) throw new Error("no bundle");
      setBundle(b);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, [bundle, loading, title, bs.body, bs.fix, bs.severity, role, skills]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !bundle) fetchBundle();
  };

  return (
    <div style={{ borderBottom: isLast ? "none" : "1.5px solid var(--mb-rule)", paddingBottom: 14, marginBottom: 14 }}>
      {/* Top row: severity + title + benchmark + body */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: sev.bg, border: `2px solid ${sev.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 14 }}>{sev.icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: sev.color, letterSpacing: "-0.01em" }}>{title}</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`, letterSpacing: "0.08em" }}>{bs.severity || "MODERATE"}</span>
            {isComplete && (
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1px solid rgba(26,107,60,0.25)", letterSpacing: "0.08em" }}>✓ STARTED</span>
            )}
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.7, fontWeight: 500, marginBottom: 8 }}>{bs.body || bs.fix}</div>
          {bs.peer_benchmark && (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-red)", marginBottom: 10, padding: "6px 10px", background: "var(--mb-red-tint)", borderRadius: 8, border: "1px solid rgba(174,40,40,0.15)" }}>
              📊 {bs.peer_benchmark}
            </div>
          )}
          {bs.fix && (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-green)", marginBottom: 12, padding: "6px 10px", background: "var(--mb-green-tint)", borderRadius: 8, border: "1px solid rgba(26,107,60,0.18)" }}>
              ✅ {bs.fix}
            </div>
          )}

          {/* The Action Bar — full width, impossible to miss */}
          <button
            type="button"
            onClick={handleToggle}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "13px 16px", borderRadius: 12,
              background: open ? "white" : sev.barBg,
              color: open ? sev.color : "white",
              border: `2px solid ${open ? sev.border : sev.barBg}`,
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800,
              letterSpacing: "0.01em", cursor: "pointer", transition: "all 180ms ease",
              boxShadow: open ? "none" : "0 2px 6px rgba(0,0,0,0.08)",
            }}
            onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = sev.barHover; }}
            onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = sev.barBg; }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>📚</span>
              <span>Close this gap{open ? "" : " — see your learning path"}</span>
            </span>
            <span style={{ fontSize: 18, fontWeight: 900 }}>{open ? "−" : "→"}</span>
          </button>

          {/* Inline expand panel */}
          {open && (
            <div style={{ marginTop: 12, padding: 16, background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 12 }}>
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--mb-ink3)", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid var(--mb-navy)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "mbSpin 0.8s linear infinite" }} />
                  Building your personalised learning path…
                </div>
              )}
              {err && !loading && (
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-red)" }}>
                  Could not load resources right now. <button onClick={() => { setErr(false); fetchBundle(); }} style={{ textDecoration: "underline", color: "var(--mb-navy)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Retry</button>
                </div>
              )}
              {bundle && !loading && (
                <>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-ink2)", lineHeight: 1.65, marginBottom: 12, padding: "10px 12px", background: "var(--mb-navy-tint)", borderRadius: 8, border: "1px solid var(--mb-navy-tint2)" }}>
                    🎯 <strong style={{ color: "var(--mb-navy)" }}>Why this matters:</strong> {bundle.why_it_matters}
                  </div>

                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-ink3)", marginBottom: 8 }}>
                    3 free resources · {bundle.time_estimate_total}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {bundle.resources.map((r, i) => {
                      const tl = TYPE_LABEL[r.type] || TYPE_LABEL.docs;
                      return (
                        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 14px", background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 10, textDecoration: "none", transition: "all 150ms ease" }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--mb-navy)"; e.currentTarget.style.background = "var(--mb-navy-tint)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mb-rule)"; e.currentTarget.style.background = "white"; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 16 }}>{tl.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink3)", fontWeight: 600, marginTop: 2 }}>{tl.label} · {r.time_estimate} · Free</div>
                            </div>
                          </div>
                          <span style={{ fontSize: 14, color: "var(--mb-navy)", fontWeight: 800, flexShrink: 0 }}>↗</span>
                        </a>
                      );
                    })}
                  </div>

                  {/* Credential */}
                  <a href={bundle.credential.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "12px 14px", background: "var(--mb-amber-tint)", border: "1.5px solid rgba(139,90,0,0.22)", borderRadius: 10, textDecoration: "none", marginBottom: 10 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-amber)", marginBottom: 4 }}>🏅 Top credential · {bundle.credential.time_estimate}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.35 }}>{bundle.credential.name} ↗</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", lineHeight: 1.55, marginTop: 4, fontWeight: 500 }}>{bundle.credential.value}</div>
                  </a>

                  {/* Weekend project */}
                  <div style={{ padding: "12px 14px", background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.22)", borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-green)", marginBottom: 4 }}>🛠 Weekend project · {bundle.weekend_project.time_estimate}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.35 }}>{bundle.weekend_project.title}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", lineHeight: 1.55, marginTop: 4, fontWeight: 500 }}>{bundle.weekend_project.description}</div>
                  </div>

                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", fontStyle: "italic", lineHeight: 1.55, marginBottom: 12 }}>📈 {bundle.cohort_signal}</div>

                  <button
                    type="button"
                    disabled={isComplete}
                    onClick={() => onComplete(gapKey, title, String(bs.severity || "MODERATE"))}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: isComplete ? "var(--mb-green-tint)" : "var(--mb-green)", color: isComplete ? "var(--mb-green)" : "white", border: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, cursor: isComplete ? "default" : "pointer", letterSpacing: "0.02em" }}
                  >
                    {isComplete ? "✓ Added to your defense plan" : "✓ I'm starting this — add to defense plan (+3 score)"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main card ──────────────────────────────────────────────────
export default function Card6BlindSpots({ cardData, onBack, onNext, scanId }: { cardData: any; onBack: () => void; onNext: () => void; scanId?: string }) {
  const d = cardData.card6_blindspots;
  const role = cardData?.user?.current_title || "professional";
  const skills: string[] = useMemo(
    () => (cardData?.card3_shield?.skills || []).map((s: any) => s?.name).filter(Boolean).slice(0, 8),
    [cardData],
  );
  const blindSpots: BlindSpot[] = d?.blind_spots || [];

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const toggle = (i: number) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  // Hydrate completed state from DB if user is signed in + scanId is known
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!scanId) return;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const { data } = await supabase.from("learning_path_progress").select("gap_key").eq("user_id", auth.user.id).eq("scan_id", scanId);
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      (data || []).forEach((r: any) => { map[r.gap_key] = true; });
      setCompleted(map);
    })();
    return () => { cancelled = true; };
  }, [scanId]);

  const handleComplete = useCallback(async (gapKey: string, gapTitle: string, severity: string) => {
    setCompleted(p => ({ ...p, [gapKey]: true }));
    if (!scanId) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    await supabase.from("learning_path_progress").upsert({
      user_id: auth.user.id,
      scan_id: scanId,
      gap_key: gapKey,
      gap_title: gapTitle,
      severity,
      marked_complete_at: new Date().toISOString(),
      score_delta: 3,
    }, { onConflict: "user_id,scan_id,gap_key" });
  }, [scanId]);

  const completedCount = blindSpots.reduce((acc, bs, i) => {
    const title = bs.title || bs.gap || "Gap";
    const k = `${i}_${title.toLowerCase().slice(0, 40).replace(/\s+/g, "_")}`;
    return acc + (completed[k] ? 1 : 0);
  }, 0);
  const totalGaps = blindSpots.length;
  const pct = totalGaps ? Math.round((completedCount / totalGaps) * 100) : 0;

  return (
    <CardShell>
      <CardHead badges={<><Badge label="06 · Tough love" variant="red" /><Badge label="Specific to your resume" variant="red" /></>} title={d?.headline || ""} sub={d?.subline || ""} />
      <CardBody>
        {/* Tough-love arc */}
        {d?.fear_hook && (
          <div style={{ background: "var(--mb-red-tint)", border: "2px solid rgba(174,40,40,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--mb-red)", lineHeight: 1.7, margin: 0 }}>🔍 {d.fear_hook}</p>
          </div>
        )}
        {d?.confrontation && (
          <div style={{ borderLeft: "4px solid var(--mb-red)", background: "linear-gradient(90deg, var(--mb-red-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "14px 18px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mb-red)", marginBottom: 6 }}>⚔️ NO SUGARCOATING</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>{d.confrontation}</p>
          </div>
        )}
        {d?.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 22 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.6, margin: 0 }}>✅ {d.hope_bridge}</p>
          </div>
        )}

        {/* Discoverable rail above the gaps so users see the learning system exists */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", background: "var(--mb-navy-tint)", border: "1.5px solid var(--mb-navy-tint2)", borderRadius: 10 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-navy)", lineHeight: 1.5 }}>
            Each gap below has a 1-week learning path. Tap <strong>"Close this gap"</strong> to unlock 3 free resources, a credential, and a weekend project — built for your role.
          </span>
        </div>

        {/* Gaps */}
        {blindSpots.map((bs, i) => (
          <GapRow
            key={i}
            bs={bs}
            index={i}
            isLast={i === blindSpots.length - 1}
            role={role}
            skills={skills}
            onComplete={handleComplete}
            isComplete={!!completed[`${i}_${(bs.title || bs.gap || "Gap").toLowerCase().slice(0, 40).replace(/\s+/g, "_")}`]}
          />
        ))}

        {/* ── Consolidated Learning Plan Summary ─── */}
        {totalGaps > 0 && (
          <div style={{ marginTop: 18, padding: 18, background: "linear-gradient(135deg, var(--mb-navy-tint), white)", border: "2px solid var(--mb-navy)", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              {/* Progress ring */}
              <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--mb-rule)" strokeWidth="5" />
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--mb-navy)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * 150.8} 150.8`} transform="rotate(-90 28 28)" style={{ transition: "stroke-dasharray 400ms ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 900, color: "var(--mb-navy)" }}>{completedCount}/{totalGaps}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 4 }}>Your 7-Day Learning Plan</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: "var(--mb-ink)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                  {completedCount === 0 && `Start with the #1 critical gap. 1 hour today.`}
                  {completedCount > 0 && completedCount < totalGaps && `${completedCount} of ${totalGaps} started. Keep momentum — finish this week.`}
                  {completedCount === totalGaps && `All ${totalGaps} gaps queued. Career Position Score +${totalGaps * 3} pending.`}
                </div>
              </div>
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.65, fontWeight: 500 }}>
              Closing all {totalGaps} gaps takes about <strong style={{ color: "var(--mb-navy)" }}>{totalGaps * 5}-{totalGaps * 7} hours</strong> over the next two weeks. Peers who do it move 1 seniority tier within 2 quarters.
            </div>
          </div>
        )}

        {/* Interview prep — unchanged */}
        <div style={{ marginTop: 24 }}>
          <SectionLabel label="Interview prep · Top 5 questions · Built from your resume" />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", marginBottom: 14, fontWeight: 500 }}>Tap any question to see an answer built from your actual resume evidence.</div>

          {(d?.interview_prep || []).slice(0, 5).map((q: any, i: number) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
              <div onClick={() => toggle(i)} style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, cursor: "pointer", background: "white" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink)", flex: 1, marginRight: 8, lineHeight: 1.55 }}>{q.question}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--mb-ink3)", transition: "transform 200ms", flexShrink: 0 }}>{expanded[i] ? "−" : "+"}</span>
              </div>
              {expanded[i] && (
                <div style={{ padding: "14px 16px 16px", borderTop: "1.5px solid var(--mb-rule)" }}>
                  {q.psychological_hook && (
                    <div style={{ background: "var(--mb-navy-tint)", border: "1px solid var(--mb-navy-tint2)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-navy)", margin: 0 }}>🧠 <em>Why they ask this:</em> {q.psychological_hook}</p>
                    </div>
                  )}
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-navy)", marginBottom: 10 }}>{q.framework}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink2)", lineHeight: 1.8, fontWeight: 500 }}>{q.answer || q.star_answer}</div>
                  {q.star_labels?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                      {q.star_labels.map((l: string, j: number) => {
                        const colors = [
                          { bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
                          { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)" },
                          { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)" },
                          { bg: "var(--mb-green-tint)", color: "var(--mb-green)" },
                        ];
                        const sc = colors[j % colors.length];
                        return <span key={j} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 20, background: sc.bg, color: sc.color }}>{l}</span>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <CardNav onBack={onBack} onNext={onNext} nextLabel="See human advantage →" />
      </CardBody>
    </CardShell>
  );
}
