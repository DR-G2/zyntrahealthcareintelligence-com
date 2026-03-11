import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { SYSTEMS } from '@/lib/filter-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, TrendingUp, TrendingDown, Minus, ArrowRight, Dna } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Tooltip as RechartsTooltip,
} from 'recharts';

interface SubjectStats {
  system: string;
  accuracy: number;
  count: number;
  avgTime: number;
  stability: number;
  trend: 'improving' | 'declining' | 'stable';
  readiness: number;
}

interface CompositeData {
  score: number;
  accuracy: number;
  stability: number;
  timeManagement: number;
  confidence: number;
}

function mapCategoryToSystem(category: string): string | null {
  const catLower = category.toLowerCase();
  for (const system of SYSTEMS) {
    if (catLower.includes(system.toLowerCase())) return system;
  }
  // Fallback mappings
  const aliases: Record<string, string> = {
    'general medicine': 'Cardiology',
    'orthopaedics': 'Musculoskeletal',
    'orthopedics': 'Musculoskeletal',
    'gynecology': 'Obstetrics & Gynaecology',
    'gynaecology': 'Obstetrics & Gynaecology',
    'obstetrics': 'Obstetrics & Gynaecology',
    'ent': 'ENT',
    'ear nose throat': 'ENT',
    'skin': 'Dermatology',
    'mental health': 'Psychiatry',
    'preventive': 'Population Health',
    'public health': 'Population Health',
    'hematology': 'Haematology',
    'blood': 'Haematology',
    'gastro': 'Gastrointestinal',
    'neuro': 'Neurology',
    'cardio': 'Cardiology',
    'respiratory': 'Respiratory',
    'renal': 'Renal',
    'kidney': 'Renal',
    'endocrine': 'Endocrinology',
    'diabetes': 'Endocrinology',
    'infectious': 'Infectious Diseases',
    'infection': 'Infectious Diseases',
    'emergency': 'Emergency Medicine',
    'surgical': 'Surgery',
    'paediatric': 'Paediatrics',
    'pediatric': 'Paediatrics',
    'children': 'Paediatrics',
    'musculoskeletal': 'Musculoskeletal',
    'bones': 'Musculoskeletal',
  };
  for (const [key, sys] of Object.entries(aliases)) {
    if (catLower.includes(key)) return sys;
  }
  return null;
}

function getColor(score: number): string {
  if (score >= 70) return 'hsl(var(--success, 142 76% 36%))';
  if (score >= 50) return 'hsl(var(--warning, 38 92% 50%))';
  return 'hsl(var(--destructive))';
}

function getLabel(score: number): string {
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Moderate';
  return 'Weak';
}

const CustomTooltipContent = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as SubjectStats & { fullMark: number };
  const TrendIcon = d.trend === 'improving' ? TrendingUp : d.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = d.trend === 'improving' ? 'text-green-500' : d.trend === 'declining' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="rounded-lg border bg-popover p-3 shadow-lg text-sm space-y-1.5 max-w-[220px]">
      <p className="font-semibold text-foreground">{d.system}</p>
      <div className="flex justify-between"><span className="text-muted-foreground">Accuracy</span><span className="font-medium">{Math.round(d.accuracy)}%</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Attempted</span><span className="font-medium">{d.count}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Avg Time</span><span className="font-medium">{Math.round(d.avgTime)}s</span></div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Trend</span>
        <span className={cn('flex items-center gap-1 font-medium capitalize', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" /> {d.trend}
        </span>
      </div>
    </div>
  );
};

