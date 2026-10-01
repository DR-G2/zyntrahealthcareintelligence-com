import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Stethoscope } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Row = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export function OsceInterestTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('id, name, email, message, created_at')
      .eq('category', 'osce_interest')
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Could not load interest', description: error.message, variant: 'destructive' });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-4 w-4" /> OSCE interest
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has signed the theatre list yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="py-3">
                <p className="text-sm font-medium">{row.name} · {row.email}</p>
                <p className="text-sm text-muted-foreground">{row.message}</p>
                <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
