import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function usePresence(userId: string | undefined) {
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const trackPresence = async (isOnline: boolean) => {
      await supabase.functions.invoke('track-presence', {
        body: { current_page: location.pathname, is_online: isOnline },
      });
    };

    // Initial heartbeat
    trackPresence(true);

    // Heartbeat every 60s (reduced from 30s)
    intervalRef.current = setInterval(() => trackPresence(true), 60000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackPresence(false);
      } else {
        trackPresence(true);
      }
    };

    const markOffline = () => trackPresence(false);

    window.addEventListener('beforeunload', markOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', markOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      markOffline();
    };
  }, [userId, location.pathname]);
}
