import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ACTION_TYPES = [
  "BAN_USER", "UNBAN_USER", "RESET_PASSWORD", "DELETE_USER",
  "GRANT_SUBSCRIPTION", "REVOKE_SUBSCRIPTION",
];

const actionColors: Record<string, string> = {
  BAN_USER: "destructive",
  DELETE_USER: "destructive",
  UNBAN_USER: "default",
  RESET_PASSWORD: "secondary",
  GRANT_SUBSCRIPTION: "default",
  REVOKE_SUBSCRIPTION: "secondary",
};

export function ActivityLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-actions', {
        body: { action: 'get_logs', user_id: '00000000-0000-0000-0000-000000000000' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLogs(data.logs || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(l => {
    if (filterAction !== "all" && l.action_type !== filterAction) return false;
    if (search) {
      const s = search.toLowerCase();
      return l.admin_email?.toLowerCase().includes(s) ||
        l.target_user_email?.toLowerCase().includes(s) ||
        l.action_type?.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by admin or target email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchLogs} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" /> Admin Activity Logs ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target User</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.admin_email}</TableCell>
                    <TableCell>
                      <Badge variant={(actionColors[l.action_type] as any) || "secondary"}>
                        {l.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.target_user_email || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {l.details && Object.keys(l.details).length > 0 ? JSON.stringify(l.details) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No logs found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
