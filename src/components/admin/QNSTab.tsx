import { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Upload, FileUp, X, Pencil, Trash2, Search, ChevronDown, FileText, Copy, ArrowRightLeft } from 'lucide-react';
import { MCQEditor } from './MCQEditor';
import { SubjectManager } from './SubjectManager';
import { SubtopicManager } from './SubtopicManager';

const CATEGORIES = [
  "Medicine", "Surgery", "OB&G", "Acute Medicine", "Population Health", "Basic Science"
];

const DIFFICULTIES = ["easy", "moderate", "difficult"];

const OSCE_SUBJECTS = [
  "Medicine", "Surgery", "OB&G", "Acute Medicine", "Population Health", "Basic Science"
];

// ─── Create-only MCQ sub-tab ─────────────────────────────────
function MCQCreateTab({ questionType }: { questionType: 'mcq' | 'mcq_temp' }) {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [importing, setImporting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<any>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subtopicMap, setSubtopicMap] = useState<Record<string, { name: string; subjectName: string }[]>>({});

  const refreshSubjects = useCallback(async () => {
    const { data } = await supabase.functions.invoke('admin-manage-questions', {
      body: { action: 'manage_subject', subject_action: 'list' }
    });
    const subs = data?.subjects || CATEGORIES.map((c, i) => ({ id: c, name: c, display_order: i }));
    setSubjects(subs);
    // Also fetch all subtopics for auto-classification
    const { data: stData } = await supabase.functions.invoke('admin-manage-questions', {
      body: { action: 'manage_subtopic', subtopic_action: 'list' }
    });
    const allSt = stData?.subtopics || [];
    const map: Record<string, { name: string; subjectName: string }[]> = {};
    for (const st of allSt) {
      const parentSubject = subs.find((s: any) => s.id === st.subject_id);
      if (parentSubject) {
        if (!map[parentSubject.name]) map[parentSubject.name] = [];
        map[parentSubject.name].push({ name: st.name, subjectName: parentSubject.name });
      }
    }
    setSubtopicMap(map);
  }, []);

  useEffect(() => { refreshSubjects(); }, [refreshSubjects]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setJsonInput(ev.target?.result as string || "");
    reader.readAsText(file);
  };

  const importQuestions = async () => {
    setImporting(true);
    const allErrors: string[] = [];
    let totalImported = 0;
    try {
      const parsed = JSON.parse(jsonInput);
      const qs = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(qs) || !qs.length) throw new Error("Expected non-empty JSON array");

      // Build flat lookup for auto-classification
      const allSubtopicEntries: { subtopicName: string; subjectName: string }[] = [];
      for (const [subjectName, sts] of Object.entries(subtopicMap)) {
        for (const st of sts) {
          allSubtopicEntries.push({ subtopicName: st.name, subjectName });
        }
      }
      const subjectNames = subjects.map(s => s.name);

      // Auto-tag every question with the active tab's question_type + auto-classify
      const withType = qs.map(q => {
        const tagged = { ...q, question_type: questionType };
        const text = (q.question_text || '').toLowerCase();

        // Auto-classify category if missing
        if (!tagged.category) {
          // Try subtopic match first (more specific)
          const stMatch = allSubtopicEntries.find(e => text.includes(e.subtopicName.toLowerCase()));
          if (stMatch) {
            tagged.category = stMatch.subjectName;
            if (!tagged.subtopic) tagged.subtopic = stMatch.subtopicName;
          } else {
            // Try subject name match
            const subMatch = subjectNames.find(s => text.includes(s.toLowerCase()));
            tagged.category = subMatch || 'Uncategorized';
          }
        }

        // Auto-classify subtopic if missing but category exists
        if (!tagged.subtopic && tagged.category && subtopicMap[tagged.category]) {
          const stMatch = subtopicMap[tagged.category].find(st => text.includes(st.name.toLowerCase()));
          if (stMatch) tagged.subtopic = stMatch.name;
        }

        return tagged;
      });
      const BATCH_SIZE = 25;
      const totalCount = withType.length;
      setImportProgress({ current: 0, total: totalCount, errors: [] });

      for (let i = 0; i < totalCount; i += BATCH_SIZE) {
        const batch = withType.slice(i, i + BATCH_SIZE);
        try {
          const { data, error } = await supabase.functions.invoke('import-questions', { body: { questions: batch } });
          if (error) throw error;
          totalImported += data?.imported || 0;
          if (data?.errors?.length) {
            allErrors.push(...data.errors.map((e: string) => `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e}`));
          }
        } catch (batchErr: any) {
          allErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchErr.message}`);
        }
        setImportProgress({ current: Math.min(i + BATCH_SIZE, totalCount), total: totalCount, errors: [...allErrors] });
      }

      toast({
        title: `Import Complete`,
        description: `${totalImported}/${totalCount} questions imported as ${questionType.toUpperCase()}${allErrors.length ? ` · ${allErrors.length} errors` : ''}`,
        variant: allErrors.length ? 'destructive' : 'default',
      });
      if (!allErrors.length) {
        setJsonInput("");
        setFileName(null);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setTimeout(() => setImportProgress(null), 3000);
    setImporting(false);
  };

  if (showEditor) {
    return (
      <MCQEditor
        subjects={subjects}
        questionType={questionType}
        onSave={() => {
          setShowEditor(false);
          toast({ title: 'Question created', description: `Saved as ${questionType.toUpperCase()}` });
        }}
        onCancel={() => setShowEditor(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Create {questionType === 'mcq_temp' ? 'MCQ TEMP' : 'MCQ'} Question</h3>
          <p className="text-sm text-muted-foreground">
            {questionType === 'mcq_temp' ? 'Experimental questions — controlled via MCQ TEMP toggle in System Settings' : 'Standard MCQ questions for practice modes'}
          </p>
        </div>
        <Button onClick={() => setShowEditor(true)} className="gap-2">
          <Pencil className="h-4 w-4" /> Create Question
        </Button>
      </div>

      {questionType === 'mcq' && (
        <>
          <SubjectManager subjects={subjects} onRefresh={refreshSubjects} />
          <SubtopicManager subjects={subjects} onRefresh={refreshSubjects} />
        </>
      )}

      {/* Import */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" /> Import JSON</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4 mr-2" /> Choose File</Button>
            {fileName && <div className="flex items-center gap-2"><Badge variant="secondary">{fileName}</Badge><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setJsonInput(""); setFileName(null); }}><X className="h-3 w-3" /></Button></div>}
          </div>
          <Textarea placeholder="Or paste JSON array..." className="min-h-[120px] font-mono text-xs" value={jsonInput} onChange={e => setJsonInput(e.target.value)} disabled={importing} />

          {importProgress && (
            <div className="space-y-2">
              <Progress value={(importProgress.current / importProgress.total) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {importProgress.current} / {importProgress.total} questions · Importing as {questionType === 'mcq_temp' ? 'MCQ TEMP' : 'MCQ'}…
              </p>
              {importProgress.errors.length > 0 && (
                <div className="max-h-24 overflow-y-auto rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  {importProgress.errors.map((e, i) => <p key={i}>⚠ {e}</p>)}
                </div>
              )}
            </div>
          )}

          <Button onClick={importQuestions} disabled={importing || !jsonInput.trim()}>
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {importing ? `Importing…` : `Import as ${questionType === 'mcq_temp' ? 'MCQ TEMP' : 'MCQ'}`}
          </Button>
        </CardContent>
      </Card>

      {/* JSON Format Reference */}
      <Card>
        <Collapsible>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-primary" /> Required JSON Format</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const template = JSON.stringify({
                    question_text: "", options: ["", "", "", "", ""], correct_answer: "A",
                    category: "", difficulty: "moderate",
                    explanation: "CORRECT ANSWER\n\n[ANSWER NAME]\n\n---\n\n1. CLINICAL DIAGNOSIS\n...\n10. MEMORY ANCHOR\n\n---\n\nEDITED BY HEISENBERG",
                    diagnosis_explanation: "", best_treatment: "",
                    incorrect_answer_explanations: { B: "", C: "", D: "", E: "" },
                    key_takeaways: [""], subtopic: "", clinical_vignette: true
                  }, null, 2);
                  navigator.clipboard.writeText(template);
                  toast({ title: 'Template copied' });
                }}>Copy Template</Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronDown className="h-4 w-4" /></Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-foreground mb-1">Required Fields</p>
                  <ul className="space-y-0.5 text-muted-foreground text-xs">
                    <li><code className="text-primary">question_text</code> — Full clinical vignette</li>
                    <li><code className="text-primary">options</code> — Array of 5 strings [A–E]</li>
                    <li><code className="text-primary">correct_answer</code> — "A"–"E"</li>
                    <li><code className="text-primary">category</code> — Subject heading</li>
                    <li><code className="text-primary">difficulty</code> — "easy" / "moderate" / "difficult"</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Zyntra Explanation Fields</p>
                  <ul className="space-y-0.5 text-muted-foreground text-xs">
                    <li><code className="text-primary">explanation</code> — Full 10-section format</li>
                    <li><code className="text-primary">incorrect_answer_explanations</code> — {`{B: "...", C: "..."}`}</li>
                    <li><code className="text-primary">key_takeaways</code> — Array of points</li>
                    <li><code className="text-primary">best_treatment</code> / <code className="text-primary">diagnosis_explanation</code></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}

// ─── OSCE Create-only sub-tab ────────────────────────────────
function OSCECreateTab() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [genSubject, setGenSubject] = useState("Cardiology");
  const [importing, setImporting] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateStation = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-station', {
        body: { subject: genSubject, mode: 'instant' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Generated', description: `OSCE station for ${genSubject}` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setJsonInput(ev.target?.result as string || "");
    reader.readAsText(file);
  };

  const importStations = async () => {
    setImporting(true);
    try {
      const parsed = JSON.parse(jsonInput);
      const arr = Array.isArray(parsed) ? parsed : parsed.stations;
      if (!Array.isArray(arr)) throw new Error("Expected JSON array");
      const { data, error } = await supabase.functions.invoke('admin-manage-stations', {
        body: { action: 'import', stations: arr }
      });
      if (error) throw error;
      toast({ title: 'Imported', description: `${data.imported} stations` });
      setJsonInput("");
      setFileName(null);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> Generate OSCE Station</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <label className="text-sm text-muted-foreground mb-1 block">Subject</label>
            <Select value={genSubject} onValueChange={setGenSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OSCE_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button onClick={generateStation} disabled={generating}>{generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Generate Station</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" /> Import Stations (JSON)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4 mr-2" /> Choose File</Button>
            {fileName && <div className="flex items-center gap-2"><Badge variant="secondary">{fileName}</Badge><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setJsonInput(""); setFileName(null); }}><X className="h-3 w-3" /></Button></div>}
          </div>
          <Textarea placeholder="Or paste JSON..." className="min-h-[120px] font-mono text-xs" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
          <Button onClick={importStations} disabled={importing || !jsonInput.trim()}>{importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Import</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ALL QNS Master Control ──────────────────────────────────
function AllQNSTab() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [subjects, setSubjects] = useState<any[]>([]);

  // Editor state
  const [editorMode, setEditorMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  // OSCE edit state
  const [editS, setEditS] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [qRes, sRes, subRes] = await Promise.all([
        supabase.functions.invoke('admin-manage-questions', { body: { action: 'list' } }),
        supabase.functions.invoke('admin-manage-stations', { body: { action: 'list' } }),
        supabase.functions.invoke('admin-manage-questions', { body: { action: 'manage_subject', subject_action: 'list' } }),
      ]);
      setQuestions(qRes.data?.questions || []);
      setStations(sRes.data?.stations || []);
      setSubjects(subRes.data?.subjects || CATEGORIES.map((c, i) => ({ id: c, name: c, display_order: i })));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const deleteQuestion = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'delete', question_id: id }
      });
      if (error) throw error;
      toast({ title: 'Deleted' });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteStation = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-manage-stations', {
        body: { action: 'delete', station_id: id }
      });
      if (error) throw error;
      toast({ title: 'Deleted' });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const changeQuestionType = async (id: string, newType: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'update', question_id: id, question_data: { question_type: newType } }
      });
      if (error) throw error;
      toast({ title: 'Type changed', description: `→ ${newType.toUpperCase()}` });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const duplicateQuestion = async (q: any) => {
    try {
      const { id, created_at, zyntra_id, ...rest } = q;
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'create', question_data: rest }
      });
      if (error) throw error;
      toast({ title: 'Duplicated' });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const saveStation = async () => {
    if (!editS) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-stations', {
        body: { action: 'update', station_id: editS.id, station_data: { scenario_title: editS.scenario_title, subject: editS.subject, scenario_data: editS.scenario_data } }
      });
      if (error) throw error;
      toast({ title: 'Saved' });
      setEditS(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // Filter
  const filteredQ = questions.filter(q => {
    if (filterType !== 'all' && filterType !== 'osce' && q.question_type !== filterType) return false;
    if (filterType === 'osce') return false;
    if (!searchQ) return true;
    const s = searchQ.toLowerCase();
    return q.question_text?.toLowerCase().includes(s) || q.category?.toLowerCase().includes(s) || q.zyntra_id?.toLowerCase().includes(s);
  });

  const filteredS = stations.filter(s => {
    if (filterType !== 'all' && filterType !== 'osce') return false;
    if (!searchQ) return true;
    const term = searchQ.toLowerCase();
    return s.scenario_title?.toLowerCase().includes(term) || s.subject?.toLowerCase().includes(term) || s.zyntra_id?.toLowerCase().includes(term);
  });

  if (editorMode === 'edit' && editingQuestion) {
    return (
      <MCQEditor
        question={editingQuestion}
        subjects={subjects}
        onSave={() => { setEditorMode('list'); setEditingQuestion(null); fetchAll(); }}
        onCancel={() => { setEditorMode('list'); setEditingQuestion(null); }}
      />
    );
  }

  const typeColors: Record<string, string> = {
    mcq: 'bg-primary/10 text-primary border-primary/20',
    mcq_temp: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    osce: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by text, category, or QN ID..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="mcq">MCQ</SelectItem>
            <SelectItem value="mcq_temp">MCQ TEMP</SelectItem>
            <SelectItem value="osce">OSCE</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchAll} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{questions.length + stations.length}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{questions.filter(q => q.question_type === 'mcq').length}</div><div className="text-xs text-muted-foreground">MCQ</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{questions.filter(q => q.question_type === 'mcq_temp').length}</div><div className="text-xs text-muted-foreground">MCQ TEMP</div></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{stations.length}</div><div className="text-xs text-muted-foreground">OSCE</div></CardContent></Card>
      </div>

      {/* MCQ / MCQ TEMP Table */}
      {(filterType === 'all' || filterType === 'mcq' || filterType === 'mcq_temp') && filteredQ.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Questions ({filteredQ.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-[35%]">Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQ.slice(0, 100).map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{q.zyntra_id || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${typeColors[q.question_type] || ''}`}>
                        {q.question_type === 'mcq_temp' ? 'TEMP' : q.question_type?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">{q.question_text?.replace(/<[^>]*>/g, '').slice(0, 80)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{q.category}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{q.difficulty}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditingQuestion({ ...q }); setEditorMode('edit'); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate" onClick={() => duplicateQuestion(q)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {/* Type switcher */}
                        <Select value={q.question_type} onValueChange={(v) => changeQuestionType(q.id, v)}>
                          <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent [&>svg]:hidden">
                            <ArrowRightLeft className="h-3.5 w-3.5 mx-auto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mcq">MCQ</SelectItem>
                            <SelectItem value="mcq_temp">MCQ TEMP</SelectItem>
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete question?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this question and all related data.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteQuestion(q.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredQ.length > 100 && <p className="text-xs text-muted-foreground p-3">Showing first 100 of {filteredQ.length}</p>}
          </CardContent>
        </Card>
      )}

      {/* OSCE Stations Table */}
      {(filterType === 'all' || filterType === 'osce') && filteredS.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">OSCE Stations ({filteredS.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredS.slice(0, 100).map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{s.zyntra_id || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] ${typeColors.osce}`}>OSCE</Badge></TableCell>
                    <TableCell className="text-sm">{s.scenario_title || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{s.subject}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditS({ ...s })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete station?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this OSCE station.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteStation(s.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && filteredQ.length === 0 && filteredS.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No questions found</CardContent></Card>
      )}

      {/* OSCE Edit Dialog */}
      <Dialog open={!!editS} onOpenChange={open => !open && setEditS(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Station</DialogTitle></DialogHeader>
          {editS && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input value={editS.scenario_title} onChange={e => setEditS({ ...editS, scenario_title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Select value={editS.subject} onValueChange={v => setEditS({ ...editS, subject: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OSCE_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
              <div>
                <label className="text-sm font-medium">Scenario Data (JSON)</label>
                <Textarea value={JSON.stringify(editS.scenario_data, null, 2)} onChange={e => { try { setEditS({ ...editS, scenario_data: JSON.parse(e.target.value) }); } catch {} }} className="font-mono text-xs min-h-[200px]" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditS(null)}>Cancel</Button>
            <Button onClick={saveStation} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── QNS Parent Tab ──────────────────────────────────────────
export function QNSTab() {
  return (
    <Tabs defaultValue="mcq" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="mcq">MCQ</TabsTrigger>
        <TabsTrigger value="mcq_temp">MCQ TEMP</TabsTrigger>
        <TabsTrigger value="osce">OSCE</TabsTrigger>
        <TabsTrigger value="all">ALL QNS</TabsTrigger>
      </TabsList>
      <TabsContent value="mcq"><MCQCreateTab questionType="mcq" /></TabsContent>
      <TabsContent value="mcq_temp"><MCQCreateTab questionType="mcq_temp" /></TabsContent>
      <TabsContent value="osce"><OSCECreateTab /></TabsContent>
      <TabsContent value="all"><AllQNSTab /></TabsContent>
    </Tabs>
  );
}
