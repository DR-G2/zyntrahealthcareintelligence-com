import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, Database, Shield, BookOpen, Stethoscope, Brain, CreditCard,
  CheckCircle2, AlertTriangle, XCircle, Play, RefreshCw, Clock, Activity,
  Users, HardDrive, Zap
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface StepResult {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HealthResult {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  mode: string;
  latency_ms: number;
  services: Record<string, string>;
  steps: StepResult[];
}

interface HealthLog {
  id: string;
  timestamp: string;
  overall_status: string;
  mode: string;
  steps: StepResult[];
  total_latency_ms: number;
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  database: <Database className="h-5 w-5" />,
  auth: <Shield className="h-5 w-5" />,
  mcq_engine: <BookOpen className="h-5 w-5" />,
  mcq_validation: <BookOpen className="h-5 w-5" />,
  osce_engine: <Stethoscope className="h-5 w-5" />,
  osce_validation: <Stethoscope className="h-5 w-5" />,
  ai_service: <Brain className="h-5 w-5" />,
  ai_gateway: <Zap className="h-5 w-5" />,
  payments: <CreditCard className="h-5 w-5" />,
  user_attempts_access: <Activity className="h-5 w-5" />,
  session_storage: <HardDrive className="h-5 w-5" />,
  profiles_access: <Users className="h-5 w-5" />,
};

const SERVICE_LABELS: Record<string, string> = {
  database: 'Database',
  auth: 'Authentication',
  mcq_engine: 'MCQ Engine',
  mcq_validation: 'MCQ Validation',
  osce_engine: 'OSCE Engine',
  osce_validation: 'OSCE Validation',
  ai_service: 'AI Service',
  payments: 'Payments',
  user_attempts_access: 'User Attempts',
  session_storage: 'Session Storage',
  profiles_access: 'Profiles',
};

function StatusDot({ status }: { status: string }) {
  if (status === 'healthy') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'degraded') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  return <XCircle className="h-5 w-5 text-red-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'healthy' ? 'default' : status === 'degraded' ? 'secondary' : 'destructive';
  return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
}

export function SystemMonitorTab() {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const { toast } = useToast();

  const runCheck = useCallback(async (mode: 'standard' | 'simulation' = 'standard') => {
    const setter = mode === 'simulation' ? setSimulating : setLoading;
    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke('system-health-check', {
        body: { mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as HealthResult);
      fetchLogs();
    } catch (e: any) {
      toast({ title: 'Health check failed', description: e.message, variant: 'destructive' });
    }
    setter(false);
  }, [toast]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('system-health-check', {
        body: { mode: 'logs' },
      });
      // Logs come from the same function but we'll fetch directly
    } catch {}
    // Direct query since we have the table
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('system_health_logs')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false })
        .limit(50);
      if (!error && data) {
        setLogs(data.map(d => ({
          ...d,
          steps: Array.isArray(d.steps) ? d.steps as unknown as StepResult[] : [],
        })));
      }
    } catch {}
    setLogsLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => runCheck('standard'), 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, runCheck]);

  const chartData = [...logs].reverse().map(l => ({
    time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    latency: l.total_latency_ms,
    status: l.overall_status,
  }));

  const chartConfig = {
    latency: { label: 'Latency (ms)', color: 'hsl(var(--primary))' },
  };

  const recentFailures = logs.filter(l => l.overall_status !== 'healthy');

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => runCheck('standard')} disabled={loading || simulating}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Quick Check
        </Button>
        <Button variant="outline" onClick={() => runCheck('simulation')} disabled={loading || simulating}>
          {simulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Run Student Simulation
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Auto-refresh (60s)</span>
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
        </div>
      </div>

      {/* Overall Status */}
      {result && (
        <Card className={
          result.status === 'healthy' ? 'border-green-500/30 bg-green-500/5' :
          result.status === 'degraded' ? 'border-yellow-500/30 bg-yellow-500/5' :
          'border-red-500/30 bg-red-500/5'
        }>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <StatusDot status={result.status} />
              <div>
                <p className="font-semibold">System {result.status.toUpperCase()}</p>
                <p className="text-sm text-muted-foreground">
                  Mode: {result.mode} · Latency: {result.latency_ms}ms · {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <StatusBadge status={result.status} />
          </CardContent>
        </Card>
      )}

      {/* Service Status Cards */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {result.steps.map(step => (
            <Card key={step.name} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 rounded-lg bg-muted">
                    {SERVICE_ICONS[step.name] || <Zap className="h-5 w-5" />}
                  </div>
                  <StatusDot status={step.status} />
                </div>
                <p className="font-medium text-sm">{SERVICE_LABELS[step.name] || step.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{step.latency_ms}ms</span>
                </div>
                {step.error && (
                  <p className="text-xs text-destructive mt-1 truncate" title={step.error}>{step.error}</p>
                )}
                {step.details && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    {Object.entries(step.details).slice(0, 3).map(([k, v]) => (
                      <p key={k} className="truncate">
                        <span className="font-medium">{k}:</span> {JSON.stringify(v)}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Health History Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Latency History (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="time" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Failures */}
      {recentFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Recent Failures
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Failed Services</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentFailures.map(log => {
                    const failed = log.steps.filter(s => s.status !== 'healthy');
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{new Date(log.timestamp).toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={log.overall_status} /></TableCell>
                        <TableCell className="text-xs">{log.mode}</TableCell>
                        <TableCell className="text-xs">{log.total_latency_ms}ms</TableCell>
                        <TableCell className="text-xs">
                          {failed.map(f => SERVICE_LABELS[f.name] || f.name).join(', ') || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* All Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Health Log History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Steps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No health logs yet. Run a check to start monitoring.
                    </TableCell>
                  </TableRow>
                )}
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell><StatusDot status={log.overall_status} /></TableCell>
                    <TableCell className="text-xs capitalize">{log.mode}</TableCell>
                    <TableCell className="text-xs font-mono">{log.total_latency_ms}ms</TableCell>
                    <TableCell className="text-xs">
                      {log.steps.length} checks
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
