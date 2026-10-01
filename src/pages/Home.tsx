import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LEGAL_EMAIL } from '@/lib/legal';
import { PricingScroll } from '@/components/PricingScroll';

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

export default function Home() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('contact_submissions').insert({ name: form.name, email: form.email, category: 'general', message: form.message });
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[#f6fbfc] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#f6fbfc]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="#top" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0f5f68] text-white"><Zap className="h-4 w-4" /></span>
            Zyntra
          </a>
          <Link to="/login" className="rounded-full bg-[#0f5f68] px-4 py-2 text-sm font-semibold text-white">Get Started</Link>
        </div>
      </header>

      <main id="top">
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#16858c]">What is Zyntra?</p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Zyntra is an AI-powered AMC exam preparation platform for medical students, medical graduates and doctors preparing for the Australian Medical Council examinations.</h1>
              <p className="mt-5 text-lg text-slate-600">Zyntra goes beyond whether an answer is right or wrong. It learns how you approach questions and uses those signals to make preparation more targeted.</p>
              <p className="mt-4 text-slate-700">Your answer is one signal. Your decision process is the dataset.</p>
              <Link to="/login" className="mt-8 inline-flex rounded-xl bg-[#0f5f68] px-5 py-3 font-semibold text-white">Get Started</Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">Confidence</div><div className="font-semibold">Observed</div></div>
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">Timing</div><div className="font-semibold">Measured</div></div>
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">Answer changes</div><div className="font-semibold">Tracked</div></div>
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">Consistency</div><div className="font-semibold">Analysed</div></div>
              </div>
              <p className="mt-4 text-center text-sm text-slate-600">Zyntra learns your pattern, then training adapts.</p>
            </div>
          </div>
        </section>

        <section id="about" className="border-y border-slate-200 bg-white px-4 py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-3xl font-bold">About Zyntra</h2>
            <p className="mt-4 text-slate-600">Zyntra is for medical students, medical graduates and doctors preparing for AMC examinations. A conventional bank marks the option. Zyntra also keeps timing, confidence and answer changes, then uses those signals in Performance Intelligence and the Study Plan.</p>
          </div>
        </section>

        <section id="how" className="px-4 py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl font-bold">How Zyntra works</h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-5">
              {['Practice. Answer AMC-style questions.', 'Observe. Timing, confidence and answer changes are captured.', 'Understand. Patterns emerge across those signals.', 'Adapt. Training focuses on what needs work.', 'Progress. Performance Intelligence develops over time.'].map((step) => (
                <li key={step} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">{step}</li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trains" className="border-y border-slate-200 bg-white px-4 py-14">
          <div className="mx-auto max-w-6xl space-y-8">
            <h2 className="font-display text-3xl font-bold">How Zyntra trains</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">Practice · MCQ</h3><p className="mt-2 text-sm text-slate-600">The live room. Questions, explanations, timing, confidence, answer changes and difficulty.</p></article>
              <article className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">Surgery</h3><p className="mt-2 text-sm text-slate-600">OSCE · not live yet. Stations are not a current training mode.</p></article>
              <article className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">Flashcards</h3><p className="mt-2 text-sm text-slate-600">Targeted review built from mistakes and weak areas. Your review deck will build from your practice.</p></article>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">Performance</h3><p className="mt-2 text-sm text-slate-600">What the candidate knows, and how that performance varies.</p></article>
              <article className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">Behaviour</h3><p className="mt-2 text-sm text-slate-600">Timing, hesitation, answer changes, consistency and confidence.</p></article>
              <article className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">Trust Your Gut</h3><p className="mt-2 text-sm text-slate-600">What happens when an initial answer is changed.</p></article>
            </div>
            <article className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold">Study Plan</h3><p className="mt-2 text-sm text-slate-600">Current plan, weak areas, practice priorities and exam timeline where a date is set. A personalised plan can be generated from candidate data, once a calendar month.</p></article>
          </div>
        </section>

        <PricingScroll />

        <section id="faq" className="px-4 py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-3xl font-bold">FAQ</h2>
            <div className="mt-6 space-y-3">
              {faqs.map(([q, a]) => (
                <details key={q} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <summary className="cursor-pointer font-semibold">{q}</summary>
                  <p className="mt-2 text-sm text-slate-600">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="border-t border-slate-200 bg-white px-4 py-14">
          <div className="mx-auto max-w-xl">
            <h2 className="font-display text-3xl font-bold">Get in touch</h2>
            <p className="mt-2 text-slate-600">A question about the product or an account. One form.</p>
            {sent ? <p className="mt-4 text-sm">Sent. We will reply at the email you gave.</p> : (
              <form onSubmit={submit} className="mt-6 space-y-3">
                <input required placeholder="Name" className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input required type="email" placeholder="Email" className="h-11 w-full rounded-lg border border-slate-200 px-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <textarea required placeholder="Message" className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                <button className="rounded-xl bg-[#0f5f68] px-4 py-2 font-semibold text-white">Send</button>
              </form>
            )}
            <p className="mt-3 text-sm text-slate-500">Or email <a className="underline" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a></p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-4 py-8 text-sm text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Zyntra Healthcare Intelligence</span>
          <nav className="flex flex-wrap gap-4">
            <a href="#faq">FAQ</a>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <a href="#contact">Contact</a>
            <a href="#contact">Get in touch</a>
          </nav>
        </div>
        <p className="mx-auto mt-4 max-w-6xl text-xs">Zyntra is not affiliated with or endorsed by the Australian Medical Council. Clinical stations are not live.</p>
      </footer>
    </div>
  );
}
