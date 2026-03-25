import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Lock, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle, Zap, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Minus, Plus, Search, X, BookOpen, Stethoscope } from 'lucide-react';
import { MCQHistory } from '@/components/history/MCQHistory';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { OnboardingTooltip } from '@/components/OnboardingTooltip';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { PracticeSkeleton } from '@/components/skeletons/PageSkeleton';
import { QuestionExplanation } from '@/components/practice/QuestionExplanation';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { buildPracticeTopicResolver, normalizeTopicLabel, resolvePracticeQuestionPlacement } from '@/lib/practice-topic-mapping';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  difficulty?: string;
  diagnosis_explanation?: string | null;
  first_line_investigation?: string | null;
  gold_standard_investigation?: string | null;
  best_treatment?: string | null;
  differential_diagnoses?: any[] | null;
  incorrect_answer_explanations?: Record<string, any> | null;
  key_takeaways?: string[] | null;
}

interface SessionConfig {
  mode: 'recharge' | 'no-change';
  topics: string[];
  subtopics: string[];
  questionCount: number;
}

// ─── Filter types ───────────────────────────────────────────────
type FilterMode = 'subject';

interface DBSubject {
  id: string;
  name: string;
  display_order: number | null;
}

interface DBSubtopic {
  id: string;
  name: string;
  subject_id: string;
  display_order: number | null;
}

interface QuestionTopicMeta {
  id: string;
  category: string;
  subtopic: string | null;
  question_text: string;
}

const QUESTION_META_PAGE_SIZE = 1000;

async function fetchAllQuestionTopicMeta(): Promise<QuestionTopicMeta[]> {
  const rows: QuestionTopicMeta[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, category, subtopic, question_text')
      .range(from, from + QUESTION_META_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...(data as QuestionTopicMeta[]));

    if (data.length < QUESTION_META_PAGE_SIZE) break;
    from += QUESTION_META_PAGE_SIZE;
  }

  return rows;
}

// ─── Setup Screen ───────────────────────────────────────────────

