import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, Brain, CalendarDays, ClipboardCheck, Compass, Network, Route, Target } from 'lucide-react';

export type RoomHeaderKind =
  | 'practice' | 'mcq' | 'osce' | 'flashcards' | 'intelligence'
  | 'performance' | 'behaviour' | 'trust' | 'study-plan' | 'current-plan' | 'generate-plan';

const CONFIG: Record<RoomHeaderKind, {
  icon: React.ElementType; eyebrow: string; title: string; subtitle: string; motif: 'nodes'|'grid'|'path'|'pulse'
}> = {
  practice: { icon: Brain, eyebrow:'Training room', title:'Practice', subtitle:'Train clinical reasoning with targeted AMC-style practice.', motif:'nodes' },
  mcq: { icon: Target, eyebrow:'Practice · MCQ', title:'MCQ', subtitle:'Question → decision → feedback.', motif:'grid' },
  osce: { icon: ClipboardCheck, eyebrow:'Practice · OSCE', title:'OSCE', subtitle:'Clinical assessment stations and structured reasoning.', motif:'path' },
  flashcards: { icon: Brain, eyebrow:'Practice · Flashcards', title:'Flashcards', subtitle:'Reinforce mistakes and weak areas with focused review.', motif:'nodes' },
  intelligence: { icon: Network, eyebrow:'Performance Intelligence', title:'Performance Intelligence', subtitle:'Understand how you think, decide and change answers.', motif:'nodes' },
  performance: { icon: Activity, eyebrow:'Performance', title:'Performance', subtitle:'See what your answers reveal about your preparation.', motif:'grid' },
  behaviour: { icon: Network, eyebrow:'Behaviour', title:'Behaviour', subtitle:'Understand timing, confidence and decision patterns.', motif:'pulse' },
  trust: { icon: Target, eyebrow:'Trust Your Gut', title:'Trust Your Gut', subtitle:'See whether changing your first answer helps or hurts.', motif:'path' },
  'study-plan': { icon: Route, eyebrow:'Study Plan', title:'Study Plan', subtitle:'Convert performance signals into your next training priorities.', motif:'path' },
  'current-plan': { icon: CalendarDays, eyebrow:'Current plan', title:'Current', subtitle:'Follow your active roadmap and priority areas.', motif:'path' },
  'generate-plan': { icon: Compass, eyebrow:'Generate New', title:'Generate New', subtitle:'Create a focused plan from your latest performance signals.', motif:'nodes' },
};

function Motif({ kind }: { kind: RoomHeaderKind }) {
  const { motif } = CONFIG[kind];
  return (
    <div aria-hidden className={cn(
      'pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden sm:block',
      motif === 'grid' ? 'opacity-45' : 'opacity-60'
    )}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_50%,hsl(var(--primary)/.18),transparent_64%)]" />
      {motif === 'grid' && (
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/.08)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(circle_at_70%_50%,black,transparent_72%)]" />
      )}
      {motif === 'nodes' && (
        <svg className="absolute right-0 top-1/2 h-40 w-64 -translate-y-1/2" viewBox="0 0 256 160" fill="none">
          <g stroke="hsl(var(--primary)/.18)" strokeWidth="1">
            <line x1="30" y1="35" x2="110" y2="60"/><line x1="30" y1="35" x2="88" y2="120"/>
            <line x1="30" y1="35" x2="175" y2="28"/><line x1="88" y1="120" x2="150" y2="92"/>
            <line x1="110" y1="60" x2="175" y2="28"/><line x1="110" y1="60" x2="210" y2="76"/>
            <line x1="150" y1="92" x2="210" y2="76"/><line x1="175" y1="28" x2="230" y2="45"/>
            <line x1="210" y1="76" x2="238" y2="118"/>
          </g>
          <g fill="hsl(var(--primary)/.52)">
            <circle cx="30" cy="35" r="2.5"/><circle cx="110" cy="60" r="2.5"/><circle cx="88" cy="120" r="2.5"/>
            <circle cx="175" cy="28" r="2.5"/><circle cx="150" cy="92" r="2.5"/><circle cx="210" cy="76" r="2.5"/>
            <circle cx="230" cy="45" r="2.5"/><circle cx="238" cy="118" r="2.5"/>
          </g>
        </svg>
      )}
      {motif === 'path' && (
        <svg className="absolute right-0 top-1/2 h-36 w-72 -translate-y-1/2" viewBox="0 0 288 144" fill="none">
          <path d="M12 108C48 108 48 36 92 36s42 72 86 72 42-72 98-72" stroke="hsl(var(--primary)/.28)" strokeWidth="2"/>
          <circle cx="12" cy="108" r="4" fill="hsl(var(--primary)/.6)"/><circle cx="92" cy="36" r="4" fill="hsl(var(--secondary)/.65)"/>
          <circle cx="178" cy="108" r="4" fill="hsl(var(--primary)/.6)"/><circle cx="276" cy="36" r="4" fill="hsl(var(--secondary)/.65)"/>
        </svg>
      )}
      {motif === 'pulse' && (
        <svg className="absolute right-0 top-1/2 h-32 w-72 -translate-y-1/2" viewBox="0 0 288 128" fill="none">
          <path d="M0 78h48l14-38 18 72 16-52 18 18h52l16-26 14 52 18-70 20 44h50" stroke="hsl(var(--primary)/.32)" strokeWidth="2"/>
        </svg>
      )}
    </div>
  );
}

export function RoomHeader({ kind, className }: { kind: RoomHeaderKind; className?: string }) {
  const c = CONFIG[kind];
  const Icon = c.icon;
  return (
    <section className={cn(
      'relative overflow-hidden rounded-2xl border border-border/70 bg-card/75 p-5 shadow-sm backdrop-blur-sm sm:p-6',
      className
    )}>
      <div className="relative z-10 max-w-[64%] sm:max-w-[58%]">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.14em] text-primary">
          <Icon className="h-3.5 w-3.5" />{c.eyebrow}
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{c.title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{c.subtitle}</p>
      </div>
      <Motif kind={kind} />
      <div className="absolute bottom-0 left-0 h-px w-1/3 bg-gradient-to-r from-primary/70 via-secondary/50 to-transparent" />
    </section>
  );
}
