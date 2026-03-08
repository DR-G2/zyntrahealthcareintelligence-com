import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Stethoscope, Clock, Loader2, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';

interface StationAttemptSummary {
  id: string;
  subject: string;
  mode: string;
  scores: any;
  time_taken_seconds: number;
  created_at: string;
  session_id: string;
}

export default function QuestionsOSCE() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<StationAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('station_attempts')
        .select('id, subject, mode, scores, time_taken_seconds, created_at, session_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setAttempts((data as StationAttemptSummary[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const getOverallScore = (scores: any): number | null => {
    if (!scores || typeof scores !== 'object') return null;
    const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">OSCE Question Bank</h1>
          <p className="text-muted-foreground">Review past station cases and performance</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : attempts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No OSCE attempts yet. Complete some stations first!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attempts.map((attempt) => {
              const score = getOverallScore(attempt.scores);
              return (
                <Card key={attempt.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{attempt.mode}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(attempt.created_at), 'dd MMM yyyy')}
                      </span>
                    </div>
                    <CardTitle className="text-base mt-2 flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      {attempt.subject}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {Math.floor(attempt.time_taken_seconds / 60)}m {attempt.time_taken_seconds % 60}s
                      </span>
                      {score !== null && (
                        <Badge className={score >= 70 ? 'bg-green-500/10 text-green-600' : score >= 50 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-600'}>
                          {score}%
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
