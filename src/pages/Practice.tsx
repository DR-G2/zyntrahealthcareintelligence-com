import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock, Lock, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle, Zap, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Minus, Plus, Search, X, BookOpen, Target, Stethoscope, Shield } from 'lucide-react';
import { MCQHistory } from '@/components/history/MCQHistory';
import { MCQReviewQueue } from '@/components/history/MCQReviewQueue';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { RoomHeader } from '@/components/RoomHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { PracticeSkeleton } from '@/components/skeletons/PageSkeleton';
import { QuestionExplanation } from '@/components/practice/QuestionExplanation';
import { parseExplanation } from '@/lib/explanation-layout';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { normalizeTopicLabel } from '@/lib/practice-topic-mapping';
import { emitBehaviorEvent } from '@/lib/telemetry';
import { syncPieEngine } from '@/lib/pie/pie-engine-client';
import { PieDiagnosticError, describePieFailure, pieSyncFailure, reportPieFailure, requireV2SessionId } from '@/lib/pie/pie-diagnostics';
import { PieDrillSession, type NudgeOutcome } from '@/components/practice/PieDrillSession';
import { PracticeModeSelector, type PracticePrimaryMode } from '@/components/practice/PracticeModeSelector';
import { ADMIN_EMAILS } from '@/lib/admin-emails';
import { fetchLegacyShapedHistory } from '@/lib/pie/pie-history-client';
import { getSupabaseV2 } from '@/integrations/supabase/v2-client';
import { ensureV2Session } from '@/lib/migration/v2-practice-session';
import { classifyPracticeResumeConfig } from '@/lib/practice-mode-availability';

interface Question {
  id: string;
  zyntra_id?: string | null;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  difficulty?: string;
  subtopic?: string | null;
  diagnosis_explanation?: string | null;
  first_line_investigation?: string | null;
  gold_standard_investigation?: string | null;
  best_treatment?: string | null;
  differential_diagnoses?: any[] | null;
  incorrect_answer_explanations?: Record<string, any> | null;
  key_takeaways?: string[] | null;
}

type QuestionStatusFilter = 'all' | 'attempted' | 'not-attempted' | 'correct' | 'incorrect';

interface SessionConfig {
  mode: 'recharge' | 'no-change' | 'full-mock';
  topics: string[];
  subtopics: string[];
  questionCount: number;
  statusFilter?: QuestionStatusFilter;
  adaptivePoolIds?: string[];
  v2SessionId?: string;
  v2PracticeEnabled?: boolean;
  primaryMode?: PracticePrimaryMode;
}

// ─── Filter types ───────────────────────────────────────────────
type FilterMode = 'subject';

interface DBSubject {
  id: string;
  name: string;
  sort_order: number | null;
}

interface DBSubtopic {
  id: string;
  name: string;
  subject_id: string;
  sort_order: number | null;
}

interface QuestionTopicMeta {
  id: string;
  zyntra_id: string | null;
  subject_id: string | null;
  subtopic_id: string | null;
  difficulty_tier: string | null;
}

const QUESTION_META_PAGE_SIZE = 1000;
/** Server and session client both cap a session at 50 questions. */
const MAX_SESSION_QUESTIONS = 50;

function createSelectedSubtopicKey(subjectName: string, subtopicName: string): string {
  return `${normalizeTopicLabel(subjectName)}::${normalizeTopicLabel(subtopicName)}`;
}

