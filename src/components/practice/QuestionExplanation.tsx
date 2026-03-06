import { motion } from 'framer-motion';
import { ChevronLeft, CheckCircle, XCircle, BookOpen, Stethoscope, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
}

interface QuestionExplanationProps {
  question: Question;
  userAnswer: string | undefined;
  questionIndex: number;
  onBack: () => void;
}

const bookReferences = [
  {
    title: 'AMC Handbook',
    icon: BookOpen,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    getContent: (category: string) =>
      `Key clinical points for ${category}: Focus on evidence-based guidelines, diagnostic criteria, and management algorithms as outlined in the AMC Handbook. Review the differential diagnosis framework and red-flag symptoms that require urgent referral.`,
  },
  {
    title: "John Murtagh's General Practice",
    icon: Stethoscope,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    getContent: (category: string) =>
      `Diagnostic approach for ${category}: Murtagh's framework emphasises probability diagnosis, serious disorders not to be missed, and pitfalls. Consider the masquerades checklist — depression, diabetes, drugs, anaemia, thyroid disease, spinal dysfunction, and UTI.`,
  },
  {
    title: "Tally O'Connor's Clinical Examination",
    icon: ClipboardList,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    getContent: (category: string) =>
      `Examination findings for ${category}: Systematic examination approach including inspection, palpation, percussion, and auscultation. Key signs to identify, their sensitivity and specificity, and how to differentiate between similar presentations.`,
  },
];

export function QuestionExplanation({ question, userAnswer, questionIndex, onBack }: QuestionExplanationProps) {
  const isCorrect = userAnswer === question.correct_answer;
  const options = question.options as string[];

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
