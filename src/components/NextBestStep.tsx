import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Brain, Compass, Gauge, Loader2, Target, TimerReset } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface NextBestAction {
  id?: string;
  candidate_intervention_id?: string;
  action: string;
  subject?: string | null;
  priority?: number;
  diagnosis_code?: string;
  evidence_level?: string;
  expected_signal?: string;
  reason?: string;
}

const actionMeta: Record<string, { title: string; icon: React.ElementType; label: string }> = {
  TIMING_DRILL: { title: 'Timing Drill', icon: TimerReset, label: 'Start Drill' },
  CONFIDENCE_CALIBRATION: { title: 'Confidence Calibration', icon: Gauge, label: 'Start Calibration' },
  FIRST_INSTINCT_DRILL: { title: 'First-Instinct Drill', icon: Target, label: 'Start Drill' },
  DIFFICULTY_REMEDIATION: { title: 'Difficulty Remediation', icon: Brain, label: 'Start Remediation' },
  KNOWLEDGE_REVIEW: { title: 'Targeted Knowledge Review', icon: Brain, label: 'Start Review' },
  SUBJECT_REMEDIATION: { title: 'Subject Remediation', icon: Target, label: 'Start Practice' },
  MIXED_RETEST: { title: 'Mixed Retest', icon: Activity, label: 'Start Retest' },
};

export function NextBestStep() {
  const { user } = useAuth();
  const [rec, setRec] = useState<NextBestAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_next_best_action', {
          p_user_id: user.id,
        });

        if (error) throw error;
        if (!cancelled) setRec((data ?? null) as unknown as NextBestAction | null);
      } catch {
        if (!cancelled) setRec(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const start = async () => {
    if (!rec?.id || starting) return;
    setStarting(true);
    try {
      const { error } = await supabase.rpc('start_next_best_action', {
        p_action_id: rec.id,
      });
      if (error) throw error;
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!rec) return null;

  const meta = actionMeta[rec.action] ?? actionMeta.MIXED_RETEST;
  const Icon = meta.icon;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm text-primary">
            <Icon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Next Best Action
              </span>
              {rec.evidence_level && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  · {rec.evidence_level}
                </span>
              )}
            </div>

            <h3 className="font-display font-semibold text-foreground">
              {meta.title}{rec.subject ? ` · ${rec.subject}` : ''}
            </h3>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {rec.reason || 'This is the current highest-priority training action supported by your observed data.'}
            </p>

            <Button asChild size="sm" className="mt-2 gap-1" disabled={starting}>
              <Link
                to="/practice"
                state={{
                  nextBestActionId: rec.id,
                  candidateInterventionId: rec.candidate_intervention_id,
                  action: rec.action,
                  subject: rec.subject,
                }}
                onClick={() => void start()}
              >
                {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {meta.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
