import { Link } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LEGAL_EMAIL } from '@/lib/legal';

const faqs = [
  ['What is Zyntra?', 'Zyntra is an AI-powered AMC exam preparation platform. It records the answer and the way the answer was reached.'],
  ['Who is it for?', 'Medical students, medical graduates and doctors, including IMGs, preparing for AMC examinations.'],
  ['Is Zyntra a question bank?', 'MCQ practice is the live training room. The difference is that timing, confidence and answer changes are kept with the score.'],
  ['What does Zyntra track?', 'Accuracy, timing, confidence, answer changes, consistency and recurring mistakes, where those signals are collected.'],
  ['What is Performance Intelligence?', 'The room that shows how performance varies, not only the score.'],
  ['What is Behaviour?', 'How a candidate approaches a question: timing, hesitation, answer changes, consistency and confidence.'],
  ['What is Trust Your Gut?', 'What happens when a candidate changes an initial answer.'],
  ['How does the 6-question diagnostic work?', 'It is the existing short check. Get Started uses the login flow. The check remains at /check.'],
  ['How does MCQ practice work?', 'AMC-style questions with timing, explanations and the signals above. MCQ is the live mode.'],
  ['How do Flashcards work?', 'Review built from mistakes and weak areas. If no practice exists yet, the deck builds from practice.'],
  ['How does Study Plan work?', 'A current plan from weak areas, practice priorities and exam date, where that data exists. A new plan can be generated once a calendar month.'],
  ['Is OSCE or Surgery available?', 'No. Surgery is marked OSCE · not live yet.'],
  ['Can I use Zyntra on mobile?', 'Yes. The same rooms are available on a phone.'],
  ['How is candidate data handled?', 'Account and attempt data are stored for the signed-in candidate. See the Privacy page for the handling rules.'],
];

const trainingItems = [
  ['Practice · MCQ', 'The live room. Questions, explanations, timing, confidence, answer changes and difficulty.'],
  ['Surgery: OSCE', 'OSCE · not live yet. Stations are not a current training mode.'],
  ['Flashcards', 'Targeted review built from mistakes and weak areas. Your review deck will build from your practice.'],
  ['Performance', 'What the candidate knows, and how that performance varies.'],
  ['Behaviour', 'Timing, hesitation, answer changes, consistency and confidence.'],
  ['Trust Your Gut', 'What happens when an initial answer is changed.'],
  ['Study Plan', 'Current plan, weak areas, practice priorities and exam timeline where a date is set. A personalised plan can be generated from candidate data, once a calendar month.'],
];

const howItems = [
  ['Practice.', 'Answer AMC-style questions.'],
  ['Observe.', 'Timing, confidence and answer changes are captured.'],
  ['Understand.', 'Patterns emerge across those signals.'],
  ['Adapt.', 'Training focuses on what needs work.'],
  ['Progress.', 'Performance Intelligence develops over time.'],
];

