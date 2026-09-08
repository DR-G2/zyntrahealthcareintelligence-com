import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="About Zyntra — Reasoning-First AMC Training"
        description="Why Zyntra trains clinical reasoning instead of recall: the APPE engine, behavioural analytics, and original AMC-style content built by clinicians."
        path="/about"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'WebPage', name: 'About Zyntra', url: 'https://www.zyntrahealthcareintelligence.com/about' }}
      />
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
              <Link to="/about">About</Link>
            </Button>
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

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="container">
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              About Zyntra
            </div>
            <h1 className="mb-6 text-4xl font-bold font-display leading-tight tracking-tight lg:text-5xl">
              Built by an IMG who struggled through the{' '}
              <span className="gradient-text">same AMC journey</span>{' '}
              you're on right now.
            </h1>
          </motion.div>
        </div>
      </section>

      {/* Intro */}
      <section className="pb-16">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl space-y-6 text-base leading-relaxed text-muted-foreground">
            <p className="text-xl text-foreground font-display font-semibold">
              I didn't pass AMC because I'm unusually smart.
            </p>
            <p>
              I passed because I eventually figured out how to study properly.
            </p>
            <p>
              And it took longer than I expected.
            </p>
          </motion.div>
        </div>
      </section>

      {/* The Turning Point */}
      <section className="py-16 border-t border-border/50">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl">
            <h2 className="mb-8 text-3xl font-bold font-display">The Turning Point</h2>
            <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
              <p>I started preparing for the AMC MCQ in early 2024.</p>
              <p>At first, I was doing what most candidates do:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>solving random MCQs</li>
                <li>jumping between resources</li>
                <li>reading explanations without a real system</li>
              </ul>
              <p>Months passed, but honestly, I wasn't improving.</p>
              <p>My scores stayed roughly the same. My confidence wasn't getting better. It felt like I was studying a lot but moving nowhere.</p>
              <p className="text-foreground font-semibold">Then I changed two things.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 1. Fixing the Foundation */}
      <section className="py-16 bg-muted/50">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-2xl font-bold font-display">1️⃣ Fixing the Foundation</h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p><p>I started following Arimgsas approach, which helped rebuild my core clinical reasoning.</p></p>
              <p>Instead of memorizing answers, I started focusing on:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>why a diagnosis makes sense</li>
                <li>what feature in the stem actually matters</li>
                <li>what the examiners are really testing</li>
              </ul>
              <p className="text-foreground font-medium">That fixed my base knowledge.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Fixing Exam Behaviour */}
      <section className="py-16">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-2xl font-bold font-display">2️⃣ Fixing My Exam Behaviour</h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>The second change was something most platforms ignore.</p>
              <p>I started analysing:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>the questions I got wrong</li>
                <li>the ones I changed from correct → wrong</li>
                <li>when my first instinct was actually right</li>
              </ul>
              <p>That's where the idea behind Zyntra started forming.</p>
              <p>Tracking mistakes, patterns, and gut decisions helped me see something important:</p>
              <p className="text-foreground font-semibold">
                A lot of my errors weren't knowledge gaps. They were decision mistakes during the exam.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Result */}
      <section className="py-16 bg-muted/50">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-3xl font-bold font-display">The Result</h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>Once I combined:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>strong clinical foundations</li>
                <li>structured wrong-question analysis</li>
                <li>tracking instinct vs overthinking</li>
              </ul>
              <p>my progress changed dramatically.</p>
              <p>Within two months, I was finally ready.</p>
              <p>I sat the exam in May 2025.</p>
              <p className="text-3xl font-bold font-display text-primary">AMC MCQ Score: 321 / 500</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Zyntra Exists */}
      <section className="py-16">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-3xl font-bold font-display">Why Zyntra Exists</h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>While preparing, I realised something frustrating.</p>
              <p>Most platforms only help you practice questions.</p>
              <p>Very few help you understand:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>why you keep making the same mistakes</li>
                <li>when you overthink</li>
                <li>when your first instinct is actually correct</li>
              </ul>
              <p className="text-foreground font-semibold">
                Zyntra was built around those ideas.
              </p>
              <p>Not just more questions. But better feedback on how you think during exams.</p>
            </div>

            <div className="mt-10 flex items-center justify-center gap-4">
              <Button size="lg" asChild className="gap-2 text-base px-8">
                <Link to="/pricing">
                  View Plans <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Founder Footer */}
      <section className="py-12 border-t border-border/50 bg-muted/50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="mb-2 font-display font-bold text-lg">About the Founder</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              IMG · AMC MCQ 321/500
            </p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Started preparing seriously in 2024<br />
              Cleared AMC MCQ in May 2025
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Currently preparing for AMC Clinical and beginning PGY1 in Sydney.
            </p>
            <p className="mt-2 text-xs text-muted-foreground italic">
              Zyntra is built alongside work and exam preparation, so responses may take a few hours.
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
          <p>Built by an IMG · For IMGs</p>
        </div>
      </footer>
    </div>
  );
}
