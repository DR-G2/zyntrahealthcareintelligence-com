import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isValid, startOfWeek } from 'date-fns';
import { ArrowRight, RefreshCw, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchLegacyShapedHistory } from '@/lib/pie/pie-history-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HistoryAttempt { id?: string; created_at?: string | null; is_correct?: boolean | null; }
export interface WeeklyTrendPoint { key: string; label: string; correct: number; scoredAttempts: number; accuracy: number; }

export function summarizeWeeklyTrend(rows: readonly HistoryAttempt[]): WeeklyTrendPoint[] {
  const buckets = new Map<string, { start: Date; correct: number; scoredAttempts: number }>();
  for (const row of rows) {
    if (typeof row.created_at !== 'string' || typeof row.is_correct !== 'boolean') continue;
    const date = new Date(row.created_at);
    if (!isValid(date)) continue;
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const key = format(start, 'yyyy-MM-dd');
    const bucket = buckets.get(key) ?? { start, correct: 0, scoredAttempts: 0 };
    bucket.scoredAttempts += 1;
    if (row.is_correct) bucket.correct += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[1].start.getTime() - b[1].start.getTime())
    .slice(-4)
    .map(([key, bucket]) => ({
      key,
      label: format(bucket.start, 'MMM d'),
      correct: bucket.correct,
      scoredAttempts: bucket.scoredAttempts,
      accuracy: Math.round((bucket.correct / bucket.scoredAttempts) * 100),
    }));
}

export function DashboardTrends() {
  const [attempts, setAttempts] = useState<HistoryAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => setRetry(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const rows = await fetchLegacyShapedHistory(2000) as HistoryAttempt[];
        if (!cancelled) setAttempts(rows);
      } catch {
        if (!cancelled) { setAttempts([]); setError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [retry]);

  const points = useMemo(() => summarizeWeeklyTrend(attempts), [attempts]);
  const scoredAttempts = useMemo(
    () => attempts.filter(row => typeof row.is_correct === 'boolean' && typeof row.created_at === 'string' && isValid(new Date(row.created_at))).length,
    [attempts],
  );

  return (
    <section aria-labelledby="dashboard-trends-title" className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">04 / Trends</p>
        <h2 id="dashboard-trends-title" className="mt-1 font-display text-xl font-semibold text-white">Progress over time</h2>
      </div>
      {loading ? (
        <Card className="border-white/10 bg-white/[0.025]"><CardContent role="status" className="space-y-3 p-5">
          <span className="sr-only">Loading MCQ trends</span>
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
          <div className="h-16 rounded-lg bg-white/5 motion-reduce:animate-none" />
        </CardContent></Card>
      ) : error ? (
        <Card className="border-rose-300/20 bg-white/[0.025]"><CardContent role="alert" className="space-y-3 p-5">
          <p className="font-medium text-white">Trend data could not load</p>
          <p className="text-sm leading-6 text-slate-400">Your progress history could not be retrieved. No trend is inferred from missing data.</p>
          <Button variant="outline" onClick={refresh} className="min-h-11"><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
        </CardContent></Card>
      ) : attempts.length === 0 ? (
        <Card className="border-dashed border-white/15 bg-white/[0.025]"><CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-1 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-white">Your trend starts with your first session</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">No MCQ attempts are recorded in the history source yet. Start a session to begin building a progress record.</p>
            </div>
          </div>
          <Button asChild className="min-h-11 w-full sm:w-auto"><Link to="/practice">Start your first session <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </CardContent></Card>
      ) : points.length < 2 ? (
        <Card className="border-white/10 bg-white/[0.025]"><CardContent className="space-y-2 p-5">
          <h3 className="font-semibold text-white">Not enough trend data yet</h3>
          <p className="text-sm leading-6 text-slate-400">There are {scoredAttempts} dated, scored attempts across {points.length} active week{points.length === 1 ? '' : 's'}. Weekly progress needs attempts in at least two different weeks before a comparison can be shown.</p>
          <Button asChild variant="outline" className="min-h-11"><Link to="/practice">Continue practice <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </CardContent></Card>
      ) : (
        <Card className="border-white/10 bg-white/[0.025]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">MCQ accuracy by active week</CardTitle>
            <p className="text-xs leading-5 text-slate-500">Each bar uses scored attempts recorded during that week. This is past performance, not an exam pass prediction.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="list" aria-label="Weekly MCQ accuracy">
              {points.map(point => (
                <div key={point.key} role="listitem" className="border-b border-white/5 py-3 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{point.label}</span>
                    <div className="flex items-center gap-2">
                      {point.scoredAttempts < 5 && <Badge variant="outline" className="border-amber-300/25 text-amber-200">Small sample</Badge>}
                      <span className="text-sm tabular-nums text-slate-300">{point.accuracy}%</span>
                    </div>
                  </div>
                  <div role="img" aria-label={point.accuracy + '% accuracy from ' + point.scoredAttempts + ' scored attempts'} className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: point.accuracy + '%' }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{point.correct} correct from {point.scoredAttempts} scored attempts</p>
                </div>
              ))}
            </div>
            {attempts.length >= 2000 && <p className="text-xs text-slate-500">This view requests up to the latest 2,000 attempt records.</p>}
            <p className="text-xs leading-5 text-slate-500">Weekly accuracy can move with sample size and topic mix. It does not predict exam outcomes.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
