import React from 'react';
import { motion } from 'framer-motion';
import { Skull, ChevronRight, Radar } from 'lucide-react';
import { type ScanReport } from '@/lib/scan-engine';
import { Button } from '@/components/ui/button';
import StartupAutopsyCard from '@/components/StartupAutopsyCard';

interface StartupAutopsyPageProps {
  report: ScanReport;
  country?: string;
  onComplete: () => void;
}

const StartupAutopsyPage: React.FC<StartupAutopsyPageProps> = ({ report, country, onComplete }) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
            <Skull className="w-3.5 h-3.5" />
            STARTUP STRESS TEST
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            Will Your Idea Survive?
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            We'll find startups like yours that died, analyze why, and build you a battle-tested "Don't Die" playbook.
          </p>
        </motion.div>

        {/* Autopsy Card */}
        <StartupAutopsyCard report={report} country={country} />

        {/* Continue to Market Radar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center pt-4"
        >
          <Button onClick={onComplete} size="lg" className="gap-2 text-base font-bold px-8">
            <Radar className="w-4 h-4" />
            Continue to Live Market Radar
            <ChevronRight className="w-4 h-4" />
          </Button>
          <p className="text-[10px] text-muted-foreground mt-2">Your personalized career intelligence digest awaits</p>
        </motion.div>
      </div>
    </div>
  );
};

export default StartupAutopsyPage;
