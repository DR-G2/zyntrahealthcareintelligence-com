import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Eye, Clock, TrendingUp, AlertTriangle, Hand, RefreshCw, Globe, Smartphone, Monitor } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VisitorMetrics {
  totalVisitors: number;
  activeNow: number;
  returningVisitors: number;
  avgSessionTime: number;
  topPages: { page: string; views: number }[];
  highIntentUsers: any[];
  recentNudges: any[];
  funnelData: { stage: string; count: number }[];
  deviceBreakdown: { mobile: number; desktop: number };
  geoBreakdown: { country: string; city: string; count: number }[];
}

export function VisitorIntelligenceTab() {
  const [metrics, setMetrics] = useState<VisitorMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last5min = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

      // Parallel queries
      const [sessionsRes, pageViewsRes, intentsRes, nudgesRes, activeRes] = await Promise.all([
        supabase.from('visitor_sessions').select('*').gte('started_at', last24h).order('started_at', { ascending: false }).limit(500),
        supabase.from('page_views').select('page').gte('timestamp', last24h).limit(1000),
        supabase.from('intent_signals').select('*').eq('intent_level', 'high').gte('timestamp', last24h).order('timestamp', { ascending: false }).limit(50),
        supabase.from('nudge_signals').select('*').is('resolved_at', null).order('timestamp', { ascending: false }).limit(20),
        supabase.from('visitor_sessions').select('*').gte('started_at', last5min).is('ended_at', null).limit(50),
      ]);

      const sessions = (sessionsRes.data || []) as any[];
      const pageViews = (pageViewsRes.data || []) as any[];
      const highIntents = (intentsRes.data || []) as any[];
      const nudges = (nudgesRes.data || []) as any[];
      const activeSessions = (activeRes.data || []) as any[];

      // Compute metrics
      const uniqueVisitors = new Set(sessions.map(s => s.visitor_id)).size;
      const returning = sessions.filter(s => s.is_returning).length;
      const avgTime = sessions.length ? Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length) : 0;

      // Top pages
      const pageCounts: Record<string, number> = {};
      pageViews.forEach(pv => { pageCounts[pv.page] = (pageCounts[pv.page] || 0) + 1; });
      const topPages = Object.entries(pageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([page, views]) => ({ page, views }));

      // Device breakdown
      const mobile = sessions.filter(s => s.device_type === 'mobile').length;
      const desktop = sessions.filter(s => s.device_type === 'desktop').length;

      // Geo breakdown
      const geoCounts: Record<string, { country: string; city: string; count: number }> = {};
      sessions.forEach(s => {
        if (s.country) {
          const key = `${s.country}|${s.city || 'Unknown'}`;
          if (!geoCounts[key]) geoCounts[key] = { country: s.country, city: s.city || 'Unknown', count: 0 };
          geoCounts[key].count++;
        }
      });
      const geoBreakdown = Object.values(geoCounts).sort((a, b) => b.count - a.count).slice(0, 15);

      // Funnel
      const funnelPages = ['/', '/login', '/dashboard', '/practice', '/stations'];
      const funnelLabels = ['Landing', 'Login', 'Dashboard', 'MCQ Practice', 'OSCE Stations'];
      const funnelData = funnelPages.map((page, i) => ({
        stage: funnelLabels[i],
        count: pageViews.filter(pv => pv.page === page || pv.page?.startsWith(page + '/')).length || (page === '/' ? pageViews.filter(pv => pv.page === '/').length : 0),
      }));

      setMetrics({
        totalVisitors: uniqueVisitors,
        activeNow: activeSessions.length,
        returningVisitors: returning,
        avgSessionTime: avgTime,
        topPages,
        highIntentUsers: highIntents,
        recentNudges: nudges,
        funnelData,
        deviceBreakdown: { mobile, desktop },
        geoBreakdown,
      });
    } catch (e) {
      console.error('Failed to fetch visitor metrics:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMetrics(); }, []);

  // Real-time nudge subscription
  useEffect(() => {
    const channel = supabase
      .channel('nudge-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nudge_signals' }, (payload) => {
        setMetrics(prev => prev ? {
          ...prev,
          recentNudges: [payload.new, ...prev.recentNudges].slice(0, 20),
        } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Real-time high-intent subscription
  useEffect(() => {
    const channel = supabase
      .channel('intent-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'intent_signals', filter: 'intent_level=eq.high' }, (payload) => {
        setMetrics(prev => prev ? {
          ...prev,
          highIntentUsers: [payload.new, ...prev.highIntentUsers].slice(0, 50),
        } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Core Metrics */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold font-display">Visitor Intelligence</h3>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCard icon={Users} label="Total Visitors (24h)" value={metrics.totalVisitors} />
        <MetricCard icon={Eye} label="Active Now" value={metrics.activeNow} highlight />
        <MetricCard icon={TrendingUp} label="Returning" value={metrics.returningVisitors} />
        <MetricCard icon={Clock} label="Avg Session" value={`${metrics.avgSessionTime}s`} />
        <MetricCard icon={Hand} label="Waiting Nudges" value={metrics.recentNudges.length} highlight={metrics.recentNudges.length > 0} />
      </div>

      {/* Device Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Device Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Desktop: <strong>{metrics.deviceBreakdown.desktop}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Mobile: <strong>{metrics.deviceBreakdown.mobile}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20">
              {metrics.funnelData.map((f, i) => {
                const max = Math.max(...metrics.funnelData.map(d => d.count), 1);
                const height = Math.max(8, (f.count / max) * 100);
                return (
                  <div key={f.stage} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium">{f.count}</span>
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground text-center leading-tight">{f.stage}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Pages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Pages (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {metrics.topPages.map(p => (
              <div key={p.page} className="flex items-center justify-between text-sm py-1">
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{p.page}</code>
                <Badge variant="secondary">{p.views} views</Badge>
              </div>
            ))}
            {!metrics.topPages.length && <p className="text-sm text-muted-foreground">No page views yet</p>}
          </div>
        </CardContent>
      </Card>

      {/* High Intent Users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            🔥 High-Intent Users (Last 24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Visitor</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Page</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                {metrics.highIntentUsers.map((intent: any) => (
                  <TableRow key={intent.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(intent.timestamp), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {intent.user_id ? intent.user_id.slice(0, 8) + '...' : intent.visitor_id?.slice(0, 8) + '...'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-[10px]">{intent.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{intent.page}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{intent.metadata?.country || '—'}</TableCell>
                  </TableRow>
                ))}
                {!metrics.highIntentUsers.length && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No high-intent signals yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Nudge Panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Hand className="h-4 w-4 text-primary" />
            👀 Users Waiting Now
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-48">
            {metrics.recentNudges.length ? (
              <div className="space-y-2">
                {metrics.recentNudges.map((nudge: any) => (
                  <div key={nudge.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{nudge.message}</p>
                      <p className="text-xs text-muted-foreground">
                        Page: {nudge.page} · {formatDistanceToNow(new Date(nudge.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {nudge.user_id ? 'Logged in' : 'Anonymous'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No one waiting right now 🎉</p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/50' : ''}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
