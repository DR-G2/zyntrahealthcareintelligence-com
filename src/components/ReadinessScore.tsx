import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { TrendingUp, Target, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadinessData {
  score: number;
  accuracy: number;
  stability: number;
  volume: number;
  osceAvg: number;
  confidence: number;
}

export function ReadinessScore() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [perfRes, attemptsRes, osceRes] = await Promise.all([
        supabase.from('performance_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_attempts').select('id').eq('user_id', user.id),
        supabase.from('station_attempts').select('scores').eq('user_id', user.id).limit(200),
      ]);

      const perf = perfRes.data;
      const totalAttempts = attemptsRes.data?.length || 0;
      const osceScores = (osceRes.data || [])
        .map((s: any) => (typeof s.scores?.total === 'number' ? s.scores.total : null))
        .filter((v: any): v is number => v !== null);

      const accuracy = Number(perf?.clinical_accuracy || 0);
      const stability = Number(perf?.stability_score || 50);
      const confidenceGap = Number(perf?.confidence_gap || 50);
      const volume = Math.min(100, (totalAttempts / 2000) * 100);
      const osceAvg = osceScores.length > 0
        ? osceScores.reduce((a: number, b: number) => a + b, 0) / osceScores.length
        : 0;
      const confidence = Math.max(0, 100 - confidenceGap);

      // Weighted formula
      const score = Math.round(
        accuracy * 0.4 +
        stability * 0.15 +
        volume * 0.2 +
        osceAvg * 0.15 +
        confidence * 0.1
      );

      setData({ score: Math.min(100, Math.max(0, score)), accuracy, stability, volume, osceAvg, confidence });
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="h-20 animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // Count-up animation
  const [displayScore, setDisplayScore] = useState(0);
  const animatedRef = useRef(false);
  const score = data?.score || 0;

  useEffect(() => {
    if (animatedRef.current || score === 0) return;
    animatedRef.current = true;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score]);

  const color = displayScore >= 70 ? 'text-success' : displayScore >= 50 ? 'text-warning' : 'text-destructive';
  const bgColor = displayScore >= 70 ? 'bg-success/10' : displayScore >= 50 ? 'bg-warning/10' : 'bg-destructive/10';
  const label = score >= 70 ? 'Strong' : score >= 50 ? 'Developing' : 'Needs Work';

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            AMC Readiness Score
          </CardTitle>
          <Badge variant={score >= 70 ? 'default' : score >= 50 ? 'secondary' : 'destructive'}>
            {label}
          </Badge>
        </div>
        <CardDescription>Predicted probability of passing AMC MCQ</CardDescription>
      </CardHeader>
      <CardContent>
        {!gate.canAccessReadiness ? (
          <div className="relative">
            <div className="filter blur-md pointer-events-none select-none">
              <div className="flex items-center gap-6">
                <div className={cn('text-6xl font-bold font-display', color)}>{displayScore}%</div>
                <div className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between"><span>Clinical Accuracy</span><span>{Math.round(data?.accuracy || 0)}%</span></div>
                  <div className="flex justify-between"><span>Question Volume</span><span>{Math.round(data?.volume || 0)}%</span></div>
                </div>
              </div>
            </div>
            <UpgradePrompt
              feature="AMC Readiness Score"
              description="See your predicted pass probability and personalized improvement tips"
              variant="overlay"
            />
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <div className={cn('flex h-24 w-24 items-center justify-center rounded-full', bgColor)}>
              <span className={cn('text-4xl font-bold font-display', color)}>{displayScore}%</span>
            </div>
            <div className="flex-1 space-y-1.5 text-sm">
              {[
                { label: 'Clinical Accuracy', value: data?.accuracy, weight: '40%' },
                { label: 'Stability', value: data?.stability, weight: '15%' },
                { label: 'Question Volume', value: data?.volume, weight: '20%' },
                { label: 'OSCE Average', value: data?.osceAvg, weight: '15%' },
                { label: 'Confidence', value: data?.confidence, weight: '10%' },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-muted-foreground">
                  <span>{item.label} <span className="text-xs opacity-60">({item.weight})</span></span>
                  <span className="font-medium text-foreground">{Math.round(item.value || 0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
