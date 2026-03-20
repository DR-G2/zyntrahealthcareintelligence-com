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
  question?: any;
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
  const [customSubtopic, setCustomSubtopic] = useState('');
  const [difficulty, setDifficulty] = useState('moderate');
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<MCQOption[]>(
    OPTION_LABELS.map(() => ({ text: '' }))
  );

  // Subtopics from DB
  const [allSubtopics, setAllSubtopics] = useState<any[]>([]);
  const [filteredSubtopics, setFilteredSubtopics] = useState<any[]>([]);

  // Fetch all subtopics once
  useEffect(() => {
    supabase.functions.invoke('admin-manage-questions', {
      body: { action: 'manage_subtopic', subtopic_action: 'list' }
    }).then(({ data }) => {
      setAllSubtopics(data?.subtopics || []);
    });
  }, []);

  // Filter subtopics when category changes
  useEffect(() => {
    if (!category) {
      setFilteredSubtopics([]);
      return;
    }
    const matchedSubject = subjects.find(s => s.name === category);
    if (matchedSubject) {
      setFilteredSubtopics(allSubtopics.filter(st => st.subject_id === matchedSubject.id));
    } else {
      setFilteredSubtopics([]);
    }
  }, [category, allSubtopics, subjects]);

  // Populate for edit mode
  useEffect(() => {
    if (question) {
      setQuestionText(question.question_text || '');
      setCategory(question.category || '');
      setDifficulty(question.difficulty || 'moderate');
      setCorrectAnswer(question.correct_answer || 'A');
      setExplanation(question.explanation || '');

      // Set subtopic - check if it matches a known subtopic or is custom
      const existingSub = question.subtopic || '';
      setSubtopic(existingSub);
      setCustomSubtopic('');

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

  // When category changes and we're not in edit-init, reset subtopic
  const categoryRef = useRef(question?.category || '');
  useEffect(() => {
    if (categoryRef.current && categoryRef.current !== category) {
      setSubtopic('');
      setCustomSubtopic('');
    }
    categoryRef.current = category;
  }, [category]);

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

  const resolvedSubtopic = subtopic === '__other__' ? customSubtopic : subtopic;

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
        subtopic: resolvedSubtopic || null,
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
        const { error } = await supabase.functions.invoke('admin-manage-questions', {
          body: { action: 'update', question_id: question.id, question_data: questionData }
        });
        if (error) throw error;
        toast({ title: 'Question updated' });
      } else {
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

  // Check if the current subtopic value matches a known subtopic name
  const isKnownSubtopic = filteredSubtopics.some(st => st.name === subtopic);
  const selectValue = subtopic && !isKnownSubtopic && subtopic !== '__other__' && subtopic !== ''
    ? '__other__'
    : subtopic;

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
              {filteredSubtopics.length > 0 ? (
                <div className="space-y-2">
                  <Select value={selectValue} onValueChange={(v) => {
                    setSubtopic(v);
                    if (v !== '__other__') setCustomSubtopic('');
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select subtopic..." /></SelectTrigger>
                    <SelectContent>
                      {filteredSubtopics.map(st => (
                        <SelectItem key={st.id} value={st.name}>{st.name}</SelectItem>
                      ))}
                      <SelectItem value="__other__">Other…</SelectItem>
                    </SelectContent>
                  </Select>
                  {(selectValue === '__other__') && (
                    <Input
                      placeholder="Type custom subtopic..."
                      value={customSubtopic}
                      onChange={e => setCustomSubtopic(e.target.value)}
                    />
                  )}
                </div>
              ) : (
                <Input value={subtopic} onChange={e => setSubtopic(e.target.value)} placeholder="e.g. Acute MI" />
              )}
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
