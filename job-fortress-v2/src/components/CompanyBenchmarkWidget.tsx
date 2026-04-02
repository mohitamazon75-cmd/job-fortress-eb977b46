import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Briefcase, Target, Star, MapPin } from 'lucide-react';

interface Company {
  company: string;
  industry: string;
  avg_fate_score: number;
  assessment_count: number;
  risk_tier: string;
}

interface CompanyBenchmarkWidgetProps {
  industry: string;
  role?: string;
  userCompany?: string | null;
  skillIndustry?: string;
}

function getRiskColor(tier: string) {
  switch (tier.toLowerCase()) {
    case 'critical': return 'text-prophet-red bg-prophet-red/10 border-prophet-red/30';
    case 'high': return 'text-prophet-red bg-prophet-red/5 border-prophet-red/20';
    case 'moderate': return 'text-prophet-gold bg-prophet-gold/10 border-prophet-gold/30';
    default: return 'text-prophet-green bg-prophet-green/10 border-prophet-green/30';
  }
}

function getBarColor(score: number) {
  if (score >= 65) return 'bg-prophet-red';
  if (score >= 50) return 'bg-prophet-gold';
  return 'bg-prophet-green';
}

function getSkillIndustry(role?: string): string | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes('market') || r.includes('brand') || r.includes('content') || r.includes('seo') || r.includes('social media') || r.includes('copywrite')) return 'Marketing & Advertising';
  if (r.includes('software') || r.includes('developer') || r.includes('engineer') || r.includes('devops') || r.includes('data') || r.includes('cloud') || r.includes('full stack') || r.includes('frontend') || r.includes('backend')) return 'IT & Software';
  if (r.includes('financ') || r.includes('account') || r.includes('bank') || r.includes('audit') || r.includes('analyst')) return 'Finance & Banking';
  if (r.includes('doctor') || r.includes('nurse') || r.includes('pharma') || r.includes('health') || r.includes('medical')) return 'Healthcare';
  if (r.includes('design') || r.includes('creative') || r.includes('ui') || r.includes('ux') || r.includes('graphic')) return 'Creative & Design';
  if (r.includes('teach') || r.includes('professor') || r.includes('education') || r.includes('trainer')) return 'Education';
  if (r.includes('manufactur') || r.includes('mechanical') || r.includes('production') || r.includes('civil')) return 'Manufacturing';
  return null;
}

function normalizeCompanyName(name: string): string {
  return name.toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|corp|corporation|technologies|solutions|india|group|services|consulting)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function findUserCompanyMatch(companies: Company[], userCompany: string): number {
  const userNorm = normalizeCompanyName(userCompany);
  if (!userNorm) return -1;
  return companies.findIndex(c => {
    const compNorm = normalizeCompanyName(c.company);
    return compNorm.includes(userNorm) || userNorm.includes(compNorm);
  });
}

