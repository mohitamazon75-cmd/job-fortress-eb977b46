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

export default function Card5JobsTracker({ cardData, onBack, onNext }: { cardData: any; onBack: () => void; onNext: () => void }) {
  const d = cardData.card5_jobs;
  const [modal, setModal] = useState<{ title: string; promptText: string } | null>(null);
  const { state: kanban, addItem } = useKanban();

  const logEvent = async (eventType: string, metadata?: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.functions.invoke("log-ab-event", { body: { user_id: user?.id, event_type: eventType, metadata } });
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {[
            { val: d?.active_count, label: "Active openings", color: "var(--mb-green)" },
            { val: d?.senior_count, label: "Senior roles", color: "var(--mb-navy)" },
            { val: d?.strong_match_count, label: "Strong matches", color: "var(--mb-teal)" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: s.color, marginBottom: 3 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "var(--mb-ink3)", fontFamily: "'DM Sans', sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Job cards */}
        {jobs.map((job: any, i: number) => {
          const mc = matchColors[job.match_color] || matchColors.navy;
          return (
            <div key={i} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 12, padding: 15, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--mb-ink)" }}>{job.role}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: mc.bg, color: mc.color, border: `1px solid ${mc.border}`, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>{job.match_label}</span>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", marginBottom: 6 }}>{job.company} · {job.location}</div>
              {job.company_context && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", marginBottom: 6 }}>{job.company_context}</div>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {(job.tags || []).map((t: string, j: number) => (
                  <span key={j} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 20, background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", color: "var(--mb-ink3)", fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "var(--mb-ink)" }}>{job.salary}</span>
                <button
                  onClick={() => {
                    logEvent("apply_clicked", { job_company: job.company, job_role: job.role });
                    setModal({
                      title: `Cover Letter — ${job.role} at ${job.company}`,
                      promptText: `Write a tailored cover letter for ${cardData.user?.name} applying to ${job.role} at ${job.company} (${job.location}).\n\nEvidence to lead with:\n${job.apply_evidence}\n\nRules:\n- Open with one extraordinary number from their evidence — NOT 'I am writing to apply'\n- Maximum 220 words\n- Every sentence must reference either their evidence OR ${job.company} specifically\n- Include a suggested email subject line at the top\n- Confident, direct tone — not apologetic`,
                    });
                  }}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, padding: "7px 14px", borderRadius: 8, background: "var(--mb-navy)", color: "white", border: "none", cursor: "pointer" }}
                >Apply tailored →</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--mb-green)", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--mb-green)" }} />
                Posted {job.days_posted} days ago · {job.applicant_count} applicants
                {job.is_urgent && <span style={{ fontSize: 9, fontWeight: 600, background: "var(--mb-red-tint)", color: "var(--mb-red)", padding: "2px 7px", borderRadius: 10, marginLeft: 4, border: "1px solid rgba(174,40,40,0.2)" }}>Urgent</span>}
              </div>
            </div>
          );
        })}

        {/* Referral box */}
        <div style={{ background: "var(--mb-teal-tint)", border: "1px solid rgba(14,102,85,0.2)", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--mb-teal)", marginBottom: 4 }}>Referral finder — 3× your callback rate</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", lineHeight: 1.65 }}>
            For each company above, search LinkedIn for 2nd-degree connections who work there. Message: 'I'm applying for [role] at [company] — would you be open to a 10-minute call about the team?' Referrals in India triple interview callback rates.
          </div>
          <button
            onClick={() => setModal({
              title: "Referral Outreach — 5 Companies",
              promptText: `Write 5 personalised LinkedIn outreach messages for ${cardData.user?.name} to warm connections at: ${jobs.map((j: any) => `${j.company} (${j.location})`).join(", ")}\n\nFor each message:\n- Under 90 words — brevity gets replies\n- Do NOT ask for a referral in the first message\n- Ask for a 10-minute call about the team\n- Reference something specific about that company showing genuine research\n- Mention ONE credential from their profile relevant to that company\n- Confident, curious, direct tone — not desperate`,
            })}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, background: "white", border: "1px solid rgba(14,102,85,0.3)", borderRadius: 20, padding: "6px 12px", marginTop: 9, color: "var(--mb-teal)", cursor: "pointer" }}
          >Generate referral outreach →</button>
        </div>

        {/* Kanban */}
        <SectionLabel label="Application pipeline tracker" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 7, marginBottom: 14 }}>
          {cols.map((col) => (
            <div key={col.key} style={{ background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 10, padding: 9, minHeight: 72 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--mb-ink3)", marginBottom: 7, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 15, height: 15, borderRadius: "50%", background: col.color, color: "white", fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{kanban[col.key].length}</span>
                {col.label}
              </div>
              {kanban[col.key].map((item, j) => (
                <div key={j} style={{ background: "white", borderRadius: 6, padding: "6px 8px", marginBottom: 5, fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--mb-ink)", fontWeight: 500, border: "1px solid var(--mb-rule)" }}>{item}</div>
              ))}
              <div
                onClick={() => { const name = window.prompt("Enter company + role (e.g. Freshworks · Head of Demand Gen)"); if (name) addItem(col.key, name); }}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--mb-ink4)", cursor: "pointer", textAlign: "center", padding: 5, border: "1px dashed var(--mb-rule2)", borderRadius: 6 }}
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
