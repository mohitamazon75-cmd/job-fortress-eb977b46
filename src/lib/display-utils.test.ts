/**
 * Tests for display-utils.ts
 *
 * These functions directly caused the 5.2/10 user regression:
 *   - fmtSkill: skills showed as "academic_writing" not "Academic Writing"
 *   - cleanAdvice: advice read "this professional, integrate..." not "Integrate..."
 *
 * Tests are intentionally exhaustive — these are small pure functions where
 * "too many tests" is not a real risk, and every untested case is a potential
 * regression that users will see.
 */
import { describe, it, expect } from 'vitest';
import { fmtSkill, cleanAdvice } from './display-utils';

// ─── fmtSkill ────────────────────────────────────────────────────────────────

describe('fmtSkill', () => {
  describe('basic snake_case conversion', () => {
    it('converts single-word snake_case to Title Case', () => {
      expect(fmtSkill('python')).toBe('Python');
    });

    it('converts multi-word snake_case to Title Case', () => {
      expect(fmtSkill('academic_writing')).toBe('Academic Writing');
    });

    it('converts three-word snake_case correctly', () => {
      expect(fmtSkill('social_media_content')).toBe('Social Media Content');
    });

    it('handles already-title-cased input unchanged (idempotent path)', () => {
      // Input won't have underscores so only acronym pass runs — safe
      expect(fmtSkill('Academic Writing')).toBe('Academic Writing');
    });
  });

  describe('acronym preservation', () => {
    it('uppercases AI', () => {
      expect(fmtSkill('ai_automation')).toBe('AI Automation');
    });

    it('uppercases API', () => {
      expect(fmtSkill('api_development')).toBe('API Development');
    });

    it('uppercases SEO', () => {
      expect(fmtSkill('seo_content')).toBe('SEO Content');
    });

    it('uppercases SQL', () => {
      expect(fmtSkill('sql_reporting')).toBe('SQL Reporting');
    });

    it('uppercases CRM', () => {
      expect(fmtSkill('crm_management')).toBe('CRM Management');
    });

    it('uppercases ERP', () => {
      expect(fmtSkill('erp_implementation')).toBe('ERP Implementation');
    });

    it('uppercases HR', () => {
      expect(fmtSkill('hr_management')).toBe('HR Management');
    });

    it('uppercases RPA', () => {
      expect(fmtSkill('rpa_automation')).toBe('RPA Automation');
    });

    it('handles acronym at end of string', () => {
      expect(fmtSkill('content_seo')).toBe('Content SEO');
    });

    it('handles acronym standalone', () => {
      expect(fmtSkill('sql')).toBe('SQL');
    });
  });

  describe('edge cases', () => {
    it('returns empty string unchanged', () => {
      expect(fmtSkill('')).toBe('');
    });

    it('handles single character', () => {
      expect(fmtSkill('a')).toBe('A');
    });

    it('does not double-convert — idempotent on already-formatted output', () => {
      const first = fmtSkill('api_development');
      const second = fmtSkill(first);
      expect(second).toBe(first);
    });

    it('handles consecutive underscores gracefully', () => {
      // Not expected in practice, but should not crash
      const result = fmtSkill('data__analysis');
      expect(result).toBeTruthy();
      expect(result).not.toContain('_');
    });

    it('handles leading/trailing underscores', () => {
      const result = fmtSkill('_skill_');
      expect(result).not.toContain('_');
    });
  });

  describe('real skill names from scan output', () => {
    it('formats "data_entry" correctly', () => {
      expect(fmtSkill('data_entry')).toBe('Data Entry');
    });

    it('formats "prompt_engineering" correctly', () => {
      expect(fmtSkill('prompt_engineering')).toBe('Prompt Engineering');
    });

    it('formats "cross_channel_marketing" correctly', () => {
      expect(fmtSkill('cross_channel_marketing')).toBe('Cross Channel Marketing');
    });

    it('formats "customer_relationship_management" correctly', () => {
      expect(fmtSkill('customer_relationship_management')).toBe('Customer Relationship Management');
    });
  });
});

// ─── cleanAdvice ─────────────────────────────────────────────────────────────

describe('cleanAdvice', () => {
  describe('prefix stripping', () => {
    it('strips "this professional, " prefix', () => {
      expect(cleanAdvice('this professional, integrate ChatGPT into your workflow'))
        .toBe('Integrate ChatGPT into your workflow');
    });

    it('strips "This professional, " (capital T) prefix', () => {
      expect(cleanAdvice('This professional, should consider upskilling'))
        .toBe('Should consider upskilling');
    });

    it('strips "this professional " without comma', () => {
      expect(cleanAdvice('this professional needs to act now'))
        .toBe('Needs to act now');
    });

    it('strips "the professional, " prefix', () => {
      expect(cleanAdvice('the professional, needs to build a portfolio'))
        .toBe('Needs to build a portfolio');
    });

    it('strips "The professional " prefix with capital', () => {
      expect(cleanAdvice('The professional should consider a pivot'))
        .toBe('Should consider a pivot');
    });
  });

  describe('mid-sentence replacement', () => {
    it('replaces "this professional" mid-sentence with "you"', () => {
      expect(cleanAdvice('The next step for this professional is to upskill'))
        .toBe('The next step for you is to upskill');
    });

    it('replaces "the professional" mid-sentence with "you"', () => {
      expect(cleanAdvice('What the professional needs most is visibility'))
        .toBe('What you needs most is visibility');
    });

    it('replaces multiple occurrences', () => {
      const input = 'this professional should focus on what this professional does best';
      const result = cleanAdvice(input);
      expect(result).not.toContain('this professional');
      expect(result).toContain('you');
    });
  });

  describe('capitalisation', () => {
    it('capitalises first letter after prefix strip', () => {
      expect(cleanAdvice('this professional, integrate AI tools')[0]).toBe('I');
    });

    it('leaves already-capitalised text unchanged', () => {
      expect(cleanAdvice('You should build a strong portfolio'))
        .toBe('You should build a strong portfolio');
    });

    it('capitalises lowercase start after strip', () => {
      const result = cleanAdvice('this professional, document your achievements');
      expect(result[0]).toBe('D');
    });
  });

  describe('edge cases', () => {
    it('returns empty string unchanged', () => {
      expect(cleanAdvice('')).toBe('');
    });

    it('is idempotent — running twice gives same result', () => {
      const input = 'this professional, should act now';
      const first = cleanAdvice(input);
      const second = cleanAdvice(first);
      expect(second).toBe(first);
    });

    it('does not modify clean second-person advice', () => {
      const clean = 'Integrate AI tools into your daily workflow to stay competitive.';
      expect(cleanAdvice(clean)).toBe(clean);
    });

    it('handles advice that is only the prefix (edge case)', () => {
      const result = cleanAdvice('this professional,');
      // Should not throw, result should be empty or just punctuation
      expect(typeof result).toBe('string');
    });
  });

  describe('real advice strings from Agent 2A output', () => {
    it('cleans a realistic Agent 2A output string', () => {
      const input = 'this professional, remaining in a purely execution-focused role at their company without mastering prompt engineering risks obsolescence.';
      const result = cleanAdvice(input);
      expect(result).not.toMatch(/^this professional/i);
      expect(result[0]).toBe(result[0].toUpperCase());
    });

    it('leaves a well-formed second-person string untouched', () => {
      const input = 'Document three specific case studies where you used AI to improve campaign ROI by at least 20%.';
      expect(cleanAdvice(input)).toBe(input);
    });
  });
});
