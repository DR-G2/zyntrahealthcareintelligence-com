import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_EMAIL } from "@/lib/legal";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TelemetryStrip from "@/components/TelemetryStrip";
import About from "@/components/About";
import HowItWorks from "@/components/HowItWorks";

const trainingItems = [
  ["Practice · MCQ", "The live room. Questions, explanations, timing, confidence, answer changes and difficulty."],
  ["Surgery: OSCE", "OSCE · not live yet. Stations are not a current training mode."],
  ["Flashcards", "Targeted review built from mistakes and weak areas. Your review deck will build from your practice."],
  ["Performance", "What the candidate knows, and how that performance varies."],
  ["Behaviour", "Timing, hesitation, answer changes, consistency and confidence."],
  ["Trust Your Gut", "What happens when an initial answer is changed."],
  ["Study Plan", "Current plan, weak areas, practice priorities and exam timeline where a date is set. A personalised plan can be generated from candidate data, once a calendar month."],
] as const;

const faqs = [
  ["What is Zyntra?", "Zyntra is an AI-powered AMC exam preparation platform. It records the answer and the way the answer was reached."],
  ["Who is it for?", "Medical students, medical graduates and doctors, including IMGs, preparing for AMC examinations."],
  ["Is Zyntra a question bank?", "MCQ practice is the live training room. The difference is that timing, confidence and answer changes are kept with the score."],
  ["What does Zyntra track?", "Accuracy, timing, confidence, answer changes, consistency and recurring mistakes, where those signals are collected."],
  ["What is Performance Intelligence?", "The room that shows how performance varies, not only the score."],
  ["What is Behaviour?", "How a candidate approaches a question: timing, hesitation, answer changes, consistency and confidence."],
  ["What is Trust Your Gut?", "What happens when a candidate changes an initial answer."],
  ["How does MCQ practice work?", "AMC-style questions with timing, explanations and the signals above. MCQ is the live mode."],
  ["How do Flashcards work?", "Review built from mistakes and weak areas. If no practice exists yet, the deck builds from practice."],
  ["How does Study Plan work?", "A current plan from weak areas, practice priorities and exam date, where that data exists. A new plan can be generated once a calendar month."],
  ["Is OSCE or Surgery available?", "No. Surgery is marked OSCE · not live yet."],
  ["Can I use Zyntra on mobile?", "Yes. The same rooms are available on a phone."],
  ["How is candidate data handled?", "Account and attempt data are stored for the signed-in candidate. See the Privacy page for the handling rules."],
] as const;

export default function Home() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await supabase.from("contact_submissions").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      category: "general",
      message: form.message.trim(),
    });
    if (!error) setSent(true);
  };

  return (
    <div className="zyntra-home">
      <Navbar />
      <main id="top">
        <Hero />
        <TelemetryStrip />
        <About />
        <HowItWorks />

        <section id="trains" className="dark-section training-section">
          <div className="shell">
            <p className="section-kicker">THE TRAINING SYSTEM</p>
            <h2>How Zyntra trains</h2>
            <div className="training-list">
              {trainingItems.map(([title, description], index) => (
                <article className="training-row" key={title}>
                  <span className="training-no">{String(index + 1).padStart(2, "0")}</span>
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
                  <label><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                  <label><span>Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                  <label><span>Message</span><textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
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
          <nav className="footer-nav" aria-label="Footer">
            <a href="#faq">FAQ</a><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><a href="#contact">Contact</a><a href="#contact">Get in touch</a>
          </nav>
        </div>
        <p className="shell footer-note">Zyntra is not affiliated with or endorsed by the Australian Medical Council. Clinical stations are not live.</p>
      </footer>
    </div>
  );
}
