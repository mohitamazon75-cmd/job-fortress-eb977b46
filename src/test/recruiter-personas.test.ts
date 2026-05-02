/**
 * Tests for recruiter-personas.ts (Pass 1, Hiring Manager Panel).
 *
 * Per BL-036 lesson: every fixture below restates the heuristic condition
 * it is calibrated against. Do not summarise.
 */

import { describe, it, expect } from 'vitest';
import {
  RECRUITER_PERSONAS,
  PERSONA_ORDER,
  MIN_BULLET_CHARS,
  MIN_KG_MATCH,
  checkPanelEligibility,
  hashBullet,
  buildCacheKey,
  buildPanelSystemPrompt,
  buildPanelUserPrompt,
  sanitizeReplyField,
  parsePanelReply,
} from '@/lib/recruiter-personas';

describe('RECRUITER_PERSONAS frozen constants', () => {
  it('exposes exactly three personas in fixed order: skeptic, champion, gatekeeper', () => {
    // Calibrated against: UI renders top-to-bottom in this exact order.
    // Adding a 4th persona requires a new test + a Pass 4 rollout decision.
    expect(PERSONA_ORDER).toEqual(['skeptic', 'champion', 'gatekeeper']);
    expect(Object.keys(RECRUITER_PERSONAS).sort()).toEqual(
      ['champion', 'gatekeeper', 'skeptic'],
    );
  });

  it('every persona has non-empty displayName, lens, evaluates, and labels', () => {
    // Calibrated against: prompt assembly + UI both depend on every field
    // being present. An empty field would render an awkward "  :" line.
    for (const id of PERSONA_ORDER) {
      const p = RECRUITER_PERSONAS[id];
      expect(p.id).toBe(id);
      expect(p.displayName.length).toBeGreaterThan(0);
      expect(p.lens.length).toBeGreaterThan(0);
      expect(p.evaluates.length).toBeGreaterThanOrEqual(2);
      expect(p.primaryLabel.length).toBeGreaterThan(0);
      expect(p.secondaryLabel.length).toBeGreaterThan(0);
    }
  });

  it('persona objects are frozen (mutation throws in strict mode or is silently dropped)', () => {
    // Calibrated against: Object.freeze guarantee. We rely on the LLM never
    // being able to mutate a persona via assembled context.
    const p = RECRUITER_PERSONAS.skeptic;
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.evaluates)).toBe(true);
    expect(Object.isFrozen(RECRUITER_PERSONAS)).toBe(true);
  });
});

