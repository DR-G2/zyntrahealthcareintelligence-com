import { useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { Activity, Brain, ChevronRight, CircleHelp, Eye, FlaskConical, Target, Timer, Waves } from "lucide-react";
import { NeuralScene } from "@/components/home/NeuralScene";

const stages = [
  { n: "01", title: "Observe", body: "Capture available answers, timing, confidence and answer changes." },
  { n: "02", title: "Diagnose", body: "Find patterns and potential learning gaps in the evidence." },
  { n: "03", title: "Intervene", body: "Focus practice on a relevant, supported learning need." },
  { n: "04", title: "Measure", body: "Review later attempts and the evidence they add." },
  { n: "05", title: "Adapt", body: "Use supported signals to guide the next training action." },
] as const;

const signals = [
  { title: "Clinical accuracy", body: "Whether your selected answer matches the keyed answer.", icon: Target },
  { title: "Answer stability", body: "How your choices change as you reason.", icon: Waves },
  { title: "Time management", body: "How long decisions take during practice.", icon: Timer },
  { title: "Confidence calibration", body: "How confidence aligns with results.", icon: Activity },
] as const;

export default function Home() {
  const reduce = useReducedMotion() ?? false;
  const [stage, setStage] = useState(0);

  return (
    <div data-zyntra-home="canonical" className="min-h-screen overflow-x-hidden bg-[#04101d] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#04101d]/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[74px] max-w-[1320px] items-center justify-between gap-4 px-5 lg:px-8">
          <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="Zyntra Health Intelligence home">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-300"><Brain className="h-6 w-6" /></span>
            <span><span className="block text-sm font-black tracking-[0.16em]">ZYNTRA</span><span className="block text-[9px] tracking-[0.18em] text-cyan-300">HEALTH INTELLIGENCE</span></span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#top" className="text-cyan-200">Home</a>
            <a href="#why-zyntra" className="transition hover:text-cyan-200">Why Zyntra</a>
            <Link to="/practice" className="transition hover:text-cyan-200">MCQ Practice</Link>
            <a href="#pricing" className="transition hover:text-cyan-200">Pricing</a>
          </nav>
          <div className="flex shrink-0 gap-2">
            <Link to="/login" className="rounded-xl border border-white/15 px-3 py-2.5 text-sm transition hover:border-cyan-300/50 sm:px-4">Sign In</Link>
            <Link to="/login" className="rounded-xl bg-cyan-300 px-3 py-2.5 text-sm font-semibold text-[#04101d] shadow-lg shadow-cyan-500/15 transition hover:bg-cyan-200 sm:px-5">Get Started <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1440px] px-5 pb-16 pt-7 lg:px-8 lg:pt-10">
        <section className="relative grid items-center gap-3 lg:min-h-[560px] lg:grid-cols-[0.82fr_1.18fr]">
          <div className="relative z-10 py-6 lg:py-0">
            <p className="text-[10px] font-medium tracking-[0.24em] text-cyan-100/75 sm:text-xs">INTELLIGENCE FOR THE AMC JOURNEY</p>
            <h1 className="mt-5 max-w-xl text-[clamp(2.8rem,5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.045em]">From Questions<br />to <span className="text-cyan-300">Readiness.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">Zyntra records your answers and how you reach them, using timing, confidence and answer changes during practice to help guide your learning.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-6 py-3.5 text-sm font-bold text-[#04101d] shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-200">Get Started <span aria-hidden="true">→</span></Link>
              <Link to="/check" className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-white/[0.025] px-6 py-3.5 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/80 hover:bg-cyan-400/10"><Eye className="h-4 w-4" /> Live Demo</Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">Practice is the input. Evidence guides what comes next.</p>
          </div>

          <div className="relative mx-auto h-[400px] w-full max-w-[760px] sm:h-[500px] lg:h-[590px]">
            <div className="pointer-events-none absolute inset-8 rounded-full bg-cyan-500/[0.07] blur-3xl" />
            <div className="absolute left-0 top-[13%] z-10 hidden w-36 rounded-xl border border-cyan-300/25 bg-[#061827]/85 p-3 shadow-lg shadow-cyan-950/30 backdrop-blur-md sm:block lg:left-2">
              <p className="text-[10px] uppercase tracking-wide text-cyan-100/75">Clinical accuracy</p>
              <Activity className="mt-2 h-5 w-5 text-cyan-300" />
              <p className="mt-1 text-xs text-slate-400">Answer correctness</p>
            </div>
            <div className="absolute right-0 top-[13%] z-10 hidden w-36 rounded-xl border border-cyan-300/25 bg-[#061827]/85 p-3 shadow-lg shadow-cyan-950/30 backdrop-blur-md sm:block lg:right-2">
              <p className="text-[10px] uppercase tracking-wide text-cyan-100/75">Answer stability</p>
              <Waves className="mt-2 h-5 w-5 text-cyan-300" />
              <p className="mt-1 text-xs text-slate-400">Choice changes</p>
            </div>
            <div className="absolute bottom-[28%] left-0 z-10 hidden w-36 rounded-xl border border-cyan-300/25 bg-[#061827]/85 p-3 shadow-lg shadow-cyan-950/30 backdrop-blur-md sm:block lg:left-1">
              <p className="text-[10px] uppercase tracking-wide text-cyan-100/75">Time management</p>
              <Timer className="mt-2 h-5 w-5 text-cyan-300" />
              <p className="mt-1 text-xs text-slate-400">Decision timing</p>
            </div>
            <div className="absolute bottom-[28%] right-0 z-10 hidden w-40 rounded-xl border border-cyan-300/25 bg-[#061827]/85 p-3 shadow-lg shadow-cyan-950/30 backdrop-blur-md sm:block lg:right-1">
              <p className="text-[10px] uppercase tracking-wide text-cyan-100/75">Confidence</p>
              <CircleHelp className="mt-2 h-5 w-5 text-cyan-300" />
              <p className="mt-1 text-xs text-slate-400">Confidence calibration</p>
            </div>
            <NeuralScene active={stage} reduce={reduce} />
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-300/40 bg-[#04101d]/90 px-5 py-2.5 text-xs font-semibold tracking-[0.12em] text-cyan-200 shadow-lg shadow-cyan-500/10 sm:bottom-2">NEXT BEST ACTION <span aria-hidden="true">→</span></div>
          </div>
        </section>

        <section aria-label="Signals Zyntra can analyse" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {signals.map(({ title, body, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-[#071725]/75 p-4 backdrop-blur transition hover:border-cyan-300/30 hover:bg-[#092033]">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07]"><Icon className="h-4 w-4 text-cyan-200" /></span><h2 className="text-sm font-semibold">{title}</h2></div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="pie-loop-heading" className="mt-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] tracking-[0.22em] text-cyan-300">PERFORMANCE INTELLIGENCE ENGINE</p><h2 id="pie-loop-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">From signal to next step.</h2></div>
            <Link to="/intelligence" className="text-sm font-medium text-cyan-200 transition hover:text-white">Explore PIE <ChevronRight className="inline h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stages.map((item, index) => (
              <button key={item.title} type="button" onMouseEnter={() => setStage(index)} onFocus={() => setStage(index)} onClick={() => setStage(index)} aria-pressed={stage === index} className={`rounded-2xl border p-4 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${stage === index ? "border-cyan-300/60 bg-cyan-400/10 shadow-lg shadow-cyan-950/30" : "border-white/10 bg-white/[0.02] hover:border-cyan-300/30"}`}>
                <p className="text-xs font-semibold tracking-wide text-cyan-200">{item.n} <span className="ml-1 text-slate-100">{item.title}</span></p>
                <p className="mt-3 text-sm leading-6 text-slate-400">{item.body}</p>
              </button>
            ))}
          </div>
        </section>

        <section id="why-zyntra" className="mt-14 scroll-mt-24 border-t border-white/10 pt-10">
          <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div><p className="text-[10px] tracking-[0.22em] text-cyan-300">WHY ZYNTRA</p><h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">A question bank shows the answer.<br /><span className="text-cyan-300">Zyntra looks at the process.</span></h2></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><h3 className="font-semibold">More than right or wrong</h3><p className="mt-2 text-sm leading-6 text-slate-400">Review correctness alongside the learning signals actually recorded.</p></article>
              <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><h3 className="font-semibold">Understand your patterns</h3><p className="mt-2 text-sm leading-6 text-slate-400">Timing, confidence and answer changes add context to practice.</p></article>
              <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><h3 className="font-semibold">Focus the next session</h3><p className="mt-2 text-sm leading-6 text-slate-400">Use supported insights to choose a more focused next step.</p></article>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-5 rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#082034] to-[#06111e] p-5 sm:p-7 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div><p className="text-[10px] tracking-[0.22em] text-cyan-300">AMC PART 1</p><h2 className="mt-3 text-2xl font-semibold">Practice the question. Learn from the process.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Open the MCQ practice area to work through exam-style questions in the training environment.</p><Link to="/practice" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#04101d] transition hover:bg-cyan-200">Open MCQ practice <ChevronRight className="h-4 w-4" /></Link></div>
          <div className="rounded-2xl border border-white/10 bg-[#04101d]/70 p-5">
            <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-cyan-200">ILLUSTRATIVE MCQ PREVIEW</span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">Preview only</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-200">A patient presents with a clinical problem. Which is the most appropriate next step?</p>
            <div className="mt-4 space-y-2">{["A · Reassess the clinical findings", "B · Choose an investigation based on the presentation", "C · Review the patient's immediate stability"].map((option) => <div key={option} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">{option}</div>)}</div>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">Generic illustrative layout, not a scored or clinically validated question.</p>
          </div>
        </section>

        <section id="pricing" className="mt-14 scroll-mt-24 border-t border-white/10 pt-10">
          <div className="max-w-2xl"><p className="text-[10px] tracking-[0.22em] text-cyan-300">PRICING</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Start for A$1. Choose your plan.</h2><p className="mt-3 text-sm leading-6 text-slate-400">No free tier. Start with a A$1 introductory offer under the calendar-day rule: the subscription date is Day 1, and the selected plan renews at 12:01 AM India Standard Time when Day 7 begins.</p></div>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-cyan-300/30 bg-[#071b2a] p-6">
              <p className="text-xs font-semibold tracking-wide text-cyan-200">CLINICAL STARTER</p><h3 className="mt-2 text-xl font-semibold">Monthly</h3>
              <p className="mt-5"><span className="text-4xl font-semibold">A$39</span><span className="text-sm text-slate-400"> / month</span></p>
              <p className="mt-2 text-sm text-slate-400">A$1 introductory offer, then A$39 per month at the Day 7 renewal time.</p>
              <Link to="/login" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#04101d] transition hover:bg-cyan-200">Choose monthly <ChevronRight className="h-4 w-4" /></Link>
            </article>
            <article className="rounded-2xl border border-white/15 bg-white/[0.025] p-6">
              <p className="text-xs font-semibold tracking-wide text-cyan-200">CLINICAL STARTER</p><h3 className="mt-2 text-xl font-semibold">Three months</h3>
              <p className="mt-5"><span className="text-4xl font-semibold">A$99</span><span className="text-sm text-slate-400"> / 3 months</span></p>
              <p className="mt-2 text-sm text-slate-400">A$1 introductory offer, then A$99 per three-month billing period at the Day 7 renewal time.</p>
              <Link to="/login" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/40 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10">Choose three months <ChevronRight className="h-4 w-4" /></Link>
            </article>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Calendar-day timing uses Asia/Kolkata (IST) for every subscriber, regardless of physical location. Example: a start on 9 October at 11:00 PM IST counts 9 October as Day 1; 10 October at 12:01 AM is Day 2; renewal occurs on 15 October at 12:01 AM IST as Day 7 begins. Cancel before the displayed renewal time to avoid the plan charge. There is no free tier. Exam Master is not open yet. Subscription buttons continue to sign-in; payment processing and cancellation controls are not implemented by this homepage change.</p>
        </section>

        <footer className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Zyntra Health Intelligence</span>
          <div className="flex flex-wrap gap-4"><Link to="/intelligence" className="transition hover:text-cyan-200">PIE Intelligence</Link><Link to="/practice/ai-lab" className="transition hover:text-cyan-200">AI Lab</Link><Link to="/practice" className="transition hover:text-cyan-200">MCQ Practice</Link><a href="#pricing" className="transition hover:text-cyan-200">Pricing</a></div>
        </footer>
      </main>
    </div>
  );
}
