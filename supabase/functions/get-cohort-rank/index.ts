// get-cohort-rank: Returns a user's peer percentile vs others in same role + city
// Powers the CohortRankCard — the "safer than X% of peers" insight
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight(req);

  const corsHeaders = getCorsHeaders(req);

  try {
    const { userId, role, city, score } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Try materialized view first (fast)
    const { data: cohortRows } = await supabase
      .from('cohort_percentiles')
      .select('city_percentile, national_percentile, cohort_size, metro_tier')
      .eq('role_detected', role ?? '')
      .order('determinism_index', { ascending: false })
      .limit(100);

    let saferThanPct = 50; // fallback
    let cohortSize = 0;
    let cityLabel = city ?? 'your city';

    if (cohortRows && cohortRows.length > 0) {
      // Find the row closest to user's score
      const userScore = score ?? 50;
      // Count how many peers have a LOWER score than the user
      const { count: lowerCount } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('scan_status', 'complete')
        .eq('role_detected', role ?? '')
        .lt('determinism_index', userScore)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      const { count: totalCount } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('scan_status', 'complete')
        .eq('role_detected', role ?? '')
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      cohortSize = totalCount ?? cohortRows.length;
      saferThanPct = cohortSize > 0
        ? Math.round(((lowerCount ?? 0) / cohortSize) * 100)
        : 50;

      // City-specific calculation
      if (city) {
        const { count: cityLower } = await supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('scan_status', 'complete')
          .eq('role_detected', role ?? '')
          .ilike('metro_tier', `%${city.split(' ')[0]}%`)
          .lt('determinism_index', userScore)
          .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        const { count: cityTotal } = await supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('scan_status', 'complete')
          .eq('role_detected', role ?? '')
          .ilike('metro_tier', `%${city.split(' ')[0]}%`)
          .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        if ((cityTotal ?? 0) >= 10) {
          saferThanPct = Math.round(((cityLower ?? 0) / (cityTotal ?? 1)) * 100);
          cohortSize = cityTotal ?? cohortSize;
        }
      }
    } else {
      // Fallback: direct scan table query (slower but always works)
      const userScore = score ?? 50;
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { count: lowerCount } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('scan_status', 'complete')
        .eq('role_detected', role ?? '')
        .lt('determinism_index', userScore)
        .gte('created_at', cutoff);

      const { count: totalCount } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('scan_status', 'complete')
        .eq('role_detected', role ?? '')
        .gte('created_at', cutoff);

      cohortSize = totalCount ?? 0;
      saferThanPct = cohortSize > 5
        ? Math.round(((lowerCount ?? 0) / cohortSize) * 100)
        : 50; // not enough data
    }

    // Ensure minimum data threshold before showing real numbers
    const hasEnoughData = cohortSize >= 5;

    return new Response(
      JSON.stringify({
        safer_than_pct: hasEnoughData ? saferThanPct : 50,
        cohort_size: cohortSize,
        city_label: cityLabel,
        has_enough_data: hasEnoughData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[get-cohort-rank]', err);
    return new Response(
      JSON.stringify({ safer_than_pct: 50, cohort_size: 0, city_label: 'your city', has_enough_data: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
