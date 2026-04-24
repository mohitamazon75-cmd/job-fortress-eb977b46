import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CardShell, CardHead, CardBody, CardNav, Badge, LivePill, SectionLabel } from "./SharedUI";
import { supabase } from "@/integrations/supabase/client";
import PromptModal from "./PromptModal";
import { buildBoardLinks, formatLiveTimestamp, getMatchTone, normalizeCity, detectExecutive, EXECUTIVE_SEARCH_FIRMS, classifyJobUrl } from "@/lib/jobsTab";

const KANBAN_KEY = "jb_kanban";
type KanbanState = { saved: string[]; applied: string[]; interview: string[]; offer: string[] };
const emptyKanban: KanbanState = { saved: [], applied: [], interview: [], offer: [] };

function useKanban() {
  const [state, setState] = useState<KanbanState>(() => {
    try {
      return JSON.parse(localStorage.getItem(KANBAN_KEY) || "") || emptyKanban;
    } catch {
      return emptyKanban;
    }
  });

  const addItem = (col: keyof KanbanState, item: string) => {
    setState((prev) => {
      const next = { ...prev, [col]: [...prev[col], item] };
      localStorage.setItem(KANBAN_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { state, addItem };
}

export default function Card5JobsTracker({ cardData, onBack, onNext, analysisId }: { cardData: any; onBack: () => void; onNext: () => void; analysisId?: string | null }) {
  const d = cardData?.card5_jobs ?? {};
  const [modal, setModal] = useState<{ title: string; promptText: string } | null>(null);
  const [forceRefresh, setForceRefresh] = useState(0);
  const { state: kanban, addItem } = useKanban();

  const role = String(cardData?.user?.current_title || cardData?.user?.title || "").trim();
  const city = String(cardData?.user?.location || cardData?.user?.city || "India").trim();
  const skills = useMemo(
    () => (Array.isArray(cardData?.card3_shield?.skills) ? cardData.card3_shield.skills.map((s: any) => s?.name).filter(Boolean).slice(0, 5) : []),
    [cardData],
  );
  const isExec = useMemo(() => detectExecutive(role), [role]);

  const logEvent = async (eventType: string, metadata?: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.functions.invoke("log-ab-event", { body: { analysis_id: analysisId, user_id: user?.id, event_type: eventType, metadata } });
    } catch {}
  };

  const liveJobsQuery = useQuery({
    queryKey: ["apify-naukri-jobs", role, city, skills.join("|"), forceRefresh],
    enabled: Boolean(role),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("apify-naukri-jobs", {
        body: {
          role,
          city,
          skills,
          experience: String(cardData?.user?.years_experience || ""),
          is_executive: isExec,
          force_refresh: forceRefresh > 0,
        },
      });
      if (error) throw error;
      return data as any;
    },
  });

  const liveJobs = Array.isArray(liveJobsQuery.data?.jobs) ? liveJobsQuery.data.jobs : [];
  const execRoute = Boolean(liveJobsQuery.data?.executive_route);
  const jobs = liveJobs.length > 0 ? liveJobs.slice(0, 6) : !execRoute && Array.isArray(d?.job_matches) ? d.job_matches.slice(0, 5) : [];
  const searchLinks = buildBoardLinks(role || jobs[0]?.role || "jobs", city, liveJobsQuery.data?.search_urls);
  // Count how many cards resolve to a generic search/listing page (vs a specific posting)
  // so we can show one honest disclaimer above the list instead of leaving the user to infer it.
  const genericCount = useMemo(
    () => jobs.filter((j: any) => classifyJobUrl(j.url || j.search_url).kind === "generic").length,
    [jobs],
  );
  const handleRefresh = () => { setForceRefresh((n) => n + 1); };

  const cols: { key: keyof KanbanState; label: string }[] = [
    { key: "saved", label: "Saved" },
    { key: "applied", label: "Applied" },
    { key: "interview", label: "Interview" },
    { key: "offer", label: "Offer" },
  ];

  return (
    <CardShell>
      <CardHead
        badges={<><Badge label="05 · Opportunity" variant="green" /><LivePill /></>}
        title={execRoute ? `${role} mandates rarely surface on Naukri` : role ? `Live openings for ${role}` : d?.headline || "Live opportunities"}
        sub={execRoute
          ? "Confidential C-suite searches run through retained search firms — public job boards are the wrong instrument. Use the routed firm list below."
          : liveJobs.length > 0
            ? `Direct Naukri feed for ${normalizeCity(city)} · ${liveJobsQuery.data?.total_scraped || 0} scraped, ${liveJobs.length} pass relevance gate.`
            : d?.subline || "We are checking live openings against your role, skills, and city."}
      />
      <CardBody>
        <div style={{ background: "var(--mb-green-tint)", border: "1.5px solid rgba(26,107,60,0.18)", borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: "var(--mb-green)", marginBottom: 4 }}>
                {execRoute
                  ? "Routing to executive search firms"
                  : liveJobsQuery.isLoading
                    ? "Fetching live Naukri jobs…"
                    : liveJobs.length > 0
                      ? `${liveJobs.length} relevant listings · ${liveJobsQuery.data?.total_scraped || 0} scanned`
                      : "No relevant live listings — broaden your search"}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink2)", lineHeight: 1.6 }}>
                {liveJobsQuery.data?.cached ? `Cached ${liveJobsQuery.data?.data_age_minutes || 0} min ago — refresh for live data` : formatLiveTimestamp(liveJobsQuery.data?.generated_at)}
              </div>
            </div>
            {!execRoute && (
              <button
                onClick={handleRefresh}
                disabled={liveJobsQuery.isFetching}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, border: "1.5px solid rgba(26,107,60,0.28)", background: "white", color: "var(--mb-green)", padding: "10px 14px", cursor: liveJobsQuery.isFetching ? "wait" : "pointer", minHeight: 42, opacity: liveJobsQuery.isFetching ? 0.6 : 1 }}
              >
                {liveJobsQuery.isFetching ? "Refreshing…" : "Force refresh ↻"}
              </button>
            )}
          </div>
        </div>

        {!execRoute && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Relevant listings", value: liveJobsQuery.data?.total_found ?? jobs.length },
              { label: "Posted ≤ 7 days", value: liveJobsQuery.data?.stats?.recent_count ?? 0 },
              { label: "Salary disclosed", value: liveJobsQuery.data?.stats?.salary_disclosed_count ?? 0 },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 800, color: "var(--mb-navy)", marginBottom: 6 }}>{stat.value ?? 0}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-ink2)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {execRoute && (
          <div style={{ marginBottom: 22 }}>
            <SectionLabel label="Routed search firms · India" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {EXECUTIVE_SEARCH_FIRMS.map((firm) => (
                <a key={firm.name} href={firm.url} target="_blank" rel="noopener noreferrer" onClick={() => logEvent("exec_firm_clicked", { firm: firm.name })} style={{ display: "block", background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 14, textDecoration: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 800, color: "var(--mb-ink)" }}>{firm.name}</div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: "var(--mb-green)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Open ↗</span>
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "var(--mb-ink2)", lineHeight: 1.6, marginTop: 6 }}>{firm.focus}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {liveJobsQuery.isError && (
          <div style={{ background: "var(--mb-red-tint)", border: "1.5px solid rgba(174,40,40,0.18)", borderRadius: 14, padding: 16, marginBottom: 18, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-red)", fontWeight: 700 }}>
            Live feed error. You can still use the direct board links below while I fall back to saved results.
          </div>
        )}

        {jobs.map((job: any, i: number) => {
          const live = Boolean(job.verified_live || job.url);
          const rawUrl = job.url || job.search_url || searchLinks.naukri;
          const classification = classifyJobUrl(rawUrl);
          // If the URL is a generic search/listing page, swap to a targeted board search
          // built from the user's role + city, and relabel the CTA so we don't promise
          // a "live listing" that's actually a search results page.
          const isGenericLink = classification.kind === "generic";
          const primaryUrl = isGenericLink
            ? (classification.host.includes("linkedin.com") ? searchLinks.linkedin : searchLinks.naukri)
            : rawUrl;
          const ctaLabel = isGenericLink ? "Search this role ↗" : "Open live listing ↗";
          const matchTone = getMatchTone(job.match_pct);
          return (
            <div key={`${job.company || "company"}-${job.title || job.role || i}`} style={{ background: "white", border: "1.5px solid var(--mb-rule)", borderRadius: 16, padding: 20, marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--mb-ink)", lineHeight: 1.3 }}>{job.title || job.role}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--mb-ink2)", marginTop: 4 }}>{job.company}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: matchTone.variant === "green" ? "var(--mb-green-tint)" : matchTone.variant === "navy" ? "var(--mb-navy-tint)" : "var(--mb-amber-tint)", color: matchTone.variant === "green" ? "var(--mb-green)" : matchTone.variant === "navy" ? "var(--mb-navy)" : "var(--mb-amber)", border: "1px solid var(--mb-rule)", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {job.match_pct ? `${job.match_pct}% · ${matchTone.label}` : job.match_label || "Live listing"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-ink2)", background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 999, padding: "5px 10px" }}>{job.location || normalizeCity(city)}</span>
                {(job.posted_label || job.experience) && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mb-ink2)", background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", borderRadius: 999, padding: "5px 10px" }}>{job.posted_label || job.experience}</span>}
                {live && !isGenericLink && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: "var(--mb-green)", background: "var(--mb-green-tint)", border: "1px solid rgba(26,107,60,0.2)", borderRadius: 999, padding: "5px 10px" }}>Verified live</span>}
                {isGenericLink && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: "var(--mb-amber)", background: "var(--mb-amber-tint)", border: "1px solid rgba(180,120,20,0.2)", borderRadius: 999, padding: "5px 10px" }}>Search board</span>}
              </div>

              {job.why_fit && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.7, color: "var(--mb-ink2)", marginBottom: 10 }}>{job.why_fit}</div>}
              {job.description_snippet && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.7, color: "var(--mb-ink3)", marginBottom: 12 }}>{job.description_snippet}</div>}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {(Array.isArray(job.tags) ? job.tags : []).slice(0, 5).map((tag: string) => (
                  <span key={tag} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999, background: "var(--mb-paper)", border: "1px solid var(--mb-rule)", color: "var(--mb-ink2)", fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{tag}</span>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 800, color: "var(--mb-ink)" }}>{job.salary || "Not disclosed"}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={primaryUrl} target="_blank" rel="noopener noreferrer" onClick={() => logEvent("job_link_clicked", { platform: "naukri", job_role: job.title || job.role, job_company: job.company, link_kind: classification.kind })} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, background: "var(--mb-navy)", color: "white", padding: "10px 14px", minHeight: 42, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>{ctaLabel}</a>
                  {job.company_jobs_url && <a href={job.company_jobs_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, background: "var(--mb-paper)", color: "var(--mb-ink2)", border: "1.5px solid var(--mb-rule)", padding: "10px 14px", minHeight: 42, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Company jobs ↗</a>}
                  <button onClick={() => addItem("saved", `${job.company} · ${job.title || job.role}`)} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, background: "var(--mb-green-tint)", color: "var(--mb-green)", border: "1px solid rgba(26,107,60,0.2)", padding: "10px 14px", minHeight: 42, cursor: "pointer" }}>Save</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button
                  onClick={() => setModal({
                    title: `Resume rewrite — ${job.title || job.role}`,
                    promptText: `Rewrite ${cardData?.user?.name || "the candidate"}'s resume bullets for the role ${(job.title || job.role)} at ${job.company}.\n\nUse these listing signals: ${job.why_fit || job.description_snippet || "Live Naukri listing"}.\n\nRules:\n- 6 bullets max\n- Start each bullet with a strong action verb\n- Mirror the job language exactly where true\n- No fake metrics`,
                  })}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, background: "var(--mb-teal-tint)", color: "var(--mb-teal)", border: "1px solid rgba(14,102,85,0.2)", padding: "9px 12px", cursor: "pointer" }}
                >
                  Resume bullets
                </button>
                <button
                  onClick={() => setModal({
                    title: `Cover letter — ${job.title || job.role}`,
                    promptText: `Write a tailored cover letter for ${cardData?.user?.name || "the candidate"} applying to ${job.title || job.role} at ${job.company} in ${job.location || normalizeCity(city)}.\n\nGrounding: ${job.why_fit || job.description_snippet || "Use the strongest truthful proof from the resume."}\n\nRules:\n- Under 220 words\n- No generic opener\n- Use one concrete proof point in the first 2 lines\n- Match India hiring tone`,
                  })}
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, background: "var(--mb-paper)", color: "var(--mb-ink2)", border: "1px solid var(--mb-rule)", padding: "9px 12px", cursor: "pointer" }}
                >
                  Cover letter
                </button>
              </div>
            </div>
          );
        })}

        {jobs.length === 0 && !liveJobsQuery.isLoading && (
          <div style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 16, padding: 18, marginBottom: 18 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 800, color: "var(--mb-ink)", marginBottom: 8 }}>No live listings matched this exact brief yet</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "var(--mb-ink2)", lineHeight: 1.7, marginBottom: 12 }}>Open the direct board searches below and broaden the keyword by one adjacent title.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={searchLinks.naukri} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, background: "var(--mb-navy)", color: "white", padding: "10px 14px", textDecoration: "none" }}>Search Naukri ↗</a>
              <a href={searchLinks.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, borderRadius: 10, background: "var(--mb-paper)", color: "var(--mb-ink2)", border: "1px solid var(--mb-rule)", padding: "10px 14px", textDecoration: "none" }}>Search LinkedIn ↗</a>
            </div>
          </div>
        )}

        <SectionLabel label="Your pipeline" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 18 }}>
          {cols.map((col) => (
            <div key={col.key} style={{ background: "var(--mb-paper)", border: "1.5px solid var(--mb-rule)", borderRadius: 14, padding: 12, minHeight: 80 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mb-ink2)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span>{col.label}</span>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--mb-navy)", color: "white", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{kanban[col.key].length}</span>
              </div>
              {kanban[col.key].map((item, j) => (
                <div key={j} style={{ background: "white", borderRadius: 10, padding: "8px 10px", marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink)", fontWeight: 700, border: "1.5px solid var(--mb-rule)" }}>{item}</div>
              ))}
              <div onClick={() => { const name = window.prompt("Enter company + role"); if (name) addItem(col.key, name); }} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--mb-ink3)", cursor: "pointer", textAlign: "center", padding: 8, border: "1.5px dashed var(--mb-rule)", borderRadius: 10, fontWeight: 700 }}>+</div>
            </div>
          ))}
        </div>

        <CardNav onBack={onBack} onNext={onNext} nextLabel="See blind spots →" />
      </CardBody>
      {modal && <PromptModal isOpen={true} onClose={() => setModal(null)} title={modal.title} promptText={modal.promptText} />}
    </CardShell>
  );
}
