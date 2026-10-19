import { useRef, type KeyboardEvent } from 'react';
import { Compass, Shield, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type PracticePrimaryMode = 'drill' | 'nudge' | 'mock';

const MODES: { id: PracticePrimaryMode; title: string; line: string; icon: typeof Target; tag?: string }[] = [
  { id: 'drill', title: 'MCQ Drill', line: 'Question by question, with or without answer changes.', icon: Target },
  { id: 'nudge', title: 'Nudge', line: 'Target one evidence-backed learning gap and measure the follow-up.', icon: Compass },
  { id: 'mock', title: 'Full Mock Exam', line: 'Timed, locked answers, no going back.', icon: Shield },
];

/** Presentational three-way mode picker (radio group with arrow-key support). */
export function PracticeModeSelector({ value, onChange }: { value: PracticePrimaryMode; onChange: (mode: PracticePrimaryMode) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const n = (i + delta + MODES.length) % MODES.length;
    onChange(MODES[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Practice mode" className="grid gap-3 md:grid-cols-3">
      {MODES.map((m, i) => {
        const active = value === m.id;
        return (
          <Button variant="ghost"
            key={m.id}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(m.id)}
            onKeyDown={e => onKey(e, i)}
            className={cn(
              'practice-mode-tile group relative block h-auto min-w-0 whitespace-normal rounded-lg border p-4 text-left transition-colors motion-reduce:transition-none sm:p-5',
              active ? 'border-primary/70 bg-accent' : 'border-border/60 bg-secondary hover:border-primary/40',
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                <m.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-display text-base font-semibold text-foreground">{m.title}</span>
              {m.tag && <span className="text-xs text-muted-foreground">{m.tag}</span>}
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{m.line}</p>
            {active && <span className="absolute inset-x-6 -bottom-px h-px bg-primary" aria-hidden="true" />}
          </Button>
        );
      })}
    </div>
  );
}