async function fetchAllQuestionTopicMeta(): Promise<QuestionTopicMeta[]> {
  await ensureV2Session();
  const v2 = getSupabaseV2();
  const rows: QuestionTopicMeta[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await (v2 as any).rpc('get_practice_question_metadata', {
      p_limit: QUESTION_META_PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw error;
    const page = (data || []) as QuestionTopicMeta[];
    rows.push(...page);
    if (page.length < QUESTION_META_PAGE_SIZE) break;
    offset += page.length;
  }
  return rows;
}

// ─── Setup Screen ───────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (config: SessionConfig) => void }) {
  const gate = useFeatureGate();
  const [searchParams] = useSearchParams();
  const focusSubtopic = searchParams.get('focus');
  const focusSubject = searchParams.get('subject');
  const focusSubjectId = searchParams.get('subjectId');
  const requestedQuestionCount = Number(searchParams.get('count'));
  const initialQuestionCount = Number.isFinite(requestedQuestionCount) && requestedQuestionCount > 0
    ? Math.min(MAX_SESSION_QUESTIONS, Math.max(1, Math.floor(requestedQuestionCount)))
    : 20;
  const autoStart = searchParams.get('autostart') === '1';
  const [mode, setMode] = useState<'recharge' | 'no-change' | 'full-mock'>('recharge');
  const [primary, setPrimary] = useState<PracticePrimaryMode>('drill');
  const [statusFilter, setStatusFilter] = useState<QuestionStatusFilter>('all');
  const [statusCounts, setStatusCounts] = useState<Record<QuestionStatusFilter, number>>({
    all: 0, attempted: 0, 'not-attempted': 0, correct: 0, incorrect: 0,
  });
  // Subtopic-level selection is source of truth
  // Key: "normalized-subject::normalized-subtopic"
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());
  // Track subjects with no subtopics that are selected
  const [selectedBareSubjects, setSelectedBareSubjects] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(initialQuestionCount);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [subtopicCounts, setSubtopicCounts] = useState<Record<string, number>>({});
  const [dbSubjects, setDbSubjects] = useState<DBSubject[]>([]);
  const [dbSubtopics, setDbSubtopics] = useState<DBSubtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { user } = useAuth();
  const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email));

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      setLoadError(null);
      setHistoryError(false);
      try {
        await ensureV2Session();
        const v2 = getSupabaseV2();
        const [subjectsRes, subtopicsRes, questionMeta] = await Promise.all([
          v2.from('subjects').select('id, name, sort_order').order('sort_order'),
          v2.from('subtopics').select('id, name, subject_id, sort_order').order('sort_order'),
          fetchAllQuestionTopicMeta(),
        ]);

        if (subjectsRes.error) throw subjectsRes.error;
        if (subtopicsRes.error) throw subtopicsRes.error;
        if (cancelled) return;

        const subjects = (subjectsRes.data || []) as DBSubject[];
        const subtopics = (subtopicsRes.data || []) as DBSubtopic[];
        const catCounts: Record<string, number> = {};
        const stCounts: Record<string, number> = {};
        const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
        const subtopicById = new Map(subtopics.map((subtopic) => [subtopic.id, subtopic]));
        questionMeta.forEach((question) => {
          const subject = question.subject_id ? subjectById.get(question.subject_id) : undefined;
          const subtopic = question.subtopic_id ? subtopicById.get(question.subtopic_id) : undefined;
          if (subject) catCounts[subject.name] = (catCounts[subject.name] || 0) + 1;
          if (subtopic) stCounts[subtopic.id] = (stCounts[subtopic.id] || 0) + 1;
        });

        setDbSubjects(subjects);
        setDbSubtopics(subtopics);
        setCategoryCounts(catCounts);
        setSubtopicCounts(stCounts);

        // Build status counts from the user's latest attempt for each question.
        // This is intentionally independent of the nested questions relationship.
        if (user && questionMeta.length) {
          const questionIds = questionMeta.map(q => q.id);
          // P5: status counts come from the learner's PIE history (no legacy user_attempts read).
          const idSet = new Set(questionIds);
          const attempts: Array<{ question_id: string; is_correct: boolean; created_at: string }> =
            (await fetchLegacyShapedHistory(5000).catch(() => { if (!cancelled) setHistoryError(true); return []; }))
              .filter((a) => idSet.has(a.question_id))
              .map((a) => ({ question_id: a.question_id, is_correct: a.is_correct, created_at: a.created_at }));

          const latest = new Map<string, { is_correct: boolean; created_at: string }>();
          attempts
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .forEach(a => {
              if (!latest.has(a.question_id)) latest.set(a.question_id, a);
            });

          const counts: Record<QuestionStatusFilter, number> = {
            all: questionMeta.length,
            attempted: latest.size,
            'not-attempted': questionMeta.length - latest.size,
            correct: 0,
            incorrect: 0,
          };
          latest.forEach(a => {
            if (a.is_correct) counts.correct += 1;
            else counts.incorrect += 1;
          });
          setStatusCounts(counts);
        } else {
          setStatusCounts({
            all: questionMeta.length,
            attempted: 0,
            'not-attempted': questionMeta.length,
            correct: 0,
            incorrect: 0,
          });
        }

        // Default: select all subtopics + all bare subjects
        const allSt = new Set<string>();
        const bareSubjects = new Set<string>();
        subjects.forEach(s => {
          const sts = subtopics.filter(st => st.subject_id === s.id);
          if (sts.length > 0) {
            sts.forEach(st => allSt.add(createSelectedSubtopicKey(s.name, st.name)));
          } else {
            bareSubjects.add(s.name);
          }
        });
        if (focusSubjectId) {
          const targetSubject = subjects.find(s => s.id === focusSubjectId);
          if (targetSubject) {
            const targetSubtopics = subtopics.filter(st => st.subject_id === targetSubject.id);
            setSelectedSubtopics(new Set(targetSubtopics.map(st => createSelectedSubtopicKey(targetSubject.name, st.name))));
            setSelectedBareSubjects(new Set(targetSubtopics.length ? [] : [targetSubject.name]));
            setExpandedItems(new Set([targetSubject.id]));
            setSearchQuery('');
            if (autoStart) {
              onStart({
                mode: 'recharge',
                topics: [targetSubject.name],
                subtopics: targetSubtopics.map(subtopic => subtopic.name),
                questionCount: initialQuestionCount,
                statusFilter: 'all',
              });
            }
            return;
          }
        }

        // A subject-only deep link (used by dashboard and Study Plan priorities)
        // must narrow the drill instead of silently falling back to all subjects.
        if (focusSubject && !focusSubtopic) {
          const targetSubject = subjects.find(s => s.name.trim().toLowerCase() === focusSubject.trim().toLowerCase());
          if (targetSubject) {
            const targetSubtopics = subtopics.filter(st => st.subject_id === targetSubject.id);
            setSelectedSubtopics(new Set(targetSubtopics.map(st => createSelectedSubtopicKey(targetSubject.name, st.name))));
            setSelectedBareSubjects(new Set(targetSubtopics.length ? [] : [targetSubject.name]));
            setExpandedItems(new Set([targetSubject.id]));
            setSearchQuery('');
            if (autoStart) {
              onStart({
                mode: 'recharge',
                topics: [targetSubject.name],
                subtopics: targetSubtopics.map(subtopic => subtopic.name),
                questionCount: initialQuestionCount,
                statusFilter: 'all',
              });
            }
            return;
          }
        }

        if (focusSubtopic) {
          const matchingSubject = subjects.find(s => s.name.toLowerCase() === (focusSubject || '').toLowerCase());
          const matchingSubtopic = subtopics.find(st =>
            st.name.toLowerCase() === focusSubtopic.toLowerCase() &&
            (!matchingSubject || st.subject_id === matchingSubject.id)
          );
          if (matchingSubtopic) {
            const subject = subjects.find(s => s.id === matchingSubtopic.subject_id);
            setSelectedSubtopics(new Set(subject ? [createSelectedSubtopicKey(subject.name, matchingSubtopic.name)] : []));
            setSelectedBareSubjects(new Set());
            setExpandedItems(new Set(subject ? [subject.id] : []));
            setSearchQuery(focusSubtopic);
            if (autoStart) {
              onStart({
                mode: 'recharge',
                topics: subject ? [subject.name] : [],
                subtopics: [matchingSubtopic.name],
                questionCount: initialQuestionCount,
                statusFilter: 'all',
              });
            }
            return;
          }
        }

        setSelectedSubtopics(allSt);
        setSelectedBareSubjects(bareSubjects);
        if (autoStart) {
          onStart({
            mode: 'recharge',
            topics: subjects.map(subject => subject.name),
            subtopics: subtopics.map(subtopic => subtopic.name),
            questionCount: initialQuestionCount,
            statusFilter: 'all',
          });
        }
      } catch (error: any) {
        console.error('Failed to load practice filters', error);
        if (!cancelled) setLoadError(error?.message || 'Practice topics could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Build subject → subtopics map
  const subjectSubtopicsMap = useMemo(() => {
    const map: Record<string, DBSubtopic[]> = {};
    dbSubjects.forEach(s => {
      map[s.id] = dbSubtopics
        .filter(st => st.subject_id === s.id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
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

  // Compute subject check state from subtopics
  const getSubjectState = (subjectId: string, subjectName: string): 'all' | 'some' | 'none' => {
    const subtopics = subjectSubtopicsMap[subjectId] || [];
    if (subtopics.length === 0) {
      return selectedBareSubjects.has(subjectName) ? 'all' : 'none';
    }
    const selectedCount = subtopics.filter((st) => selectedSubtopics.has(createSelectedSubtopicKey(subjectName, st.name))).length;
    if (selectedCount === subtopics.length) return 'all';
    if (selectedCount > 0) return 'some';
    return 'none';
  };

  const toggleSubject = (subjectName: string, subjectId: string) => {
    const subtopics = subjectSubtopicsMap[subjectId] || [];
    if (subtopics.length === 0) {
      // Bare subject toggle
      setSelectedBareSubjects(prev => {
        const next = new Set(prev);
        if (next.has(subjectName)) next.delete(subjectName);
        else next.add(subjectName);
        return next;
      });
      return;
    }
    const state = getSubjectState(subjectId, subjectName);
    setSelectedSubtopics(prev => {
      const next = new Set(prev);
      if (state === 'all') {
        // Deselect all subtopics
        subtopics.forEach((st) => next.delete(createSelectedSubtopicKey(subjectName, st.name)));
      } else {
        // Select all subtopics
        subtopics.forEach((st) => next.add(createSelectedSubtopicKey(subjectName, st.name)));
      }
      return next;
    });
  };

  const toggleSubtopic = (subjectName: string, subtopicName: string) => {
    const key = createSelectedSubtopicKey(subjectName, subtopicName);
    setSelectedSubtopics(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Derive selected subject names for the drill config
  const getSelectedSubjectNames = (): string[] => {
    const names: string[] = [];
    dbSubjects.forEach(s => {
      const state = getSubjectState(s.id, s.name);
      if (state !== 'none') names.push(s.name);
    });
    return names;
  };

  const selectAll = () => {
    setSelectedSubtopics(new Set(dbSubtopics.map((st) => {
      const subject = dbSubjects.find((s) => s.id === st.subject_id);
      return subject ? createSelectedSubtopicKey(subject.name, st.name) : null;
    }).filter((value): value is string => Boolean(value))));
    setSelectedBareSubjects(new Set(dbSubjects.filter(s => (subjectSubtopicsMap[s.id] || []).length === 0).map(s => s.name)));
  };

  const clearAll = () => {
    setSelectedSubtopics(new Set());
    setSelectedBareSubjects(new Set());
  };

  const handleQuestionCountChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1) {
      setQuestionCount(Math.min(MAX_SESSION_QUESTIONS, num));
    } else if (value === '') {
      setQuestionCount(1);
    }
  };

  const incrementCount = () => setQuestionCount(prev => Math.min(MAX_SESSION_QUESTIONS, prev + 1));
  const decrementCount = () => setQuestionCount(prev => Math.max(1, prev - 1));

  const quickPresets = [10, 20, 30, 40, 50];
  // Topics are browse-only (the server selects across all topics), so they never block Start.
  const canStart = true;

  if (loading) {
    return (
      <AppLayout>
        
        <PracticeSkeleton />
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout>
        <Card className="max-w-lg mx-auto mt-10" role="alert">
          <CardHeader>
            <CardTitle>Practice topics couldn't load</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw className="w-4 h-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
        
      <div className="mx-auto max-w-6xl space-y-6">
        <RoomHeader kind="practice" compact className="mb-1" />
        {!gate.canUseMCQ && (
          <UpgradePrompt feature="Daily MCQ Limit Reached" description={`You've used ${gate.mcqUsedToday}/${gate.mcqDailyLimit} free MCQs today. Upgrade for unlimited practice.`} variant="banner" />
        )}

        {focusSubtopic && (
          <div className="rounded-2xl border border-border/60 bg-card/50 px-4 py-3" role="status">
            <p className="text-xs font-medium text-primary">Focus link</p>
            <p className="mt-1 text-xs text-muted-foreground">You opened Practice for <span className="font-medium text-foreground">{focusSubtopic}</span>{focusSubject ? ` in ${focusSubject}` : ''}. Drills currently choose questions across all topics, so this focus is shown for browsing only.</p>
          </div>
        )}

        <section aria-labelledby="practice-mode-heading" className="space-y-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.2em] text-primary">Your clinical training workspace</p>
            <h2 id="practice-mode-heading" className="mt-2 font-display text-xl font-semibold">Start with Normal MCQ</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Work through eligible AMC-style questions, record confidence, and review your saved results.</p>
          </div>
          <PracticeModeSelector value={primary} onChange={() => {
            // The selector only exposes Normal MCQ as launchable. Upcoming modes
            // remain visible as unavailable presentation, never a session choice.
            setPrimary('drill');
            if (mode === 'full-mock') setMode('recharge');
          }} />
        </section>

        {primary === 'drill' && (
          <section aria-label="MCQ Drill settings" className="training-band space-y-6">
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Answer behaviour</h3>
              <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'recharge' | 'no-change')} aria-label="Answer behaviour" className="grid gap-3 sm:grid-cols-2">
                {([
                  ['recharge', RefreshCw, 'With option change', 'Changes are recorded before you move on.'],
                  ['no-change', Lock, 'No option change', 'First selection locks on this device.'],
                ] as const).map(([value, Icon, title, desc]) => (
                  <label key={value} className={cn('flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-4', mode === value ? 'border-primary/60 bg-accent' : 'border-border/60 bg-secondary')}>
                    <RadioGroupItem value={value} aria-label={title} className="mt-1 shrink-0" />
                    <span className="min-w-0"><span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{desc}</span></span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Question load</h3>
              <div className="flex flex-wrap items-center gap-2">
                {quickPresets.map((preset) => (
                  <Button key={preset} variant={questionCount === preset ? 'default' : 'outline'} size="sm" onClick={() => setQuestionCount(preset)} className="min-h-10 min-w-12">{preset}</Button>
                ))}
                <div className="flex items-center gap-2 sm:ml-3">
                  <Button variant="outline" size="icon" aria-label="One fewer question" onClick={decrementCount} disabled={questionCount <= 1}><Minus className="h-4 w-4" /></Button>
                  <Input type="number" aria-label="Number of questions" min={1} max={MAX_SESSION_QUESTIONS} value={questionCount} onChange={(e) => handleQuestionCountChange(e.target.value)} className="w-20 text-center font-mono text-lg" />
                  <Button variant="outline" size="icon" aria-label="One more question" onClick={incrementCount} disabled={questionCount >= MAX_SESSION_QUESTIONS}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Up to {MAX_SESSION_QUESTIONS} questions · {questionCount}-minute browser timer. Questions are selected by the existing training engine.</p>
            </div>
          </section>
        )}

        {primary === 'nudge' && (
          <section aria-label="Nudge" className="training-band pb-5">
            <h3 className="font-display text-lg font-semibold">Nudge is not available yet</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Nudge will pick the one learning objective your answers show you need most, then give you questions mapped to it. That selection isn't switched on yet, so there's nothing to start here. Your current next step is shown in Performance Intelligence.</p>
            <Button asChild variant="outline" className="mt-4"><Link to="/intelligence">See your next step <ChevronRight className="h-4 w-4" /></Link></Button>
          </section>
        )}

        {primary === 'mock' && (
          <section aria-label="Full Mock Exam rules" className="training-band pb-5">
            <h3 className="font-display text-lg font-semibold">Exam conditions</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><span className="font-medium text-foreground">{MAX_SESSION_QUESTIONS} questions</span> — the current session limit. The full 150-question exam isn't available yet.</li>
              <li><span className="font-medium text-foreground">210-minute timer</span>; the session ends when time runs out.</li>
              <li>Answers lock on selection on this device, and you can't go back.</li>
              <li>Questions are chosen adaptively, as in the drill; no exam blueprint or exam-style score is applied.</li>
            </ul>
          </section>
        )}

        {primary === 'drill' && (<details className="training-band group">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold">Browse question coverage <ChevronDown className="h-4 w-4 text-muted-foreground" /></summary>
          <div className="mt-4 space-y-6">
        {/* Question Status Filter */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Target className="h-4 w-4" /></div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Question status <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">· browse only</span></h2>
              <p className="mt-1 text-xs text-muted-foreground">Counts from your own answers. This view does not limit the drill.</p>
              {historyError && (
                <p className="mt-1 text-xs text-destructive" role="status">Your answer history couldn't load, so Attempted, Correct and Incorrect counts aren't shown accurately.</p>
              )}
            </div>
          </div>
          <ToggleGroup
            type="single"
            value={statusFilter}
            onValueChange={(value) => value && setStatusFilter(value as QuestionStatusFilter)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            {([
              ['all', 'All'],
              ['attempted', 'Attempted'],
              ['not-attempted', 'Not Attempted'],
              ['correct', 'Correct'],
              ['incorrect', 'Incorrect'],
            ] as const).map(([value, label]) => (
              <ToggleGroupItem
                key={value}
                value={value}
                variant="outline"
                aria-label={label}
                className={cn(
                  "h-auto min-h-11 justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-all",
                  statusFilter === value
                    ? "border-primary bg-accent text-primary hover:bg-accent hover:text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                )}
              >
                <span className="font-medium">{label}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-semibold",
                    statusFilter === value
                      ? "border-primary/40 bg-secondary text-primary"
                      : "border-border bg-muted/50 text-muted-foreground"
                  )}
                >
                  {historyError && value !== 'all' ? '—' : statusCounts[value]}
                </Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Topic Filters — Subject → Subtopics */}
        <div className="training-band space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><BookOpen className="h-4 w-4" /></div>
              <div><h2 className="text-sm font-semibold text-foreground">Topics <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground">· browse only</span></h2><p className="mt-1 text-xs text-muted-foreground">Question counts by subject and subtopic. Selections here do not limit the drill.</p></div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>Clear All</Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search subjects or subtopics" placeholder="Search subjects or subtopics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" aria-label="Clear topic search" onClick={() => setSearchQuery('')} className="absolute right-0 top-1/2 -translate-y-1/2"><X className="h-4 w-4" /></Button>
            )}
          </div>

          {/* Subject list with subtopics */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {dbSubjects
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .filter((subject) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                const subtopics = subjectSubtopicsMap[subject.id] || [];
                return subject.name.toLowerCase().includes(q) || subtopics.some(st => st.name.toLowerCase().includes(q));
              })
              .map((subject) => {
                const subtopics = subjectSubtopicsMap[subject.id] || [];
                const subjectState = getSubjectState(subject.id, subject.name);
                const isSelected = subjectState !== 'none';
                const isIndeterminate = subjectState === 'some';
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
                      <div className="flex items-center gap-3 px-4">
                        <Checkbox aria-label={`Select ${subject.name}`} checked={isIndeterminate ? 'indeterminate' : isSelected} onCheckedChange={() => toggleSubject(subject.name, subject.id)} />
                        <CollapsibleTrigger className="flex min-h-12 min-w-0 flex-1 items-center justify-between py-3 text-left">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{subject.name}</span>
                          {subjectCounts[subject.name] > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {subjectCounts[subject.name]}
                            </Badge>
                          )}
                        </div>
                        {subtopics.length > 0 && (
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            expandedItems.has(subject.id) && "rotate-180"
                          )} />
                        )}
                      </CollapsibleTrigger>
                      </div>
                      {subtopics.length > 0 && (
                        <CollapsibleContent>
                          <div className="border-t border-border/50 px-4 py-3 space-y-2">
                            {subtopics.map((st) => (
                              <label
                                key={st.id}
                                onClick={(e) => e.stopPropagation()}
                                className="flex min-h-11 items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Checkbox
                                  aria-label={`Select ${st.name}`} checked={selectedSubtopics.has(createSelectedSubtopicKey(subject.name, st.name))}
                                  onCheckedChange={() => toggleSubtopic(subject.name, st.name)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span>{st.name}</span>
                                {subtopicCounts[st.id] ? (
                                  <Badge variant="outline" className="text-xs ml-auto">
                                    {subtopicCounts[st.id]}
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

        </div>
        </div></details>)}

        {/* Start Button */}
        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => {
            onStart({
              mode,
              topics: getSelectedSubjectNames(),
              subtopics: Array.from(selectedSubtopics),
              questionCount,
              statusFilter,
              primaryMode: primary,
            });
          }}
          className="sticky bottom-4 z-10 min-h-12 w-full gap-2 sm:static sm:w-auto [margin-bottom:env(safe-area-inset-bottom)]"
        >
          <Zap className="h-4 w-4" /> {primary === 'nudge' ? 'Start Nudge' : primary === 'mock' ? 'Start mock exam' : 'Start drill'}
        </Button>
      </div>
    </AppLayout>
  );
}


// ─── Drill Session: see components/practice/PieDrillSession (P5: server-selected, server-graded) ───

// ─── Results Screen (Full Scrollable Review) ───────────────────

function ResultsScreen({
  questions,
  answers,
  changes,
  times,
  config,
  drillRuleOuts,
  confidenceRatings,
  nudgeOutcome,
  onNewDrill,
}: {
  questions: Question[];
  answers: Record<number, string>;
  changes: Record<number, number>;
  times: Record<number, number>;
  config: SessionConfig;
  drillRuleOuts: Record<number, string[]>;
  confidenceRatings: Record<number, number>;
  nudgeOutcome?: NudgeOutcome | null;
  onNewDrill: () => void;
}) {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [ruleOutMode, setRuleOutMode] = useState<Record<number, boolean>>({});
  const [ruleOutSelections, setRuleOutSelections] = useState<Record<number, Set<string>>>(() => {
    // Initialize from drill-time rule-outs
    const initial: Record<number, Set<string>> = {};
    Object.entries(drillRuleOuts).forEach(([key, arr]) => {
      if (arr.length > 0) initial[parseInt(key)] = new Set(arr);
    });
    return initial;
  });

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

  // Behavioural feedback is withheld until the drill has enough observations.
  // Existing heuristic thresholds remain unchanged.
  const generateInsight = (): string | null => {
    if (total < 5) return null;

    const changesPerQ = total > 0 ? totalChanges / total : 0;
    const easyWrong = questions.filter((q, i) => q.difficulty === 'easy' && answers[i] !== q.correct_answer).length;
    const hardCorrect = questions.filter((q, i) => (q.difficulty === 'hard' || q.difficulty === 'difficult') && answers[i] === q.correct_answer).length;

    if (changesPerQ > 1.5) return 'High answer-change rate: more than 1.5 changes per question.';
    if (easyWrong > total * 0.2) return 'Incorrect answers on more than 20% of easy questions.';
    if (avgTime < 30 && accuracy < 60) return 'Average time is under 30 seconds with accuracy below 60%.';
    if (hardCorrect > 0 && easyWrong > 0) return 'Correct answers on difficult questions and incorrect answers on easy questions.';
    if (weaknesses.length > 0) return `Accuracy below 60% in: ${weaknesses.slice(0, 2).join(' and ')}.`;
    return null;
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

  // Canonical intelligence is rebuilt by the database trigger from the raw attempt stream.
  // Do not write performance_profiles directly from the UI, which would create a second source of truth.

  // Keep the learner's explicit weak-area profile in sync without writing derived performance metrics here.
  useEffect(() => {
    if (!user || weaknesses.length === 0) return;
    supabase.from('profiles').update({ weak_areas: weaknesses }).eq('id', user.id).then(({ error }) => {
      if (error) console.error('Failed to update weak areas:', error);
    });
  }, [user, weaknesses.join('|')]);

  return (
    <AppLayout>
        
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-[calc(9rem+env(safe-area-inset-bottom))] md:px-0 md:pb-6">
        {config.primaryMode === 'nudge' && nudgeOutcome && (
          <Card className="border-primary/25"><CardContent className="p-5 space-y-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Nudge · PIE reassessment</p><h2 className="mt-1 text-lg font-semibold">{nudgeOutcome.target.loTitle}</h2></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Before session</p><p className="text-2xl font-bold">{Math.round(nudgeOutcome.target.baselineAccuracy * 100)}%</p><p className="text-xs text-muted-foreground">{nudgeOutcome.target.baselineQuestionCount} mapped questions</p></div>
              <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">After session</p>{nudgeOutcome.reassessmentAvailable ? <><p className="text-2xl font-bold">{nudgeOutcome.followUpAccuracy == null ? '—' : `${Math.round(nudgeOutcome.followUpAccuracy * 100)}%`}</p><p className="text-xs text-muted-foreground">{nudgeOutcome.followUpQuestionCount} mapped questions · cumulative</p></> : <p className="mt-2 text-sm">Reassessment unavailable</p>}</div>
            </div>
            <p className="text-sm text-muted-foreground">{nudgeOutcome.reassessmentAvailable ? 'PIE recalculated this objective from server-saved attempts. The after-session percentage is cumulative, not a causal estimate of learning gain.' : 'Your answers were saved. The follow-up evidence could not be loaded, so no improvement claim is made.'}</p>
          </CardContent></Card>
        )}
        {/* ── SECTION 1: Summary Header ── */}
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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
                  <p className="text-sm font-semibold">{config.mode === 'full-mock' ? 'Full Mock Exam' : config.mode === 'recharge' ? 'With option change' : 'No option change'}</p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Time</p>
                  <p className="text-lg font-bold font-mono">{Math.floor(totalTime / 60)}m {totalTime % 60}s</p>
                </div>
              </div>

              {/* Evidence-gated behavioural feedback. Factual stats remain visible above. */}
              {generateInsight() && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-sm text-foreground">{generateInsight()}</p>
                </div>
              )}

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
              {total >= 5 && (strengths.length > 0 || weaknesses.length > 0) && (
                <div className="flex flex-wrap gap-4">
                  {strengths.length > 0 && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <div className="flex flex-wrap gap-1">
                        {strengths.map(s => <Badge key={s} variant="outline" className="text-xs border-success/30 text-success">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {weaknesses.length > 0 && (
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <div className="flex flex-wrap gap-1">
                        {weaknesses.map(w => <Badge key={w} variant="outline" className="text-xs border-destructive/30 text-destructive">{w}</Badge>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Elimination stats (only show if user has used rule-out) */}
              {eliminationStats.questionsWithRuleOut > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rule-Out Intelligence</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <p className="text-sm">Wrong options ruled out: <strong>{eliminationStats.totalCorrectElim} of {eliminationStats.totalPossible}</strong></p>
                    <p className="text-sm">Correct answer kept: <strong>{eliminationStats.totalWrongElim === 0 ? 'Yes' : 'No'}</strong></p>
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      {eliminationStats.totalWrongElim === 0
                        ? 'No correct answer was ruled out in the questions summarised here.'
                        : `The correct answer was ruled out ${eliminationStats.totalWrongElim} time(s).`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="outline" onClick={onNewDrill}>New Drill</Button>
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
            const options = Array.isArray(q.options)
              ? q.options
              : q.options && typeof q.options === 'object'
                ? Object.values(q.options as Record<string, unknown>).map(String)
                : [];
            const timeTaken = times[i] || 0;
            const changeCount = changes[i] || 0;

            return (
              <motion.div
                key={q.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : Math.min(i * 0.03, 0.5) }}
              >
                <Card className={cn('border-l-4 overflow-hidden', isCorrect ? 'border-l-success' : 'border-l-destructive')}>
                  {/* Question header - always visible */}
                  <Button variant="ghost" aria-expanded={isExpanded}
                    onClick={() => toggleExpand(i)}
                    className="h-auto w-full whitespace-normal text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                        <Badge variant="outline" className="text-xs">{q.category}</Badge>
                        {changeCount > 0 && <Badge variant="secondary" className="text-xs">{changeCount} change{changeCount > 1 ? 's' : ''}</Badge>}
                        <span className="text-xs text-muted-foreground font-mono">{timeTaken}s</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{q.question_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your answer: <strong className={isCorrect ? 'text-success' : 'text-destructive'}>{userAnswer || '—'}</strong>
                        {!isCorrect && <> · Correct: <strong className="text-success">{q.correct_answer}</strong></>}
                        {confidenceRatings[i] != null && <> · Confidence: <strong>{confidenceRatings[i]}/5</strong></>}
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
                  </Button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2 }}
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
                              {isRuleOut ? 'Exit review rule-out' : 'Review rule-out'}
                            </Button>
                          </div>

                          {isRuleOut && <p className="text-xs text-muted-foreground">Review-only changes are not saved to your training record.</p>}
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
                                        'shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors',
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
                              <div className="space-y-1">
                                <p className="text-sm">Wrong options ruled out: <strong>{ruleOutScore.correctEliminations} of {ruleOutScore.total}</strong></p>
                                <p className="text-sm">Correct answer kept: <strong>{ruleOutScore.wrongEliminations === 0 ? 'Yes' : 'No'}</strong></p>
                                <p className="text-xs text-muted-foreground">
                                  {ruleOutScore.wrongEliminations === 0
                                    ? `Ruled out ${ruleOutScore.correctEliminations} incorrect option(s) and kept the correct answer.`
                                    : `The correct answer was ruled out. Incorrect options ruled out correctly: ${ruleOutScore.correctEliminations} of ${ruleOutScore.total}.`}
                                </p>
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
                          {(() => {
                            const parsed = parseExplanation(q.explanation, options, q.correct_answer);
                            return (
                            <div className="rounded-lg border p-3 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explanation</p>
                              <p className="text-sm leading-relaxed">{parsed.lead}</p>

              <div className="space-y-3">
                                {parsed.options.map((item) => (
                                  <div key={item.letter} className="space-y-1">
                                    <p className="text-sm font-medium">{item.letter}. {options[item.letter.charCodeAt(0) - 65]}</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            );
                          })()}

                          {/* Diagnosis & Management */}
                          {(() => {
                            const parsed = parseExplanation(q.explanation, options, q.correct_answer);
                            const diagnosis = q.diagnosis_explanation || parsed.diagnosis;
                            return (
                            <div className="rounded-lg border border-primary/20 p-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <Stethoscope className="h-4 w-4 text-primary" />
                                <p className="text-xs font-semibold">Diagnosis & Management</p>
                              </div>
                              <p className="text-sm text-muted-foreground">{diagnosis}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {q.first_line_investigation && (
                                  <div className="rounded bg-muted p-2">
                                    <p className="text-xs text-muted-foreground">1st Line Ix</p>
                                    <p className="text-xs font-medium">{q.first_line_investigation}</p>
                                  </div>
                                )}
                                {q.gold_standard_investigation && (
                                  <div className="rounded bg-muted p-2">
                                    <p className="text-xs text-muted-foreground">Gold Standard</p>
                                    <p className="text-xs font-medium">{q.gold_standard_investigation}</p>
                                  </div>
                                )}
                                {q.best_treatment && (
                                  <div className="rounded bg-muted p-2">
                                    <p className="text-xs text-muted-foreground">Best Treatment</p>
                                    <p className="text-xs font-medium">{q.best_treatment}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                          })()}

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

        {/* Actions follow question review in document order. On phones they stay above app navigation. */}
        <div className="hidden md:flex flex-wrap gap-3 justify-center pb-8">
          <Button variant="outline" onClick={onNewDrill}>Start New Drill</Button>
          <Button asChild><Link to="/intelligence">View Intelligence</Link></Button>
        </div>
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex gap-2 border-t border-border/60 bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
          <Button variant="outline" className="min-h-11 flex-1" onClick={onNewDrill}>Start New Drill</Button>
          <Button asChild className="min-h-11 flex-1"><Link to="/intelligence">View Intelligence</Link></Button>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Main Practice Component ────────────────────────────────────

export default function Practice() {
  const gate = useFeatureGate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const resumeSessionId = searchParams.get('resume');
  const [resumeGate, setResumeGate] = useState<'checking' | 'allowed' | 'blocked' | 'unavailable'>(resumeSessionId ? 'checking' : 'allowed');
  const [resumeRetry, setResumeRetry] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'drill' | 'results' | 'history' | 'review'>(resumeSessionId ? 'drill' : 'setup');

  useEffect(() => {
    let cancelled = false;
    if (!resumeSessionId) { setResumeGate('allowed'); return; }
    if (!user) { setResumeGate('unavailable'); return; }
    setResumeGate('checking');
    void (async () => {
      try {
        const { data, error } = await supabase.from('active_sessions').select('config')
          .eq('session_id', resumeSessionId).eq('user_id', user.id).maybeSingle();
        if (error || !data) throw error ?? new Error('Saved session could not be verified.');
        const availability = classifyPracticeResumeConfig(data.config);
        if (!cancelled) setResumeGate(availability);
      } catch {
        // Fail closed when the session's mode cannot be verified. No session is
        // deleted or modified, and the candidate can retry the read.
        if (!cancelled) setResumeGate('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [resumeSessionId, user, resumeRetry]);
  const [config, setConfig] = useState<SessionConfig | null>(
    resumeSessionId ? { mode: 'recharge', topics: [], subtopics: [], questionCount: 50, statusFilter: 'all' } : null
  );
  const [resultData, setResultData] = useState<{
    questions: Question[];
    answers: Record<number, string>;
    changes: Record<number, number>;
    times: Record<number, number>;
    ruledOut: Record<number, string[]>;
    confidenceRatings: Record<number, number>;
    nudgeOutcome?: NudgeOutcome | null;
  } | null>(null);

  if (resumeSessionId && resumeGate !== 'allowed') {
    return (
      <AppLayout>
        <main className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-10 pt-6 sm:px-6" aria-live="polite">
          <header className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[.18em] text-primary">Practice session</p>
            <h1 className="font-display text-2xl font-semibold text-foreground">Saved session unavailable</h1>
            <p className="text-sm leading-6 text-muted-foreground">Your saved session and attempt records have not been deleted or changed.</p>
          </header>
          {resumeGate === 'checking' ? (
            <Card role="status"><CardContent className="p-5 text-sm text-muted-foreground">Checking the saved session mode…</CardContent></Card>
          ) : resumeGate === 'blocked' ? (
            <Card role="status" className="border-dashed border-border/70 bg-muted/20"><CardContent className="space-y-3 p-5">
              <Badge variant="outline">Under Construction · Live Soon</Badge>
              <h2 className="font-semibold">This session mode is not available to resume</h2>
              <p className="text-sm leading-6 text-muted-foreground">AMC Exam Mode and Nudge are not currently available. This unfinished session remains saved, but it cannot be resumed while the mode is under construction.</p>
            </CardContent></Card>
          ) : (
            <Card role="alert"><CardContent className="space-y-3 p-5">
              <h2 className="font-semibold">We couldn't verify this saved session</h2>
              <p className="text-sm leading-6 text-muted-foreground">Sign in again or retry the check. The session was not changed, and we will not start it until its mode can be verified.</p>
              <Button variant="outline" onClick={() => { setResumeGate('checking'); setResumeRetry(value => value + 1); }}>Retry session check</Button>
            </CardContent></Card>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="min-h-11"><Link to="/practice" replace>Start Normal MCQ</Link></Button>
            <Button asChild variant="outline" className="min-h-11"><Link to="/history">View History</Link></Button>
          </div>
        </main>
      </AppLayout>
    );
  }

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
        
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
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

  if (phase === 'review') {
    return (
      <AppLayout>
        
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold font-display">Review Queue</h1>
              <p className="text-muted-foreground">Questions Zyntra has identified as needing another look</p>
            </div>
            <Button variant="outline" onClick={() => setPhase('setup')}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back to Practice
            </Button>
          </div>
          {gate.canAccessHistory ? (
            <MCQReviewQueue />
          ) : (
            <UpgradePrompt feature="Question Review Queue" description="Upgrade to access your personalised MCQ review queue." variant="card" />
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
      />
    );
  }

  if (phase === 'drill' && config) {
    return (
      <PieDrillSession
        config={config}
        resumeSessionId={resumeSessionId}
        onFinish={(questions, answers, changes, times, ruledOut, confidenceRatings, nudgeOutcome) => {
          setResultData({ questions: questions as Question[], answers, changes, times, ruledOut, confidenceRatings, nudgeOutcome });
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
        confidenceRatings={resultData.confidenceRatings}
        nudgeOutcome={resultData.nudgeOutcome}
        onNewDrill={() => { setResultData(null); setConfig(null); setPhase('setup'); }}
      />
    );
  }

  return null;
}
