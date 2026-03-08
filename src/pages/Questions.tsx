import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Bookmark, BookmarkCheck, StickyNote, ChevronDown, ChevronUp, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SYSTEMS, SUBJECTS, SYSTEM_SUBJECTS, SUBJECT_SYSTEMS,
  getAllPairs, getMatchingCategories, type FilterMode
} from '@/lib/filter-data';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  difficulty: string;
  tags: string[] | null;
}

interface UserAttempt {
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_taken_seconds: number;
  created_at: string;
}

const difficulties = ['All', 'easy', 'medium', 'hard'];

type FilterTab = 'all' | 'bookmarked' | 'incorrect' | 'unattempted';

export default function Questions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const gate = useFeatureGate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState<UserAttempt[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [tab, setTab] = useState<FilterTab>('all');

  // Hierarchical filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('system');
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(getAllPairs());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterSearch, setFilterSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Expanded question
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const fetchAllRows = async (table: string, selectStr: string, filters?: { column: string; value: string }) => {
    const allRows: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      let query = supabase.from(table as any).select(selectStr).range(from, from + pageSize - 1);
      if (filters) query = (query as any).eq(filters.column, filters.value);
      const { data, error } = await query;
      if (error || !data || data.length === 0) { hasMore = false; break; }
      allRows.push(...data);
      if (data.length < pageSize) hasMore = false;
      from += pageSize;
    }
    return allRows;
  };

  const loadData = async () => {
    setLoading(true);

    const [allQuestions, bData, aData, nData] = await Promise.all([
      fetchAllRows('questions', '*'),
      user ? fetchAllRows('bookmarks', 'question_id', { column: 'user_id', value: user.id }) : Promise.resolve([]),
      user ? fetchAllRows('user_attempts', 'question_id, selected_answer, is_correct, time_taken_seconds, created_at', { column: 'user_id', value: user.id }) : Promise.resolve([]),
      user ? fetchAllRows('user_notes', 'question_id, note_text', { column: 'user_id', value: user.id }) : Promise.resolve([]),
    ]);

    setQuestions(allQuestions.map((q: any) => ({ ...q, options: q.options as string[] })));
    setBookmarks(new Set(bData.map((b: any) => b.question_id)));
    setAttempts(aData as UserAttempt[]);
    const noteMap: Record<string, string> = {};
    nData.forEach((n: any) => { noteMap[n.question_id] = n.note_text; });
    setNotes(noteMap);

    setLoading(false);
  };

  // Category counts from loaded questions
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach(q => {
      counts[q.category] = (counts[q.category] || 0) + 1;
    });
    return counts;
  }, [questions]);

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

  const attemptedIds = useMemo(() => new Set(attempts.map(a => a.question_id)), [attempts]);
  const incorrectIds = useMemo(() => new Set(attempts.filter(a => !a.is_correct).map(a => a.question_id)), [attempts]);

  // Get matching categories from hierarchical selection
  const matchingCategories = useMemo(
    () => getMatchingCategories(selectedPairs, categoryCounts),
    [selectedPairs, categoryCounts]
  );

  const allPairsSelected = selectedPairs.size === getAllPairs().size;

  const filtered = useMemo(() => {
    let result = questions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.question_text.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    }

    // Hierarchical category filter
    if (!allPairsSelected) {
      const matchSet = new Set(matchingCategories);
      result = result.filter(r => matchSet.has(r.category));
    }

    if (difficulty !== 'All') {
      result = result.filter(r => r.difficulty === difficulty);
    }

    switch (tab) {
      case 'bookmarked': result = result.filter(r => bookmarks.has(r.id)); break;
      case 'incorrect': result = result.filter(r => incorrectIds.has(r.id)); break;
      case 'unattempted': result = result.filter(r => !attemptedIds.has(r.id)); break;
    }

    return result;
  }, [questions, search, difficulty, tab, bookmarks, incorrectIds, attemptedIds, allPairsSelected, matchingCategories]);

  // Filter helpers
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

  const selectAll = () => setSelectedPairs(getAllPairs());
  const clearAll = () => setSelectedPairs(new Set());

  const selectedCount = selectedPairs.size;
  const totalPairs = getAllPairs().size;

  const toggleBookmark = async (qId: string) => {
    if (!user) return;
    const isBookmarked = bookmarks.has(qId);
    const next = new Set(bookmarks);

    if (isBookmarked) {
      next.delete(qId);
      setBookmarks(next);
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('question_id', qId);
    } else {
      next.add(qId);
      setBookmarks(next);
      await supabase.from('bookmarks').insert({ user_id: user.id, question_id: qId });
    }
  };

  const saveNote = async (qId: string) => {
    if (!user) return;
    const existing = notes[qId];

    if (existing !== undefined) {
      await supabase.from('user_notes').update({ note_text: noteText }).eq('user_id', user.id).eq('question_id', qId);
    } else {
      await supabase.from('user_notes').insert({ user_id: user.id, question_id: qId, note_text: noteText });
    }

    setNotes(prev => ({ ...prev, [qId]: noteText }));
    setEditingNote(null);
    toast({ title: 'Note saved' });
  };

  const getAttemptHistory = (qId: string) => attempts.filter(a => a.question_id === qId);

  const difficultyColor = (d: string) => {
    switch (d) {
      case 'easy': return 'bg-chart-2/15 text-chart-2 border-chart-2/30';
      case 'medium': return 'bg-chart-4/15 text-chart-4 border-chart-4/30';
      case 'hard': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return '';
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-display">Question Bank</h1>
        <p className="text-muted-foreground">Browse, search, and study AMC questions</p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Topics
            {!allPairsSelected && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {selectedCount}/{totalPairs}
              </Badge>
            )}
          </Button>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {difficulties.map(d => (
                <SelectItem key={d} value={d}>{d === 'All' ? 'All Levels' : d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hierarchical Topic Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">View:</span>
                      <ToggleGroup
                        type="single"
                        value={filterMode}
                        onValueChange={(v) => v && setFilterMode(v as FilterMode)}
                        className="bg-muted rounded-lg p-1"
                      >
                        <ToggleGroupItem value="system" className="text-sm px-4">
                          System
                        </ToggleGroupItem>
                        <ToggleGroupItem value="subject" className="text-sm px-4">
                          Subject
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
                      <Button variant="ghost" size="sm" onClick={clearAll}>Clear All</Button>
                    </div>
                  </div>

                  {/* Filter search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search systems or subjects..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {filterSearch && (
                      <button
                        onClick={() => setFilterSearch('')}
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
                        if (!filterSearch.trim()) return true;
                        const q = filterSearch.toLowerCase();
                        const subjects = SYSTEM_SUBJECTS[system] || [];
                        return system.toLowerCase().includes(q) || subjects.some(s => s.toLowerCase().includes(q));
                      }).map((system) => {
                        const subjects = SYSTEM_SUBJECTS[system] || [];
                        const selCount = subjects.filter(sub => selectedPairs.has(`${system}:${sub}`)).length;
                        const allSel = selCount === subjects.length && subjects.length > 0;
                        const someSel = selCount > 0;

                        return (
                          <Collapsible
                            key={system}
                            open={expandedItems.has(system) || (!!filterSearch.trim() && subjects.some(s => s.toLowerCase().includes(filterSearch.toLowerCase())))}
                            onOpenChange={() => toggleExpand(system)}
                          >
                            <div className={cn(
                              'rounded-lg border transition-colors',
                              someSel ? 'border-primary/40 bg-primary/5' : 'border-border'
                            )}>
                              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={allSel}
                                    onCheckedChange={() => toggleSystem(system)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(someSel && !allSel && "data-[state=unchecked]:bg-primary/30")}
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
                        if (!filterSearch.trim()) return true;
                        const q = filterSearch.toLowerCase();
                        const systems = SUBJECT_SYSTEMS[subject] || [];
                        return subject.toLowerCase().includes(q) || systems.some(s => s.toLowerCase().includes(q));
                      }).map((subject) => {
                        const systems = SUBJECT_SYSTEMS[subject] || [];
                        const selCount = systems.filter(sys => selectedPairs.has(`${sys}:${subject}`)).length;
                        const allSel = selCount === systems.length && systems.length > 0;
                        const someSel = selCount > 0;

                        return (
                          <Collapsible
                            key={subject}
                            open={expandedItems.has(subject) || (!!filterSearch.trim() && systems.some(s => s.toLowerCase().includes(filterSearch.toLowerCase())))}
                            onOpenChange={() => toggleExpand(subject)}
                          >
                            <div className={cn(
                              'rounded-lg border transition-colors',
                              someSel ? 'border-primary/40 bg-primary/5' : 'border-border'
                            )}>
                              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={allSel}
                                    onCheckedChange={() => toggleSubject(subject)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(someSel && !allSel && "data-[state=unchecked]:bg-primary/30")}
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
                                  {systems.map((sys) => (
                                    <label
                                      key={`${sys}:${subject}`}
                                      className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <Checkbox
                                        checked={selectedPairs.has(`${sys}:${subject}`)}
                                        onCheckedChange={() => togglePair(sys, subject)}
                                      />
                                      {sys}
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
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Tabs value={tab} onValueChange={v => setTab(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">All ({questions.length})</TabsTrigger>
            <TabsTrigger value="bookmarked">Bookmarked ({bookmarks.size})</TabsTrigger>
            <TabsTrigger value="incorrect">Incorrect ({incorrectIds.size})</TabsTrigger>
            <TabsTrigger value="unattempted">Unattempted ({questions.length - attemptedIds.size})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-muted-foreground mb-3">
          Showing {filtered.length} of {questions.length} questions
        </p>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent>
            <p className="text-muted-foreground">No questions match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q, idx) => {
            const isExpanded = expandedId === q.id;
            const isBookmarked = bookmarks.has(q.id);
            const history = getAttemptHistory(q.id);
            const hasNote = notes[q.id] !== undefined;

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              >
                <Card className={cn('transition-all', isExpanded && 'ring-1 ring-primary/20')}>
                  <CardHeader
                    className="cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{q.category}</Badge>
                          <Badge variant="outline" className={cn('text-xs capitalize', difficultyColor(q.difficulty))}>{q.difficulty}</Badge>
                          {history.length > 0 && (
                            <Badge variant="outline" className={cn('text-xs',
                              history[history.length - 1].is_correct
                                ? 'bg-chart-2/15 text-chart-2 border-chart-2/30'
                                : 'bg-destructive/15 text-destructive border-destructive/30'
                            )}>
                              {history[history.length - 1].is_correct ? 'Correct' : 'Incorrect'}
                            </Badge>
                          )}
                          {hasNote && <StickyNote className="h-3.5 w-3.5 text-chart-4" />}
                        </div>
                        <CardTitle className="text-sm font-medium leading-snug line-clamp-2">
                          {q.question_text}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); toggleBookmark(q.id); }}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        >
                          {isBookmarked
                            ? <BookmarkCheck className="h-4 w-4 text-primary" />
                            : <Bookmark className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardHeader>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <CardContent className="pt-0 space-y-4">
                          {/* Options */}
                          <div className="space-y-2">
                            {q.options.map((opt, i) => {
                              const letter = String.fromCharCode(65 + i);
                              const isCorrect = q.correct_answer === letter;
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    'flex items-start gap-2 rounded-lg border p-3 text-sm',
                                    isCorrect
                                      ? 'border-chart-2/40 bg-chart-2/5'
                                      : 'border-border'
                                  )}
                                >
                                  <span className={cn('font-semibold shrink-0', isCorrect && 'text-chart-2')}>{letter}.</span>
                                  <span>{opt}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation */}
                          {q.explanation && (
                            <div className="rounded-lg bg-muted/50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Explanation</p>
                              <p className="text-sm">{q.explanation}</p>
                            </div>
                          )}

                          {/* Attempt History */}
                          {history.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your Attempts ({history.length})</p>
                              <div className="space-y-1.5">
                                {history.slice(-3).map((a, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm rounded-md bg-muted/30 px-3 py-2">
                                    <span>Answer: <strong>{a.selected_answer}</strong></span>
                                    <span className={a.is_correct ? 'text-chart-2' : 'text-destructive'}>
                                      {a.is_correct ? '✓ Correct' : '✗ Incorrect'}
                                    </span>
                                    <span className="text-muted-foreground">{a.time_taken_seconds}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          <div>
                            {editingNote === q.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  placeholder="Add your notes…"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => saveNote(q.id)}>Save Note</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                {notes[q.id] ? (
                                  <div className="text-sm text-muted-foreground italic flex-1">{notes[q.id]}</div>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setEditingNote(q.id); setNoteText(notes[q.id] || ''); }}
                                  className="gap-1 shrink-0"
                                >
                                  <StickyNote className="h-3.5 w-3.5" />
                                  {notes[q.id] ? 'Edit Note' : 'Add Note'}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