function BrainSignalVisual() {
  return (
    <div className="brain-visual" aria-label="Zyntra decision signal visual">
      <svg className="brain-svg" viewBox="0 0 560 430" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="brainStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#25e7ff" />
            <stop offset=".48" stopColor="#2f7cff" />
            <stop offset="1" stopColor="#b34cff" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path className="brain-outline" d="M270 56c-52-28-112 8-110 62-42 2-65 42-48 78-32 31-16 82 28 91 5 43 51 60 84 36 27 33 80 20 91-18 42 9 74-30 59-67 35-34 12-89-31-91 7-42-31-77-73-70z" />
        <path className="brain-fold" d="M230 78c-30 20-18 47 8 52-31 9-34 39-9 54-30 12-25 48 5 54-25 17-9 47 20 46m38-262c28 18 18 47-7 55 29 6 32 37 7 52 29 11 25 46-5 55 24 16 9 43-19 46m-20-266c-12 30-8 52 10 71m-65-67c10 27 5 47-12 62m69 99c-25-3-42 8-47 31m-52-19c20-6 34 5 35 24m-8-126c21 1 34 13 35 32" />
        <circle className="brain-node" cx="274" cy="210" r="10" />
        <circle className="brain-node small" cx="225" cy="171" r="5" />
        <circle className="brain-node small" cx="326" cy="161" r="5" />
        <circle className="brain-node small" cx="230" cy="257" r="5" />
        <circle className="brain-node small" cx="325" cy="264" r="5" />
        <path className="signal-line signal-blue" d="M284 206C340 190 356 150 408 116" />
        <path className="signal-line signal-purple" d="M283 211C356 216 380 208 428 187" />
        <path className="signal-line signal-red" d="M283 216C350 241 379 260 432 261" />
        <path className="signal-line signal-green" d="M278 220C330 272 360 303 415 326" />
        <circle className="signal-end blue" cx="408" cy="116" r="4" />
        <circle className="signal-end purple" cx="428" cy="187" r="4" />
        <circle className="signal-end red" cx="432" cy="261" r="4" />
        <circle className="signal-end green" cx="415" cy="326" r="4" />
      </svg>
      <div className="brain-chip">Z</div>
      <div className="brain-signal-card brain-card-blue"><span className="signal-icon">✦</span><span>Confidence: <b>Observed</b></span></div>
      <div className="brain-signal-card brain-card-purple"><span className="signal-icon">◷</span><span>Timing: <b>Measured</b></span></div>
      <div className="brain-signal-card brain-card-red"><span className="signal-icon">↔</span><span>Answer changes: <b>Tracked</b></span></div>
      <div className="brain-signal-card brain-card-green"><span className="signal-icon">▥</span><span>Consistency: <b>Analysed</b></span></div>
      <div className="brain-caption">Zyntra learns your pattern, then training adapts.</div>
    </div>
  );
}

function MiniRoomPreview() {
  return (
    <div className="mini-room" aria-hidden="true">
      <div className="mini-top"><span className="mini-logo">Z</span><span>Practice</span><span className="mini-pill">MCQ</span></div>
      <div className="mini-question">Your answer is one signal.</div>
      <div className="mini-option"><b>A</b><span>Confidence: Observed</span></div>
      <div className="mini-option active"><b>B</b><span>Timing: Measured</span><span className="mini-check">✓</span></div>
      <div className="mini-option"><b>C</b><span>Answer changes: Tracked</span></div>
      <div className="mini-footer"><span>Confidence</span><span>Timing</span><span>Changes</span></div>
    </div>
  );
}

