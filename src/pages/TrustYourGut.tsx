import { Target, Brain, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface AttemptWithQuestion {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  answer_changes_count: number;
  change_sequence: string[];
  created_at: string;
  session_id: string;
  questions: {
    correct_answer: string;
    category: string;
  };
}

interface ChangeAnalysis {
  correctToWrong: number;
  wrongToCorrect: number;
  wrongToWrong: number;
  total: number;
}

interface CategoryBreakdown {
  category: string;
  pointsLost: number;
  changeRate: number;
  attempts: number;
}

export default function TrustYourGut() {
  const { user } = useAuth();
  const [mcqAttempts, setMcqAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAttempts = async () => {
      const { data } = await supabase
        .from('user_attempts')
        .select('id, is_correct, answer_changes_count, change_sequence, selected_answer, created_at, questions(correct_answer)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1000);
      setMcqAttempts(data || []);
      setLoading(false);
    };
    fetchAttempts();
  }, [user]);

  const stats = useMemo(() => {
    const changed = mcqAttempts.filter(a => a.answer_changes_count > 0 && Array.isArray(a.change_sequence) && a.change_sequence.length > 0);
    if (!changed.length) {
      return {
        firstInstinctAccuracy: 0,
        finalAccuracy: 0,
        pointsLost: 0,
        pointsGained: 0,
        wrongToWrong: 0,
        totalWithChanges: 0,
        changeRate: 0,
      };
    }

    let firstCorrect = 0;
    let finalCorrect = 0;
    let correctToWrong = 0;
    let wrongToCorrect = 0;
    let wrongToWrong = 0;

    changed.forEach(a => {
      const first = a.change_sequence[0];
      const correct = a.questions?.correct_answer;
      const finalAnswer = a.selected_answer;
      const firstWasCorrect = first === correct;
      const finalWasCorrect = finalAnswer === correct;
      if (firstWasCorrect) firstCorrect++;
      if (finalWasCorrect) finalCorrect++;
      if (firstWasCorrect && !finalWasCorrect) correctToWrong++;
      if (!firstWasCorrect && finalWasCorrect) wrongToCorrect++;
      if (!firstWasCorrect && !finalWasCorrect) wrongToWrong++;
    });

    return {
      firstInstinctAccuracy: Math.round((firstCorrect / changed.length) * 100),
      finalAccuracy: Math.round((finalCorrect / changed.length) * 100),
      pointsLost: correctToWrong,
      pointsGained: wrongToCorrect,
      wrongToWrong,
      totalWithChanges: changed.length,
      changeRate: mcqAttempts.length ? Math.round((changed.length / mcqAttempts.length) * 100) : 0,
    };
  }, [mcqAttempts]);

  const delta = stats.finalAccuracy - stats.firstInstinctAccuracy;

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-rose-400/[0.05] via-[#081224]/80 to-[#081224]/70 p-6 backdrop-blur-xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-rose-300/80">Trust Your Gut</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-white">What happens when you change your answer?</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Compare your first recorded selection with the final answer on questions where you changed it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
          <p className="text-xs text-slate-500">First instinct accuracy</p>
          <p className="mt-2 font-display text-4xl font-semibold text-white">{stats.totalWithChanges ? stats.firstInstinctAccuracy + '%' : '—'}</p>
          <p className="mt-1 text-[11px] text-slate-600">questions with a recorded answer change</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
          <p className="text-xs text-slate-500">Final answer accuracy</p>
          <p className="mt-2 font-display text-4xl font-semibold text-white">{stats.totalWithChanges ? stats.finalAccuracy + '%' : '—'}</p>
          <p className="mt-1 text-[11px] text-slate-600">same changed-answer sample</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-white">Change outcomes</h3>
            <p className="mt-1 text-xs text-slate-500">The actual outcome of changing a recorded first selection.</p>
          </div>
          <Target className="h-4 w-4 text-rose-300" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.045] p-4">
            <p className="text-xs text-slate-400">Correct → Wrong</p>
            <p className="mt-2 font-display text-2xl font-semibold text-rose-300">{stats.pointsLost}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] p-4">
            <p className="text-xs text-slate-400">Wrong → Correct</p>
            <p className="mt-2 font-display text-2xl font-semibold text-emerald-300">{stats.pointsGained}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-xs text-slate-400">Wrong → Wrong</p>
            <p className="mt-2 font-display text-2xl font-semibold text-white">{stats.wrongToWrong}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-white">Instinct vs final</h3>
            <p className="mt-1 text-xs text-slate-500">Same changed-answer sample, shown side by side.</p>
          </div>
          <span className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium',
            delta > 0 ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' :
            delta < 0 ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' :
            'border-white/10 bg-white/[0.03] text-slate-400'
          )}>
            {stats.totalWithChanges ? (delta > 0 ? '+' : '') + delta + ' pts' : 'No change data'}
          </span>
        </div>
        <div className="mt-5 space-y-4">
          {[
            { label: 'First instinct', value: stats.firstInstinctAccuracy, icon: Brain },
            { label: 'Final answer', value: stats.finalAccuracy, icon: CheckCircle2 },
          ].map(row => {
            const Icon = row.icon;
            return (
              <div key={row.label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-slate-400"><Icon className="h-3.5 w-3.5" />{row.label}</span>
                  <span className="font-semibold text-white">{stats.totalWithChanges ? row.value + '%' : '—'}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-rose-400" style={{ width: Math.max(0, Math.min(100, row.value)) + '%' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5">
          <p className="text-xs text-slate-500">Questions changed</p>
          <p className="mt-2 font-display text-3xl font-semibold text-white">{stats.totalWithChanges}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5">
          <p className="text-xs text-slate-500">Overall change rate</p>
          <p className="mt-2 font-display text-3xl font-semibold text-white">{stats.changeRate}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#081224]/70 p-5">
          <p className="text-xs text-slate-500">Net change outcome</p>
          <p className={cn('mt-2 font-display text-3xl font-semibold', stats.pointsGained - stats.pointsLost >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
            {stats.pointsGained - stats.pointsLost > 0 ? '+' : ''}{stats.pointsGained - stats.pointsLost}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-slate-500">
        This view reports recorded answer-change outcomes. It does not infer personality, confidence, or clinical competence from a change alone.
      </div>
    </motion.div>
  );
}
