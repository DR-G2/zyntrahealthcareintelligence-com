import { ArrowRight, ChevronDown, CircleHelp } from "lucide-react";
import { Link } from "react-router-dom";
import { featureAvailability } from "@/data/featureAvailability";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import { COPY_CARD_CHECK, TRIAL_DAYS, PLAN_PRICES, cancelCopy } from "@/lib/billing";
import "@/styles/zyntra-home.css";
import "@/styles/zyntra-faq.css";

const faqGroups = [
  { title: "About Zyntra", eyebrow: "THE BASICS", questions: [
    { q: "What is Zyntra?", a: <>Zyntra is an independent AMC exam preparation platform. It combines MCQ practice with available performance insights to help you review attempts and decide what to practise next. Read <Link to="/how-it-works">how it works</Link>.</> },
    { q: "Who is it for?", a: <>Zyntra is designed for international medical graduates and other doctors preparing for the Australian Medical Council exams. The available tools depend on the current release.</> },
    { q: "Is Zyntra affiliated with the AMC?", a: <>No. Zyntra is independent of, and not affiliated with, the Australian Medical Council. Always use the AMC's official guidance for exam requirements.</> },
    { q: "Is it a question bank?", a: <>MCQ practice is part of Zyntra, but the aim is broader than marking an answer right or wrong. The platform also presents available practice signals, such as timing and answer changes, to help you reflect. See <Link to="/features">the current feature list</Link>.</> },
  ]},
  { title: "How it works", eyebrow: "PRACTICE AND INSIGHT", questions: [
    { q: "What is PIE?", a: <>PIE means Performance Intelligence Engine. It is designed to interpret available practice signals and help you consider a useful next step. Its insights are clues for reflection, not a diagnosis or a verdict. Explore <Link to="/how-it-works">how PIE works</Link>.</> },
    { q: "What does Zyntra track?", a: <>Depending on the activity and current release, practice signals can include selected answers and correctness, response timing, answer changes, reported confidence and session history. The exact signals available can vary by feature. See the <Link to="/privacy">Privacy Policy</Link> for the published data categories.</> },
    { q: "Does it predict my result?", a: <>No. Zyntra does not predict or guarantee an exam result. Practice patterns can be incomplete or uncertain, especially when based on a small number of attempts.</> },
    { q: "How many questions do I need before insights are useful?", a: <>There is no single question count that makes every insight reliable. More attempts can provide more context, while a small sample can be misleading. Treat early patterns as tentative and use them alongside your own review.</> },
  ]},
  { title: "Pricing and trial", eyebrow: "BILLING, CLEARLY", questions: [
    { q: "How much does it cost?", a: <>Full Access is A$${PLAN_PRICES.monthly.price} AUD per month or A$${PLAN_PRICES.quarterly.price} AUD every 3 months, after the {TRIAL_DAYS}-day trial unless cancelled. See <Link to="/pricing">full pricing details</Link>.</> },
    { q: "What is the 7-day trial?", a: <>The trial gives you {TRIAL_DAYS} days before the first subscription charge. An A$1 card check is taken today. If you do not cancel before the trial ends, your selected plan is charged on the trial-end date. The exact terms are shown in checkout.</> },
    { q: "What is the A$1 card check?", a: <>{COPY_CARD_CHECK}</> },
    { q: "How do I cancel?", a: <>{cancelCopy("monthly")} {cancelCopy("quarterly")}</> },
    { q: "What happens after the trial?", a: <>If you do not cancel before the trial ends, the selected plan begins billing on the trial-end date. The monthly plan is A$${PLAN_PRICES.monthly.price} each month. The three-month plan is A$${PLAN_PRICES.quarterly.price} every 3 months. {cancelCopy("monthly")} {cancelCopy("quarterly")}</> },
  ]},
  { title: "Features and availability", eyebrow: "WHAT IS AVAILABLE", questions: [
    { q: "What is live today?", a: <><Link to="/features">The feature list</Link> marks MCQ practice and core Performance Intelligence as {featureAvailability.mcqPractice.status} and {featureAvailability.performanceIntelligence.status}. AI Study Lab and Study Plan are {featureAvailability.aiStudyLab.status}. Other intelligence views are marked individually because availability varies by capability.</> },
    { q: "Is OSCE available?", a: <>{featureAvailability.oscePractice.name} is marked {featureAvailability.oscePractice.status}. Clinical station practice is not live in the current public release.</> },
    { q: "What is in beta?", a: <>{featureAvailability.aiStudyLab.name}, {featureAvailability.studyPlan.name}, {featureAvailability.behaviour.name}, {featureAvailability.confidence.name}, {featureAvailability.evidence.name}, {featureAvailability.interventions.name}, and {featureAvailability.historyProgress.name} are marked {featureAvailability.aiStudyLab.status}. See <Link to="/features">all feature statuses</Link> for capability-specific notes.</> },
  ]},
  { title: "Data and privacy", eyebrow: "YOUR INFORMATION", questions: [
    { q: "What data does Zyntra store?", a: <>The published <Link to="/privacy">Privacy Policy</Link> describes account and profile data; learning and diagnostic data; technical and security data; payment tokens and transaction metadata; support communications; and information associated with AI Lab and voice practice. The information involved can depend on the feature you use. The policy describes the published terms, but is not independent confirmation of every production data flow.</> },
    { q: "Is my data private?", a: <><Link to="/privacy">The published Privacy Policy</Link> describes safeguards, service-provider disclosures and states that personal information is not sold for monetary consideration. These are statements in the policy, not independent confirmation of every production access control or data flow. Do not submit real patient records or identifiable patient information.</> },
  ]},
];

export default function FAQ() {
  return <div className="zh-home zf-page" data-zyntra-faq="canonical">
    <a href="#main" className="zh-skip">Skip to content</a>
    <MarketingHeader />
    <main id="main">
      <section className="zh-hero zf-hero"><div className="zh-hero-bg" aria-hidden="true" /><div className="zh-container zf-hero-inner">
        <p className="zh-eyebrow">ZYNTRA FAQ</p><h1>Good questions deserve <em>clear answers.</em></h1>
        <p className="zh-lede">Understand the product, PIE, pricing and what is available before you begin.</p>
        <a className="zh-button" href="#faq-answers">Browse questions <ArrowRight size={17} aria-hidden="true" /></a>
      </div><div className="zf-hero-mark" aria-hidden="true"><CircleHelp /><span>ANSWERS, NOT ASSUMPTIONS</span></div></section>
      <section className="zh-section zf-content" id="faq-answers"><div className="zh-container">
        <div className="zf-intro"><p className="zh-eyebrow zh-eyebrow-dark">HELP BEFORE YOU START</p><h2>Find the answer you need.</h2><p>Choose a question to open its answer. Answers describe the current product and published terms. Features can change while Zyntra is in beta.</p></div>
        <div className="zf-groups">{faqGroups.map((group, groupIndex) => <section className="zf-group" key={group.title} aria-labelledby={`zf-group-${groupIndex}`}>
          <header className="zf-group-heading"><span className="zf-group-number">0{groupIndex + 1}</span><div><p className="zh-eyebrow zh-eyebrow-dark">{group.eyebrow}</p><h2 id={`zf-group-${groupIndex}`}>{group.title}</h2></div></header>
          <div className="zf-accordion">{group.questions.map((item) => <details className="zf-item" key={item.q}><summary><span>{item.q}</span><ChevronDown size={19} aria-hidden="true" /></summary><div className="zf-answer"><p>{item.a}</p></div></details>)}</div>
        </section>)}</div>
      </div></section>
      <section className="zh-cta zf-final"><div className="zh-container zf-final-inner">
        <div><p className="zh-eyebrow">READY WHEN YOU ARE</p><h2>Start with a clearer picture.</h2><p>Try the current release and see whether Zyntra fits your preparation.</p></div>
        <div className="zf-final-action"><Link to="/login" className="zh-button">Start {TRIAL_DAYS}-day trial <ArrowRight size={17} aria-hidden="true" /></Link>
          <p>A$1 card check today. Then A$${PLAN_PRICES.monthly.price} monthly or A$${PLAN_PRICES.quarterly.price} every 3 months, unless cancelled.</p>
          <small>{COPY_CARD_CHECK} {cancelCopy("monthly")} {cancelCopy("quarterly")}</small><Link to="/pricing" className="zf-pricing-link">Review pricing and terms <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      </div><p className="zf-independent">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p></section>
    </main><MarketingFooter />
    <div className="zh-mobile-cta zf-mobile-cta"><Link to="/login">Start {TRIAL_DAYS}-day trial <ArrowRight size={16} aria-hidden="true" /></Link></div>
  </div>;
}
