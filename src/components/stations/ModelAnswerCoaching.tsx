import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Award, Loader2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ModelAnswerCoachingProps {
  stationId?: string;
  subject: string;
  scenarioTitle: string;
  checklistItems?: { id: string; label: string }[];
}

interface WalkthroughStep {
  checklist_item: string;
  ideal_response: string;
  tips: string;
}

export function ModelAnswerCoaching({ stationId, subject, scenarioTitle, checklistItems }: ModelAnswerCoachingProps) {
  const gate = useFeatureGate();
  const [walkthrough, setWalkthrough] = useState<WalkthroughStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!gate.canAccessLearningPoints) {
    return <UpgradePrompt feature="Model Answer Coaching" description="See ideal consultation walkthroughs showing exactly what a clear-pass candidate would say." variant="card" />;
  }

  const loadModelAnswer = async () => {
    if (walkthrough) { setExpanded(!expanded); return; }
    setLoading(true);
    setError(null);

    try {
      // Check cache
      if (stationId) {
        const { data: cached } = await supabase
          .from('model_answers' as any)
          .select('model_walkthrough')
          .eq('station_id', stationId)
          .maybeSingle();
        if (cached) {
          setWalkthrough((cached as any).model_walkthrough as WalkthroughStep[]);
          setExpanded(true);
          setLoading(false);
          return;
        }
      }

      // Generate via edge function
      const resp = await supabase.functions.invoke('generate-model-answer', {
        body: {
          station_id: stationId,
          subject,
          scenario_title: scenarioTitle,
          checklist_items: checklistItems?.map(c => c.label) || [],
        },
      });

      if (resp.error) throw resp.error;
      setWalkthrough(resp.data?.walkthrough || []);
      setExpanded(true);
    } catch (err) {
      console.error(err);
      setError('Failed to generate model answer. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-2/10">
              <Award className="h-4 w-4 text-chart-2" />
            </div>
            <CardTitle className="text-sm font-display">Gold-Standard Coaching</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadModelAnswer}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {walkthrough ? (expanded ? 'Hide' : 'Show') : 'See Model Answer'}
          </Button>
        </div>
      </CardHeader>

      {error && (
        <CardContent className="pt-0">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}

      {expanded && walkthrough && (
        <CardContent className="pt-0 space-y-4">
          <p className="text-xs text-muted-foreground">
            This shows what a "clear pass" candidate would typically say or do for each checklist item.
          </p>
          {walkthrough.map((step, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm font-medium">{step.checklist_item}</p>
              </div>
              <div className="ml-6 space-y-1">
                <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{step.ideal_response}</ReactMarkdown>
                </div>
                {step.tips && (
                  <p className="text-xs text-muted-foreground italic">💡 {step.tips}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
