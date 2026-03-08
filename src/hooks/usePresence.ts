import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function usePresence(userId: string | undefined) {
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const upsert = async () => {
      await supabase.from('user_presence').upsert(
        {
          user_id: userId,
          current_page: location.pathname,
          is_online: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    };

    // Initial heartbeat
    upsert();

    // Heartbeat every 30s
    intervalRef.current = setInterval(upsert, 30000);

    // Mark offline on unmount / tab close
    const markOffline = async () => {
      await supabase.from('user_presence').update({ is_online: false }).eq('user_id', userId);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        markOffline();
      } else {
        upsert();
      }
    };

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
