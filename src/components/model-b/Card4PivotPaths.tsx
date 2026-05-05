import { useState, useMemo } from "react";
import { CardShell, CardHead, CardBody, SectionLabel, CardNav, Badge, variantColor } from "./SharedUI";
import { sortPivotsByMatch } from "@/lib/pivot-sort";
import { toast } from "sonner";
import { useCohortIntel } from "@/hooks/useCohortIntel";
import JobVsBusinessCard from "./JobVsBusinessCard";

// ─────────────────────────────────────────────────────────────────────
// Salary band parser. Extracts an INR lakh figure from strings like
// "₹45–60L", "₹1.2 Cr", "60 LPA". Returns the midpoint in lakhs, or null.
// Deterministic — no LLM, no fabrication. If we can't parse it, we hide
// the math card rather than guess.
// ─────────────────────────────────────────────────────────────────────
function parseInrBandToLakhs(s: any): number | null {
  if (!s || typeof s !== "string") return null;
  const cleaned = s.replace(/[,\s]/g, "").toLowerCase();
  const isCr = /cr|crore/.test(cleaned);
  const nums = cleaned.match(/(\d+(?:\.\d+)?)/g);
  if (!nums || nums.length === 0) return null;
  const vals = nums.slice(0, 2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (vals.length === 0) return null;
  const mid = vals.length === 2 ? (vals[0] + vals[1]) / 2 : vals[0];
  return isCr ? mid * 100 : mid; // Cr → lakhs
}

function formatLakhs(lakhs: number): string {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(1)} Cr`;
  return `₹${Math.round(lakhs)}L`;
}

// ────────────────────────────────────────────────────────────────────────
// Pivot tab — redesigned for "wow / WTF how does it know" emotional impact.
// Verified URLs (all 200 as of 2026-04-23):
//   ✓ https://www.heidrick.com/en/search?keywords=…
//   ✓ https://www.kornferry.com/search-results?q=…
//   ✗ https://www.spencerstuart.com/search? — 404 (replaced w/ Google site-search)
//   ✗ https://www.egonzehnder.com/search?  — returns no-results (replaced w/ Google)
// All firm CTAs fall back to Google site-search because it is universally
// reliable and is what real CXOs actually use to find a partner-in-charge.
// ────────────────────────────────────────────────────────────────────────

function isExecutiveCardData(cardData: any): boolean {
  if (!cardData || typeof cardData !== "object") return false;

  const title = String(cardData?.user?.current_title ?? cardData?.user?.title ?? "").toLowerCase();
  const execTitleRe = /\b(ceo|founder|co[\s-]?founder|managing\s+director|managing\s+partner|president|owner|chief\s+\w+\s+officer|cto|cfo|coo|cmo|cpo|chro|cro|cdo|ciso|cio|evp|svp|executive\s+vice\s+president|senior\s+vice\s+president)\b/;
  if (title && execTitleRe.test(title)) return true;

  const years = Number(cardData?.user?.years_experience ?? cardData?.user?.years ?? 0);
  if (Number.isFinite(years) && years >= 18 && /\b(head|director|vp|vice\s+president|chief|lead|principal)\b/.test(title)) {
    return true;
  }

  const d = cardData?.card4_pivot;
  if (!d || typeof d !== "object") return false;
  try {
    const parts: string[] = [
      String(d.current_band ?? ""),
      String(d.pivot_year1 ?? ""),
      String(d.director_band ?? ""),
      ...(Array.isArray(d.pivots) ? d.pivots.map((p: any) => String(p?.salary ?? p?.salary_range ?? "")) : []),
    ];
    return /₹\s*\d+(\.\d+)?\s*Cr/i.test(parts.join(" "));
  } catch {
    return false;
  }
}

// Always-working channels. Spencer Stuart / Egon Zehnder use Google site-search
// because their own search endpoints are broken or empty.
function buildExecChannels(role: string, city: string) {
  const r = encodeURIComponent(role || "Executive");
  const c = encodeURIComponent(city || "India");
  const rc = encodeURIComponent(`${role || "Executive"} ${city || "India"}`);
  return [
    {
      id: "linkedin-people",
      label: "LinkedIn — find people in this role",
      hint: "DM a peer in the role you want. Highest reply rate.",
      bg: "#0A66C2",
      url: `https://www.linkedin.com/search/results/people/?keywords=${rc}`,
    },
    {
      id: "linkedin-jobs",
      label: "LinkedIn — Director/VP openings",
      hint: "Filtered to senior level, posted last 7 days.",
      bg: "#0A66C2",
      url: `https://www.linkedin.com/jobs/search/?keywords=${r}&location=${c}&f_E=6%2C7&f_TPR=r604800&sortBy=DD`,
    },
    {
      id: "heidrick",
      label: "Heidrick & Struggles",
      hint: "Retainer search. Email the India PE practice partner.",
      bg: "#1A2A4A",
      url: `https://www.heidrick.com/en/search?keywords=${r}`,
    },
    {
      id: "egon",
      label: "Egon Zehnder",
      hint: "Top-tier exec search. Use Google to find their India team.",
      bg: "#3B2D5A",
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:egonzehnder.com India ${role}`)}`,
    },
    {
      id: "spencer",
      label: "Spencer Stuart",
      hint: "Board + CEO practice. Find their India MD.",
      bg: "#5A1A2A",
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:spencerstuart.com India ${role}`)}`,
    },
    {
      id: "kornferry",
      label: "Korn Ferry",
      hint: "C-suite + board. Largest India exec footprint.",
      bg: "#7A4A1A",
      url: `https://www.kornferry.com/search-results?q=${r}`,
    },
  ];
}

