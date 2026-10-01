import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
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

function SignalField() {
  return (
    <div className="signal-field" aria-label="Zyntra decision signal visual">
      <div className="field-grid" aria-hidden="true" />
      <div className="field-orbit orbit-one" aria-hidden="true" />
      <div className="field-orbit orbit-two" aria-hidden="true" />
      <div className="field-core">
        <span className="core-z">Z</span>
        <span className="core-label">DECISION<br />SIGNAL</span>
      </div>

      <div className="signal-node node-confidence">
        <span className="node-dot" />
        <span><small>01</small> Confidence</span>
        <b>Observed</b>
      </div>
      <div className="signal-node node-timing">
        <span className="node-dot" />
        <span><small>02</small> Timing</span>
        <b>Measured</b>
      </div>
      <div className="signal-node node-change">
        <span className="node-dot" />
        <span><small>03</small> Answer changes</span>
        <b>Tracked</b>
      </div>
      <div className="signal-node node-consistency">
        <span className="node-dot" />
        <span><small>04</small> Consistency</span>
        <b>Analysed</b>
      </div>

      <div className="field-readout"><span>LIVE MODEL</span><strong>01</strong><em>answer → behaviour → pattern</em></div>
    </div>
  );
}

function PracticeWindow() {
  return (
    <div className="practice-window" aria-hidden="true">
      <div className="practice-bar">
        <div className="practice-brand"><span>Z</span> Practice</div>
        <div className="practice-status">MCQ <i /></div>
      </div>
      <div className="practice-body">
        <div className="practice-meta">QUESTION 042 <span>01:18</span></div>
        <div className="practice-question">Which finding most strongly supports the diagnosis?</div>
        <div className="practice-answer"><b>A</b><span>Clinical finding and timing</span></div>
        <div className="practice-answer selected"><b>B</b><span>Pattern recognised from the stem</span><i>✓</i></div>
        <div className="practice-answer"><b>C</b><span>Alternative explanation</span></div>
      </div>
      <div className="practice-footer"><span>CONFIDENCE <b>7/10</b></span><span>TIMING <b>72s</b></span><span>CHANGES <b>0</b></span></div>
    </div>
  );
}

export default function Home() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await supabase.from('contact_submissions').insert({
      name: form.name,
      email: form.email,
      category: 'general',
      message: form.message,
    });
    setSent(true);
  };


