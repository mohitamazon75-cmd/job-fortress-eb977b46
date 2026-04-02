'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

interface FreeActionCardProps {
  score: number;
  roleName: string;
  moatSkills: string[];
  primaryVulnerability?: string;
  judoTool?: string;
  onUpgrade: () => void;
}

export default function FreeActionCard({
  score,
  roleName,
  moatSkills,
  primaryVulnerability,
  judoTool,
  onUpgrade,
}: FreeActionCardProps) {
  const coreSkill = moatSkills[0] || 'core';
  const tool = judoTool || 'AI tools';

  const actionText = `Learn to use ${tool} in your ${coreSkill} work — ${roleName} professionals who direct AI rather than compete with it earn significantly more right now.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="space-y-4"
    >
      {/* ── #1 Move This Month ── */}
      <div className="bg-prophet-green/[0.06] border border-prophet-green/20 rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-prophet-green">
          🎯 Your #1 Move This Month
        </p>
        <p className="text-sm font-bold text-foreground leading-snug">
          {actionText}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Your full 90-day plan has 4 more targeted actions →
        </p>
      </div>

      {/* ── Pro Upgrade Teaser — value-first ── */}
      <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.04] p-5 text-center space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-primary">
          Your Full Defense Plan
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          5 targeted actions · resume upgrade · salary negotiation script · best-fit jobs · AI debate analysis
        </p>
        <motion.button
          onClick={onUpgrade}
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full py-3.5 px-4 rounded-xl text-primary-foreground font-black text-sm flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary shadow-md hover:shadow-lg"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-primary)' }}
        >
          <Lock className="w-4 h-4 mr-2" />
          See My Full Plan — ₹300/month
        </motion.button>
        <p className="text-[10px] text-muted-foreground">
          ₹10/day · Cancel anytime · No commitment
        </p>
      </div>
    </motion.div>
  );
}
