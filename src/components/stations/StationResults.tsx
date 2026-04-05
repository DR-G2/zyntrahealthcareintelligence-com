import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { PsychographRadar } from './PsychographRadar';
import { ModelAnswerCoaching } from './ModelAnswerCoaching';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bookmark, BookmarkCheck, StickyNote, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface StationResultsProps {
  stationId?: string;
  scenarioTitle?: string;
  checklistItems?: { id: string; label: string }[];
  subject?: string;
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
  stationAttemptId?: string;
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

export function StationResults({ scores, psychograph, archetype, recommendations, summary, stationAttemptId }: StationResultsProps) {
  const gate = useFeatureGate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);

  useEffect(() => {
    if (!user || !stationAttemptId) return;
    const load = async () => {
      const [{ data: bData }, { data: nData }] = await Promise.all([
        supabase.from('station_bookmarks' as any).select('id').eq('user_id', user.id).eq('station_attempt_id', stationAttemptId).maybeSingle(),
        supabase.from('station_notes' as any).select('note_text').eq('user_id', user.id).eq('station_attempt_id', stationAttemptId).maybeSingle(),
      ]);
      setIsBookmarked(!!bData);
      if (nData) {
        setSavedNote((nData as any).note_text);
        setNoteText((nData as any).note_text);
      }
    };
    load();
  }, [user, stationAttemptId]);

  const toggleBookmark = async () => {
    if (!user || !stationAttemptId || !gate.canSaveBookmarks) return;
    if (isBookmarked) {
      await supabase.from('station_bookmarks' as any).delete().eq('user_id', user.id).eq('station_attempt_id', stationAttemptId);
      setIsBookmarked(false);
    } else {
      await (supabase.from('station_bookmarks' as any) as any).insert({ user_id: user.id, station_attempt_id: stationAttemptId });
      setIsBookmarked(true);
    }
  };

  const saveNote = async () => {
    if (!user || !stationAttemptId || !gate.canAccessNotes) return;
    if (savedNote) {
      await supabase.from('station_notes' as any).update({ note_text: noteText } as any).eq('user_id', user.id).eq('station_attempt_id', stationAttemptId);
    } else {
      await (supabase.from('station_notes' as any) as any).insert({ user_id: user.id, station_attempt_id: stationAttemptId, note_text: noteText });
    }
    setSavedNote(noteText);
    setEditingNote(false);
    toast({ title: 'Note saved' });
  };

  return (
    <div className="space-y-6">
      {/* Bookmark + Save actions */}
      {stationAttemptId && (
        <div className="flex items-center gap-2 justify-end">
          {gate.canSaveBookmarks ? (
            <Button variant="outline" size="sm" onClick={toggleBookmark} className="gap-1.5">
              {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
              {isBookmarked ? 'Saved' : 'Save Station'}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-50">
              <Lock className="h-3.5 w-3.5" /> Save (Pro)
            </Button>
          )}
        </div>
      )}

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

      {/* Recommendations — gated */}
      {gate.canAccessLearningPoints ? (
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
      ) : (
        <UpgradePrompt feature="Recommendations" description="Upgrade to see personalised recommendations for each station." variant="card" />
      )}

      {/* Notes Section */}
      {stationAttemptId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-4/10">
                  <StickyNote className="h-4 w-4 text-chart-4" />
                </div>
                <CardTitle className="text-sm font-display">My Notes</CardTitle>
              </div>
              {!gate.canAccessNotes && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="h-3 w-3" /> Pro
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {gate.canAccessNotes ? (
              editingNote || !savedNote ? (
                <div className="space-y-2">
                  <Textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add your study notes for this station…"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveNote}>Save Note</Button>
                    {savedNote && <Button size="sm" variant="ghost" onClick={() => { setEditingNote(false); setNoteText(savedNote); }}>Cancel</Button>}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{savedNote}</p>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNote(true)} className="gap-1">
                    <StickyNote className="h-3.5 w-3.5" /> Edit Note
                  </Button>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Upgrade to a paid plan to add personal notes to stations.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
