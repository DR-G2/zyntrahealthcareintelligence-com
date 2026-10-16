import { ArrowRight, BookOpen, Brain, Check, Clock3, Compass, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { featureAvailability } from "@/data/featureAvailability";
import { SEO } from "@/components/SEO";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import { COPY_CARD_CHECK, TRIAL_DAYS } from "@/lib/billing";
import "@/styles/zyntra-home.css";
import "@/styles/zyntra-amc-mcq.css";

const pageUrl = "https://www.zyntrahealthcareintelligence.com/amc-part-1-mcq";

const faqs = [
  {
    q: "What is the AMC MCQ exam?",
    a: "The AMC CAT MCQ examination is a computer-administered multiple-choice examination used in the Standard Pathway. The Australian Medical Council publishes the current structure, content and candidate requirements on its official website.",
  },
  {
    q: "Who needs to sit the AMC MCQ exam?",
    a: "The Standard Pathway is for international medical graduates seeking general registration who are not eligible for the Competent Authority Pathway. The right pathway depends on your qualifications and circumstances, so check the AMC's official pathway guidance.",
  },
  {
    q: "How should I use AMC MCQ practice questions?",
    a: "Use practice questions to work through clinical problems, review explanations and identify topics that need more study. Consider your reasoning and timing as well as whether your answer was correct. Practice questions are preparation, not a guarantee of an exam result.",
  },
  {
    q: "How does Zyntra support AMC MCQ preparation?",
    a: "Zyntra provides AMC-style practice and explanations, with available performance features that can help you review timing, confidence and answer changes. Some features require an account, and availability can vary by release.",
  },
  {
    q: "Are Zyntra questions recalled from the AMC exam?",
    a: "No. Zyntra's practice content is intended for education and is not presented as recalled or official AMC examination material.",
  },
  {
    q: "Is Zyntra affiliated with the Australian Medical Council?",
    a: "No. Zyntra is independent of, and not affiliated with, the Australian Medical Council. The AMC is the source for official exam requirements, eligibility and scheduling information.",
  },
];

const features = [
  {
    icon: BookOpen,
    title: "AMC-style MCQ practice",
    body: "Work through clinical questions and review the reasoning behind an answer.",
    status: featureAvailability.mcqPractice.status,
    tone: featureAvailability.mcqPractice.tone,
  },
  {
    icon: Check,
    title: "Explanations and review",
    body: "Use explanations to revisit the clinical reasoning and strengthen topic knowledge.",
    status: featureAvailability.mcqPractice.status,
    tone: featureAvailability.mcqPractice.tone,
  },
  {
    icon: Clock3,
    title: "Timing and answer changes",
    body: "Review available signals such as time spent and whether you changed your answer.",
    status: featureAvailability.performanceIntelligence.status,
    tone: featureAvailability.performanceIntelligence.tone,
  },
  {
    icon: Brain,
    title: "Confidence signals",
    body: "Where enabled, compare confidence with performance to find areas worth reviewing.",
    status: featureAvailability.confidence.status,
    tone: featureAvailability.confidence.tone,
  },
  {
    icon: Target,
    title: "Study Plan",
    body: "Use the available planning tools to organise your next areas of practice.",
    status: featureAvailability.studyPlan.status,
    tone: featureAvailability.studyPlan.tone,
  },
  {
    icon: Compass,
    title: featureAvailability.oscePractice.name,
    body: featureAvailability.oscePractice.summary,
    status: featureAvailability.oscePractice.status,
    tone: featureAvailability.oscePractice.tone,
  },
] as const;

function StatusBadge({ status, tone }: { status: string; tone: string }) {
  return <span className={`zam-status zam-status-${tone}`}><span aria-hidden="true" />{status}</span>;
}

export default function AmcPart1Mcq() {
  return (
    <div className="zh-home zam-page">
      <SEO
        title="AMC Part 1 MCQ Preparation | Zyntra"
        description="Prepare for the AMC CAT MCQ exam with AMC-style practice, explanations and performance signals for timing, confidence and answer changes. Independent of the AMC."
        path="/amc-part-1-mcq"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "AMC Part 1 MCQ Preparation",
            url: pageUrl,
            description: "Independent AMC Part 1 MCQ preparation with practice questions, explanations and performance review tools.",
          },
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: "AMC Part 1 MCQ preparation",
            description: "Self-paced online practice for AMC-style clinical reasoning. Not an official AMC course.",
            url: pageUrl,
            provider: {
              "@type": "Organization",
              name: "Zyntra Healthcare Intelligence",
              url: "https://www.zyntrahealthcareintelligence.com/",
            },
            hasCourseInstance: { "@type": "CourseInstance", courseMode: "online" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          },
        ]}
      />

      <a className="zh-skip" href="#main">Skip to content</a>
      <MarketingHeader />

      <main id="main">
        <section className="zam-hero">
          <div className="zh-hero-bg" aria-hidden="true" />
          <div className="zh-container zam-hero-inner">
            <p className="zh-eyebrow">AMC EXAM PREPARATION</p>
            <h1>Prepare for the AMC MCQ with practice that studies <em>how you think.</em></h1>
            <p className="zh-lede">Practise clinical questions, review explanations and learn from the patterns in your answers.</p>
            <div className="zam-hero-actions">
              <Link className="zh-button" to="/pricing">Explore the trial <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className="zh-button-outline" to="/how-it-works">How Zyntra works <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <p className="zam-hero-note"><ShieldCheck size={16} aria-hidden="true" />Independent preparation support, not an official AMC resource.</p>
          </div>
        </section>

        <section className="zh-section zam-exam" aria-labelledby="zam-exam-title">
          <div className="zh-container zam-two-col">
            <div>
              <p className="zh-eyebrow zh-eyebrow-dark">THE EXAM</p>
              <h2 id="zam-exam-title">About the AMC MCQ exam</h2>
              <p className="zh-section-copy">The AMC CAT MCQ examination is part of the Australian Medical Council's Standard Pathway assessment process for eligible international medical graduates.</p>
              <p className="zam-body">The AMC describes the exam as a computer-administered multiple-choice examination. Its official page lists 150 questions in one 3.5-hour session and explains the clinical knowledge areas assessed. Always check the current specifications for the latest requirements.</p>
              <a className="zam-source-link" href="https://www.amc.org.au/pathways/standard-pathway/amc-assessments/mcq-examination/" target="_blank" rel="noreferrer">Read the official AMC MCQ exam guidance <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <aside className="zam-fact-card" aria-label="Official AMC exam overview">
              <span className="zam-fact-icon"><BookOpen size={21} aria-hidden="true" /></span>
              <p className="zam-fact-label">OFFICIAL SOURCE</p>
              <h3>Check the current specifications</h3>
              <p>The AMC publishes exam structure, content, eligibility and scheduling information. Use its guidance for official decisions and requirements.</p>
              <a href="https://www.amc.org.au/examination-specifications/" target="_blank" rel="noreferrer">AMC examination specifications <ArrowRight size={15} aria-hidden="true" /></a>
            </aside>
          </div>
        </section>

        <section className="zh-section zam-features" aria-labelledby="zam-features-title">
          <div className="zh-container">
            <div className="zh-section-heading zam-section-heading">
              <div>
                <p className="zh-eyebrow zh-eyebrow-dark">PRACTISE WITH PURPOSE</p>
                <h2 id="zam-features-title">How Zyntra helps you prepare</h2>
                <p className="zh-section-copy">Question practice is the starting point. Review explanations and the performance signals available in your activity, then choose an area to revisit. Automated next-action and broader intelligence capabilities vary by release.</p>
              </div>
            </div>
            <div className="zam-feature-grid">
              {features.map(({ icon: Icon, title, body, status, tone }) => (
                <article className="zam-feature-card" key={title}>
                  <span className="zam-feature-icon"><Icon size={19} aria-hidden="true" /></span>
                  <div className="zam-feature-title"><h3>{title}</h3><StatusBadge status={status} tone={tone} /></div>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="zh-section zam-sample" aria-labelledby="zam-sample-title">
          <div className="zh-container zam-sample-grid">
            <div>
              <p className="zh-eyebrow zh-eyebrow-dark">A LOOK AT PRACTICE</p>
              <h2 id="zam-sample-title">A sample question</h2>
              <p className="zh-section-copy">This illustrative example shows how a clinical question and an ECG can appear in a practice interface. It is not an official AMC question or a diagnostic tool.</p>
              <p className="zam-illustrative"><Sparkles size={15} aria-hidden="true" />Illustrative example</p>
            </div>
            <article className="zam-question-card">
              <div className="zam-question-head"><b>Example AMC-style question</b><span>Illustrative</span></div>
              <p>A 52-year-old man presents with exertional chest pain. ECG is shown. What is the most likely diagnosis?</p>
              <div className="zam-question-content">
                <ul className="zam-options" aria-label="Illustrative answer options">
                  {["Stable angina", "NSTEMI", "STEMI", "Pericarditis"].map((option, index) => (
                    <li key={option}><b>{String.fromCharCode(65 + index)}</b><span>{option}</span></li>
                  ))}
                </ul>
                <div className="zam-ecg" role="img" aria-label="Illustrative electrocardiogram trace">
                  <svg viewBox="0 0 190 130" aria-hidden="true">
                    <defs><pattern id="zam-ecg-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#efb4b4" strokeWidth=".55" /></pattern></defs>
                    <rect width="190" height="130" fill="url(#zam-ecg-grid)" />
                    <path d="M0 35 H20 L25 30 L30 42 L35 16 L41 66 L47 35 H67 L72 30 L77 42 L82 16 L88 66 L94 35 H114 L119 30 L124 42 L129 16 L135 66 L141 35 H161 L166 30 L171 42 L176 16 L182 66 L190 35" fill="none" stroke="#203c49" strokeWidth="1.6" />
                    <path d="M0 92 H22 L29 87 L35 102 L41 70 L47 114 L53 92 H74 L81 86 L87 101 L93 69 L99 114 L105 92 H126 L133 86 L139 101 L145 69 L151 114 L157 92 H190" fill="none" stroke="#203c49" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
              <p className="zam-question-note">Illustrative only. This trace and question are for layout demonstration and should not be used for clinical decisions.</p>
            </article>
          </div>
        </section>

        <section className="zh-section zam-audience" aria-labelledby="zam-audience-title">
          <div className="zh-container zam-audience-grid">
            <div>
              <p className="zh-eyebrow zh-eyebrow-dark">WHO IT IS FOR</p>
              <h2 id="zam-audience-title">Preparation for medical graduates and IMGs</h2>
              <p className="zh-section-copy">Zyntra is for people who want a structured way to practise clinical questions and review their reasoning.</p>
            </div>
            <div className="zam-audience-cards">
              <article><span><BookOpen size={19} aria-hidden="true" /></span><h3>Medical graduates</h3><p>Use AMC-style practice to revisit clinical topics and work through explanations at your own pace.</p></article>
              <article><span><Brain size={19} aria-hidden="true" /></span><h3>International medical graduates</h3><p>Build a regular study routine while you work through the official AMC guidance and your own preparation plan.</p></article>
            </div>
          </div>
        </section>

        <section id="zam-faq" className="zh-section zam-faq" aria-labelledby="zam-faq-title">
          <div className="zh-container zam-faq-grid">
            <div>
              <p className="zh-eyebrow zh-eyebrow-dark">COMMON QUESTIONS</p>
              <h2 id="zam-faq-title">AMC MCQ preparation FAQ</h2>
              <p className="zh-section-copy">For exam eligibility, structure and scheduling, rely on current AMC guidance.</p>
            </div>
            <div className="zam-faq-list">
              {faqs.map((faq, index) => (
                <details key={faq.q} open={index === 0}>
                  <summary>{faq.q}<span aria-hidden="true">+</span></summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="zam-final">
          <div className="zh-container zam-final-inner">
            <div>
              <p className="zh-eyebrow">YOUR NEXT STEP</p>
              <h2>Make your next practice session count.</h2>
              <p>Explore the available tools, review the plan terms and choose a study routine that works for you.</p>
            </div>
            <Link className="zh-button" to="/pricing">Explore the {TRIAL_DAYS}-day trial <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <p className="zam-card-check">{COPY_CARD_CHECK}</p>
          <p className="zam-independent">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p>
        </section>

        <nav className="zam-related" aria-label="Related resources">
          <Link to="/">Home</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
      </main>

      <MarketingFooter />
      <div className="zam-mobile-cta">
        <Link className="zh-button" to="/pricing">Explore {TRIAL_DAYS}-day trial <ArrowRight size={16} aria-hidden="true" /></Link>
        <span>A$1 card check</span>
      </div>
    </div>
  );
}
