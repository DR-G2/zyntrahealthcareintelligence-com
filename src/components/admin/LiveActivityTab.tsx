import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, RefreshCw, Brain, Search, AlertTriangle, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserStats {
  user_id: string;
  email: string;
  name: string;
  joined_at: string;
  total_questions: number;
  total_correct: number;
  overall_accuracy: number;
  total_osce: number;
  streak_days: number;
  last_active: string | null;
  ip_address: string | null;
  questions_today: number;
  osce_today: number;
}

export function LiveActivityTab() {
  const [stats, setStats] = useState<UserStats[]>([]);
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [lastRetrained, setLastRetrained] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSharedOnly, setShowSharedOnly] = useState(false);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, trainingRes] = await Promise.all([
        supabase.functions.invoke('admin-live-stats', { body: {} }),
        supabase.from('ai_training_context').select('updated_at').limit(1).maybeSingle(),
      ]);
      if (statsRes.error) throw statsRes.error;
      setStats(statsRes.data?.stats || []);
      setOnlineSet(new Set(statsRes.data?.online_user_ids || []));
      if (trainingRes.data) setLastRetrained(trainingRes.data.updated_at);
    } catch (e: any) {
      console.error('Failed to fetch user activity', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const { data, error } = await supabase.functions.invoke('retrain-ai-context');
      if (error) throw error;
      toast({ title: 'AI Context Refreshed', description: `Aggregated data from ${data?.candidate_count || 0} candidates` });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setRetraining(false);
  };

  // Shared IP detection
  const sharedIpMap = useMemo(() => {
    const ipUsers: Record<string, UserStats[]> = {};
    for (const s of stats) {
      if (!s.ip_address) continue;
      if (!ipUsers[s.ip_address]) ipUsers[s.ip_address] = [];
      ipUsers[s.ip_address].push(s);
    }
    const shared: Record<string, UserStats[]> = {};
    for (const [ip, users] of Object.entries(ipUsers)) {
      if (users.length >= 2) shared[ip] = users;
    }
    return shared;
  }, [stats]);

  const sharedIpCount = Object.keys(sharedIpMap).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = q ? stats.filter(s => s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : stats;
    if (showSharedOnly) {
      list = list.filter(s => s.ip_address && sharedIpMap[s.ip_address]);
    }
    return [...list].sort((a, b) => {
      const aOn = onlineSet.has(a.user_id) ? 1 : 0;
      const bOn = onlineSet.has(b.user_id) ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      if (a.last_active && b.last_active) return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
      if (a.last_active) return -1;
      if (b.last_active) return 1;
      return 0;
    });
  }, [stats, onlineSet, search, showSharedOnly, sharedIpMap]);

  const onlineCount = stats.filter(s => onlineSet.has(s.user_id)).length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{stats.length} Users · {onlineCount} Online</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleRetrain} disabled={retraining}>
              {retraining ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />}
              Retrain AI
            </Button>
          </div>
        </div>

        {lastRetrained && (
          <p className="text-xs text-muted-foreground">Last AI retrain: {new Date(lastRetrained).toLocaleString()}</p>
        )}

        {sharedIpCount > 0 && (
          <Alert variant="destructive" className="cursor-pointer" onClick={() => setShowSharedOnly(v => !v)}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              <span className="font-medium">{sharedIpCount} IP {sharedIpCount === 1 ? 'address' : 'addresses'} shared by multiple accounts</span>
              <Badge variant="outline" className="text-xs">{showSharedOnly ? 'Click to show all' : 'Click to filter'}</Badge>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {showSharedOnly && (
            <Button variant="secondary" size="sm" onClick={() => setShowSharedOnly(false)}>
              <Shield className="h-4 w-4 mr-1" /> Showing flagged only · Clear
            </Button>
          )}
        </div>

        {loading && stats.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading user activity...</CardContent></Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center w-16">Online</TableHead>
                  <TableHead className="text-right">MCQs</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">OSCE</TableHead>
                  <TableHead className="text-right">Streak</TableHead>
                  <TableHead className="text-right">Today MCQ</TableHead>
                  <TableHead className="text-right">Today OSCE</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                ) : filtered.map(s => {
                  const isShared = s.ip_address && sharedIpMap[s.ip_address];
                  const sharedUsers = isShared ? sharedIpMap[s.ip_address!].filter(u => u.user_id !== s.user_id) : [];

                  return (
                    <TableRow key={s.user_id} className={isShared ? 'bg-destructive/5' : ''}>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate font-medium text-sm">{s.name || s.email || s.user_id.slice(0, 8)}</div>
                        {s.name && <div className="truncate text-xs text-muted-foreground">{s.email}</div>}
                      </TableCell>
                      <TableCell className="text-center">
                        {onlineSet.has(s.user_id) && <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />}
                      </TableCell>
                      <TableCell className="text-right font-medium">{s.total_questions}</TableCell>
                      <TableCell className="text-right">
                        {s.total_questions > 0 ? (
                          <Badge variant={s.overall_accuracy >= 70 ? 'default' : s.overall_accuracy >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                            {s.overall_accuracy}%
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">{s.total_osce}</TableCell>
                      <TableCell className="text-right">{s.streak_days}d</TableCell>
                      <TableCell className="text-right text-xs">{s.questions_today}</TableCell>
                      <TableCell className="text-right text-xs">{s.osce_today}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.last_active ? new Date(s.last_active).toLocaleString() : '—'}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {s.ip_address ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{s.ip_address}</span>
                            {isShared && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 cursor-help">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Shared</Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <p className="font-semibold mb-1">Same IP as:</p>
                                  {sharedUsers.map(u => (
                                    <p key={u.user_id} className="text-xs">{u.name || u.email || u.user_id.slice(0, 8)}</p>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(s.joined_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
