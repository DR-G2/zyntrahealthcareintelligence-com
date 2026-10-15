import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Free',
    price: 'A$0',
    note: 'APPE diagnostic only',
    points: [
      'One diagnostic. It records timing, answer changes and confidence.',
      'You see the pattern from that sitting. That is the free product.',
      'No question bank, no study plan, no flashcards.',
    ],
    cta: 'Start the diagnostic',
    to: '/login',
    live: true,
  },
  {
    name: 'Full Access',
    price: 'A$39/month',
    note: 'or A$99 for 3 months · AUD · 7-calendar-day trial',
    points: [
      'MCQ practice, Performance Intelligence and Study Plan.',
      'Cancel anytime. Cancel during your trial and you won\'t be charged A$39.',
      'A$1 card verification at signup (not refunded, except where required by law). Billing begins at 00:01 IST on day 7 if not cancelled.',
    ],
    cta: 'Start 7-calendar-day trial',
    to: '/login',
    live: true,
  },
];

export function PricingScroll() {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-slate-200/80 bg-white px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">Pricing</div>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">One plan. Everything included.</h2>
          <p className="mt-3 text-slate-600">Free is the diagnostic. Full Access is everything else. Prices in AUD.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.name} className="flex flex-col rounded-2xl border border-slate-200 p-5">
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold text-[#0f5f68]">{plan.price}</p>
              <p className="mt-1 text-sm text-slate-500">{plan.note}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                {plan.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
              {plan.live ? (
                <Link to={plan.to} className="mt-6 inline-flex justify-center rounded-xl bg-[#0f5f68] px-4 py-2 text-sm font-semibold text-white">{plan.cta}</Link>
              ) : (
                <span className="mt-6 inline-flex justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500">{plan.cta}</span>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
