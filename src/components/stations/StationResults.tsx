import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PsychographRadar } from './PsychographRadar';
import ReactMarkdown from 'react-markdown';

interface StationResultsProps {
  scores: {
    overall: number;
    communication: number;
    clinical_reasoning: number;
    clinical_safety: number;
    time_management: number;
    examination_accuracy: number;
    investigation_accuracy: number;
    management_accuracy: number;
  };
  psychograph: {
    cognitive_stability: number;
    emotional_reactivity: number;
    time_compression_vulnerability: number;
    silence_tolerance: number;
    delegation_confidence: number;
    structure_integrity: number;
  };
  archetype: string;
  recommendations: string[];
  summary: string;
}

const scoreLabels: Record<string, string> = {
  communication: 'Communication',
  clinical_reasoning: 'Clinical Reasoning',
  clinical_safety: 'Patient Safety',
  time_management: 'Time Management',
  examination_accuracy: 'Examination',
  investigation_accuracy: 'Investigations',
  management_accuracy: 'Management',
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-destructive';
}

function getProgressColor(score: number) {
  if (score >= 80) return '[&>div]:bg-green-500';
  if (score >= 60) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-destructive';
}

export function StationResults({ scores, psychograph, archetype, recommendations, summary }: StationResultsProps) {
  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <CardContent className="pt-6 text-center">
          <div className={`text-5xl font-bold font-display ${getScoreColor(scores.overall)}`}>
            {Math.round(scores.overall)}%
          </div>
          <p className="text-muted-foreground text-sm mt-1">Overall Station Score</p>
          <Badge className="mt-3" variant={scores.overall >= 60 ? 'default' : 'destructive'}>
            {archetype}
          </Badge>
        </CardContent>
      </Card>

      {/* Domain Scores + Psychograph side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Domain Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(scoreLabels).map(([key, label]) => {
              const val = scores[key as keyof typeof scores] || 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${getScoreColor(val)}`}>{Math.round(val)}%</span>
                  </div>
                  <Progress value={val} className={`h-2 ${getProgressColor(val)}`} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Psychograph</CardTitle>
          </CardHeader>
          <CardContent>
            <PsychographRadar data={psychograph} />
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-primary font-bold mt-0.5">→</span>
                <span className="text-foreground">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