function SetupScreen({ onStart, onShowHistory }: { onStart: (config: SessionConfig) => void; onShowHistory?: () => void }) {
  const gate = useFeatureGate();
  const [mode, setMode] = useState<'recharge' | 'no-change'>('recharge');
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [subtopicCounts, setSubtopicCounts] = useState<Record<string, number>>({});
  const [dbSubjects, setDbSubjects] = useState<DBSubject[]>([]);
  const [dbSubtopics, setDbSubtopics] = useState<DBSubtopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [subjectsRes, subtopicsRes, questionMeta] = await Promise.all([
          supabase.from('subjects').select('id, name, display_order').order('display_order'),
          supabase.from('subtopics').select('id, name, subject_id, display_order').order('display_order'),
          fetchAllQuestionTopicMeta(),
        ]);

        if (subjectsRes.error) throw subjectsRes.error;
        if (subtopicsRes.error) throw subtopicsRes.error;

        const subjects = (subjectsRes.data || []) as DBSubject[];
        const subtopics = (subtopicsRes.data || []) as DBSubtopic[];
        const resolver = buildPracticeTopicResolver(subjects, subtopics);
        const catCounts: Record<string, number> = {};
        const stCounts: Record<string, number> = {};

        questionMeta.forEach((question) => {
          const placement = resolvePracticeQuestionPlacement(question, resolver);

          if (placement.subjectName) {
            catCounts[placement.subjectName] = (catCounts[placement.subjectName] || 0) + 1;
          }

          if (placement.subtopicName) {
            stCounts[placement.subtopicName] = (stCounts[placement.subtopicName] || 0) + 1;
          }
        });

        setDbSubjects(subjects);
        setDbSubtopics(subtopics);
        setCategoryCounts(catCounts);
        setSubtopicCounts(stCounts);
        setSelectedSubjects(new Set(subjects.map((subject) => subject.name)));
      } catch (error: any) {
        console.error('Failed to load practice filters', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Build subject → subtopics map
  const subjectSubtopicsMap = useMemo(() => {
    const map: Record<string, DBSubtopic[]> = {};
    dbSubjects.forEach(s => {
      map[s.id] = dbSubtopics
        .filter(st => st.subject_id === s.id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    });
    return map;
  }, [dbSubjects, dbSubtopics]);

  const subjectCounts = categoryCounts;

  const toggleExpand = (item: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const toggleSubject = (subjectName: string, subjectId: string) => {
    const subtopicsForSubject = subjectSubtopicsMap[subjectId] || [];
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectName)) {
        next.delete(subjectName);
        // Also deselect all subtopics for this subject
        setSelectedSubtopics(prev2 => {
          const next2 = new Set(prev2);
          subtopicsForSubject.forEach(st => next2.delete(st.name));
          return next2;
        });
      } else {
        next.add(subjectName);
      }
      return next;
    });
  };

  const toggleSubtopic = (subtopicName: string, parentSubjectName: string) => {
    setSelectedSubtopics(prev => {
      const next = new Set(prev);
      if (next.has(subtopicName)) next.delete(subtopicName);
      else next.add(subtopicName);
      return next;
    });
    // Ensure parent subject is selected
    if (!selectedSubjects.has(parentSubjectName)) {
      setSelectedSubjects(prev => new Set(prev).add(parentSubjectName));
    }
  };

  const selectAll = () => {
    setSelectedSubjects(new Set(dbSubjects.map(s => s.name)));
    setSelectedSubtopics(new Set());
  };

  const clearAll = () => {
    setSelectedSubjects(new Set());
    setSelectedSubtopics(new Set());
  };

  const handleQuestionCountChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1) {
      setQuestionCount(Math.min(500, num));
    } else if (value === '') {
      setQuestionCount(1);
    }
  };

  const incrementCount = () => setQuestionCount(prev => Math.min(500, prev + 1));
  const decrementCount = () => setQuestionCount(prev => Math.max(1, prev - 1));

  const quickPresets = [10, 20, 40, 60, 100];
  const canStart = selectedSubjects.size > 0;

  if (loading) {
    return (
      <AppLayout>
        <PracticeSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Practice Drills</h1>
            <p className="text-muted-foreground">Configure your session and start practising</p>
          </div>
          {onShowHistory && (
            <Button variant="outline" onClick={onShowHistory} className="gap-2">
              <BookOpen className="h-4 w-4" /> History
            </Button>
          )}
        </div>

        {!gate.canUseMCQ && (
          <UpgradePrompt feature="Daily MCQ Limit Reached" description={`You've used ${gate.mcqUsedToday}/${gate.mcqDailyLimit} free MCQs today. Upgrade for unlimited practice.`} variant="banner" />
        )}

        <OnboardingTooltip
          id="practice-intro"
          title="Welcome to Practice Drills"
          description="Choose Recharge mode to revisit questions you got wrong, or No Change mode for fresh questions. Use the topic filters below to focus on your weak areas."
        />

        {/* Mode Selection */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Select Mode</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setMode('recharge')}
              className={cn(
                'rounded-xl border-2 p-5 text-left transition-all',
                mode === 'recharge'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <span className="font-display font-semibold">Recharge Answer</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Change your answer as many times as you want before moving to the next question.
              </p>
            </button>

            <button
              onClick={() => setMode('no-change')}
              className={cn(
                'rounded-xl border-2 p-5 text-left transition-all',
                mode === 'no-change'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
                  <Lock className="h-5 w-5" />
                </div>
                <span className="font-display font-semibold">No Change</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Once you select an answer, it's locked. No going back.
              </p>
            </button>
          </div>
        </div>

        {/* Question Count Selector */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Questions</h2>
          
          <div className="flex flex-wrap gap-2">
            {quickPresets.map((preset) => (
              <Button
                key={preset}
                variant={questionCount === preset ? "default" : "outline"}
                size="sm"
                onClick={() => setQuestionCount(preset)}
                className="min-w-[3rem]"
              >
                {preset}
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={decrementCount} disabled={questionCount <= 1}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={1}
              max={500}
              value={questionCount}
              onChange={(e) => handleQuestionCountChange(e.target.value)}
              className="w-20 text-center font-mono text-lg"
            />
            <Button variant="outline" size="icon" onClick={incrementCount} disabled={questionCount >= 500}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">≈ {questionCount} minutes</p>
        </div>

        {/* Topic Filters — Subject → Subtopics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic Filters</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>Clear All</Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subjects or subtopics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Subject list with subtopics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dbSubjects
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
              .filter((subject) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                const subtopics = subjectSubtopicsMap[subject.id] || [];
                return subject.name.toLowerCase().includes(q) || subtopics.some(st => st.name.toLowerCase().includes(q));
              })
              .map((subject) => {
                const subtopics = subjectSubtopicsMap[subject.id] || [];
                const isSelected = selectedSubjects.has(subject.name);
                const searchMatch = searchQuery.trim() && subtopics.some(st => st.name.toLowerCase().includes(searchQuery.toLowerCase()));

                return (
                  <Collapsible
                    key={subject.id}
                    open={expandedItems.has(subject.id) || searchMatch}
                    onOpenChange={() => toggleExpand(subject.id)}
                  >
                    <div className={cn(
                      'rounded-lg border transition-colors',
                      isSelected ? 'border-primary/40 bg-primary/5' : 'border-border'
                    )}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSubject(subject.name, subject.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="font-medium text-sm">{subject.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {subjectCounts[subject.name] || 0}
                          </Badge>
                        </div>
                        {subtopics.length > 0 && (
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            expandedItems.has(subject.id) && "rotate-180"
                          )} />
                        )}
                      </CollapsibleTrigger>
                      {subtopics.length > 0 && (
                        <CollapsibleContent>
                          <div className="border-t border-border/50 px-4 py-3 space-y-2">
                            {subtopics.map((st) => (
                              <label
                                key={st.id}
                                className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Checkbox
                                  checked={selectedSubtopics.has(st.name)}
                                  onCheckedChange={() => toggleSubtopic(st.name, subject.name)}
                                />
                                <span>{st.name}</span>
                                {subtopicCounts[st.name] ? (
                                  <Badge variant="outline" className="text-[10px] ml-auto">
                                    {subtopicCounts[st.name]}
                                  </Badge>
                                ) : null}
                              </label>
                            ))}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
                  </Collapsible>
                );
              })}
          </div>

          {selectedSubjects.size === 0 && (
            <p className="text-sm text-destructive">Select at least one subject</p>
          )}
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => {
            onStart({
              mode,
              topics: Array.from(selectedSubjects),
              subtopics: Array.from(selectedSubtopics),
              questionCount,
            });
          }}
          className="w-full sm:w-auto gap-2"
        >
          <Zap className="h-4 w-4" /> Start Drill
        </Button>
      </div>
    </AppLayout>
  );
}

// ─── Drill Session ──────────────────────────────────────────────

function DrillSession({
  config,
  onFinish,
  resumeSessionId,
}: {
  config: SessionConfig;
  onFinish: (questions: Question[], answers: Record<number, string>, changes: Record<number, number>, times: Record<number, number>, ruledOut: Record<number, string[]>) => void;
  resumeSessionId?: string | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canChangeAnswer = config.mode === 'recharge';
  const timeSeconds = config.questionCount * 60;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [lockedAnswers, setLockedAnswers] = useState<Record<number, boolean>>({});
  const [answerChanges, setAnswerChanges] = useState<Record<number, number>>({});
  const [changeSequences, setChangeSequences] = useState<Record<number, string[]>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [questionLoadTime, setQuestionLoadTime] = useState(Date.now());
  const [firstClickRecorded, setFirstClickRecorded] = useState<Record<number, boolean>>({});
  const [timeToFirstClick, setTimeToFirstClick] = useState<Record<number, number>>({});
  const [pauseEvents, setPauseEvents] = useState<Record<number, number>>({});
  const [ruledOutOptions, setRuledOutOptions] = useState<Record<number, Set<string>>>({});
  const [timeRemaining, setTimeRemaining] = useState(timeSeconds);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const sessionIdRef = useRef(resumeSessionId || crypto.randomUUID());
  const lastInteractionRef = useRef(Date.now());
  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save to active_sessions
  const saveSession = useCallback(async (qs: Question[], idx: number, answers: Record<number, string>, changes: Record<number, number>, sequences: Record<number, string[]>, times: Record<number, number>, ttfc: Record<number, number>, pauses: Record<number, number>, timeLeft: number) => {
    if (!user || qs.length === 0) return;
    try {
      await supabase.from('active_sessions').upsert({
        user_id: user.id,
        session_id: sessionIdRef.current,
        session_type: 'mcq',
        config: config as any,
        question_ids: qs.map(q => q.id),
        answers: answers,
        answer_changes: changes,
        change_sequences: sequences,
        question_times: times,
        time_to_first_click: ttfc,
        pause_events: pauses,
        current_index: idx,
        time_remaining: timeLeft,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'session_id' });
    } catch (e) {
      console.error('Auto-save failed', e);
    }
  }, [user, config]);

  const deleteSession = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('active_sessions').delete().eq('session_id', sessionIdRef.current);
    } catch (e) {
      console.error('Delete session failed', e);
    }
  }, [user]);

  useEffect(() => {
    const fetchQ = async () => {
      // Check for resume
      if (resumeSessionId && user) {
        try {
          const { data: session } = await supabase
            .from('active_sessions')
            .select('*')
            .eq('session_id', resumeSessionId)
            .eq('user_id', user.id)
            .single();

          if (session) {
            const questionIds = session.question_ids as string[];
            const { data: qs } = await supabase
              .from('questions')
              .select('id, question_text, options, correct_answer, explanation, category, difficulty, diagnosis_explanation, first_line_investigation, gold_standard_investigation, best_treatment, differential_diagnoses, incorrect_answer_explanations, key_takeaways')
              .in('id', questionIds);

            if (qs && qs.length > 0) {
              const ordered = questionIds.map(id => qs.find(q => q.id === id)).filter(Boolean) as Question[];
              setQuestions(ordered);
              setSelectedAnswers((session.answers as Record<number, string>) || {});
              setAnswerChanges((session.answer_changes as Record<number, number>) || {});
              setChangeSequences((session.change_sequences as Record<number, string[]>) || {});
              setQuestionTimes((session.question_times as Record<number, number>) || {});
              setTimeToFirstClick((session.time_to_first_click as Record<number, number>) || {});
              setPauseEvents((session.pause_events as Record<number, number>) || {});
              setCurrentIndex(session.current_index || 0);
              setTimeRemaining(session.time_remaining || timeSeconds);

              await supabase.from('active_sessions').update({ restored: true } as any).eq('session_id', resumeSessionId);

              // Show restore overlay
              setRestoring(true);
              setTimeout(() => setRestoring(false), 1500);

              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error('Resume failed', e);
        }
      }

      // Normal fetch
      const [subjectsRes, subtopicsRes, questionMeta] = await Promise.all([
        supabase.from('subjects').select('id, name'),
        supabase.from('subtopics').select('name, subject_id'),
        fetchAllQuestionTopicMeta(),
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (subtopicsRes.error) throw subtopicsRes.error;

      const resolver = buildPracticeTopicResolver(subjectsRes.data || [], subtopicsRes.data || []);
      const selectedSubjects = new Set(config.topics.map((topic) => normalizeTopicLabel(topic)));
      const matchingIds = questionMeta
        .filter((question) => {
          const placement = resolvePracticeQuestionPlacement(question, resolver);
          return placement.subjectName && selectedSubjects.has(normalizeTopicLabel(placement.subjectName));
        })
        .map((question) => question.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, config.questionCount);

      if (matchingIds.length > 0) {
        const { data } = await supabase
          .from('questions')
          .select('id, question_text, options, correct_answer, explanation, category, difficulty, diagnosis_explanation, first_line_investigation, gold_standard_investigation, best_treatment, differential_diagnoses, incorrect_answer_explanations, key_takeaways')
          .in('id', matchingIds);

        if (data) {
          const ordered = matchingIds
            .map((id) => data.find((question) => question.id === id))
            .filter(Boolean) as Question[];
          setQuestions(ordered);
        }
      }
      setLoading(false);
    };
    fetchQ();
  }, []);

  // Pause detection
  useEffect(() => {
    if (loading || finished) return;
    pauseTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastInteractionRef.current) / 1000;
      if (elapsed > 10) {
        setPauseEvents(prev => ({ ...prev, [currentIndex]: (prev[currentIndex] || 0) + 1 }));
        lastInteractionRef.current = Date.now();
      }
    }, 5000);
    return () => { if (pauseTimerRef.current) clearInterval(pauseTimerRef.current); };
  }, [loading, finished, currentIndex]);

  useEffect(() => {
    if (loading || finished) return;
    const interval = setInterval(() => {
      setTimeRemaining((p) => {
        if (p <= 1) {
          clearInterval(interval);
          doFinish();
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, finished]);

  const recordTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    setQuestionTimes((p) => ({ ...p, [currentIndex]: (p[currentIndex] || 0) + elapsed }));
  }, [currentIndex, questionStartTime]);

  const selectAnswer = (answer: string) => {
    if (lockedAnswers[currentIndex]) return;
    lastInteractionRef.current = Date.now();

    // Track first click
    if (!firstClickRecorded[currentIndex]) {
      const delta = Math.round((Date.now() - questionLoadTime) / 1000);
      setTimeToFirstClick(prev => ({ ...prev, [currentIndex]: delta }));
      setFirstClickRecorded(prev => ({ ...prev, [currentIndex]: true }));
    }

    // Track change sequence
    const newSequences = { ...changeSequences };
    const seq = newSequences[currentIndex] || [];
    newSequences[currentIndex] = [...seq, answer];
    setChangeSequences(newSequences);

    const newChanges = { ...answerChanges };
    if (selectedAnswers[currentIndex] && selectedAnswers[currentIndex] !== answer) {
      newChanges[currentIndex] = (newChanges[currentIndex] || 0) + 1;
      setAnswerChanges(newChanges);
    }
    const newAnswers = { ...selectedAnswers, [currentIndex]: answer };
    setSelectedAnswers(newAnswers);
    if (!canChangeAnswer) {
      setLockedAnswers((p) => ({ ...p, [currentIndex]: true }));
    }

    // If selecting a ruled-out option, remove the rule-out
    setRuledOutOptions(prev => {
      const current = prev[currentIndex];
      if (current?.has(answer)) {
        const next = new Set(current);
        next.delete(answer);
        return { ...prev, [currentIndex]: next };
      }
      return prev;
    });

    // Auto-save (debounced)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      saveSession(questions, currentIndex, newAnswers, newChanges, newSequences, questionTimes, timeToFirstClick, pauseEvents, timeRemaining);
    }, 500);
  };

  const toggleRuleOutOption = (letter: string) => {
    // Don't rule out the currently selected answer
    if (selectedAnswers[currentIndex] === letter) return;
    if (lockedAnswers[currentIndex]) return;
    lastInteractionRef.current = Date.now();
    
    setRuledOutOptions(prev => {
      const current = prev[currentIndex] || new Set<string>();
      const next = new Set(current);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return { ...prev, [currentIndex]: next };
    });
  };

  const goTo = (i: number) => {
    recordTime();
    lastInteractionRef.current = Date.now();
    setCurrentIndex(i);
    setQuestionStartTime(Date.now());
    setQuestionLoadTime(Date.now());
  };

  const doFinish = async () => {
    if (finished) return;
    setFinished(true);
    recordTime();

    // Delete active session
    await deleteSession();

    // Save attempts with enhanced tracking
    if (user && questions.length > 0) {
      const inserts = questions.map((q, i) => ({
        user_id: user.id,
        question_id: q.id,
        selected_answer: selectedAnswers[i] || '',
        time_taken_seconds: questionTimes[i] || 0,
        answer_changes_count: answerChanges[i] || 0,
        is_correct: selectedAnswers[i] === q.correct_answer,
        session_id: sessionIdRef.current,
        time_to_first_click: timeToFirstClick[i] || 0,
        change_sequence: changeSequences[i] || [],
        pause_events: pauseEvents[i] || 0,
        time_of_day: new Date().toISOString(),
        question_position: i,
        previous_question_correct: i > 0 ? (selectedAnswers[i - 1] === questions[i - 1]?.correct_answer) : null,
      }));
      await supabase.from('user_attempts').insert(inserts);

      // Trigger behavior analysis in background
      supabase.functions.invoke('analyze-behavior').catch(console.error);
    }

    // Convert ruled out sets to arrays for results
    const ruledOutArrays: Record<number, string[]> = {};
    Object.entries(ruledOutOptions).forEach(([key, set]) => {
      ruledOutArrays[parseInt(key)] = Array.from(set);
    });

    onFinish(questions, selectedAnswers, answerChanges, questionTimes, ruledOutArrays);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const timerPercent = (timeRemaining / timeSeconds) * 100;

  if (loading) {
    return (
      <AppLayout>
        <PracticeSkeleton />
      </AppLayout>
    );
  }

  // Resume session overlay
  if (restoring) {
    return (
      <AppLayout>
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-md py-24 text-center space-y-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="mx-auto h-12 w-12 rounded-full border-4 border-primary border-t-transparent"
            />
            <h2 className="text-xl font-display font-semibold">Restoring your previous session...</h2>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ animation: 'restore-progress 1.5s ease-out forwards' }} />
            </div>
          </motion.div>
        </AnimatePresence>
      </AppLayout>
    );
  }

  const question = questions[currentIndex];
  if (!question) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <p className="text-muted-foreground">No questions found for the selected topics. Try selecting more topics.</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  const options = question.options as string[];
  const currentRuledOut = ruledOutOptions[currentIndex] || new Set<string>();

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        {/* Timer bar */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Q{currentIndex + 1}/{questions.length}</span>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {config.mode === 'recharge' ? <><RefreshCw className="h-3 w-3 mr-1" />Recharge</> : <><Lock className="h-3 w-3 mr-1" />No Change</>}
              </Badge>
              <span className={cn('font-mono font-bold', timerPercent > 50 ? 'text-success' : timerPercent > 20 ? 'text-warning' : 'text-destructive')}>
                <Clock className="inline h-4 w-4 mr-1" />{formatTime(timeRemaining)}
              </span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', timerPercent > 50 ? 'bg-success' : timerPercent > 20 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${timerPercent}%` }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
            <Card>
              <CardHeader>
                <span className="text-xs text-primary font-medium">{question.category}</span>
                <CardTitle className="text-lg font-normal leading-relaxed">{question.question_text}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {options.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi);
                  const isSelected = selectedAnswers[currentIndex] === letter;
                  const isLocked = lockedAnswers[currentIndex];
                  const isRuledOut = currentRuledOut.has(letter);
                  return (
                    <motion.div
                      key={oi}
                      whileTap={{ scale: 0.98 }}
                      animate={isSelected ? { scale: 1.02, boxShadow: '0 0 0 3px hsl(var(--primary) / 0.15)' } : { scale: 1, boxShadow: '0 0 0 0px transparent' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className={cn(
                        'flex items-center rounded-lg border text-sm transition-all',
                        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/30',
                        isLocked && !isSelected && 'opacity-40 cursor-not-allowed',
                        isRuledOut && !isSelected && 'opacity-40'
                      )}
                    >
                      {/* Rule-out circle */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleRuleOutOption(letter); }}
                        className={cn(
                          'shrink-0 flex items-center justify-center w-10 h-full min-h-[52px] border-r transition-colors rounded-l-lg',
                          isRuledOut ? 'bg-destructive/10 border-destructive/20' : 'border-border/50 hover:bg-muted/50'
                        )}
                        disabled={isLocked}
                        aria-label={`Rule out option ${letter}`}
                      >
                        {isRuledOut ? (
                          <span className="text-destructive text-xs font-bold">✕</span>
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </button>
                      {/* Main select area */}
                      <button
                        type="button"
                        onClick={() => selectAnswer(letter)}
                        disabled={isLocked && !isSelected}
                        className={cn(
                          'flex-1 p-4 text-left flex items-center',
                          isRuledOut && !isSelected && 'line-through text-muted-foreground'
                        )}
                      >
                        <span className={cn('mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          {letter}
                        </span>
                        <span className="flex-1">{opt.replace(/^[A-E]\.\s*/, '')}</span>
                        {isLocked && isSelected && <Lock className="h-3 w-3 ml-2 text-primary shrink-0" />}
                      </button>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          {currentIndex < questions.length - 1 ? (
            <Button onClick={() => goTo(currentIndex + 1)} className="gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={doFinish} className="gap-1">
              <Lock className="h-4 w-4" /> Finish
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Results Screen (Full Scrollable Review) ───────────────────

function ResultsScreen({
  questions,
  answers,
  changes,
  times,
  config,
  drillRuleOuts,
}: {
  questions: Question[];
  answers: Record<number, string>;
  changes: Record<number, number>;
  times: Record<number, number>;
  config: SessionConfig;
  drillRuleOuts: Record<number, string[]>;
}) {
  const { user } = useAuth();
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [ruleOutMode, setRuleOutMode] = useState<Record<number, boolean>>({});
  const [ruleOutSelections, setRuleOutSelections] = useState<Record<number, Set<string>>>({});

  // Stats
  const correct = questions.filter((q, i) => answers[i] === q.correct_answer).length;
  const total = questions.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const totalChanges = Object.values(changes).reduce((a, b) => a + b, 0);
  const totalTime = Object.values(times).reduce((a, b) => a + b, 0);
  const avgTime = total > 0 ? Math.round(totalTime / total) : 0;

  // Category stats
  const categoryStats: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    if (!categoryStats[q.category]) categoryStats[q.category] = { correct: 0, total: 0 };
    categoryStats[q.category].total++;
    if (answers[i] === q.correct_answer) categoryStats[q.category].correct++;
  });

  const strengths = Object.entries(categoryStats).filter(([, s]) => s.total >= 1 && s.correct / s.total >= 0.8).map(([c]) => c);
  const weaknesses = Object.entries(categoryStats).filter(([, s]) => s.total >= 1 && s.correct / s.total < 0.6).map(([c]) => c);

  // Generate insight
  const generateInsight = () => {
    const changesPerQ = total > 0 ? totalChanges / total : 0;
    const easyWrong = questions.filter((q, i) => q.difficulty === 'easy' && answers[i] !== q.correct_answer).length;
    const hardCorrect = questions.filter((q, i) => (q.difficulty === 'hard' || q.difficulty === 'difficult') && answers[i] === q.correct_answer).length;

    if (changesPerQ > 1.5) return "You're overthinking — too many answer changes are costing you marks.";
    if (easyWrong > total * 0.2) return "You're missing easy questions — slow down on straightforward stems.";
    if (avgTime < 30 && accuracy < 60) return "You're rushing through questions — take more time to read the stem.";
    if (hardCorrect > 0 && easyWrong > 0) return "You nail hard questions but slip on easy ones — watch for careless errors.";
    if (accuracy >= 80) return "Strong performance! Focus on the few you missed to push higher.";
    if (weaknesses.length > 0) return `Focus on ${weaknesses.slice(0, 2).join(' and ')} — these are dragging your score.`;
    return "Keep practising consistently to build pattern recognition.";
  };

  // Rule-out scoring
  const getRuleOutScore = (qIndex: number) => {
    const q = questions[qIndex];
    const selections = ruleOutSelections[qIndex];
    if (!selections || selections.size === 0) return null;

    const options = (q.options as string[]);
    const correctLetter = q.correct_answer;
    let correctEliminations = 0;
    let wrongEliminations = 0;
    const details: { letter: string; eliminated: boolean; shouldEliminate: boolean; isCorrectAnswer: boolean }[] = [];

    options.forEach((_, oi) => {
      const letter = String.fromCharCode(65 + oi);
      const eliminated = selections.has(letter);
      const isCorrectAnswer = letter === correctLetter;
      const shouldEliminate = !isCorrectAnswer;

      details.push({ letter, eliminated, shouldEliminate, isCorrectAnswer });

      if (eliminated && shouldEliminate) correctEliminations++;
      if (eliminated && isCorrectAnswer) wrongEliminations++;
    });

    return { correctEliminations, wrongEliminations, total: options.length - 1, details };
  };

  const toggleRuleOut = (qIndex: number) => {
    setRuleOutMode(prev => ({ ...prev, [qIndex]: !prev[qIndex] }));
  };

  const toggleEliminateOption = (qIndex: number, letter: string) => {
    setRuleOutSelections(prev => {
      const current = prev[qIndex] || new Set<string>();
      const next = new Set(current);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return { ...prev, [qIndex]: next };
    });
  };

  const toggleExpand = (i: number) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const expandAll = () => setExpandedQuestions(new Set(questions.map((_, i) => i)));
  const collapseAll = () => setExpandedQuestions(new Set());

  // Elimination metrics
  const eliminationStats = useMemo(() => {
    let totalCorrectElim = 0;
    let totalWrongElim = 0;
    let totalPossible = 0;
    let questionsWithRuleOut = 0;

    Object.keys(ruleOutSelections).forEach(key => {
      const i = parseInt(key);
      const score = getRuleOutScore(i);
      if (score) {
        questionsWithRuleOut++;
        totalCorrectElim += score.correctEliminations;
        totalWrongElim += score.wrongEliminations;
        totalPossible += score.total;
      }
    });

    return { totalCorrectElim, totalWrongElim, totalPossible, questionsWithRuleOut };
  }, [ruleOutSelections]);

  // DNA update
  useEffect(() => {
    if (!user || dnaUpdated) return;
    setDnaUpdated(true);

    const updateDNA = async () => {
      const overallAccuracy = total > 0 ? correct / total : 0;
      const stabilityScore = config.mode === 'recharge' ? Math.max(0, 100 - (totalChanges / total) * 50) : null;
      const accuracies = Object.values(categoryStats).map(s => s.correct / s.total);
      const confidenceGap = accuracies.length > 1 ? Math.max(...accuracies) - Math.min(...accuracies) : 0;

      const { data: existing } = await supabase.from('performance_profiles').select('*').eq('user_id', user.id).maybeSingle();

      if (existing) {
        const blendedAccuracy = (existing.clinical_accuracy || 0) * 0.6 + overallAccuracy * 100 * 0.4;
        const updateData: Record<string, any> = {
          clinical_accuracy: Math.round(blendedAccuracy * 10) / 10,
          confidence_gap: Math.round(confidenceGap * 100) / 100,
        };
        if (stabilityScore !== null) {
          const blendedStability = ((existing.stability_score || 0) * 0.6 + stabilityScore * 0.4);
          updateData.stability_score = Math.round(blendedStability * 10) / 10;
        }
        await supabase.from('performance_profiles').update(updateData).eq('user_id', user.id);
      } else {
        await supabase.from('performance_profiles').insert({
          user_id: user.id,
          clinical_accuracy: Math.round(overallAccuracy * 1000) / 10,
          stability_score: stabilityScore !== null ? Math.round(stabilityScore * 10) / 10 : 0,
          confidence_gap: Math.round(confidenceGap * 100) / 100,
        });
      }

      if (weaknesses.length > 0) {
        await supabase.from('profiles').update({ weak_areas: weaknesses }).eq('id', user.id);
      }
    };

    updateDNA();
  }, [user]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl py-6 space-y-6">
        {/* ── SECTION 1: Summary Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden">
            <div className={cn('h-2', accuracy >= 80 ? 'bg-success' : accuracy >= 60 ? 'bg-warning' : 'bg-destructive')} />
            <CardContent className="pt-6 pb-4 space-y-5">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold font-display">Drill Complete!</h1>
                <div className="text-5xl font-bold font-display text-primary">{correct}<span className="text-2xl text-muted-foreground">/{total}</span></div>
                <p className="text-lg text-muted-foreground">{accuracy}% accuracy</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Avg Time</p>
                  <p className="text-lg font-bold font-mono">{avgTime}s</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Changes</p>
                  <p className="text-lg font-bold font-mono">{totalChanges}</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className="text-sm font-semibold">{config.mode === 'recharge' ? 'Recharge' : 'No Change'}</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Time</p>
                  <p className="text-lg font-bold font-mono">{Math.floor(totalTime / 60)}m {totalTime % 60}s</p>
                </div>
              </div>

              {/* Insight */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">{generateInsight()}</p>
                </div>
              </div>

              {/* Category breakdown */}
              {Object.keys(categoryStats).length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By Topic</p>
                  {Object.entries(categoryStats)
                    .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
                    .map(([cat, stats]) => {
                      const pct = Math.round((stats.correct / stats.total) * 100);
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate text-xs">{cat}</span>
                            <span className={cn('font-mono text-xs font-semibold', pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive')}>
                              {stats.correct}/{stats.total} ({pct}%)
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Strengths / Weaknesses */}
              {(strengths.length > 0 || weaknesses.length > 0) && (
                <div className="flex flex-wrap gap-4">
                  {strengths.length > 0 && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <div className="flex flex-wrap gap-1">
                        {strengths.map(s => <Badge key={s} variant="outline" className="text-[10px] border-success/30 text-success">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {weaknesses.length > 0 && (
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <div className="flex flex-wrap gap-1">
                        {weaknesses.map(w => <Badge key={w} variant="outline" className="text-[10px] border-destructive/30 text-destructive">{w}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Elimination stats (only show if user has used rule-out) */}
              {eliminationStats.questionsWithRuleOut > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🧠 Rule-Out Intelligence</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-success">{eliminationStats.totalCorrectElim}</p>
                      <p className="text-[10px] text-muted-foreground">Correct Eliminations</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-destructive">{eliminationStats.totalWrongElim}</p>
                      <p className="text-[10px] text-muted-foreground">Wrong Eliminations</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-primary">
                        {eliminationStats.totalPossible > 0 ? Math.round((eliminationStats.totalCorrectElim / eliminationStats.totalPossible) * 100) : 0}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Elimination Accuracy</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>New Drill</Button>
          <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
        </div>

        {/* ── SECTION 2: Full Question Review ── */}
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">All Questions</h2>
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === q.correct_answer;
            const isExpanded = expandedQuestions.has(i);
            const isRuleOut = ruleOutMode[i];
            const eliminated = ruleOutSelections[i] || new Set<string>();
            const ruleOutScore = getRuleOutScore(i);
            const options = q.options as string[];
            const timeTaken = times[i] || 0;
            const changeCount = changes[i] || 0;

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
              >
                <Card className={cn('border-l-4 overflow-hidden', isCorrect ? 'border-l-success' : 'border-l-destructive')}>
                  {/* Question header - always visible */}
                  <button
                    onClick={() => toggleExpand(i)}
                    className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                        <Badge variant="outline" className="text-[10px]">{q.category}</Badge>
                        {changeCount > 0 && <Badge variant="secondary" className="text-[10px]">{changeCount} change{changeCount > 1 ? 's' : ''}</Badge>}
                        <span className="text-[10px] text-muted-foreground font-mono">{timeTaken}s</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{q.question_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your answer: <strong className={isCorrect ? 'text-success' : 'text-destructive'}>{userAnswer || '—'}</strong>
                        {!isCorrect && <> · Correct: <strong className="text-success">{q.correct_answer}</strong></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCorrect
                        ? <CheckCircle className="h-5 w-5 text-success" />
                        : <XCircle className="h-5 w-5 text-destructive" />}
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
                          {/* Rule-Out toggle */}
                          <div className="flex justify-end">
                            <Button
                              variant={isRuleOut ? 'default' : 'outline'}
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); toggleRuleOut(i); }}
                              className="gap-1.5 text-xs"
                            >
                              🧠 {isRuleOut ? 'Exit Rule-Out' : 'Rule-Out Mode'}
                            </Button>
                          </div>

                          {/* Options display */}
                          <div className="space-y-2">
                            {options.map((opt, oi) => {
                              const letter = String.fromCharCode(65 + oi);
                              const isUserAnswer = userAnswer === letter;
                              const isCorrectAnswer = q.correct_answer === letter;
                              const isEliminated = eliminated.has(letter);

                              return (
                                <div
                                  key={oi}
                                  className={cn(
                                    'rounded-lg border p-3 text-sm flex items-center gap-3 transition-all',
                                    isCorrectAnswer && 'border-success bg-success/5',
                                    isUserAnswer && !isCorrectAnswer && 'border-destructive bg-destructive/5',
                                    !isUserAnswer && !isCorrectAnswer && 'border-border',
                                    isRuleOut && isEliminated && 'opacity-40 line-through',
                                  )}
                                >
                                  {isRuleOut && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleEliminateOption(i, letter); }}
                                      className={cn(
                                        'shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center text-[10px] font-bold transition-colors',
                                        isEliminated ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-muted-foreground/30 hover:border-destructive/50'
                                      )}
                                    >
                                      {isEliminated ? '✕' : ''}
                                    </button>
                                  )}
                                  <span className={cn(
                                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0',
                                    isCorrectAnswer ? 'bg-success text-success-foreground' : isUserAnswer ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
                                  )}>
                                    {letter}
                                  </span>
                                  <span className="flex-1">{opt.replace(/^[A-E]\.\s*/, '')}</span>
                                  {isCorrectAnswer && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                                  {isUserAnswer && !isCorrectAnswer && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                                </div>
                              );
                            })}
                          </div>

                          {/* Rule-out score */}
                          {ruleOutScore && (
                            <div className="rounded-lg bg-muted p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold">Elimination Score: {ruleOutScore.correctEliminations}/{ruleOutScore.total}</p>
                                <Badge variant={ruleOutScore.wrongEliminations > 0 ? 'destructive' : 'default'} className="text-[10px]">
                                  {ruleOutScore.wrongEliminations > 0 ? 'Eliminated correct answer!' : 'Good elimination'}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {ruleOutScore.details.map(d => (
                                  <p key={d.letter} className="text-xs text-muted-foreground">
                                    {d.eliminated && d.shouldEliminate && <span className="text-success">✔ Eliminated {d.letter} correctly</span>}
                                    {d.eliminated && d.isCorrectAnswer && <span className="text-destructive">✘ Eliminated correct answer {d.letter}!</span>}
                                    {!d.eliminated && d.shouldEliminate && <span className="text-muted-foreground/60">— Did not eliminate {d.letter}</span>}
                                    {!d.eliminated && d.isCorrectAnswer && <span className="text-success/60">✔ Kept correct answer {d.letter}</span>}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          {q.explanation && (
                            <div className="rounded-lg border p-3 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explanation</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">{q.explanation}</p>
                            </div>
                          )}

                          {/* Diagnosis & Management */}
                          {(q.diagnosis_explanation || q.first_line_investigation || q.best_treatment) && (
                            <div className="rounded-lg border border-primary/20 p-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <Stethoscope className="h-4 w-4 text-primary" />
                                <p className="text-xs font-semibold">Diagnosis & Management</p>
                              </div>
                              {q.diagnosis_explanation && <p className="text-sm text-muted-foreground">{q.diagnosis_explanation}</p>}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {q.first_line_investigation && (
                                  <div className="rounded bg-muted p-2">
                                    <p className="text-[10px] text-muted-foreground">1st Line Ix</p>
                                    <p className="text-xs font-medium">{q.first_line_investigation}</p>
                                  </div>
                                )}
                                {q.gold_standard_investigation && (
                                  <div className="rounded bg-muted p-2">
                                    <p className="text-[10px] text-muted-foreground">Gold Standard</p>
                                    <p className="text-xs font-medium">{q.gold_standard_investigation}</p>
                                  </div>
                                )}
                                {q.best_treatment && (
                                  <div className="rounded bg-muted p-2">
                                    <p className="text-[10px] text-muted-foreground">Best Treatment</p>
                                    <p className="text-xs font-medium">{q.best_treatment}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Incorrect answer analysis */}
                          {q.incorrect_answer_explanations && Object.keys(q.incorrect_answer_explanations).length > 0 && (
                            <div className="rounded-lg border p-3 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-destructive/70">Why Other Options Are Wrong</p>
                              {Object.entries(q.incorrect_answer_explanations).map(([letter, exp]) => {
                                if (letter === q.correct_answer) return null;
                                const explanation = exp as any;
                                return (
                                  <div key={letter} className="text-xs space-y-0.5 pl-2 border-l-2 border-border">
                                    <p className="font-medium">Option {letter}</p>
                                    {explanation?.why_wrong && <p className="text-muted-foreground">Why wrong: {explanation.why_wrong}</p>}
                                    {explanation?.when_correct && <p className="text-muted-foreground">When correct: {explanation.when_correct}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Key takeaways */}
                          {q.key_takeaways && q.key_takeaways.length > 0 && (
                            <div className="rounded-lg border border-warning/20 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-warning mb-2">Key Takeaways</p>
                              <ul className="space-y-1">
                                {q.key_takeaways.map((point, pi) => (
                                  <li key={pi} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="flex gap-3 justify-center pb-8">
          <Button variant="outline" onClick={() => window.location.reload()}>Start New Drill</Button>
          <Button asChild><a href="/intelligence">View Intelligence</a></Button>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Main Practice Component ────────────────────────────────────

export default function Practice() {
  const gate = useFeatureGate();
  const [searchParams] = useSearchParams();
  const resumeSessionId = searchParams.get('resume');
  const [phase, setPhase] = useState<'setup' | 'drill' | 'results' | 'history'>(resumeSessionId ? 'drill' : 'setup');
  const [config, setConfig] = useState<SessionConfig | null>(
    resumeSessionId ? { mode: 'recharge', topics: [], subtopics: [], questionCount: 50 } : null
  );
  const [resultData, setResultData] = useState<{
    questions: Question[];
    answers: Record<number, string>;
    changes: Record<number, number>;
    times: Record<number, number>;
    ruledOut: Record<number, string[]>;
  } | null>(null);

  if (!gate.canAccessQBank) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold font-display">Practice Drills</h1>
            <p className="text-muted-foreground text-sm mt-1">Timed MCQ practice sessions</p>
          </div>
          <UpgradePrompt feature="MCQ Practice Drills" description="Upgrade to a paid plan to access unlimited practice drills with adaptive difficulty, answer-change tracking, and detailed performance analytics." variant="card" />
        </div>
      </AppLayout>
    );
  }

  if (phase === 'history') {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-display">MCQ History</h1>
              <p className="text-muted-foreground">Review all your past attempts</p>
            </div>
            <Button variant="outline" onClick={() => setPhase('setup')}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back to Practice
            </Button>
          </div>
          {gate.canAccessHistory ? (
            <MCQHistory />
          ) : (
            <UpgradePrompt feature="Question History" description="Upgrade to review your complete attempt history." variant="card" />
          )}
        </div>
      </AppLayout>
    );
  }

  if (phase === 'setup') {
    return (
      <SetupScreen
        onStart={(cfg) => {
          setConfig(cfg);
          setPhase('drill');
        }}
        onShowHistory={() => setPhase('history')}
      />
    );
  }

  if (phase === 'drill' && config) {
    return (
      <DrillSession
        config={config}
        resumeSessionId={resumeSessionId}
        onFinish={(questions, answers, changes, times, ruledOut) => {
          setResultData({ questions, answers, changes, times, ruledOut });
          setPhase('results');
        }}
      />
    );
  }

  if (phase === 'results' && resultData && config) {
    return (
      <ResultsScreen
        questions={resultData.questions}
        answers={resultData.answers}
        changes={resultData.changes}
        times={resultData.times}
        config={config}
        drillRuleOuts={resultData.ruledOut}
      />
    );
  }

  return null;
}
