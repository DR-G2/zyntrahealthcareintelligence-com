import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Stethoscope, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PsychographRadar } from '@/components/stations/PsychographRadar';

interface StationAttempt {
  id: string;
  subject: string;
  mode: string;
  scores: any;
  psychograph: any;
  time_taken_seconds: number;
  created_at: string;
}

export function OSCEHistory() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['osce-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('station_attempts')
        .select('id, subject, mode, scores, psychograph, time_taken_seconds, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as StationAttempt[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Stethoscope className="h-12 w-12 text-muted-foreground/50 mx-auto" />
          <h2 className="text-xl font-display font-bold">No Station Attempts Yet</h2>
          <p className="text-muted-foreground">Complete a clinical station to see your history here.</p>
        </CardContent>
      </Card>
    );
  }

  const modeLabel: Record<string, string> = {
    instant: 'Single',
    adaptive: 'Adaptive',
    exam: 'Exam',
  };

  const modeColor: Record<string, string> = {
    instant: 'bg-primary/10 text-primary',
    adaptive: 'bg-secondary/10 text-secondary',
    exam: 'bg-warning/10 text-warning',
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{attempts.length} past station{attempts.length !== 1 ? 's' : ''}</p>
      {attempts.map(attempt => {
        const isExpanded = expandedId === attempt.id;
        const scores = attempt.scores as Record<string, number> | null;
        const psychograph = attempt.psychograph as Record<string, number> | null;
        const hasScores = scores && Object.keys(scores).length > 0;
        const hasPsychograph = psychograph && Object.keys(psychograph).length > 0;
        const totalScore = hasScores
          ? Math.round(Object.values(scores).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) / Math.max(Object.keys(scores).length, 1))
          : null;

        return (
          <Card key={attempt.id} className="hover:border-primary/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{attempt.subject}</span>
                    <Badge variant="outline" className={`text-xs ${modeColor[attempt.mode] || ''}`}>
                      {modeLabel[attempt.mode] || attempt.mode}
                    </Badge>
                    {totalScore !== null && (
                      <Badge variant="secondary" className="text-xs">{totalScore}%</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {Math.floor(attempt.time_taken_seconds / 60)}m {attempt.time_taken_seconds % 60}s
                    </span>
                    <span>
                      {new Date(attempt.created_at).toLocaleDateString()} {new Date(attempt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {(hasScores || hasPsychograph) && (
                  <Button variant="ghost" size="sm" onClick={() => setExpandedId(isExpanded ? null : attempt.id)}>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {hasScores && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(scores).map(([key, val]) => (
                        <div key={key} className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold font-display">{typeof val === 'number' ? val : '—'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasPsychograph && (
                    <div className="flex justify-center">
                      <PsychographRadar data={psychograph as any} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
