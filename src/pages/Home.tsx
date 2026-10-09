import { useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { Activity, BookOpen, Brain, Eye, Gauge, RotateCcw, Shield, Stethoscope, Target, Users } from "lucide-react";
import { NeuralScene } from "@/components/home/NeuralScene";

const stages = [
  { n: "01", title: "Observe", body: "Captures your answers, timing, confidence and decision patterns.", icon: Eye },
  { n: "02", title: "Diagnose", body: "Identifies what’s holding you back using behavioural intelligence.", icon: Brain },
  { n: "03", title: "Intervene", body: "Recommends personalised practice to fix the right gaps.", icon: Target },
  { n: "04", title: "Measure", body: "Tracks how you improve with real evidence.", icon: Activity },
  { n: "05", title: "Adapt", body: "Updates your training path with the next best action.", icon: RotateCcw },
] as const;

const signals = [
  { label: "Clinical accuracy", value: "72%", className: "left-0 top-8" },
  { label: "Time management", value: "↑ 28%", className: "left-2 top-44" },
  { label: "Answer stability", value: "84%", className: "right-0 top-10" },
  { label: "Confidence calibration", value: "68%", className: "right-2 top-48" },
] as const;

export default function Home() {
  const reduce = useReducedMotion() ?? false;
  const [stage, setStage] = useState(0);

  return (
    <div data-zyntra-home="canonical" className="min-h-screen overflow-x-hidden bg-[#04101d] text-slate-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/3 top-0 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#04101d]/80 backdrop-blur-md">
        <div className="mx-auto flex h-[74px] max-w-[1280px] items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400 text-[#04101d]"><Brain className="h-5 w-5" /></span>
            <span><span className="block text-sm font-black tracking-[0.16em]">ZYNTRA</span><span className="block text-[9px] tracking-[0.18em] text-cyan-300">HEALTH INTELLIGENCE</span></span>
          </a>
          <nav className="hidden gap-6 text-sm text-slate-300 lg:flex">
            <a href="#top" className="text-white">Home</a>
            <a href="#why">Why Zyntra</a>
            <a href="#pie">PIE Intelligence</a>
            <a href="#practice">MCQ Practice</a>
            <a href="#lab">AI Lab</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="flex gap-2">
            <Link to="/login" className="rounded-xl border border-white/15 px-4 py-2 text-sm">Sign In</Link>
            <Link to="/login" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Get Started →</Link>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto max-w-[1280px] px-5 pb-16 pt-8">
        <section className="grid items-center gap-6 lg:grid-cols-[0.82fr_1.2fr_0.88fr]">
          <div>
            <p className="text-[11px] tracking-[0.22em] text-slate-400">INTELLIGENCE FOR THE AMC JOURNEY</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">From Questions<br />to <span className="text-cyan-300">Readiness.</span></h1>
            <p className="mt-5 max-w-md leading-7 text-slate-300">Zyntra doesn’t just test what you know. It understands <span className="font-semibold text-white">how you think</span>, trains your weaknesses and builds your clinical readiness.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">Get Started →</Link>
              <a href="#system" className="rounded-xl border border-white/15 px-5 py-3 text-sm">Explore the System</a>
            </div>
          </div>

          <div className="relative h-[640px]">
            <div className="absolute inset-0">
              <NeuralScene active={stage} reduce={reduce} />
            </div>
            {signals.map((signal) => (
              <div key={signal.label} className={`pointer-events-none absolute hidden w-40 rounded-2xl border border-cyan-300/30 bg-[#071525]/75 p-3 backdrop-blur md:block ${signal.className}`}>
                <p className="text-[10px] tracking-[0.14em] text-cyan-200">{signal.label.toUpperCase()}</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-300">{signal.value}</p>
              </div>
            ))}
            <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/50 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold tracking-[0.16em] text-cyan-100">NEXT BEST ACTION →</div>
          </div>

          <div className="space-y-3">
            {stages.map((item, index) => {
              const Icon = item.icon;
              const on = stage === index;
              return (
                <button key={item.title} type="button" onMouseEnter={() => setStage(index)} onFocus={() => setStage(index)} onClick={() => setStage(index)} className={`w-full rounded-2xl border p-3 text-left transition ${on ? "border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.15)]" : "border-white/10 bg-white/[0.03]"}`}>
                  <div className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-cyan-300" /><span className="text-cyan-300">{item.n}</span><span className="font-semibold">{item.title.toUpperCase()}</span></div>
                  <p className="mt-1 text-sm text-slate-400">{item.body}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section id="system" className="mt-4 grid gap-4 md:grid-cols-4">
          <article id="pie" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><BookOpen className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 font-semibold">PIE Intelligence</h2><p className="mt-2 text-sm text-slate-400">Performance. Behaviour. Confidence. Evidence.</p><Link to="/intelligence" className="mt-4 inline-block text-sm text-cyan-300">Explore →</Link></article>
          <article id="practice" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Stethoscope className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 font-semibold">AMC MCQ Practice</h2><p className="mt-2 text-sm text-slate-400">Exam-focused questions with adaptive training.</p><Link to="/amc-part-1-mcq" className="mt-4 inline-block text-sm text-cyan-300">Start Practicing →</Link></article>
          <article id="lab" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Brain className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 font-semibold">AI Simulation Lab</h2><p className="mt-2 text-sm text-slate-400">Supported AI learning workflows.</p><Link to="/practice/ai-lab" className="mt-4 inline-block text-sm text-cyan-300">Try AI Lab →</Link></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><Gauge className="h-5 w-5 text-cyan-300" /><h2 className="mt-3 font-semibold">Personalised Learning</h2><p className="mt-2 text-sm text-slate-400">Targeted. Adaptive. Measurable.</p><a href="#why" className="mt-4 inline-block text-sm text-cyan-300">See How It Works →</a></article>
        </section>

        <section id="why" className="mt-8 grid gap-4 border-t border-white/5 pt-6 sm:grid-cols-4">
          <div><Users className="h-5 w-5 text-cyan-300" /><p className="mt-2 font-semibold">AMC-style questions</p><p className="text-sm text-slate-400">Practice built around the exam journey.</p></div>
          <div><Activity className="h-5 w-5 text-cyan-300" /><p className="mt-2 font-semibold">Intelligence-Driven</p><p className="text-sm text-slate-400">Training engine. Not just a question bank.</p></div>
          <div><Target className="h-5 w-5 text-cyan-300" /><p className="mt-2 font-semibold">Built for IMGs</p><p className="text-sm text-slate-400">Focused on the AMC journey.</p></div>
          <div><Shield className="h-5 w-5 text-cyan-300" /><p className="mt-2 font-semibold">Evidence-Based</p><p className="text-sm text-slate-400">Learn smarter. Train with purpose.</p></div>
        </section>
        <section id="pricing" className="mt-8 text-sm text-slate-400">Free $0. Clinical Starter $39/month or $100 for 3 months. Exam Master is not open.</section>
      </main>
    </div>
  );
}
