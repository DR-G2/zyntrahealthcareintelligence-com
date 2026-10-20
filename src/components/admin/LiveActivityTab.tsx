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

export function LiveActivityTab({ onOpenSystem }: { onOpenSystem?: () => void }) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [lastRetrained, setLastRetrained] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSharedOnly, setShowSharedOnly] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [statsRes, trainingRes] = await Promise.all([
        supabase.functions.invoke('admin-live-stats', { body: {} }),
        supabase.from('ai_training_context').select('updated_at').limit(1).maybeSingle(),
      ]);
      if (statsRes.error) throw statsRes.error;
      if (statsRes.data?.error) throw new Error(statsRes.data.error);
      setHasLoaded(true);
      setStats(statsRes.data?.stats || []);
      setOnlineSet(new Set(statsRes.data?.online_user_ids || []));
      if (trainingRes.data) setLastRetrained(trainingRes.data.updated_at);
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e ?? 'Unknown error');
      const plainReason = /admin[\\s_-]*roles?|schema cache|relation .* does not exist|column .* does not exist|permission denied|not authorized|forbidden/i.test(message)
        ? 'The admin role or activity query does not match the current database schema/permissions.'
        : 'The activity service returned an error.';
      setLoadError(`${plainReason} Details: ${message}`);
      console.error('Failed to fetch user activity', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);



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
      <div className="min-w-0 space-y-5">
        <section aria-label="Verified activity summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[{ label: 'Candidates', value: stats.length, detail: 'Activity records returned' }, { label: 'Online now', value: onlineCount, detail: 'Current presence records' }, { label: 'Items requiring review', value: sharedIpCount, detail: 'Shared IP addresses' }].map(item => <Card key={item.label} className="border-primary/20 bg-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="my-2 text-2xl font-semibold">{!hasLoaded || loadError ? '—' : item.value}</p><p className="text-xs text-muted-foreground">{item.detail}</p></CardContent></Card>)}
          <Card className="border-border/60 bg-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">System health</p><p className="my-2 text-lg font-semibold">Not checked</p><Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={onOpenSystem}>Open System monitor</Button></CardContent></Card>
        </section>
        {loadError && <Alert variant="destructive"><AlertDescription role="alert" className="flex flex-wrap items-center justify-between gap-3"><span>Could not load candidate activity. {loadError}</span><Button type="button" size="sm" variant="outline" onClick={fetchAll} disabled={loading}>Retry</Button></AlertDescription></Alert>}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Candidate Directory</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" disabled title="Disabled until server-side typed confirmation and reliable audit logging are implemented"><Brain className="h-4 w-4 mr-1" />Retrain AI (Unavailable)</Button>
          </div>
        </div>

        {lastRetrained && (
          <p className="text-xs text-muted-foreground">Last AI retrain: {new Date(lastRetrained).toLocaleString()}</p>
        )}

        {sharedIpCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{sharedIpCount} IP {sharedIpCount === 1 ? 'address' : 'addresses'} shared by multiple accounts</span>
              <Button variant="outline" size="sm" aria-pressed={showSharedOnly} onClick={() => setShowSharedOnly(v => !v)}>{showSharedOnly ? 'Show all' : 'Filter shared IPs'}</Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search candidate activity" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {showSharedOnly && (
            <Button variant="secondary" size="sm" onClick={() => setShowSharedOnly(false)}>
              <Shield className="h-4 w-4 mr-1" /> Showing flagged only · Clear
            </Button>
          )}
        </div>

        {loading && stats.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading user activity...</CardContent></Card>
        ) : loadError && stats.length === 0 ? (
          <Card role="alert"><CardContent className="py-8 text-center text-sm text-muted-foreground">Candidate directory unavailable because its data request failed. Retry after the underlying error is resolved.</CardContent></Card>
        ) : (
          <div className="admin-candidate-table min-w-0 overflow-x-auto rounded-lg border border-border/60 bg-card">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-[180px] bg-card">User</TableHead>
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
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">{hasLoaded && !loadError ? "No candidates match this search" : "Directory not loaded"}</TableCell></TableRow>
                ) : filtered.map(s => {
                  const isShared = s.ip_address && sharedIpMap[s.ip_address];
                  const sharedUsers = s.ip_address && isShared ? sharedIpMap[s.ip_address].filter(u => u.user_id !== s.user_id) : [];

                  return (
                    <TableRow key={s.user_id} className={isShared ? 'bg-destructive/5' : ''}>
                      <TableCell data-label="Candidate" className="max-w-[240px]">
                        <div className="break-words font-medium text-sm">{s.name || s.email || s.user_id.slice(0, 8)}</div>
                        {s.name && <div className="break-all text-xs text-muted-foreground">{s.email}</div>}
                      </TableCell>
                      <TableCell data-label="Online" className="text-center">
                        <span className="inline-flex items-center gap-2 text-xs"><span className={`inline-block h-2 w-2 shrink-0 rounded-full ${onlineSet.has(s.user_id) ? 'bg-success' : 'bg-muted-foreground/40'}`} />{onlineSet.has(s.user_id) ? 'Online' : 'Offline'}</span>
                      </TableCell>
                      <TableCell data-label="MCQs" className="text-right font-medium">{s.total_questions}</TableCell>
                      <TableCell data-label="Accuracy" className="text-right">
                        {s.total_questions > 0 ? (
                          <Badge variant={s.overall_accuracy >= 70 ? 'default' : s.overall_accuracy >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                            {s.overall_accuracy}%
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell data-label="OSCE" className="text-right font-medium">{s.total_osce}</TableCell>
                      <TableCell data-label="Streak" className="text-right">{s.streak_days}d</TableCell>
                      <TableCell data-label="Today MCQ" className="text-right text-xs">{s.questions_today}</TableCell>
                      <TableCell data-label="Today OSCE" className="text-right text-xs">{s.osce_today}</TableCell>
                      <TableCell data-label="Last active" className="text-xs text-muted-foreground">{s.last_active ? new Date(s.last_active).toLocaleString() : '—'}</TableCell>
                      <TableCell data-label="IP address" className="text-xs font-mono">
                        {s.ip_address ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{s.ip_address}</span>
                            {isShared && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 cursor-help">
                                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
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
                      <TableCell data-label="Joined" className="text-xs text-muted-foreground">{new Date(s.joined_at).toLocaleDateString()}</TableCell>
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
