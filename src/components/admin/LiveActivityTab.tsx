import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Radio, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PresenceRow {
  user_id: string;
  current_page: string;
  is_online: boolean;
  last_seen_at: string;
}

interface UserStats {
  user_id: string;
  email: string;
  name: string;
  questions_today: number;
  accuracy_today: number;
  streak_days: number;
  osce_today: number;
}

export function LiveActivityTab() {
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [stats, setStats] = useState<Record<string, UserStats>>({});
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [lastRetrained, setLastRetrained] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPresence = async () => {
    const { data } = await supabase
      .from('user_presence')
      .select('*')
      .eq('is_online', true)
      .order('last_seen_at', { ascending: false });
    setPresence((data as PresenceRow[]) || []);
    return (data as PresenceRow[]) || [];
  };

  const fetchStats = async (onlineUsers: PresenceRow[]) => {
    if (onlineUsers.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-live-stats', {
        body: { user_ids: onlineUsers.map(u => u.user_id) },
      });
      if (error) throw error;
      const map: Record<string, UserStats> = {};
      (data?.stats || []).forEach((s: UserStats) => { map[s.user_id] = s; });
      setStats(map);
    } catch (e: any) {
      console.error('Failed to fetch live stats', e);
    }
    setLoading(false);
  };

  const fetchTrainingContext = async () => {
    const { data } = await supabase.from('ai_training_context').select('updated_at').limit(1).maybeSingle();
    if (data) setLastRetrained(data.updated_at);
  };

  useEffect(() => {
    fetchPresence().then(fetchStats);
    fetchTrainingContext();

    const channel = supabase
      .channel('admin-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
        fetchPresence().then(fetchStats);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const { data, error } = await supabase.functions.invoke('retrain-ai-context');
      if (error) throw error;
      toast({ title: 'AI Context Refreshed', description: `Aggregated data from ${data?.candidate_count || 0} candidates` });
      fetchTrainingContext();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setRetraining(false);
  };

  const pageLabel = (path: string) => {
    const map: Record<string, string> = {
      '/dashboard': 'Dashboard', '/practice': 'MCQ Practice', '/stations': 'OSCE Stations',
      '/assess': 'Assessment', '/study-plan': 'Study Plan', '/companion': 'Study Buddy',
      '/settings': 'Settings', '/profile': 'Profile', '/behavior-profile': 'Behavior Profile',
    };
    return map[path] || path;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 text-green-500 animate-pulse" />
          <h2 className="text-lg font-semibold">{presence.length} Active User{presence.length !== 1 ? 's' : ''}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchPresence().then(fetchStats)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleRetrain} disabled={retraining}>
            {retraining ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />}
            Retrain AI Now
          </Button>
        </div>
      </div>

      {lastRetrained && (
        <p className="text-xs text-muted-foreground">Last AI retrain: {new Date(lastRetrained).toLocaleString()}</p>
      )}

      {/* User Cards */}
      {presence.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No users currently online</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {presence.map(p => {
            const s = stats[p.user_id];
            return (
              <Card key={p.user_id} className="relative overflow-hidden">
                <div className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium truncate">{s?.email || s?.name || p.user_id.slice(0, 8)}</CardTitle>
                  <Badge variant="outline" className="w-fit text-xs">{pageLabel(p.current_page)}</Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  {s ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">MCQs today:</span> <span className="font-medium">{s.questions_today}</span></div>
                      <div><span className="text-muted-foreground">Accuracy:</span> <span className="font-medium">{s.accuracy_today}%</span></div>
                      <div><span className="text-muted-foreground">Streak:</span> <span className="font-medium">{s.streak_days}d</span></div>
                      <div><span className="text-muted-foreground">OSCE today:</span> <span className="font-medium">{s.osce_today}</span></div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Loading stats...</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">Seen {new Date(p.last_seen_at).toLocaleTimeString()}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
