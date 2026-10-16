import { ArrowRight, CheckCircle2, EyeOff, Mail, ShieldCheck, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import { COPY_CARD_CHECK, TRIAL_DAYS, PLAN_PRICES, cancelCopy } from "@/lib/billing";
import "@/styles/zyntra-home.css";
import "@/styles/zyntra-about.css";
import "@/styles/zyntra-tokens.css";

const principles = [
  { icon: Target, title: "The process matters", copy: "A right or wrong answer is one part of the picture. How you reached it can also help guide your next practice step." },
  { icon: CheckCircle2, title: "Honest feedback comes first", copy: "We aim to show what the available evidence supports, and to be clear when it does not tell the whole story." },
  { icon: EyeOff, title: "Patterns are not verdicts", copy: "Practice signals can offer useful clues. They are not a diagnosis, a prediction or a measure of your worth as a doctor." },
  { icon: ShieldCheck, title: "No promises about outcomes", copy: "Preparation takes work, and exam results depend on many factors. Zyntra does not guarantee a pass." },
];

export default function About() {
  return (
    <div className="zh-home za-page" data-zyntra-about="canonical">
      <a href="#main" className="zh-skip">Skip to content</a>
      <MarketingHeader />
      <main id="main">
        <section className="zh-hero za-hero">
          <div className="zh-hero-bg" aria-hidden="true" />
          <div className="zh-container za-hero-inner">
            <p className="zh-eyebrow">ABOUT ZYNTRA</p>
            <h1>Built by a doctor, for doctors preparing for the <em>AMC.</em></h1>
            <p className="zh-lede">A more deliberate way to practise, review your decisions and understand where to focus next.</p>
            <a className="zh-button" href="#why-zyntra">Why Zyntra exists <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
          <div className="za-hero-mark" aria-hidden="true"><span>01</span><i /><i /><i /><b>Z</b></div>
        </section>
        <section className="zh-section za-founder" id="why-zyntra">
          <div className="zh-container za-founder-grid">
            <div className="za-section-intro">
              <p className="zh-eyebrow zh-eyebrow-dark">WHY ZYNTRA EXISTS</p>
              <h2>Making a difficult process more considered.</h2>
              <p className="zh-section-copy">The purpose is simple: make it easier to practise with intention, learn from each attempt and decide what to work on next.</p>
            </div>
            <div className="za-founder-note">
              <h3>A more structured way to prepare.</h3>
              <p>Zyntra brings practice and available performance insights together to help candidates review their decisions, recognise areas to revisit and choose a focused next step.</p>
              <p>We aim to describe the product and its limits clearly, especially while features are in beta.</p>
            </div>
          </div>
        </section>
        <section className="zh-section za-beliefs">
          <div className="zh-container">
            <div className="za-section-heading"><p className="zh-eyebrow zh-eyebrow-dark">WHAT WE BELIEVE</p><h2>Useful practice starts with honest signals.</h2><p className="zh-section-copy">These principles guide how we describe Zyntra and the feedback it provides.</p></div>
            <div className="za-principle-grid">
              {principles.map(({ icon: Icon, title, copy }, index) => <article className="za-principle" key={title}><span className="za-principle-number">0{index + 1}</span><span className="za-principle-icon"><Icon size={22} aria-hidden="true" /></span><h3>{title}</h3><p>{copy}</p></article>)}
            </div>
          </div>
        </section>
        <section className="zh-section za-boundaries">
          <div className="zh-container za-boundaries-grid">
            <div><p className="zh-eyebrow zh-eyebrow-dark">WHAT ZYNTRA IS AND IS NOT</p><h2>A practice tool, not a promise.</h2><p className="zh-section-copy">Zyntra is designed to support learning and reflection during AMC exam preparation. It does not replace official guidance, professional judgement or independent study.</p></div>
            <div className="za-boundary-list">
              <article><span className="za-boundary-check"><CheckCircle2 size={19} aria-hidden="true" /></span><div><h3>What it is</h3><p>A practice and insight tool to help you review answers, consider patterns and identify areas to revisit.</p></div></article>
              <article><span className="za-boundary-no" aria-hidden="true">×</span><div><h3>What it is not</h3><p>Not a pass guarantee, not medical advice, and not a substitute for official AMC requirements or guidance.</p></div></article>
              <p className="za-independent">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p>
            </div>
          </div>
        </section>
        <section className="zh-section za-beta">
          <div className="zh-container za-beta-card"><div className="za-beta-symbol" aria-hidden="true"><span /><span /><span /></div><div><p className="zh-eyebrow">WHERE WE ARE NOW</p><h2>Zyntra is in beta.</h2><p>We are improving the product as we learn what helps candidates practise and review their decisions. Features and availability may change between releases. We will describe what is available as clearly as we can.</p></div><span className="za-beta-status"><i aria-hidden="true" /> In beta</span></div>
        </section>
        <section className="zh-section za-contact">
          <div className="zh-container za-contact-inner"><div><p className="zh-eyebrow zh-eyebrow-dark">CONTACT</p><h2>Have a question or feedback?</h2><p className="zh-section-copy">For questions about Zyntra, send us a note. We welcome clear feedback about the product.</p></div><a className="za-contact-link" href="mailto:hello@zyntrahealthcareintelligence.com"><span><Mail size={20} aria-hidden="true" /></span><span><small>EMAIL ZYNTRA</small><strong>hello@zyntrahealthcareintelligence.com</strong></span><ArrowRight size={18} aria-hidden="true" /></a></div>
        </section>
        <section className="za-final">
          <div className="zh-container za-final-inner"><div><p className="zh-eyebrow">YOUR NEXT STEP</p><h2>Make your practice more deliberate.</h2><p>Explore the current release and decide whether Zyntra fits the way you prepare.</p></div><div className="za-final-action"><Link className="zh-button" to="/login">Start {TRIAL_DAYS}-day trial <ArrowRight size={17} aria-hidden="true" /></Link><p>{COPY_CARD_CHECK}</p><small>After the trial, A${PLAN_PRICES.monthly.price} monthly or A${PLAN_PRICES.quarterly.price} every 3 months, unless cancelled. {cancelCopy("monthly")} {cancelCopy("quarterly")}</small></div></div>
          <p className="za-final-independent">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p>
        </section>
      </main>
      <MarketingFooter />
      <div className="za-mobile-cta"><Link className="zh-button" to="/login">Start {TRIAL_DAYS}-day trial <ArrowRight size={16} aria-hidden="true" /></Link><span>A$1 card check today</span></div>
    </div>
  );
}
