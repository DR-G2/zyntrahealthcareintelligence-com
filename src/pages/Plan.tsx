import React, { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  Target,
  ArrowUpRight,
  Layers,
  ShieldCheck,
} from "lucide-react";

interface FocusArea {
  id: string;
  priority: "High" | "Medium" | "Low";
  name: string;
  recommendedDaily: string;
  mastery: number;
}

const Plan: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"current" | "generate">("current");
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
    <div className="min-h-screen bg-[#040812] text-slate-100 font-sans p-6 sm:p-10 relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-10 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("current")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "current" ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Current Plan
            </button>
            <button
              onClick={() => setActiveTab("generate")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "generate" ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Generate New
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/10 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Active Subscription Tier</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
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
  );
};

export default Plan;
