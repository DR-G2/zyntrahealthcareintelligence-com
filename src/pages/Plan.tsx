import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Sparkles,
  RefreshCw,
  Target,
  ArrowUpRight,
  Layers,
} from "lucide-react";

interface FocusArea {
  id: string;
  priority: "High" | "Medium" | "Low";
  name: string;
  recommendedDaily: string;
  mastery: number;
}

const Plan: React.FC = () => {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const focusAreas: FocusArea[] = [
    { id: "1", priority: "High", name: "Microbiology & Immunology", recommendedDaily: "15q / day", mastery: 28 },
    { id: "2", priority: "High", name: "Adult Surgery & Emergency Care", recommendedDaily: "10q / day", mastery: 35 },
    { id: "3", priority: "Medium", name: "Paediatrics & Neonatology", recommendedDaily: "8q / day", mastery: 54 },
    { id: "4", priority: "Medium", name: "Obstetrics & Gynaecology", recommendedDaily: "8q / day", mastery: 62 },
    { id: "5", priority: "Low", name: "Medical Ethics & Medicolegal Practice", recommendedDaily: "5q / day", mastery: 84 },
  ];

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => setIsRegenerating(false), 1000);
  };

  return (
    <AppLayout>
      <div className="relative isolate overflow-visible">
        <div className="pointer-events-none absolute -left-24 top-6 hidden h-[calc(100%-3rem)] w-28 xl:block">
          <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent" />
          <div className="absolute left-1 top-10 h-40 w-24 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.025] shadow-[0_0_50px_rgba(34,211,238,0.06)] backdrop-blur-sm" />
          <div className="absolute left-3 top-16 space-y-3 opacity-70">
            {[38, 64, 47, 82, 55, 71].map((width, i) => <div key={i} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]" /><span className="h-px bg-cyan-300/30" style={{ width: width + "px" }} /></div>)}
          </div>
          <div className="absolute left-2 top-64 h-28 w-24 rounded-xl border border-indigo-400/10 bg-indigo-400/[0.025]" />
          <div className="absolute left-5 top-[17rem] h-20 w-20 rounded-full border border-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.06)]" />
          <div className="absolute left-5 top-[17.9rem] h-20 w-20 rounded-full border border-dashed border-cyan-400/10" />
        </div>
        <div className="pointer-events-none absolute -right-24 top-6 hidden h-[calc(100%-3rem)] w-28 xl:block">
          <div className="absolute inset-y-0 right-1/2 w-px bg-gradient-to-b from-transparent via-indigo-400/20 to-transparent" />
          <div className="absolute right-1 top-10 h-40 w-24 rounded-2xl border border-indigo-400/10 bg-indigo-400/[0.025] shadow-[0_0_50px_rgba(99,102,241,0.06)] backdrop-blur-sm" />
          <div className="absolute right-3 top-16 space-y-3 opacity-70">
            {[72, 44, 86, 58, 76, 49].map((width, i) => <div key={i} className="flex items-center justify-end gap-2"><span className="h-px bg-indigo-300/30" style={{ width: width + "px" }} /><span className="h-1 w-1 rounded-full bg-indigo-300 shadow-[0_0_8px_rgba(165,180,252,0.9)]" /></div>)}
          </div>
          <div className="absolute right-2 top-64 h-28 w-24 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.025]" />
          <div className="absolute right-5 top-[17rem] h-20 w-20 rounded-full border border-indigo-400/10 shadow-[0_0_30px_rgba(99,102,241,0.06)]" />
          <div className="absolute right-5 top-[17.9rem] h-20 w-20 rounded-full border border-dashed border-indigo-400/10" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              Study Plan
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Adaptive Study Plan
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Convert real-time performance telemetry into targeted daily training priorities.
            </p>
          </div>

          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#09152b] border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white text-sm font-semibold transition-all shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
            <span>{isRegenerating ? "Synthesizing..." : "Regenerate AI Plan"}</span>
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#09172f]/90 to-[#071120]/90 border border-cyan-500/30 backdrop-blur-xl shadow-xl shadow-cyan-950/40 flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex-shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">AI Diagnostic Synthesis</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Targeting low-baseline subtopics first yields the highest composite score progression. Focus deliberate practice on your flagged areas before advancing to comprehensive timed mocks.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-2xl bg-[#081224]/80 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Readiness Index</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[11px]">Active Phase</span>
            </div>
            <div className="py-4">
              <div className="text-4xl font-extrabold text-white">38.4%</div>
              <p className="text-xs text-slate-400 mt-1">Calibrated from recent MCQ & clinical signals</p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 w-[38.4%]" />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#081224]/80 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Observed Accuracy</span>
              <span className="text-emerald-400 font-mono text-[11px]">Optimal Trajectory</span>
            </div>
            <div className="py-4">
              <div className="text-4xl font-extrabold text-white">45.1%</div>
              <p className="text-xs text-slate-400 mt-1">Benchmark target: 65.0%+</p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-500 w-[45.1%]" />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#081224]/80 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Decision Stability</span>
              <span className="text-purple-400 font-mono text-[11px]">Consistent</span>
            </div>
            <div className="py-4">
              <div className="text-4xl font-extrabold text-white">95.8%</div>
              <p className="text-xs text-slate-400 mt-1">Low oscillation rate on confident stems</p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-purple-500 w-[95.8%]" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#081224]/80 border border-white/10 backdrop-blur-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Priority Focus Areas</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Ranked by score impact</span>
          </div>

          <div className="space-y-3">
            {focusAreas.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#050b18]/60 border border-white/5 hover:border-cyan-500/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono tracking-wider uppercase border ${
                    item.priority === "High"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : item.priority === "Medium"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  }`}>
                    {item.priority}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">{item.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target volume: <span className="font-mono text-slate-300">{item.recommendedDaily}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-28 hidden sm:block">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                      <span>Mastery</span>
                      <span>{item.mastery}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${item.mastery}%` }} />
                    </div>
                  </div>

                  <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-all">
                    <span>Train</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Plan;
