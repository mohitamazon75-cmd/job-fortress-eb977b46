import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Shared helpers (mirrors Register.tsx sanitization) ────────────────────────
function sanitizeText(input, maxLen = 100) {
  return input
    .replace(/<[^>]*>/g, "")       // strip HTML tags
    .replace(/[<>&"'`]/g, "")      // strip dangerous chars
    .slice(0, maxLen);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Styles (mirrors Register.tsx inputClass exactly) ─────────────────────────
const baseInput =
  "w-full px-4 py-3.5 rounded-xl border-[1.5px] bg-card text-base font-sans outline-none transition-all duration-200";

function inputClass(hasError) {
  return `${baseInput} ${
    hasError
      ? "border-destructive bg-destructive/5 focus:border-destructive"
      : "border-border focus:border-primary focus:ring-2 focus:ring-primary/10"
  }`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BetaChildSetup({ onSaved, onCancel }) {
  const [childName, setChildName]   = useState("");
  const [yearGroup, setYearGroup]   = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  const [nameError, setNameError]     = useState("");
  const [emailError, setEmailError]   = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving]           = useState(false);
  const [touched, setTouched]         = useState({ name: false, email: false });

  // ── Derived ───────────────────────────────────────────────────────────────
  const trimmedName = childName.trim();
  const ctaLabel = trimmedName ? `Add ${trimmedName} →` : "Add Child →";

  // ── Validation ────────────────────────────────────────────────────────────
  function validateFields() {
    let valid = true;
    if (!trimmedName) {
      setNameError("Child's name is required");
      valid = false;
    } else if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters");
      valid = false;
    } else {
      setNameError("");
    }
    if (parentEmail.trim() && !validateEmail(parentEmail.trim())) {
      setEmailError("Enter a valid email address");
      valid = false;
    } else {
      setEmailError("");
    }
    return valid;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true });
    setSubmitError("");

    if (!validateFields()) return;

    setSaving(true);
    try {
      const payload = {
        child_name:   sanitizeText(trimmedName, 100),
        year_group:   yearGroup.trim()    ? sanitizeText(yearGroup.trim(), 50)    : null,
        parent_name:  parentName.trim()   ? sanitizeText(parentName.trim(), 100)  : null,
        parent_email: parentEmail.trim()  ? parentEmail.trim().slice(0, 255)      : null,
      };

      const { data, error } = await supabase
        .from("pulse_beta_students")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      onSaved(data);
    } catch (err) {
      console.error("[BetaChildSetup] insert failed:", err);
      setSubmitError("Could not save. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[520px] mx-auto px-6 pt-10 pb-16">

        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
          type="button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </motion.button>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <h1 className="font-display text-[28px] font-bold leading-tight text-foreground mb-1">
            Add Your Child
          </h1>
          <p className="text-sm text-muted-foreground">You can add more children later</p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5"
        >

          {/* Child name — required */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Child's name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Emma"
              value={childName}
              maxLength={100}
              className={inputClass(touched.name && !!nameError)}
              onChange={(e) => {
                setChildName(sanitizeText(e.target.value, 100));
                if (nameError) setNameError("");
              }}
              onBlur={() => {
                setTouched((p) => ({ ...p, name: true }));
                validateFields();
              }}
            />
            {touched.name && nameError && (
              <p className="mt-1.5 text-xs text-destructive font-medium">{nameError}</p>
            )}
          </div>

          {/* Year / Grade — optional */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Year / Grade <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Year 3, Grade 4, KG"
              value={yearGroup}
              maxLength={50}
              className={inputClass(false)}
              onChange={(e) => setYearGroup(sanitizeText(e.target.value, 50))}
            />
          </div>

          {/* Divider — parent section */}
          <div className="pt-2 pb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Parent / Guardian
            </p>
          </div>

          {/* Parent name — optional */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Your name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Parent or guardian name"
              value={parentName}
              maxLength={100}
              className={inputClass(false)}
              onChange={(e) => setParentName(sanitizeText(e.target.value, 100))}
            />
          </div>

          {/* Parent email — optional */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Your email <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="email"
              placeholder="For weekly wellness summaries (coming soon)"
              value={parentEmail}
              maxLength={255}
              className={inputClass(touched.email && !!emailError)}
              onChange={(e) => {
                setParentEmail(e.target.value.slice(0, 255));
                if (emailError) setEmailError("");
              }}
              onBlur={() => {
                setTouched((p) => ({ ...p, email: true }));
                if (parentEmail.trim()) validateFields();
              }}
            />
            {touched.email && emailError && (
              <p className="mt-1.5 text-xs text-destructive font-medium">{emailError}</p>
            )}
          </div>

          {/* Inline submit error */}
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive font-medium"
            >
              {submitError}
            </motion.div>
          )}

          {/* CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`w-full relative overflow-hidden rounded-2xl text-[17px] font-semibold py-5 transition-all duration-300 ${
                saving
                  ? "gradient-hero text-primary-foreground opacity-75 cursor-wait"
                  : "gradient-hero text-primary-foreground shadow-glow-primary hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              }`}
            >
              <span className="relative z-10">
                {saving ? "Saving…" : ctaLabel}
              </span>
              {!saving && <div className="absolute inset-0 shimmer" />}
            </button>
          </div>

        </motion.form>
      </div>
    </div>
  );
}
