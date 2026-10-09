import { useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { Brain, ChevronRight, Eye } from "lucide-react";
import { NeuralScene } from "@/components/home/NeuralScene";

const stages = [
  { n: "01", title: "Observe", body: "Capture available answers, timing, confidence and answer changes." },
  { n: "02", title: "Diagnose", body: "Find patterns and potential learning gaps in the evidence." },
  { n: "03", title: "Intervene", body: "Focus practice on a relevant, supported learning need." },
  { n: "04", title: "Measure", body: "Review later attempts and the evidence they add." },
  { n: "05", title: "Adapt", body: "Use supported signals to guide the next training action." },
] as const;

export default function Home() {
  const reduce = useReducedMotion() ?? false;
  const [stage, setStage] = useState(0);
  const [activeSignal, setActiveSignal] = useState<"accuracy" | "timing" | "confidence" | "changes">("accuracy");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerChanges, setAnswerChanges] = useState(0);

  const chooseAnswer = (answer: string) => {
    if (answerSubmitted) return;
    if (selectedAnswer && selectedAnswer !== answer) setAnswerChanges((count) => count + 1);
    setSelectedAnswer(answer);
    setActiveSignal("changes");
  };

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
        <section className="relative grid items-center gap-3 lg:min-h-[640px] lg:grid-cols-[0.82fr_1.18fr]">
          <div className="relative z-10 order-2 py-6 lg:order-1 lg:py-0">
            <p className="text-[10px] font-medium tracking-[0.24em] text-cyan-100/75 sm:text-xs">NOT JUST A QUESTION BANK</p>
            <h1 className="mt-5 max-w-xl text-[clamp(2.8rem,5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.045em]">Practise the answer.<br /><span className="text-cyan-300">Understand the thinker.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">Zyntra helps AMC candidates practise clinical questions, understand patterns in their decisions, and focus on what to improve next.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-6 py-3.5 text-sm font-bold text-[#04101d] shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-200">Get Started <span aria-hidden="true">→</span></Link>
              <Link to="/check" className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-white/[0.025] px-6 py-3.5 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/80 hover:bg-cyan-400/10"><Eye className="h-4 w-4" /> Live Demo</Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">Practice is the input. Evidence guides what comes next.</p>
          </div>

          <div className="relative order-1 mx-auto h-[min(76vh,680px)] min-h-[460px] w-full max-w-[760px] sm:h-[560px] lg:order-2 lg:h-[650px]">
            <div className="pointer-events-none absolute inset-8 rounded-full bg-cyan-500/[0.07] blur-3xl" />
            <NeuralScene active={stage} reduce={reduce} activeSignal={activeSignal} onSignalSelect={setActiveSignal} />
          </div>
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

        <section id="try-zyntra" className="mt-12 scroll-mt-24 rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#082034] to-[#06111e] p-5 sm:p-7 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div>
            <p className="text-[10px] tracking-[0.22em] text-cyan-300">TRY A SAMPLE QUESTION</p>
            <h2 className="mt-3 text-2xl font-semibold">See the difference for yourself.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Answer a short clinical vignette. Then see how correctness and decision behaviour add context to practice.</p>
            <p className="mt-5 text-sm leading-6 text-slate-200">A 68-year-old man presents with severe central chest pain. His ECG shows ST-segment elevation in leads II, III and aVF. His blood pressure is 82/54 mmHg, heart rate is 48/min, and his lungs are clear. What is the most appropriate immediate priority?</p>
            <div className="mt-4 space-y-2">
              {[
                { key: "A", label: "Give sublingual glyceryl trinitrate immediately." },
                { key: "B", label: "Activate emergency reperfusion pathways and urgently assess haemodynamic instability." },
                { key: "C", label: "Arrange an outpatient exercise stress test." },
                { key: "D", label: "Give a beta-blocker immediately." },
              ].map((option) => (
                <button key={option.key} type="button" disabled={answerSubmitted} onClick={() => chooseAnswer(option.key)} aria-pressed={selectedAnswer === option.key} className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-sm leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-default ${selectedAnswer === option.key ? "border-cyan-200 bg-cyan-300/10" : "border-white/10 bg-[#04101d]/50 hover:border-cyan-300/40"}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/5 text-xs font-semibold text-cyan-200">{option.key}</span><span>{option.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={!selectedAnswer || answerSubmitted} onClick={() => { setAnswerSubmitted(true); setActiveSignal("accuracy"); }} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-[#04101d] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">Check answer <ChevronRight className="ml-1 inline h-4 w-4" /></button>
              <button type="button" onClick={() => { setSelectedAnswer(null); setAnswerSubmitted(false); setAnswerChanges(0); setActiveSignal("accuracy"); }} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-300 transition hover:border-cyan-300/40">Reset</button>
            </div>
            {answerSubmitted && <div aria-live="polite" className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] p-4 text-sm leading-6"><p className={selectedAnswer === "B" ? "font-semibold text-emerald-300" : "font-semibold text-amber-200"}>{selectedAnswer === "B" ? "Correct. The best answer is B." : "Review the rationale. The best answer is B."}</p><p className="mt-2 text-slate-300">This suggests an acute inferior STEMI with haemodynamic instability and possible right ventricular involvement. Prioritise emergency reperfusion pathways and urgent assessment/resuscitation. Nitrates can worsen hypotension; beta-blockers may be inappropriate with significant bradycardia and hypotension. Follow current local emergency protocols and senior clinical direction.</p><p className="mt-2 text-xs text-slate-500">Educational sample only. Validate against current Australian guidance before production use.</p></div>}
          </div>
          <aside className="mt-6 rounded-2xl border border-white/10 bg-[#04101d]/70 p-5 lg:mt-0">
            <p className="text-[10px] tracking-[0.2em] text-cyan-300">WHAT ZYNTRA CAN LEARN</p>
            <h3 className="mt-2 text-lg font-semibold">One answer. More context.</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">Tap a signal to see why it matters. These are explanations, not personal scores.</p>
            <div className="mt-4 space-y-2">
              {[
                { key: "accuracy" as const, title: "Accuracy", copy: "Was the answer correct?", detail: "Correctness is the starting point. Repeated attempts help reveal which topics need more work." },
                { key: "timing" as const, title: "Timing", copy: "How long did you take?", detail: "Decision time can help reveal rushed or hesitant responses when interpreted with difficulty and correctness." },
                { key: "confidence" as const, title: "Confidence", copy: "How sure were you?", detail: "Confidence must be collected explicitly and compared with correctness across repeated attempts." },
                { key: "changes" as const, title: "Answer changes", copy: "Did you switch options?", detail: "Answer changes add context to reasoning. They are not automatically mistakes." },
              ].map((signal) => (
                <button key={signal.key} type="button" onMouseEnter={() => setActiveSignal(signal.key)} onFocus={() => setActiveSignal(signal.key)} onClick={() => setActiveSignal(signal.key)} aria-pressed={activeSignal === signal.key} className={`w-full rounded-xl border p-3 text-left transition ${activeSignal === signal.key ? "border-cyan-200/60 bg-cyan-300/[0.08]" : "border-white/10 hover:border-cyan-300/30"}`}>
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">{signal.title}<span className="text-cyan-200">{activeSignal === signal.key ? "⌁" : "＋"}</span></span><span className="mt-1 block text-xs text-slate-400">{signal.copy}</span>
                  {activeSignal === signal.key && <span className="mt-2 block text-xs leading-5 text-slate-300">{signal.detail}</span>}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">{answerSubmitted ? `Demo result: ${selectedAnswer === "B" ? "correct" : "incorrect"} · answer changes: ${answerChanges}. Confidence was not collected.` : "No answer data is saved. This interactive preview runs only in your browser session."}</p>
          </aside>
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
