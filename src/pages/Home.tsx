import React, { useState } from "react";
import {
  Brain, Clock, ArrowLeftRight, BarChart3, ChevronRight, FileText, Target,
  TrendingUp, Sparkles, CheckCircle2, Activity, Layers, X
} from "lucide-react";
import { Link } from "react-router-dom";

const metrics = [
  { title:"Confidence", status:"Observed", color:"from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400", accent:"#38bdf8", icon:Brain, bars:[40,60,50,75,90,80,100] },
  { title:"Timing", status:"Measured", color:"from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400", accent:"#c084fc", icon:Clock, bars:[30,45,80,60,95,70,85] },
  { title:"Answer changes", status:"Tracked", color:"from-rose-500/20 to-orange-500/10 border-rose-500/30 text-rose-400", accent:"#fb7185", icon:ArrowLeftRight, bars:[70,50,65,40,80,60,90] },
  { title:"Consistency", status:"Analysed", color:"from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400", accent:"#34d399", icon:BarChart3, bars:[50,65,55,85,70,95,100] },
];

const steps = [
  {num:"01",icon:FileText,title:"Practice.",desc:"Answer AMC-style questions.",accent:"border-cyan-500 text-cyan-400"},
  {num:"02",icon:Clock,title:"Observe.",desc:"Timing, confidence and answer changes are captured.",accent:"border-purple-500 text-purple-400"},
  {num:"03",icon:BarChart3,title:"Understand.",desc:"Patterns emerge across those signals.",accent:"border-teal-500 text-teal-400"},
  {num:"04",icon:Target,title:"Adapt.",desc:"Training focuses on what needs work.",accent:"border-rose-500 text-rose-400"},
  {num:"05",icon:TrendingUp,title:"Progress.",desc:"Performance Intelligence develops over time.",accent:"border-emerald-500 text-emerald-400"},
];

const trainingItems = [
  ["Practice · MCQ","The live room. Questions, explanations, timing, confidence, answer changes and difficulty."],
  ["Surgery: OSCE","OSCE · not live yet. Stations are not a current training mode."],
  ["Flashcards","Targeted review built from mistakes and weak areas. Your review deck will build from your practice."],
  ["Performance","What the candidate knows, and how that performance varies."],
  ["Behaviour","Timing, hesitation, answer changes, consistency and confidence."],
  ["Trust Your Gut","What happens when an initial answer is changed."],
  ["Study Plan","Current plan, weak areas, practice priorities and exam timeline where a date is set."],
] as const;

const faqs = [
  ["What is Zyntra?","Zyntra is an AI-powered AMC exam preparation platform. It records the answer and the way the answer was reached."],
  ["Who is it for?","Medical students, medical graduates and doctors, including IMGs, preparing for AMC examinations."],
  ["Is Zyntra a question bank?","MCQ practice is the live training room. The difference is that timing, confidence and answer changes are kept with the score."],
  ["What does Zyntra track?","Accuracy, timing, confidence, answer changes, consistency and recurring mistakes, where those signals are collected."],
] as const;

