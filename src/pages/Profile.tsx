import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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
  const location = useLocation();
  const { user } = useAuth();
  const stateData = (location.state as any)?.performanceData as PerformanceData | undefined;
  const [data, setData] = useState<PerformanceData | undefined>(stateData);
  const [loading, setLoading] = useState(!stateData);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data: dbData } = await supabase
        .from('performance_profiles')
        .select('stability_score, time_sensitivity, confidence_gap, clinical_accuracy, readiness_score')
        .eq('user_id', user.id)
        .maybeSingle();
      if (dbData) {
        setData({
          stability_score: dbData.stability_score,
          time_sensitivity: dbData.time_sensitivity,
          confidence_gap: dbData.confidence_gap,
          clinical_accuracy: dbData.clinical_accuracy,
          readiness_score: dbData.readiness_score,
        });
      }
      setLoading(false);
    };
    fetchProfile();
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
      desc: 'How well you manage time pressure. Higher = calmer under time stress.',
    },
    {
      value: 100 - (data.confidence_gap ?? 0),
      label: 'Confidence Calibration',
      icon: Brain,
      color: 'hsl(var(--chart-3))',
      desc: 'How well your confidence matches your accuracy.',
    },
    {
      value: data.clinical_accuracy ?? 0,
      label: 'Clinical Accuracy',
      icon: Target,
      color: 'hsl(var(--chart-4))',
      desc: 'Raw percentage of correct answers.',
    },
  ];

  const getReadinessLabel = (score: number) => {
    if (score >= 80) return 'Exam Ready';
    if (score >= 60) return 'Almost There';
    if (score >= 40) return 'Building Up';
    return 'Early Stage';
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold font-display">Performance Profile</h1>
          <p className="text-muted-foreground mt-1">Your behavioral exam readiness breakdown</p>
        </motion.div>

        {/* Readiness Score */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Overall Readiness
              </CardTitle>
              <CardDescription>Composite score across all behavioral dimensions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <svg width="120" height="120" className="-rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <motion.circle
                      cx="60" cy="60" r="50"
                      fill="none"
                      stroke={readinessColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 50}
                      initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 50 - (readiness / 100) * 2 * Math.PI * 50 }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold font-display">{readiness}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: readinessColor }}>
                    {getReadinessLabel(readiness)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {readiness >= 70
                      ? 'Strong performance across most dimensions. Focus on weak areas.'
                      : readiness >= 40
                      ? 'Solid foundation with room for improvement in key areas.'
                      : 'Focus on building core exam skills with targeted practice.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Score Rings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle>Behavioral Dimensions</CardTitle>
              <CardDescription>Each score reflects a different aspect of exam performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {metrics.map((m) => (
                  <ScoreRing key={m.label} {...m} />
                ))}
              </div>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.map((m) => (
                  <div key={m.label} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                    <m.icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: m.color }} />
                    <div>
                      <p className="text-sm font-medium">{m.label}: {m.value}/100</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button asChild className="gap-1">
            <Link to="/practice">Start Targeted Practice <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/behavior">View Behavior Analysis</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/assess">Retake Diagnostic</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
