import React, { useEffect, useState } from "react";
import { ArrowLeftRight, ArrowRight, BarChart3, Brain, ChevronRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { COPY_CARD_CHECK, COPY_CANCEL } from "@/lib/billing";
import "@/styles/quiet-home.css";

const signals = [
  { title: "Confidence", icon: Brain, desc: "How sure you felt when you chose an answer." },
  { title: "Timing", icon: Clock, desc: "How long a decision took under the clock." },
  { title: "Answer changes", icon: ArrowLeftRight, desc: "When an answer changed, and whether it helped." },
  { title: "Consistency", icon: BarChart3, desc: "How performance varies across practice sessions." },
];

const why = [
  "A conventional question bank marks the option. Zyntra can also keep timing, confidence and answer changes.",
  "Those signals feed Performance Intelligence and the Study Plan, so preparation can consider how you reach an answer, not only whether it was correct.",
  "Built for medical students, medical graduates and doctors, including IMGs, preparing for AMC examinations.",
];

const mcqOptions = [
  "Oral amoxicillin and review in 48 hours",
  "Intravenous benzylpenicillin and urgent hospital transfer",
  "Lumbar puncture in the clinic before any antibiotic",
  "Paracetamol and safety-netting advice only",
  "Await blood culture results before treating",
];

const loop = [
  ["Observe", "Timing, confidence and answer changes are captured as you practise."],
  ["Diagnose", "Patterns can help reveal the kind of mistake that keeps recurring."],
  ["Intervene", "Training can focus on the area that needs more work."],
  ["Measure", "Later practice helps show whether the pattern changed."],
  ["Improve with practice", "Performance Intelligence and the Study Plan help guide the next step."],
] as const;

const trainingItems = [
  ["Practice · MCQ", "The current practice room for questions, explanations, timing, confidence and answer changes."],
  ["OSCE", "A clinical practice direction being developed. Availability depends on the current release."],
  ["Flashcards", "A focused review approach for revisiting mistakes and weak areas as supported by the product."],
  ["Performance", "Find your patterns accuracy and how performance varies across practice."],
  ["Behaviour", "Explore timing, hesitation, answer changes, consistency and confidence where recorded."],
  ["Trust Your Gut", "Examine what happens when an initial answer is changed."],
  ["Study Plan", "Review available priorities, weak areas and an exam timeline when one is set."],
] as const;

const faqs = [
  ["What is Zyntra?", "Zyntra is an AMC exam preparation platform for medical graduates and international medical graduates (IMGs)."],
  ["Who is it for?", "For medical graduates and IMGs preparing for AMC exams."],
  ["Is Zyntra a question bank?", "It combines MCQ practice with performance insights such as timing, confidence and answer changes."],
  ["How much does it cost?", "Full Access is listed at A$39 per month or A$99 for 3 months (AUD). Both options include a 7-day free trial. Review the checkout details before subscribing."],
  ["What does Zyntra track?", "Accuracy, timing, confidence and answer changes, where available."],
] as const;


const Kicker = ({ children }: { children: React.ReactNode }) => <p className="q-eyebrow">{children}</p>;

const BrushDivider = () => (
  <div className="q-brush-divider" aria-hidden="true">
    <svg viewBox="0 0 1440 23" preserveAspectRatio="none">
      <path d="M0 11 C170 8 290 17 455 11 S750 7 915 12 S1210 16 1440 9" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M0 15 C240 11 420 19 620 14 S990 11 1190 15 S1370 13 1440 14" fill="none" stroke="currentColor" strokeWidth=".5" />
    </svg>
  </div>
);

const Home: React.FC = () => {
  
  useEffect(() => {
    const root = document.querySelector(".home-quiet");
    if (!root) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealItems = Array.from(root.querySelectorAll<HTMLElement>(".q-reveal"));
    const perception = root.querySelector<HTMLElement>(".q-perception");
    const progress = root.querySelector<HTMLElement>(".q-progress");

    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach((el) => el.classList.add("is-visible"));
      perception?.classList.add("is-visible");
      progress?.classList.add("is-visible");
      return;
    }

    revealItems.forEach((el) => el.classList.add("q-pending"));
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        entry.target.classList.remove("q-pending");
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -32px 0px" });

    revealItems.forEach((el) => observer.observe(el));
    if (perception) observer.observe(perception);
    if (progress) observer.observe(progress);
    return () => observer.disconnect();
  }, []);

  return (
    <div data-zyntra-home="canonical" className="home-quiet relative min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <header className="q-header">
        <nav className="q-wrap q-nav" aria-label="Main navigation">
          <a className="q-brand" href="#top" aria-label="Zyntra home"><BrandMark className="h-9 w-9" /><span>Zyntra</span></a>
          <span className="q-nav-note">Healthcare intelligence for IMGs</span>
          <div className="q-nav-links">
            <Link to="/blog" className="q-nav-link">Journal</Link>
            <a href="#pricing" className="q-nav-link">Pricing</a>
            <a href="#faq" className="q-nav-link">FAQ</a>
            <Link to="/login" className="q-nav-link">Log in</Link>
            <Link to="/login" className="q-nav-link q-nav-cta">Get started <span aria-hidden="true">↗</span></Link>
          </div>
        </nav>
      </header>

      <main id="main">
        <section id="top" className="q-hero" aria-labelledby="q-hero-title">
          <div className="q-hero-paper" aria-hidden="true" /><div className="q-wash q-wash-one" aria-hidden="true" /><div className="q-wash q-wash-two" aria-hidden="true" />
          <div className="q-wrap q-hero-inner">
            <div className="q-hero-grid">
              <div className="q-hero-copy">
                <Kicker>AMC exam preparation for IMGs</Kicker>
                <h1 id="q-hero-title">Less noise.<br /><em>Better decisions.</em></h1>
                <p className="q-hero-description">Prepare for the Australian Medical Council (AMC) exams with focused MCQ practice and insights into your clinical reasoning, confidence and answer patterns.</p>
                <div className="q-hero-actions">
                  <Link to="/login" className="q-button">Start practising <ArrowRight aria-hidden="true" /></Link>
                  <Link to="/amc-part-1-mcq" className="q-button-ghost">AMC exam preparation <ChevronRight aria-hidden="true" /></Link>
                </div>
                <div className="q-trust-points"><span>Evidence-led insights</span><span>Focused MCQ practice</span><span>Personalised study</span></div>
              </div>
              <aside className="q-hero-aside q-anatomy-plate" aria-label="Illustrated anatomical profile showing the brain, neural pathways and spinal cord, with Japanese ink landscape accents">
                <svg className="q-anatomy-art" viewBox="0 0 560 570" role="img" aria-labelledby="q-anatomy-title">
                  <title id="q-anatomy-title">Editorial anatomical illustration of a human profile, exposed brain, neural pathways and spinal cord with ink landscape accents</title>
                  <defs><linearGradient id="q-neural-wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#B9DFDF" stopOpacity=".82"/><stop offset=".7" stopColor="#50D6E5" stopOpacity=".2"/><stop offset="1" stopColor="#167E8A" stopOpacity=".05"/></linearGradient></defs>
                  <g fill="none" stroke="#24343B" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 505 Q55 481 102 500 T196 496 T288 505 T388 493 T555 503 M4 520 Q72 507 138 520 T254 516 T377 520 T555 516" strokeWidth="1.1"/>
                    <path d="M20 493 l18 -37 13 21 16 -43 17 33 14 -17 17 42 M400 492 l16 -31 11 17 16 -39 13 29 14 -14 17 35" strokeWidth="1.1"/>
                    <path d="M458 275 Q452 229 465 190 Q474 168 465 144 M465 190 Q443 174 435 151 M466 170 Q488 156 498 133 M461 209 Q437 199 422 179 M472 154 Q475 131 490 115" strokeWidth="1.1"/>
                    <path d="M480 119 q-14 -13 -22 0 q-2 10 9 14 q11 -3 13 -14 M498 135 q-10 -13 -19 -5 q-5 9 4 15 q10 0 15 -10 M435 152 q-12 -9 -18 1 q0 10 10 12 q8 -4 8 -13" strokeWidth=".8"/>
                    <path d="M40 225 Q19 198 36 173 Q51 154 70 166 Q82 178 72 196 M36 174 Q12 165 19 145 Q30 129 46 141 M67 168 Q71 145 90 145 Q109 147 105 168" strokeWidth="1"/>
                    <path d="M12 450 Q54 423 83 445 T142 446 M381 451 Q427 428 457 448 T548 448" strokeWidth=".8"/>
                  </g>
                  <g>
                    <path d="M316 69 C294 43 256 46 239 68 C212 59 183 80 185 105 C156 117 153 148 172 169 C154 197 173 224 199 231 C203 259 235 274 261 257 C282 280 312 265 326 245 C353 256 382 236 384 211 C410 193 404 163 386 147 C394 119 371 95 346 94 C343 72 329 64 316 69Z" fill="url(#q-neural-wash)" stroke="#24343B" strokeWidth="2.2"/>
                    <path d="M315 72 C300 93 307 109 321 121 C301 139 305 160 321 173 C304 190 309 211 323 223 C308 238 313 250 326 245 M315 79 C285 77 272 97 281 116 C256 122 251 143 270 159 C247 174 254 195 274 204 C260 225 274 242 293 245 M239 77 C220 93 225 113 241 123 C222 141 229 160 247 168 C227 187 235 205 255 211 M346 99 C369 96 379 113 371 132 C393 143 390 164 370 175 C385 192 373 210 354 215 M191 142 C213 132 226 149 217 165 M201 194 C220 182 235 198 230 214 M357 82 C375 76 387 90 381 104" fill="none" stroke="#167E8A" strokeWidth="1.8"/>
                    <path d="M192 160 C155 155 130 173 126 202 C121 226 136 245 157 255 L170 278 L165 307 Q160 325 180 332 L198 338 L203 382 Q222 399 249 382 L259 339 Q286 326 299 296 C312 267 302 241 281 226" fill="#F4F1E8" fillOpacity=".72" stroke="#24343B" strokeWidth="2.2" strokeLinejoin="round"/>
                    <path d="M128 206 L110 215 L130 226 L117 237 L139 243 M158 255 L180 258 L195 249 M170 278 Q184 270 197 278 M164 307 Q183 314 199 305 M180 332 Q198 341 213 329 M203 382 Q229 393 249 382" fill="none" stroke="#24343B" strokeWidth="1.2"/>
                    <path d="M169 190 Q177 170 195 178 M178 210 Q194 199 209 211 M174 229 Q195 222 209 237 M181 250 Q201 244 218 258 M185 276 Q207 268 221 282 M189 301 Q208 293 225 306 M201 326 Q220 316 236 329 M209 349 Q230 340 249 349" fill="none" stroke="#167E8A" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M244 258 Q250 287 242 311 Q238 336 252 361 Q264 386 267 419" fill="none" stroke="#167E8A" strokeWidth="10" opacity=".18" strokeLinecap="round"/>
                    <path d="M244 258 Q250 287 242 311 Q238 336 252 361 Q264 386 267 419" fill="none" stroke="#167E8A" strokeWidth="2.1" strokeLinecap="round"/>
                    <path d="M243 290 Q222 299 215 318 M244 326 Q266 336 271 352 M253 365 Q233 376 232 392 M264 396 Q282 407 283 423" fill="none" stroke="#50D6E5" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M270 418 Q309 435 347 422 M272 429 Q316 450 358 432 M275 441 Q320 462 366 444" fill="none" stroke="#167E8A" strokeWidth="1.2" opacity=".7"/>
                  </g>
                  <g fill="#24343B" fontFamily="Georgia,serif" fontStyle="italic">
                    <text x="385" y="290" fontSize="17">Observe</text><text x="385" y="315" fontSize="17">Find your patterns</text><text x="385" y="340" fontSize="17">Act</text>
                  </g>
                  <g fill="none" stroke="#167E8A" strokeWidth="1" strokeDasharray="3 5"><path d="M380 296 Q352 292 332 250"/><path d="M380 320 Q344 329 270 340"/><path d="M380 345 Q348 380 315 432"/></g>
                  <g fill="#24343B" opacity=".9"><text x="475" y="85" fontSize="16" fontFamily="serif">東北風</text><rect x="472" y="96" width="22" height="28" rx="2" fill="none" stroke="#B24F47" strokeWidth="1.5"/><path d="M478 103 L488 117 M488 103 L478 117" stroke="#B24F47" strokeWidth="1.5"/></g>
                </svg>
              </aside>
            </div>
          </div>
        </section>

        <BrushDivider />

        <section id="about" className="q-section">
          <div className="q-wrap q-split">
            <div className="q-section-intro q-reveal">
              <Kicker>Smarter AMC preparation</Kicker>
              <h2 className="q-title">Prepare with purpose.</h2>
              <p className="q-body">Zyntra combines AMC-style question practice with performance insights, helping you identify knowledge gaps and choose what to revise next.</p>
              <span className="q-margin-note">Built for IMGs preparing for the AMC.</span>
            </div>
            <div className="q-principles">
              <article className="q-principle q-reveal"><span className="q-index">01</span><div><h3>Find your patterns</h3><p>Review accuracy, confidence, timing and answer changes where recorded.</p></div></article>
              <article className="q-principle q-reveal"><span className="q-index">02</span><div><h3>Focus your study</h3><p>Prioritise topics and clinical skills that need more practice.</p></div></article>
              <article className="q-principle q-reveal"><span className="q-index">03</span><div><h3>Improve with practice</h3><p>Use performance trends to guide your next study session.</p></div></article>
            </div>
          </div>
        </section>

        <BrushDivider />

        <section id="how" className="q-section" aria-labelledby="q-signals-title">
          <div className="q-wrap q-split">
            <div className="q-section-intro q-reveal">
              <Kicker>Performance insights</Kicker>
              <h2 id="q-signals-title" className="q-title">More than a score.</h2>
              <p className="q-body">Track accuracy, confidence, timing and answer changes to understand how you approach AMC-style clinical questions.</p>
            </div>
            <div className="q-signal-list">
              {signals.map(({ title, icon: Icon, desc }) => <div className="q-signal q-reveal" key={title}><Icon aria-hidden="true" /><div><strong>{title}</strong><span>{desc}</span></div></div>)}
            </div>
          </div>
          <div className="q-wrap mt-16">
            <Kicker>How Zyntra supports learning</Kicker><h2 className="q-title mt-3">Observe. Find your patterns. Adjust.</h2>
            <ol className="q-principles mt-8 grid gap-x-8 md:grid-cols-5">
              {loop.map(([title, desc], index) => <li className="q-principle q-reveal" key={title} style={{ display: "block" }}><span className="q-index">{String(index + 1).padStart(2, "0")}</span><h3 className="mt-2">{title}</h3><p>{desc}</p></li>)}
            </ol>
          </div>
        </section>

        <BrushDivider />

        <BrushDivider />

        <section id="example-question" className="q-section q-example" aria-labelledby="q-example-title">
          <div className="q-wrap q-example-grid">
            <div className="q-section-intro q-reveal">
              <Kicker>AMC practice, with context</Kicker>
              <h2 id="q-example-title" className="q-title">Understand every attempt.</h2>
              <div className="q-why-list">
                {why.map((point, index) => <p key={point}><span className="q-index">{String(index + 1).padStart(2, "0")}</span><span>{point}</span></p>)}
              </div>
              <p className="q-muted mt-5 text-xs">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p>
            </div>
            <figure className="q-example-card q-reveal" aria-labelledby="q-example-caption">
              <figcaption id="q-example-caption" className="q-card-label">Example question</figcaption>
              <p className="q-example-stem">A 19-year-old presents to a rural general practice with fever, headache and a non-blanching petechial rash on the legs. She is alert, with a heart rate of 118 and blood pressure of 100/60 mmHg. What is the most appropriate immediate step?</p>
              <ol className="q-option-list">
                {mcqOptions.map((option, index) => <li key={option}><span>{String.fromCharCode(65 + index)}</span><p>{option}</p></li>)}
              </ol>
              <div className="q-example-observes">
                <strong>What Zyntra can observe</strong>
                <p>Your first and final answer, confidence level, time to decide, answer changes and options ruled out, where those signals are collected.</p>
              </div>
              <p className="q-illustrative">Static example. No candidate response or score is shown.</p>
            </figure>
          </div>
        </section>

        <section id="next-step" className="q-section q-next" aria-labelledby="q-next-title">
          <div className="q-wrap q-next-grid">
            <div className="q-next-copy q-reveal">
              <Kicker>One useful next step</Kicker><h2 id="q-next-title" className="q-title">Find the next thing worth your attention.</h2>
              <p className="q-body">A good recommendation should do more than tell you to keep going. It should explain what to practise and why that work may be useful.</p>
              <span className="q-hand-note">No crystal ball. Just better questions. ↗</span>
            </div>
            <div className="q-perception q-reveal" aria-label="Illustration of a busy dashboard resolving into one focused practice idea">
              <div className="q-noisy-panels" aria-hidden="true">
                <div className="q-noise-panel"><strong>Weekly score</strong><div className="q-noise-line mid" /><div className="q-noise-line short" /></div>
                <div className="q-noise-panel"><strong>Activity streak</strong><div className="q-noise-line" /><div className="q-noise-line mid" /></div>
                <div className="q-noise-panel"><strong>Topic breakdown</strong><div className="q-noise-line short" /><div className="q-noise-line" /></div>
                <div className="q-noise-panel"><strong>Rank movement</strong><div className="q-noise-line mid" /><div className="q-noise-line short" /></div>
              </div>
              <article className="q-recommendation">
                <p className="q-card-label">Illustrative practice idea</p>
                <div className="q-task-row"><span className="q-task-mark" aria-hidden="true"><Focus your study /></span><div><h3>Practise reasoning under time pressure</h3><p className="q-why">Explain why the best option fits the clinical picture, and why plausible alternatives do not.</p></div></div>
                <div className="q-tags"><span>Clinical reasoning</span><span>Focused practice</span></div>
                <Link to="/login" className="q-text-link">Explore Zyntra <ArrowRight aria-hidden="true" /></Link>
                <p className="q-illustrative">Illustrative, no live candidate data.</p>
              </article>
            </div>
          </div>
        </section>

        <BrushDivider />

        <section id="progress" className="q-section q-progress" aria-labelledby="q-progress-title">
          <div className="q-wrap">
            <div className="q-progress-heading q-reveal">
              <div><Kicker>Progress, made clearer</Kicker><h2 id="q-progress-title" className="q-title">A number is a start, not the whole story.</h2></div>
              <p className="q-body">Useful progress means understanding patterns over time, recognising uncertainty, and checking whether a change in approach actually helps.</p>
            </div>
            <div className="q-progress-content">
              <div className="q-chart-panel q-reveal">
                <div className="q-chart-heading"><h3>Look for the pattern</h3><span>Conceptual illustration</span></div>
                <div className="q-chart-wrap">
                  <svg viewBox="0 0 520 230" role="img" aria-labelledby="q-chart-title q-chart-desc">
                    <title id="q-chart-title">Illustrative practice trend</title><desc id="q-chart-desc">A conceptual line varies across several practice sessions. This is not real candidate data or a prediction.</desc>
                    <g className="q-chart-grid"><path d="M20 28H500M20 72H500M20 116H500M20 160H500M20 204H500" /></g>
                    <path className="q-chart-line" pathLength="420" d="M24 166 C65 155 75 111 120 124 S180 169 222 119 S290 92 326 105 S390 62 424 79 S470 53 496 48" />
                    <g className="q-chart-dots"><circle cx="24" cy="166" r="4" /><circle cx="120" cy="124" r="4" /><circle cx="222" cy="119" r="4" /><circle cx="326" cy="105" r="4" /><circle cx="424" cy="79" r="4" /><circle cx="496" cy="48" r="4" /></g>
                  </svg>
                  <div className="q-chart-labels"><span>Earlier sessions</span><span>Recent sessions</span></div>
                </div>
              </div>
              <aside className="q-progress-note q-reveal"><div className="q-small-rule" aria-hidden="true" /><blockquote>Progress is easier to act on when you can understand it.</blockquote><p>Performance, timing, confidence and consistency can each add context. No single signal tells the whole story, and a trend is not a promise about future results.</p></aside>
            </div>
          </div>
        </section>

        <section id="trains" className="q-section q-bordered">
          <div className="q-wrap">
            <div className="q-section-intro q-reveal q-intro-static"><Kicker>Inside Zyntra</Kicker><h2 className="q-title">A considered training system.</h2></div>
            <div className="q-principles mt-8">
              {trainingItems.map(([title, desc], index) => <article className="q-principle q-reveal" key={title}><span className="q-index">{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{desc}</p></div></article>)}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3"><Link to="/amc-part-1-mcq" className="q-text-link">AMC exam preparation <ArrowRight aria-hidden="true" /></Link><Link to="/blog" className="q-text-link">Read the Journal <ArrowRight aria-hidden="true" /></Link></div>
          </div>
        </section>

        <BrushDivider />

        <section className="q-section" aria-labelledby="q-journal-title">
          <div className="q-wrap">
            <div className="q-journal-heading q-reveal">
              <div><Kicker>Zyntra Journal</Kicker><h2 id="q-journal-title" className="q-title mt-3">A little perspective for the road.</h2><p className="q-muted mt-3 max-w-2xl text-sm">Practical writing on AMC preparation, clinical reasoning, study strategy and learning intelligence.</p></div>
              <Link to="/blog" className="q-text-link">Explore the Journal <ArrowRight aria-hidden="true" /></Link>
            </div>
            <div className="q-principles mt-8">
              <Link to="/blog/amc-part-1-mcq" className="q-principle q-reveal q-row-link"><span className="q-index">01</span><div><h3>AMC exam preparation</h3><p>Build a more deliberate approach to the one-way exam.</p></div><ChevronRight aria-hidden="true" /></Link>
              <Link to="/blog/amc-part-2-osce" className="q-principle q-reveal q-row-link"><span className="q-index">02</span><div><h3>AMC Clinical exam preparation</h3><p>Think clearly when the station clock is running.</p></div><ChevronRight aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="pricing" className="q-section q-bordered">
          <div className="q-wrap"><Kicker>Pricing, without the noise</Kicker><h2 className="q-title mt-3">Straightforward access.</h2>
            <div className="q-principles mt-8">
              <article className="q-principle q-pricing-row q-reveal"><div><h3>Free account</h3><p>Create an account to access available Zyntra features and practice tools.</p></div><div><p className="q-mono">A$0</p><Link to="/login" className="q-text-link">Create account / Log in <ArrowRight aria-hidden="true" /></Link></div></article>
              <article className="q-principle q-pricing-row q-reveal"><div><h3>Full Access</h3><p>MCQ practice, Performance Intelligence and Study Plan, subject to current feature availability.</p></div><div><p className="q-price">A$39 <span>/ month</span></p><p className="q-muted text-sm">or A$99 for 3 months (AUD)</p><p className="q-muted mt-2 text-sm">7-day free trial on both options. Review checkout details before subscribing.</p><p className="q-muted mt-2 text-xs">{COPY_CARD_CHECK} {COPY_CANCEL}</p><Link to="/login" className="q-text-link mt-3">Start your trial <ArrowRight aria-hidden="true" /></Link></div></article>
            </div>
          </div>
        </section>

        <section className="q-closing" aria-labelledby="q-closing-title">
          <div className="q-wrap q-closing-inner"><div className="q-reveal"><Kicker>For international medical graduates</Kicker><h2 id="q-closing-title">Make room to think.</h2><p className="q-closing-copy">Prepare for the AMC with a clearer view of your practice, your patterns and your next step.</p></div><Link to="/login" className="q-button q-reveal">Start practising <ArrowRight aria-hidden="true" /></Link></div>
        </section>

        <section id="faq" className="q-section">
          <div className="q-wrap q-faq-wrap"><Kicker>Good questions</Kicker><h2 className="q-title mt-3">FAQ</h2>
            <div className="q-principles mt-8">{faqs.map(([question, answer]) => <details key={question} className="q-principle q-faq-item"><summary className="q-faq-summary">{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
            <p className="q-muted mt-6 text-xs">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p>
          </div>
        </section>
      </main>

      <footer className="q-footer"><div className="q-wrap q-footer-inner"><a href="#top" className="q-footer-brand">Zyntra</a><span>Healthcare intelligence for the next step in your journey.</span><div className="q-footer-links"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><a href="#faq">FAQ</a></div></div></footer>
    </div>
  );
};

export default Home;