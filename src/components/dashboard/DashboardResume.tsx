import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ActiveSession { session_id?: string | null; question_ids?: unknown; updated_at?: string | null; config?: unknown; }
function hasV2Session(session: ActiveSession): boolean {
  const config = session.config;
  return Boolean(config && typeof config === 'object' && typeof (config as Record<string, unknown>).v2SessionId === 'string');
}

export function DashboardResume() {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => setRetry(value => value + 1), []);

  useEffect(() => {
    if (!user) { setSession(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('active_sessions').select('*').eq('user_id', user.id)
          .order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (queryError) throw queryError;
        if (!cancelled) setSession(data as ActiveSession | null);
      } catch {
        if (!cancelled) { setSession(null); setError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, retry]);

  return (
    <section aria-labelledby="dashboard-resume-title" className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">05 / Resume</p>
        <h2 id="dashboard-resume-title" className="mt-1 font-display text-xl font-semibold text-white">Pick up where you left off</h2>
      </div>
      <Card className="border-white/10 bg-white/[0.025]"><CardContent className="p-5">
        {loading ? (
          <div role="status" className="space-y-3">
            <span className="sr-only">Checking for a saved MCQ session</span>
            <div className="h-4 w-2/5 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
            <div className="h-10 rounded-lg bg-white/5 motion-reduce:animate-none" />
          </div>
        ) : error ? (
          <div role="alert" className="space-y-3">
            <h3 className="font-semibold text-white">Saved session could not be checked</h3>
            <p className="text-sm leading-6 text-slate-400">The session list could not load. Retry before assuming there is nothing to resume.</p>
            <Button variant="outline" onClick={refresh} className="min-h-11"><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
          </div>
        ) : session?.session_id && hasV2Session(session) ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><PlayCircle className="h-5 w-5" aria-hidden="true" /></div>
              <div>
                <h3 className="font-semibold text-white">Saved MCQ session</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {Array.isArray(session.question_ids) && session.question_ids.length > 0
                    ? 'This session has ' + session.question_ids.length + ' recorded question slots.'
                    : 'Continue the saved session using the existing Practice resume flow.'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">If it has expired or already finished, Practice will show the server response and a safe return to setup.</p>
              </div>
            </div>
            <Button asChild className="min-h-11 w-full sm:w-auto"><Link to={'/practice?resume=' + encodeURIComponent(session.session_id)}>Resume session <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        ) : session?.session_id ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-white">This saved session cannot be resumed</h3>
            <p className="text-sm leading-6 text-slate-400">The saved record does not include the session reference required by the current Practice resume flow. Start a new session instead.</p>
            <Button asChild className="min-h-11"><Link to="/practice">Start a new session <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-semibold text-white">No saved session to resume</h3><p className="mt-1 text-sm leading-6 text-slate-400">Start a new MCQ session whenever you are ready.</p></div>
            <Button asChild className="min-h-11 w-full sm:w-auto"><Link to="/practice">Start a session <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        )}
      </CardContent></Card>
    </section>
  );
}
