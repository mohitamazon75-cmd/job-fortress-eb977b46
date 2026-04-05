// score-drift: Computes monthly living score drift for a user
// Shows how their career score has shifted since last scan due to market changes
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight(req);

  const corsHeaders = getCorsHeaders(req);

  // Validate cron secret — score-drift has verify_jwt=false, so guard against public abuse
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const reqSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (reqSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ drift: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get user's most recent completed scan
    const { data: lastScan } = await supabase
      .from('scans')
      .select('id, role_detected, industry, determinism_index, created_at, metro_tier, country')
      .eq('user_id', userId)
      .eq('scan_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastScan || lastScan.determinism_index == null) {
      return new Response(JSON.stringify({ drift: 0, currentScore: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get market signal change for this role since last scan
    const { data: signal } = await supabase
      .from('market_signals')
      .select('automation_risk_delta, demand_trend_delta, updated_at, job_family')
      .eq('job_family', lastScan.role_detected ?? '')
      .gte('updated_at', lastScan.created_at)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Market drift: rising automation risk = lower career score
    const automationDelta = signal?.automation_risk_delta ?? 0;
    const marketDrift = -(automationDelta * 0.3);

    // Time decay: gentle nudge to rescan after 2 months
    const monthsSinceScan =
      (Date.now() - new Date(lastScan.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
    const timeDecay = monthsSinceScan > 2 ? -((monthsSinceScan - 2) * 0.5) : 0;

    // Cohort shift: if peers are declining, user's relative position improves slightly
    const { data: cohortShift } = await supabase
      .from('score_events')
      .select('delta')
      .eq('user_id', userId)
      .eq('event_type', 'cohort_shift')
      .gte('computed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalDrift = parseFloat((marketDrift + timeDecay + (cohortShift?.delta ?? 0)).toFixed(2));
    const currentScore = Math.max(5, Math.min(95, lastScan.determinism_index + totalDrift));

    // Build human-readable reason
    let driftReason: string | null = null;
    if (Math.abs(totalDrift) >= 0.5) {
      if (Math.abs(marketDelta(automationDelta)) >= 0.5) {
        const dir = automationDelta > 0 ? 'accelerated' : 'slowed';
        driftReason = `AI adoption in ${lastScan.industry ?? 'your sector'} ${dir} ${Math.abs(Math.round(automationDelta))}% this month`;
      } else if (Math.abs(timeDecay) >= 0.5) {
        driftReason = `Your last scan was ${Math.round(monthsSinceScan)} months ago — rescan to refresh`;
      }

      // Log the event for the score timeline
      if (Math.abs(totalDrift) >= 0.5) {
        await supabase.from('score_events').insert({
          user_id: userId,
          scan_id: lastScan.id,
          event_type: automationDelta !== 0 ? 'market_drift' : 'time_decay',
          delta: totalDrift,
          reason: driftReason ?? 'Monthly recalibration',
        }).then(() => {/* fire and forget */});
      }
    }

    return new Response(
      JSON.stringify({
        currentScore: parseFloat(currentScore.toFixed(1)),
        baseScore: lastScan.determinism_index,
        drift: totalDrift,
        driftReason,
        monthsSinceScan: parseFloat(monthsSinceScan.toFixed(1)),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[score-drift]', err);
    return new Response(JSON.stringify({ drift: 0, error: String(err) }), {
      status: 200, // Return 200 so UI doesn't break — drift is optional
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function marketDelta(delta: number): number {
  return -(delta * 0.3);
}
