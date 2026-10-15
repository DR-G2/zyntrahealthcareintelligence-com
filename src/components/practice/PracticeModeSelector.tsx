import { useRef, type KeyboardEvent } from 'react';
import { Compass, Shield, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PracticePrimaryMode = 'drill' | 'nudge' | 'mock';

const MODES: { id: PracticePrimaryMode; title: string; line: string; icon: typeof Target; tag?: string }[] = [
  { id: 'drill', title: 'MCQ Drill', line: 'Question by question, with or without answer changes.', icon: Target },
  { id: 'nudge', title: 'Nudge', line: 'Practice aimed at one learning objective.', icon: Compass, tag: 'Not available yet' },
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
          <button
            key={m.id}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(m.id)}
            onKeyDown={e => onKey(e, i)}
            className={cn(
              'practice-mode-tile group relative min-w-0 rounded-2xl border p-5 text-left transition-colors motion-reduce:transition-none',
              active ? 'border-primary/70 bg-accent/40' : 'border-border/60 bg-card/50 hover:border-primary/40',
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', active ? 'border-primary/60 text-primary' : 'border-border/60 text-muted-foreground')}>
                <m.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-display text-base font-semibold text-foreground">{m.title}</span>
              {m.tag && <span className="ml-auto rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">{m.tag}</span>}
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{m.line}</p>
            {active && <span className="absolute inset-x-6 -bottom-px h-px bg-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