export default function Home() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('contact_submissions').insert({ name: form.name, email: form.email, category: 'general', message: form.message });
    setSent(true);
  };

  return (
    <div className="zyntra-home">
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="#top" aria-label="Zyntra"><span className="brand-mark" aria-hidden="true"><span>Z</span></span><span className="brand-word">ZYNTRA</span></a>
          <Link to="/login" className="header-cta">Get Started</Link>
        </div>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-stars" aria-hidden="true" />
          <div className="shell hero-layout">
            <div className="hero-copy">
              <p className="eyebrow">What is Zyntra?</p>
              <h1 id="hero-title">Zyntra is an AI-powered AMC exam preparation platform for medical students, medical graduates and doctors preparing for the Australian Medical Council examinations.</h1>
              <p className="hero-lead">Zyntra goes beyond whether an answer is right or wrong. It learns how you approach questions and uses those signals to make preparation more targeted.</p>
              <p className="hero-signal">Your answer is one signal. Your decision process is the dataset.</p>
              <Link to="/login" className="primary-button">Get Started <span className="button-arrow">›</span></Link>
            </div>
            <BrainSignalVisual />
          </div>
          <div className="shell signal-strip">
            <div><span className="strip-icon blue">✦</span><span>Confidence</span><b>Observed</b></div>
            <div><span className="strip-icon purple">◷</span><span>Timing</span><b>Measured</b></div>
            <div><span className="strip-icon red">↔</span><span>Answer changes</span><b>Tracked</b></div>
            <div><span className="strip-icon green">▥</span><span>Consistency</span><b>Analysed</b></div>
          </div>
        </section>

        <section id="about" className="dark-section about-section">
          <div className="shell split-section">
            <div><h2>About Zyntra</h2><p>Zyntra is for medical students, medical graduates and doctors preparing for AMC examinations. A conventional bank marks the option. Zyntra also keeps timing, confidence and answer changes, then uses those signals in Performance Intelligence and the Study Plan.</p></div>
            <MiniRoomPreview />
          </div>
        </section>

        <section id="how" className="dark-section how-section">
          <div className="shell"><h2>How Zyntra works</h2><div className="how-timeline">{howItems.map(([title, text], i) => <div className="timeline-step" key={title}><div className="timeline-node">{String(i + 1).padStart(2,'0')}</div><div className="timeline-line" /><div className="timeline-copy"><h3>{title}</h3><p>{text}</p></div></div>)}</div></div>
        </section>

        <section id="trains" className="dark-section training-section">
          <div className="shell"><h2>How Zyntra trains</h2><div className="training-list">{trainingItems.map(([title, description], i) => <article className="training-row" key={title}><span className="training-no">{String(i + 1).padStart(2,'0')}</span><div className="training-title">{title}</div><p>{description}</p></article>)}</div></div>
        </section>

        <section id="pricing" className="pricing-section">
          <div className="shell"><h2>Pricing</h2><p className="pricing-intro">Three ways in</p><div className="pricing-list">
            <article className="price-row"><div><h3>Free</h3><div className="price-main">$0</div><div className="price-note">APPE diagnostic only</div></div><div className="price-detail"><p>One diagnostic. It records timing, answer changes and confidence.</p><p>You see the pattern from that sitting. That is the free product.</p><p>No question bank, no study plan, no flashcards.</p><Link to="/login" className="secondary-button">Button: Start the diagnostic</Link></div></article>
            <article className="price-row"><div><h3>Practice</h3><div className="price-main">$39 AUD / month</div><div className="price-note">or $100 AUD for 3 months</div></div><div className="price-detail"><p>MCQ practice, Performance Intelligence and Study Plan.</p><p>Three months at the monthly rate is $117. You pay $100.</p><p>That is $17 off, 15% off the monthly price.</p><Link to="/login" className="secondary-button">Button: Log in to subscribe</Link></div></article>
            <article className="price-row price-row-disabled"><div><h3>Pass guarantee</h3><div className="price-main">Building</div><div className="price-note">Not on sale yet</div></div><div className="price-detail"><p>Follow a set daily load: questions done, revision queue cleared, weak topics first.</p><p>A person you name can see that you kept the load.</p><p>If you keep that load and do not pass AMC MCQ, the fee comes back. Same idea as a selection guarantee: the refund is for the method, not for logging in.</p><button type="button" className="secondary-button disabled-button" disabled>Button (disabled): Not open yet</button></div></article>
          </div></div>
        </section>

        <section id="faq" className="dark-section faq-section"><div className="shell narrow"><h2>FAQ</h2><div className="faq-list">{faqs.map(([question, answer]) => <details key={question} className="faq-item"><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>

        <section id="contact" className="contact-section"><div className="shell contact-layout"><div><h2>Get in touch</h2><p>A question about the product or an account. One form.</p><p className="contact-email">Or email <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a></p></div><div className="contact-form-wrap">{sent ? <p className="sent-message">Sent.</p> : <form onSubmit={submit} className="contact-form"><label><span>Name</span><input required value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label><label><span>Email</span><input required type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></label><label><span>Message</span><textarea required value={form.message} onChange={e => setForm({...form,message:e.target.value})}/></label><button type="submit" className="primary-button">Button: Send</button></form>}</div></div></section>
      </main>

      <footer className="site-footer"><div className="shell footer-inner"><div className="footer-brand">Zyntra Healthcare Intelligence</div><nav className="footer-nav" aria-label="Footer"><a href="#faq">FAQ</a><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><a href="#contact">Contact</a><a href="#contact">Get in touch</a></nav></div><p className="shell footer-note">Zyntra is not affiliated with or endorsed by the Australian Medical Council. Clinical stations are not live.</p></footer>
    </div>
  );
}
