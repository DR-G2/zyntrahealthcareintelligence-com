import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Target, Clock, Shield, Brain, ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformanceData {
  stability_score: number | null;
  time_sensitivity: number | null;
  confidence_gap: number | null;
  clinical_accuracy: number | null;
  readiness_score: number | null;
}

function ScoreRing({ value, label, icon: Icon, color }: {
  value: number;
  label: string;
  icon: React.ElementType;
  color: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="100" height="100" className="-rotate-90">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="6"
          />
          <motion.circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-4 w-4 mb-0.5" style={{ color }} />
          <span className="text-lg font-bold font-display">{value}</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: profile } = await supabase
        .from('performance_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setData(profile);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <Card>
            <CardContent className="py-12 space-y-4">
              <Target className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <h2 className="text-xl font-display font-bold">No Performance Profile Yet</h2>
              <p className="text-muted-foreground">Complete a diagnostic assessment to generate your profile.</p>
              <Button asChild className="gap-1">
                <Link to="/assess">Take Diagnostic <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const readiness = data.readiness_score ?? 0;
  const readinessColor = readiness >= 70 ? 'hsl(var(--success))' : readiness >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  const metrics = [
    {
      value: data.stability_score ?? 0,
      label: 'Answer Stability',
      icon: Shield,
      color: 'hsl(var(--chart-1))',
      desc: 'How often you change answers. Higher = more decisive.',
    },
    {
      value: data.time_sensitivity ?? 0,
      label: 'Time Management',
      icon: Clock,
      color: 'hsl(var(--chart-2))',
      desc: 'Your efficiency under time pressure.',
    },
    {
      value: 100 - (data.confidence_gap ?? 0),
      label: 'Confidence Calibration',
      icon: Brain,
      color: 'hsl(var(--chart-4))',
      desc: 'Alignment between confidence and actual performance.',
    },
    {
      value: data.clinical_accuracy ?? 0,
      label: 'Clinical Accuracy',
      icon: Target,
      color: 'hsl(var(--chart-3))',
      desc: 'Raw knowledge score across all categories.',
    },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display">Performance Profile</h1>
          <p className="text-muted-foreground">Your APPE behavioral analysis</p>
        </div>

        {/* Readiness Score Hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-8 overflow-hidden">
            <div className="relative p-8 text-center">
              <div className="absolute inset-0 opacity-5 gradient-primary" />
              <div className="relative">
                <p className="text-sm font-medium text-muted-foreground mb-4">Overall Readiness Score</p>
                <div className="relative mx-auto w-40 h-40">
                  <svg width="160" height="160" className="-rotate-90">
                    <circle cx="80" cy="80" r="65" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                    <motion.circle
                      cx="80" cy="80" r="65"
                      fill="none"
                      stroke={readinessColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 65}
                      initial={{ strokeDashoffset: 2 * Math.PI * 65 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 65 * (1 - readiness / 100) }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold font-display" style={{ color: readinessColor }}>
                      {readiness}%
                    </span>
                    <span className="text-xs text-muted-foreground">Readiness</span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground max-w-md mx-auto">
                  {readiness >= 70
                    ? 'Strong foundation. Focus on maintaining consistency and targeting weak spots.'
                    : readiness >= 40
                    ? 'Good progress. Your behavioral patterns need refinement for exam conditions.'
                    : 'Early stage. Focus on building foundational knowledge and exam discipline.'}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Individual Metrics */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <Card className="text-center py-6">
                <CardContent className="p-0">
                  <ScoreRing value={m.value} label={m.label} icon={m.icon} color={m.color} />
                  <p className="mt-3 px-4 text-xs text-muted-foreground">{m.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hover:border-primary/30 transition-colors">
            <CardHeader>
              <CardTitle className="font-display text-lg">Retake Diagnostic</CardTitle>
              <CardDescription>Take another assessment to update your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="gap-1">
                <Link to="/assess">Start Again <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/30 transition-colors">
            <CardHeader>
              <CardTitle className="font-display text-lg">Start Training</CardTitle>
              <CardDescription>Practice drills based on your weaknesses</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-1">
                <Link to="/practice">Begin Practice <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