export function ReadinessDNA() {
  const { user } = useAuth();
  const gate = useFeatureGate();
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [composite, setComposite] = useState<CompositeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();

      const [attemptsRes, perfRes] = await Promise.all([
        supabase
          .from('user_attempts')
          .select('is_correct, time_taken_seconds, answer_changes_count, created_at, question_id, questions(category)')
          .eq('user_id', user.id),
        supabase.from('performance_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      const attempts = attemptsRes.data || [];

      // Group by system
      const systemMap: Record<string, {
        correct: number; total: number; totalTime: number; totalChanges: number;
        recentCorrect: number; recentTotal: number; priorCorrect: number; priorTotal: number;
      }> = {};

      SYSTEMS.forEach(s => {
        systemMap[s] = { correct: 0, total: 0, totalTime: 0, totalChanges: 0, recentCorrect: 0, recentTotal: 0, priorCorrect: 0, priorTotal: 0 };
      });

      attempts.forEach((a: any) => {
        const cat = a.questions?.category;
        if (!cat) return;
        const system = mapCategoryToSystem(cat);
        if (!system || !systemMap[system]) return;
        const s = systemMap[system];
        s.total++;
        if (a.is_correct) s.correct++;
        s.totalTime += a.time_taken_seconds || 0;
        s.totalChanges += a.answer_changes_count || 0;

        const created = a.created_at;
        if (created >= thirtyDaysAgo) {
          s.recentTotal++;
          if (a.is_correct) s.recentCorrect++;
        } else if (created >= sixtyDaysAgo) {
          s.priorTotal++;
          if (a.is_correct) s.priorCorrect++;
        }
      });

      const stats: SubjectStats[] = SYSTEMS.map(system => {
        const s = systemMap[system];
        const accuracy = s.total > 0 ? (s.correct / s.total) * 100 : 0;
        const avgTime = s.total > 0 ? s.totalTime / s.total : 0;
        const avgChanges = s.total > 0 ? s.totalChanges / s.total : 0;
        const stability = Math.max(0, 100 - avgChanges * 30);
        const timeEff = avgTime > 0 ? Math.min(100, (90 / avgTime) * 100) : 0;

        const recentAcc = s.recentTotal > 0 ? s.recentCorrect / s.recentTotal : 0;
        const priorAcc = s.priorTotal > 0 ? s.priorCorrect / s.priorTotal : 0;
        const trend: SubjectStats['trend'] = s.recentTotal < 3 ? 'stable' : recentAcc > priorAcc + 0.05 ? 'improving' : recentAcc < priorAcc - 0.05 ? 'declining' : 'stable';

        const readiness = Math.round(accuracy * 0.5 + stability * 0.25 + timeEff * 0.25);

        return { system, accuracy, count: s.total, avgTime, stability, trend, readiness };
      });

      setSubjectStats(stats);

      // Composite score from performance_profiles
      const perf = perfRes.data;
      const overallAccuracy = Number(perf?.clinical_accuracy || 0);
      const overallStability = Number(perf?.stability_score || 50);
      const confidenceGap = Number(perf?.confidence_gap || 50);
      const timeSens = Number(perf?.time_sensitivity || 50);
      const confidence = Math.max(0, 100 - confidenceGap);
      const timeManagement = Math.max(0, 100 - timeSens);

      const score = Math.round(overallAccuracy * 0.4 + overallStability * 0.2 + timeManagement * 0.2 + confidence * 0.2);

      setComposite({ score: Math.min(100, Math.max(0, score)), accuracy: overallAccuracy, stability: overallStability, timeManagement, confidence });
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const weakAreas = useMemo(() => subjectStats.filter(s => s.count > 0 && s.readiness < 50), [subjectStats]);
  const chartData = useMemo(() => subjectStats.map(s => ({ ...s, value: s.count > 0 ? s.readiness : 0, fullMark: 100 })), [subjectStats]);

  const score = composite?.score || 0;
  const scoreColor = score >= 70 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-destructive';
  const scoreBg = score >= 70 ? 'from-green-500/20 to-green-500/5' : score >= 50 ? 'from-yellow-500/20 to-yellow-500/5' : 'from-destructive/20 to-destructive/5';
  const scoreLabel = score >= 70 ? 'Strong' : score >= 50 ? 'Developing' : 'Needs Work';

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="h-64 animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const innerContent = (
    <div className="space-y-6">
      {/* Composite Score Gauge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <div className={cn('relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br', scoreBg)}>
          <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center flex-col">
            <motion.span
              className={cn('text-4xl font-bold font-display', scoreColor)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {score}
            </motion.span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          {/* SVG ring */}
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="58" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
            <circle
              cx="64" cy="64" r="58" fill="none"
              stroke={score >= 70 ? 'hsl(142, 76%, 36%)' : score >= 50 ? 'hsl(38, 92%, 50%)' : 'hsl(var(--destructive))'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 364.4} 364.4`}
            />
          </svg>
        </div>
        <Badge variant={score >= 70 ? 'default' : score >= 50 ? 'secondary' : 'destructive'} className="mt-3">
          {scoreLabel}
        </Badge>

        {/* Score breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          {[
            { label: 'Clinical Accuracy', value: composite?.accuracy, weight: '40%' },
            { label: 'Answer Stability', value: composite?.stability, weight: '20%' },
            { label: 'Time Management', value: composite?.timeManagement, weight: '20%' },
            { label: 'Confidence', value: composite?.confidence, weight: '20%' },
          ].map(item => (
            <div key={item.label} className="flex justify-between gap-4 text-muted-foreground">
              <span>{item.label} <span className="text-xs opacity-60">({item.weight})</span></span>
              <span className="font-medium text-foreground">{Math.round(item.value || 0)}%</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* DNA Radar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="system"
              tick={({ x, y, payload }: any) => {
                const stat = chartData.find(d => d.system === payload.value);
                const fill = stat && stat.count > 0 ? getColor(stat.readiness) : 'hsl(var(--muted-foreground))';
                // Shorten long labels
                const label = payload.value
                  .replace('Obstetrics & Gynaecology', 'O&G')
                  .replace('Emergency Medicine', 'Emergency')
                  .replace('Infectious Diseases', 'Infectious')
                  .replace('Population Health', 'Pop. Health')
                  .replace('Gastrointestinal', 'GI')
                  .replace('Musculoskeletal', 'MSK');
                return (
                  <text x={x} y={y} textAnchor="middle" fill={fill} fontSize={10} fontWeight={500}>
                    {label}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
            <Radar
              name="Readiness"
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <RechartsTooltip content={<CustomTooltipContent />} />
          </RadarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Weak Area Actions */}
      {weakAreas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <Target className="h-4 w-4" /> Weak Areas — Practice Now
          </h3>
          <div className="flex flex-wrap gap-2">
            {weakAreas.map(area => (
              <TooltipProvider key={area.system}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" asChild className="border-destructive/30 text-destructive hover:bg-destructive/10">
                      <Link to={`/practice?category=${encodeURIComponent(area.system)}`}>
                        {area.system} ({Math.round(area.accuracy)}%) <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start a 10-question drill in {area.system}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Dna className="h-5 w-5 text-primary" />
            AMC Readiness DNA
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {subjectStats.filter(s => s.count > 0).length} / {SYSTEMS.length} subjects
          </Badge>
        </div>
        <CardDescription>Your competency map across all AMC clinical subjects</CardDescription>
      </CardHeader>
      <CardContent>
        {!gate.canAccessReadiness ? (
          <div className="relative">
            <div className="filter blur-md pointer-events-none select-none">
              {innerContent}
            </div>
            <UpgradePrompt
              feature="AMC Readiness DNA"
              description="Unlock your full competency map with per-subject analytics and targeted practice drills"
              variant="overlay"
            />
          </div>
        ) : (
          innerContent
        )}
      </CardContent>
    </Card>
  );
}
