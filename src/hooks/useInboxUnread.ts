import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useInboxUnread() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      // Get threads for this candidate
      const { data: threads } = await supabase
        .from('admin_message_threads' as any)
        .select('id');

      if (!threads || threads.length === 0) { setCount(0); return; }

      const threadIds = (threads as any[]).map((t: any) => t.id);
      const { data: unread } = await supabase
        .from('admin_messages' as any)
        .select('id')
        .in('thread_id', threadIds)
        .eq('sender_role', 'admin')
        .is('read_at', null);

      setCount((unread as any[])?.length || 0);
    };

    fetchUnread();

    // Realtime updates
    const channel = supabase
      .channel('inbox-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return count;
}
