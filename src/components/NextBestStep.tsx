import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Zap, Brain, Activity, BookOpen, Target, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Recommendation {
  icon: React.ElementType;
  title: string;
  description: string;
  link: string;
  linkLabel: string;
  accent: string;
}

export function NextBestStep() {
  const { user } = useAuth();
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const compute = async () => {
      try {
        const [readinessRes, subjectRes, behaviorRes, flashcardRes, osceRes] = await Promise.all([
          supabase.from('readiness_dna').select('attempt_count, clinical_accuracy, readiness_score').eq('user_id', user.id).maybeSingle(),
          supabase.from('subject_dna').select('subject, accuracy, attempt_count').eq('user_id', user.id),
          supabase.from('behavior_profiles').select('rush_index').eq('user_id', user.id).maybeSingle(),
          supabase.from('flashcard_reviews').select('id').eq('user_id', user.id).lte('next_review_at', new Date().toISOString()).limit(1),
          supabase.from('station_attempts').select('id').eq('user_id', user.id).limit(1),
        ]);

        const attempts = readinessRes.data?.attempt_count || 0;

        // No attempts → take diagnostic
        if (attempts === 0) {
          setRec({
            icon: Compass,
            title: 'Take Your Diagnostic Assessment',
            description: 'Complete a quick diagnostic MCQ to establish your baseline and unlock personalized recommendations.',
            link: '/assess',
            linkLabel: 'Start Diagnostic',
            accent: 'text-primary',
          });
          setLoading(false);
          return;
        }

        // Flashcards due
        if (flashcardRes.data && flashcardRes.data.length > 0) {
          setRec({
            icon: Brain,
            title: 'Review Due Flashcards',
            description: 'You have flashcards due for review. Spaced repetition is most effective when done on schedule.',
            link: '/flashcards',
            linkLabel: 'Review Now',
            accent: 'text-chart-3',
          });
          setLoading(false);
          return;
        }

        // No OSCE attempts
        if (!osceRes.data || osceRes.data.length === 0) {
          setRec({
            icon: Activity,
            title: 'Try Your First OSCE Station',
            description: 'Practice clinical communication with an AI patient. Complete at least one station to unlock your psychograph.',
            link: '/stations',
            linkLabel: 'Start Station',
            accent: 'text-chart-1',
          });
          setLoading(false);
          return;
        }

        // Find weakest subject
        const subjects = subjectRes.data || [];
        if (subjects.length > 0) {
          const weakest = subjects.reduce((min, s) => ((s.accuracy ?? 100) < (min.accuracy ?? 100) ? s : min), subjects[0]);
          if ((weakest.accuracy ?? 100) < 60) {
            setRec({
              icon: Target,
              title: `Strengthen ${weakest.subject}`,
              description: `Your accuracy in ${weakest.subject} is ${Math.round(weakest.accuracy ?? 0)}%. Focused practice can close this gap.`,
              link: '/practice',
              linkLabel: 'Practice Now',
              accent: 'text-destructive',
            });
            setLoading(false);
            return;
          }
        }

        // High rush index
        if (behaviorRes.data && (behaviorRes.data.rush_index ?? 0) > 30) {
          setRec({
            icon: Zap,
            title: 'Slow Down with Recharge Mode',
            description: 'Your rush index is high. Try a Recharge session where you can change answers to practice deliberate thinking.',
            link: '/practice',
            linkLabel: 'Start Recharge',
            accent: 'text-chart-4',
          });
          setLoading(false);
          return;
        }

        // Default: full mock
        setRec({
          icon: BookOpen,
          title: 'Run a Full Mock Exam',
          description: 'You\'re progressing well. Test yourself with a timed 150-question mock to simulate exam day.',
          link: '/practice',
          linkLabel: 'Start Mock',
          accent: 'text-primary',
        });
      } catch {
        setRec(null);
      } finally {
        setLoading(false);
      }
    };

    compute();
  }, [user]);

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!rec) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ${rec.accent}`}>
            <rec.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next Best Step</span>
            </div>
            <h3 className="font-display font-semibold text-foreground">{rec.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{rec.description}</p>
            <Button asChild size="sm" className="mt-2 gap-1">
              <Link to={rec.link}>
                {rec.linkLabel} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
