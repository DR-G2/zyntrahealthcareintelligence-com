import { useState, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Loader2, Sparkles, Upload, CheckCircle2, FileUp, X } from 'lucide-react';

const CATEGORIES = [
  "Cardiology", "Respiratory", "Gastroenterology", "Neurology", "Endocrinology",
  "Nephrology", "Rheumatology", "Haematology", "Infectious Disease", "Dermatology",
  "Psychiatry", "Obstetrics", "Gynaecology", "Paediatrics", "Surgery",
  "Ophthalmology", "ENT", "Emergency Medicine", "Pharmacology"
];

const DIFFICULTIES = ["easy", "medium", "hard"];

export default function AdminQuestions() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [category, setCategory] = useState("Cardiology");
  const [difficulty, setDifficulty] = useState("medium");
  const [batchSize, setBatchSize] = useState("10");
  const [jsonInput, setJsonInput] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonInput(ev.target?.result as string || "");
    };
    reader.readAsText(file);
  };

  const clearFileInput = () => {
    setJsonInput("");
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addLog = (msg: string) => setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const generateBatch = async () => {
    setGenerating(true);
    addLog(`Generating ${batchSize} ${difficulty} questions for ${category}...`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: { category, difficulty, batch_size: parseInt(batchSize) }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      addLog(`✅ Generated ${data.count} questions for ${data.category} (${data.difficulty})`);
      toast({ title: 'Success', description: `Generated ${data.count} questions` });
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const generateAll = async () => {
    setBulkGenerating(true);
    addLog('Starting bulk generation across all categories and difficulties...');
    let total = 0;
    for (const cat of CATEGORIES) {
      for (const diff of DIFFICULTIES) {
        addLog(`Generating 10 ${diff} questions for ${cat}...`);
        try {
          const { data, error } = await supabase.functions.invoke('generate-questions', {
            body: { category: cat, difficulty: diff, batch_size: 10 }
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          total += data.count || 0;
          addLog(`✅ ${cat} (${diff}): ${data.count} questions`);
        } catch (e: any) {
          addLog(`❌ ${cat} (${diff}): ${e.message}`);
          // Wait 5s on rate limit
          if (e.message?.includes('Rate') || e.message?.includes('429')) {
            addLog('⏳ Rate limited, waiting 10s...');
            await new Promise(r => setTimeout(r, 10000));
          }
        }
        // Small delay between requests
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    addLog(`🎉 Bulk generation complete! Total: ${total} questions`);
    toast({ title: 'Bulk Generation Complete', description: `Generated ${total} total questions` });
    setBulkGenerating(false);
  };

  const importQuestions = async () => {
    setImporting(true);
    try {
      const parsed = JSON.parse(jsonInput);
      const questions = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(questions)) throw new Error("Expected a JSON array of questions");

      addLog(`Importing ${questions.length} questions...`);
      const { data, error } = await supabase.functions.invoke('import-questions', {
        body: { questions }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      addLog(`✅ Imported ${data.imported} questions. Errors: ${data.errors?.length || 0}`);
      if (data.errors?.length) data.errors.forEach((e: string) => addLog(`⚠️ ${e}`));
      toast({ title: 'Import Complete', description: `Imported ${data.imported} questions` });
      setJsonInput("");
    } catch (e: any) {
      addLog(`❌ Import error: ${e.message}`);
      toast({ title: 'Import Error', description: e.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl py-8 space-y-6">
        <h1 className="text-2xl font-display font-bold">Question Bank Manager</h1>

        {/* Generate Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" /> AI Question Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Difficulty</label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Batch Size</label>
                <Select value={batchSize} onValueChange={setBatchSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={generateBatch} disabled={generating || bulkGenerating}>
                {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Batch
              </Button>
              <Button variant="outline" onClick={generateAll} disabled={generating || bulkGenerating}>
                {bulkGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate All (500+)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-primary" /> Import Questions (JSON)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Expected JSON format:</p>
              <pre className="overflow-x-auto">{`[{
  "question_text": "A 45-year-old man presents with...",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4", "E. Option 5"],
  "correct_answer": "B",
  "explanation": "...",
  "category": "Cardiology",
  "difficulty": "medium",
  "diagnosis_explanation": "...",
  "first_line_investigation": "ECG",
  "gold_standard_investigation": "Coronary angiography",
  "best_treatment": "...",
  "differential_diagnoses": [{"diagnosis":"...","reasoning":"...","investigation":"...","treatment":"..."}],
  "incorrect_answer_explanations": {"A":{"why_wrong":"...","when_correct":"..."}},
  "key_takeaways": ["Point 1", "Point 2"]
}]`}</pre>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="h-4 w-4 mr-2" /> Choose JSON File
              </Button>
              {fileName && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{fileName}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFileInput}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <Textarea
              placeholder="Or paste your JSON array of questions here..."
              className="min-h-[200px] font-mono text-xs"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <Button onClick={importQuestions} disabled={importing || !jsonInput.trim()}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import Questions
            </Button>
          </CardContent>
        </Card>

        {/* Log */}
        {log.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
                {log.map((l, i) => (
                  <div key={i} className="text-muted-foreground">{l}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
