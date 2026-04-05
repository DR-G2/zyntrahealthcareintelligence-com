import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, CheckCircle, ArrowRight, Zap, Activity, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { supabase } from '@/integrations/supabase/client';

interface StageInfo {
  name: string;
  description: string;
  threshold: string;
}

interface TrackDef {
  id: string;
  label: string;
  icon: React.ElementType;
  stages: StageInfo[];
  link: string;
  accent: string;
}

const TRACKS: TrackDef[] = [
  {
    id: 'clinical_reasoning',
    label: 'Clinical Reasoning',
    icon: Zap,
    accent: 'text-primary',
    link: '/practice',
    stages: [
      { name: 'Foundation', description: 'Easy-difficulty questions', threshold: 'Score 60%+ on 20 questions' },
      { name: 'Application', description: 'Moderate-difficulty questions', threshold: 'Score 65%+ on 30 questions' },
      { name: 'Integration', description: 'Hard-difficulty questions', threshold: 'Score 60%+ on 25 questions' },
      { name: 'Exam Simulation', description: 'Full mock exams', threshold: 'Complete 2 full mocks' },
    ],
  },
  {
    id: 'osce_readiness',
    label: 'OSCE Readiness',
    icon: Activity,
    accent: 'text-chart-1',
    link: '/stations',
    stages: [
      { name: 'Communication', description: 'Basic history taking', threshold: 'Complete 3 stations' },
      { name: 'History Taking', description: 'Structured consultations', threshold: 'Score 60%+ on 5 stations' },
      { name: 'Examination', description: 'Clinical examination skills', threshold: 'Complete adaptive training' },
      { name: 'Full Circuit', description: 'Exam-mode circuits', threshold: 'Complete an exam circuit' },
    ],
  },
  {
    id: 'mastery',
    label: 'AMC Mastery',
    icon: Trophy,
    accent: 'text-chart-4',
    link: '/intelligence',
    stages: [
      { name: 'Foundations', description: 'Complete Stage 2 of both tracks', threshold: 'Unlock by progressing' },
      { name: 'Integration', description: 'Cross-domain practice', threshold: 'Score 70%+ across all subjects' },
      { name: 'Readiness', description: 'Performance optimization', threshold: 'Readiness score 75+' },
      { name: 'Exam Ready', description: 'Final preparation', threshold: 'Readiness score 85+' },
    ],
  },
];

interface ProgressRow {
  track: string;
  stage: number;
  progress_pct: number;
  unlocked: boolean;
  completed_at: string | null;
}

export function ProgramTracker() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchProgress = async () => {
      // Fetch existing progress
      const { data } = await supabase
        .from('user_program_progress')
        .select('track, stage, progress_pct, unlocked, completed_at')
        .eq('user_id', user.id);

      if (data && data.length > 0) {
        setProgress(data as ProgressRow[]);
      } else {
        // Initialize Stage 1 as unlocked for each track
        const initialRows = TRACKS.map(t => ({
          user_id: user.id,
          track: t.id,
          stage: 1,
          progress_pct: 0,
          unlocked: true,
        }));

        await supabase.from('user_program_progress').insert(initialRows as any);
        setProgress(initialRows.map(r => ({ ...r, completed_at: null })));
      }
      setLoading(false);
    };

    fetchProgress();
  }, [user]);

  const getStageProgress = (trackId: string, stageNum: number): ProgressRow | undefined => {
    return progress.find(p => p.track === trackId && p.stage === stageNum);
  };

  const getCurrentStage = (trackId: string): number => {
    const trackProgress = progress.filter(p => p.track === trackId);
    if (trackProgress.length === 0) return 1;
    const completed = trackProgress.filter(p => p.completed_at).map(p => p.stage);
    return completed.length > 0 ? Math.max(...completed) + 1 : 1;
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-display">AMC Mastery Program</h2>
          <p className="text-xs text-muted-foreground">Your structured path to exam readiness</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TRACKS.map(track => {
          const currentStage = getCurrentStage(track.id);
          const currentProgress = getStageProgress(track.id, currentStage);
          const pct = currentProgress?.progress_pct ?? 0;
          const totalCompleted = progress.filter(p => p.track === track.id && p.completed_at).length;

          return (
            <Card key={track.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <track.icon className={`h-5 w-5 ${track.accent}`} />
                  <CardTitle className="text-sm font-display">{track.label}</CardTitle>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    Stage {Math.min(currentStage, 4)}/4
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stage pills */}
                <div className="flex gap-1">
                  {track.stages.map((stage, i) => {
                    const stageNum = i + 1;
                    const sp = getStageProgress(track.id, stageNum);
                    const isCompleted = !!sp?.completed_at;
                    const isCurrent = stageNum === currentStage;
                    const isLocked = stageNum > currentStage;

                    return (
                      <div
                        key={stageNum}
                        className={`flex-1 h-1.5 rounded-full transition-colors ${
                          isCompleted ? 'bg-primary' :
                          isCurrent ? 'bg-primary/40' :
                          'bg-muted'
                        }`}
                        title={`${stage.name}${isCompleted ? ' ✓' : isLocked ? ' 🔒' : ''}`}
                      />
                    );
                  })}
                </div>

                {/* Current stage info */}
                {currentStage <= 4 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{track.stages[currentStage - 1]?.name}</span>
                      <span className="text-[10px] text-muted-foreground">{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">{track.stages[currentStage - 1]?.threshold}</p>
                  </div>
                )}

                {currentStage > 4 && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Track Complete</span>
                  </div>
                )}

                {/* CTA */}
                <Button asChild size="sm" variant="outline" className="w-full gap-1 text-xs">
                  <Link to={track.link}>
                    {currentStage > 4 ? 'Review' : 'Continue Training'} <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
