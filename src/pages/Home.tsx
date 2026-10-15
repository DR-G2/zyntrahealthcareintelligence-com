import React from "react";
import { ArrowLeftRight, BarChart3, Brain, ChevronRight, Clock, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { NeuralHero } from "@/components/home/NeuralHero";
import { COPY_CARD_CHECK, COPY_CANCEL } from "@/lib/billing";

const signals = [
  { title: "Confidence", status: "Observed", icon: Brain, desc: "How sure you were, recorded with every answer." },
  { title: "Timing", status: "Measured", icon: Clock, desc: "How long each decision took under the clock." },
  { title: "Answer changes", status: "Tracked", icon: ArrowLeftRight, desc: "When you changed an answer, and whether it helped." },
  { title: "Consistency", status: "Analysed", icon: BarChart3, desc: "How performance holds across subjects and sessions." },
];

const loop = [
  ["Observe", "Timing, confidence and answer changes are captured as you practise."],
  ["Diagnose", "Patterns across those signals show what kind of mistake is recurring."],
  ["Intervene", "Training focuses on the area that needs work."],
  ["Measure", "Later practice shows whether the pattern changed."],
  ["Adapt", "Performance Intelligence and the Study Plan update the next step."],
] as const;

const why = [
  "A conventional question bank marks the option. Zyntra also keeps timing, confidence and answer changes.",
  "Those signals feed Performance Intelligence and the Study Plan, so preparation targets how you reach answers — not only what you got wrong.",
  "Built for medical students, medical graduates and doctors, including IMGs, preparing for AMC examinations.",
];

const trainingItems = [
  ["Practice · MCQ", "The live room. Questions, explanations, timing, confidence, answer changes and difficulty."],
  ["Surgery: OSCE", "OSCE · not live yet. Stations are not a current training mode."],
  ["Flashcards", "Targeted review built from mistakes and weak areas. Your review deck will build from your practice."],
  ["Performance", "What the candidate knows, and how that performance varies."],
  ["Behaviour", "Timing, hesitation, answer changes, consistency and confidence."],
  ["Trust Your Gut", "What happens when an initial answer is changed."],
  ["Study Plan", "Current plan, weak areas, practice priorities and exam timeline where a date is set."],
] as const;

const faqs = [
  ["What is Zyntra?", "Zyntra is an AI-powered AMC exam preparation platform. It records the answer and the way the answer was reached."],
  ["Who is it for?", "Medical students, medical graduates and doctors, including IMGs, preparing for AMC examinations."],
  ["Is Zyntra a question bank?", "MCQ practice is the live training room. The difference is that timing, confidence and answer changes are kept with the score."],
  ["How much does it cost?", "One plan, Full Access: A$39/month or A$99 for 3 months (AUD). Both include a 7-day free trial and you can cancel anytime."],
  ["What does Zyntra track?", "Accuracy, timing, confidence, answer changes, consistency and recurring mistakes, where those signals are collected."],
] as const;

const options = [
  "Oral amoxicillin and review in 48 hours",
  "Intravenous benzylpenicillin and urgent hospital transfer",
  "Lumbar puncture in the clinic before any antibiotic",
  "Paracetamol and safety-netting advice only",
  "Await blood culture results before treating",
];

const Kicker = ({ children }: { children: React.ReactNode }) => <p className="font-mono text-xs uppercase tracking-[.22em] gj-accent">{children}</p>;

const Home: React.FC = () => (
  <div data-zyntra-home="canonical" className="home-genjutsu relative min-h-screen font-sans">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md gj-button focus:px-4 focus:py-2">Skip to content</a>
    <div className="gj-backdrop pointer-events-none absolute inset-x-0 top-0 h-[60rem]" aria-hidden="true" />

    <header className="sticky top-0 z-20 border-b gj-rule backdrop-blur-md" style={{ background: "hsl(var(--gj-base) / .75)" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-20 sm:px-6">
        <a href="#top" className="flex items-center gap-3" aria-label="Zyntra home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl gj-panel"><span className="font-black italic text-xl gj-accent">Z</span></span>
          <span className="text-lg font-extrabold uppercase tracking-widest">Zyntra</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main">
          <Link to="/blog" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold gj-muted hover:text-foreground sm:inline-flex">Blog</Link>
          <Link to="/login" className="rounded-full px-5 py-2.5 text-sm font-semibold gj-button">Get Started</Link>
        </nav>
      </div>
    </header>

    <main id="main" className="relative z-10">
      <section id="top" className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-6 lg:pt-20">
        <div className="grid min-w-0 items-center gap-10 md:grid-cols-[1fr_45%] lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-7">
            <Kicker>AMC preparation intelligence</Kicker>
            <h1 className="gj-h1 font-bold">From Questions<br />to Readiness.</h1>
            <p className="max-w-xl text-base leading-relaxed gj-muted sm:text-lg">
              Zyntra is an AI-powered AMC exam preparation platform for international medical graduates. It learns how you approach questions — timing, confidence and answer changes — and turns those signals into your next best training action.
            </p>
            <p className="text-sm font-medium gj-muted">Your answer is one signal. Your decision process is the dataset.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold gj-button">Get Started <ChevronRight className="h-4 w-4" /></Link>
              <Link to="/amc-part-1-mcq" className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold gj-button-ghost">AMC MCQ preparation</Link>
            </div>
          </div>
          <div className="min-w-0 lg:col-span-5"><NeuralHero /></div>
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Signals Zyntra records">
          {signals.map(({ title, status, icon: Icon, desc }) => (
            <li key={title} className="min-w-0 rounded-2xl p-5 gj-panel">
              <div className="flex items-center gap-3"><Icon className="h-5 w-5 gj-accent" aria-hidden="true" /><span className="text-sm gj-muted">{title}</span></div>
              <p className="mt-3 text-lg font-semibold">{status}</p>
              <p className="mt-2 text-sm leading-6 gj-muted">{desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="how" className="border-t gj-rule py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <Kicker>The loop</Kicker>
          <h2 className="mt-3 text-3xl font-bold">How Zyntra works</h2>
          <ol className="relative mt-12 grid gap-8 md:grid-cols-5">
            <span className="gj-nerve absolute left-6 right-6 top-5 hidden h-px md:block" aria-hidden="true" />
            <span className="gj-nerve-v absolute bottom-4 left-5 top-4 w-px md:hidden" aria-hidden="true" />
            {loop.map(([title, desc], i) => (
              <li key={title} className="relative flex min-w-0 gap-4 md:block">
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-xs gj-panel gj-accent">{String(i + 1).padStart(2, "0")}</span>
                <div className="md:mt-5"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 gj-muted">{desc}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="about" className="border-t gj-rule py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-6 lg:grid-cols-2">
          <div className="min-w-0">
            <Kicker>Why Zyntra</Kicker>
            <h2 className="mt-3 text-3xl font-bold">Beyond the correct answer.</h2>
            <ul className="mt-8 space-y-5">{why.map(w => <li key={w} className="border-l-2 pl-4 leading-7 gj-muted" style={{ borderColor: "hsl(var(--gj-cyan) / .5)" }}>{w}</li>)}</ul>
            <p className="mt-6 text-xs gj-muted">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p>
          </div>
          <figure className="min-w-0 rounded-2xl p-5 gj-panel sm:p-6" aria-labelledby="mcq-caption">
            <figcaption id="mcq-caption" className="font-mono text-xs uppercase tracking-[.2em] gj-accent">Example question</figcaption>
            <p className="mt-4 text-sm leading-7">A 19-year-old presents to a rural general practice with fever, headache and a non-blanching petechial rash on the legs. She is alert, with a heart rate of 118 and blood pressure of 100/60 mmHg. What is the most appropriate immediate step?</p>
            <ol className="mt-4 space-y-2">{options.map((o, i) => <li key={o} className="flex gap-3 rounded-lg border gj-rule p-2.5 text-sm gj-muted"><span className="font-mono gj-accent">{String.fromCharCode(65 + i)}</span>{o}</li>)}</ol>
            <div className="mt-5 border-t gj-rule pt-4">
              <p className="text-xs font-semibold">What Zyntra records on this question</p>
              <p className="mt-2 text-xs leading-6 gj-muted">Your first and final answer · confidence level · time to decide · any answer changes · options you ruled out.</p>
            </div>
          </figure>
        </div>
      </section>

      <section id="trains" className="border-t gj-rule py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="mb-8 flex items-center gap-3"><Layers className="h-5 w-5 gj-accent" aria-hidden="true" /><h2 className="text-3xl font-bold">Training system</h2></div>
          <div className="divide-y gj-rule border-y">{trainingItems.map(([title, desc], i) => <article key={title} className="grid gap-2 py-5 md:grid-cols-[70px_230px_1fr] md:gap-4"><span className="font-mono text-xs gj-accent">{String(i + 1).padStart(2, "0")}</span><h3 className="font-semibold">{title}</h3><p className="text-sm leading-relaxed gj-muted">{desc}</p></article>)}</div>
        </div>
      </section>

      <section className="border-t gj-rule py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div><Kicker>Zyntra Intelligence Lab</Kicker><h2 className="mt-3 text-3xl font-bold">From the Intelligence Lab</h2><p className="mt-3 max-w-2xl text-sm leading-7 gj-muted">Practical writing on AMC preparation, clinical reasoning, study strategy and learning intelligence.</p></div>
            <Link to="/blog" className="hidden items-center gap-2 text-sm font-semibold gj-accent sm:inline-flex">Explore the Blog <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[["AMC MCQ Preparation: Train for the One-Way Exam", "/blog/amc-part-1-mcq"], ["AMC Clinical Exam Tips: Train for the 8-Minute Clock", "/blog/amc-part-2-osce"]].map(([title, to]) => (
              <Link key={to} to={to} className="block rounded-2xl p-6 gj-panel transition-colors hover:border-primary/40">
                <p className="font-mono text-[11px] uppercase tracking-[.15em] gj-accent">AMC</p>
                <h3 className="mt-4 text-lg font-semibold leading-snug">{title}</h3>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold gj-accent">Read article <ChevronRight className="h-3.5 w-3.5" /></span>
              </Link>
            ))}
          </div>
          <Link to="/blog" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold gj-accent sm:hidden">Explore the Blog <ChevronRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section id="pricing" className="border-t gj-rule py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6"><Kicker>Pricing</Kicker><h2 className="mt-3 text-3xl font-bold">Pricing</h2>
          <div className="mt-10 divide-y gj-rule border-y">
            <div className="grid gap-6 py-8 md:grid-cols-[280px_1fr] md:gap-8"><div><h3 className="font-bold">Free account</h3><div className="mt-2 text-4xl font-extrabold">A$0</div><p className="mt-2 text-xs gj-muted">Create an account</p></div><div><p className="text-sm leading-7 gj-muted">Create an account to access available Zyntra features and practice tools.</p><Link to="/login" className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm gj-button-ghost">Create account / Log in</Link></div></div>
            <div className="grid gap-6 py-8 md:grid-cols-[280px_1fr] md:gap-8"><div><h3 className="font-bold">Full Access</h3><div className="mt-2 text-4xl font-extrabold">A$39</div><p className="mt-2 text-xs gj-muted">AUD / month, or A$99 for 3 months</p></div><div><p className="text-sm leading-7 gj-muted">One plan with everything: MCQ practice, Performance Intelligence and Study Plan. 7-day free trial on both options, cancel anytime. A$1 card check at trial signup.</p><p className="mt-2 text-xs leading-6 gj-muted">{COPY_CARD_CHECK} {COPY_CANCEL}</p><Link to="/login" className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm gj-button-ghost">Start 7-day free trial</Link></div></div>
          </div>
        </div>
      </section>

      <section className="border-t gj-rule py-20">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Start training with evidence.</h2>
          <p className="mt-4 gj-muted">Sign in or create an account to continue to Zyntra.</p>
          <Link to="/login" className="mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold gj-button">Log in / Create account <ChevronRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section id="faq" className="border-t gj-rule py-20">
        <div className="mx-auto max-w-3xl px-5 sm:px-6"><h2 className="text-3xl font-bold">FAQ</h2><div className="mt-8 divide-y gj-rule border-y">{faqs.map(([q, a]) => <details key={q} className="py-5"><summary className="cursor-pointer list-none text-sm font-semibold">{q}<span className="float-right gj-accent" aria-hidden="true">+</span></summary><p className="mt-3 text-sm leading-7 gj-muted">{a}</p></details>)}</div></div>
      </section>
    </main>

    <footer className="relative z-10 border-t gj-rule py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-xs gj-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <span>Zyntra Healthcare Intelligence · Independent of the AMC.</span>
        <div className="flex gap-5"><Link to="/terms" className="hover:text-foreground">Terms</Link><Link to="/privacy" className="hover:text-foreground">Privacy</Link><a href="#faq" className="hover:text-foreground">FAQ</a></div>
      </div>
    </footer>
  </div>
);

export default Home;
