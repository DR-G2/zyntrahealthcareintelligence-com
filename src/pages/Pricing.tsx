import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Check, X, ArrowRight, MessageCircle, Shield, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const costBreakdown = [
  { item: 'AMC MCQ fee', cost: '$2,920' },
  { item: 'Document verification (EPIC)', cost: '$500' },
  { item: 'English test (OET)', cost: '$587' },
  { item: 'AMC Clinical exam', cost: '$3,000' },
  { item: 'Portfolio assessment', cost: '$642' },
  { item: 'Flights to Melbourne for Clinical', cost: '$400' },
  { item: 'Airbnb for Clinical prep', cost: '$800' },
  { item: 'Visa application', cost: '$1,800' },
  { item: 'Health insurance', cost: '$600' },
  { item: 'Rent in Sydney (waiting for job)', cost: '$8,800' },
];

const faqGroups = [
  {
    title: 'About the Founder',
    questions: [
      {
        q: 'Who are you? Why no name?',
        a: "I'm an IMG who passed AMC MCQ (321/500) in 2023. Sitting Clinical June 2025. Starting PGY1 Sydney August 2025. I don't share my name because I'm private—I built this tool, not a personal brand. My story is real: 2 years in the system, worked extra shifts to survive, almost gave up. The tool matters. My face doesn't.",
      },
      {
        q: 'How do I know you\'re real?',
        a: "You don't have to trust me. Try the free tier—$0, no signup, no tricks. If it helps, pay $29. If I scam you, you lose $29. I've been scammed by \"gurus\" before. I won't do that to you. Also: I'm not anonymous to my paid users. They get my contact info. I just don't broadcast it.",
      },
      {
        q: 'If you\'re private, how do you do strategy calls for Pro?',
        a: "Video call with camera off, voice only. Or screen share with no face. I'm introverted—I get it. The value is in the analysis, not seeing each other.",
      },
    ],
  },
  {
    title: 'Pricing & Money',
    questions: [
      {
        q: '$29 is still hard. I\'m working extra shifts just to pay rent.',
        a: 'Use the contact form. Subject: "Hardship." Tell me your situation. I\'ll drop it to $15/month or free for 2 months. I spent 2 years in the system because I couldn\'t afford fees. I won\'t let $29 stop you. But please—only ask if you need it.',
      },
      {
        q: 'Why charge at all?',
        a: "Server costs ($400/month). And people don't value free tools. I've seen free groups with 10,000 members and zero engagement. $29 means you actually use it. That said—genuinely broke? I'll give you access. Just ask.",
      },
      {
        q: 'What\'s the catch with the pass guarantee?',
        a: "No catch. Use Pro 3+ months. Complete 2,000+ questions. Do 5 full timed blocks. Sit AMC. Fail? Contact me with proof. Refund within 48 hours. Only condition: you actually do the work. I see activity logs. Pay $49, open app twice, fail? No refund. That's not \"using Pro.\"",
      },
      {
        q: 'Why is Lifetime $299?',
        a: 'My MCQ-to-PGY1 journey: 2 years. $29 x 24 months = $696. $299 is less than half. Also: Lifetime users get direct access to me for quick questions. I limit to 50 so I can respond.',
      },
    ],
  },
  {
    title: 'Product & Features',
    questions: [
      {
        q: 'Do you have actual AMC recalls?',
        a: "No. Sharing real exam questions is copyright violation. AMC bans people for this. I know people it happened to. What I have: 5,000+ questions written by me and 2 other IMGs who passed. We study the blueprint and candidate feedback. Use Telegram for recalls. Use Zyntra to understand why you get them wrong.",
      },
      {
        q: 'How is this different from eMedici?',
        a: 'eMedici is a question bank. Zyntra is a question bank + coach. eMedici: "You got 65% in Cardio." Zyntra: "You got 65% in Cardio, but took 5 minutes per question and changed 40% from right to wrong. You\'re panicking, not ignorant. Here\'s how to fix it." I needed the second one.',
      },
      {
        q: 'What does "no-code" mean? Is it broken?',
        a: "I built this using visual programming instead of hiring engineers. Same tech as million-dollar startups. It works. \"No-code\" means I learned to build it myself between shifts. If something breaks, I fix it at 2am. Not fancy, but functional.",
      },
      {
        q: 'Mobile app?',
        a: "Not yet. Costs $20k+. Saving from PGY1 salary. Website works on mobile browsers. I study on my phone during breaks. It works.",
      },
      {
        q: 'How often updated?',
        a: 'Every Sunday. Check forums and user feedback. If 3+ people mention a new topic, I add 20 questions by Wednesday. Check RACGP/Therapeutic Guidelines weekly.',
      },
      {
        q: 'Offline use?',
        a: 'Yes. Questions cache in browser. I study in hospital basements with no signal. Syncs when reconnected.',
      },
    ],
  },
  {
    title: 'Specific Situations',
    questions: [
      {
        q: 'Failed AMC twice. Get Pro?',
        a: "Yes. You don't need more questions. You need to know why you're failing. Pro shows if it's knowledge gaps (study more) or panic changes (trainable). I failed practice blocks twice. Third time I tracked \"answer changes\" and realized I was sabotaging myself. Fixed it. Passed.",
      },
      {
        q: 'Working 40hrs/week as medical assistant. Which plan?',
        a: 'Core. You need efficiency. Weakness targeting tells you "skip Cardio, focus on Psych." Do 30 mins/day on commute. Don\'t get Pro yet—no time for 3-hour simulated blocks.',
      },
      {
        q: 'Sitting AMC in 6 weeks. Too late?',
        a: "Core, 3-month plan. 100 questions/day. Use weakness report to cram worst 3 topics. Don't get Pro—no time to learn features. Just grind.",
      },
      {
        q: '6 months away. What to do?',
        a: "Free tier 2 months. Learn baseline. Then Core 3 months. Switch to Pro final month for pressure training. Don't buy Pro early—waste of features.",
      },
      {
        q: 'Already use eMedici. Switch?',
        a: "Don't switch. Use both. I did. eMedici for questions, Zyntra for tracking. Export eMedici results, input to Zyntra (5 mins). Zyntra analyzes patterns across platforms.",
      },
      {
        q: 'Share with friend?',
        a: 'Please don\'t. Progress tracking becomes useless (mixed data). You and roommate both need it? Contact me. "Study buddy" pricing: 2 accounts for $45. I need to eat, but not greedy.',
      },
    ],
  },
  {
    title: 'The Hard Questions',
    questions: [
      {
        q: 'What if you fail Clinical in June?',
        a: "Then I'm an IMG who failed Clinical. It happens. I'll keep Zyntra running for MCQ (proven). Fix gaps I find, update Clinical features. Won't shut down. Will be honest. But not planning to fail.",
      },
      {
        q: 'What if PGY1 gets too busy?',
        a: "Hiring another IMG (passed AMC) for part-time support starting July. I'll do evenings/weekends. If Zyntra grows, hire more IMGs. If not, maintain myself. Won't ghost—I know that pain.",
      },
      {
        q: 'Why so few testimonials?',
        a: "Zyntra is 8 months old. Most users still studying. Have 3 video testimonials from MCQ passers. Not making up fake ones. When more pass, I'll add. For now—try free tier. Judge yourself.",
      },
      {
        q: 'Sell to a company? Get rich?',
        a: "No. Built this because I needed it. Only sell if buyer keeps price at $29 and keeps helping IMGs. Otherwise no deal. Didn't suffer 2 years of system hell to sell out.",
      },
      {
        q: 'Why Zyntra over free Telegram recalls?',
        a: "Use both. Telegram gives content. Zyntra gives strategy. I used Telegram 18 months. Helped. But still failed practice blocks because I didn't know how I was failing. Zyntra fixes that. Free tier is $0. Try it. If no help, stick to Telegram. I did for long time.",
      },
    ],
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 glass">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-display">Zyntra</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-sm">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <ThemeToggle />
            <Button asChild>
              <Link to="/dashboard">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — Founder Story */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="container">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Pricing — Transparent & Fair
            </div>
            <h1 className="mb-8 text-4xl font-bold font-display leading-tight tracking-tight lg:text-5xl">
              Built by an IMG Who{' '}
              <span className="gradient-text">Actually Made It</span>
            </h1>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="mx-auto max-w-2xl"
          >
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-8 text-base leading-relaxed text-muted-foreground space-y-4">
                <p>
                  I cleared AMC MCQ in 2 months of prep. Scored 321/500.
                  <br />
                  But I was stuck in the system for almost 2 years.
                </p>
                <p>
                  Why? Exam fees. Document verification. English tests. Every step needed money I didn't have.
                </p>
                <p>
                  I worked night shifts, borrowed from friends, and almost gave up twice.
                </p>
                <p>
                  Sitting AMC Clinical in June. Starting PGY1 in Sydney this August.
                </p>
                <p className="text-foreground font-semibold font-display">
                  Zyntra is what I wish I had during those 2 years of hell.
                </p>
                <p className="text-sm">
                  From <span className="text-primary font-semibold">$29/month</span>. No investors. No coding team.
                  <br />
                  Just one IMG, a laptop, and the memory of skipping dinner to pay AMC fees.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* The Real Math */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mx-auto max-w-3xl"
          >
            <h2 className="mb-4 text-3xl font-bold font-display text-center">The Real Math</h2>
            <p className="mb-8 text-center text-muted-foreground">My actual life, in numbers</p>

            {/* Timeline */}
            <div className="mb-8 grid gap-3 sm:grid-cols-2">
              {[
                { date: 'January 2023', event: 'Decided to pursue AMC' },
                { date: 'March 2023', event: 'Started studying (eMedici trial)' },
                { date: 'May 2023', event: 'Cleared AMC MCQ (321/500)' },
                { date: 'June 2023 – March 2025', event: 'Stuck in system' },
              ].map((t, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                  <Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                    <p className="text-sm font-medium">{t.event}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Cost Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">What "stuck in system" actually cost</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {costBreakdown.map((row) => (
                      <TableRow key={row.item}>
                        <TableCell className="text-muted-foreground">{row.item}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{row.cost}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-primary/30">
                      <TableCell className="font-semibold font-display">Total MCQ → PGY1</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">~$20,000+</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
                  I worked medical assistant shifts. Picked up extra hours wherever I could. Skipped meals. Crashed on friends' couches.
                  <br /><br />
                  <span className="text-foreground font-medium">I built Zyntra because I know you're doing the same right now.</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold font-display">Choose Your Plan</h2>
            <p className="text-muted-foreground text-lg">Priced for IMGs, not corporations</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger}
            className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-4"
          >
            {/* FREE */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border">
                <CardHeader>
                  <CardTitle className="text-xl">Free Forever</CardTitle>
                  <p className="text-sm text-muted-foreground">Start Here — No Signup Required</p>
                  <p className="mt-4 text-4xl font-bold font-display">$0</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="mb-6 text-sm text-muted-foreground italic">
                    "I used free trials for 6 months before I could afford anything. I get it. This is actually free."
                  </p>
                  <ul className="mb-8 space-y-3 flex-1">
                    {[
                      '200 AMC-style questions (high-yield topics)',
                      '1 full timed block (60 questions, 3.5 hours)',
                      'Basic report: What you got wrong + time per question',
                      'Australian guideline references (RACGP, Therapeutic)',
                      'Works on phone browser (study on the train)',
                    ].map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-4 text-xs text-muted-foreground">
                    No credit card. No "enter email to unlock." Just use it.
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/dashboard">Start Free Diagnostic</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* CORE */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border">
                <CardHeader>
                  <CardTitle className="text-xl">Core</CardTitle>
                  <p className="text-sm text-muted-foreground">What I Used to Pass MCQ in 2 Months</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold font-display">$29</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">or $69/3 months (save 20%)</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="mb-6 text-sm text-muted-foreground italic">
                    "When I studied for MCQ, I had exactly $200 for prep tools. I chose eMedici. It was good. But it didn't tell me WHY I was getting questions wrong."
                  </p>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Questions</p>
                  <ul className="mb-4 space-y-2">
                    {[
                      '5,000+ AMC-specific questions',
                      'Organized by AMC blueprint',
                      'Australian guidelines (RACGP, TG)',
                      'Updated when AMC changes',
                    ].map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking</p>
                  <ul className="mb-4 space-y-2">
                    {[
                      'Time per subject tracking',
                      'Weakness targeting — auto-suggests worst topics',
                      'Progress export — for visa apps, proof of study',
                    ].map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Built for IMG Life</p>
                  <ul className="mb-8 space-y-2 flex-1">
                    {[
                      'Works offline — hospital basements, no wifi',
                      'Mobile browser — 10 questions on lunch break',
                      'Pause anytime — no questions asked',
                    ].map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button className="w-full" asChild>
                    <Link to="/login">Start 7-Day Free Trial <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground italic">
                    "Built this to cost less than one extra shift." — Founder, IMG, PGY1 (Aug 2025)
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* PRO */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-2 border-primary relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                    <Star className="h-3 w-3 mr-1" /> Most Popular
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-xl">Pro</CardTitle>
                  <p className="text-sm text-muted-foreground">For Clinical & Repeat Takers</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold font-display">$49</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">or $129/3 months</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="mb-6 text-sm text-muted-foreground italic">
                    "I'm sitting AMC Clinical in June 2025. I built these features for myself."
                  </p>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">"Why You Changed It" Analysis</p>
                  <ul className="mb-4 space-y-2">
                    {[
                      'Right→Wrong (panic changes — costly)',
                      'Wrong→Right (good instinct — trust it more)',
                      'Pattern: "You panic in Cardio, not Psych"',
                    ].map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">AMC Pressure Simulator</p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    16 stations. 8 minutes each. Simulates timed blocks with random distractions to train your nerves.
                  </p>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Strategy Session</p>
                  <ul className="mb-4 space-y-2">
                    {[
                      '30-min video call with founder',
                      'Review your weakness report together',
                      "Honest assessment — I won't lie to take your money",
                    ].map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mb-6 rounded-lg bg-muted p-3 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Pass Guarantee</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use Pro 3+ months, do the work, fail? Full refund. No "conditions."
                    </p>
                  </div>

                  <Button className="w-full" asChild>
                    <Link to="/login">Start 7-Day Free Trial <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground italic">
                    "I'm using Pro myself for Clinical prep. It works." — Founder, sitting Clinical June 2025
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* LIFETIME */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-xl">Lifetime</CardTitle>
                  <p className="text-sm text-muted-foreground">For Unpredictable Journeys Like Mine</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold font-display">$299</span>
                    <span className="text-muted-foreground"> one-time</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="mb-6 text-sm text-muted-foreground italic">
                    "My MCQ-to-PGY1 journey: 2 years. Not because I couldn't pass. Because I couldn't PAY."
                  </p>
                  <ul className="mb-6 space-y-3 flex-1">
                    {[
                      'Access forever. No monthly stress.',
                      'Includes all Pro features.',
                      'Direct access to founder for quick questions.',
                    ].map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 text-secondary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-4 text-xs text-muted-foreground italic">
                    "I wish I'd had this option. Instead I paid $50/month for 8 months, then paused, then paid again..."
                    — Founder, looking at old bank statements
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/login">Get Lifetime Access</Link>
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Limited to 50 users so I can actually provide support.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <h2 className="mb-4 text-3xl font-bold font-display text-center">What I Actually Used vs. What I Built</h2>
            <p className="mb-10 text-center text-muted-foreground">Brutally honest comparison</p>

            <div className="mx-auto max-w-4xl">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]"></TableHead>
                        <TableHead className="text-center font-display font-semibold text-primary">Zyntra Core</TableHead>
                        <TableHead className="text-center">eMedici</TableHead>
                        <TableHead className="text-center">AMDEX</TableHead>
                        <TableHead className="text-center text-muted-foreground">What I Did</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Price/month</TableCell>
                        <TableCell className="text-center font-semibold text-primary">$29</TableCell>
                        <TableCell className="text-center">$50</TableCell>
                        <TableCell className="text-center">$67</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">Trial hopping</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Who built it</TableCell>
                        <TableCell className="text-center">IMG (anon)</TableCell>
                        <TableCell className="text-center">Company</TableCell>
                        <TableCell className="text-center">Company</TableCell>
                        <TableCell className="text-center text-muted-foreground">N/A</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Questions</TableCell>
                        <TableCell className="text-center">5,000+</TableCell>
                        <TableCell className="text-center">4,500+</TableCell>
                        <TableCell className="text-center">3,000+</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">Free trials</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Tracks panic changes</TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-secondary mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-destructive mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-destructive mx-auto" /></TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">Excel</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Australian focus</TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-secondary mx-auto" /></TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-secondary mx-auto" /></TableCell>
                        <TableCell className="text-center text-muted-foreground">Partial</TableCell>
                        <TableCell className="text-center text-muted-foreground">Mixed</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Pause for 3 months</TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-secondary mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-destructive mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-destructive mx-auto" /></TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">Lost progress</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Founder you can DM</TableCell>
                        <TableCell className="text-center"><Check className="h-5 w-5 text-secondary mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-destructive mx-auto" /></TableCell>
                        <TableCell className="text-center"><X className="h-5 w-5 text-destructive mx-auto" /></TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">Forums</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <p className="mt-6 text-center text-sm text-muted-foreground italic">
                I don't have eMedici's budget. But I know exactly which questions made me cry at 2am. I put those in Zyntra.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <h2 className="mb-4 text-3xl font-bold font-display text-center">Frequently Asked Questions</h2>
            <p className="mb-12 text-center text-muted-foreground">The real answers, not marketing ones</p>

            <div className="mx-auto max-w-3xl space-y-8">
              {faqGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-4 text-lg font-semibold font-display flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    {group.title}
                  </h3>
                  <Accordion type="single" collapsible className="rounded-lg border border-border bg-card">
                    {group.questions.map((faq, i) => (
                      <AccordionItem key={i} value={`${group.title}-${i}`} className="border-border">
                        <AccordionTrigger className="px-4 text-left text-sm hover:no-underline">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="px-4 text-sm text-muted-foreground leading-relaxed">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Founder Footer */}
      <section className="py-12 border-t border-border/50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-display font-bold text-lg">Zyntra</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Built by an IMG · AMC MCQ 321/500 · PGY1 Sydney (Aug 2025)
              <br />
              Sitting AMC Clinical June 2025
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Contact: Use site messaging
              <br />
              Response: Usually 2–6 hours (unless at work or sleeping)
            </p>
            <p className="mt-4 text-xs text-muted-foreground italic">
              Current status: Studying for Clinical, starting PGY1, replying to messages between shifts.
            </p>
          </div>
        </div>
      </section>

      {/* Copyright Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground">Zyntra</span>
          </div>
          <p>© 2026 Zyntra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
