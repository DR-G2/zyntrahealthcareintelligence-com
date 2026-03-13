import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getCachedStations, cacheStations, CachedStation } from '@/lib/osce-cache';

const TARGET_CACHE_SIZE = 10;

export function useOSCEPreload() {
  const { user, profile } = useAuth();
  const preloadingRef = useRef(false);

  const preload = useCallback(async () => {
    if (!user || preloadingRef.current) return;

    try {
      const cached = await getCachedStations();
      if (cached.length >= TARGET_CACHE_SIZE) return;

      preloadingRef.current = true;
      const needed = TARGET_CACHE_SIZE - cached.length;
      const excludeIds = cached.map(s => s.station_id);

      const weakAreas = profile?.weak_areas || [];

      const { data, error } = await supabase.functions.invoke('preload-osce-stations', {
        body: {
          count: needed,
          exclude_ids: excludeIds,
          weak_areas: weakAreas,
        },
      });

      if (error || !data?.stations) {
        console.warn('OSCE preload failed:', error);
        return;
      }

      const toCache: CachedStation[] = (data.stations as any[]).map(s => ({
        station_id: s.id || s.station_id || crypto.randomUUID(),
        title: s.scenario_title || s.title || 'Untitled Station',
        scenario_data: s.scenario_data || s,
        candidate_instructions: s.candidate_instructions || null,
        examiner_instructions: s.examiner_instructions || null,
        marking_checklist: s.marking_checklist || [],
        subject: s.subject || 'General',
        difficulty: s.difficulty || 'medium',
        cached_at: Date.now(),
      }));

      await cacheStations(toCache);
    } catch (e) {
      console.warn('OSCE preload error:', e);
    } finally {
      preloadingRef.current = false;
    }
  }, [user, profile?.weak_areas]);

  // Preload on mount (login / page open)
  useEffect(() => {
    if (!user) return;
    const id = 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(() => preload())
      : setTimeout(() => preload(), 2000);
    return () => {
      if ('cancelIdleCallback' in window) (window as any).cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [user, preload]);

  return { preload };
}
