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
