import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Activity,
  ArrowUpRight,
  Layers,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";

interface FocusArea {
  id: string;
  priority: "High" | "Medium" | "Low";
  name: string;
  recommendedDaily: string;
  mastery: number;
}

const FOCUS_AREAS: FocusArea[] = [
  { id: "1", priority: "High", name: "Microbiology & Immunology", recommendedDaily: "15q / day", mastery: 28 },
  { id: "2", priority: "High", name: "Adult Surgery & Emergency Care", recommendedDaily: "10q / day", mastery: 35 },
  { id: "3", priority: "Medium", name: "Paediatrics & Neonatology", recommendedDaily: "8q / day", mastery: 54 },
  { id: "4", priority: "Medium", name: "Obstetrics & Gynaecology", recommendedDaily: "8q / day", mastery: 62 },
  { id: "5", priority: "Low", name: "Medical Ethics & Medicolegal Practice", recommendedDaily: "5q / day", mastery: 84 },
];

const priorityClasses: Record<FocusArea["priority"], string> = {
  High: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  Medium: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  Low: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

const Plan: React.FC = () => {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = () => {
    setIsRegenerating(true);
    window.setTimeout(() => setIsRegenerating(false), 1000);
  };

  return (
    <AppLayout>
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[#030914]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,.09),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,.07),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.035)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[19%] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.13),transparent_52%)]" />
          <div className="absolute left-0 top-24 h-px w-44 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
          <div className="absolute left-3 top-32 space-y-4 opacity-70">
            {[42, 76, 54, 88, 63, 34, 72].map((width, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.9)]" />
                <span className="h-px bg-cyan-300/40" style={{ width: width + "px" }} />
              </div>
            ))}
          </div>
          <div className="absolute left-7 top-[21rem] h-28 w-28 rounded-full border border-dashed border-cyan-300/15 shadow-[0_0_50px_rgba(34,211,238,.08)]" />
          <div className="absolute left-7 top-[21.8rem] h-28 w-28 rounded-full border border-cyan-300/10" />
          <Activity className="absolute left-[4.6rem] top-[22.75rem] h-4 w-4 text-cyan-300/50" />
          <div className="absolute bottom-24 left-0 h-24 w-36 rounded-r-2xl border border-l-0 border-cyan-300/10 bg-cyan-300/[0.02] p-3">
            <div className="h-full rounded-xl border border-white/5 bg-[repeating-linear-gradient(0deg,transparent,transparent_7px,rgba(148,163,184,.06)_8px)]" />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[19%] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_24%,rgba(99,102,241,.13),transparent_52%)]" />
          <div className="absolute right-0 top-24 h-px w-44 bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />
          <div className="absolute right-3 top-32 space-y-4 opacity-70">
            {[70, 48, 86, 58, 78, 40, 66].map((width, index) => (
              <div key={index} className="flex items-center justify-end gap-2">
                <span className="h-px bg-indigo-300/40" style={{ width: width + "px" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-[0_0_10px_rgba(165,180,252,.9)]" />
              </div>
            ))}
          </div>
          <div className="absolute right-7 top-[21rem] h-28 w-28 rounded-full border border-dashed border-indigo-300/15 shadow-[0_0_50px_rgba(99,102,241,.08)]" />
          <div className="absolute right-7 top-[21.8rem] h-28 w-28 rounded-full border border-indigo-300/10" />
          <Activity className="absolute right-[4.6rem] top-[22.75rem] h-4 w-4 text-indigo-300/50" />
          <div className="absolute bottom-24 right-0 h-24 w-36 rounded-l-2xl border border-r-0 border-indigo-300/10 bg-indigo-300/[0.02] p-3">
            <div className="h-full rounded-xl border border-white/5 bg-[repeating-linear-gradient(0deg,transparent,transparent_7px,rgba(148,163,184,.06)_8px)]" />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
          <header className="flex flex-col gap-6 border-b border-white/[0.06] pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                <Layers className="h-3.5 w-3.5" />
                Study Plan
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Adaptive Study Plan
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  Convert real-time performance telemetry into targeted daily training priorities.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-5 text-sm font-semibold text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,.06)] transition hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={"h-4 w-4 " + (isRegenerating ? "animate-spin" : "")} />
              {isRegenerating ? "Synthesizing..." : "Regenerate AI Plan"}
            </button>
          </header>

          <div className="mt-7 rounded-2xl border border-cyan-300/15 bg-gradient-to-r from-cyan-400/[0.07] via-slate-950/40 to-indigo-400/[0.06] p-5 shadow-[0_0_50px_rgba(34,211,238,.05)]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI Diagnostic Synthesis</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Target low-baseline subtopics first, then progress toward comprehensive timed mocks as your signal stabilises.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { label: "Readiness Index", value: "38.4%", description: "Calibrated from recent MCQ & clinical signals", status: "Active Phase", gradient: "from-blue-500 to-cyan-400", width: "38.4%" },
              { label: "Observed Accuracy", value: "45.1%", description: "Benchmark target: 65.0%+", status: "Optimal Trajectory", gradient: "from-emerald-500 to-teal-300", width: "45.1%" },
              { label: "Decision Stability", value: "95.8%", description: "Low oscillation rate on confident stems", status: "Consistent", gradient: "from-violet-500 to-fuchsia-300", width: "95.8%" },
            ].map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-white/[0.07] bg-[#07111f]/90 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <span>{metric.label}</span>
                  <span className="normal-case tracking-normal text-cyan-300/80">{metric.status}</span>
                </div>
                <div className="mt-4 text-4xl font-extrabold tracking-tight text-white">{metric.value}</div>
                <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{metric.description}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800/80">
                  <div className={"h-full rounded-full bg-gradient-to-r " + metric.gradient} style={{ width: metric.width }} />
                </div>
              </article>
            ))}
          </div>

          <section className="mt-5 rounded-2xl border border-white/[0.07] bg-[#07111f]/90 p-5 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-cyan-300" />
                <h2 className="text-lg font-bold text-white">Priority Focus Areas</h2>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">Ranked by score impact</span>
            </div>

            <div className="mt-5 space-y-3">
              {FOCUS_AREAS.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-white/[0.05] bg-[#030914]/75 p-4 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.025]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={"shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] " + priorityClasses[item.priority]}>
                        {item.priority}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Target volume: <span className="font-mono text-slate-300">{item.recommendedDaily}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <div className="w-28">
                        <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-500">
                          <span>Mastery</span>
                          <span>{item.mastery}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300" style={{ width: item.mastery + "%" }} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-cyan-200"
                      >
                        Train
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppLayout>
  );
};

export default Plan;
