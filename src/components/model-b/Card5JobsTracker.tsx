import { useState, useEffect } from "react";
import { CardShell, CardHead, CardBody, EmotionStrip, SectionLabel, CardNav, Badge, LivePill } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";
import PromptModal from "./PromptModal";

const KANBAN_KEY = "jb_kanban";
type KanbanState = { saved: string[]; applied: string[]; interview: string[]; offer: string[] };
const emptyKanban: KanbanState = { saved: [], applied: [], interview: [], offer: [] };

function useKanban() {
  const [state, setState] = useState<KanbanState>(() => {
    try { return JSON.parse(localStorage.getItem(KANBAN_KEY) || "") || emptyKanban; } catch { return emptyKanban; }
  });
  useEffect(() => { localStorage.setItem(KANBAN_KEY, JSON.stringify(state)); }, [state]);
  const addItem = (col: keyof KanbanState, item: string) => setState(p => ({ ...p, [col]: [...p[col], item] }));
  return { state, addItem };
}

/** Build a live job search URL for Naukri/LinkedIn */
function buildJobSearchUrl(role: string, company: string, location: string, platform: "naukri" | "linkedin"): string {
  const query = `${role} ${company}`.trim();
  const city = (location || "all-india").split(",")[0].trim().toLowerCase().replace(/\s+/g, "-");
  if (platform === "naukri") {
    return `https://www.naukri.com/jobs-in-${city}?k=${encodeURIComponent(query).replace(/%20/g, "+")}`;
  }
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&f_TPR=r604800`;
}

export default function Card5JobsTracker({ cardData, onBack, onNext, analysisId }: { cardData: any; onBack: () => void; onNext: () => void; analysisId?: string | null }) {
  const d = cardData.card5_jobs;
  const [modal, setModal] = useState<{ title: string; promptText: string } | null>(null);
  const { state: kanban, addItem } = useKanban();

  const logEvent = async (eventType: string, metadata?: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.functions.invoke("log-ab-event", { body: { analysis_id: analysisId, user_id: user?.id, event_type: eventType, metadata } });
    } catch {}
  };

  const jobs = (d?.job_matches || []).slice(0, 5);

  const matchColors: Record<string, { bg: string; color: string; border: string }> = {
    green: { bg: "var(--mb-green-tint)", color: "var(--mb-green)", border: "rgba(26,107,60,0.2)" },
    navy: { bg: "var(--mb-navy-tint)", color: "var(--mb-navy)", border: "var(--mb-navy-tint2)" },
    amber: { bg: "var(--mb-amber-tint)", color: "var(--mb-amber)", border: "rgba(139,90,0,0.2)" },
  };

  const cols: { key: keyof KanbanState; label: string; color: string }[] = [
    { key: "saved", label: "Saved", color: "#999" },
    { key: "applied", label: "Applied", color: "var(--mb-navy)" },
    { key: "interview", label: "Interview", color: "var(--mb-amber)" },
    { key: "offer", label: "Offer", color: "var(--mb-green)" },
  ];

  return (
    <CardShell>
      <CardHead badges={<><Badge label="05 · Opportunity" variant="green" /><LivePill /></>} title={d?.headline || ""} sub={d?.subline || ""} />
      <CardBody>
        <EmotionStrip bgColor="var(--mb-green-tint)" borderColor="rgba(26,107,60,0.15)" icon="🔥" textColor="var(--mb-green)" message={d?.emotion_message || ""} />

        {/* Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { val: d?.active_count, label: "Active openings", color: "var(--mb-green)" },
            { val: d?.senior_count, label: "Senior roles", color: "var(--mb-navy)" },
            { val: d?.strong_match_count, label: "Strong matches", color: "var(--mb-teal)" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, padding: 14, boxShadow: "var(--mb-shadow-sm)" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.val}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--mb-ink3)", fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Job cards */}
        {jobs.map((job: any, i: number) => {
          const mc = matchColors[job.match_color] || matchColors.navy;
          const naukriUrl = buildJobSearchUrl(job.role, job.company, job.location, "naukri");
          const linkedinUrl = buildJobSearchUrl(job.role, job.company, job.location, "linkedin");
          return (
            <div key={i} style={{ background: "white", border: "1px solid var(--mb-rule)", borderRadius: 14, padding: 18, marginBottom: 12, boxShadow: "var(--mb-shadow-sm)", transition: "box-shadow 0.2s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "var(--mb-ink)", lineHeight: 1.3 }}>{job.role}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: mc.bg, color: mc.color, border: `1px solid ${mc.border}`, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>{job.match_label}</span>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--mb-ink2)", marginBottom: 4 }}>{job.company}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", marginBottom: 8 }}>{job.location}</div>
              {job.company_context && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", marginBottom: 8, lineHeight: 1.6, fontStyle: "italic" }}>{job.company_context}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {(job.tags || []).map((t: string, j: number) => (
                  <span key={j} style={{ fontSize: 11, padding: "4px 11px", borderRadius: 20, background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", color: "var(--mb-ink3)", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: "var(--mb-ink)" }}>{job.salary}</span>
                <button
                  className="mb-btn-primary"
                  onClick={() => {
                    logEvent("apply_clicked", { job_company: job.company, job_role: job.role });
                    setModal({
                      title: `Cover Letter — ${job.role} at ${job.company}`,
                      promptText: `Write a tailored cover letter for ${cardData.user?.name} applying to ${job.role} at ${job.company} (${job.location}).\n\nEvidence to lead with:\n${job.apply_evidence}\n\nRules:\n- Open with one extraordinary number from their evidence — NOT 'I am writing to apply'\n- Maximum 220 words\n- Every sentence must reference either their evidence OR ${job.company} specifically\n- Include a suggested email subject line at the top\n- Confident, direct tone — not apologetic`,
                    });
                  }}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, padding: "9px 16px", borderRadius: 10, background: "var(--mb-navy)", color: "white", border: "none", cursor: "pointer", minHeight: 44, boxShadow: "0 2px 8px rgba(27,47,85,0.2)", transition: "all 150ms" }}
                >Apply tailored →</button>
              </div>

              {/* Live job links */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <a
                  href={naukriUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logEvent("job_link_clicked", { platform: "naukri", job_company: job.company, job_role: job.role })}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 8, background: "#4A90D9", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 36, transition: "filter 150ms" }}
                >
                  🔍 Search on Naukri
                </a>
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logEvent("job_link_clicked", { platform: "linkedin", job_company: job.company, job_role: job.role })}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 8, background: "#0A66C2", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 36, transition: "filter 150ms" }}
                >
                  💼 Search on LinkedIn
                </a>
                <button
                  onClick={() => { addItem("saved", `${job.company} · ${job.role}`); }}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 8, background: "var(--mb-paper)", color: "var(--mb-ink3)", border: "1px solid var(--mb-rule)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 36 }}
                >
                  ⭐ Save
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--mb-green)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--mb-green)" }} />
                Posted {job.days_posted} days ago · {job.applicant_count} applicants
                {job.is_urgent && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--mb-red-tint)", color: "var(--mb-red)", padding: "3px 9px", borderRadius: 10, marginLeft: 4, border: "1px solid rgba(174,40,40,0.2)" }}>Urgent</span>}
              </div>
            </div>
          );
        })}

        {/* Referral box */}
        <div style={{ background: "var(--mb-teal-tint)", border: "1px solid rgba(14,102,85,0.2)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-teal)", marginBottom: 6 }}>Referral finder — 3× your callback rate</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink3)", lineHeight: 1.7 }}>
            For each company above, search LinkedIn for 2nd-degree connections who work there. Referrals in India triple interview callback rates.
          </div>
          <button
            className="mb-btn-secondary"
            onClick={() => setModal({
              title: "Referral Outreach — 5 Companies",
              promptText: `Write 5 personalised LinkedIn outreach messages for ${cardData.user?.name} to warm connections at: ${jobs.map((j: any) => `${j.company} (${j.location})`).join(", ")}\n\nFor each message:\n- Under 90 words — brevity gets replies\n- Do NOT ask for a referral in the first message\n- Ask for a 10-minute call about the team\n- Reference something specific about that company showing genuine research\n- Mention ONE credential from their profile relevant to that company\n- Confident, curious, direct tone — not desperate`,
            })}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, background: "white", border: "1px solid rgba(14,102,85,0.3)", borderRadius: 10, padding: "8px 16px", marginTop: 10, color: "var(--mb-teal)", cursor: "pointer", minHeight: 44, transition: "all 150ms" }}
          >Generate referral outreach →</button>
        </div>

        {/* Kanban */}
        <SectionLabel label="Application pipeline tracker" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
          {cols.map((col) => (
            <div key={col.key} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, padding: 10, minHeight: 80 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mb-ink3)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: col.color, color: "white", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{kanban[col.key].length}</span>
                {col.label}
              </div>
              {kanban[col.key].map((item, j) => (
                <div key={j} style={{ background: "white", borderRadius: 8, padding: "7px 9px", marginBottom: 5, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink)", fontWeight: 600, border: "1px solid var(--mb-rule)" }}>{item}</div>
              ))}
              <div
                onClick={() => { const name = window.prompt("Enter company + role (e.g. Freshworks · Head of Demand Gen)"); if (name) addItem(col.key, name); }}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--mb-ink4)", cursor: "pointer", textAlign: "center", padding: 6, border: "1px dashed var(--mb-rule2)", borderRadius: 8, fontWeight: 600 }}
              >+</div>
            </div>
          ))}
        </div>

        <CardNav onBack={onBack} onNext={onNext} nextLabel="See blind spots →" />
      </CardBody>

      {modal && <PromptModal isOpen={true} onClose={() => setModal(null)} title={modal.title} promptText={modal.promptText} />}
    </CardShell>
  );
}
