import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Activity, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileSkeleton } from '@/components/skeletons/PageSkeleton';

interface PerformanceData {
  answer_stability: number | null;
  time_management: number | null;
  confidence_calibration: number | null;
  distance_from_ideal: number | null;
  clinical_accuracy: number | null;
  readiness_score: number | null;
}


export default function Profile() {
  const { user } = useAuth();
  const [data, setData] = useState<PerformanceData | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data: profile } = await supabase.from('readiness_dna')
        .select('readiness_score, clinical_accuracy, answer_stability, time_management, confidence_calibration, distance_from_ideal, attempt_count, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      setData(profile as PerformanceData | undefined);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  if (loading) return <ProfileSkeleton />;

  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#081224]/70 p-10 text-center backdrop-blur-xl">
        <Target className="mx-auto h-10 w-10 text-cyan-300/60" />
        <h2 className="mt-4 font-display text-xl font-semibold text-white">Build your first performance signal</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Complete practice questions to start building your performance view.
        </p>
        <Button asChild className="mt-5 gap-2">
          <Link to="/practice">Start Practice <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  const readiness = Math.max(0, Math.min(100, Number(data.readiness_score ?? 0)));
  const timing = data.time_management == null
    ? null
    : Math.round(Math.max(0, Math.min(100, data.time_management >= 45 && data.time_management <= 60
      ? 100
      : data.time_management < 45
        ? 100 - ((45 - data.time_management) * 1.5)
        : 100 - ((data.time_management - 60) * 1.5))));

  const getReadinessLabel = (score: number) =>
    score >= 80 ? 'Strong signal' : score >= 50 ? 'Developing signal' : 'Early signal';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="rounded-3xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/[0.05] via-[#081224]/80 to-[#081224]/70 p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-300/80">Performance</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">How you are performing</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              A focused view of the performance signals currently built from your recorded practice.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-display text-5xl font-bold text-white">{Math.round(readiness)}</div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500">readiness / 100</div>
            <div className="mt-2 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200">{getReadinessLabel(readiness)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Clinical Accuracy', value: data.clinical_accuracy },
          { label: 'Answer Stability', value: data.answer_stability },
          { label: 'Time Management', value: timing },
          { label: 'Confidence Calibration', value: data.confidence_calibration },
        ].map(metric => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
            <p className="text-xs text-slate-500">{metric.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-white">
              {metric.value == null ? '—' : `${Math.round(Number(metric.value))}%`}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: metric.value == null ? '0%' : `${Math.max(0, Math.min(100, Number(metric.value)))}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-300" />
            <h3 className="font-display text-base font-semibold text-white">Performance focus</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Current performance is represented by the four signals above. Subject and subtopic detail stays in the intelligence data layer rather than being repeated here.
          </p>
          <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Distance from ideal</span>
              <span className="font-semibold text-white">{data.distance_from_ideal == null ? '—' : Math.round(Number(data.distance_from_ideal))}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-purple-400" style={{ width: data.distance_from_ideal == null ? '0%' : `${Math.max(0, Math.min(100, Number(data.distance_from_ideal)))}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
          <p className="text-xs text-slate-500">Recorded sample</p>
          <p className="mt-2 font-display text-4xl font-semibold text-white">{data.attempt_count ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">practice attempts contributing to the current profile</p>
          <Button asChild variant="outline" className="mt-5 w-full gap-2">
            <Link to="/practice">Continue Practice <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
