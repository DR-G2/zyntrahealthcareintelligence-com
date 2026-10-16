import { ArrowRight, Check, CircleHelp, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import { COPY_CARD_CHECK, TRIAL_DAYS, PLAN_PRICES, cancelCopy } from "@/lib/billing";
import "@/styles/zyntra-home.css";
import "@/styles/zyntra-pricing.css";

const included = [
 { name:"MCQ practice", detail:"AMC-style question practice, explanations and review tools.", status:"Live", tone:"live" },
 { name:"Performance Intelligence", detail:"Review available performance evidence from practice.", status:"Live", tone:"live" },
 { name:"AI Study Lab", detail:"AI-assisted study tools. Availability depends on the current release and provider setup.", status:"Beta", tone:"beta" },
 { name:"Study Plan", detail:"Build a focused plan from recorded practice signals when available.", status:"Beta", tone:"beta" },
 { name:"OSCE stations", detail:"Clinical station practice is not live yet.", status:"Coming soon", tone:"soon" },
 { name:"Expanded intelligence tools", detail:"Some Behaviour, Confidence, Evidence and Interventions capabilities may not be available in every release.", status:"Availability depends on the current release", tone:"soon" },
];
const faqs = [
 { q:"How does the 7-day trial work?", a:"An A$1 card check is taken today to confirm your card. Your 7-day trial then begins. If you do not cancel before the trial ends, your selected plan is charged on the trial-end date." },
 { q:"What happens after the trial?", a:"The monthly plan charges A$39 each month. The 3-month plan charges A$99 every three months. Renewals follow the billing schedule shown in checkout." },
 { q:"Can I cancel during the trial?", a:"Yes. Cancel in Settings > Billing before the trial ends and you will not be charged the subscription price. The A$1 card check is not refunded if you cancel, except where required by law." },
 { q:"Does Zyntra guarantee an AMC result?", a:"No. Zyntra is an independent preparation tool. It does not predict or guarantee an exam result and is not affiliated with the Australian Medical Council." },
];
function StatusBadge({status,tone}:{status:string;tone:string}) { return <span className={`zp-status zp-status-${tone}`}><span aria-hidden="true"/>{status}</span>; }
function PlanCard({interval}:{interval:"monthly"|"quarterly"}) {
 const quarterly=interval==="quarterly", price=PLAN_PRICES[interval].price;
 return <article className={`zp-plan-card ${quarterly?"zp-plan-featured":""}`}>
  {quarterly&&<span className="zp-plan-kicker">Three-month plan</span>}
  <p className="zp-plan-name">Full Access</p><p className="zp-plan-intro">{quarterly?"One payment for three months of access.":"Flexible monthly billing."}</p>
  <p className="zp-price"><span className="zp-currency">A$</span>{price}<span className="zp-period">/{quarterly?"3 months":"month"}</span></p>
  <p className="zp-trial"><Sparkles size={16} aria-hidden="true"/>{TRIAL_DAYS}-day trial</p>
  <ul className="zp-plan-points"><li><Check size={17} aria-hidden="true"/>Full Access subscription plan</li><li><Check size={17} aria-hidden="true"/>A$1 card check today</li><li><Check size={17} aria-hidden="true"/>Cancel during trial to avoid the plan charge</li></ul>
  <Link className={`zh-button zp-plan-cta ${quarterly?"":"zp-plan-cta-secondary"}`} to="/login">Start {TRIAL_DAYS}-day trial <ArrowRight size={17}/></Link>
  <p className="zp-plan-legal">After the trial, A${price} {quarterly?"every 3 months":"per month"}, renewing until cancelled.</p><p className="zp-plan-legal">{cancelCopy(interval)}</p>
 </article>;
}
export default function Pricing() {
 return <div className="zh-home zp-page" data-zyntra-pricing="canonical">
  <a href="#main" className="zh-skip">Skip to content</a><MarketingHeader/>
  <main id="main">
   <section className="zp-hero"><div className="zh-hero-bg" aria-hidden="true"/><div className="zh-container zp-hero-inner">
    <p className="zh-eyebrow">CLEAR PRICING. NO SURPRISES.</p><h1>Choose your plan.<br/><em>Start with seven days.</em></h1>
    <p className="zh-lede">Explore Zyntra with a 7-day trial, then continue on the billing plan you choose. Your price and cancellation terms are shown before checkout.</p>
    <a className="zh-button" href="#plans">Compare plans <ArrowRight size={17}/></a><p className="zp-hero-note"><ShieldCheck size={16} aria-hidden="true"/>A$1 card check today. Subscription charge after the trial unless you cancel.</p>
   </div></section>
   <section id="plans" className="zh-section zp-plans-section"><div className="zh-container">
    <div className="zh-section-heading zp-heading"><div><p className="zh-eyebrow zh-eyebrow-dark">FULL ACCESS</p><h2>One product. Two billing options.</h2><p className="zh-section-copy">Both plans include the same 7-day trial. Choose the billing interval that suits you.</p></div></div>
    <div className="zp-plan-grid"><PlanCard interval="monthly"/><PlanCard interval="quarterly"/></div><p className="zp-card-check"><CircleHelp size={17} aria-hidden="true"/>{COPY_CARD_CHECK}</p>
   </div></section>
   <section className="zh-section zp-included"><div className="zh-container"><div className="zh-section-heading"><div><p className="zh-eyebrow zh-eyebrow-dark">WHAT'S INCLUDED</p><h2>Know what is ready today.</h2><p className="zh-section-copy">Availability can vary by release. We label features plainly rather than presenting planned work as live.</p></div></div>
    <div className="zp-included-list">{included.map(item=><article className="zp-included-item" key={item.name}><div className="zp-included-copy"><h3>{item.name}</h3><p>{item.detail}</p></div><StatusBadge status={item.status} tone={item.tone}/></article>)}</div>
   </div></section>
   <section className="zh-section zp-trial"><div className="zh-container zp-trial-grid"><div><p className="zh-eyebrow zh-eyebrow-dark">HOW BILLING WORKS</p><h2>Seven days to explore. You stay in control.</h2><p className="zh-section-copy">The checkout page confirms the schedule for your chosen plan before you subscribe.</p></div>
    <ol className="zp-timeline"><li><span>01</span><div><h3>Start your trial</h3><p>A A$1 card check is taken today to confirm your card. It is not a subscription payment.</p></div></li><li><span>02</span><div><h3>Use Zyntra for 7 days</h3><p>Explore the features available in the current release during your trial.</p></div></li><li><span>03</span><div><h3>Continue or cancel</h3><p>If you do not cancel before the trial ends, the selected plan is charged: A$39 monthly or A$99 every three months. Cancel in Settings &gt; Billing to avoid that subscription charge.</p></div></li></ol>
   </div></section>
   <section id="pricing-faq" className="zh-section zp-faq"><div className="zh-container zp-faq-grid"><div><p className="zh-eyebrow zh-eyebrow-dark">PRICING FAQ</p><h2>Good to know before you start.</h2></div><div className="zp-faq-list">{faqs.map((faq,i)=><details key={faq.q} open={i===0}><summary>{faq.q}<span aria-hidden="true">+</span></summary><p>{faq.a}</p></details>)}</div></div></section>
   <section className="zp-final"><div className="zh-container zp-final-inner"><div><p className="zh-eyebrow">YOUR NEXT STEP</p><h2>Make your practice more deliberate.</h2><p>Start with the trial, check the plan terms, and decide whether Zyntra fits your preparation.</p></div><Link className="zh-button" to="/login">Start the 7-day trial <ArrowRight size={17}/></Link></div><p className="zp-independent">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p></section>
  </main><MarketingFooter/><div className="zp-mobile-cta"><Link className="zh-button" to="/login">Start 7-day trial <ArrowRight size={16}/></Link><span>A$1 card check today</span></div>
 </div>;
}
