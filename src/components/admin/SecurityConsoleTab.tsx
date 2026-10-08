import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Clock3, Eye, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Incident = {
  incident_id: string;
  user_id: string;
  user_email?: string | null;
  latest_ip?: string | null;
  latest_user_agent?: string | null;
  severity: 'high' | 'critical';
  status: string;
  event_count: number;
  screenshot_count: number;
  first_event_at: string;
  last_event_at: string;
  alert_state: string;
  alert_id?: string | null;
};

type Detail = {
  incident: Record<string, unknown> | null;
  events: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
};

export function SecurityConsoleTab() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_security_feed');
    if (error) {
      toast({ title: 'Security console error', description: error.message, variant: 'destructive' });
    } else {
      setIncidents((data || []) as Incident[]);
    }
    setLoading(false);
  }, [toast]);

  const openIncident = async (id: string) => {
    setSelectedId(id);
    const { data, error } = await supabase.rpc('admin_security_incident_detail', { p_incident_id: id });
    if (error) {
      toast({ title: 'Incident error', description: error.message, variant: 'destructive' });
      return;
    }
    const detail = data as Detail;
    setSelected(detail);
    const urls: Record<string, string> = {};
    for (const evidence of detail.evidence || []) {
      if (evidence.evidence_type !== 'screenshot' || !evidence.storage_ref) continue;
      const signed = await supabase.storage.from('security-evidence').createSignedUrl(String(evidence.storage_ref), 300);
      if (!signed.error && signed.data?.signedUrl) urls[String(evidence.id)] = signed.data.signedUrl;
    }
    setEvidenceUrls(urls);
  };

  const resolve = async (status: 'resolved' | 'false_positive') => {
    if (!selectedId) return;
    const { error } = await supabase.rpc('admin_resolve_security_incident', {
      p_incident_id: selectedId,
      p_status: status,
      p_resolution_note: note.trim() || null,
    });
    if (error) {
      toast({ title: 'Resolution failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: status === 'resolved' ? 'Incident resolved' : 'Marked false positive' });
    setSelected(null);
    setSelectedId(null);
    setNote('');
    await load();
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    const channel = supabase.channel('admin-security-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'pie', table: 'security_alert' }, (payload) => {
        const alert = payload.new as Record<string, unknown>;
        toast({
          title: String(alert.title || 'Security alert'),
          description: String(alert.summary || 'New security incident requires review.'),
          variant: String(alert.severity) === 'critical' ? 'destructive' : 'default',
        });
        void load();
      })
      .subscribe();
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [load]);

  const critical = incidents.filter(i => i.severity === 'critical').length;
  const high = incidents.filter(i => i.severity === 'high').length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-red-500/30 bg-red-500/[0.04]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Critical</div>
            <div className="mt-1 text-3xl font-bold text-red-300">{critical}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/[0.04]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">High</div>
            <div className="mt-1 text-3xl font-bold text-amber-300">{high}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Open incidents</div>
              <div className="mt-1 text-3xl font-bold">{incidents.length}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            Security Incidents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No open HIGH/CRITICAL incidents.</div>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident) => (
                <button
                  key={incident.incident_id}
                  onClick={() => void openIncident(incident.incident_id)}
                  className="w-full rounded-xl border border-border/60 bg-background/30 p-4 text-left transition hover:border-primary/30 hover:bg-primary/[0.03]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {incident.severity === 'critical'
                        ? <ShieldAlert className="h-5 w-5 text-red-400" />
                        : <AlertTriangle className="h-5 w-5 text-amber-400" />}
                      <Badge variant="outline">{incident.severity.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">{incident.incident_id}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(incident.last_event_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>User: {incident.user_email || incident.user_id}</span>
                    <span>IP: {incident.latest_ip || 'not captured'}</span>
                    <span>Events: {incident.event_count}</span>
                    <span>SS: {incident.screenshot_count}</span>
                    <span>Alert: {incident.alert_state}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Incident Investigation</span>
              <Badge variant="outline">{String(selected.incident?.severity || 'unknown').toUpperCase()}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">User</div><div className="mt-1 break-all text-xs">{String(selected.incident?.user_email || selected.incident?.user_id || '')}</div></div>
              <div><div className="text-xs text-muted-foreground">IP</div><div className="mt-1 break-all text-xs">{String(selected.incident?.latest_ip || 'not captured')}</div></div>
              <div><div className="text-xs text-muted-foreground">Events</div><div className="mt-1 font-semibold">{selected.events.length}</div></div>
              <div><div className="text-xs text-muted-foreground">Evidence</div><div className="mt-1 font-semibold">{selected.evidence.length}</div></div>
              <div><div className="text-xs text-muted-foreground">Alerts</div><div className="mt-1 font-semibold">{selected.alerts.length}</div></div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4" /> Timeline</div>
              <div className="space-y-2">
                {selected.events.map((event, index) => (
                  <div key={String(event.id || index)} className="rounded-lg border border-border/50 p-3 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{String(event.event_type || 'security event')}</span>
                      <span className="text-muted-foreground">{String(event.created_at || '')}</span>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {String(event.category || '')} · severity {String(event.severity || '')} · confidence {String(event.confidence || '')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Camera className="h-4 w-4" /> Evidence</div>
              {selected.evidence.length === 0 ? (
                <p className="text-xs text-muted-foreground">No evidence objects registered.</p>
              ) : (
                <div className="space-y-2">
                  {selected.evidence.map((e, index) => (
                    <div key={String(e.id || index)} className="rounded-lg border border-border/50 p-3 text-xs">
                      <div className="font-medium">{String(e.evidence_type || 'evidence')}</div>
                      <div className="mt-1 text-muted-foreground">Redaction: {String(e.redaction_state || 'unknown')} · Hash: {String(e.content_hash || 'none')}</div>
                      {evidenceUrls[String(e.id)] && <img src={evidenceUrls[String(e.id)]} alt="Security evidence screenshot" className="mt-3 max-h-96 w-full rounded-lg border border-border/50 object-contain" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
              <div className="mb-2 text-sm font-semibold">Resolution note</div>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Record the investigation outcome and reason." />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void resolve('resolved')}><CheckCircle2 className="mr-2 h-4 w-4" /> Resolve</Button>
                <Button variant="outline" onClick={() => void resolve('false_positive')}><ShieldCheck className="mr-2 h-4 w-4" /> False positive</Button>
                <Button variant="ghost" onClick={() => { setSelected(null); setSelectedId(null); }}>Close</Button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Eye className="h-4 w-4" />
              Evidence access is restricted and administrator actions are audited.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
