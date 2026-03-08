import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ClipboardCheck,
  Zap,
  Stethoscope,
  MessageCircle,
  Calendar,
  Users,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TOUR_STORAGE_KEY = 'welcome_tour_complete';

interface WelcomeTourProps {
  userName?: string;
  onComplete: () => void;
}

const steps = [
  {
    icon: Sparkles,
    title: 'Welcome to Zyntra',
    description:
      "Your intelligent AMC exam preparation platform. We'll guide you through the key features so you can make the most of your study time.",
    accent: 'primary',
  },
  {
    icon: ClipboardCheck,
    title: 'Diagnostic Assessment',
    description:
      'Start with a timed diagnostic test — both MCQ and OSCE — to benchmark your current level. This helps us identify your strengths and weak areas from day one.',
    accent: 'primary',
  },
  {
    icon: Zap,
    title: 'Practice Drills',
    description:
      'Sharpen your skills with targeted MCQ drills. Choose Recharge mode to revisit mistakes, or No Change mode for fresh questions. Filter by topic and difficulty.',
    accent: 'secondary',
  },
  {
    icon: Stethoscope,
    title: 'Clinical Stations (OSCE)',
    description:
      'Practice realistic clinical scenarios with an AI patient. Pick Single station for focused practice, Adaptive for personalised difficulty, or Exam mode for full timed circuits.',
    accent: 'primary',
  },
  {
    icon: MessageCircle,
    title: 'AI Study Companion',
    description:
      'Chat with your AI Study Buddy anytime. Ask for explanations, mnemonics, or study tips. It remembers your conversation history and supports rich formatting.',
    accent: 'secondary',
  },
  {
    icon: Calendar,
    title: 'Adaptive Study Plan',
    description:
      'Get an auto-generated study plan tailored to your exam date and weak areas. It adapts as you improve, keeping you on track every day.',
    accent: 'primary',
  },
  {
    icon: Users,
    title: 'Social & Shared Tests',
    description:
      'Create study groups, share test codes with friends, and compete on leaderboards. Studying together keeps motivation high.',
    accent: 'secondary',
  },
  {
    icon: Rocket,
    title: "You're All Set!",
    description:
      "You're ready to start your AMC journey. We recommend beginning with a Diagnostic Assessment to personalise your experience — or dive straight into Practice Drills.",
    accent: 'primary',
  },
];

export function WelcomeTour({ userName, onComplete }: WelcomeTourProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const step = steps[current];
  const Icon = step.icon;
  const isLast = current === steps.length - 1;
  const isFirst = current === 0;

  const finish = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    onComplete();
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    setDirection(1);
    setCurrent((c) => c + 1);
  };

  const prev = () => {
    setDirection(-1);
    setCurrent((c) => c - 1);
  };

  const title =
    current === 0 && userName
      ? `Welcome to Zyntra, ${userName}!`
      : step.title;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg mx-4 rounded-2xl border bg-card shadow-xl overflow-hidden"
      >
        {/* Skip button */}
        {!isLast && (
          <button
            onClick={finish}
            className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground transition-colors z-10"
          >
            Skip tour
          </button>
        )}

        <div className="px-8 pt-10 pb-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex flex-col items-center text-center"
            >
              {/* Icon */}
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-2xl mb-6',
                  step.accent === 'primary'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary/10 text-secondary'
                )}
              >
                <Icon className="h-8 w-8" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold font-display mb-3">{title}</h2>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: dots + buttons */}
        <div className="px-8 pb-8 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === current
                    ? 'w-6 bg-primary'
                    : i < current
                    ? 'w-1.5 bg-primary/40'
                    : 'w-1.5 bg-muted-foreground/20'
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={prev}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

WelcomeTour.STORAGE_KEY = TOUR_STORAGE_KEY;
