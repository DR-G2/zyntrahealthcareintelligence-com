import { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface OnboardingTooltipProps {
  id: string;
  title: string;
  description: string;
  className?: string;
}

const STORAGE_PREFIX = 'onboarding_dismissed_';

export function OnboardingTooltip({ id, title, description, className }: OnboardingTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [id]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, 'true');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'relative rounded-lg border bg-primary/5 border-primary/20 px-4 py-3 pr-10',
            className,
          )}
        >
          <button
            onClick={dismiss}
            className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
