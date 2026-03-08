import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronDown, ChevronUp, CheckCircle, XCircle, BookOpen, Stethoscope, ClipboardList, FlaskConical, Pill, AlertCircle, Lightbulb, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DifferentialDiagnosis {
  diagnosis: string;
  reasoning: string;
  investigation: string;
  treatment: string;
}

interface IncorrectExplanation {
  why_wrong: string;
  when_correct: string;
}

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
  differential_diagnoses?: DifferentialDiagnosis[] | null;
  incorrect_answer_explanations?: Record<string, IncorrectExplanation> | null;
  key_takeaways?: string[] | null;
}

interface QuestionExplanationProps {
  question: Question;
  userAnswer: string | undefined;
  questionIndex: number;
  onBack: () => void;
  onAskStudyBuddy?: (question: Question) => void;
}

const bookReferences = [
  {
    title: 'AMC Handbook',
    icon: BookOpen,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    getContent: (category: string) =>
      `Key clinical points for ${category}: Focus on evidence-based guidelines, diagnostic criteria, and management algorithms as outlined in the AMC Handbook.`,
  },
  {
    title: "John Murtagh's General Practice",
    icon: Stethoscope,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    getContent: (category: string) =>
      `Diagnostic approach for ${category}: Murtagh's framework emphasises probability diagnosis, serious disorders not to be missed, and pitfalls.`,
  },
  {
    title: "Tally O'Connor's Clinical Examination",
    icon: ClipboardList,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    getContent: (category: string) =>
      `Examination findings for ${category}: Systematic examination approach including inspection, palpation, percussion, and auscultation.`,
  },
];

export function QuestionExplanation({ question, userAnswer, questionIndex, onBack }: QuestionExplanationProps) {
  const isCorrect = userAnswer === question.correct_answer;
  const options = question.options as string[];
  const [openDiffs, setOpenDiffs] = useState<Record<number, boolean>>({});
  const [openIncorrect, setOpenIncorrect] = useState(false);

  const hasDiagnosisData = question.diagnosis_explanation || question.first_line_investigation || question.best_treatment;
  const hasDifferentials = question.differential_diagnoses && question.differential_diagnoses.length > 0;
  const hasIncorrectExplanations = question.incorrect_answer_explanations && Object.keys(question.incorrect_answer_explanations).length > 0;
  const hasKeyTakeaways = question.key_takeaways && question.key_takeaways.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className="mx-auto max-w-3xl py-8 space-y-6"
    >
      <Button variant="ghost" onClick={onBack} className="gap-1 mb-2">
        <ChevronLeft className="h-4 w-4" /> Back to Results
      </Button>

      {/* Question header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-xs">{question.category}</Badge>
            <Badge className={cn(isCorrect ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
              {isCorrect ? <><CheckCircle className="h-3 w-3 mr-1" /> Correct</> : <><XCircle className="h-3 w-3 mr-1" /> Incorrect</>}
            </Badge>
          </div>
          <CardTitle className="text-lg font-normal leading-relaxed">
            Q{questionIndex + 1}. {question.question_text}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {options.map((opt, oi) => {
            const letter = String.fromCharCode(65 + oi);
            const isUserAnswer = userAnswer === letter;
            const isCorrectAnswer = question.correct_answer === letter;
            return (
              <div
                key={oi}
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  isCorrectAnswer && 'border-success bg-success/5',
                  isUserAnswer && !isCorrectAnswer && 'border-destructive bg-destructive/5',
                  !isUserAnswer && !isCorrectAnswer && 'border-border opacity-60'
                )}
              >
                <span className={cn(
                  'mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  isCorrectAnswer ? 'bg-success text-success-foreground' : isUserAnswer ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {letter}
                </span>
                {opt.replace(/^[A-E]\.\s*/, '')}
                {isCorrectAnswer && <CheckCircle className="inline h-4 w-4 ml-2 text-success" />}
                {isUserAnswer && !isCorrectAnswer && <XCircle className="inline h-4 w-4 ml-2 text-destructive" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Explanation */}
      {question.explanation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Explanation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
          </CardContent>
        </Card>
      )}

      {/* Diagnosis & Management */}
      {hasDiagnosisData && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Stethoscope className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-display">Diagnosis & Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {question.diagnosis_explanation && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Diagnosis</p>
                <p className="text-sm leading-relaxed">{question.diagnosis_explanation}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {question.first_line_investigation && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">1st Line Ix</p>
                  </div>
                  <p className="text-sm font-medium">{question.first_line_investigation}</p>
                </div>
              )}
              {question.gold_standard_investigation && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Gold Standard Ix</p>
                  </div>
                  <p className="text-sm font-medium">{question.gold_standard_investigation}</p>
                </div>
              )}
              {question.best_treatment && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Best Treatment</p>
                  </div>
                  <p className="text-sm font-medium">{question.best_treatment}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Differential Diagnoses */}
      {hasDifferentials && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display">Differential Diagnoses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {question.differential_diagnoses!.map((diff, i) => (
              <Collapsible key={i} open={openDiffs[i]} onOpenChange={(open) => setOpenDiffs(prev => ({ ...prev, [i]: open }))}>
                <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors">
                  <span className="font-medium">{diff.diagnosis}</span>
                  {openDiffs[i] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <p><strong>Reasoning:</strong> {diff.reasoning}</p>
                    <p><strong>Investigation:</strong> {diff.investigation}</p>
                    <p><strong>Treatment:</strong> {diff.treatment}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Incorrect Answer Analysis */}
      {hasIncorrectExplanations && (
        <Collapsible open={openIncorrect} onOpenChange={setOpenIncorrect}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </div>
                  <CardTitle className="text-sm font-display">Incorrect Answer Analysis</CardTitle>
                </div>
                {openIncorrect ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                {Object.entries(question.incorrect_answer_explanations!).map(([letter, exp]) => {
                  if (letter === question.correct_answer) return null;
                  return (
                    <div key={letter} className="rounded-lg border p-3 text-sm space-y-1">
                      <p className="font-medium">Option {letter}</p>
                      <p className="text-muted-foreground"><strong>Why wrong:</strong> {exp.why_wrong}</p>
                      <p className="text-muted-foreground"><strong>When correct:</strong> {exp.when_correct}</p>
                    </div>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Key Takeaways */}
      {hasKeyTakeaways && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <Lightbulb className="h-4 w-4 text-amber-400" />
              </div>
              <CardTitle className="text-sm font-display">Key Takeaways</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {question.key_takeaways!.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Textbook references */}
      {bookReferences.map((book) => (
        <Card key={book.title} className={cn('border', book.borderColor)}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', book.bgColor)}>
                <book.icon className={cn('h-4 w-4', book.color)} />
              </div>
              <CardTitle className="text-sm font-display">{book.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {book.getContent(question.category)}
            </p>
          </CardContent>
        </Card>
      ))}
    </motion.div>
  );
}
