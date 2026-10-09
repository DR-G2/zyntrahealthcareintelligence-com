import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Brain,
  Eye,
  Gauge,
  RotateCcw,
  Shield,
  Stethoscope,
  Target,
  Timer,
  Users,
} from "lucide-react";

const stages = [
  { n: "01", title: "Observe", body: "Captures your answers, timing, confidence and decision patterns.", icon: Eye },
  { n: "02", title: "Diagnose", body: "Identifies what is holding you back using behavioural evidence.", icon: Brain },
  { n: "03", title: "Intervene", body: "Recommends a targeted practice action for the gap that is supported.", icon: Target },
  { n: "04", title: "Measure", body: "Compares later attempts with the evidence already collected.", icon: Activity },
  { n: "05", title: "Adapt", body: "Updates the next training action from verified outputs.", icon: RotateCcw },
] as const;

const signals = [
  { label: "Clinical accuracy", value: "72%", note: "Concept sample" },
  { label: "Answer stability", value: "84%", note: "Concept sample" },
  { label: "Time management", value: "↑ 28%", note: "Concept sample" },
  { label: "Confidence calibration", value: "68%", note: "Concept sample" },
] as const;

export default function Home() {
  const [stage, setStage] = useState(0);
  const active = stages[stage];

  return (
    <div data-zyntra-home="canonical" className="min-h-screen bg-[#050b18] text-slate-100 font-sans selection:bg-cyan-400 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/3 top-0 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-0 top-40 h-[420px] w-[420px] rounded-full bg-blue-700/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#050b18]/80 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-4 px-5">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-300/40">
              <Brain className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-black tracking-[0.18em]">ZYNTRA</span>
              <span className="block text-[9px] tracking-[0.22em] text-cyan-300/80">HEALTH INTELLIGENCE</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            <a className="text-white" href="#top">Home</a>
            <a className="hover:text-white" href="#why">Why Zyntra</a>
            <a className="hover:text-white" href="#pie">PIE Intelligence</a>
            <a className="hover:text-white" href="#practice">MCQ Practice</a>
            <a className="hover:text-white" href="#lab">AI Lab</a>
            <a className="hover:text-white" href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-cyan-300/40">Sign In</Link>
            <Link to="/login" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Get Started →</Link>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto max-w-[1240px] px-5 pb-16 pt-10">
        <section className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-slate-400">INTELLIGENCE FOR THE AMC JOURNEY</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
              From Questions<br />to <span className="text-cyan-300">Readiness.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
              Zyntra doesn’t just test what you know. It understands <span className="font-semibold text-white">how you think</span>, trains your weaknesses and builds your clinical readiness.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login" className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">Get Started →</Link>
              <a href="#system" className="rounded-xl border border-white/15 px-5 py-3 text-sm text-slate-200">Explore the System</a>
            </div>
            <figure className="mt-8 max-w-sm rounded-2xl border border-cyan-300/15 bg-white/[0.03] p-3 text-sm text-slate-300">
              <blockquote>“It feels like having a performance director for my AMC journey.”</blockquote>
              <figcaption className="mt-2 text-xs text-slate-500">Concept board sample. Not a verified candidate quote.</figcaption>
            </figure>
          </div>

          <div className="relative min-h-[560px]">
            <img src="/genjutsu/hero-board.png" alt="" className="absolute inset-0 h-full w-full rounded-[28px] object-cover object-[62%_42%] opacity-40" />
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-b from-[#050b18]/20 via-[#050b18]/35 to-[#050b18]" />
            <div className="relative flex h-full flex-col items-center justify-center">
              <div className="relative h-52 w-52">
                <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
                <Brain className="relative h-full w-full text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.7)]" strokeWidth={0.7} />
              </div>
              <div className="mt-2 h-40 w-44 rounded-b-[80px] border-x border-b border-cyan-300/40 bg-gradient-to-b from-cyan-300/20 to-transparent" />
              <div className="mt-3 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-cyan-200">NEXT BEST ACTION →</div>
              <div className="mt-6 grid w-full grid-cols-2 gap-3 px-4">
                {signals.map((signal) => (
                  <div key={signal.label} className="rounded-xl border border-cyan-300/20 bg-[#07111f]/80 p-3 backdrop-blur">
                    <p className="text-[10px] tracking-[0.16em] text-cyan-200/80">{signal.label.toUpperCase()}</p>
                    <p className="mt-1 text-2xl font-semibold text-cyan-300">{signal.value}</p>
                    <p className="text-[10px] text-slate-500">{signal.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3" role="tablist" aria-label="PIE stages">
            {stages.map((item, index) => {
              const Icon = item.icon;
              const on = stage === index;
              return (
                <button
                  key={item.title}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStage(index)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${on ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-white/[0.03] hover:border-cyan-300/30"}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-cyan-300" />
                    <span className="text-[11px] text-cyan-300">{item.n}</span>
                    <span className="font-semibold tracking-wide">{item.title.toUpperCase()}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
                </button>
              );
            })}
            <p className="px-1 text-xs text-slate-500">Selected: {active.title}. The funnel is a metaphor, not a clinical claim.</p>
          </div>
        </section>

        <section id="system" className="mt-8 grid gap-4 md:grid-cols-4">
          <article id="pie" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <BookOpen className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-4 font-semibold">PIE Intelligence</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Performance. Behaviour. Confidence. Evidence.</p>
            <Link to="/intelligence" className="mt-4 inline-block text-sm text-cyan-300">Explore →</Link>
          </article>
          <article id="practice" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Stethoscope className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-4 font-semibold">AMC MCQ Practice</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Exam-focused questions with timing, confidence and answer changes.</p>
            <Link to="/amc-part-1-mcq" className="mt-4 inline-block text-sm text-cyan-300">Start Practicing →</Link>
          </article>
          <article id="lab" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Brain className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-4 font-semibold">AI Simulation Lab</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Supported AI learning workflows. Unavailable tools stay labelled.</p>
            <Link to="/practice/ai-lab" className="mt-4 inline-block text-sm text-cyan-300">Try AI Lab →</Link>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Gauge className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-4 font-semibold">Personalised Learning</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Targeted. Adaptive. Measurable from verified signals.</p>
            <a href="#why" className="mt-4 inline-block text-sm text-cyan-300">See How It Works →</a>
          </article>
        </section>

        <section id="why" className="mt-10 grid gap-4 border-t border-white/5 pt-8 sm:grid-cols-4">
          <div>
            <Users className="h-5 w-5 text-cyan-300" />
            <p className="mt-3 text-2xl font-semibold">AMC-style</p>
            <p className="text-sm text-slate-400">Question practice. No public bank count is published.</p>
          </div>
          <div>
            <Activity className="h-5 w-5 text-cyan-300" />
            <p className="mt-3 text-lg font-semibold">Intelligence-Driven</p>
            <p className="text-sm text-slate-400">Training engine. Not just a question bank.</p>
          </div>
          <div>
            <Target className="h-5 w-5 text-cyan-300" />
            <p className="mt-3 text-lg font-semibold">Built for IMGs</p>
            <p className="text-sm text-slate-400">Focused on the AMC journey.</p>
          </div>
          <div>
            <Shield className="h-5 w-5 text-cyan-300" />
            <p className="mt-3 text-lg font-semibold">Evidence-Based</p>
            <p className="text-sm text-slate-400">Learn from observed signals. Train with purpose.</p>
          </div>
        </section>

        <section id="pricing" className="mt-10 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-2 text-cyan-300"><Timer className="h-4 w-4" /><p className="text-xs tracking-[0.18em]">PRICING FROM THE LIVE COMPONENT</p></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div><p className="text-sm text-slate-400">Free</p><p className="text-3xl font-semibold">$0</p><p className="text-sm text-slate-500">Diagnostic only, in the current pricing component.</p></div>
            <div><p className="text-sm text-slate-400">Clinical Starter</p><p className="text-3xl font-semibold">$39<span className="text-base text-slate-400">/month</span></p><p className="text-sm text-slate-500">or $100 for 3 months.</p></div>
            <div><p className="text-sm text-slate-400">Exam Master</p><p className="text-3xl font-semibold">Not open</p><p className="text-sm text-slate-500">Marked Building in the current pricing component.</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}
