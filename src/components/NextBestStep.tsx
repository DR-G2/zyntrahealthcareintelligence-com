import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Brain, Compass, Gauge, Loader2, Target, TimerReset } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseV2 } from '@/integrations/supabase/v2-client';
import { ensureV2Session } from '@/lib/migration/v2-practice-session';
import { mapAction } from '@/lib/pie/intelligence-evidence';

export interface NextBestAction {
  id?: string;
  candidate_intervention_id?: string;
  action: string;
  title?: string;
  subject?: string | null;
  priority?: number;
  diagnosis_code?: string;
  evidence_level?: string;
  expected_signal?: string;
  reason?: string;
}

export interface NextBestStepSnapshot {
  recommendation: NextBestAction | null;
  loading: boolean;
  error: boolean;
}

interface NextBestStepProps {
  onSnapshotChange?: (snapshot: NextBestStepSnapshot) => void;
  showEvidence?: boolean;
  refreshKey?: number;
}

const actionMeta: Record<string, { title: string; icon: React.ElementType; label: string }> = {
  TIMING_DRILL: { title: 'Timing Drill', icon: TimerReset, label: 'Start Drill' },
  CONFIDENCE_CALIBRATION: { title: 'Confidence Calibration', icon: Gauge, label: 'Start Calibration' },
  FIRST_INSTINCT_DRILL: { title: 'First-Instinct Drill', icon: Target, label: 'Start Drill' },
  DIFFICULTY_REMEDIATION: { title: 'Difficulty Remediation', icon: Brain, label: 'Start Remediation' },
  KNOWLEDGE_REVIEW: { title: 'Targeted Knowledge Review', icon: Brain, label: 'Start Review' },
  SUBJECT_REMEDIATION: { title: 'Subject Remediation', icon: Target, label: 'Start Practice' },
  MIXED_RETEST: { title: 'Mixed Retest', icon: Activity, label: 'Start Retest' },
  FOCUS_WEAK_SUBJECT: { title: 'Review your lowest-performing subject', icon: Brain, label: 'Start Practice' },
};

export function NextBestStep({ onSnapshotChange, showEvidence = true, refreshKey = 0 }: NextBestStepProps) {
  const { user } = useAuth();
  const [rec, setRec] = useState<NextBestAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) {
      setRec(null);
      setLoadError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        // Bridge the signed-in Zyntra identity to V2 before querying its
        // auth.uid()-scoped projection. Never query recommendations by a
        // client-supplied user ID.
        await ensureV2Session();
        const { data, error } = await getSupabaseV2()
          .from('my_next_best_actions')
          .select('action_type,action_data,expires_at,created_at,updated_at,priority')
          .order('priority', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;

        const action = mapAction(data);
        if (!cancelled) {
          setRec(action ? {
            action: 'FOCUS_WEAK_SUBJECT',
            title: action.title,
            reason: action.reason,
          } : null);
        }
      } catch {
        if (!cancelled) {
          setRec(null);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, refreshKey]);

  useEffect(() => {
    onSnapshotChange?.({ recommendation: rec, loading, error: loadError });
  }, [rec, loading, loadError, onSnapshotChange]);

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none text-muted-foreground" aria-label="Loading next best action" />
        </CardContent>
      </Card>
    );
  }

  if (!rec) {
    return (
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="space-y-3 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next Best Action</p>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {loadError ? 'Your personalised next step is unavailable' : 'Start an MCQ session'}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {loadError
              ? 'The recommendation could not be loaded. You can still continue with practice.'
              : 'No active, supported personalised action is available yet. Continue with an MCQ session while more guidance is unavailable.'}
          </p>
          <Button asChild className="min-h-11 gap-2"><Link to="/practice">Open Practice <ArrowRight className="h-4 w-4" /></Link></Button>
        </CardContent>
      </Card>
    );
  }

  const meta = actionMeta[rec.action];
  const Icon = meta?.icon ?? Compass;
  const title = rec.title ?? meta?.title ?? rec.action.replace(/_/g, ' ');
  const label = meta?.label ?? 'Open Practice';

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next Best Action</span>
              {rec.evidence_level && showEvidence && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{rec.evidence_level}</span>}
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground">{title}{rec.subject ? ' · ' + rec.subject : ''}</h2>
            {showEvidence && <p className="text-sm leading-relaxed text-muted-foreground">{rec.reason || 'An explanation was not provided for this recommendation.'}</p>}
            <Button asChild size="sm" className="min-h-11 gap-1">
              <Link
                to="/practice"
                state={{
                  action: rec.action,
                  subject: rec.subject,
                }}
              >
                {label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