const Index: React.FC = () => {
  const [activeStep,setActiveStep]=useState(0);
  const [modalOpen,setModalOpen]=useState(false);
  const [activeMetric,setActiveMetric]=useState<number|null>(null);

  return (
    <div data-zyntra-home="canonical" className="min-h-screen bg-[#040812] text-slate-100 selection:bg-cyan-500 selection:text-white font-sans overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[140px]" />
      </div>

      <header className="relative z-20 border-b border-white/5 backdrop-blur-md bg-[#040812]/70 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-500 p-[1.5px] shadow-lg shadow-cyan-500/25">
              <div className="w-full h-full bg-[#070e1e] rounded-[10px] flex items-center justify-center group-hover:bg-[#09142b] transition-colors">
                <span className="font-black italic text-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">Z</span>
              </div>
            </div>
            <span className="text-xl font-extrabold tracking-widest text-white uppercase group-hover:text-cyan-400 transition-colors">Zyntra</span>
          </a>
          <div className="flex items-center gap-3">
            <Link to="/blog" className="hidden sm:inline-flex px-4 py-2.5 rounded-full text-sm font-semibold tracking-wide text-slate-300 hover:text-cyan-300 transition-colors">
              Blog
            </Link>
            <button onClick={()=>setModalOpen(true)} className="px-6 py-2.5 rounded-full text-sm font-semibold tracking-wide bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500 hover:to-blue-600 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-transparent transition-all duration-300 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/30 active:scale-95">
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-widest uppercase shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> What is Zyntra?
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-[1.18] tracking-tight">
                Zyntra is an AI-powered AMC exam preparation platform for medical students, medical graduates and doctors preparing for the Australian Medical Council examinations.
              </h1>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                Zyntra goes beyond whether an answer is right or wrong. It learns how you approach questions and uses those signals to make preparation more targeted.
              </p>
              <p className="text-sm font-medium text-slate-400 tracking-wide">Your answer is one signal. Your decision process is the dataset.</p>
              <button onClick={()=>setModalOpen(true)} className="inline-flex items-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-200 group">
                <span>Get Started</span><ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="lg:col-span-5 relative flex flex-col items-center">
              <div className="w-full relative min-h-[460px] flex items-center justify-center">
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 blur-2xl animate-pulse" />
                  <div className="absolute -inset-4 rounded-full border border-cyan-500/20 animate-spin [animation-duration:20s]" />
                  <div className="relative z-10 w-44 h-44 rounded-2xl bg-[#081226]/80 border border-cyan-500/40 backdrop-blur-xl flex flex-col items-center justify-center p-4 shadow-2xl shadow-cyan-500/20">
                    <div className="relative">
                      <Brain className="w-20 h-20 text-cyan-400 stroke-[1.2] drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]" />
                      <Activity className="w-6 h-6 text-cyan-300 absolute -bottom-1 -right-1 animate-bounce" />
                    </div>
                    <div className="mt-3 px-3 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono tracking-wider text-cyan-300 flex items-center gap-1.5 shadow-inner">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" /> NEURAL ENGINE
                    </div>
                  </div>
                </div>

                <div className="absolute right-0 top-2 bottom-6 flex flex-col justify-between py-2 w-52 sm:w-60 z-20 space-y-2 pointer-events-auto">
                  {metrics.map((item,idx)=>{
                    const Icon=item.icon;
                    return <div key={idx} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border backdrop-blur-md shadow-lg transition-transform hover:-translate-x-1 cursor-default ${item.color}`}>
                      <div className="flex items-center gap-2.5"><Icon className="w-4 h-4 flex-shrink-0"/><div className="text-xs font-semibold leading-none"><span className="text-white/80">{item.title}: </span><span>{item.status}</span></div></div>
                      <svg className="w-10 h-4" viewBox="0 0 40 16" fill="none"><path d="M 1 12 Q 10 2, 20 8 T 39 4" stroke={item.accent} strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                  })}
                </div>
              </div>
              <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#081329]/90 border border-cyan-500/30 text-slate-300 text-xs sm:text-sm font-medium shadow-xl">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Zyntra learns your pattern, then training adapts.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
            {metrics.map((card,idx)=>{
              const Icon=card.icon; const selected=activeMetric===idx;
              return <button type="button" key={idx} onClick={()=>setActiveMetric(selected?null:idx)} className={`text-left p-4 rounded-xl border backdrop-blur-md transition-all duration-300 cursor-pointer ${selected?"bg-slate-900/90 border-cyan-400 scale-[1.02] shadow-xl shadow-cyan-500/20":"bg-[#071021]/60 border-white/10 hover:border-white/20 hover:bg-[#0a162e]"}`}>
                <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2.5"><div className={`p-2 rounded-lg border bg-gradient-to-br ${card.color}`}><Icon className="w-4 h-4"/></div><div><div className="text-xs text-slate-400">{card.title}</div><div className="text-sm font-bold text-white">{card.status}</div></div></div></div>
                <div className="h-10 flex items-end gap-1.5 pt-2 px-1">{card.bars.map((height,i)=><div key={i} style={{height:`${height}%`,backgroundColor:card.accent}} className="flex-1 rounded-t-sm opacity-80 hover:opacity-100 transition-all duration-200"/>)}</div>
              </button>
            })}
          </div>
        </section>

        <section className="relative z-10 border-t border-white/5 bg-[#030712]/50 py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6 space-y-6">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">About Zyntra</h2>
                <p className="text-slate-300 text-base sm:text-lg leading-relaxed">Zyntra is for medical students, medical graduates and doctors preparing for AMC examinations.</p>
                <p className="text-slate-300 text-base sm:text-lg leading-relaxed">A conventional bank marks the option. Zyntra also keeps timing, confidence and answer changes, then uses those signals in Performance Intelligence and the Study Plan.</p>
              </div>
              <div className="lg:col-span-6">
                <div className="relative rounded-2xl border border-cyan-500/20 bg-[#081224]/80 p-5 backdrop-blur-xl shadow-2xl shadow-cyan-950/60 overflow-hidden group">
                  <div className="flex items-center justify-between pb-4 border-b border-white/5 text-xs text-slate-400">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"/><span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"/><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"/><span className="ml-2 font-mono text-cyan-400">AMC_QUESTION_SESSION_V2</span></div>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">Live Telemetry</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-3">
                      <div className="h-3 w-3/4 bg-slate-700/60 rounded"/><div className="h-2.5 w-full bg-slate-800/80 rounded"/><div className="h-2.5 w-5/6 bg-slate-800/80 rounded"/>
                      <div className="space-y-2 pt-2">{["A","B","C","D"].map((opt,i)=><div key={opt} className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs transition-colors cursor-pointer ${i===1?"bg-cyan-950/60 border-cyan-500/50 text-cyan-300":"bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/20"}`}><span className="w-5 h-5 rounded-md flex items-center justify-center bg-white/5 font-mono text-[10px]">{opt}</span><span className="h-2 rounded bg-current w-2/3 opacity-40"/></div>)}</div>
                    </div>
                    <div className="bg-[#050b18] p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                      <div><div className="flex items-center justify-between text-[11px] text-slate-400 mb-2"><span>Cognitive Trajectory</span><span className="text-emerald-400 font-mono">94.2% FIT</span></div><div className="h-24 w-full flex items-end"><svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none"><defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity=".4"/><stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/></linearGradient></defs><path d="M0 35 Q 25 10, 50 25 T 100 5 L 100 40 L 0 40 Z" fill="url(#chartGrad)"/><path d="M0 35 Q 25 10, 50 25 T 100 5" fill="none" stroke="#22d3ee" strokeWidth="2"/></svg></div></div>
                      <div className="space-y-1.5 pt-2 border-t border-white/5 text-[10px]"><div className="flex justify-between text-slate-400"><span>Confidence Index</span><span className="text-cyan-400 font-mono">High (0.88)</span></div><div className="flex justify-between text-slate-400"><span>Deliberation Time</span><span className="text-purple-400 font-mono">42.4s</span></div><div className="flex justify-between text-slate-400"><span>Option Oscillations</span><span className="text-rose-400 font-mono">1 Swap</span></div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
          <div className="mb-14"><h2 className="text-3xl font-extrabold text-white tracking-tight">How Zyntra works</h2><p className="mt-3 text-slate-500 text-sm">Practice → observe → understand → adapt → progress.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative">
            <div className="hidden md:block absolute top-5 left-8 right-8 h-px bg-gradient-to-r from-cyan-500/50 via-purple-500/40 via-rose-500/30 to-emerald-500/50"/>
            {steps.map((step,i)=>{const Icon=step.icon; const active=activeStep===i; return <button key={step.num} type="button" onClick={()=>setActiveStep(i)} className="relative text-left group">
              <div className={`w-10 h-10 rounded-full bg-[#040812] border-2 ${step.accent} flex items-center justify-center relative z-10 transition-all duration-300 ${active?"scale-110 shadow-lg shadow-cyan-500/20":"group-hover:scale-105"}`}><span className="text-[10px] font-mono">{step.num}</span></div>
              <Icon className={`w-5 h-5 mt-5 ${step.accent.split(" ")[1]} opacity-80`}/>
              <h3 className="mt-3 text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400 max-w-[190px]">{step.desc}</p>
              {active && <div className="mt-4 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-cyan-300"><CheckCircle2 className="w-3.5 h-3.5"/> Active</div>}
            </button>})}
          </div>
        </section>

        <section id="trains" className="border-t border-white/5 bg-[#030712]/50 py-20">
          <div className="max-w-7xl mx-auto px-6"><div className="flex items-center gap-3 mb-8"><Layers className="w-5 h-5 text-cyan-400"/><h2 className="text-3xl font-extrabold text-white">Training system</h2></div><div className="divide-y divide-white/5 border-y border-white/5">{trainingItems.map(([title,desc],i)=><article key={title} className="grid md:grid-cols-[70px_230px_1fr] gap-4 py-6"><span className="font-mono text-xs text-cyan-500/60">{String(i+1).padStart(2,"0")}</span><h3 className="font-bold text-white">{title}</h3><p className="text-sm text-slate-400 leading-relaxed">{desc}</p></article>)}</div></div>
        </section>


        <section className="border-t border-white/5 bg-[#030712]/50 py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold tracking-[.2em] text-cyan-400 uppercase">Zyntra Intelligence Lab</p><h2 className="mt-3 text-3xl font-extrabold text-white tracking-tight">From the Intelligence Lab</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Practical writing on AMC preparation, clinical reasoning, study strategy and learning intelligence.</p></div>
              <Link to="/blog" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-white">Explore the Blog <ChevronRight className="h-4 w-4"/></Link>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[["AMC","AMC MCQ Preparation: Train for the One-Way Exam","/blog/amc-part-1-mcq"],["AMC","AMC Clinical Exam Tips: Train for the 8-Minute Clock","/blog/amc-part-2-osce"]].map(([cat,title,to])=><div key={to} className="group rounded-2xl border border-white/10 bg-[#071021]/70 p-6 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-cyan-500/30 hover:bg-[#0a162e]"><Link to={to} className="block"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-cyan-400">{cat}</p><h3 className="mt-4 text-lg font-bold leading-snug text-white">{title}</h3></Link><div className="mt-5 flex flex-wrap items-center gap-3"><Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 group-hover:text-cyan-200">Read article <ArrowLeftRight className="h-3.5 w-3.5"/></Link><Link to="/login" className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20">Get Started <ArrowLeftRight className="h-3.5 w-3.5"/></Link></div></div>)}
            </div>
            <Link to="/blog" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 sm:hidden">Explore the Blog <ChevronRight className="h-4 w-4"/></Link>
          </div>
        </section>

        <section id="pricing" className="py-20 bg-[#07101c] border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6"><p className="text-xs font-bold tracking-[.2em] text-cyan-400 uppercase">Pricing</p><h2 className="mt-3 text-3xl font-extrabold text-white">Pricing</h2><div className="mt-10 divide-y divide-white/5 border-y border-white/5">
            <div className="grid md:grid-cols-[280px_1fr] gap-8 py-8"><div><h3 className="font-bold">Free</h3><div className="text-4xl font-extrabold mt-2">A$0</div><p className="text-xs text-slate-500 mt-2">APPE diagnostic only</p></div><div><p className="text-slate-400 text-sm leading-7">One diagnostic. It records timing, answer changes and confidence. You see the pattern from that sitting.</p><Link to="/check" className="inline-flex mt-4 px-4 py-2 border border-cyan-500/30 rounded text-sm text-cyan-300 hover:bg-cyan-500/10">Start the diagnostic</Link></div></div>
            <div className="grid md:grid-cols-[280px_1fr] gap-8 py-8"><div><h3 className="font-bold">Practice</h3><div className="text-4xl font-extrabold mt-2">A$39</div><p className="text-xs text-slate-500 mt-2">per month</p></div><div><p className="text-slate-400 text-sm leading-7">MCQ practice, Performance Intelligence and Study Plan.</p><Link to="/login" className="inline-flex mt-4 px-4 py-2 border border-cyan-500/30 rounded text-sm text-cyan-300 hover:bg-cyan-500/10">Log in to subscribe</Link></div></div>
          </div></div>
        </section>

        <section id="faq" className="py-20 border-t border-white/5 bg-[#030712]">
          <div className="max-w-3xl mx-auto px-6"><h2 className="text-3xl font-extrabold text-white">FAQ</h2><div className="mt-8 divide-y divide-white/5 border-y border-white/5">{faqs.map(([q,a])=><details key={q} className="py-5 group"><summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">{q}<span className="float-right text-cyan-400">+</span></summary><p className="mt-3 text-sm leading-7 text-slate-400">{a}</p></details>)}</div></div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-[#02050b] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-slate-500">
          <span>Zyntra Healthcare Intelligence</span><div className="flex gap-5"><Link to="/terms" className="hover:text-cyan-300">Terms</Link><Link to="/privacy" className="hover:text-cyan-300">Privacy</Link><a href="#faq" className="hover:text-cyan-300">FAQ</a></div>
        </div>
      </footer>

      {modalOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm" onMouseDown={(e)=>{if(e.target===e.currentTarget)setModalOpen(false)}}>
        <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#07101e] shadow-2xl shadow-cyan-500/10 p-7">
          <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-400">ZYNTRA</p><h2 className="mt-2 text-2xl font-bold text-white">Get started</h2></div><button onClick={()=>setModalOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X className="w-5 h-5"/></button></div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Start with the Zyntra diagnostic or continue to your account.</p>
          <div className="mt-6 grid gap-3"><Link to="/check" onClick={()=>setModalOpen(false)} className="flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-3 font-semibold text-white">Start diagnostic <ChevronRight className="w-4 h-4"/></Link><Link to="/login" onClick={()=>setModalOpen(false)} className="flex items-center justify-between rounded-xl border border-white/10 px-5 py-3 font-semibold text-slate-200 hover:border-cyan-500/30">Log in <ChevronRight className="w-4 h-4"/></Link></div>
        </div>
      </div>}
    </div>
  );
};

export default Index;
