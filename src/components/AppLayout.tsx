import { ReactNode } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { StudyBuddy } from '@/components/StudyBuddy';
import { SecurityOverlay } from '@/components/SecurityOverlay';

interface QuestionContext {
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  diagnosis_explanation?: string | null;
  first_line_investigation?: string | null;
  best_treatment?: string | null;
}

interface AppLayoutProps {
  children: ReactNode;
  questionContext?: QuestionContext | null;
  onClearQuestionContext?: () => void;
}

export function AppLayout({ children, questionContext, onClearQuestionContext }: AppLayoutProps) {
  return (
    <SecurityOverlay>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 ml-64 p-6 lg:p-8">
          {children}
        </main>
        <StudyBuddy questionContext={questionContext} onClearContext={onClearQuestionContext} />
      </div>
    </SecurityOverlay>
  );
}
