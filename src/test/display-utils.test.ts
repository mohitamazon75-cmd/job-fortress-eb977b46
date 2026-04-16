import { describe, it, expect } from 'vitest';
import { fmtSkill, cleanAdvice } from '@/lib/display-utils';

// ═══════════════════════════════════════════════════════════════
// fmtSkill — snake_case → human-readable Title Case
// ═══════════════════════════════════════════════════════════════
describe('fmtSkill', () => {
  // ── Basic formatting ─────────────────────────────────────────
  it('converts single snake_case word to Title Case', () => {
    expect(fmtSkill('copywriting')).toBe('Copywriting');
  });

  it('converts multi-word snake_case to Title Case', () => {
    expect(fmtSkill('academic_writing')).toBe('Academic Writing');
  });

  it('converts social_media_content — the original regression case', () => {
    expect(fmtSkill('social_media_content')).toBe('Social Media Content');
  });

  it('handles already-Title-Case input without double-capitalising', () => {
    expect(fmtSkill('Strategic Planning')).toBe('Strategic Planning');
  });

  // ── Acronym preservation ──────────────────────────────────────
  it('preserves AI acronym', () => {
    expect(fmtSkill('ai_tools')).toBe('AI Tools');
  });

  it('preserves API acronym', () => {
    expect(fmtSkill('api_development')).toBe('API Development');
  });

  it('preserves SEO acronym', () => {
    expect(fmtSkill('seo_content')).toBe('SEO Content');
  });

  it('preserves SQL acronym', () => {
    expect(fmtSkill('sql_queries')).toBe('SQL Queries');
  });

  it('preserves CRM acronym', () => {
    expect(fmtSkill('crm_management')).toBe('CRM Management');
  });

  it('preserves ERP acronym', () => {
    expect(fmtSkill('erp_implementation')).toBe('ERP Implementation');
  });

  it('preserves HR acronym', () => {
    expect(fmtSkill('hr_operations')).toBe('HR Operations');
  });

  it('preserves RPA acronym', () => {
    expect(fmtSkill('rpa_automation')).toBe('RPA Automation');
  });

  // ── Edge cases ────────────────────────────────────────────────
  it('returns empty string for empty input', () => {
    expect(fmtSkill('')).toBe('');
  });

  it('is idempotent — applying twice gives the same result', () => {
    const once = fmtSkill('seo_content_writing');
    const twice = fmtSkill(once);
    expect(twice).toBe(once);
  });

  it('handles leading/trailing underscores without crashing', () => {
    // Defensive: LLM output can occasionally include malformed strings
    const result = fmtSkill('_data_entry_');
    expect(result).toContain('Data Entry');
  });
});

// ═══════════════════════════════════════════════════════════════
// cleanAdvice — strips third-person LLM prefix, forces second-person
// ═══════════════════════════════════════════════════════════════
describe('cleanAdvice', () => {
  // ── Prefix stripping — the regression case ────────────────────
  it('removes "this professional," prefix — the original regression', () => {
    expect(cleanAdvice('this professional, integrate ChatGPT into your workflow'))
      .toBe('Integrate ChatGPT into your workflow');
  });

  it('removes "this professional" prefix without comma', () => {
    expect(cleanAdvice('this professional should upskill in prompt engineering'))
      .toBe('Should upskill in prompt engineering');
  });

  it('removes "the professional," prefix', () => {
    expect(cleanAdvice('the professional, document three case studies'))
      .toBe('Document three case studies');
  });

  it('is case-insensitive on the prefix', () => {
    expect(cleanAdvice('This Professional, update your LinkedIn headline'))
      .toBe('Update your LinkedIn headline');
  });

  // ── Mid-sentence replacement ──────────────────────────────────
  it('replaces "this professional" mid-sentence with "you"', () => {
    expect(cleanAdvice('The risk for this professional is significant if no action is taken'))
      .toBe('The risk for you is significant if no action is taken');
  });

  it('replaces "the professional" mid-sentence with "you"', () => {
    expect(cleanAdvice('Without upskilling, the professional will face displacement'))
      .toBe('Without upskilling, you will face displacement');
  });

  // ── Capitalisation fix ────────────────────────────────────────
  it('capitalises the first letter after prefix removal', () => {
    expect(cleanAdvice('this professional, add prompt engineering to your resume'))
      .toMatch(/^Add/);
  });

  it('does not double-capitalise already-capital first letter', () => {
    expect(cleanAdvice('You should act now.'))
      .toBe('You should act now.');
  });

  // ── Pass-through — good advice should be unchanged ────────────
  it('leaves already-clean second-person advice unchanged', () => {
    const clean = 'Integrate AI tools into your daily workflow and document the results.';
    expect(cleanAdvice(clean)).toBe(clean);
  });

  // ── Edge cases ────────────────────────────────────────────────
  it('returns empty string for empty input', () => {
    expect(cleanAdvice('')).toBe('');
  });

  it('handles null-like falsy input safely', () => {
    // Runtime safety — LLM fields can occasionally be undefined
    expect(cleanAdvice(null as unknown as string)).toBeFalsy();
  });

  it('is idempotent — applying twice gives the same result', () => {
    const input = 'this professional, focus on strategic skill development';
    const once = cleanAdvice(input);
    const twice = cleanAdvice(once);
    expect(twice).toBe(once);
  });
});
