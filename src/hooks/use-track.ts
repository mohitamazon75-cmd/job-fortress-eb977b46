import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTrack(scanId?: string) {
  const track = useCallback(async (event: string, props?: Record<string, unknown>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('behavior_events' as any).insert({
        user_id: session?.user?.id ?? null,
        scan_id: scanId ?? null,
        event_name: event,
        properties: props ?? {},
      });
    } catch {
      // Silent — never let tracking break the UI
    }
  }, [scanId]);

  return { track };
}
