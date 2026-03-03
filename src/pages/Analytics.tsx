import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar,
} from 'recharts';

interface AttemptRow {
  id: string;
  question_id: string;
  is_correct: boolean;
  time_taken_seconds: number;
  answer_changes_count: number;
  session_id: string;
  created_at: string;
  questions?: { category: string } | null;
}

export default function Analytics() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('user_attempts')
        .select('id, question_id, is_correct, time_taken_seconds, answer_changes_count, session_id, created_at, questions(category)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setAttempts((data as AttemptRow[]) || []);
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

  // Group by session for progress over time
  const sessionMap = new Map<string, { correct: number; total: number; date: string }>();
  attempts.forEach((a) => {
    const entry = sessionMap.get(a.session_id) || { correct: 0, total: 0, date: a.created_at.slice(0, 10) };
    entry.total++;
    if (a.is_correct) entry.correct++;
    sessionMap.set(a.session_id, entry);
  });
  const progressData = Array.from(sessionMap.values()).map((s, i) => ({
    session: `Session ${i + 1}`,
    accuracy: Math.round((s.correct / s.total) * 100),
    date: s.date,
  }));

  // Category performance for radar
  const catMap = new Map<string, { correct: number; total: number }>();
  attempts.forEach((a) => {
    const cat = (a.questions as any)?.category || 'Unknown';
    const entry = catMap.get(cat) || { correct: 0, total: 0 };
    entry.total++;
    if (a.is_correct) entry.correct++;
    catMap.set(cat, entry);
  });
  const radarData = Array.from(catMap.entries()).map(([cat, d]) => ({
    category: cat.length > 12 ? cat.slice(0, 12) + '…' : cat,
    accuracy: Math.round((d.correct / d.total) * 100),
    fullMark: 100,
  }));

  // Time distribution histogram
  const timeBuckets = [
    { range: '0-30s', min: 0, max: 30, count: 0 },
    { range: '31-60s', min: 31, max: 60, count: 0 },
    { range: '61-90s', min: 61, max: 90, count: 0 },
    { range: '91-120s', min: 91, max: 120, count: 0 },
    { range: '120s+', min: 121, max: 9999, count: 0 },
  ];
  attempts.forEach((a) => {
    const bucket = timeBuckets.find((b) => a.time_taken_seconds >= b.min && a.time_taken_seconds <= b.max);
    if (bucket) bucket.count++;
  });

  const totalCorrect = attempts.filter((a) => a.is_correct).length;
  const overallAccuracy = attempts.length > 0 ? Math.round((totalCorrect / attempts.length) * 100) : 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display">Analytics</h1>
          <p className="text-muted-foreground">
            {attempts.length} questions attempted across {sessionMap.size} sessions
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Overall Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display text-primary">{overallAccuracy}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Questions Attempted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{attempts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{sessionMap.size}</div>
            </CardContent>
          </Card>
        </div>

        {attempts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Complete a diagnostic or practice session to see analytics.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Progress over time */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Progress Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="session" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Subject radar */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Subject Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar dataKey="accuracy" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Time distribution */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="font-display">Time Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
