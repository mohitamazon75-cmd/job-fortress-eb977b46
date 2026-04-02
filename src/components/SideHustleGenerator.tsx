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

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
    >
      <Card className={`border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
        (idea as any)._isMindBending ? 'border-violet-400/60 bg-gradient-to-br from-violet-50/40 via-fuchsia-50/20 to-background' :
        (idea as any)._isWildcard ? 'border-amber-300/60 bg-gradient-to-br from-amber-50/30 to-background' : 'border-border/60'
      }`}>
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <span className="text-3xl flex-shrink-0">{idea.emoji}</span>
              <div className="min-w-0">
                <CardTitle className="text-lg leading-tight">{idea.ideaName}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{idea.oneLineThesis}</p>
              </div>
            </div>
            {(idea as any)._isMindBending ? (
              <Badge className="flex-shrink-0 text-xs bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-200">
                🧠 Mind-Bending
              </Badge>
            ) : (idea as any)._isWildcard ? (
              <Badge className="flex-shrink-0 text-xs bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200">
                🎲 Lateral Play
              </Badge>
            ) : (
              <Badge variant="outline" className="flex-shrink-0 text-xs">
                #{index + 1}
              </Badge>
            )}
          </div>

          {/* Quick Stats Row */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="text-xs font-medium">
              {modelLabels[idea.businessModel] || idea.businessModel}
            </Badge>
            <Badge variant="outline" className={`text-xs ${diff.color}`}>
              {diff.label}
            </Badge>
            <Badge variant="outline" className={`text-xs ${confidenceColor} border-current/20`}>
              {idea.confidenceScore}% match
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Earnings Highlight */}
          <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-4 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Earnings Potential</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-foreground">
                {formatCurrency(idea.monthlyEarnings.realistic, idea.monthlyEarnings.currency)}
              </span>
              <span className="text-sm text-muted-foreground">/month realistic</span>
            </div>
            <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
              <span>Conservative: {formatCurrency(idea.monthlyEarnings.conservative, idea.monthlyEarnings.currency)}</span>
              <span>Upside: {formatCurrency(idea.monthlyEarnings.upside, idea.monthlyEarnings.currency)}</span>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs font-medium text-foreground">{idea.timeToFirstRevenue}</p>
              <p className="text-[10px] text-muted-foreground">First Revenue</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <DollarSign className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs font-medium text-foreground">{idea.startupCost}</p>
              <p className="text-[10px] text-muted-foreground">Startup Cost</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <Target className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs font-medium text-foreground">
                {formatCurrency(idea.pricing.min, idea.pricing.currency)} – {formatCurrency(idea.pricing.max, idea.pricing.currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">{idea.pricing.model}</p>
            </div>
          </div>

          {/* Why This Fits You */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold">Why This Fits You</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{idea.whyThisFits}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {idea.profileSignalsUsed.map((signal, i) => (
                <Badge key={i} variant="outline" className="text-[10px] bg-primary/5 border-primary/15 text-primary">
                  {signal}
                </Badge>
              ))}
            </div>
          </div>

          {/* Why Now */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-semibold">Why Now</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{idea.whyNow}</p>
          </div>

          {/* Target Buyer */}
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-1.5">
              <Users className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold">Target Buyer</h4>
            </div>
            <p className="text-sm text-muted-foreground">{idea.targetBuyer}</p>
            {idea.target_client && (
              <p className="text-xs text-foreground/70 mt-2 pt-2 border-t border-border">{idea.target_client}</p>
            )}
            <p className="text-sm text-foreground mt-1.5 font-medium">{idea.coreOffer}</p>
          </div>

          {/* Pricing & Timeline (India-specific) */}
          {(idea.pricing_inr || idea.time_to_first_10k_inr) && (
            <div className="grid grid-cols-2 gap-3">
              {idea.pricing_inr && (
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/[0.03]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Pricing (INR)</p>
                  <p className="text-sm font-bold text-foreground">{idea.pricing_inr}</p>
                </div>
              )}
              {idea.time_to_first_10k_inr && (
                <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">₹10K Timeline</p>
                  <p className="text-sm font-bold text-foreground">{idea.time_to_first_10k_inr}</p>
                </div>
              )}
            </div>
          )}

          {/* First Client Channels */}
          {idea.first_client_channels && idea.first_client_channels.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Client Channels</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.first_client_channels.map((ch, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-accent/50 border-accent/30">
                    {ch}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            className="w-full justify-between text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide Full Strategy' : 'View Full Strategy & Cheat Sheet'}
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">14-Day Launch Sprint</h4>
                  </div>
                  <div className="space-y-2">
                    {idea.launchSprint.map((step, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <Badge variant="outline" className="text-[10px] flex-shrink-0 mt-0.5 min-w-[60px] justify-center">
                          {step.day}
                        </Badge>
                        <p className="text-sm text-muted-foreground">{step.action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tool Stack */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">Tool Stack</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {idea.toolStack.map((tool, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tool}</Badge>
                    ))}
                  </div>
                </div>

                {/* Customer Channels */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">Customer Channels</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {idea.customerChannels.map((ch, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{ch}</Badge>
                    ))}
                  </div>
                </div>

                {/* AI Leverage */}
                <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">AI Leverage</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{idea.aiLeverage}</p>
                </div>

                {/* Moat + Risks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-semibold text-emerald-800">Your Moat</h4>
                    </div>
                    <p className="text-xs text-emerald-700">{idea.moat}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <h4 className="text-sm font-semibold text-amber-800">Risks</h4>
                    </div>
                    <ul className="text-xs text-amber-700 space-y-0.5">
                      {idea.risks.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Expansion Path */}
                <div className="p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">Scale-Up Path</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{idea.expansionPath}</p>
                </div>

                {/* ═══ CHEAT SHEET ═══ */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-primary fill-primary" />
                    <h4 className="text-base font-bold">Launch Cheat Sheet</h4>
                  </div>

                  <Accordion type="multiple" className="space-y-1">
                    {/* Offer Statement */}
                    <AccordionItem value="offer" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          Offer Statement
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="relative">
                          <p className="text-sm text-foreground font-medium bg-secondary/50 rounded-lg p-3 pr-10">
                            {idea.cheatSheet.offerStatement}
                          </p>
                          <button
                            onClick={() => copyToClipboard(idea.cheatSheet.offerStatement, 'offer')}
                            className="absolute top-2 right-2 p-1.5 rounded hover:bg-muted transition-colors"
                          >
                            {copiedField === 'offer' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Outreach Script */}
                    <AccordionItem value="outreach" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5 text-primary" />
                          Outreach Script
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="relative">
                          <p className="text-sm text-foreground bg-secondary/50 rounded-lg p-3 pr-10 whitespace-pre-line">
                            {idea.cheatSheet.outreachScript}
                          </p>
                          <button
                            onClick={() => copyToClipboard(idea.cheatSheet.outreachScript, 'outreach')}
                            className="absolute top-2 right-2 p-1.5 rounded hover:bg-muted transition-colors"
                          >
                            {copiedField === 'outreach' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Landing Page Headline */}
                    <AccordionItem value="headline" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Layout className="w-3.5 h-3.5 text-primary" />
                          Landing Page Headline
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-lg font-bold text-foreground text-center py-2">
                          "{idea.cheatSheet.landingPageHeadline}"
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Proof Assets */}
                    <AccordionItem value="proof" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-primary" />
                          First 3 Proof Assets
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ol className="space-y-1.5 text-sm text-muted-foreground">
                          {idea.cheatSheet.firstThreeProofAssets.map((a, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="font-bold text-primary text-xs mt-0.5">{i + 1}.</span>
                              {a}
                            </li>
                          ))}
                        </ol>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Where to Find Customers */}
                    <AccordionItem value="channels" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          5 Places to Find Customers
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ol className="space-y-1.5 text-sm text-muted-foreground">
                          {idea.cheatSheet.fivePlacesToFindCustomers.map((p, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="font-bold text-primary text-xs mt-0.5">{i + 1}.</span>
                              {p}
                            </li>
                          ))}
                        </ol>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Weekly Routine */}
                    <AccordionItem value="routine" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          Weekly Routine
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                          {idea.cheatSheet.weeklyRoutine.map((r, i) => (
                            <li key={i}>• {r}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Metrics */}
                    <AccordionItem value="metrics" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-3.5 h-3.5 text-primary" />
                          Metrics to Track
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-1.5">
                          {idea.cheatSheet.metricsToTrack.map((m, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* No-Response Plan */}
                    <AccordionItem value="fallback" className="border rounded-lg px-3">
                      <AccordionTrigger className="text-sm py-2.5 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-primary" />
                          Plan B (No Customers in 14 Days)
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm text-muted-foreground">{idea.cheatSheet.noResponsePlan}</p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
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
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Rocket className="w-3.5 h-3.5" />
            MARCH 2026 OPPORTUNITY INTELLIGENCE
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            4 Side Hustles Only You Can Build
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
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
            <span className="text-xs text-muted-foreground mr-1 self-center">Based on:</span>
            {hustleReport.profileFactorsUsed.slice(0, 8).map((factor, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{factor}</Badge>
            ))}
          </motion.div>
        )}

        {/* Idea Cards */}
        <div className="space-y-4">
          {hustleReport.ideas.slice(0, 3).map((idea, i) => (
            <IdeaCard key={i} idea={idea} index={i} />
          ))}
        </div>

        {/* Next: Startup Autopsy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center pt-4 pb-8"
        >
          <Button
            onClick={onComplete}
            size="lg"
            className="gap-2 px-8"
          >
            Next: Stress-Test Your Idea
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default SideHustleGenerator;
