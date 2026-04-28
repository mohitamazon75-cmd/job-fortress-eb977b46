import { describe, it, expect } from 'vitest';
import { buildReferralTemplates } from '@/lib/referral-templates';

describe('buildReferralTemplates', () => {
  const happyJob = {
    title: 'Senior Product Manager',
    company: 'Razorpay',
    skills_matched: ['Payments', 'B2B SaaS', 'Roadmapping'],
  };

  it('happy path: interpolates role, company, title and top 2 skills', () => {
    const { whatsapp, linkedin } = buildReferralTemplates(happyJob, 'Product Lead');
    expect(whatsapp).toContain('Razorpay is hiring for Senior Product Manager');
    expect(whatsapp).toContain("I'm a Product Lead with strong Payments and B2B SaaS experience");
    expect(linkedin).toContain('As a Product Lead with strong Payments and B2B SaaS experience');
    // Caps to top 2 skills only — Roadmapping should not appear
    expect(whatsapp).not.toContain('Roadmapping');
    expect(linkedin).not.toContain('Roadmapping');
  });

  it('does not contain unresolved template literals', () => {
    const { whatsapp, linkedin } = buildReferralTemplates(happyJob, 'Product Lead');
    expect(whatsapp).not.toMatch(/\$\{/);
    expect(linkedin).not.toMatch(/\$\{/);
  });

  it('always asks the user to replace [Name]', () => {
    const { whatsapp, linkedin } = buildReferralTemplates(happyJob, 'Product Lead');
    expect(whatsapp.startsWith('Hi [Name]')).toBe(true);
    expect(linkedin.startsWith('Hi [Name]')).toBe(true);
  });

  describe('edge cases — should never produce awkward filler', () => {
    it('empty skills_matched: no "core skills" filler, no double space', () => {
      const { whatsapp, linkedin } = buildReferralTemplates(
        { ...happyJob, skills_matched: [] },
        'Product Lead'
      );
      expect(whatsapp).not.toContain('core skills');
      expect(linkedin).not.toContain('core skills');
      expect(whatsapp).toContain("I'm a Product Lead and the role looks like a genuine fit");
      expect(linkedin).toContain('As a Product Lead, I think');
      expect(whatsapp).not.toMatch(/ {2,}/);
      expect(linkedin).not.toMatch(/ {2,}/);
    });

    it('undefined skills_matched: same graceful fallback', () => {
      const { whatsapp } = buildReferralTemplates(
        { title: 'PM', company: 'X', skills_matched: undefined },
        'Product Lead'
      );
      expect(whatsapp).not.toContain('undefined');
      expect(whatsapp).not.toContain('core skills');
    });

    it('skills_matched contains empty strings: filters them out', () => {
      const { whatsapp } = buildReferralTemplates(
        { ...happyJob, skills_matched: ['', 'Payments', ''] },
        'Product Lead'
      );
      expect(whatsapp).toContain('strong Payments experience');
      expect(whatsapp).not.toMatch(/strong  /);
    });

    it('blank role: switches to neutral "relevant background" phrasing', () => {
      const { whatsapp, linkedin } = buildReferralTemplates(happyJob, '');
      expect(whatsapp).not.toMatch(/I'm a {2}with/);
      expect(whatsapp).toContain('I have a relevant background with strong Payments and B2B SaaS experience');
      expect(linkedin).toContain('Given my background with strong Payments and B2B SaaS experience');
    });

    it('null/undefined role: same neutral phrasing', () => {
      const { whatsapp: w1 } = buildReferralTemplates(happyJob, null);
      const { whatsapp: w2 } = buildReferralTemplates(happyJob, undefined);
      expect(w1).toContain('I have a relevant background');
      expect(w2).toContain('I have a relevant background');
      expect(w1).not.toContain('null');
      expect(w2).not.toContain('undefined');
    });

    it('whitespace-only role: treated as blank', () => {
      const { whatsapp } = buildReferralTemplates(happyJob, '   ');
      expect(whatsapp).toContain('I have a relevant background');
      expect(whatsapp).not.toMatch(/I'm a {3,}/);
    });

    it('missing company: falls back to "your team"', () => {
      const { whatsapp, linkedin } = buildReferralTemplates(
        { ...happyJob, company: '' },
        'Product Lead'
      );
      expect(whatsapp).toContain('your team is hiring for');
      expect(linkedin).toContain('Saw your team has an open');
      expect(whatsapp).not.toMatch(/ {2,}/);
    });

    it('missing title: falls back to "this role"', () => {
      const { whatsapp, linkedin } = buildReferralTemplates(
        { ...happyJob, title: '' },
        'Product Lead'
      );
      expect(whatsapp).toContain('hiring for this role');
      expect(linkedin).toContain('an open this role role');
      // Even the "this role role" awkwardness is acceptable vs. blank string
    });

    it('all fields missing: still produces a coherent ask', () => {
      const { whatsapp, linkedin } = buildReferralTemplates(
        { title: '', company: '', skills_matched: [] },
        ''
      );
      expect(whatsapp).toContain('your team is hiring for this role');
      expect(whatsapp).toContain('I have a relevant background and the role looks like a genuine fit');
      expect(whatsapp).not.toContain('undefined');
      expect(whatsapp).not.toContain('null');
      expect(linkedin).not.toContain('undefined');
      expect(linkedin).not.toMatch(/ {2,}/);
    });
  });
});
