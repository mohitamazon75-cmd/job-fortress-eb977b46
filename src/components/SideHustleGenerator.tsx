import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, TrendingUp, Target, Zap, ChevronDown, ChevronUp,
  Copy, Check, ArrowRight, Sparkles, DollarSign, Clock,
  Users, Wrench, Shield, AlertTriangle, BarChart3, MapPin,
  Lightbulb, MessageSquare, Layout, Calendar, RefreshCw,
  Star, ExternalLink
} from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabase-config';
import { supabase } from '@/integrations/supabase/client';
import { getVerbatimRole } from '@/lib/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


interface SideHustleGeneratorProps {
  report: ScanReport;
  onComplete: () => void;
  country?: string;
}

interface SideHustleIdea {
  ideaName: string;
  emoji: string;
  oneLineThesis: string;
  businessModel: string;
  whyThisFits: string;
  whyNow: string;
  targetBuyer: string;
  target_client?: string;
  coreOffer: string;
  pricing: { min: number; max: number; currency: string; model: string };
  pricing_inr?: string;
  monthlyEarnings: { conservative: number; realistic: number; upside: number; currency: string };
  confidenceScore: number;
  timeToFirstRevenue: string;
  time_to_first_10k_inr?: string;
  startupCost: string;
  difficulty: 'low' | 'medium' | 'high';
  profileSignalsUsed: string[];
  first_client_channels?: string[];
  launchSprint: { day: string; action: string }[];
  customerChannels: string[];
  toolStack: string[];
  aiLeverage: string;
  moat: string;
  risks: string[];
  expansionPath: string;
  cheatSheet: {
    offerStatement: string;
    outreachScript: string;
    landingPageHeadline: string;
    firstThreeProofAssets: string[];
    fivePlacesToFindCustomers: string[];
    weeklyRoutine: string[];
    metricsToTrack: string[];
    noResponsePlan: string;
  };
}

interface SideHustleReport {
  executiveSummary: string;
  profileFactorsUsed: string[];
  ideas: SideHustleIdea[];
}

const LOADING_STAGES = [
  { text: 'Mapping your transferable skill primitives...', icon: Target, duration: 3000 },
  { text: 'Scanning March 2026 market gaps & platform shifts...', icon: TrendingUp, duration: 4000 },
  { text: 'Running lateral opportunity detection across 40+ industries...', icon: Zap, duration: 3500 },
  { text: 'Filtering for ideas only YOUR background can execute...', icon: BarChart3, duration: 3000 },
  { text: 'Assembling your personalized opportunity map...', icon: Sparkles, duration: 4000 },
];

const TRUST_MESSAGES = [
  { text: "3-stage parallel pipeline — LateralScout + dual AI agents", badge: "Architecture" },
  { text: "Each idea scored on 10 dimensions with anti-generic penalties", badge: "Quality Gate" },
  { text: "Outdated AI references auto-rejected — 2026 tools only", badge: "Current Intel" },
  { text: "India-specific pricing (₹) + timeline to ₹10K milestone", badge: "Localized" },
  { text: "Business model diversity enforced across all 3 ideas", badge: "Diversification" },
  { text: "Every idea must cite ≥2 profile signals + market timing", badge: "Evidence-Based" },
  { text: "14-day launch sprint with specific 2026 tools at each step", badge: "Action-Ready" },
  { text: "Outreach scripts & landing page copy ready to deploy today", badge: "Copy Engine" },
  { text: "Ideas must pass the 'Would a stranger pay in 48 hours?' test", badge: "Revenue Test" },
  { text: "Target client personas tailored to your skill set and market", badge: "Hyper-Targeted" },
];