async function fetchCompanies(industry: string, role?: string): Promise<Company[]> {
  try {
    const params = new URLSearchParams({ industry });
    if (role) params.set('role', role);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-benchmark?${params.toString()}`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.companies || [];
  } catch {
    return [];
  }
}

function UserCompanyCard({ company, rank, total }: { company: Company; rank: number; total: number }) {
  const percentile = Math.round(((total - rank) / total) * 100);
  const isHighRisk = company.avg_fate_score >= 65;
  const isMedRisk = company.avg_fate_score >= 50;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`mx-5 mb-4 rounded-xl border-2 p-4 ${
        isHighRisk
          ? 'border-prophet-red/40 bg-prophet-red/5'
          : isMedRisk
          ? 'border-prophet-gold/40 bg-prophet-gold/5'
          : 'border-prophet-green/40 bg-prophet-green/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isHighRisk ? 'bg-prophet-red/10' : isMedRisk ? 'bg-prophet-gold/10' : 'bg-prophet-green/10'
        }`}>
          <MapPin className={`w-5 h-5 ${
            isHighRisk ? 'text-prophet-red' : isMedRisk ? 'text-prophet-gold' : 'text-prophet-green'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{company.company}</span>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">YOUR COMPANY</span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${getRiskColor(company.risk_tier)}`}>
              {company.risk_tier}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Avg. Risk</p>
              <p className={`text-lg font-black ${isHighRisk ? 'text-prophet-red' : isMedRisk ? 'text-prophet-gold' : 'text-prophet-green'}`}>
                {Math.round(company.avg_fate_score)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Rank</p>
              <p className="text-lg font-black text-foreground">#{rank}<span className="text-xs text-muted-foreground font-normal">/{total}</span></p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Riskier Than</p>
              <p className="text-lg font-black text-foreground">{percentile}%</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {isHighRisk
              ? '⚠️ Your employer is in the high-risk zone. Roles like yours may face restructuring sooner — start building your safety net now.'
              : isMedRisk
              ? '⚡ Your company faces moderate disruption. Some roles will change — stay ahead by upskilling in AI-adjacent areas.'
              : '✅ Your employer is relatively well-positioned. Keep monitoring but focus on growth opportunities.'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function UnknownCompanyCard({ companyName }: { companyName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-5 mb-4 rounded-xl border-2 border-dashed border-border bg-muted/30 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{companyName}</span>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">YOUR COMPANY</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Your company isn't in our benchmark database yet. Compare against similar companies in your industry below — the risk patterns will be similar for your role.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function CompanyList({ companies, maxScore, highlightIndex }: { companies: Company[]; maxScore: number; highlightIndex: number }) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? companies : companies.slice(0, 5);

  return (
    <div>
      <div className="px-5 pb-2">
        {displayed.map((company, i) => {
          const isHighlighted = i === highlightIndex;
          return (
            <motion.div
              key={company.company}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className={`flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 rounded-lg transition-colors ${
                isHighlighted ? 'bg-primary/5 -mx-2 px-2' : ''
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                isHighlighted ? 'bg-primary/20 text-primary' :
                i === 0 ? 'bg-prophet-red/10 text-prophet-red' :
                i === 1 ? 'bg-prophet-red/5 text-prophet-red/80' :
                i === 2 ? 'bg-prophet-gold/10 text-prophet-gold' :
                'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold truncate ${isHighlighted ? 'text-primary' : 'text-foreground'}`}>
                    {company.company}
                  </span>
                  {isHighlighted && (
                    <Star className="w-3 h-3 text-primary flex-shrink-0 fill-primary" />
                  )}
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${getRiskColor(company.risk_tier)}`}>
                    {company.risk_tier}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(company.avg_fate_score / maxScore) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * i }}
                      className={`h-full rounded-full ${getBarColor(company.avg_fate_score)}`}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-foreground w-8 text-right">
                    {Math.round(company.avg_fate_score)}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">{company.industry}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      {companies.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground border-t border-border/50 transition-colors"
        >
          {expanded ? <>Show Less <ChevronUp className="w-3.5 h-3.5" /></> : <>Show All {companies.length} <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      )}
    </div>
  );
}

export default function CompanyBenchmarkWidget({ industry, role, userCompany, skillIndustry: propSkillIndustry }: CompanyBenchmarkWidgetProps) {
  const [skillCompanies, setSkillCompanies] = useState<Company[]>([]);
  const [industryCompanies, setIndustryCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'skills' | 'industry'>('skills');

  const skillIndustry = propSkillIndustry || getSkillIndustry(role) || industry;
  const showBothSections = skillIndustry !== industry;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [skillData, industryData] = await Promise.all([
        fetchCompanies(skillIndustry, role),
        showBothSections ? fetchCompanies(industry, role) : Promise.resolve([]),
      ]);
      setSkillCompanies(skillData);
      setIndustryCompanies(industryData);
      setLoading(false);
    };
    load();
  }, [industry, skillIndustry, showBothSections]);

  const allCompanies = activeTab === 'skills' ? skillCompanies : industryCompanies;
  const maxScore = Math.max(...allCompanies.map(c => c.avg_fate_score), 100);

  // Find user's company in the list
  const userCompanyIndex = userCompany ? findUserCompanyMatch(allCompanies, userCompany) : -1;
  const userCompanyData = userCompanyIndex >= 0 ? allCompanies[userCompanyIndex] : null;

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-bold text-foreground text-sm">Company Risk Leaderboard</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (skillCompanies.length === 0 && industryCompanies.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No company benchmarks available for this profile.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      className="mb-6"
    >
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">Company Risk Leaderboard</h3>
                <p className="text-xs text-muted-foreground">
                  {userCompany
                    ? `How ${userCompany} compares against industry peers`
                    : 'AI disruption risk across companies relevant to your profile'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              WEEKLY DATA
            </div>
          </div>
          <p className="text-xs text-muted-foreground ml-11 leading-relaxed">
            {userCompany
              ? `We've identified where ${userCompany} stands in AI disruption risk. Higher score = more roles being automated. ${userCompanyData ? 'Your company is highlighted below.' : 'Your company isn\'t benchmarked yet — compare against similar companies.'}`
              : 'Which companies are most at risk from AI? Higher score = more roles being automated. If your company is here, they may cut or restructure roles like yours sooner.'}
          </p>
        </div>

        {/* User Company Spotlight Card */}
        {userCompany && userCompanyData && (
          <UserCompanyCard
            company={userCompanyData}
            rank={userCompanyIndex + 1}
            total={allCompanies.length}
          />
        )}
        {userCompany && !userCompanyData && (
          <UnknownCompanyCard companyName={userCompany} />
        )}

        {/* Tabs */}
        {showBothSections ? (
          <div className="px-5 flex gap-1 mb-2">
            <button
              onClick={() => setActiveTab('skills')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'skills'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="w-3 h-3" />
              Your Skill Area — {skillIndustry}
              <span className="text-[10px] font-bold ml-1 opacity-60">{skillCompanies.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('industry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'industry'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              Your Work Industry — {industry}
              <span className="text-[10px] font-bold ml-1 opacity-60">{industryCompanies.length}</span>
            </button>
          </div>
        ) : (
          <div className="px-5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Target className="w-3 h-3" />
              {industry} — {allCompanies.length} companies
            </span>
          </div>
        )}

        {/* Active section description */}
        {showBothSections && (
          <div className="px-5 mb-2">
            <p className="text-[11px] text-muted-foreground italic ml-1">
              {activeTab === 'skills'
                ? `Companies in ${skillIndustry} that match your core skills as a ${role}. These are the companies most directly competing for — or replacing — your skill set.`
                : `Companies in ${industry} where you've been working. Even if your skills are from a different field, these employers face their own AI disruption that affects your role.`}
            </p>
          </div>
        )}

        {/* Company list */}
        {allCompanies.length > 0 ? (
          <CompanyList companies={allCompanies} maxScore={maxScore} highlightIndex={userCompanyIndex} />
        ) : (
          <div className="px-5 py-4">
            <p className="text-sm text-muted-foreground text-center">No companies found for {activeTab === 'skills' ? skillIndustry : industry}.</p>
          </div>
        )}

        {/* Footer legend */}
        <div className="px-5 py-3 bg-muted/30 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-prophet-red" /> High Risk (65+)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-prophet-gold" /> Moderate (50-64)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-prophet-green" /> Lower (&lt;50)</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="w-3 h-3" /> Disruption Score
          </div>
        </div>
      </div>
    </motion.div>
  );
}