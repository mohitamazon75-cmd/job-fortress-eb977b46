// Deterministic referral message templates — no LLM, no fabrication.
// Builds short, polite WhatsApp + LinkedIn DM asks. User must replace [Name].
// Hardened against missing skills_matched / role / company so we never print
// awkward filler like "I'm a  with strong core skills experience".

export interface ReferralJobInput {
  title?: string;
  company?: string;
  skills_matched?: string[];
}

export interface ReferralTemplates {
  whatsapp: string;
  linkedin: string;
}

export function buildReferralTemplates(
  job: ReferralJobInput,
  role: string | undefined | null
): ReferralTemplates {
  const matched = (job.skills_matched ?? []).filter(Boolean).slice(0, 2);
  const skillsClause =
    matched.length > 0 ? ` with strong ${matched.join(' and ')} experience` : '';
  const myRole = (role || '').trim();
  const roleClause = myRole
    ? `I'm a ${myRole}${skillsClause}`
    : `I have a relevant background${skillsClause}`;
  const linkedinRoleClause = myRole
    ? `As a ${myRole}${skillsClause}`
    : `Given my background${skillsClause}`;
  const targetRole = (job.title || '').trim() || 'this role';
  const company = (job.company || '').trim() || 'your team';

  const whatsapp =
`Hi [Name] — hope you're doing well!

I noticed ${company} is hiring for ${targetRole}. ${roleClause} and the role looks like a genuine fit.

Would you be open to referring me, or pointing me to whoever owns the hire? Happy to share my resume in 2 lines, no pressure either way.

Thanks for considering 🙏`;

  const linkedin =
`Hi [Name],

Saw ${company} has an open ${targetRole} role. ${linkedinRoleClause}, I think I'd be a strong fit and would value an internal referral if you're open to it.

Totally understand if it's not a fit — would also appreciate any pointer on who owns this hire. Thanks!`;

  return { whatsapp, linkedin };
}
