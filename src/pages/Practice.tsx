import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Lock, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle, Zap, TrendingUp, TrendingDown, ChevronDown, Minus, Plus, Search, X } from 'lucide-react';
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

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
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
  questionCount: number;
}

// ─── Filter Data Structures (imported from shared) ──────────────
import { SYSTEMS, SUBJECTS, SYSTEM_SUBJECTS, SUBJECT_SYSTEMS, getAllPairs, type FilterMode } from '@/lib/filter-data';

// ─── Setup Screen ───────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (config: SessionConfig) => void }) {
  const gate = useFeatureGate();
  const [mode, setMode] = useState<'recharge' | 'no-change'>('recharge');
  const [filterMode, setFilterMode] = useState<FilterMode>('system');
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('questions').select('category');
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((d) => {
          counts[d.category] = (counts[d.category] || 0) + 1;
        });
        setCategoryCounts(counts);
        
        // Default: select all available pairs
        setSelectedPairs(getAllPairs());
      }
      setLoading(false);
    };
    fetchCategories();
  }, []);

  // Calculate question counts per system/subject
  const systemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    SYSTEMS.forEach(system => {
      counts[system] = Object.entries(categoryCounts)
        .filter(([cat]) => cat.toLowerCase().includes(system.toLowerCase()))
        .reduce((sum, [, count]) => sum + count, 0);
    });
    return counts;
  }, [categoryCounts]);

  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    SUBJECTS.forEach(subject => {
      counts[subject] = Object.entries(categoryCounts)
        .filter(([cat]) => cat.toLowerCase().includes(subject.toLowerCase()))
        .reduce((sum, [, count]) => sum + count, 0);
    });
    return counts;
  }, [categoryCounts]);

  const toggleExpand = (item: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const togglePair = (system: string, subject: string) => {
    const key = `${system}:${subject}`;
    setSelectedPairs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSystem = (system: string) => {
    const subjects = SYSTEM_SUBJECTS[system] || [];
    const allSelected = subjects.every(sub => selectedPairs.has(`${system}:${sub}`));
    
    setSelectedPairs(prev => {
      const next = new Set(prev);
      subjects.forEach(sub => {
        const key = `${system}:${sub}`;
        if (allSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const toggleSubject = (subject: string) => {
    const systems = SUBJECT_SYSTEMS[subject] || [];
    const allSelected = systems.every(sys => selectedPairs.has(`${sys}:${subject}`));
    
    setSelectedPairs(prev => {
      const next = new Set(prev);
      systems.forEach(sys => {
        const key = `${sys}:${subject}`;
        if (allSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPairs(getAllPairs());
  };

  const clearAll = () => {
    setSelectedPairs(new Set());
  };

  const getMatchingCategories = (): string[] => {
    if (selectedPairs.size === 0) return [];
    
    const selectedSystems = new Set<string>();
    const selectedSubjects = new Set<string>();
    
    selectedPairs.forEach(pair => {
      const [system, subject] = pair.split(':');
      selectedSystems.add(system);
      selectedSubjects.add(subject);
    });

    return Object.keys(categoryCounts).filter(cat => {
      const catLower = cat.toLowerCase();
      return Array.from(selectedSystems).some(sys => catLower.includes(sys.toLowerCase())) ||
             Array.from(selectedSubjects).some(sub => catLower.includes(sub.toLowerCase()));
    });
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
  const canStart = selectedPairs.size > 0;

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
        <div>
          <h1 className="text-3xl font-bold font-display">Practice Drills</h1>
          <p className="text-muted-foreground">Configure your session and start practising</p>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                  <Lock className="h-5 w-5" />
                </div>
                <span className="font-display font-semibold">No Change</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Once you select an answer, it locks immediately. No going back.
              </p>
            </button>
          </div>
        </div>

        {/* Question Count Selector */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Questions</h2>
          
          {/* Quick Presets */}
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
          
          {/* Stepper Input */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={decrementCount}
              disabled={questionCount <= 1}
            >
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
            <Button
              variant="outline"
              size="icon"
              onClick={incrementCount}
              disabled={questionCount >= 500}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Time Estimate */}
          <p className="text-sm text-muted-foreground">
            ≈ {questionCount} minutes
          </p>
        </div>

        {/* Topic Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic Filters</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            </div>
          </div>

          {/* Filter Mode Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter Mode:</span>
            <ToggleGroup
              type="single"
              value={filterMode}
              onValueChange={(v) => v && setFilterMode(v as FilterMode)}
              className="bg-muted rounded-lg p-1"
            >
              <ToggleGroupItem value="system" className="text-sm px-4">
                System View
              </ToggleGroupItem>
              <ToggleGroupItem value="subject" className="text-sm px-4">
                Subject View
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search systems or subjects..."
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

          {/* System View */}
          {filterMode === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SYSTEMS.filter((system) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                const subjects = SYSTEM_SUBJECTS[system] || [];
                return system.toLowerCase().includes(q) || subjects.some(s => s.toLowerCase().includes(q));
              }).map((system) => {
                const subjects = SYSTEM_SUBJECTS[system] || [];
                const selectedCount = subjects.filter(sub => selectedPairs.has(`${system}:${sub}`)).length;
                const allSelected = selectedCount === subjects.length && subjects.length > 0;
                const someSelected = selectedCount > 0;
                
                return (
                  <Collapsible
                    key={system}
                    open={expandedItems.has(system) || (!!searchQuery.trim() && (SYSTEM_SUBJECTS[system] || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase())))}
                    onOpenChange={() => toggleExpand(system)}
                  >
                    <div className={cn(
                      'rounded-lg border transition-colors',
                      someSelected ? 'border-primary/40 bg-primary/5' : 'border-border'
                    )}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleSystem(system)}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(someSelected && !allSelected && "data-[state=unchecked]:bg-primary/30")}
                          />
                          <span className="font-medium text-sm">{system}</span>
                          <Badge variant="secondary" className="text-xs">
                            {systemCounts[system] || 0}
                          </Badge>
                        </div>
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          expandedItems.has(system) && "rotate-180"
                        )} />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-border/50 px-4 py-3 space-y-2">
                          {subjects.map((subject) => (
                            <label
                              key={`${system}:${subject}`}
                              className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Checkbox
                                checked={selectedPairs.has(`${system}:${subject}`)}
                                onCheckedChange={() => togglePair(system, subject)}
                              />
                              {subject}
                            </label>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* Subject View */}
          {filterMode === 'subject' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SUBJECTS.filter((subject) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                const systems = SUBJECT_SYSTEMS[subject] || [];
                return subject.toLowerCase().includes(q) || systems.some(s => s.toLowerCase().includes(q));
              }).map((subject) => {
                const systems = SUBJECT_SYSTEMS[subject] || [];
                const selectedCount = systems.filter(sys => selectedPairs.has(`${sys}:${subject}`)).length;
                const allSelected = selectedCount === systems.length && systems.length > 0;
                const someSelected = selectedCount > 0;
                
                return (
                  <Collapsible
                    key={subject}
                    open={expandedItems.has(subject) || (!!searchQuery.trim() && (SUBJECT_SYSTEMS[subject] || []).some(s => s.toLowerCase().includes(searchQuery.toLowerCase())))}
                    onOpenChange={() => toggleExpand(subject)}
                  >
                    <div className={cn(
                      'rounded-lg border transition-colors',
                      someSelected ? 'border-primary/40 bg-primary/5' : 'border-border'
                    )}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleSubject(subject)}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(someSelected && !allSelected && "data-[state=unchecked]:bg-primary/30")}
                          />
                          <span className="font-medium text-sm">{subject}</span>
                          <Badge variant="secondary" className="text-xs">
                            {subjectCounts[subject] || 0}
                          </Badge>
                        </div>
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          expandedItems.has(subject) && "rotate-180"
                        )} />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-border/50 px-4 py-3 space-y-2">
                          {systems.map((system) => (
                            <label
                              key={`${system}:${subject}`}
                              className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Checkbox
                                checked={selectedPairs.has(`${system}:${subject}`)}
                                onCheckedChange={() => togglePair(system, subject)}
                              />
                              {system}
                            </label>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {selectedPairs.size === 0 && (
            <p className="text-sm text-destructive">Select at least one topic combination</p>
          )}
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => onStart({ 
            mode, 
            topics: getMatchingCategories().length > 0 ? getMatchingCategories() : Object.keys(categoryCounts), 
            questionCount 
          })}
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
  onFinish: (questions: Question[], answers: Record<number, string>, changes: Record<number, number>, times: Record<number, number>) => void;
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
  const [timeRemaining, setTimeRemaining] = useState(timeSeconds);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
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
              .select('id, question_text, options, correct_answer, explanation, category, diagnosis_explanation, first_line_investigation, gold_standard_investigation, best_treatment, differential_diagnoses, incorrect_answer_explanations, key_takeaways')
              .in('id', questionIds);

            if (qs && qs.length > 0) {
              // Preserve original order
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

              // Mark restored
              await supabase.from('active_sessions').update({ restored: true } as any).eq('session_id', resumeSessionId);

              toast({ title: 'Session Restored', description: 'Your previous session has been restored successfully.' });
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error('Resume failed', e);
        }
      }

      // Normal fetch
      const { data } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_answer, explanation, category, diagnosis_explanation, first_line_investigation, gold_standard_investigation, best_treatment, differential_diagnoses, incorrect_answer_explanations, key_takeaways')
        .in('category', config.topics)
        .limit(200);
      if (data) {
        const shuffled = data.sort(() => Math.random() - 0.5).slice(0, config.questionCount);
        setQuestions(shuffled as Question[]);
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

    // Auto-save (debounced)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      saveSession(questions, currentIndex, newAnswers, newChanges, newSequences, questionTimes, timeToFirstClick, pauseEvents, timeRemaining);
    }, 500);
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

    onFinish(questions, selectedAnswers, answerChanges, questionTimes);
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
                  return (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(letter)}
                      disabled={isLocked && !isSelected}
                      className={cn(
                        'w-full rounded-lg border p-4 text-left text-sm transition-all',
                        isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/30',
                        isLocked && !isSelected && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <span className={cn('mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {letter}
                      </span>
                      {opt.replace(/^[A-E]\.\s*/, '')}
                      {isLocked && isSelected && <Lock className="inline h-3 w-3 ml-2 text-primary" />}
                    </button>
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

// ─── Results Screen ─────────────────────────────────────────────

function ResultsScreen({
  questions,
  answers,
  changes,
  config,
}: {
  questions: Question[];
  answers: Record<number, string>;
  changes: Record<number, number>;
  config: SessionConfig;
}) {
  const { user } = useAuth();
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [dnaUpdated, setDnaUpdated] = useState(false);

  // Compute per-category stats
  const categoryStats: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q, i) => {
    if (!categoryStats[q.category]) categoryStats[q.category] = { correct: 0, total: 0 };
    categoryStats[q.category].total++;
    if (answers[i] === q.correct_answer) categoryStats[q.category].correct++;
  });

  const correct = questions.filter((q, i) => answers[i] === q.correct_answer).length;
  const total = questions.length;
  const overallAccuracy = total > 0 ? correct / total : 0;

  const strengths = Object.entries(categoryStats).filter(([, s]) => s.total >= 1 && s.correct / s.total >= 0.8).map(([c]) => c);
  const weaknesses = Object.entries(categoryStats).filter(([, s]) => s.total >= 1 && s.correct / s.total < 0.6).map(([c]) => c);

  // Update Performance DNA
  useEffect(() => {
    if (!user || dnaUpdated) return;
    setDnaUpdated(true);

    const updateDNA = async () => {
      // Stability: ratio of questions with 0 changes (only meaningful in recharge mode)
      const totalChanges = Object.values(changes).reduce((a, b) => a + b, 0);
      const stabilityScore = config.mode === 'recharge' ? Math.max(0, 100 - (totalChanges / total) * 50) : null;

      // Confidence gap: difference between best and worst category accuracy
      const accuracies = Object.values(categoryStats).map((s) => s.correct / s.total);
      const confidenceGap = accuracies.length > 1 ? Math.max(...accuracies) - Math.min(...accuracies) : 0;

      // Upsert performance_profiles
      const { data: existing } = await supabase
        .from('performance_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

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

      // Update weak_areas on profile
      if (weaknesses.length > 0) {
        await supabase.from('profiles').update({ weak_areas: weaknesses }).eq('id', user.id);
      }
    };

    updateDNA();
  }, [user]);

  if (reviewIndex !== null) {
    const q = questions[reviewIndex];
    return (
      <AppLayout>
        <AnimatePresence mode="wait">
          <QuestionExplanation
            key={reviewIndex}
            question={q}
            userAnswer={answers[reviewIndex]}
            questionIndex={reviewIndex}
            onBack={() => setReviewIndex(null)}
          />
        </AnimatePresence>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl py-12 space-y-8">
        {/* Score */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Drill Complete!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-5xl font-bold font-display text-primary">{correct}/{total}</div>
            <p className="text-muted-foreground">{Math.round(overallAccuracy * 100)}% accuracy</p>
            <Badge variant="outline">
              {config.mode === 'recharge' ? <><RefreshCw className="h-3 w-3 mr-1" />Recharge Mode</> : <><Lock className="h-3 w-3 mr-1" />No Change Mode</>}
            </Badge>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Performance by Topic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(categoryStats)
              .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
              .map(([cat, stats]) => {
                const pct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{cat}</span>
                      <span className={cn('font-mono text-xs font-semibold', pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive')}>
                        {stats.correct}/{stats.total} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* Strengths / Weaknesses */}
        {(strengths.length > 0 || weaknesses.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {strengths.length > 0 && (
              <Card className="border-l-4 border-l-success">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <CardTitle className="text-sm font-display">Strengths</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {strengths.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs border-success/30 text-success">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {weaknesses.length > 0 && (
              <Card className="border-l-4 border-l-destructive">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    <CardTitle className="text-sm font-display">Needs Work</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {weaknesses.map((w) => (
                      <Badge key={w} variant="outline" className="text-xs border-destructive/30 text-destructive">{w}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>More Drills</Button>
          <Button asChild><a href="/profile">View Profile</a></Button>
        </div>

        {/* Review Questions */}
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">Review Questions</h2>
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const isCorrect = userAnswer === q.correct_answer;
            return (
              <Card
                key={q.id}
                className={cn('border-l-4 cursor-pointer hover:shadow-md transition-shadow', isCorrect ? 'border-l-success' : 'border-l-destructive')}
                onClick={() => setReviewIndex(i)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1 line-clamp-2">{q.question_text}</p>
                      <p className="text-xs text-muted-foreground">
                        Your answer: <strong>{userAnswer || 'Not answered'}</strong> · Correct: <strong>{q.correct_answer}</strong>
                      </p>
                    </div>
                    <Badge className={cn('shrink-0', isCorrect ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
                      {isCorrect ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      {isCorrect ? 'Correct' : 'Wrong'}
                    </Badge>
                  </div>
                  <p className="text-xs text-primary mt-2 font-medium">Click to read full explanation →</p>
                </CardContent>
              </Card>
            );
          })}
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
  const [phase, setPhase] = useState<'setup' | 'drill' | 'results'>(resumeSessionId ? 'drill' : 'setup');
  const [config, setConfig] = useState<SessionConfig | null>(
    resumeSessionId ? { mode: 'recharge', topics: [], questionCount: 50 } : null
  );
  const [resultData, setResultData] = useState<{
    questions: Question[];
    answers: Record<number, string>;
    changes: Record<number, number>;
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

  if (phase === 'setup') {
    return (
      <SetupScreen
        onStart={(cfg) => {
          setConfig(cfg);
          setPhase('drill');
        }}
      />
    );
  }

  if (phase === 'drill' && config) {
    return (
      <DrillSession
        config={config}
        resumeSessionId={resumeSessionId}
        onFinish={(questions, answers, changes) => {
          setResultData({ questions, answers, changes });
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
        config={config}
      />
    );
  }

  return null;
}