function SignalTelemetry({ tone, values, icon: Icon, label, state }: { tone: "blue"|"purple"|"red"|"green"; values: number[]; icon: React.ComponentType<{className?: string}>; label: string; state: string }) {
  return (
    <div className={`signal-tele-card tone-${tone}`}>
      <div className="signal-tele-icon"><Icon className="h-5 w-5" /></div>
      <div className="signal-tele-copy"><span>${label}</span><strong>${state}</strong></div>
      <svg className="signal-tele-spark" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={values.map((v,i)=>`${i*(120/(values.length-1))},${28-v}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ZyntraVisual() {
  const telemetry = [
    { tone:"blue" as const, icon:Brain, label:"Confidence", state:"Observed", values:[5,9,7,15,11,19,16,22,18,24] },
    { tone:"purple" as const, icon:Clock, label:"Timing", state:"Measured", values:[4,18,10,22,8,15,11,24,14,22] },
    { tone:"red" as const, icon:RotateCcw, label:"Answer changes", state:"Tracked", values:[2,8,22,11,24,17,20,9,23,13] },
    { tone:"green" as const, icon:BarChart3, label:"Consistency", state:"Analysed", values:[6,12,8,19,13,23,17,21,15,25] },
  ];
  return (
    <div className="hero-visual" aria-label="Zyntra behavioural telemetry visual">
      <div className="brain-halo brain-halo-a" />
      <div className="brain-halo brain-halo-b" />
      <div className="brain-art" aria-hidden="true">
        <div className="brain-rim rim-1" /><div className="brain-rim rim-2" /><div className="brain-rim rim-3" />
        <div className="brain-lobe lobe-1" /><div className="brain-lobe lobe-2" /><div className="brain-lobe lobe-3" /><div className="brain-lobe lobe-4" />
        <div className="brain-spine" />
      </div>
      <div className="chip-base"><span className="chip-z">Z</span><div className="chip-grid" /></div>
      <div className="telemetry-stack">
        {telemetry.map(item => <SignalTelemetry key={item.label} {...item} />)}
      </div>
      <div className="visual-lines" aria-hidden="true"><span/><span/><span/><span/></div>
      <div className="visual-caption">Zyntra learns your pattern, then training adapts.</div>
    </div>
  );
}

function MiniTelemetryBars({ tone }: { tone: "blue"|"purple"|"red"|"green" }) {
  const bars = [28,42,58,35,67,48,74];
  return <div className={`mini-bars tone-${tone}`}>{bars.map((h,i)=><span key={i} style={{height:`${h}%`}} />)}</div>;
}

function PracticeWindow() {
  return (
    <div className="practice-window" aria-label="Zyntra AMC question engine preview">
      <div className="practice-bar">
        <div className="practice-brand"><span>Z</span> Practice</div>
        <div className="practice-status">MCQ <i /></div>
      </div>
      <div className="practice-body">
        <div className="practice-meta">QUESTION 042 <span>01:18</span></div>
        <div className="practice-question">A patient presents with a new clinical finding. Which interpretation is most appropriate?</div>
        <div className="practice-answer"><b>A</b><span>Read the pattern and context</span></div>
        <div className="practice-answer selected"><b>B</b><span>Prioritise the strongest signal</span><i>✓</i></div>
        <div className="practice-answer"><b>C</b><span>Choose the first plausible alternative</span></div>
        <div className="practice-answer"><b>D</b><span>Wait for another clue</span></div>
      </div>
      <div className="practice-footer"><span>CONFIDENCE <b>7/10</b></span><span>TIMING <b>72s</b></span><span>CHANGES <b>0</b></span></div>
    </div>
  );
}

export default function Home() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('contact_submissions').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      category: 'general',
      message: form.message.trim(),
    });
    if (!error) setSent(true);
  };

  return (
    <div className="zyntra-home">
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="#top" aria-label="Zyntra">
            <span className="brand-mark" aria-hidden="true"><span className="brand-z">Z</span></span>
            <span className="brand-word">ZYNTRA</span>
          </a>
          <Link to="/login" className="header-cta">Get Started</Link>
        </div>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-glow hero-glow-a" aria-hidden="true" />
          <div className="hero-glow hero-glow-b" aria-hidden="true" />
          <div className="hero-grid-lines" aria-hidden="true" />
          <div className="shell hero-layout">
            <div className="hero-copy">
              <p className="eyebrow">WHAT IS ZYNTRA?</p>
              <h1 id="hero-title">Zyntra is an AI-powered AMC exam preparation platform for medical students, medical graduates and doctors preparing for the Australian Medical Council examinations.</h1>
              <p className="hero-lead">Zyntra goes beyond whether an answer is right or wrong. It learns how you approach questions and uses those signals to make preparation more targeted.</p>
              <p className="hero-signal">Your answer is one signal. Your decision process is the dataset.</p>
              <Link to="/login" className="primary-button">Get Started <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <ZyntraVisual />
          </div>
          <div className="shell telemetry-strip">
            <div className="strip-shell">
              <div className="strip-card tone-blue"><span className="strip-icon"><Brain className="h-5 w-5" /></span><div><b>Confidence</b><span>Observed</span></div><MiniTelemetryBars tone="blue" /></div>
              <div className="strip-card tone-purple"><span className="strip-icon"><Clock className="h-5 w-5" /></span><div><b>Timing</b><span>Measured</span></div><MiniTelemetryBars tone="purple" /></div>
              <div className="strip-card tone-red"><span className="strip-icon"><RotateCcw className="h-5 w-5" /></span><div><b>Answer changes</b><span>Tracked</span></div><MiniTelemetryBars tone="red" /></div>
              <div className="strip-card tone-green"><span className="strip-icon"><BarChart3 className="h-5 w-5" /></span><div><b>Consistency</b><span>Analysed</span></div><MiniTelemetryBars tone="green" /></div>
            </div>
          </div>
        </section>

        <section id="about" className="dark-section about-section">
          <div className="shell split-section">
            <div className="section-copy">
              <p className="section-kicker">ABOUT ZYNTRA</p>
              <h2>About Zyntra</h2>
              <p>Zyntra is for medical students, medical graduates and doctors preparing for AMC examinations. A conventional bank marks the option. Zyntra also keeps timing, confidence and answer changes, then uses those signals in Performance Intelligence and the Study Plan.</p>
            </div>
            <PracticeWindow />
          </div>
        </section>

        <section id="how" className="dark-section how-section">
          <div className="shell">
            <p className="section-kicker">THE LOOP</p>
            <h2>How Zyntra works</h2>
            <div className="how-timeline">
              {howItems.map(([title, text], i) => (
                <button type="button" className="timeline-step" key={title} onClick={() => document.getElementById('trains')?.scrollIntoView({behavior:'smooth',block:'start'})}>
                  <div className="timeline-marker"><span>{String(i + 1).padStart(2, '0')}</span></div>
                  <div className="timeline-copy"><h3>{title}</h3><p>{text}</p></div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="trains" className="dark-section training-section">
          <div className="shell">
            <p className="section-kicker">THE TRAINING SYSTEM</p>
            <h2>How Zyntra trains</h2>
            <div className="training-list">
              {trainingItems.map(([title, description], i) => (
                <article className="training-row" key={title}>
                  <span className="training-no">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="pricing-section">
          <div className="shell">
            <p className="section-kicker">PRICING</p>
            <h2>Pricing</h2>
            <p className="pricing-intro">Three ways in</p>
            <div className="pricing-list">
              <article className="price-row">
                <div><h3>Free</h3><div className="price-main">$0</div><div className="price-note">APPE diagnostic only</div></div>
                <div className="price-detail"><p>One diagnostic. It records timing, answer changes and confidence.</p><p>You see the pattern from that sitting. That is the free product.</p><p>No question bank, no study plan, no flashcards.</p><Link to="/check" className="secondary-button">Start the diagnostic</Link></div>
              </article>
              <article className="price-row">
                <div><h3>Practice</h3><div className="price-main">$39 AUD / month</div><div className="price-note">or $100 AUD for 3 months</div></div>
                <div className="price-detail"><p>MCQ practice, Performance Intelligence and Study Plan.</p><p>Three months at the monthly rate is $117. You pay $100.</p><p>That is $17 off, 15% off the monthly price.</p><Link to="/login" className="secondary-button">Log in to subscribe</Link></div>
              </article>
              <article className="price-row price-row-disabled">
                <div><h3>Pass guarantee</h3><div className="price-main">Building</div><div className="price-note">Not on sale yet</div></div>
                <div className="price-detail"><p>Follow a set daily load: questions done, revision queue cleared, weak topics first.</p><p>A person you name can see that you kept the load.</p><p>If you keep that load and do not pass AMC MCQ, the fee comes back. Same idea as a selection guarantee: the refund is for the method, not for logging in.</p><button type="button" className="secondary-button disabled-button" disabled>Not open yet</button></div>
              </article>
            </div>
          </div>
        </section>

        <section id="faq" className="dark-section faq-section">
          <div className="shell narrow">
            <p className="section-kicker">FAQ</p>
            <h2>FAQ</h2>
            <div className="faq-list">
              {faqs.map(([question, answer]) => (
                <details key={question} className="faq-item"><summary>{question}</summary><p>{answer}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="contact-section">
          <div className="shell contact-layout">
            <div className="section-copy">
              <p className="section-kicker">GET IN TOUCH</p>
              <h2>Get in touch</h2>
              <p>A question about the product or an account. One form.</p>
              <p className="contact-email">Or email <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a></p>
            </div>
            <div className="contact-form-wrap">
              {sent ? <p className="sent-message">Sent.</p> : (
                <form onSubmit={submit} className="contact-form">
                  <label><span>Name</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
                  <label><span>Email</span><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
                  <label><span>Message</span><textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></label>
                  <button type="submit" className="primary-button">Send Message</button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <div className="footer-brand">Zyntra Healthcare Intelligence</div>
          <nav className="footer-nav" aria-label="Footer"><a href="#faq">FAQ</a><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><a href="#contact">Contact</a><a href="#contact">Get in touch</a></nav>
        </div>
        <p className="shell footer-note">Zyntra is not affiliated with or endorsed by the Australian Medical Council. Clinical stations are not live.</p>
      </footer>
    </div>
  );
}
