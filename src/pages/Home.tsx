import React, { useState } from "react";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import { ArrowRight, Activity, Brain, BookOpen, CalendarDays, Check, ChevronRight, Clock3, HeartPulse, ShieldCheck, Sparkles, Target, GitBranch, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { featureAvailability } from "@/data/featureAvailability";
import { COPY_CARD_CHECK, COPY_CANCEL, cancelCopy } from "@/lib/billing";
import "@/styles/zyntra-home.css";
import "@/styles/living-brain.css";
import "@/styles/zyntra-tokens.css";
import NeuralScene, { INTELLIGENCE_STAGES, type IntelligenceStage } from "@/components/home/NeuralScene";

const features = [
  { title: featureAvailability.mcqPractice.name, desc: featureAvailability.mcqPractice.summary, status: featureAvailability.mcqPractice.status, tone: featureAvailability.mcqPractice.tone, icon: BookOpen, kind: "mcq" },
  { title: featureAvailability.oscePractice.name, desc: featureAvailability.oscePractice.summary, status: featureAvailability.oscePractice.status, tone: featureAvailability.oscePractice.tone, icon: HeartPulse, kind: "osce" },
  { title: featureAvailability.performanceIntelligence.name, desc: featureAvailability.performanceIntelligence.summary, status: featureAvailability.performanceIntelligence.status, tone: featureAvailability.performanceIntelligence.tone, icon: Activity, kind: "performance" },
  { title: featureAvailability.aiStudyLab.name, desc: featureAvailability.aiStudyLab.summary, status: featureAvailability.aiStudyLab.status, tone: featureAvailability.aiStudyLab.tone, icon: Sparkles, kind: "lab" },
  { title: featureAvailability.historyProgress.name, desc: featureAvailability.historyProgress.summary, status: featureAvailability.historyProgress.status, tone: featureAvailability.historyProgress.tone, icon: CalendarDays, kind: "history" },
];
const steps = [
  { no: "01", title: "Practise", desc: "Answer AMC-style questions.", icon: ClipboardList },
  { no: "02", title: "Review", desc: "Use the explanations and performance signals available in your activity.", icon: Brain },
  { no: "03", title: "Choose a next step", desc: "Focus your next practice session on an area worth revisiting.", icon: Target },
] as const;
const insights = [
  ["Accuracy", "You got this right.", Check],
  ["Timing", "You took 78 seconds (slightly longer than your usual time).", Clock3],
  ["Answer Changes", "You changed your answer 1 time.", GitBranch],
  ["Confidence", "Your confidence was high and aligned with a correct answer.", Brain],
  ["Possible Pattern", "Similar questions show increased hesitation under time pressure.", Activity],
] as const;
const benefits = [
  ["AMC-focused content", "Aligned with the AMC blueprint", ClipboardList],
  ["Clear explanations", "Learn from every question", Brain],
  ["Flexible study", "Fit your preparation around life", CalendarDays],
  ["A smarter way to practise", "Focus on what matters next", Target],
] as const;

function FeaturePreview({ kind }: { kind: string }) {
  return <div className={`zh-preview zh-preview-${kind}`} aria-hidden="true">
    <div className="zh-preview-top"><span /><span /><span /><b>{kind === "mcq" ? "MCQ Practice" : kind === "osce" ? "Clinical station" : kind === "performance" ? "Performance Intelligence" : kind === "lab" ? "AI Study Lab" : "Practice history"}</b></div>
    {kind === "mcq" && <><div className="zh-mini-line wide" /><div className="zh-mini-line" /><div className="zh-mini-option" /><div className="zh-mini-option active" /><div className="zh-mini-option" /><div className="zh-mini-option" /></>}
    {kind === "osce" && <><div className="zh-mini-person"><HeartPulse size={35}/></div><div className="zh-mini-line wide" /><div className="zh-mini-line" /><div className="zh-mini-option" /><div className="zh-mini-option active" /></>}
    {kind === "performance" && <div className="zh-mini-radar"><span /><span /><span /><span /><span /></div>}
    {kind === "lab" && <><div className="zh-mini-line wide" /><div className="zh-mini-code">Explain the key points<br/>• Presentation<br/>• Investigation<br/>• Management</div></>}
    {kind === "history" && <div className="zh-mini-bars">{[38,66,47,80,58,93,70,52,85].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div>}
  </div>;
}

const Home: React.FC = () => {
  const [activeBrainStage, setActiveBrainStage] = useState<IntelligenceStage>("observe");
  const activeStage = INTELLIGENCE_STAGES.find((stage) => stage.id === activeBrainStage) ?? INTELLIGENCE_STAGES[0];
  return <div data-zyntra-home="canonical" className="zh-home">
    <a href="#main" className="zh-skip">Skip to content</a>
    <MarketingHeader />
    <main id="main">
      <section id="top" className="zh-hero">
        <div className="zh-hero-bg" aria-hidden="true" />
        <div className="zh-container zh-hero-grid">
          <div className="zh-hero-copy">
            <p className="zh-eyebrow">PERFORMANCE INTELLIGENCE FOR IMGs</p>
            <h1>From Questions<br/>to <em>Readiness.</em></h1>
            <p className="zh-lede">Zyntra studies how you answer, where you hesitate and what changes over time, helping you focus on the next most useful step in your AMC preparation.</p>
            <div className="zh-hero-actions"><Link to="/features" className="zh-button">Explore Zyntra <ArrowRight size={17}/></Link><a href="#living-loop" className="zh-button-outline">How it works <ArrowRight size={17}/></a></div>
            <div className="zh-trust">{[[BookOpen,"AMC-style","practice"],[Activity,"Performance","intelligence"],[Target,"Personalised","next actions"],[ShieldCheck,"Built for","IMGs"]].map(([Icon,a,b],i)=><div key={i}><Icon size={23}/><span>{a as string}<br/>{b as string}</span></div>)}</div>
          </div>
          <div className="zh-hero-visual zh-living-hero-visual">
            <NeuralScene activeStage={activeBrainStage} onStageSelect={setActiveBrainStage} />
          </div>
        </div>
      </section>
      <section id="living-loop" className="zh-section zh-living-loop"><span id="why" className="sr-only">Why Zyntra</span>
        <div className="zh-container">
          <div className="zh-living-heading"><div><p className="zh-eyebrow zh-eyebrow-dark">THE ZYNTRA LEARNING LOOP</p><h2>Evidence in. A better next step out.</h2></div><p className="zh-section-copy">Observe → Diagnose → Intervene → Measure → Adapt. One connected loop, informed by the evidence available from practice.</p></div>
          <div className="zh-living-stage-list" role="group" aria-label="Choose an intelligence stage">
            {INTELLIGENCE_STAGES.map((stage, index) => <button type="button" key={stage.id} className={`zh-living-stage ${activeBrainStage === stage.id ? "is-active" : ""}`} aria-pressed={activeBrainStage === stage.id} onClick={() => setActiveBrainStage(activeBrainStage === stage.id ? "observe" : stage.id)}><span className="zh-living-stage-no">0{index + 1}</span><strong>{stage.title}</strong><span className="zh-living-stage-desc">{stage.description}</span></button>)}
          </div>
          <div className="zh-living-detail-grid">
            <article className="zh-living-stage-detail" aria-live="polite"><span className="zh-living-kicker">SELECTED STAGE · {activeStage.regionLabel}</span><h3>{activeStage.title}</h3><p>{activeStage.description}</p><p className="zh-living-detail-note">The highlighted region follows this selection. This is a product explanation, not a live learner assessment.</p></article>
            <article className="zh-living-action-card"><span className="zh-living-action-label">NEXT BEST ACTION</span><h3>Review your weakest evidenced topic</h3><p>A focused revision session can address an identified learning gap.</p><span className="zh-living-demo-note">Illustrative example · No learner data accessed</span><Link to="/login" className="zh-living-action-link">Explore practice <ArrowRight size={16}/></Link></article>
          </div>
        </div>
      </section><section className="zh-section zh-attempt"><div className="zh-container zh-attempt-grid">
        <div><div className="zh-section-label"><b>A QUESTION ATTEMPT</b><span>Example of what PIE looks at</span></div><article className="zh-question-card"><div className="zh-question-head"><b>Example AMC-style question</b><span>Illustrative</span></div><p>A 52-year-old man presents with exertional chest pain. ECG is shown. What is the most likely diagnosis?</p><div className="zh-question-content"><div className="zh-options">{["Stable angina","NSTEMI","STEMI","Pericarditis"].map((v,i)=><div className={i===1?"zh-option selected":"zh-option"} key={v}><b>{String.fromCharCode(65+i)}</b>{v}</div>)}</div><div className="zh-ecg" role="img" aria-label="Illustrative electrocardiogram trace"><svg viewBox="0 0 190 130" aria-hidden="true"><defs><pattern id="ecg-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#efb4b4" strokeWidth=".55"/></pattern></defs><rect width="190" height="130" fill="url(#ecg-grid)"/><path d="M0 35 H20 L25 30 L30 42 L35 16 L41 66 L47 35 H67 L72 30 L77 42 L82 16 L88 66 L94 35 H114 L119 30 L124 42 L129 16 L135 66 L141 35 H161 L166 30 L171 42 L176 16 L182 66 L190 35" fill="none" stroke="#203c49" strokeWidth="1.6"/><path d="M0 92 H22 L29 87 L35 102 L41 70 L47 114 L53 92 H74 L81 86 L87 101 L93 69 L99 114 L105 92 H126 L133 86 L139 101 L145 69 L151 114 L157 92 H190" fill="none" stroke="#203c49" strokeWidth="1.5"/></svg></div></div><div className="zh-question-footer"><span><Check/> Correct</span><span><Activity/> 78 seconds</span><span><GitBranch/> 1 change</span><span><Brain/> Confidence: High</span></div></article><p className="zh-disclaimer">Static example, no real candidate data.</p></div>
        <div><div className="zh-section-label"><b>PIE TURNS THIS INTO INSIGHTS</b></div><div className="zh-insights">{insights.map(([title,desc,Icon])=><article key={title as string}><span className="zh-insight-icon"><Icon size={17}/></span><b>{title as string}</b><p>{desc as string}</p></article>)}<article className="zh-next-action"><span className="zh-insight-icon"><Target size={17}/></span><b>Illustrative next step</b><small className="inline-flex rounded-full border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{featureAvailability.interventions.status}</small><p>Practise related acute chest pain cases and review the reasoning. This is an example, not a live PIE recommendation.</p><ChevronRight/></article></div></div>
      </div></section>
      <section id="features" className="zh-section zh-features"><div className="zh-container"><div className="zh-section-heading"><div><p className="zh-eyebrow zh-eyebrow-dark">INSIDE ZYNTRA</p><h2>Everything you need for AMC preparation.</h2></div><Link to="/features" className="zh-text-link">Explore all features <ArrowRight size={16}/></Link></div><div className="zh-feature-grid">{features.map(({title,desc,icon:Icon,kind,status,tone})=><article className="zh-feature-card" key={title}><FeaturePreview kind={kind}/><div className="zh-feature-copy"><Icon size={23}/><div><h3>{title}</h3><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tone === "live" ? "border-emerald-500/30 text-emerald-700" : tone === "beta" ? "border-amber-500/30 text-amber-700" : "border-slate-400/40 text-slate-500"}`}>{status}</span><p>{desc}</p></div></div></article>)}</div></div></section>
      <section id="imgs" className="zh-section zh-imgs"><div className="zh-container zh-img-grid"><div><p className="zh-eyebrow zh-eyebrow-dark">BUILT FOR IMGS</p><h2>Designed for your journey to Australia.</h2><p className="zh-section-copy">Zyntra focuses on AMC exam preparation with real clinical scenarios, clear explanations and a performance intelligence system that helps you learn more effectively.</p></div><div className="zh-benefits">{benefits.map(([title,desc,Icon])=><article key={title as string}><span><Icon size={20}/></span><div><b>{title as string}</b><p>{desc as string}</p></div></article>)}</div></div></section>
      <section id="pricing" className="zh-section zh-pricing"><div className="zh-container zh-pricing-grid"><div><p className="zh-eyebrow zh-eyebrow-dark">SIMPLE, TRANSPARENT PRICING</p><h2>Start with a 7-day trial.</h2><p className="zh-section-copy">Get full access to Zyntra Full Access and explore how PIE works.</p></div><article className="zh-price-card"><div className="zh-price-main"><div className="zh-price-title"><h3>Full Access</h3><span>Most Popular</span></div><p className="zh-price"><strong>A$1 card check</strong></p><p className="zh-price-sub">7-day free trial, then A$39 per month or A$99 every 3 months.</p><ul><li><Check/> Full access to MCQ practice</li><li><Check/> Performance intelligence</li><li><Check/> AI Study Lab, subject to release</li><li><Check/> Cancel anytime</li></ul><p className="zh-legal-copy">{COPY_CARD_CHECK} {cancelCopy("quarterly")} {COPY_CANCEL}</p></div><div className="zh-price-cta"><Link to="/login" className="zh-price-button">Start 7-day trial <ArrowRight size={16}/></Link><p>Billing uses Australia/Sydney time. Your first charge is when the trial ends, then renews every billing period until cancelled.</p><Link to="/pricing" className="zh-text-link">See full pricing details <ArrowRight size={14}/></Link><Link to="/faq" className="zh-text-link">Read common questions <ArrowRight size={14}/></Link></div></article></div></section>
      <section id="about" className="zh-cta"><div className="zh-container zh-cta-inner"><div><p className="zh-eyebrow">READY TO BEGIN?</p><h2>Make your next practice session count.</h2><p>Start your 7-day trial and explore Zyntra’s AMC preparation tools.</p></div><Link to="/login" className="zh-button">Start 7-day trial <ArrowRight size={16}/></Link></div></section>
    </main>
    <MarketingFooter />
    <div className="zh-mobile-cta"><Link to="/login">Start Practising <ArrowRight size={16}/></Link></div>
  </div>;
};
export default Home;
