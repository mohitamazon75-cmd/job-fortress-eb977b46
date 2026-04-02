import { useState } from 'react';
import { Shield, Trash2, Loader2 } from 'lucide-react';
import { ScanReport } from '@/lib/scan-engine';
import FeedbackButtons from '@/components/dashboard/FeedbackButtons';
import ReportChat from '@/components/dashboard/ReportChat';
import FeedbackWidget from '@/components/dashboard/FeedbackWidget';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FooterSectionProps {
  enrichment: any;
  kgLastRefresh: string | null;
  kgMatched: number;
  scanId: string;
  report: ScanReport;
}

export default function FooterSection({ enrichment, kgLastRefresh, kgMatched, scanId, report }: FooterSectionProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteMyData = async () => {
    if (!window.confirm('Are you sure you want to permanently delete ALL your data? This action cannot be undone.')) return;
    if (!window.confirm('This will delete your account, all scans, and all associated data. Confirm again to proceed.')) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-my-data');
      if (error) throw error;
      toast.success('All your data has been permanently deleted.');
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete data. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <>
      {/* IP Transparency */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-bold text-primary">
            <Shield className="w-3.5 h-3.5" />
            JobBachao Engine v3.2
          </span>
          <span className="hidden md:inline text-border">|</span>
          <span>Numbers: <span className="font-semibold text-foreground">100% Algorithmic</span></span>
          <span className="hidden md:inline text-border">|</span>
          <span>Strategy: <span className="font-semibold text-foreground">AI-Assisted</span></span>
          {kgMatched > 0 && (
            <>
              <span className="hidden md:inline text-border">|</span>
              <span>{kgMatched} skills matched in Knowledge Graph</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <p className="text-[10px] text-muted-foreground">
            Every numerical output is deterministically computed from structured data. Zero LLM-generated numbers.
          </p>
        </div>
      </div>

      {/* Feedback Widget */}
      <FeedbackWidget scanId={scanId} />

      {/* Disclaimer */}
      <div className="mb-6 rounded-xl border border-border bg-muted/50 p-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-semibold">⚠️ Important Disclaimer:</span> This analysis uses algorithmic models and AI-assisted interpretation. All scores indicate <em>estimated trends</em>, not certainties. Individual outcomes vary significantly based on factors we cannot measure. This is not financial, legal, or career advice. Always consult qualified professionals before making career decisions.
        </p>
      </div>

      {/* Data Retention & Privacy */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">🔒 Your Data & Privacy</p>
            <p>Your data is retained for 90 days then auto-deleted. You can request immediate deletion at any time.</p>
          </div>
          <button
            onClick={handleDeleteMyData}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold hover:bg-destructive/10 transition-colors disabled:opacity-50 whitespace-nowrap min-h-[44px]"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {deleting ? 'Deleting...' : 'Delete My Data'}
          </button>
        </div>
      </div>

      {/* Chat with Report FAB */}
      <ReportChat scanId={scanId} />
    </>
  );
}
