import { ReactNode, useState } from 'react';
import { AppSidebar, SidebarContext, useSidebarCollapsed } from '@/components/AppSidebar';
import { StudyBuddy } from '@/components/StudyBuddy';
import { SecurityOverlay } from '@/components/SecurityOverlay';
import { cn } from '@/lib/utils';
import { LegalFooter } from '@/components/LegalFooter';

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

function LayoutInner({ children, questionContext, onClearQuestionContext }: AppLayoutProps) {
  const { collapsed } = useSidebarCollapsed();
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className={cn('flex-1 flex flex-col min-h-screen p-6 lg:p-8 transition-all duration-300', collapsed ? 'ml-16' : 'ml-64')}>
        <div className="flex-1">{children}</div>
        <LegalFooter />
      </main>
      <StudyBuddy questionContext={questionContext} onClearContext={onClearQuestionContext} />
    </div>
  );
}

export function AppLayout({ children, questionContext, onClearQuestionContext }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SecurityOverlay>
      <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
        <LayoutInner questionContext={questionContext} onClearQuestionContext={onClearQuestionContext}>
          {children}
        </LayoutInner>
      </SidebarContext.Provider>
    </SecurityOverlay>
  );
}
