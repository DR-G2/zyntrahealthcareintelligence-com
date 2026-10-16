import React, { useState } from "react";
import { ArrowRight, ArrowUpRight, Activity, Brain, BookOpen, CalendarDays, Check, ChevronRight, Clock3, HeartPulse, Menu, Moon, Play, ShieldCheck, Sparkles, Sun, Target, TrendingUp, X, GitBranch, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { COPY_CARD_CHECK, COPY_CANCEL, cancelCopy } from "@/lib/billing";
import "@/styles/zyntra-home.css";

const metrics = [
  { title: "Accuracy", desc: "How often you get it right", icon: Activity },
  { title: "Timing", desc: "How long you take", icon: Clock3 },
  { title: "Answer Changes", desc: "When you revise your answer", icon: GitBranch },
  { title: "Confidence", desc: "How sure you are", icon: Brain },
  { title: "Behaviour", desc: "Your decision patterns", icon: Target },
  { title: "Subject Strengths", desc: "Where you perform well", icon: TrendingUp },
];
const features = [
  { title: "MCQ Practice", desc: "AMC-style questions with adaptive difficulty and filters.", icon: BookOpen, kind: "mcq" },
  { title: "OSCE Practice", desc: "Case-based stations with structured feedback. Availability depends on the current release.", icon: HeartPulse, kind: "osce" },
  { title: "Performance Intelligence", desc: "Understand your accuracy, timing, confidence and patterns.", icon: Activity, kind: "performance" },
  { title: "AI Study Lab", desc: "Focused explanations and targeted learning support.", icon: Sparkles, kind: "lab" },
  { title: "History & Progress", desc: "Track practice, review attempts and see your progress.", icon: CalendarDays, kind: "history" },
];
const steps = [
  { no: "01", title: "Practise", desc: "Answer AMC-style questions.", icon: ClipboardList },
  { no: "02", title: "Understand", desc: "PIE analyses your responses and patterns.", icon: Brain },
  { no: "03", title: "Improve", desc: "Get a targeted next action.", icon: Target },
];
const insights = [
  ["Accuracy", "You got this right.", Check],
  ["Timing", "You took 78 seconds (slightly longer than your usual time).", Clock3],
  ["Answer Changes", "You changed your answer 1 time.", GitBranch],
  ["Confidence", "Your confidence was high and aligned with a correct answer.", Brain],
  ["Possible Pattern", "Similar questions show increased hesitation under time pressure.", Activity],
];
const benefits = [
  ["AMC-focused content", "Aligned with the AMC blueprint", ClipboardList],
  ["Clear explanations", "Learn from every question", Brain],
  ["Flexible study", "Fit your preparation around life", CalendarDays],
  ["A smarter way to practise", "Focus on what matters next", Target],
];

function BrainFunnel() {
  return <div className="zh-art" aria-label="Illustration of a glowing brain flowing through a funnel to the next best action" role="img">
    <div className="zh-orbit zh-orbit-a" /><div className="zh-orbit zh-orbit-b" />
    <div className="zh-neural-lines" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
    <svg className="zh-brain-svg" viewBox="0 0 360 300" aria-hidden="true">
      <defs>
        <radialGradient id="zh-brain-fill" cx="50%" cy="40%" r="65%"><stop offset="0%" stopColor="#f7ffff"/><stop offset="38%" stopColor="#74e9ff"/><stop offset="70%" stopColor="#397fda"/><stop offset="100%" stopColor="#132b69"/></radialGradient>
        <linearGradient id="zh-brain-stroke" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b7faff"/><stop offset=".45" stopColor="#53cfff"/><stop offset="1" stopColor="#ffbd83"/></linearGradient>
        <filter id="zh-glow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g filter="url(#zh-glow)" fill="url(#zh-brain-fill)" stroke="url(#zh-brain-stroke)" strokeWidth="2.5">
        <path d="M178 52 C161 25 125 26 112 49 C82 39 62 62 70 86 C43 105 52 137 73 147 C70 173 96 188 117 175 C133 197 163 184 173 165 L180 145 Z"/>
        <path d="M182 52 C199 25 235 26 248 49 C278 39 298 62 290 86 C317 105 308 137 287 147 C290 173 264 188 243 175 C227 197 197 184 187 165 L180 145 Z"/>
        <path d="M180 145 L180 224 M167 166 C158 187 165 202 177 208 M193 166 C202 187 195 202 183 208" fill="none"/>
        <path d="M110 58 C132 63 130 80 117 91 S104 119 130 127 M77 94 C97 92 106 105 99 120 M133 48 C146 65 144 81 160 87 M89 146 C111 136 125 151 124 170 M155 98 C145 117 163 130 155 150 M250 58 C228 63 230 80 243 91 S256 119 230 127 M283 94 C263 92 254 105 261 120 M227 48 C214 65 216 81 200 87 M271 146 C249 136 235 151 236 170 M205 98 C215 117 197 130 205 150" fill="none" strokeWidth="2"/>
      </g>
      <path d="M142 194 Q180 218 218 194 L201 246 Q180 262 159 246 Z" fill="rgba(87,223,255,.18)" stroke="#69e8ff" strokeWidth="2" filter="url(#zh-glow)"/>
      <path d="M159 246 Q180 262 201 246 L193 265 Q180 274 167 265 Z" fill="#5beaff" opacity=".8"/>
    </svg>
    <div className="zh-funnel-glow" />
    <div className="zh-action-orb"><span>NEXT</span><strong>BEST ACTION</strong></div>
  </div>;
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkHeader, setDarkHeader] = useState(true);
  const [email, setEmail] = useState("");
  const nav = [["Why Zyntra", "#why"], ["How it works", "#how-it-works"], ["Features", "#features"], ["For IMGs", "#imgs"], ["Pricing", "#pricing"], ["About", "#about"]];
  return <div data-zyntra-home="canonical" className="zh-home">
    <a href="#main" className="zh-skip">Skip to content</a>
    <header className={`zh-header ${darkHeader ? "" : "zh-header-light"}`}>
      <div className="zh-header-inner">
        <a className="zh-brand" href="#top" aria-label="Zyntra home"><BrandMark className="h-9 w-9" /><span><b>ZYNTRA</b><small>HEALTHCARE INTELLIGENCE</small></span></a>
        <nav className={`zh-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          {nav.map(([label, href])=><a key={label} href={href} onClick={()=>setMenuOpen(false)}>{label}</a>)}
          <button className="zh-theme" type="button" aria-label={darkHeader ? "Switch header to light theme" : "Switch header to dark theme"} onClick={()=>setDarkHeader(v=>!v)}>{darkHeader ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <Link to="/login" className="zh-signin">Sign in</Link>
          <Link to="/login" className="zh-join">Join Early Access <ArrowRight size={15}/></Link>
        </nav>
        <button className="zh-menu" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen ? <X/> : <Menu/>}</button>
      </div>
    </header>
    <main id="main">
      <section id="top" className="zh-hero">
        <div className="zh-hero-bg" aria-hidden="true" />
        <div className="zh-container zh-hero-grid">
          <div className="zh-hero-copy">
            <p className="zh-eyebrow">AMC PREPARATION FOR IMGS</p>
            <h1>It’s not just<br/>what you know.<br/><em>It’s how you think.</em></h1>
            <p className="zh-lede">Practise AMC-style questions with a system that understands your performance, confidence and answer patterns, and helps you focus on what to do next.</p>
            <div className="zh-hero-actions"><Link to="/login" className="zh-button">Start Practising <ArrowRight size={17}/></Link><a href="#how-it-works" className="zh-button-outline"><Play size={17} fill="currentColor"/> See how PIE works</a></div>
            <div className="zh-trust">{[[BookOpen,"AMC-style","practice"],[Activity,"Performance","intelligence"],[Target,"Personalised","next actions"],[ShieldCheck,"Built for","IMGs"]].map(([Icon,a,b],i)=><div key={i}><Icon size={23}/><span>{a as string}<br/>{b as string}</span></div>)}</div>
          </div>
          <div className="zh-hero-visual">
            <BrainFunnel/>
            {metrics.map(({title,desc,icon:Icon},i)=><article key={title} className={`zh-metric zh-metric-${i+1}`}><Icon size={19}/><div><strong>{title}</strong><span>{desc}</span></div></article>)}
          </div>
        </div>
      </section>
      <section id="how-it-works" className="zh-section zh-how">
        <div className="zh-container zh-how-grid"><div><p className="zh-eyebrow zh-eyebrow-dark">HOW ZYNTRA WORKS</p><h2>From every answer<br/>to your next best action.</h2><p className="zh-section-copy">Zyntra’s Performance Intelligence Engine (PIE) analyses how you practise, identifies patterns and helps you choose what to work on next.</p></div>
          <div className="zh-steps">{steps.map(({no,title,desc,icon:Icon},i)=><React.Fragment key={no}><article><span className="zh-step-icon"><Icon size={25}/></span><b>{no}</b><h3>{title}</h3><p>{desc}</p></article>{i<2&&<ArrowRight className="zh-step-arrow" size={27}/>}</React.Fragment>)}</div>
        </div>
      </section>
      <section className="zh-section zh-attempt"><div className="zh-container zh-attempt-grid">
        <div><div className="zh-section-label"><b>A QUESTION ATTEMPT</b><span>Real example of what PIE looks at</span></div><article className="zh-question-card"><div className="zh-question-head"><b>Example AMC-style question</b><span>Illustrative</span></div><p>A 52-year-old man presents with exertional chest pain. ECG is shown. What is the most likely diagnosis?</p><div className="zh-question-content"><div className="zh-options">{["Stable angina","NSTEMI","STEMI","Pericarditis"].map((v,i)=><div className={i===1?"zh-option selected":"zh-option"} key={v}><b>{String.fromCharCode(65+i)}</b>{v}</div>)}</div><div className="zh-ecg" role="img" aria-label="Illustrative electrocardiogram trace"><svg viewBox="0 0 190 130" aria-hidden="true"><defs><pattern id="ecg-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#efb4b4" strokeWidth=".55"/></pattern></defs><rect width="190" height="130" fill="url(#ecg-grid)"/><path d="M0 35 H20 L25 30 L30 42 L35 16 L41 66 L47 35 H67 L72 30 L77 42 L82 16 L88 66 L94 35 H114 L119 30 L124 42 L129 16 L135 66 L141 35 H161 L166 30 L171 42 L176 16 L182 66 L190 35" fill="none" stroke="#203c49" strokeWidth="1.6"/><path d="M0 92 H22 L29 87 L35 102 L41 70 L47 114 L53 92 H74 L81 86 L87 101 L93 69 L99 114 L105 92 H126 L133 86 L139 101 L145 69 L151 114 L157 92 H190" fill="none" stroke="#203c49" strokeWidth="1.5"/></svg></div></div><div className="zh-question-footer"><span><Check/> Correct</span><span><Activity/> 78 seconds</span><span><GitBranch/> 1 change</span><span><Brain/> Confidence: High</span></div></article><p className="zh-disclaimer">Static example, no real candidate data.</p></div>
        <div><div className="zh-section-label"><b>PIE TURNS THIS INTO INSIGHTS</b></div><div className="zh-insights">{insights.map(([title,desc,Icon])=><article key={title as string}><span className="zh-insight-icon"><Icon size={17}/></span><b>{title as string}</b><p>{desc as string}</p></article>)}<article className="zh-next-action"><span className="zh-insight-icon"><Target size={17}/></span><b>Next Action</b><p>Practise acute coronary syndrome scenarios with ECG interpretation.</p><ChevronRight/></article></div></div>
      </div></section>
      <section id="features" className="zh-section zh-features"><div className="zh-container"><div className="zh-section-heading"><div><p className="zh-eyebrow zh-eyebrow-dark">INSIDE ZYNTRA</p><h2>Everything you need for AMC preparation.</h2></div><a href="#pricing" className="zh-text-link">Explore all features <ArrowRight size={16}/></a></div><div className="zh-feature-grid">{features.map(({title,desc,icon:Icon,kind})=><article className="zh-feature-card" key={title}><FeaturePreview kind={kind}/><div className="zh-feature-copy"><Icon size={23}/><div><h3>{title}</h3><p>{desc}</p></div></div></article>)}</div></div></section>
      <section id="imgs" className="zh-section zh-imgs"><div className="zh-container zh-img-grid"><div><p className="zh-eyebrow zh-eyebrow-dark">BUILT FOR IMGS</p><h2>Designed for your journey to Australia.</h2><p className="zh-section-copy">Zyntra focuses on AMC exam preparation with real clinical scenarios, clear explanations and a performance intelligence system that helps you learn more effectively.</p></div><div className="zh-benefits">{benefits.map(([title,desc,Icon])=><article key={title as string}><span><Icon size={20}/></span><div><b>{title as string}</b><p>{desc as string}</p></div></article>)}</div></div></section>
      <section id="pricing" className="zh-section zh-pricing"><div className="zh-container zh-pricing-grid"><div><p className="zh-eyebrow zh-eyebrow-dark">SIMPLE, TRANSPARENT PRICING</p><h2>Start with a 7-day trial.</h2><p className="zh-section-copy">Get full access to Zyntra Full Access and explore how PIE works.</p></div><article className="zh-price-card"><div className="zh-price-main"><div className="zh-price-title"><h3>Full Access</h3><span>Most Popular</span></div><p className="zh-price"><strong>A$1 card check</strong></p><p className="zh-price-sub">7-day free trial, then A$39 per month or A$99 every 3 months.</p><ul><li><Check/> Full access to MCQ practice</li><li><Check/> Performance intelligence</li><li><Check/> AI Study Lab, subject to release</li><li><Check/> Cancel anytime</li></ul><p className="zh-legal-copy">{COPY_CARD_CHECK} {cancelCopy("quarterly")} {COPY_CANCEL}</p></div><div className="zh-price-cta"><Link to="/login" className="zh-price-button">Start 7-day trial <ArrowRight size={16}/></Link><p>Billing uses Australia/Sydney time. Your first charge is when the trial ends, then renews every billing period until cancelled.</p><Link to="/pricing" className="zh-text-link">See full pricing details <ArrowRight size={14}/></Link></div></article></div></section>
      <section id="about" className="zh-cta"><div className="zh-container zh-cta-inner"><div><p className="zh-eyebrow">JOIN THE EARLY ACCESS LIST</p><h2>Be part of a smarter way to prepare.</h2><p>Join early access and get started on your AMC journey with Zyntra.</p></div><form className="zh-email-form" onSubmit={e=>{e.preventDefault();}}><label className="sr-only" htmlFor="zh-email">Email address</label><input id="zh-email" type="email" autoComplete="email" placeholder="Enter your email address" value={email} onChange={e=>setEmail(e.target.value)} required/><button type="submit">Join Early Access <ArrowRight size={16}/></button><span role="status" aria-live="polite">Early access form is a visual placeholder. Signup handler not connected yet.</span></form></div></section>
    </main>
    <footer className="zh-footer"><div className="zh-container"><div className="zh-footer-top"><a className="zh-brand zh-footer-brand" href="#top"><BrandMark className="h-9 w-9"/><span><b>ZYNTRA</b><small>HEALTHCARE INTELLIGENCE</small></span></a><nav aria-label="Footer navigation"><a href="#features">Product</a><a href="#pricing">Pricing</a><a href="#about">About</a><a href="#faq">FAQ</a><a href="mailto:hello@zyntrahealthcareintelligence.com">Contact</a></nav><div className="zh-socials"><a href="https://x.com" aria-label="X"><ArrowUpRight/></a><a href="https://linkedin.com" aria-label="LinkedIn"><ArrowUpRight/></a><a href="https://instagram.com" aria-label="Instagram"><ArrowUpRight/></a><a href="https://youtube.com" aria-label="YouTube"><Play/></a></div></div><p className="zh-footer-legal">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p></div></footer>
    <div className="zh-mobile-cta"><Link to="/login">Start Practising <ArrowRight size={16}/></Link></div>
  </div>;
};
export default Home;
