import { ArrowRight, BookOpen, Brain, CheckCircle2, Clock3, Compass, Eye, FlaskConical, Layers3, ListChecks, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import { publicFeatureList } from "@/data/featureAvailability";
import "@/styles/zyntra-home.css";
import "@/styles/zyntra-tokens.css";

const icons = [BookOpen, Brain, FlaskConical, ListChecks, Compass, Target, Eye, Layers3, Sparkles, Clock3, CheckCircle2];
function Status({ status, tone }: { status: string; tone: string }) {
  const color = tone === "live" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-800" : tone === "beta" ? "border-amber-400/40 bg-amber-400/10 text-amber-800" : "border-slate-400/40 bg-slate-400/10 text-slate-600";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>{status}</span>;
}
export default function Features() {
 return <div className="zh-home min-h-screen" data-zyntra-features="canonical">
  <a href="#main" className="zh-skip">Skip to content</a><MarketingHeader />
  <main id="main">
   <section className="zh-hero"><div className="zh-hero-bg" aria-hidden="true"/><div className="zh-container py-16 md:py-24">
    <p className="zh-eyebrow">THE ZYNTRA FEATURE MAP</p><h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-6xl">Know what is ready.<br/><em>Know what is still growing.</em></h1>
    <p className="zh-lede mt-5 max-w-2xl">A clear guide to the tools in Zyntra's current release. Status labels describe the core capability, not a promise that every related signal or workflow is available to every account.</p>
    <div className="mt-7 flex flex-wrap gap-3"><a className="zh-button" href="#feature-list">Explore features <ArrowRight size={17}/></a><Link className="zh-button-outline" to="/how-it-works">How PIE works <ArrowRight size={16}/></Link></div>
   </div></section>
   <section className="zh-section py-12 md:py-16" id="feature-list"><div className="zh-container">
    <div className="mb-8 max-w-3xl"><p className="zh-eyebrow zh-eyebrow-dark">CURRENT AVAILABILITY</p><h2 className="text-3xl font-bold md:text-4xl">Practice first. Add insight where available.</h2><p className="zh-section-copy mt-4">The learning loop is a way to use the product, not a claim that every stage is fully automated: practise, review what the current activity shows, choose a focus, then practise again.</p></div>
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{publicFeatureList.map((feature,i)=>{const Icon=icons[i%icons.length];return <article key={feature.key} className="rounded-2xl border border-slate-300/40 bg-white/70 p-6 shadow-sm">
     <div className="flex items-start justify-between gap-3"><span className="rounded-xl border border-slate-300/50 p-3"><Icon size={22}/></span><Status status={feature.status} tone={feature.tone}/></div>
     <h3 className="mt-5 text-xl font-semibold">{feature.name}</h3><p className="mt-2 text-sm leading-6">{feature.summary}</p><p className="mt-3 text-xs leading-5 text-slate-600">{feature.detail}</p>
    </article>;})}</div>
   </div></section>
   <section className="zh-section bg-slate-100/70 py-12 md:py-16"><div className="zh-container grid gap-8 md:grid-cols-2 md:items-center">
    <div><p className="zh-eyebrow zh-eyebrow-dark">THE LEARNING LOOP</p><h2 className="text-3xl font-bold md:text-4xl">A useful next step starts with what is actually available.</h2><p className="zh-section-copy mt-4">MCQ practice is live. Core Performance Intelligence is live, while Behaviour, Confidence, Evidence and Interventions are beta capabilities whose coverage depends on release and activity. Use explanations and available signals to guide your own next practice step.</p></div>
    <ol className="space-y-4">{[{n:"01",title:"Practise",copy:"Answer an AMC-style question."},{n:"02",title:"Review",copy:"Read the explanation and available performance signals."},{n:"03",title:"Choose",copy:"Pick a topic or reasoning step to revisit."},{n:"04",title:"Repeat",copy:"Return to practice and compare later attempts."}].map(s=><li key={s.n} className="flex gap-4 rounded-xl border border-slate-300/40 bg-white/80 p-4"><span className="font-mono text-sm text-slate-500">{s.n}</span><div><h3 className="font-semibold">{s.title}</h3><p className="mt-1 text-sm text-slate-600">{s.copy}</p></div></li>)}</ol>
   </div></section>
   <section className="zh-section py-12 md:py-16"><div className="zh-container grid gap-6 rounded-2xl border border-slate-300/40 bg-white/70 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
    <div><p className="zh-eyebrow zh-eyebrow-dark">BUILT FOR IMGS</p><h2 className="text-3xl font-bold">Focused AMC preparation, without inflated promises.</h2><p className="zh-section-copy mt-3">Zyntra supports practice and reflection. It does not predict or guarantee exam outcomes, and it is independent of the Australian Medical Council.</p></div><Link to="/login" className="zh-button">Start practising <ArrowRight size={17}/></Link>
   </div><div className="zh-container mt-6 flex flex-wrap gap-5 text-sm"><Link className="underline underline-offset-4" to="/how-it-works">How it works</Link><Link className="underline underline-offset-4" to="/faq">FAQ</Link><Link className="underline underline-offset-4" to="/amc-part-1-mcq">AMC Part 1 MCQ</Link><Link className="underline underline-offset-4" to="/pricing">Pricing and trial details</Link></div></section>
  </main><MarketingFooter/>
 </div>;
}
