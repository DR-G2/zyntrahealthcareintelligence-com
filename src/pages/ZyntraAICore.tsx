import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Brain, Activity, Users, Zap, BarChart3, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface AggregateData {
  mcq?: {
    total_attempts?: number;
    overall_accuracy?: number;
    avg_time_seconds?: number;
    category_pass_rates?: { category: string; accuracy: number; sample: number }[];
  };
  behavior?: {
    archetype_distribution?: Record<string, number>;
    common_traps?: { trap: string; count: number; percent: number }[];
  };
  osce?: {
    total_stations?: number;
    avg_score?: number;
  };
  generated_at?: string;
}

const LEARNING_NODES = [
  { label: 'Clinical Reasoning', icon: Brain, color: 'from-blue-500/20 to-cyan-500/20', glow: 'shadow-blue-500/20', delay: 0 },
  { label: 'Difficulty Mapping', icon: BarChart3, color: 'from-purple-500/20 to-pink-500/20', glow: 'shadow-purple-500/20', delay: 0.2 },
  { label: 'Behavioral Analytics', icon: Activity, color: 'from-amber-500/20 to-orange-500/20', glow: 'shadow-amber-500/20', delay: 0.4 },
  { label: 'Timing Patterns', icon: Clock, color: 'from-emerald-500/20 to-teal-500/20', glow: 'shadow-emerald-500/20', delay: 0.6 },
];

export default function ZyntraAICore() {
  const [data, setData] = useState<AggregateData | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from('ai_training_context').select('aggregate_data, candidate_count, updated_at').limit(1).maybeSingle();
      if (row) {
        setData(row.aggregate_data as unknown as AggregateData);
        setCandidateCount(row.candidate_count ?? 0);
        setUpdatedAt(row.updated_at);
      }
      setLoading(false);
    })();
  }, []);

  const intelligenceScore = useMemo(() => {
    if (!data?.mcq) return 0;
    const attempts = data.mcq.total_attempts ?? 0;
    return Math.min(98, Math.round(20 * Math.log10(Math.max(attempts, 1)) + 10));
  }, [data]);

  const totalInteractions = (data?.mcq?.total_attempts ?? 0) + (data?.osce?.total_stations ?? 0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display">Zyntra AI Core</h1>
              <p className="text-sm text-muted-foreground">The neural brain powering your learning experience</p>
            </div>
          </div>
        </motion.div>

        {/* Intelligence Growth Meter */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className="overflow-hidden border-primary/10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display">
                <Zap className="h-5 w-5 text-primary" />
                AI Intelligence Growth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-bold font-display text-primary">{loading ? '—' : `${intelligenceScore}%`}</div>
                  <p className="text-xs text-muted-foreground mt-1">System intelligence level</p>
                </div>
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  {loading ? '...' : `${totalInteractions.toLocaleString()} interactions processed`}
                </Badge>
              </div>
              <Progress value={loading ? 0 : intelligenceScore} className="h-3" />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <div className="text-lg font-bold">{loading ? '—' : (data?.mcq?.overall_accuracy ?? 0)}%</div>
                  <div className="text-[11px] text-muted-foreground">Avg Accuracy Tracked</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{loading ? '—' : candidateCount.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">Candidates Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{loading ? '—' : (data?.mcq?.category_pass_rates?.length ?? 0)}</div>
                  <div className="text-[11px] text-muted-foreground">Categories Mapped</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Learning Nodes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <h2 className="text-lg font-display font-semibold mb-4">Active Learning Nodes</h2>
          <div className="grid grid-cols-2 gap-4">
            {LEARNING_NODES.map((node) => (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: node.delay + 0.3 }}
              >
                <Card className={`relative overflow-hidden border-primary/10 hover:shadow-lg ${node.glow} transition-shadow duration-300`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${node.color} pointer-events-none`} />
                  <CardContent className="flex items-center gap-4 p-5">
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: node.delay }}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm"
                    >
                      <node.icon className="h-6 w-6 text-primary" />
                    </motion.div>
                    <div>
                      <div className="font-semibold text-sm">{node.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {node.label === 'Clinical Reasoning' && `Analyzing ${(data?.mcq?.total_attempts ?? 0).toLocaleString()} clinical decisions`}
                        {node.label === 'Difficulty Mapping' && `${(data?.mcq?.category_pass_rates?.length ?? 0)} categories calibrated`}
                        {node.label === 'Behavioral Analytics' && `${Object.keys(data?.behavior?.archetype_distribution ?? {}).length} archetypes identified`}
                        {node.label === 'Timing Patterns' && `Avg response: ${data?.mcq?.avg_time_seconds ?? 0}s tracked`}
                      </div>
                    </div>
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: node.delay }}
                      className="ml-auto h-2 w-2 rounded-full bg-emerald-500"
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>


        {/* Community Learning */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <Card className="border-primary/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display">
                <Users className="h-5 w-5 text-primary" />
                Community Learning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Zyntra AI learns from every interaction across the platform, continuously improving question recommendations, difficulty calibration, and behavioral insights for all candidates.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card/50 p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{loading ? '—' : totalInteractions.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total Interactions Learned From</div>
                </div>
                <div className="rounded-xl border bg-card/50 p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{loading ? '—' : (data?.behavior?.common_traps?.length ?? 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Behavioral Traps Identified</div>
                </div>
              </div>
              {updatedAt && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Last model update: {new Date(updatedAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
