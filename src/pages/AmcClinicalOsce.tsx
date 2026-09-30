import { Link } from 'react-router-dom';
import { ArrowRight, Check, MessageCircle, Stethoscope, Timer, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SEO } from '@/components/SEO';
import { PublicFooter } from '@/components/PublicFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useShowAboutPricing } from '@/hooks/useSiteSettings';

const OBJECTIVES = [
  'Understand the structure of a timed clinical station: task, time box, and closing.',
  'Practise gathering a focused history and explaining a plan in plain language.',
  'Rehearse composure when a station is incomplete — what to say next, not only what you know.',
  'Use written station outlines now, and voice practice when that module is enabled on your account.',
];

const FAQS = [
  {
    q: 'What is the AMC Clinical examination?',
    a: 'The AMC Clinical examination assesses applied clinical and communication skills through a circuit of stations. Station types, timing and booking rules are defined by the Australian Medical Council. Zyntra does not administer the exam and is not affiliated with the AMC.',
  },
  {
    q: 'Is Zyntra OSCE practice available right now?',
    a: 'The OSCE module, including voice practice, is being rebuilt and is switched on in stages. Some accounts will see a “coming soon” state. A public demo station link may still be offered from the homepage when that route is enabled.',
  },
  {
    q: 'Does voice practice record my microphone?',
    a: 'When voice practice is on, it uses the browser’s built-in speech features. It works most reliably in Chrome and Edge. Use it only if you are comfortable granting microphone access in your browser.',
  },
  {
    q: 'Should I finish MCQ preparation first?',
    a: 'Many candidates prepare for the CAT MCQ before the clinical exam because that is the usual sequence on the standard pathway. Zyntra treats the two as related skills: knowledge under time pressure, then structured communication. You can read the MCQ track while OSCE features roll out.',
  },
];

export default function AmcClinicalOsce() {
  const { user } = useAuth();
  const { show: showAboutPricing } = useShowAboutPricing();
  const pageUrl = 'https://www.zyntrahealthcareintelligence.com/amc-clinical-osce';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="AMC Clinical OSCE Preparation | Zyntra"
        description="Independent AMC Clinical (OSCE) preparation: station structure, communication practice and staged voice stations. Not affiliated with the Australian Medical Council."
        path="/amc-clinical-osce"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'AMC Clinical OSCE Preparation',
            url: pageUrl,
            description: 'Independent preparation for AMC-style clinical stations on Zyntra.',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: 'AMC Clinical OSCE preparation',
            description: 'Self-paced online preparation for AMC-style clinical stations. Not an official AMC course. Voice practice is enabled in stages.',
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
        <p className="mb-4 text-xs font-bold uppercase tracking-[.16em] text-primary">AMC Clinical · OSCE</p>
        <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight lg:text-5xl">
          Practise AMC-style clinical stations without pretending they are the real exam
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Clinical stations reward a clear task, a safe plan and calm communication in a short
          time box. Zyntra offers station-style rehearsal as an educational tool. The OSCE module
          is being rebuilt and enabled in stages. Zyntra is not affiliated with or endorsed by
          the Australian Medical Council.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/stations?demo=true">Try a demo station <Stethoscope className="ml-1 h-4 w-4" aria-hidden="true" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/amc-part-1-mcq">AMC Part 1 MCQ track <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link>
          </Button>
        </div>

        <section className="mt-16" aria-labelledby="osce-objectives">
          <h2 id="osce-objectives" className="font-display text-2xl font-bold tracking-tight">Learning objectives</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {OBJECTIVES.map((item) => (
              <li key={item} className="flex gap-3 rounded-2xl border border-border bg-card p-5">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm leading-6 text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="osce-how">
          <h2 id="osce-how" className="font-display text-2xl font-bold tracking-tight">How station practice is framed here</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: Stethoscope, title: 'Task first', body: 'Each station starts with a brief that tells you who the patient is and what you must do in the time available.' },
              { icon: MessageCircle, title: 'Talk the plan', body: 'When voice practice is enabled, you can speak an approach out loud. Until then, written station outlines still train structure.' },
              { icon: Timer, title: 'Leave a close', body: 'Stations end. Practising a one-sentence summary and safety-net is as important as covering every differential.' },
            ].map((card) => (
              <article key={card.title} className="rounded-2xl border border-border bg-card p-6">
                <card.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg font-bold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 max-w-3xl" aria-labelledby="osce-faq">
          <h2 id="osce-faq" className="font-display text-2xl font-bold tracking-tight">Frequently asked questions</h2>
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
          <Link to="/amc-part-1-mcq" className="hover:underline">AMC Part 1 MCQ</Link>
          {showAboutPricing && <Link to="/pricing" className="hover:underline">Pricing</Link>}
          <Link to="/terms" className="hover:underline">Terms</Link>
          <Link to="/privacy" className="hover:underline">Privacy</Link>
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
