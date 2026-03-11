import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';

interface ScreenshotEntry {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  trigger: string;
  page: string;
  ip_address: string | null;
  created_at: string;
}

export function ScreenshotAttemptsTab() {
  const [entries, setEntries] = useState<ScreenshotEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;
  const { toast } = useToast();

  const fetchLogs = async (p = page) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-screenshot-logs', {
        body: { page: p, page_size: pageSize },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEntries(data.entries || []);
      setTotalCount(data.total_count || 0);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(page); }, [page]);

  const triggerColor = (t: string) => {
    switch (t) {
      case 'printscreen_key': return 'destructive';
      case 'ctrl_shift_s': return 'destructive';
      case 'tab_switch': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalCount} screenshot attempt{totalCount !== 1 ? 's' : ''} logged</p>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.email}</TableCell>
                  <TableCell>{e.name || '—'}</TableCell>
                  <TableCell><Badge variant={triggerColor(e.trigger)}>{e.trigger}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.page}</TableCell>
                  <TableCell className="font-mono text-xs">{e.ip_address || '—'}</TableCell>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No screenshot attempts logged</TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalCount > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(totalCount / pageSize)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * pageSize >= totalCount} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