const difficultyConfig = {
  low: { label: 'Easy Start', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium: { label: 'Moderate', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  high: { label: 'Advanced', color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const modelLabels: Record<string, string> = {
  productized_service: '🎯 Productized Service',
  micro_agency: '🏢 Micro Agency',
  template: '📄 Templates & Assets',
  tooling: '🔧 SaaS / Tooling',
  marketplace: '🛒 Marketplace',
  local_service: '📍 Local Service',
  content_plus_service: '📝 Content + Service',
  community: '👥 Community',
  ai_wrapper: '🤖 AI-Powered Tool',
  data_arbitrage: '📊 Data Arbitrage',
};

function formatCurrency(amount: number, currency: string): string {
  if (currency.includes('INR') || currency.includes('₹')) {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  if (currency.includes('USD') || currency.includes('$')) {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString('en-US')}`;
  }
  return `${amount.toLocaleString()}`;
}

// ═══ LOADING STATE ═══
function SideHustleLoading({ stage }: { stage: number }) {
  const current = LOADING_STAGES[Math.min(stage, LOADING_STAGES.length - 1)];
  const Icon = current.icon;
  const [trustIndex, setTrustIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrustIndex(prev => (prev + 1) % TRUST_MESSAGES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const trustMsg = TRUST_MESSAGES[trustIndex];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full text-center space-y-8"
      >
        {/* Animated icon */}
        <div className="relative mx-auto w-20 h-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-2xl border-2 border-primary/20"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute inset-1 rounded-xl border border-primary/10"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              key={stage}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Icon className="w-8 h-8 text-primary" />
            </motion.div>
          </div>
        </div>

        {/* Stage text */}
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-lg font-semibold text-foreground"
            >
              {current.text}
            </motion.p>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex gap-1.5 justify-center">
            {LOADING_STAGES.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= stage ? 'w-8 bg-primary' : 'w-4 bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Rotating trust messages */}
        <div className="min-h-[80px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={trustIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="rounded-xl border border-primary/15 bg-primary/[0.03] px-5 py-4"
            >
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold text-primary uppercase tracking-wider">
                  <Shield className="w-3 h-3" />
                  {trustMsg.badge}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {trustMsg.text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Elapsed time */}
        <p className="text-xs text-muted-foreground">
          {elapsedSec < 30
            ? "Building your strategy report..."
            : elapsedSec < 60
            ? "Deep analysis takes ~60s — quality over speed."
            : elapsedSec < 120
            ? `Still working (${elapsedSec}s) — complex profiles take longer.`
            : `Almost there (${elapsedSec}s) — you can safely leave and return.`
          }
        </p>
      </motion.div>
    </div>
  );
}

// ═══ IDEA CARD ═══
function IdeaCard({ idea, index }: { idea: SideHustleIdea; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const diff = difficultyConfig[idea.difficulty] || difficultyConfig.medium;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const confidenceColor = idea.confidenceScore >= 80 ? 'text-emerald-600' : idea.confidenceScore >= 65 ? 'text-amber-600' : 'text-rose-600';

  const isMindBending = (idea as any)._isMindBending;
  const isWildcard = (idea as any)._isWildcard;

  const cardAccent = isMindBending
    ? 'from-violet-500 via-fuchsia-500 to-purple-600'
    : isWildcard
    ? 'from-amber-400 via-orange-500 to-amber-600'
    : index === 0
    ? 'from-primary via-blue-500 to-indigo-600'
    : 'from-slate-400 via-slate-500 to-slate-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.18, type: 'spring', stiffness: 100 }}
    >
      <div className="relative group">
        {/* Glow effect on hover */}
        <div className={`absolute -inset-0.5 bg-gradient-to-r ${cardAccent} rounded-2xl blur-sm opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
        
        <Card className={`relative border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden bg-card ${
          isMindBending ? 'ring-1 ring-violet-300/40' :
          isWildcard ? 'ring-1 ring-amber-300/40' : 'ring-1 ring-border/40'
        }`}>
          {/* Top accent gradient bar */}
          <div className={`h-1 bg-gradient-to-r ${cardAccent}`} />

          {/* Header */}
          <CardHeader className="pb-2 pt-5 px-5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5 flex-1">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cardAccent} flex items-center justify-center text-white text-2xl flex-shrink-0 shadow-md`}>
                  {idea.emoji}
                </div>
                <div className="min-w-0 pt-0.5">
                  <CardTitle className="text-lg sm:text-xl font-bold leading-tight tracking-tight">{idea.ideaName}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{idea.oneLineThesis}</p>
                </div>
              </div>
              {isMindBending ? (
                <Badge className="flex-shrink-0 text-xs bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-800 border-violet-300/50 hover:bg-violet-200 shadow-sm">
                  🧠 Mind-Bending
                </Badge>
              ) : isWildcard ? (
                <Badge className="flex-shrink-0 text-xs bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-amber-300/50 hover:bg-amber-200 shadow-sm">
                  🎲 Lateral Play
                </Badge>
              ) : (
                <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${cardAccent} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  #{index + 1}
                </div>
              )}
            </div>

            {/* Quick Stats Row */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge className="text-xs font-semibold bg-secondary/80 text-secondary-foreground border-0 shadow-sm">
                {modelLabels[idea.businessModel] || idea.businessModel}
              </Badge>
              <Badge className={`text-xs font-medium border-0 shadow-sm ${diff.color}`}>
                {diff.label}
              </Badge>
              <Badge className={`text-xs font-bold border-0 shadow-sm bg-white/80 ${confidenceColor}`}>
                {idea.confidenceScore}% match
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-2 px-5 sm:px-6 pb-5">
            {/* Earnings Highlight — Hero Section */}
            <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-accent/[0.04] to-primary/[0.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
              <div className="relative p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Monthly Earnings Potential</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                    {formatCurrency(idea.monthlyEarnings.realistic, idea.monthlyEarnings.currency)}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">/month realistic</span>
                </div>
                <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Conservative: {formatCurrency(idea.monthlyEarnings.conservative, idea.monthlyEarnings.currency)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Upside: {formatCurrency(idea.monthlyEarnings.upside, idea.monthlyEarnings.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Clock, value: idea.timeToFirstRevenue, label: 'First Revenue', color: 'from-blue-50 to-indigo-50 border-blue-100' },
                { icon: DollarSign, value: idea.startupCost, label: 'Startup Cost', color: 'from-emerald-50 to-teal-50 border-emerald-100' },
                { icon: Target, value: `${formatCurrency(idea.pricing.min, idea.pricing.currency)} – ${formatCurrency(idea.pricing.max, idea.pricing.currency)}`, label: idea.pricing.model, color: 'from-purple-50 to-violet-50 border-purple-100' },
              ].map((item, i) => (
                <div key={i} className={`text-center p-3 rounded-xl bg-gradient-to-br ${item.color} border`}>
                  <item.icon className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-foreground leading-tight">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Why This Fits You */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <h4 className="text-sm font-bold tracking-tight">Why This Fits You</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-7">{idea.whyThisFits}</p>
              <div className="flex flex-wrap gap-1.5 pl-7">
                {idea.profileSignalsUsed.map((signal, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary font-medium">
                    {signal}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Why Now */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                </div>
                <h4 className="text-sm font-bold tracking-tight">Why Now</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-7">{idea.whyNow}</p>
            </div>

            {/* Target Buyer */}
            <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-background">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="w-3 h-3 text-primary" />
                </div>
                <h4 className="text-sm font-bold tracking-tight">Target Buyer</h4>
              </div>
              <p className="text-sm text-muted-foreground pl-7">{idea.targetBuyer}</p>
              {idea.target_client && (
                <p className="text-xs text-foreground/70 mt-2.5 pt-2.5 border-t border-border/50 pl-7">{idea.target_client}</p>
              )}
              <p className="text-sm text-foreground mt-2 font-semibold pl-7">{idea.coreOffer}</p>
            </div>

            {/* Pricing & Timeline (India-specific) */}
            {(idea.pricing_inr || idea.time_to_first_10k_inr) && (
              <div className="grid grid-cols-2 gap-3">
                {idea.pricing_inr && (
                  <div className="p-3.5 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] to-transparent">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">Pricing (INR)</p>
                    <p className="text-sm font-bold text-foreground">{idea.pricing_inr}</p>
                  </div>
                )}
                {idea.time_to_first_10k_inr && (
                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] to-transparent">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5">₹10K Timeline</p>
                    <p className="text-sm font-bold text-foreground">{idea.time_to_first_10k_inr}</p>
                  </div>
                )}
              </div>
            )}

            {/* First Client Channels */}
            {idea.first_client_channels && idea.first_client_channels.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">First Client Channels</p>
                <div className="flex flex-wrap gap-1.5">
                  {idea.first_client_channels.map((ch, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-accent/30 border-accent/20 font-medium">
                      {ch}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Expand/Collapse */}
            <Button
              variant="outline"
              className={`w-full justify-between text-sm font-semibold rounded-xl h-11 transition-all duration-200 ${
                expanded
                  ? 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10'
                  : 'hover:bg-secondary/80 border-border/60'
              }`}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide Full Strategy' : '📋 View Full Strategy & Cheat Sheet'}
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden space-y-4"
                >
                  {/* 14-Day Launch Sprint */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <Rocket className="w-3 h-3 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold tracking-tight">14-Day Launch Sprint</h4>
                    </div>
                    <div className="space-y-2 pl-7">
                      {idea.launchSprint.map((step, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <Badge className="text-[10px] flex-shrink-0 mt-0.5 min-w-[60px] justify-center bg-primary/10 text-primary border-primary/20 font-bold">
                            {step.day}
                          </Badge>
                          <p className="text-sm text-muted-foreground leading-relaxed">{step.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tool Stack */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <Wrench className="w-3 h-3 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold tracking-tight">Tool Stack</h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-7">
                      {idea.toolStack.map((tool, i) => (
                        <Badge key={i} className="text-xs bg-secondary/80 text-secondary-foreground border-0">{tool}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Customer Channels */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold tracking-tight">Customer Channels</h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-7">
                      {idea.customerChannels.map((ch, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-medium">{ch}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* AI Leverage */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-primary/[0.06] via-accent/[0.03] to-transparent border border-primary/15">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <Zap className="w-3 h-3 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold tracking-tight">AI Leverage</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-7">{idea.aiLeverage}</p>
                  </div>

                  {/* Moat + Risks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/60">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-emerald-800">Your Moat</h4>
                      </div>
                      <p className="text-xs text-emerald-700 leading-relaxed">{idea.moat}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/60">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h4 className="text-sm font-bold text-amber-800">Risks</h4>
                      </div>
                      <ul className="text-xs text-amber-700 space-y-1 leading-relaxed">
                        {idea.risks.map((r, i) => <li key={i}>• {r}</li>)}
                      </ul>
                    </div>
                  </div>

                  {/* Expansion Path */}
                  <div className="p-4 rounded-xl border border-border/60 bg-gradient-to-br from-muted/20 to-background">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="w-3 h-3 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold tracking-tight">Scale-Up Path</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-7">{idea.expansionPath}</p>
                  </div>

                  {/* ═══ CHEAT SHEET ═══ */}
                  <div className="border-t-2 border-dashed border-border/50 pt-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-sm">
                        <Star className="w-4 h-4 text-white fill-white" />
                      </div>
                      <h4 className="text-base font-black tracking-tight">Launch Cheat Sheet</h4>
                    </div>

                    <Accordion type="multiple" className="space-y-1.5">
                      {/* Offer Statement */}
                      <AccordionItem value="offer" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-primary" />
                            Offer Statement
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="relative">
                            <p className="text-sm text-foreground font-medium bg-background rounded-lg p-3.5 pr-10 border border-border/40 shadow-sm">
                              {idea.cheatSheet.offerStatement}
                            </p>
                            <button
                              onClick={() => copyToClipboard(idea.cheatSheet.offerStatement, 'offer')}
                              className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-muted transition-colors"
                            >
                              {copiedField === 'offer' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Outreach Script */}
                      <AccordionItem value="outreach" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                            Outreach Script
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="relative">
                            <p className="text-sm text-foreground bg-background rounded-lg p-3.5 pr-10 whitespace-pre-line border border-border/40 shadow-sm">
                              {idea.cheatSheet.outreachScript}
                            </p>
                            <button
                              onClick={() => copyToClipboard(idea.cheatSheet.outreachScript, 'outreach')}
                              className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-muted transition-colors"
                            >
                              {copiedField === 'outreach' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Landing Page Headline */}
                      <AccordionItem value="headline" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Layout className="w-3.5 h-3.5 text-primary" />
                            Landing Page Headline
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-lg font-black text-foreground text-center py-3 tracking-tight">
                            "{idea.cheatSheet.landingPageHeadline}"
                          </p>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Proof Assets */}
                      <AccordionItem value="proof" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-3.5 h-3.5 text-primary" />
                            First 3 Proof Assets
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ol className="space-y-2 text-sm text-muted-foreground">
                            {idea.cheatSheet.firstThreeProofAssets.map((a, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                <span className="leading-relaxed">{a}</span>
                              </li>
                            ))}
                          </ol>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Where to Find Customers */}
                      <AccordionItem value="channels" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            5 Places to Find Customers
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ol className="space-y-2 text-sm text-muted-foreground">
                            {idea.cheatSheet.fivePlacesToFindCustomers.map((p, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                <span className="leading-relaxed">{p}</span>
                              </li>
                            ))}
                          </ol>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Weekly Routine */}
                      <AccordionItem value="routine" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                            Weekly Routine
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {idea.cheatSheet.weeklyRoutine.map((r, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-2" />
                                <span className="leading-relaxed">{r}</span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Metrics */}
                      <AccordionItem value="metrics" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5 text-primary" />
                            Metrics to Track
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-wrap gap-1.5">
                            {idea.cheatSheet.metricsToTrack.map((m, i) => (
                              <Badge key={i} className="text-xs bg-secondary/80 text-secondary-foreground border-0">{m}</Badge>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* No-Response Plan */}
                      <AccordionItem value="fallback" className="border rounded-xl px-3.5 border-border/50 bg-muted/20">
                        <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 text-primary" />
                            Plan B (No Customers in 14 Days)
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-muted-foreground leading-relaxed">{idea.cheatSheet.noResponsePlan}</p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}


// ═══ MAIN COMPONENT ═══
const SideHustleGenerator: React.FC<SideHustleGeneratorProps> = ({ report, onComplete, country }) => {
  const [phase, setPhase] = useState<'loading' | 'results' | 'error'>('loading');
  const [loadingStage, setLoadingStage] = useState(0);
  const [hustleReport, setHustleReport] = useState<SideHustleReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setPhase('loading');
    setLoadingStage(0);
    setError(null);

    // Progress animation
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    LOADING_STAGES.forEach((s, i) => {
      if (i === 0) return;
      elapsed += LOADING_STAGES[i - 1].duration;
      stageTimers.push(setTimeout(() => setLoadingStage(i), elapsed));
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-side-hustles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ report: { ...report, role: getVerbatimRole(report) }, country }),
        }
      );

      stageTimers.forEach(clearTimeout);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 402 || errData.code === 'SUBSCRIPTION_REQUIRED') {
          const { toast } = await import('sonner');
          toast.error('This feature requires a Pro subscription');
          setPhase('error');
          setError('Pro subscription required');
          return;
        }
        throw new Error(errData.error || `Failed (${resp.status})`);
      }

      const result = await resp.json();

      if (!result.ideas || !Array.isArray(result.ideas) || result.ideas.length === 0) {
        throw new Error('No ideas generated');
      }

      setHustleReport(result);
      setLoadingStage(LOADING_STAGES.length - 1);

      // Brief pause then show results
      setTimeout(() => setPhase('results'), 800);
    } catch (err: any) {
      stageTimers.forEach(clearTimeout);
      console.error('[SideHustleGenerator] Error:', err);
      setError(err.message || 'Failed to generate ideas');
      setPhase('error');
    }
  }, [report, country]);

  useEffect(() => {
    generate();
  }, [generate]);

  if (phase === 'loading') {
    return <SideHustleLoading stage={loadingStage} />;
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Couldn't Generate Ideas</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={generate}>Retry</Button>
            <Button variant="outline" onClick={onComplete}>Skip to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hustleReport) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-muted/20">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-xs font-bold tracking-wider border border-primary/10 shadow-sm"
          >
            <Rocket className="w-3.5 h-3.5" />
            APRIL 2026 OPPORTUNITY INTELLIGENCE
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight leading-tight">
            Side Hustles Only <span className="bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">You</span> Can Build
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {hustleReport.executiveSummary}
          </p>
        </motion.div>

        {/* Profile Factors Used */}
        {hustleReport.profileFactorsUsed && hustleReport.profileFactorsUsed.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-1.5 justify-center"
          >
            <span className="text-xs text-muted-foreground mr-1 self-center font-medium">Based on:</span>
            {hustleReport.profileFactorsUsed.slice(0, 8).map((factor, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-medium bg-background/80">{factor}</Badge>
            ))}
          </motion.div>
        )}

        {/* Idea Cards */}
        <div className="space-y-6">
          {hustleReport.ideas.slice(0, 3).map((idea, i) => (
            <IdeaCard key={i} idea={idea} index={i} />
          ))}
        </div>

        {/* Next CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center pt-6 pb-10"
        >
          <Button
            onClick={onComplete}
            size="lg"
            className="gap-2.5 px-10 h-13 text-base font-bold rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30"
          >
            Next: Stress-Test Your Idea
            <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default SideHustleGenerator;