function buildProChannels(role: string, city: string) {
  const r = encodeURIComponent(role || "Professional");
  const c = encodeURIComponent(city || "India");
  const naukriSlug = (role || "jobs").replace(/[^\w\s]/g, "").trim().toLowerCase().replace(/\s+/g, "-");
  const citySlug = (city || "india").toLowerCase().replace(/\s+/g, "-");
  return [
    {
      id: "linkedin-people",
      label: "LinkedIn — find people in this role",
      hint: "DM 5 people who hold this title at companies you'd join. Ask for 15 min.",
      bg: "#0A66C2",
      url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${role} ${city}`)}`,
    },
    {
      id: "linkedin-jobs",
      label: "LinkedIn — recent openings",
      hint: "Posted last 7 days, sorted newest.",
      bg: "#0A66C2",
      url: `https://www.linkedin.com/jobs/search/?keywords=${r}&location=${c}&f_TPR=r604800&sortBy=DD`,
    },
    {
      id: "naukri",
      label: "Naukri — India listings",
      hint: "Largest India job board for IC + senior roles.",
      bg: "#4A90D9",
      url: `https://www.naukri.com/${naukriSlug}-jobs-in-${citySlug}`,
    },
    {
      id: "instahyre",
      label: "Instahyre — invite-based",
      hint: "Recruiters reach out to you. Higher signal/noise.",
      bg: "#1A6B3C",
      url: `https://www.instahyre.com/search-jobs/?keyword=${r}`,
    },
  ];
}

// Build a personalised outreach DM template. No LLM call — derived from
// existing fields. Safe, deterministic, and copy-paste ready.
function buildOutreachTemplate(opts: { name: string; targetRole: string; pivotFromRole: string; city: string; moatSkill: string; isExec: boolean }) {
  const { name, targetRole, pivotFromRole, city, moatSkill, isExec } = opts;
  const senderLine = name && name !== "there" ? `— ${name}` : "";
  if (isExec) {
    return `Hi {first_name},

Saw your work as ${targetRole}. Currently leading ${pivotFromRole} in ${city}; my track record on ${moatSkill || "scaling outcomes"} maps directly to what your portfolio needs in this AI cycle.

Would 20 min next week make sense? Happy to share a 1-page thesis on where the ${targetRole.toLowerCase()} role is going in India over the next 18 months.

${senderLine}`;
  }
  return `Hi {first_name},

I'm exploring a move from ${pivotFromRole} into ${targetRole} in ${city}. Your path looked closest to what I'm trying to do.

Would you have 15 min for a quick call? I'd love to learn:
1. What surprised you most in your first 90 days as ${targetRole}?
2. What skill/cert moved the needle for you?

${senderLine}`;
}

