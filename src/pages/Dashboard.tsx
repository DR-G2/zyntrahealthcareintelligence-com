import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Zap, ArrowRight, Rss, PlayCircle, Brain } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { WelcomeTour } from '@/components/WelcomeTour';
import { ReadinessDNA } from '@/components/ReadinessDNA';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const { profile, user } = useAuth();
  const gate = useFeatureGate();
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem(WelcomeTour.STORAGE_KEY)
  );
  const [activeSession, setActiveSession] = useState<any>(null);
  const daysUntilExam = profile?.exam_date
    ? differenceInDays(parseISO(profile.exam_date), new Date())
    : null;

  // Check for active sessions to resume
  useEffect(() => {
    if (!user) return;
    supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setActiveSession(data);
      });
  }, [user]);

  return (
    <AppLayout>
      {showTour && (
        <WelcomeTour
          userName={profile?.name?.split(' ')[0]}
          onComplete={() => setShowTour(false)}
        />
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">
          Welcome back, {profile?.name?.split(' ')[0] || 'Doctor'}
        </h1>
        <p className="text-muted-foreground">
          {daysUntilExam !== null && daysUntilExam > 0
            ? `${daysUntilExam} days until your exam`
            : 'Your exam preparation hub'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {daysUntilExam !== null && daysUntilExam > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Exam Countdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-display text-primary">{daysUntilExam}</div>
              <p className="text-sm text-muted-foreground">days remaining</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resume Session Card */}
      {activeSession && (
        <Card className="mt-6 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PlayCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold font-display">Resume Your Last Session</h3>
                <p className="text-sm text-muted-foreground">
                  You stopped at Question {(activeSession.current_index || 0) + 1} of {(activeSession.question_ids as any[])?.length || '?'}.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link to={`/practice?resume=${activeSession.session_id}`}>
                Resume <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Daily Usage for Free Users */}
      {!gate.isPaid && !gate.loading && (
        <Card className="mt-6 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Today's Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'MCQ Attempts', used: gate.mcqUsedToday, limit: gate.mcqDailyLimit },
              { label: 'OSCE Attempts', used: gate.osceUsedToday, limit: gate.osceDailyLimit },
              { label: 'AI Prompts', used: gate.promptsUsedToday, limit: gate.promptDailyLimit },
            ].map(({ label, used, limit }) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{used} / {limit}</span>
                </div>
                <Progress value={(used / limit) * 100} className="h-2" />
              </div>
            ))}
            <Button variant="link" asChild className="h-auto p-0 text-xs">
              <Link to="/pricing">Upgrade for unlimited →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AMC Readiness DNA */}
      <div className="mt-8">
        <ReadinessDNA />
      </div>

      {/* Zyntra AI Core Widget */}
      <Card className="mt-6 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold font-display">Zyntra AI Core</h3>
              <p className="text-xs text-muted-foreground">Learning from your practice patterns</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/companion/ai-core">View <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="group hover:border-primary/30 transition-colors">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <CardTitle className="font-display">Take Diagnostic</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Start your APPE journey with a timed diagnostic test
            </p>
            <Button asChild className="gap-1">
              <Link to="/assess">Begin Assessment <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/30 transition-colors">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary mb-2">
              <Zap className="h-5 w-5" />
            </div>
            <CardTitle className="font-display">Practice Drills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Speed rounds, commitment drills, and pressure tests
            </p>
            <Button variant="secondary" asChild className="gap-1">
              <Link to="/practice">Start Practice <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group hover:border-primary/30 transition-colors">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent-foreground mb-2">
              <Rss className="h-5 w-5" />
            </div>
            <CardTitle className="font-display">Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Paste clinical content and generate practice questions instantly
            </p>
            <Button variant="outline" asChild className="gap-1">
              <Link to="/feed">Open Feed <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
