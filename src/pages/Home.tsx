import { useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { Brain } from "lucide-react";
import { NeuralScene } from "@/components/home/NeuralScene";

const stages = [
  { n: "01", title: "Observe", body: "Timing, confidence and answer changes are captured with the answer." },
  { n: "02", title: "Diagnose", body: "Patterns in those signals show where preparation is uneven." },
  { n: "03", title: "Intervene", body: "Practice is aimed at the gap the evidence supports." },
  { n: "04", title: "Measure", body: "Later attempts are compared with what was already recorded." },
  { n: "05", title: "Adapt", body: "The next action follows from the recorded signals." },
] as const;

const cards = [
  { title: "Clinical accuracy", body: "Whether the selected answer matches the keyed answer." },
  { title: "Answer stability", body: "How often the first choice is changed." },
  { title: "Time management", body: "How long the decision takes." },
  { title: "Confidence calibration", body: "Whether confidence moves with the result." },
] as const;

export default function Home() {
  const reduce = useReducedMotion() ?? false;
  const [stage, setStage] = useState(0);

  return (
    <div data-zyntra-home="canonical" className="min-h-screen overflow-x-hidden bg-[#04101d] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#04101d]/80 backdrop-blur-md">
        <div className="mx-auto flex h-[74px] max-w-[1180px] items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400 text-[#04101d]"><Brain className="h-5 w-5" /></span>
            <span><span className="block text-sm font-black tracking-[0.16em]">ZYNTRA</span><span className="block text-[9px] tracking-[0.18em] text-cyan-300">HEALTH INTELLIGENCE</span></span>
          </a>
          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <a href="#top" className="text-white">Home</a>
            <a href="#system">Why Zyntra</a>
            <Link to="/amc-part-1-mcq">MCQ Practice</Link>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="flex gap-2">
            <Link to="/login" className="rounded-xl border border-white/15 px-4 py-2 text-sm">Sign In</Link>
            <Link to="/login" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Get Started</Link>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1180px] px-5 pb-16 pt-8">
        <section className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[11px] tracking-[0.22em] text-slate-400">INTELLIGENCE FOR THE AMC JOURNEY</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">From Questions<br />to <span className="text-cyan-300">Readiness.</span></h1>
            <p className="mt-5 max-w-md leading-7 text-slate-300">Zyntra records the answer and the way it was reached, then uses timing, confidence and answer changes in practice.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login" className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">Get Started</Link>
              <Link to="/check" className="rounded-xl border border-cyan-300/50 px-5 py-3 text-sm font-semibold text-cyan-100">Live Demo</Link>
            </div>
          </div>
          <div className="relative h-[560px]">
            <NeuralScene active={stage} reduce={reduce} />
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.18em] text-cyan-200">NEXT BEST ACTION</p>
          </div>
        </section>

        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold text-cyan-200">{card.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{card.body}</p>
            </div>
          ))}
        </div>

        <section className="mt-8 grid gap-3 lg:grid-cols-5">
          {stages.map((item, index) => (
            <button key={item.title} type="button" onMouseEnter={() => setStage(index)} onFocus={() => setStage(index)} onClick={() => setStage(index)} className={`rounded-2xl border p-4 text-left ${stage === index ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10"}`}>
              <p className="text-xs text-cyan-300">{item.n} {item.title}</p>
              <p className="mt-2 text-sm text-slate-400">{item.body}</p>
            </button>
          ))}
        </section>

        <section id="system" className="mt-10 grid gap-4 border-t border-white/5 pt-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Why Zyntra</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">A conventional bank marks the option. Zyntra also keeps timing, confidence and answer changes with that option.</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-5">
            <h2 className="font-semibold">AMC MCQ Practice</h2>
            <p className="mt-2 text-sm text-slate-400">The public preparation page for the Part 1 MCQ track.</p>
            <Link to="/amc-part-1-mcq" className="mt-4 inline-block text-sm text-cyan-300">Open MCQ practice</Link>
          </div>
        </section>

        <section id="pricing" className="mt-8 rounded-2xl border border-white/10 p-5">
          <h2 className="text-lg font-semibold">Pricing</h2>
          <p className="mt-2 text-sm text-slate-400">Free $0. Clinical Starter $39/month or $100 for 3 months. Exam Master is not open.</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-cyan-300">Sign in to subscribe</Link>
        </section>
      </main>
    </div>
  );
}
