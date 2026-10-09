import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Check, Clock, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SEO } from '@/components/SEO';
import { PublicFooter } from '@/components/PublicFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useShowAboutPricing } from '@/hooks/useSiteSettings';
import { AMCPluginConnectionStatus } from '@/components/amc/AMCPluginConnectionStatus';

const OBJECTIVES = [
  'Build applied medical knowledge with original single-best-answer practice items.',
  'Notice timing, answer changes and confidence — not only whether an item was correct.',
  'Use a short diagnostic to see an early performance signal before creating an account.',
  'Build a study loop: diagnose, drill weak patterns, review explanations, then re-test.',
];

const FAQS = [
  {
    q: 'What is the AMC Part 1 MCQ examination?',
    a: 'The AMC CAT MCQ examination is a computer-adaptive multiple-choice assessment used in the standard pathway for international medical graduates seeking registration in Australia. It tests applied clinical knowledge across medicine, surgery, obstetrics and gynaecology, paediatrics, psychiatry and population health. Official format, eligibility and scheduling are published by the Australian Medical Council — Zyntra is not the AMC and does not run the exam.',
  },
  {
    q: 'How does Zyntra help with MCQ preparation?',
    a: 'Zyntra is an educational practice platform. Its PIE engine records timing, answer changes and confidence to support general adaptive practice. AMC-specific question selection remains disabled until question-level review and blueprint mappings are verified. The free 6-question diagnostic is a general orientation tool, not an AMC readiness test.',
  },
  {
    q: 'Are these recalled AMC questions?',
    a: 'No. Zyntra content is original practice material written for training. It is not copied from, recalled from, or endorsed by the Australian Medical Council. Current drills do not claim official AMC blueprint coverage.',
  },
  {
    q: 'Do I need an account to try MCQ practice?',
    a: 'The 6-question general diagnostic on the home page does not require an account. General adaptive drills, explanations, study plans and analytics require signing in. AMC-specific blueprint-driven delivery is not enabled yet.',
  },
];

export default function AmcPart1Mcq() {
  const { user } = useAuth();
  const { show: showAboutPricing } = useShowAboutPricing();
  const pageUrl = 'https://www.zyntrahealthcareintelligence.com/amc-part-1-mcq';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="AMC Part 1 MCQ Preparation | Zyntra"
        description="Prepare for the AMC CAT MCQ with original study resources and transparent behaviour-aware practice. AMC-specific question delivery is still being validated. Free 6-question general diagnostic. Independent of the AMC."
        path="/amc-part-1-mcq"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'AMC Part 1 MCQ Preparation',
            url: pageUrl,
            description: 'Independent medical MCQ study tools on Zyntra, including a free general diagnostic and behavioural analytics. AMC-specific blueprint mapping is still being validated.',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: 'AMC Part 1 MCQ preparation',
            description: 'Self-paced general medical MCQ practice for clinical reasoning. AMC-specific blueprint mapping is still being validated; this is not an official AMC course.',
            url: pageUrl,
            provider: {
              '@type': 'Organization',
              name: 'Zyntra Healthcare Intelligence',
              url: 'https://www.zyntrahealthcareintelligence.com/',
            },
            hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ]}
      />

      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="Zyntra home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold font-display">Zyntra</span>
          </Link>
          <nav aria-label="Page" className="flex items-center gap-3">
            {showAboutPricing && (
              <>
                <Button variant="ghost" asChild className="hidden text-sm sm:inline-flex">
                  <Link to="/about">About</Link>
                </Button>
                <Button variant="ghost" asChild className="hidden text-sm sm:inline-flex">
                  <Link to="/pricing">Pricing</Link>
                </Button>
              </>
            )}
            <ThemeToggle />
            <Button asChild>
              <Link to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Log in'}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container pb-20 pt-28">
        <p className="mb-4 text-xs font-bold uppercase tracking-[.16em] text-primary">AMC Part 1 · MCQ</p>
        <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight lg:text-5xl">
          Prepare for the AMC CAT MCQ with transparent, behaviour-aware study tools
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          The AMC computer-adaptive MCQ rewards applied clinical reasoning under time pressure.
          Zyntra is an independent study platform that pairs original practice items with behavioural signals. AMC-specific question selection is currently disabled while reviewed mappings are completed. It does not provide a pass probability.
          such as hesitation, option-switching and self-rated confidence. It is not affiliated with
          or endorsed by the Australian Medical Council.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/check">Try the 6-question diagnostic <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/amc-clinical-osce">AMC Clinical / OSCE track</Link>
          </Button>
        </div>

        {user && <AMCPluginConnectionStatus />}

        <section className="mt-16" aria-labelledby="mcq-objectives">
          <h2 id="mcq-objectives" className="font-display text-2xl font-bold tracking-tight">Learning objectives</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {OBJECTIVES.map((item) => (
              <li key={item} className="flex gap-3 rounded-2xl border border-border bg-card p-5">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm leading-6 text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="mcq-how">
          <h2 id="mcq-how" className="font-display text-2xl font-bold tracking-tight">What adaptive practice looks like on Zyntra</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: Target, title: 'Diagnose first', body: 'A short public diagnostic measures accuracy plus timing and certainty so you see a pattern, not a vanity score.' },
              { icon: Brain, title: 'Drill the pattern', body: 'Signed-in general practice can emphasise learning objectives and behaviours that looked unstable. It does not yet apply AMC-specific blueprint weighting.' },
              { icon: Clock, title: 'Train the clock', body: 'Timed items exist so pace is part of preparation. The platform records how long you take; it does not claim to reproduce official AMC timing rules.' },
            ].map((card) => (
              <article key={card.title} className="rounded-2xl border border-border bg-card p-6">
                <card.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg font-bold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 max-w-3xl" aria-labelledby="mcq-faq">
          <h2 id="mcq-faq" className="font-display text-2xl font-bold tracking-tight">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-6 space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} value={`faq-${i}`} className="rounded-2xl border border-border px-5">
                <AccordionTrigger className="text-left font-display text-sm font-bold hover:no-underline sm:text-base">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-6 text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <nav aria-label="Related pages" className="mt-16 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-primary">
          <Link to="/" className="hover:underline">Home</Link>
          <Link to="/amc-clinical-osce" className="hover:underline">AMC Clinical OSCE</Link>
          {showAboutPricing && <Link to="/pricing" className="hover:underline">Pricing</Link>}
          <Link to="/terms" className="hover:underline">Terms</Link>
          <Link to="/privacy" className="hover:underline">Privacy</Link>
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
