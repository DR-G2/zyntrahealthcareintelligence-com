import { useRef, type KeyboardEvent } from 'react';
import { Compass, Shield, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type PracticePrimaryMode = 'drill' | 'nudge' | 'mock';

/** Normal MCQ is the only launchable mode. Upcoming modes are deliberately non-interactive. */
export function PracticeModeSelector({ value, onChange }: { value: PracticePrimaryMode; onChange: (mode: PracticePrimaryMode) => void }) {
  const refs = useRef<HTMLButtonElement | null>(null);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    refs.current?.focus();
  };
  return (
    <section aria-label="Practice modes" className="space-y-3">
      <div className="rounded-xl border border-primary/35 bg-primary/[0.06] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Target className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg font-semibold text-foreground">Normal MCQ</h3><span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">Available now</span></div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Build clinical reasoning one question at a time. Choose your answer, record confidence, and review your results when the session ends.</p>
            </div>
          </div>
          <Button ref={refs} type="button" onClick={() => onChange('drill')} onKeyDown={onKey} aria-pressed={value === 'drill'} className="min-h-11 w-full shrink-0 sm:w-auto">Practice Normal MCQ <Target className="ml-2 h-4 w-4" aria-hidden="true" /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <article aria-disabled="true" className={cn('min-w-0 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 opacity-80')} aria-label="AMC Exam Mode. Under Construction · Live Soon. Unavailable.">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Shield className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-semibold text-foreground">AMC Exam Mode</h3><p className="mt-1 text-xs font-medium text-muted-foreground">Under Construction · Live Soon</p><p className="mt-2 text-sm leading-5 text-muted-foreground">Exam simulation is not available to start yet. Existing records remain preserved.</p></div></div>
        </article>
        <article aria-disabled="true" className="min-w-0 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 opacity-80" aria-label="Nudge. Under Construction · Live Soon. Unavailable.">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Compass className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-semibold text-foreground">Nudge</h3><p className="mt-1 text-xs font-medium text-muted-foreground">Under Construction · Live Soon</p><p className="mt-2 text-sm leading-5 text-muted-foreground">Targeted practice is not available to start yet. Existing records remain preserved.</p></div></div>
        </article>
      </div>
      <span className="sr-only" role="status">Normal MCQ is available. AMC Exam Mode and Nudge are under construction and unavailable.</span>
    </section>
  );
}
