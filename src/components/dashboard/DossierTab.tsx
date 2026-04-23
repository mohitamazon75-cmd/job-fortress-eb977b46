import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import FooterSection from '@/components/dashboard/FooterSection';
import type { DashboardSharedProps } from '@/components/dashboard/DashboardTypes';

const CheatSheet = lazy(() => import('@/components/dashboard/CheatSheet'));
const CareerResilienceEngine = lazy(() => import('@/components/dashboard/CareerResilienceEngine'));
// Career Genome hidden — to re-enable, uncomment this import and the JSX block below.
// const CareerGenomeDebate = lazy(() => import('@/components/dashboard/CareerGenomeDebate'));

export default function DossierTab({ props }: { props: DashboardSharedProps }) {
  const {
    report, scanId, country,
    enrichment, kgLastRefresh, kgMatched,
  } = props;

  return (
    <Suspense fallback={<div className="animate-pulse space-y-4 py-8">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted" />)}</div>}>
      <motion.div
        key="cheatsheet"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-10"
      >
        {/* Career Genome Sequencer — hidden to save tokens & focus on Resume Weaponizer */}
        {/* <CareerGenomeDebate report={report} scanId={scanId} /> */}

        {/* Career Resilience Engine — Calm Tech command center */}
        <CareerResilienceEngine report={report} country={country} />

        {/* Existing Cheat Sheet */}
        <CheatSheet
          report={report}
          scanId={scanId}
          country={country}
        />

        {/* Footer */}
        <FooterSection 
          enrichment={enrichment} 
          kgLastRefresh={kgLastRefresh} 
          kgMatched={kgMatched} 
          scanId={scanId}
          report={report}
        />
      </motion.div>
    </Suspense>
  );
}
