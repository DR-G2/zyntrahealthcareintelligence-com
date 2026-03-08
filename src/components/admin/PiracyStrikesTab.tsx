import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ShieldAlert, AlertTriangle } from 'lucide-react';

interface UserWithStrikes {
  id: string;
  email: string;
  name: string | null;
  strike_count: number;
  suspended: boolean;
  opacity_light: number;
}

export function PiracyStrikesTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithStrikes[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [strikeDialog, setStrikeDialog] = useState<{ userId: string; email: string } | null>(null);
  const [reason, setReason] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<{ userId: string; email: string } | null>(null);
  const [strikes, setStrikes] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-list-users');
      if (error) throw error;
      const allUsers = data.users || [];

      // Fetch strike counts via edge function (admin has service role access)
      const { data: strikesData } = await supabase.functions.invoke('admin-manage-strikes', {
        body: { action: 'list_all' },
      });

      const strikeMap: Record<string, { count: number; suspended: boolean; opacity_light: number }> = {};
      for (const s of strikesData?.users || []) {
        strikeMap[s.user_id] = { count: s.strike_count, suspended: s.suspended, opacity_light: s.opacity_light };
      }

      setUsers(
        allUsers.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          strike_count: strikeMap[u.id]?.count ?? 0,
          suspended: strikeMap[u.id]?.suspended ?? false,
          opacity_light: strikeMap[u.id]?.opacity_light ?? 0.055,
        }))
      );
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const issueStrike = async () => {
    if (!strikeDialog || !reason.trim()) return;
    setIssuing(true);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-strikes', {
        body: { action: 'issue', user_id: strikeDialog.userId, reason: reason.trim() },
      });
      if (error) throw error;
      toast({ title: 'Strike issued', description: `Strike issued to ${strikeDialog.email}` });
      setStrikeDialog(null);
      setReason('');
      fetchUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setIssuing(false);
  };

  const viewHistory = async (userId: string, email: string) => {
    setHistoryDialog({ userId, email });
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-strikes', {
        body: { action: 'history', user_id: userId },
      });
      if (error) throw error;
      setStrikes(data?.strikes || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoadingHistory(false);
  };

  const filtered = users.filter(
    (u) =>
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: suspended first, then by strike count desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.suspended !== b.suspended) return a.suspended ? -1 : 1;
    return b.strike_count - a.strike_count;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" onClick={fetchUsers} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Piracy Strikes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Strikes</TableHead>
                <TableHead>Watermark</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((u) => (
                <TableRow key={u.id} className={u.suspended ? 'bg-destructive/5' : ''}>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell>{u.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={u.strike_count >= 3 ? 'destructive' : u.strike_count > 0 ? 'secondary' : 'outline'}>
                      {u.strike_count} / 3
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{(u.opacity_light * 100).toFixed(1)}%</TableCell>
                  <TableCell>
                    {u.suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : u.strike_count > 0 ? (
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Warning
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Clean</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => viewHistory(u.id, u.email)}>
                        History
                      </Button>
                      {!u.suspended && (
                        <Button variant="destructive" size="sm" onClick={() => setStrikeDialog({ userId: u.id, email: u.email })}>
                          Issue Strike
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Issue Strike Dialog */}
      <Dialog open={!!strikeDialog} onOpenChange={(open) => !open && setStrikeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Piracy Strike to {strikeDialog?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the piracy violation..."
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will increase the user's watermark opacity. At 3 strikes, the account will be automatically suspended.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStrikeDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={issueStrike} disabled={issuing || !reason.trim()}>
              {issuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Issue Strike
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Strike History Dialog */}
      <Dialog open={!!historyDialog} onOpenChange={(open) => !open && setHistoryDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Strike History — {historyDialog?.email}</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : strikes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No strikes on record</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {strikes.map((s: any) => (
                <div key={s.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-xs">Strike</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{s.reason}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
