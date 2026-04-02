import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Radar, FileText, Check, Crosshair, Upload, Clipboard, Linkedin, Loader2, AlertCircle, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SearchableComboBox from "./SearchableComboBox";
import type { RiskIQForm as FormData } from "./RiskIQTypes";
import { ROLES, INDUSTRIES, CITIES, EXPERIENCE_OPTIONS, EDUCATION_OPTIONS } from "./RiskIQTypes";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } } };

function SelectField({ label, value, onChange, options, placeholder, highlighted }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string; highlighted?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full h-12 rounded-lg border px-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none ${
          highlighted ? "border-prophet-green bg-prophet-green/5 ring-1 ring-prophet-green/20" : "border-border bg-background"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// Helper to fuzzy-match extracted data to our dropdown options
function fuzzyMatch(extracted: string, options: string[]): string {
  if (!extracted) return "";
  const lower = extracted.toLowerCase();
  // Exact match
  const exact = options.find(o => o.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  const partial = options.find(o => lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower));
  if (partial) return partial;
  return "";
}

interface LinkedInResult {
  name: string;
  headline: string | null;
  company: string;
  location: string;
  skills: string[];
  experience: { title: string; company: string; duration: string }[];
  suggestedIndustry: string;
  matchedJobFamily: string | null;
  extraction_confidence: "high" | "medium" | "low";
  source: string;
}

interface Props {
  onSubmit: (form: FormData, profileText: string) => void;
  onBack: () => void;
  error: string;
}

export default function RiskIQFormScreen({ onSubmit, onBack, error }: Props) {
  const [form, setForm] = useState<FormData>({ role: "", industry: "", experience: "", city: "", education: "" });
  const [mode, setMode] = useState<"linkedin" | "paste" | "upload">("linkedin");
  const [profileText, setProfileText] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinError, setLinkedinError] = useState("");
  const [linkedinResult, setLinkedinResult] = useState<LinkedInResult | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const setF = (k: keyof FormData, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    // Remove auto-filled highlight when user manually changes
    setAutoFilledFields(prev => { const next = new Set(prev); next.delete(k); return next; });
  };
  const ready = form.role && form.industry && form.experience && form.city && form.education;

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = e => setProfileText(e.target?.result as string || "");
    r.readAsText(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); onFile(e.dataTransfer?.files?.[0]); }, []);

  // LinkedIn extraction
  const handleLinkedinExtract = async () => {
    if (!linkedinUrl.trim()) return;
    
    const urlRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i;
    if (!urlRegex.test(linkedinUrl.trim())) {
      setLinkedinError("Enter a valid LinkedIn URL (e.g. https://linkedin.com/in/your-name)");
      return;
    }

    setLinkedinLoading(true);
    setLinkedinError("");
    setLinkedinResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("parse-linkedin", {
        body: { linkedinUrl: linkedinUrl.trim() },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const result = data as LinkedInResult;
      setLinkedinResult(result);

      // Build profile text from extracted data
      const parts: string[] = [];
      if (result.name) parts.push(`Name: ${result.name}`);
      if (result.headline) parts.push(`Title: ${result.headline}`);
      if (result.company) parts.push(`Company: ${result.company}`);
      if (result.location) parts.push(`Location: ${result.location}`);
      if (result.skills?.length) parts.push(`Skills: ${result.skills.join(", ")}`);
      if (result.experience?.length) {
        parts.push("Experience:");
        result.experience.forEach(exp => {
          parts.push(`  - ${exp.title} at ${exp.company} (${exp.duration})`);
        });
      }
      setProfileText(parts.join("\n"));

      // Auto-fill form fields from extraction
      const filled = new Set<string>();

      // Match role — use raw value if no fuzzy match
      if (result.headline || result.matchedJobFamily) {
        const raw = result.headline || result.matchedJobFamily || "";
        const roleMatch = fuzzyMatch(raw, ROLES);
        const roleValue = roleMatch || raw.trim();
        if (roleValue) { setForm(p => ({ ...p, role: roleValue })); filled.add("role"); }
      }

      // Match industry — use raw value if no fuzzy match
      if (result.suggestedIndustry) {
        const indMatch = fuzzyMatch(result.suggestedIndustry, INDUSTRIES);
        const indValue = indMatch || result.suggestedIndustry.trim();
        if (indValue) { setForm(p => ({ ...p, industry: indValue })); filled.add("industry"); }
      }

      // Match city from location — use raw value if no fuzzy match
      if (result.location) {
        const cityMatch = fuzzyMatch(result.location, CITIES);
        const cityValue = cityMatch || result.location.trim();
        if (cityValue) { setForm(p => ({ ...p, city: cityValue })); filled.add("city"); }
      }

      // Infer experience from experience array
      if (result.experience?.length) {
        const totalYears = result.experience.reduce((sum, exp) => {
          const match = exp.duration?.match(/(\d+)/);
          return sum + (match ? parseInt(match[1]) : 2);
        }, 0);
        let expMatch = "";
        if (totalYears < 1) expMatch = "Less than 1 year";
        else if (totalYears <= 3) expMatch = "1–3 years";
        else if (totalYears <= 5) expMatch = "3–5 years";
        else if (totalYears <= 10) expMatch = "5–10 years";
        else if (totalYears <= 15) expMatch = "10–15 years";
        else expMatch = "15+ years";
        setForm(p => ({ ...p, experience: expMatch }));
        filled.add("experience");
      }

      setAutoFilledFields(filled);
    } catch (e: any) {
      setLinkedinError(e.message || "Failed to extract LinkedIn profile. Try pasting your profile text instead.");
    } finally {
      setLinkedinLoading(false);
    }
  };

  const filled = [form.role, form.industry, form.experience, form.city, form.education].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-border/40">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
            <Radar className="w-3.5 h-3.5 text-prophet-gold" />
          </div>
          <span className="font-bold text-sm text-foreground">RiskIQ</span>
        </div>
        <div className="w-12" />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--gradient-primary)" }}
          animate={{ width: `${(filled / 5) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-lg mx-auto px-5 py-8">
        {error && (
          <motion.div variants={fadeUp} className="mb-5 p-4 rounded-xl bg-destructive/8 border border-destructive/15 text-sm text-destructive flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>{error}</div>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-2 tracking-tight">Build your risk profile</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            5 fields → 12 dimensions → your complete AI displacement report.
            <span className="block text-xs text-muted-foreground/50 mt-1">{filled}/5 completed</span>
          </p>
        </motion.div>

        {/* Profile Data Card — NOW FIRST with LinkedIn prominent */}
        <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-5 sm:p-6 mb-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0A66C2]/10 flex items-center justify-center">
                <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0A66C2]">Profile Intelligence</span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-prophet-green/10 border border-prophet-green/20 text-prophet-green">
              Auto-fills fields
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Paste your LinkedIn URL and we'll extract your profile, skills, and auto-fill the form below.
          </p>

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-muted p-1 mb-4">
            {([
              { key: "linkedin" as const, icon: Linkedin, label: "LinkedIn URL" },
              { key: "paste" as const, icon: Clipboard, label: "Paste text" },
              { key: "upload" as const, icon: Upload, label: "Upload file" },
            ]).map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex-1 py-2.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  mode === m.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <m.icon className="w-3 h-3" /> {m.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === "linkedin" ? (
              <motion.div key="linkedin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="flex gap-2 mb-3">
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={e => { setLinkedinUrl(e.target.value); setLinkedinError(""); }}
                    placeholder="https://linkedin.com/in/your-name"
                    className="flex-1 h-12 px-4 rounded-lg border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#0A66C2] focus:ring-2 focus:ring-[#0A66C2]/20 transition-all"
                    onKeyDown={e => e.key === "Enter" && handleLinkedinExtract()}
                  />
                  <button
                    onClick={handleLinkedinExtract}
                    disabled={linkedinLoading || !linkedinUrl.trim()}
                    className={`h-12 px-5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                      linkedinLoading || !linkedinUrl.trim()
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-[#0A66C2] text-white hover:bg-[#004182] cursor-pointer"
                    }`}
                  >
                    {linkedinLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Extract</>
                    )}
                  </button>
                </div>

                {linkedinError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 text-xs text-destructive mb-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{linkedinError}</span>
                  </motion.div>
                )}

                {linkedinResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg bg-prophet-green/5 border border-prophet-green/15"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Check className="w-4 h-4 text-prophet-green" />
                      <span className="text-sm font-bold text-prophet-green">Profile extracted</span>
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        linkedinResult.extraction_confidence === "high"
                          ? "bg-prophet-green/15 text-prophet-green"
                          : linkedinResult.extraction_confidence === "medium"
                          ? "bg-prophet-gold/15 text-prophet-gold"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {linkedinResult.extraction_confidence} confidence
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {linkedinResult.name && <div><span className="font-semibold text-foreground">{linkedinResult.name}</span></div>}
                      {linkedinResult.headline && <div>{linkedinResult.headline}</div>}
                      {linkedinResult.company && <div>🏢 {linkedinResult.company}</div>}
                      {linkedinResult.location && <div>📍 {linkedinResult.location}</div>}
                      {linkedinResult.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {linkedinResult.skills.slice(0, 8).map(s => (
                            <span key={s} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium">{s}</span>
                          ))}
                          {linkedinResult.skills.length > 8 && (
                            <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                              +{linkedinResult.skills.length - 8} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {autoFilledFields.size > 0 && (
                      <div className="mt-3 pt-3 border-t border-prophet-green/10 text-[10px] text-prophet-green font-semibold">
                        ✨ Auto-filled {autoFilledFields.size} field{autoFilledFields.size > 1 ? "s" : ""} — review & adjust below
                      </div>
                    )}
                  </motion.div>
                )}

                {!linkedinResult && !linkedinLoading && !linkedinError && (
                  <div className="text-[10px] text-muted-foreground/50 mt-1">
                    We use AI to extract your profile data, skills, and experience from your public LinkedIn page.
                  </div>
                )}
              </motion.div>
            ) : mode === "paste" ? (
              <motion.div key="paste" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <textarea
                  value={profileText}
                  onChange={e => setProfileText(e.target.value)}
                  rows={5}
                  placeholder="Paste your LinkedIn About section, experience bullets, or full resume text here..."
                  className="w-full p-4 rounded-lg border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/40 resize-y outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all leading-relaxed"
                />
              </motion.div>
            ) : (
              <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className={`rounded-lg p-10 text-center cursor-pointer border-2 border-dashed transition-all ${
                    profileText ? "border-prophet-green/40 bg-prophet-green/5" : "border-border hover:border-primary/30 bg-muted/20"
                  }`}
                >
                  <input ref={fileRef} type="file" accept=".txt,.doc,.docx,.pdf" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
                  {profileText ? (
                    <>
                      <Check className="w-10 h-10 text-prophet-green mx-auto mb-3" />
                      <div className="text-sm font-bold text-prophet-green">File loaded — {profileText.length.toLocaleString()} characters</div>
                      <div className="text-xs text-muted-foreground mt-1">Skills will be auto-extracted</div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <div className="text-sm font-medium text-muted-foreground">Drop your resume here or click to browse</div>
                      <div className="text-xs text-muted-foreground/50 mt-1">.txt, .doc, .docx supported</div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {profileText && mode !== "linkedin" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 flex items-center gap-2 text-xs text-prophet-green"
            >
              <Check className="w-3.5 h-3.5" />
              <span className="font-semibold">{profileText.length.toLocaleString()} characters loaded</span>
            </motion.div>
          )}
        </motion.div>

        {/* Position Card */}
        <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-5 sm:p-6 mb-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crosshair className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Your Position</span>
            {autoFilledFields.size > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-prophet-green/10 text-prophet-green ml-auto">
                ✨ {autoFilledFields.size} auto-filled
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <SearchableComboBox label="Current Role" value={form.role} onChange={v => setF("role", v)} options={ROLES} placeholder="Search role..." highlighted={autoFilledFields.has("role")} allowCustom />
            <SearchableComboBox label="Industry" value={form.industry} onChange={v => setF("industry", v)} options={INDUSTRIES} placeholder="Search industry..." highlighted={autoFilledFields.has("industry")} allowCustom />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SelectField label="Experience" value={form.experience} onChange={v => setF("experience", v)} options={EXPERIENCE_OPTIONS} placeholder="Years" highlighted={autoFilledFields.has("experience")} />
            <SearchableComboBox label="City" value={form.city} onChange={v => setF("city", v)} options={CITIES} placeholder="Search city..." highlighted={autoFilledFields.has("city")} allowCustom />
            <SelectField label="Education" value={form.education} onChange={v => setF("education", v)} options={EDUCATION_OPTIONS} placeholder="Level" highlighted={autoFilledFields.has("education")} />
          </div>
        </motion.div>

        {/* Submit */}
        <motion.div variants={fadeUp}>
          <button
            onClick={() => ready && onSubmit(form, profileText)}
            disabled={!ready}
            className={`w-full py-4 rounded-xl font-black text-base transition-all ${
              ready
                ? "bg-foreground text-background hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            style={ready ? { boxShadow: "0 8px 32px hsl(var(--foreground) / 0.25)" } : undefined}
          >
            {ready ? (
              <>Analyse My Risk <ArrowRight className="inline-block ml-2 w-5 h-5" /></>
            ) : (
              `Complete all 5 fields to continue (${filled}/5)`
            )}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