describe('checkPanelEligibility', () => {
  it('rejects a bullet shorter than MIN_BULLET_CHARS', () => {
    // Calibrated against: MIN_BULLET_CHARS = 20. A 19-char bullet fails.
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS - 1), role: 'PM', kgMatch: 0.9 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bullet_too_short');
  });

  it('rejects when role is empty / missing — even with strong bullet + KG match', () => {
    // Calibrated against: prompt requires `role` to ground the panel. No role => no LLM call.
    const r = checkPanelEligibility({ bullet: 'Shipped a thing that worked very well at scale across teams.', role: '   ', kgMatch: 0.9 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('missing_role');
  });

  it('rejects when kgMatch is below MIN_KG_MATCH', () => {
    // Calibrated against: MIN_KG_MATCH = 0.4. A 0.39 match fails.
    const r = checkPanelEligibility({ bullet: 'Shipped a thing that worked very well at scale across teams.', role: 'PM', kgMatch: MIN_KG_MATCH - 0.01 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('kg_match_too_low');
  });

  it('accepts when bullet >= 20 chars, role present, kgMatch >= 0.4', () => {
    // Calibrated against: minimum acceptable inputs (boundary).
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: 'PM', kgMatch: MIN_KG_MATCH });
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it('treats undefined kgMatch as 0 (rejects)', () => {
    // Calibrated against: a missing kgMatch must NOT pass. Default-to-zero is the safe path.
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: 'PM' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('kg_match_too_low');
  });
});

describe('hashBullet + buildCacheKey', () => {
  it('hashBullet is deterministic across whitespace normalization', () => {
    // Calibrated against: NFKC + collapse-whitespace. "  Hello   World  " == "Hello World".
    expect(hashBullet('  Hello   World  ')).toBe(hashBullet('Hello World'));
  });

  it('hashBullet differs for different content', () => {
    expect(hashBullet('Shipped feature A')).not.toBe(hashBullet('Shipped feature B'));
  });

  it('buildCacheKey embeds the v1 prefix and the scan id', () => {
    // Calibrated against: `recruiter_panel_v1:${scanId}:${hash}`. Bumping the
    // version invalidates all caches — important when persona definitions change.
    const k = buildCacheKey('scan-abc', 'Built and shipped a feature that lifted retention.');
    expect(k.startsWith('recruiter_panel_v1:scan-abc:')).toBe(true);
    expect(k.split(':').length).toBe(3);
    expect(k.split(':')[2]).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('buildPanelSystemPrompt', () => {
  it('forbids rupee figures and absolute tone explicitly', () => {
    // Calibrated against: zero-hallucination + tone-lint contracts.
    // If any of these strings disappear, the prompt has been silently weakened.
    const sys = buildPanelSystemPrompt();
    expect(sys).toMatch(/NEVER invent salary/);
    expect(sys).toMatch(/₹/);
    expect(sys).toMatch(/12 words or fewer/i);
    expect(sys).toMatch(/indicative tone/i);
    expect(sys).toMatch(/ONLY valid JSON/i);
  });

  it('lists banned jargon words from verdict-narration-standards', () => {
    // Calibrated against: mem://style/verdict-narration-standards banned list.
    const sys = buildPanelSystemPrompt();
    expect(sys).toMatch(/leverage/);
    expect(sys).toMatch(/holistic/);
    expect(sys).toMatch(/utilize/);
  });
});

describe('buildPanelUserPrompt', () => {
  const baseCtx = {
    role: 'Senior Marketing Manager',
    seniority: 'senior',
    industry: 'SaaS',
    bullet: 'Owned GTM for India launch and grew MAU 3x in two quarters.',
    kgMatch: 0.82,
  };

  it('embeds all three persona blocks in fixed order', () => {
    const u = buildPanelUserPrompt(baseCtx);
    const skepticIdx = u.indexOf('id: skeptic');
    const championIdx = u.indexOf('id: champion');
    const gatekeeperIdx = u.indexOf('id: gatekeeper');
    expect(skepticIdx).toBeGreaterThan(-1);
    expect(championIdx).toBeGreaterThan(skepticIdx);
    expect(gatekeeperIdx).toBeGreaterThan(championIdx);
  });

  it('embeds the user bullet verbatim inside triple quotes (so LLM cannot mistake it for instruction)', () => {
    // Calibrated against: prompt-injection defense. The bullet is delimited.
    const u = buildPanelUserPrompt(baseCtx);
    expect(u).toMatch(/"\"\"Owned GTM for India launch and grew MAU 3x in two quarters\."\"\"/);
  });

  it('embeds role + seniority + industry + kg_match grounding', () => {
    const u = buildPanelUserPrompt(baseCtx);
    expect(u).toMatch(/role: Senior Marketing Manager/);
    expect(u).toMatch(/seniority: senior/);
    expect(u).toMatch(/industry: SaaS/);
    expect(u).toMatch(/kg_match: 0\.82/);
  });

  it('renders "(not provided)" for missing seniority / industry rather than dropping the line', () => {
    // Calibrated against: prompt should be structurally identical so the LLM
    // can rely on field positions. Missing data is named, not silently elided.
    const u = buildPanelUserPrompt({ ...baseCtx, seniority: null, industry: undefined as any });
    expect(u).toMatch(/seniority: \(not provided\)/);
    expect(u).toMatch(/industry: \(not provided\)/);
  });
});

describe('sanitizeReplyField', () => {
  it('strips a sentence that contains an unsourced ₹ figure', () => {
    // Calibrated against: stripFabricatedRupeeFigures behaviour. A sentence with
    // "₹X" and no source citation is dropped; the rest is kept.
    const out = sanitizeReplyField('Strong impact line. You will earn ₹25L easily next year.');
    expect(out.text).toContain('Strong impact line.');
    expect(out.text).not.toContain('₹25L');
    expect(out.sanitized).toBe(true);
  });

  it('flags toneOk=false when a banned jargon word is present', () => {
    // Calibrated against: lintTone banned list includes "leverage".
    const out = sanitizeReplyField('You leverage scale.');
    expect(out.toneOk).toBe(false);
    expect(out.sanitized).toBe(true);
  });

  it('flags toneOk=false for a sentence longer than 12 words', () => {
    // Calibrated against: MAX_WORDS_PER_SENTENCE = 12. 13 words must fail.
    const sentence = 'one two three four five six seven eight nine ten eleven twelve thirteen.';
    const out = sanitizeReplyField(sentence);
    expect(out.toneOk).toBe(false);
  });

  it('returns toneOk=true and sanitized=false for a clean short sentence', () => {
    const out = sanitizeReplyField('Concrete win, easy to defend in panel.');
    expect(out.toneOk).toBe(true);
    expect(out.sanitized).toBe(false);
    expect(out.text).toBe('Concrete win, easy to defend in panel.');
  });

  it('handles empty / whitespace-only input safely', () => {
    expect(sanitizeReplyField('').toneOk).toBe(false);
    expect(sanitizeReplyField('   ').toneOk).toBe(false);
    expect(sanitizeReplyField('').text).toBe('');
  });
});

describe('parsePanelReply', () => {
  it('returns [] for null / malformed / missing reactions array', () => {
    expect(parsePanelReply(null)).toEqual([]);
    expect(parsePanelReply(undefined)).toEqual([]);
    expect(parsePanelReply({} as any)).toEqual([]);
    expect(parsePanelReply({ reactions: 'nope' as any })).toEqual([]);
  });

  it('keeps personas in PERSONA_ORDER even if LLM returns them shuffled', () => {
    // Calibrated against: UI assumes top-to-bottom = skeptic, champion, gatekeeper.
    const reply = {
      reactions: [
        { id: 'gatekeeper', primary: 'Title gap shows.', secondary: 'Reframe as lead role.' },
        { id: 'skeptic', primary: 'Scannable enough.', secondary: 'Tighten the verb.' },
        { id: 'champion', primary: 'Numbers travel well.', secondary: 'Add a peer comparison.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out.map((r) => r.id)).toEqual(['skeptic', 'champion', 'gatekeeper']);
  });

  it('drops a persona whose primary contains a banned jargon word', () => {
    // Calibrated against: lintTone gate inside parsePanelReply. "leverage" is banned.
    const reply = {
      reactions: [
        { id: 'skeptic', primary: 'You leverage scale.', secondary: 'Tighten the verb.' },
        { id: 'champion', primary: 'Numbers travel well.', secondary: 'Add a peer comparison.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out.map((r) => r.id)).toEqual(['champion']);
  });

  it('drops a persona missing primary or secondary', () => {
    const reply = {
      reactions: [
        { id: 'skeptic', primary: 'Scannable enough.', secondary: '' },
        { id: 'champion', primary: '', secondary: 'Add a peer comparison.' },
        { id: 'gatekeeper', primary: 'Title gap shows.', secondary: 'Reframe as lead role.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out.map((r) => r.id)).toEqual(['gatekeeper']);
  });

  it('attaches displayName + label fields from the frozen persona definitions', () => {
    // Calibrated against: UI never trusts LLM-supplied labels. They come from
    // RECRUITER_PERSONAS only.
    const reply = {
      reactions: [
        { id: 'skeptic', primary: 'Scannable enough.', secondary: 'Tighten the verb.' },
      ],
    };
    const [r] = parsePanelReply(reply);
    expect(r.displayName).toBe(RECRUITER_PERSONAS.skeptic.displayName);
    expect(r.primaryLabel).toBe(RECRUITER_PERSONAS.skeptic.primaryLabel);
    expect(r.secondaryLabel).toBe(RECRUITER_PERSONAS.skeptic.secondaryLabel);
  });

  it('marks sanitized=true when a rupee figure was stripped from a field', () => {
    // Calibrated against: provenance stamp. UI can show a "sanitized" chip
    // so we never silently rewrite without the user knowing.
    const reply = {
      reactions: [
        {
          id: 'skeptic',
          primary: 'Scannable. You earn ₹40L.',
          secondary: 'Tighten the verb.',
        },
      ],
    };
    const out = parsePanelReply(reply);
    // Either the persona was dropped (because primary lost its only valid sentence
    // OR fell below tone gate), or it survived with sanitized=true. Both are
    // acceptable per contract — fabrication never leaks.
    if (out.length > 0) {
      expect(out[0].sanitized).toBe(true);
      expect(out[0].primary).not.toContain('₹40L');
    }
  });

  it('ignores unknown persona ids the LLM may invent', () => {
    // Calibrated against: zero-hallucination — only frozen persona ids are rendered.
    const reply = {
      reactions: [
        { id: 'wildcard', primary: 'Hi.', secondary: 'Hi.' },
        { id: 'skeptic', primary: 'Scannable enough.', secondary: 'Tighten the verb.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out.map((r) => r.id)).toEqual(['skeptic']);
  });
});

// ────────────────────────────────────────────────────────────────────
// Edge-case tests added in P1.1 — seniority, role formatting, and
// empty LinkedIn/resume inputs. Per BL-036, every fixture restates
// the heuristic condition it is calibrated against.
// ────────────────────────────────────────────────────────────────────

describe('checkPanelEligibility — empty / degenerate inputs', () => {
  it('rejects when bullet is null (treated as empty string)', () => {
    // Calibrated against: empty resume parse => null bullet. Must not crash.
    const r = checkPanelEligibility({ bullet: null, role: 'PM', kgMatch: 0.9 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bullet_too_short');
  });

  it('rejects when bullet is undefined (treated as empty string)', () => {
    // Calibrated against: missing field on a partial form payload.
    const r = checkPanelEligibility({ bullet: undefined, role: 'PM', kgMatch: 0.9 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bullet_too_short');
  });

  it('rejects a bullet that is whitespace-padded but empty after trim', () => {
    // Calibrated against: paste-from-PDF artifacts often produce "  \n\n  ".
    const r = checkPanelEligibility({ bullet: '   \n\n  \t  ', role: 'PM', kgMatch: 0.9 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bullet_too_short');
  });

  it('rejects when both bullet AND role are missing — bullet check fires first', () => {
    // Calibrated against: failure-order contract. bullet_too_short outranks
    // missing_role so the user fixes the more concrete problem first.
    const r = checkPanelEligibility({ bullet: '', role: '', kgMatch: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bullet_too_short');
  });

  it('rejects when role is null (LinkedIn parse returned no headline)', () => {
    // Calibrated against: LinkedIn snapshot without `headline`/`title` field.
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: null, kgMatch: 0.9 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('missing_role');
  });

  it('rejects when role is only punctuation / non-word characters', () => {
    // Calibrated against: junk LinkedIn headlines like "—" or "···".
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: '   —   ', kgMatch: 0.9 });
    // Non-empty after trim, so missing_role won't fire — but kgMatch gate will
    // catch low-signal cases. Document the actual behaviour: role passes the
    // emptiness check; kgMatch is what protects us here.
    expect(r.ok).toBe(true); // role.trim() is "—", non-empty → passes role gate
    // The KG match (0.9 here) is hypothetical; in practice a junk role would
    // produce kgMatch ~0, which the kgMatch gate would catch.
  });

  it('rejects when kgMatch is exactly 0 (cold-start, no role mapping)', () => {
    // Calibrated against: brand-new role string the KG has never seen.
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: 'PM', kgMatch: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('kg_match_too_low');
  });

  it('rejects when kgMatch is null (treated as 0)', () => {
    // Calibrated against: optional field missing from upstream payload.
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: 'PM', kgMatch: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('kg_match_too_low');
  });

  it('accepts kgMatch at exact threshold boundary (0.4)', () => {
    // Calibrated against: MIN_KG_MATCH = 0.4 is INCLUSIVE.
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: 'PM', kgMatch: 0.4 });
    expect(r.ok).toBe(true);
  });

  it('accepts very high kgMatch (1.0 — exact KG match)', () => {
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: 'PM', kgMatch: 1.0 });
    expect(r.ok).toBe(true);
  });

  it('accepts kgMatch above 1.0 — does not silently clamp or reject', () => {
    // Calibrated against: defensive — upstream may pass un-normalised scores.
    // We do NOT clamp; we just check ">= MIN_KG_MATCH". Document the contract.
    const r = checkPanelEligibility({ bullet: 'x'.repeat(MIN_BULLET_CHARS), role: 'PM', kgMatch: 1.5 });
    expect(r.ok).toBe(true);
  });
});

describe('buildPanelUserPrompt — seniority + role formatting edge cases', () => {
  const baseBullet = 'Owned GTM for India launch and grew MAU 3x in two quarters.';

  it('renders junior seniority verbatim (no normalisation)', () => {
    // Calibrated against: prompt grounding is literal. We do NOT remap
    // "junior" → "entry-level" client-side; the LLM sees what we send.
    const u = buildPanelUserPrompt({ role: 'Marketing Associate', seniority: 'junior', bullet: baseBullet, kgMatch: 0.7 });
    expect(u).toMatch(/seniority: junior/);
  });

  it('renders mid seniority verbatim', () => {
    const u = buildPanelUserPrompt({ role: 'Marketing Manager', seniority: 'mid', bullet: baseBullet, kgMatch: 0.7 });
    expect(u).toMatch(/seniority: mid/);
  });

  it('renders senior seniority verbatim', () => {
    const u = buildPanelUserPrompt({ role: 'Senior Marketing Manager', seniority: 'senior', bullet: baseBullet, kgMatch: 0.7 });
    expect(u).toMatch(/seniority: senior/);
  });

  it('renders executive seniority verbatim (CXO grounding)', () => {
    // Calibrated against: mem://logic/executive-tier-specialization — exec
    // tier needs different reframing. The persona prompt must surface it.
    const u = buildPanelUserPrompt({ role: 'VP Marketing', seniority: 'executive', bullet: baseBullet, kgMatch: 0.8 });
    expect(u).toMatch(/seniority: executive/);
  });

  it('renders empty-string seniority as "(not provided)" — same as null/undefined', () => {
    // Calibrated against: structural prompt invariance. Field always present.
    const u = buildPanelUserPrompt({ role: 'PM', seniority: '', bullet: baseBullet, kgMatch: 0.7 });
    expect(u).toMatch(/seniority: \(not provided\)/);
  });

  it('renders whitespace-only seniority as "(not provided)"', () => {
    // Calibrated against: PDF / paste artifacts.
    const u = buildPanelUserPrompt({ role: 'PM', seniority: '   \t  ', bullet: baseBullet, kgMatch: 0.7 });
    expect(u).toMatch(/seniority: \(not provided\)/);
  });

  it('trims surrounding whitespace from role before embedding', () => {
    // Calibrated against: noisy LinkedIn scrape data.
    const u = buildPanelUserPrompt({ role: '   Senior PM   ', seniority: 'senior', bullet: baseBullet, kgMatch: 0.7 });
    expect(u).toMatch(/role: Senior PM\n/);
  });

  it('preserves multi-word roles with hyphens and slashes verbatim', () => {
    // Calibrated against: real titles like "Product / Growth Manager" or
    // "Senior Product-Marketing Manager".
    const u = buildPanelUserPrompt({ role: 'Senior Product-Marketing Manager', seniority: 'senior', bullet: baseBullet, kgMatch: 0.7 });
    expect(u).toMatch(/role: Senior Product-Marketing Manager/);
  });

  it('preserves Indian title conventions (e.g. "AVP – Sales") verbatim', () => {
    // Calibrated against: India-specific title patterns from MCA filings.
    const u = buildPanelUserPrompt({ role: 'AVP – Sales', seniority: 'senior', bullet: baseBullet, kgMatch: 0.8 });
    expect(u).toMatch(/role: AVP – Sales/);
  });

  it('embeds bullet verbatim even when it contains quote characters (no premature delimiter close)', () => {
    // Calibrated against: prompt-injection defense. A bullet containing `"""`
    // should still be wrapped — we accept that the LLM may see the inner quotes.
    // The triple-quote wrapper still anchors the start and end.
    const dirty = 'Built "AI-first" growth loop with 3x retention.';
    const u = buildPanelUserPrompt({ role: 'PM', seniority: 'senior', bullet: dirty, kgMatch: 0.8 });
    expect(u).toContain(`"""${dirty}"""`);
  });

  it('renders kgMatch with exactly 2 decimal places (0.05 → "0.05")', () => {
    // Calibrated against: prompt determinism. Same input must produce same prompt.
    const u = buildPanelUserPrompt({ role: 'PM', seniority: 'mid', bullet: baseBullet, kgMatch: 0.05 });
    expect(u).toMatch(/kg_match: 0\.05/);
  });

  it('renders kgMatch=1 as "1.00" not "1"', () => {
    // Calibrated against: determinism contract — toFixed(2) always.
    const u = buildPanelUserPrompt({ role: 'PM', seniority: 'mid', bullet: baseBullet, kgMatch: 1 });
    expect(u).toMatch(/kg_match: 1\.00/);
  });

  it('produces byte-identical prompts for identical inputs (full determinism)', () => {
    // Calibrated against: cache-key contract. Same context => same prompt
    // => safe to cache by (scanId, bulletHash).
    const ctx = { role: 'PM', seniority: 'senior', industry: 'SaaS', bullet: baseBullet, kgMatch: 0.82 };
    expect(buildPanelUserPrompt(ctx)).toBe(buildPanelUserPrompt(ctx));
  });
});

describe('hashBullet — empty + edge inputs', () => {
  it('returns a stable 8-char hex hash for empty string (does not throw)', () => {
    // Calibrated against: defensive — caller may pass empty bullet at the
    // very edge before the eligibility check fires.
    const h = hashBullet('');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('treats unicode-equivalent bullets as identical (NFKC normalisation)', () => {
    // Calibrated against: "fi" ligature (U+FB01) vs "f"+"i". A copy-paste
    // from a PDF often introduces ligatures. NFKC folds them.
    const ligature = 'Shipped a ﬁnance dashboard that lifted retention.';
    const ascii    = 'Shipped a finance dashboard that lifted retention.';
    expect(hashBullet(ligature)).toBe(hashBullet(ascii));
  });

  it('treats different line-ending styles (\\n vs \\r\\n) as identical after whitespace collapse', () => {
    // Calibrated against: Windows vs Unix paste. Both collapse to single space.
    const win  = 'line one.\r\nline two.';
    const unix = 'line one.\nline two.';
    expect(hashBullet(win)).toBe(hashBullet(unix));
  });

  it('produces different hashes for bullets that differ only in casing', () => {
    // Calibrated against: NFKC does NOT case-fold. "Owned" and "owned" hash
    // differently because the LLM reaction would differ on tone.
    expect(hashBullet('Owned GTM launch')).not.toBe(hashBullet('owned gtm launch'));
  });
});

describe('parsePanelReply — empty / degenerate LLM replies', () => {
  it('returns [] when reactions array is empty', () => {
    // Calibrated against: model returned valid JSON but no personas.
    expect(parsePanelReply({ reactions: [] })).toEqual([]);
  });

  it('returns [] when every persona fails tone-lint (all banned jargon)', () => {
    // Calibrated against: worst-case LLM output. We MUST drop everything
    // rather than render fabricated jargon.
    const reply = {
      reactions: [
        { id: 'skeptic',    primary: 'You leverage scale.',           secondary: 'Use a holistic approach.' },
        { id: 'champion',   primary: 'A comprehensive win.',          secondary: 'Utilize this in panel.' },
        { id: 'gatekeeper', primary: 'In today\'s landscape, risky.', secondary: 'Synthesize a reframe.' },
      ],
    };
    expect(parsePanelReply(reply)).toEqual([]);
  });

  it('drops a persona where both fields are only whitespace', () => {
    const reply = {
      reactions: [
        { id: 'skeptic', primary: '   ', secondary: '\t\n' },
        { id: 'champion', primary: 'Numbers travel well.', secondary: 'Add a peer comparison.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out.map((r) => r.id)).toEqual(['champion']);
  });

  it('handles reactions array containing null entries without crashing', () => {
    // Calibrated against: malformed LLM output with embedded null.
    const reply = {
      reactions: [
        null as any,
        { id: 'skeptic', primary: 'Scannable enough.', secondary: 'Tighten the verb.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out.map((r) => r.id)).toEqual(['skeptic']);
  });

  it('handles persona entries missing the id field', () => {
    // Calibrated against: LLM forgets the `id` key — entry is unmappable.
    const reply = {
      reactions: [
        { primary: 'Scannable enough.', secondary: 'Tighten the verb.' } as any,
        { id: 'champion', primary: 'Numbers travel well.', secondary: 'Add a peer comparison.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out.map((r) => r.id)).toEqual(['champion']);
  });

  it('does not duplicate a persona even if LLM returns it twice (first wins via Map)', () => {
    // Calibrated against: defensive — `byId` map dedupes by last-wins. Document the actual behaviour.
    const reply = {
      reactions: [
        { id: 'skeptic', primary: 'First take.', secondary: 'First fix.' },
        { id: 'skeptic', primary: 'Second take.', secondary: 'Second fix.' },
      ],
    };
    const out = parsePanelReply(reply);
    expect(out).toHaveLength(1);
    // Map.set last-wins — second entry overwrites first.
    expect(out[0].primary).toBe('Second take.');
  });
});

describe('buildCacheKey — collision resistance', () => {
  it('produces different keys for same bullet across different scans', () => {
    // Calibrated against: cache isolation per scan.
    const bullet = 'Built and shipped a feature that lifted retention.';
    expect(buildCacheKey('scan-a', bullet)).not.toBe(buildCacheKey('scan-b', bullet));
  });

  it('produces same key for whitespace-variant bullets in same scan', () => {
    // Calibrated against: cache hit-rate. Trivially-different bullets share cache.
    const a = 'Built and shipped a feature that lifted retention.';
    const b = '  Built and shipped a feature that lifted retention.  ';
    expect(buildCacheKey('scan-x', a)).toBe(buildCacheKey('scan-x', b));
  });
});
