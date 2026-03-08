import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Zap, Calendar, ArrowRight } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { WelcomeTour } from '@/components/WelcomeTour';

export default function Dashboard() {
  const { profile } = useAuth();
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem(WelcomeTour.STORAGE_KEY)
  );
  const daysUntilExam = profile?.exam_date
    ? differenceInDays(parseISO(profile.exam_date), new Date())
    : null;

  return (
    <AppLayout>
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

      </div>
    </AppLayout>
  );
}
