/**
 * recruiter-personas.ts — Pass 1 of Hiring Manager Panel feature.
 *
 * Pure module. No I/O, no LLM call, no React, no Deno imports.
 * Used by (future) edge function `get-recruiter-panel` to assemble the
 * grounded prompt + sanitize the LLM reply.
 *
 * WHY THIS EXISTS:
 * Resume Weaponizer rewrites a bullet but never explains *why* a recruiter
 * would skip the original. This module powers a Pro-only "Hiring Manager
 * Panel" card in the Defense tab that shows 3 deterministic persona
 * reactions (Skeptic / Champion / Gatekeeper) to a single rewritten bullet.
 *
 * ZERO-HALLUCINATION CONTRACT:
 *  - Persona definitions are FROZEN constants here. The LLM never invents
 *    a persona; it only fills in the `verdict` + `fix` text per persona.
 *  - The prompt forbids any rupee figure, company name, or hiring stat that
 *    isn't already in the user's grounded context.
 *  - Every reply is run through `sanitizeRecruiterReply` (rupee-strip +
 *    tone-lint). Failed sentences are dropped, NOT silently replaced.
 *  - Below the empty-state thresholds (KG match < 0.4, bullet < 20 chars)
 *    we return an honest empty state and never call the LLM at all.
 *
 * Mirror plan: when the edge function lands in Pass 2, it will import
 * these same persona constants from a Deno-side mirror file. Keep both
 * byte-for-byte equivalent (modulo import-style differences).
 */

import { stripFabricatedRupeeFigures } from './sanitizers/strip-fabricated-rupee-figures';
import { lintTone } from './tone-lint';

// ─── Frozen persona definitions ────────────────────────────────────
// Each persona is a hardcoded archetype. The LLM cannot invent new ones.
// Order matters — UI renders top-to-bottom.

export type PersonaId = 'skeptic' | 'champion' | 'gatekeeper';

export interface RecruiterPersona {
  readonly id: PersonaId;
  readonly displayName: string;
  /** One-line lens the persona uses when reading the bullet. */
  readonly lens: string;
  /** What the persona actually evaluates. Drives prompt grounding. */
  readonly evaluates: readonly string[];
  /** Output schema label shown in UI ("Verdict" / "Fix" / "Strength" / etc). */
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
}

export const RECRUITER_PERSONAS: Readonly<Record<PersonaId, RecruiterPersona>> =
  Object.freeze({
    skeptic: Object.freeze({
      id: 'skeptic',
      displayName: 'The Skeptic',
      lens: 'Mid-level recruiter scanning 200 resumes a day. Six seconds per bullet.',
      evaluates: Object.freeze([
        'scannability',
        'keyword_density',
        'ats_fit',
      ]),
      primaryLabel: 'Verdict',
      secondaryLabel: 'Fix',
    }),
    champion: Object.freeze({
      id: 'champion',
      displayName: 'The Champion',
      lens: 'Hiring manager who wants you to win. Will defend you in panel review.',
      evaluates: Object.freeze([
        'concrete_impact',
        'defensible_numbers',
        'ownership_signal',
      ]),
      primaryLabel: 'Strength',
      secondaryLabel: 'Amplifier',
    }),
    gatekeeper: Object.freeze({
      id: 'gatekeeper',
      displayName: 'The Gatekeeper',
      lens: 'HR / TA lead worried about brand risk and seniority match.',
      evaluates: Object.freeze([
        'title_match',
        'seniority_signal',
        'red_flags',
      ]),
      primaryLabel: 'Risk',
      secondaryLabel: 'Reframe',
    }),
  });

export const PERSONA_ORDER: readonly PersonaId[] = Object.freeze([
  'skeptic',
  'champion',
  'gatekeeper',
]);

// ─── Empty-state thresholds ────────────────────────────────────────
// If we can't ground the panel, we MUST return empty-state, not fabricate.

export const MIN_BULLET_CHARS = 20;
export const MIN_KG_MATCH = 0.4;

export interface PanelEligibility {
  ok: boolean;
  reason?: 'bullet_too_short' | 'kg_match_too_low' | 'missing_role';
  message?: string;
}

export function checkPanelEligibility(input: {
  bullet?: string | null;
  kgMatch?: number | null;
  role?: string | null;
}): PanelEligibility {
  const bullet = (input.bullet ?? '').trim();
  if (bullet.length < MIN_BULLET_CHARS) {
    return {
      ok: false,
      reason: 'bullet_too_short',
      message: `Add at least ${MIN_BULLET_CHARS} characters to your bullet so the panel has something concrete to react to.`,
    };
  }
  const role = (input.role ?? '').trim();
  if (!role) {
    return {
      ok: false,
      reason: 'missing_role',
      message: 'Tell us your current role so the panel can react in context.',
    };
  }
  const kg = typeof input.kgMatch === 'number' ? input.kgMatch : 0;
  if (kg < MIN_KG_MATCH) {
    return {
      ok: false,
      reason: 'kg_match_too_low',
      message: 'Not enough role signal to simulate a hiring panel for you yet.',
    };
  }
  return { ok: true };
}

// ─── Cache key ─────────────────────────────────────────────────────
// (scan_id, bullet_hash) — deterministic so re-renders share the cache.

