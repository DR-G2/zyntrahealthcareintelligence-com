import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface TrainingNotification {
  id: string;
  user_id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_route: string | null;
  icon: string | null;
  priority: number;
  read_at: string | null;
  dismissed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useTrainingNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<TrainingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('training_notifications')
      .select('*')
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    
    const notifs = (data || []) as TrainingNotification[];
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.read_at).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Generate notifications on login
  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke('generate-training-notifications', {
      body: { trigger: 'login_check' },
    }).then(() => {
      // Refresh after generation
      setTimeout(fetchNotifications, 1000);
    });
  }, [user?.id]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from('training_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('training_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }, [user]);

  const dismiss = useCallback(async (id: string) => {
    await supabase
      .from('training_notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => {
      const waUnread = notifications.find(n => n.id === id && !n.read_at);
      return waUnread ? Math.max(0, prev - 1) : prev;
    });
  }, [notifications]);

  const triggerPostSession = useCallback(async (sessionData: { correct: number; total: number; avg_time: number }) => {
    await supabase.functions.invoke('generate-training-notifications', {
      body: { trigger: 'post_session', session_data: sessionData },
    });
    setTimeout(fetchNotifications, 1500);
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllRead,
    dismiss,
    triggerPostSession,
    refresh: fetchNotifications,
  };
}
