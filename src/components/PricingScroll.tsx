import { Link } from 'react-router-dom';
import { CHECKOUT_DISABLED } from '@/lib/razorpay-config';
import { COPY_CARD_CHECK } from '@/lib/billing';

// No free tier. Copy mirrors src/lib/billing.ts; the exact charge date is shown on /pricing before checkout.
const plans = [
  {
    name: 'Clinical Starter',
    price: 'A$99 AUD every 3 months',
    points: [
      '7-calendar-day trial, then A$99 every 3 months until you cancel. Signup date is day 1; billing starts at 00:01 IST on day 7.',
      'MCQ practice, Performance Intelligence and Study Plan.',
    ],
  },
  {
    name: 'Monthly',
    price: 'A$39 AUD per month',
    points: [
      '7-calendar-day trial, then A$39 every month until you cancel. Signup date is day 1; billing starts at 00:01 IST on day 7.',
      'MCQ practice, Performance Intelligence and Study Plan.',
    ],
  },
];

export function PricingScroll() {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-slate-200/80 bg-white px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">Pricing</div>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">One product. Two billing options.</h2>
          <p className="mt-3 text-slate-600">No free plan. A$1 card verification at signup. Signup date counts as day 1; first charge is at 00:01 IST on calendar day 7 unless cancelled. Cancel anytime in Settings &gt; Billing. Prices in AUD.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.name} className="flex flex-col rounded-2xl border border-slate-200 p-5">
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold text-[#0f5f68]">{plan.price}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                {plan.points.map((point) => <li key={point}>{point}</li>)}
                <li>{COPY_CARD_CHECK}</li>
              </ul>
              {CHECKOUT_DISABLED ? (
                <span className="mt-6 inline-flex justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500">Checkout not open yet</span>
              ) : (
                <Link to="/pricing" className="mt-6 inline-flex justify-center rounded-xl bg-[#0f5f68] px-4 py-2 text-sm font-semibold text-white">See exact terms</Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