/** Tiny non-cryptographic hash. Stable across runtimes. */
export function hashBullet(bullet: string): string {
  const s = bullet.normalize('NFKC').replace(/\s+/g, ' ').trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  // Unsigned hex, padded.
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function buildCacheKey(scanId: string, bullet: string): string {
  return `recruiter_panel_v1:${scanId}:${hashBullet(bullet)}`;
}

// ─── Prompt assembly ───────────────────────────────────────────────
// Deterministic. Unit-testable. The LLM ONLY fills primary + secondary
// per persona. Personas, lens, evaluation axes are all frozen.

export interface PanelGroundingContext {
  role: string;
  seniority?: string | null;
  industry?: string | null;
  /** The user's bullet, post-Weaponizer rewrite. */
  bullet: string;
  /** 0..1 — how confident we are this role maps to KG. */
  kgMatch: number;
}

/**
 * Build the system prompt. Frozen text + grounded inject.
 * Returns the same string given the same input (pure).
 */
export function buildPanelSystemPrompt(): string {
  return [
    'You are simulating reactions from three frozen recruiter personas to ONE resume bullet.',
    'You will be given the personas, the user\'s role context, and the bullet.',
    '',
    'HARD RULES — VIOLATING ANY OF THESE IS A FAILURE:',
    '1. NEVER invent salary, ₹/L/lakh/cr/crore figures. Do not mention compensation.',
    '2. NEVER invent company names, hiring stats, or named studies.',
    '3. NEVER use jargon: leverage, holistic, comprehensive, utilize, synthesize, facilitate, depreciating.',
    '4. Every sentence MUST be 12 words or fewer.',
    '5. Speak in indicative tone (likely / risks / suggests). Never absolute.',
    '6. Each persona output is exactly two short fields per the schema.',
    '7. Output ONLY valid JSON matching the requested schema. No prose, no markdown.',
  ].join('\n');
}

export function buildPanelUserPrompt(ctx: PanelGroundingContext): string {
  const role = ctx.role.trim();
  const seniority = (ctx.seniority ?? '').trim();
  const industry = (ctx.industry ?? '').trim();
  const bullet = ctx.bullet.trim();

  const personasBlock = PERSONA_ORDER.map((id) => {
    const p = RECRUITER_PERSONAS[id];
    return [
      `- id: ${p.id}`,
      `  name: ${p.displayName}`,
      `  lens: ${p.lens}`,
      `  evaluates: ${p.evaluates.join(', ')}`,
      `  primary_label: ${p.primaryLabel}`,
      `  secondary_label: ${p.secondaryLabel}`,
    ].join('\n');
  }).join('\n');

  return [
    'USER CONTEXT (grounded — do not contradict):',
    `- role: ${role}`,
    seniority ? `- seniority: ${seniority}` : '- seniority: (not provided)',
    industry ? `- industry: ${industry}` : '- industry: (not provided)',
    `- kg_match: ${ctx.kgMatch.toFixed(2)}`,
    '',
    'PERSONAS (frozen — do not invent new ones, do not rename):',
    personasBlock,
    '',
    'BULLET TO REACT TO:',
    `"""${bullet}"""`,
    '',
    'Return JSON shaped like:',
    '{ "reactions": [ { "id": "skeptic", "primary": "...", "secondary": "..." }, ... ] }',
    'Order: skeptic, champion, gatekeeper. Each field max 12 words.',
  ].join('\n');
}

// ─── Reply parsing + sanitization ──────────────────────────────────

export interface PersonaReaction {
  id: PersonaId;
  displayName: string;
  primaryLabel: string;
  secondaryLabel: string;
  primary: string;
  secondary: string;
  /** True if any sanitizer dropped or modified this reaction. */
  sanitized: boolean;
}

export interface RawPersonaReply {
  id?: string;
  primary?: string;
  secondary?: string;
}

export interface RawPanelReply {
  reactions?: RawPersonaReply[];
}

/**
 * Sanitize a single field: rupee-strip then tone-lint.
 * Returns { text, sanitized } where sanitized=true if anything changed
 * OR if tone-lint flagged a violation (caller decides to drop).
 */
export function sanitizeReplyField(raw: string): {
  text: string;
  sanitized: boolean;
  toneOk: boolean;
} {
  const original = (raw ?? '').trim();
  if (!original) return { text: '', sanitized: true, toneOk: false };
  const stripped = stripFabricatedRupeeFigures(original);
  const changed = stripped.trim() !== original;
  const tone = lintTone(stripped);
  return {
    text: stripped.trim(),
    sanitized: changed || !tone.ok,
    toneOk: tone.ok,
  };
}

/**
 * Parse the LLM reply, drop personas that fail tone-lint or are missing
 * required fields. Always returns reactions in PERSONA_ORDER. Missing
 * personas are simply omitted (caller renders empty-state per slot).
 */
export function parsePanelReply(reply: RawPanelReply | null | undefined): PersonaReaction[] {
  if (!reply || !Array.isArray(reply.reactions)) return [];
  const byId = new Map<string, RawPersonaReply>();
  for (const r of reply.reactions) {
    if (r && typeof r.id === 'string') byId.set(r.id, r);
  }
  const out: PersonaReaction[] = [];
  for (const id of PERSONA_ORDER) {
    const raw = byId.get(id);
    if (!raw) continue;
    const persona = RECRUITER_PERSONAS[id];
    const primary = sanitizeReplyField(raw.primary ?? '');
    const secondary = sanitizeReplyField(raw.secondary ?? '');
    // Drop the whole persona if either field failed tone-lint or is empty.
    if (!primary.text || !secondary.text) continue;
    if (!primary.toneOk || !secondary.toneOk) continue;
    out.push({
      id: persona.id,
      displayName: persona.displayName,
      primaryLabel: persona.primaryLabel,
      secondaryLabel: persona.secondaryLabel,
      primary: primary.text,
      secondary: secondary.text,
      sanitized: primary.sanitized || secondary.sanitized,
    });
  }
  return out;
}