export default function Card4PivotPaths({ cardData, onBack, onNext, scanId }: { cardData: any; onBack: () => void; onNext: () => void; scanId?: string }) {
  const d = cardData?.card4_pivot ?? {};
  // C1 fix (2026-04-30): rank pivots by match_pct DESC so the strongest fit is
  // always #1. Previously the LLM-emitted order was rendered as-is, which meant
  // a 94% match could appear at position #3 below an 88% match. See sortPivotsByMatch
  // for stable tie-break behavior.
  const pivots: any[] = useMemo(
    () => sortPivotsByMatch(Array.isArray(d.pivots) ? d.pivots : []),
    [d.pivots],
  );
  const [selectedPivot, setSelectedPivot] = useState(0);
  const isExec = useMemo(() => isExecutiveCardData(cardData), [cardData]);
  const safeSelected = pivots.length > 0 ? Math.min(selectedPivot, pivots.length - 1) : 0;
  const selected = pivots[safeSelected] ?? null;

  // Personalisation context (from existing fields — no fabrication)
  const userName = String(cardData?.user?.first_name ?? cardData?.user?.name ?? "there").split(" ")[0];
  const currentRole = String(cardData?.user?.current_title ?? cardData?.user?.title ?? "your current role");
  const currentCity = String(cardData?.user?.city ?? cardData?.user?.metro_tier ?? "India");
  // Best-available moat skill: top strong skill from card3, else first card3 skill, else generic
  const card3Skills: any[] = Array.isArray(cardData?.card3_shield?.skills) ? cardData.card3_shield.skills : [];
  const moatSkill = String(
    card3Skills.find((s: any) => s.level === "best-in-class" || s.level === "strong")?.name
    ?? card3Skills[0]?.name
    ?? "your strategic experience"
  );

  const selectedRole = String(selected?.role ?? "the target role");
  const selectedCity = (String(selected?.location ?? currentCity).split(",")[0] || currentCity).trim();
  const channels = isExec ? buildExecChannels(selectedRole, selectedCity) : buildProChannels(selectedRole, selectedCity);

  // Salary math — deterministic, derived from already-shown bands.
  // GATE: only render the personal-₹ math + opportunity-cost block when the user
  // actually typed a CTC during onboarding. Without that anchor, every figure is
  // a role-tier guess and showing them as "your delta" is the exact hallucination
  // we shipped C2.1 to kill. Source of truth: salary_provenance.has_user_ctc,
  // stamped server-side in get-model-b-analysis.
  const salaryProv = (cardData?.salary_provenance ?? {}) as { has_user_ctc?: boolean; annual_lakhs?: number | null };
  const hasUserCTC = salaryProv.has_user_ctc === true;
  const currentLakhs = parseInrBandToLakhs(d.current_band);
  const year1Lakhs = parseInrBandToLakhs(selected?.salary_range || selected?.salary || d.pivot_year1);
  const year3Lakhs = parseInrBandToLakhs(d.director_band);
  const year1Delta = currentLakhs != null && year1Lakhs != null ? year1Lakhs - currentLakhs : null;
  const stayCost3yr = currentLakhs != null && year3Lakhs != null
    ? Math.max(0, (year3Lakhs - currentLakhs) * 3 - (year1Delta ?? 0)) // opportunity cost of NOT pivoting over 3 years
    : null;

  // Real cohort intelligence (already cached for this scan)
  const { data: cohort } = useCohortIntel(scanId);

  const outreach = buildOutreachTemplate({
    name: userName,
    targetRole: selectedRole,
    pivotFromRole: currentRole,
    city: selectedCity,
    moatSkill,
    isExec,
  });

  const copyOutreach = async () => {
    try {
      await navigator.clipboard.writeText(outreach);
      toast.success("Outreach DM copied", { description: "Replace {first_name}, paste in LinkedIn." });
    } catch {
      toast.error("Couldn't copy — long-press to select the text below.");
    }
  };

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="04 · Action" variant="navy" />{isExec ? <Badge label="Executive Mode" variant="green" /> : <Badge label="Matched to your resume" variant="navy" />}</>}
        title={d.headline}
        sub={d.subline}
      />
      <CardBody>
        {/* Job vs Business teaser — sticky top of Pivot tab */}
        <JobVsBusinessCard scanId={scanId} />

        {/* ── Emotional triggers (unchanged structure) ─────────────────────── */}
        {d.fear_hook && (
          <div style={{ background: "var(--mb-amber-tint)", border: "2px solid rgba(139,90,0,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-amber)", lineHeight: 1.7, margin: 0 }}>⏳ {d.fear_hook}</p>
          </div>
        )}
        {d.tough_love && (
          <div style={{ borderLeft: "3px solid var(--mb-amber)", background: "transparent", padding: "10px 14px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink2)", fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>{d.tough_love}</p>
          </div>
        )}
        {d.confrontation && (
          <div style={{ borderLeft: "4px solid var(--mb-navy)", background: "linear-gradient(90deg, var(--mb-navy-tint), transparent)", borderRadius: "0 12px 12px 0", padding: "12px 16px", marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.6, margin: 0 }}>⚔️ {d.confrontation}</p>
          </div>
        )}
        {d.hope_bridge && (
          <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-green)", lineHeight: 1.6, margin: 0 }}>🚀 {d.hope_bridge}</p>
          </div>
        )}

        {/* ── Salary arc (unchanged — it's already strong) ─────────────────── */}
        <div style={{ display: "flex", background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
          {[
            { val: d.current_band, label: "Current band · India", color: "var(--mb-ink2)", bg: "var(--mb-paper)" },
            { val: d.pivot_year1, label: "Pivot target · Year 1", color: "var(--mb-navy)", bg: "var(--mb-navy-tint)" },
            { val: d.director_band, label: "Director / VP · Year 2–3", color: "var(--mb-green)", bg: "var(--mb-green-tint)" },
          ].map((s, i) => (
            <div key={i} style={{ display: "contents" }}>
              {i > 0 && <div style={{ display: "flex", alignItems: "center", flexShrink: 0, padding: "0 6px", color: "var(--mb-ink3)", fontSize: 16, fontWeight: 800 }}>→</div>}
              <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", background: s.bg }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "var(--mb-ink2)", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Pivot picker — collapsed strip (selected one expands below) ──── */}
        {pivots.length === 0 && (
          <div style={{ padding: "16px 18px", border: "1.5px dashed var(--mb-rule)", borderRadius: 14, marginBottom: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", textAlign: "center" }}>
            Pivot suggestions are being prepared. Refresh in a moment.
          </div>
        )}
        {pivots.length > 0 && (
          <>
            <SectionLabel label={`CHOOSE YOUR ROUTE · ${pivots.length} viable pivots ranked for ${userName}`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {pivots.map((p: any, i: number) => {
                const sel = safeSelected === i;
                const role = String(p?.role ?? "Role");
                const color = p?.color ?? "navy";
                const accent = variantColor(color);
                const matchPctRaw = Number(p?.match_pct);
                const matchPct = Number.isFinite(matchPctRaw) ? Math.max(0, Math.min(100, matchPctRaw)) : 0;
                const rawSalary = p?.salary_range || p?.salary || "—";
                // Pivot Coherence Pass — Bug 3 fix (2026-04-30):
                // When user did NOT enter CTC, the band on the pivot row is a
                // role-tier estimate from the LLM, not anchored to the user's
                // actual numbers. Stamp [ESTIMATED] so the chip cannot be misread
                // as "this is your delta". The expanded math card below is already
                // gated on hasUserCTC; this is the matching honesty for the chip.
                const hasEstTag = typeof rawSalary === "string" && /\[\s*estimated\s*\]/i.test(rawSalary);
                const salaryDisplay = (!hasUserCTC && rawSalary !== "—" && !hasEstTag)
                  ? `${rawSalary} [ESTIMATED]`
                  : rawSalary;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPivot(i)}
                    aria-pressed={sel}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `2px solid ${sel ? accent : "var(--mb-rule)"}`,
                      background: sel ? "white" : "var(--mb-paper)",
                      cursor: "pointer",
                      boxShadow: sel ? `0 4px 14px ${accent}33` : "none",
                      transition: "all 150ms",
                      minHeight: 56,
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: sel ? accent : "var(--mb-rule)", color: sel ? "white" : "var(--mb-ink3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 800 }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.3 }}>{role}</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", marginTop: 2, fontWeight: 600 }}>{salaryDisplay}{p?.location ? ` · ${p.location}` : ""}</div>
                      {/* Pass C1 (#7) — citation basis chip. Tells the user WHY this
                          pivot was deemed eligible. Hidden when basis is unknown. */}
                      {p?.citation_basis?.family_match === 'kg_family_match' && (
                        <div style={{ marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: "var(--mb-green)", letterSpacing: "0.04em" }}>
                          ✓ KG family match{p?.citation_basis?.market_health_grounded ? " · market signal grounded" : ""}
                        </div>
                      )}
                      {p?.citation_basis?.family_match === 'cross_family_inferred' && (
                        <div style={{ marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: "var(--mb-ink3)", letterSpacing: "0.04em" }}>
                          cross-family pivot · inferred fit
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 800, color: accent }}>{matchPct}%</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--mb-ink3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>match</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── DOSSIER — the selected pivot expanded ────────────────────────── */}
        {selected && (() => {
          const accent = variantColor(selected?.color ?? "navy");
          const pivotExplanation = Array.isArray(d.pivot_explanations) ? d.pivot_explanations[safeSelected] : null;
          const ninetyDay: Array<{ window: string; action: string; tag: string }> = [
            { window: "Days 1–30", action: pivotExplanation?.body?.split(".")[0] || `Get 5 informational calls with current ${selectedRole}s. Update LinkedIn headline to position toward this move.`, tag: "Recon" },
            { window: "Days 31–60", action: `Ship one public artifact that proves ${moatSkill} → ${selectedRole}. Long-form post, deck, or case study.`, tag: "Signal" },
            { window: "Days 61–90", action: `Apply to 3 roles + warm-intro to 2 ${isExec ? "search firm partners" : "hiring managers"}. Use the negotiation anchors below.`, tag: "Convert" },
          ];

          return (
            <div style={{ background: "linear-gradient(180deg, white 0%, var(--mb-paper) 100%)", border: `2px solid ${accent}`, borderRadius: 16, padding: 0, marginBottom: 18, overflow: "hidden", boxShadow: `0 6px 22px ${accent}1A` }}>
              {/* Dossier header */}
              <div style={{ padding: "16px 20px 12px", borderBottom: `1.5px dashed ${accent}55`, background: `${accent}0D` }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: accent, marginBottom: 6 }}>
                  Pivot Dossier · prepared for {userName}
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.25 }}>{selectedRole}</div>
                {selected?.fomo_signal && (
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-amber)", marginTop: 6 }}>⚡ {selected.fomo_signal}</div>
                )}
              </div>

              {/* Why this fits YOU */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mb-rule)" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                  Why this fits you
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.6, fontWeight: 500, margin: 0 }}>
                  Your <strong style={{ color: accent }}>{moatSkill}</strong> is the bridge from <strong>{currentRole}</strong> to <strong>{selectedRole}</strong>.
                  {pivotExplanation?.body ? ` ${pivotExplanation.body}` : ""}
                </p>
              </div>

              {/* Peer Cohort Mirror — real signal from cohort_cache */}
              {cohort && cohort.cohort_size >= 5 && (
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mb-rule)", background: "var(--mb-paper)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      People like you
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: `${accent}1A`, color: accent, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      n={cohort.cohort_size}
                    </span>
                  </div>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "var(--mb-ink)", lineHeight: 1.55, fontWeight: 600, margin: "0 0 10px", fontStyle: "italic" }}>
                    "{cohort.insight_text}"
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                    {cohort.pct_improved != null && (
                      <div style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, color: "var(--mb-green)" }}>{Math.round(cohort.pct_improved)}%</div>
                        <div style={{ fontSize: 10, color: "var(--mb-ink2)", fontWeight: 700, marginTop: 2 }}>improved score</div>
                      </div>
                    )}
                    {cohort.median_doom_months != null && (
                      <div style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, color: "var(--mb-amber)" }}>{Math.round(cohort.median_doom_months)}mo</div>
                        <div style={{ fontSize: 10, color: "var(--mb-ink2)", fontWeight: 700, marginTop: 2 }}>median runway</div>
                      </div>
                    )}
                    {cohort.top_skill_gain && (
                      <div style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: accent, lineHeight: 1.2 }}>{cohort.top_skill_gain}</div>
                        <div style={{ fontSize: 10, color: "var(--mb-ink2)", fontWeight: 700, marginTop: 2 }}>top skill gained</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Salary Math — concrete rupees, not bands.
                  GATED: only render when user actually entered CTC. Otherwise
                  show a soft prompt and band-only context (no fake delta). */}
              {hasUserCTC && currentLakhs != null && year1Lakhs != null ? (
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mb-rule)", background: `${accent}06` }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                    💸 The math, in your rupees
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "var(--mb-ink3)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Today</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 800, color: "var(--mb-ink2)", marginTop: 4 }}>{formatLakhs(currentLakhs)}</div>
                      <div style={{ fontSize: 11, color: "var(--mb-ink3)", marginTop: 2 }}>{currentRole}</div>
                    </div>
                    <div style={{ background: "white", border: `1.5px solid ${accent}`, borderRadius: 10, padding: "10px 12px", boxShadow: `0 2px 8px ${accent}22` }}>
                      <div style={{ fontSize: 10, color: accent, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Year 1 if you land this</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 800, color: accent, marginTop: 4 }}>{formatLakhs(year1Lakhs)}</div>
                      <div style={{ fontSize: 11, color: "var(--mb-ink2)", marginTop: 2 }}>
                        {year1Delta != null && year1Delta > 0 ? `+${formatLakhs(year1Delta)} delta` : year1Delta != null && year1Delta < 0 ? `${formatLakhs(year1Delta)} (long-term play)` : "Lateral move"}
                      </div>
                    </div>
                  </div>
                  {stayCost3yr != null && stayCost3yr > 5 && (
                    <div style={{ background: "var(--mb-amber-tint)", border: "1.5px solid rgba(139,90,0,0.25)", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--mb-amber)", lineHeight: 1.55 }}>
                        ⚠️ Opportunity cost of staying put 3 years: <strong style={{ fontFamily: "'DM Mono', monospace" }}>~{formatLakhs(stayCost3yr)}</strong> in foregone earnings.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No-CTC mode — band-only honest framing. No fabricated delta. */
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mb-rule)", background: "var(--mb-paper)" }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                    📊 Role-tier salary bands · India
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "var(--mb-ink3)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Current role band</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, color: "var(--mb-ink2)", marginTop: 4 }}>{d.current_band || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--mb-ink3)", marginTop: 2 }}>tier estimate</div>
                    </div>
                    <div style={{ background: "white", border: `1.5px solid ${accent}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: accent, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Pivot target band</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 800, color: accent, marginTop: 4 }}>{selected?.salary_range || selected?.salary || d.pivot_year1 || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--mb-ink2)", marginTop: 2 }}>tier estimate</div>
                    </div>
                  </div>
                  <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid var(--mb-navy-tint2)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-navy)", lineHeight: 1.55, fontWeight: 600 }}>
                      💡 Bands above are role-tier estimates, not your personal numbers. Add your CTC on a re-scan to see the exact ₹ delta and 3-year opportunity cost.
                    </div>
                  </div>
                </div>
              )}

              {/* This week — first move */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mb-rule)", background: `${accent}08` }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                  🎯 This week — your first move
                </div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "var(--mb-ink)", lineHeight: 1.5, fontWeight: 700, margin: "0 0 10px" }}>
                  {isExec
                    ? `Email two India partners at Heidrick or Egon Zehnder this week. Subject: "${selectedRole} — exploring next chapter."`
                    : `Send the DM template below to 5 ${selectedRole}s on LinkedIn. Aim for 2 calls this week.`}
                </p>
                <button
                  type="button"
                  onClick={copyOutreach}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: "white", background: accent, border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", minHeight: 40 }}
                >
                  📋 Copy outreach DM
                </button>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: accent, fontWeight: 700, cursor: "pointer" }}>Preview the message →</summary>
                  <pre style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--mb-ink2)", background: "white", border: "1px solid var(--mb-rule)", borderRadius: 8, padding: 12, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{outreach}</pre>
                </details>
              </div>

              {/* 30/60/90 plan */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mb-rule)" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  90-day pivot plan
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ninetyDay.map((step, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 12, alignItems: "start", padding: "10px 12px", background: "white", border: "1px solid var(--mb-rule)", borderRadius: 10 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 800, color: accent, whiteSpace: "nowrap" }}>{step.window}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: `${accent}1A`, color: accent, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap", alignSelf: "center" }}>{step.tag}</span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink)", lineHeight: 1.55, fontWeight: 500 }}>{step.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Channels — verified working URLs */}
              <div style={{ padding: "14px 20px" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-ink3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Where to find {selectedRole}s · {selectedCity}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {channels.map((ch) => (
                    <a
                      key={ch.id}
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", padding: "10px 14px", background: "white", border: "1px solid var(--mb-rule)", borderLeft: `4px solid ${ch.bg}`, borderRadius: 10, textDecoration: "none", minHeight: 48, transition: "transform 120ms" }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(2px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0)")}
                    >
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: ch.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 14, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>↗</span>
                      <span>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.3 }}>{ch.label}</div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink2)", marginTop: 2, lineHeight: 1.4 }}>{ch.hint}</div>
                      </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: ch.bg, fontWeight: 800 }}>OPEN →</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Negotiation anchor (unchanged — already strong) ──────────────── */}
        <div style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <SectionLabel label="💰 Personalised salary negotiation anchor" />
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.7, marginBottom: 14, fontWeight: 500 }}>{d.negotiation?.intro}</div>
          {d.negotiation?.pivot_phrase && (
            <div style={{ background: "var(--mb-navy-tint)", border: "1.5px solid var(--mb-navy-tint2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "var(--mb-navy)", margin: 0, fontStyle: "italic" }}>💬 "{d.negotiation.pivot_phrase}"</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(() => {
            // Fix C (Audit 2026-04-30): when the LLM emits identical values
            // across all 4 anchor fields (happens when no user CTC is anchored),
            // collapse to a single tile + disclaimer instead of repeating the
            // same number 4 times.
            const anchors = [
              { val: d.negotiation?.walk_away, label: "Walk away", color: "var(--mb-red)", highlight: false },
              { val: d.negotiation?.accept, label: "Accept", color: "var(--mb-amber)", highlight: false },
              { val: d.negotiation?.open_with, label: "Open with", color: "var(--mb-green)", highlight: true },
              { val: d.negotiation?.best_case, label: "Best case", color: "var(--mb-navy)", highlight: false },
            ];
            const norm = (v: any) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
            const present = anchors.filter((a) => norm(a.val).length > 0);

            // Salary-anchor sanity guard: a valid anchor is a short numeric
            // range like "₹24L" or "₹26-32L". When the LLM emits prose
            // instead (e.g. "Compensation signals are mixed..."), we drop
            // the tile so prose isn't rendered as a number in monospace.
            const looksNumeric = (v: any): boolean => {
              const s = String(v ?? "").trim();
              if (s.length === 0) return false;
              if (s.length > 25) return false; // prose is always longer than this
              return /[\d₹$€£]/.test(s);        // must contain a digit or currency symbol
            };
            const numericAnchors = present.filter((a) => looksNumeric(a.val));

            if (numericAnchors.length === 0) {
              return (
                <div style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 12, padding: "14px 16px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.55, fontStyle: "italic", flex: 1 }}>
                  Personalised anchors are unavailable for this scan. Add your current CTC and run again to unlock walk-away / accept / open / best-case figures.
                </div>
              );
            }

            const distinctVals = new Set(numericAnchors.map((a) => norm(a.val)));
            const allIdentical = numericAnchors.length >= 2 && distinctVals.size === 1;

            if (allIdentical) {
              return (
                <div>
                  <div style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, fontWeight: 800, color: "var(--mb-navy)" }}>{numericAnchors[0].val}</div>
                    <div style={{ fontSize: 11, color: "var(--mb-ink2)", fontWeight: 700, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>Estimated range</div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--mb-ink2)", fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>
                    Add your current CTC during onboarding to unlock walk-away / accept / open / best-case anchors personalised to your number.
                  </div>
                </div>
              );
            }

            // Dedupe identical values while preserving order so users never see
            // two adjacent tiles with the same number.
            const seen = new Set<string>();
            const deduped = numericAnchors.filter((a) => {
              const k = norm(a.val);
              if (!k) return true; // empty values still render as placeholders
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });

            return deduped.map((a, i) => (
              <div key={i} style={{ flex: 1, background: a.highlight ? "var(--mb-green-tint)" : "white", border: `1.5px solid ${a.highlight ? "rgba(26,107,60,0.35)" : "var(--mb-rule)"}`, borderRadius: 12, padding: "12px 10px", textAlign: "center", minWidth: 70 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, fontWeight: 800, color: a.color }}>{a.val}</div>
                <div style={{ fontSize: 11, color: "var(--mb-ink2)", fontWeight: 700, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{a.label}</div>
              </div>
            ));
          })()}
          </div>
        </div>

        {d.community_quote && (
          <div style={{ borderLeft: "3px solid var(--mb-navy)", borderRadius: "0 10px 10px 0", padding: "14px 18px", background: "var(--mb-navy-tint)", marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "var(--mb-ink)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 6, fontWeight: 500 }}>{d.community_quote}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", fontWeight: 700 }}>{d.community_quote_source}</div>
          </div>
        )}

        <CardNav onBack={onBack} onNext={onNext} />
      </CardBody>
    </CardShell>
  );
}
