import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RichTextEditor } from './RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ImagePlus, X, Save } from 'lucide-react';

const DIFFICULTIES = ['easy', 'moderate', 'difficult'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

interface MCQOption {
  text: string;
  image_url?: string;
}

interface MCQEditorProps {
  question?: any; // existing question for edit mode
  subjects: { id: string; name: string }[];
  onSave: () => void;
  onCancel: () => void;
  questionType?: 'mcq' | 'mcq_temp' | 'osce';
}

export function MCQEditor({ question, subjects, onSave, onCancel, questionType = 'mcq' }: MCQEditorProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Form state
  const [questionText, setQuestionText] = useState('');
  const [category, setCategory] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [difficulty, setDifficulty] = useState('moderate');
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<MCQOption[]>(
    OPTION_LABELS.map(() => ({ text: '' }))
  );

  // Populate for edit mode
  useEffect(() => {
    if (question) {
      setQuestionText(question.question_text || '');
      setCategory(question.category || '');
      setSubtopic(question.subtopic || '');
      setDifficulty(question.difficulty || 'moderate');
      setCorrectAnswer(question.correct_answer || 'A');
      setExplanation(question.explanation || '');

      // Parse options - handle both array of strings and array of objects
      const opts = question.options || [];
      const parsed: MCQOption[] = OPTION_LABELS.map((_, i) => {
        const opt = opts[i];
        if (typeof opt === 'string') return { text: opt };
        if (opt && typeof opt === 'object') return { text: opt.text || '', image_url: opt.image_url };
        return { text: '' };
      });
      setOptions(parsed);
    }
  }, [question]);

  const updateOption = (index: number, field: keyof MCQOption, value: string) => {
    setOptions(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const handleOptionImage = async (index: number, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 2MB', variant: 'destructive' });
      return;
    }
    const ext = file.name.split('.').pop();
    const path = `options/${Date.now()}_${index}.${ext}`;
    const { error } = await supabase.storage.from('question-images').upload(path, file);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return;
    }
    const { data } = supabase.storage.from('question-images').getPublicUrl(path);
    updateOption(index, 'image_url', data.publicUrl);
  };

  const removeOptionImage = (index: number) => {
    updateOption(index, 'image_url', '');
  };

  const handleSave = async () => {
    if (!questionText.trim() || !category) {
      toast({ title: 'Missing fields', description: 'Question text and subject are required', variant: 'destructive' });
      return;
    }

    const hasAtLeast2Options = options.filter(o => o.text.trim() || o.image_url).length >= 2;
    if (!hasAtLeast2Options) {
      toast({ title: 'Need options', description: 'At least 2 options required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const questionData = {
        question_text: questionText,
        category,
        subtopic: subtopic || null,
        difficulty,
        correct_answer: correctAnswer,
        explanation: explanation || null,
        question_type: question ? question.question_type : questionType,
        options: options.map(o => {
          if (o.image_url) return { text: o.text, image_url: o.image_url };
          return o.text;
        }),
      };

      if (question) {
        // Update
        const { error } = await supabase.functions.invoke('admin-manage-questions', {
          body: { action: 'update', question_id: question.id, question_data: questionData }
        });
        if (error) throw error;
        toast({ title: 'Question updated' });
      } else {
        // Create
        const { data, error } = await supabase.functions.invoke('admin-manage-questions', {
          body: { action: 'create', question_data: questionData }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: 'Question created' });
      }
      onSave();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {question ? 'Edit Question' : 'Create Question'}
        </h2>
      </div>

      {/* Question Stem */}
      <Card>
        <CardHeader><CardTitle className="text-base">Question Stem</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor value={questionText} onChange={setQuestionText} placeholder="Type your clinical vignette here..." minHeight="200px" />
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader><CardTitle className="text-base">Answer Options</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={correctAnswer} onValueChange={setCorrectAnswer}>
            {OPTION_LABELS.map((label, i) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-md border border-input">
                <div className="flex items-center gap-2 pt-1">
                  <RadioGroupItem value={label} id={`opt-${label}`} />
                  <Label htmlFor={`opt-${label}`} className="font-bold text-sm">{label}.</Label>
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder={`Option ${label}...`}
                    value={options[i]?.text || ''}
                    onChange={e => updateOption(i, 'text', e.target.value)}
                  />
                  {options[i]?.image_url ? (
                    <div className="relative inline-block">
                      <img src={options[i].image_url} alt={`Option ${label}`} className="max-w-[200px] h-auto rounded border" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => removeOptionImage(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => fileRefs.current[i]?.click()}
                      >
                        <ImagePlus className="h-3 w-3 mr-1" /> Attach Image
                      </Button>
                      <input
                        ref={el => { fileRefs.current[i] = el; }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleOptionImage(i, f);
                          e.target.value = '';
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">Select the radio button next to the correct answer.</p>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Subject</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subtopic</Label>
              <Input value={subtopic} onChange={e => setSubtopic(e.target.value)} placeholder="e.g. Acute MI" />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explanation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Explanation</CardTitle></CardHeader>
        <CardContent>
          <RichTextEditor value={explanation} onChange={setExplanation} placeholder="Explain the correct answer..." minHeight="120px" />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {question ? 'Update Question' : 'Save Question'}
        </Button>
      </div>
    </div>
  );
}
