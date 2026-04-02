import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function ShareScan() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<{ score: number; role: string; industry: string } | null>(null);

  useEffect(() => {
    if (!scanId) return;
    const fetchMeta = async () => {
      // Use a SECURITY DEFINER RPC that returns only safe preview fields —
      // never the full final_json_report blob which may contain PII.
      // @ts-expect-error — RPC type will be added after Supabase types regeneration
      const { data } = await supabase
        .rpc('get_scan_share_preview', { scan_id: scanId })
        .maybeSingle();

      if (data) {
        setMeta({
          score: (data as any).score ?? 50,
          role: (data as any).role || 'Professional',
          industry: (data as any).industry || 'Technology',
        });
      }
    };
    fetchMeta();
  }, [scanId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span className="text-4xl">🛡️</span>
        </div>
        {meta ? (
          <>
            <h1 className="text-3xl font-black text-foreground">Score: {meta.score}/100</h1>
            <p className="text-muted-foreground">
              {meta.role} in {meta.industry}
            </p>
          </>
        ) : (
          <h1 className="text-2xl font-black text-foreground">AI Career Position Score™</h1>
        )}
        <p className="text-muted-foreground text-sm">
          Someone shared their career safety analysis. Want to check yours?
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all"
        >
          Check Your Score — Free
        </button>
      </div>
    </div>
  );
}
