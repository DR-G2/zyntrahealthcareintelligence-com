import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Brain, Clock, Target, BarChart3, ArrowRight, Rss, Send, Stethoscope, TrendingUp, CheckCircle, Smartphone, Heart, Pill, Baby, Bone, Syringe, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useShowAboutPricing } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LEGAL_EMAIL } from '@/lib/legal';

const features = [
  {
    icon: Brain,
    title: 'Behavioral Analysis',
    description: 'Track answer changes, hesitation patterns, and time management — the real reasons candidates fail.',
  },
  {
    icon: Clock,
    title: 'Pressure Training',
    description: 'Timed drills and commitment exercises that simulate real exam conditions.',
  },
  {
    icon: Rss,
    title: 'Feed',
    description: 'Paste any clinical content and instantly generate exam-style MCQ questions or OSCE stations.',
  },
  {
    icon: Target,
    title: 'Adaptive Engine',
    description: 'AI identifies your weak patterns and creates a personalized training plan.',
  },
  {
    icon: BarChart3,
    title: 'Deep Analytics',
    description: 'Performance profiles with stability scores, readiness metrics, and progress tracking.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Ready',
    description: 'Train on the bus, in the break room, or on the couch. Full functionality on any device.',
  },
];

const stationShowcase = [
  { title: 'Chest Pain', specialty: 'Cardiology', icon: Heart },
  { title: 'Type 2 Diabetes', specialty: 'Endocrinology', icon: Pill },
  { title: 'Prenatal Care', specialty: 'Obstetrics', icon: Baby },
  { title: 'Fracture Assessment', specialty: 'Orthopaedics', icon: Bone },
  { title: 'Acute Abdomen', specialty: 'Surgery', icon: Syringe },
  { title: 'Asthma Exacerbation', specialty: 'Respiratory', icon: Activity },
];

const faqs = [
  {
    q: 'What is Zyntra?',
    a: 'Zyntra is an AI-powered exam preparation platform for AMC (Australian Medical Council) examinations. It goes beyond traditional question banks by analyzing your behavioral patterns — answer changes, hesitation, time pressure responses — and training you to overcome the real reasons candidates fail.',
  },
  {
    q: 'How is Zyntra different from other AMC prep platforms?',
    a: 'Zyntra features the APPE (Adaptive Performance & Preparation Engine), which tracks behavioral signals like answer stability, composure under pressure, and confidence calibration. We also offer AI Voice Practice for OSCE stations, SRS flashcards, and gold-standard model answer coaching — features most platforms lack.',
  },
  {
    q: 'Is Zyntra content the same as real AMC exam questions?',
    a: 'No. All Zyntra content is original, independently developed by our team and AI systems. Our scenarios are not recalled, copied, or derived from actual AMC examination content. Zyntra is not affiliated with the Australian Medical Council.',
  },
  {
    q: 'What does the free trial include?',
    a: 'The free trial gives you access to the Diagnostic MCQ assessment and one Diagnostic OSCE station per day so you can experience the platform and see your initial performance profile before subscribing.',
  },
  {
    q: 'How does the Voice Practice feature work?',
    a: 'Voice Practice uses your browser\'s built-in Web Speech API to simulate OSCE patient conversations. All audio processing happens locally on your device — no recordings are sent to our servers. It works best in Chrome and Edge browsers.',
  },
  {
    q: 'Can I export my learning data?',
    a: 'Yes. Zyntra supports full data portability. You can export your performance history, study progress, and learning data from the Settings page at any time.',
  },
  {
    q: 'Does Zyntra cover both AMC MCQ and Clinical (OSCE)?',
    a: 'Yes. Zyntra is one of the few platforms covering both stages — a full MCQ question bank with behavioral analytics for AMC Part 1, and AI-powered voice OSCE stations with model-answer coaching for AMC Clinical. Most competitors only do one.',
  },
  {
    q: 'How much time do I need each day?',
    a: 'As little as 15 minutes. The platform is built for busy IMGs — you can complete a single OSCE station, a focused MCQ block, or a flashcard review on the bus, in the break room, or before bed. Consistency beats marathon sessions.',
  },
  {
    q: 'Won\'t I pick up bad habits practising with AI?',
    a: 'No — and that\'s why we built APPE. Every session is scored against AMC marking criteria, and our behavioral engine flags weak patterns (rushed answers, hesitation, structure breakdown) before they become habits. You also get gold-standard model walkthroughs after every station.',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Landing() {
  const { show: showAboutPricing } = useShowAboutPricing();
  const [contactForm, setContactForm] = useState({ name: '', email: '', category: 'general', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (contactForm.name.length > 100 || contactForm.email.length > 255 || contactForm.message.length > 2000) {
      toast.error('Input exceeds maximum length');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('contact_submissions').insert({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        category: contactForm.category,
        message: contactForm.message.trim(),
      });
      if (error) throw error;
      await supabase.functions.invoke('send-contact-notification', {
        body: {
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
          category: contactForm.category,
          message: contactForm.message.trim(),
        },
      }).catch(() => {});
      toast.success('Message sent! We\'ll get back to you soon.');
      setContactForm({ name: '', email: '', category: 'general', message: '' });
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 glass">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-display">Zyntra</span>
          </div>
          <div className="flex items-center gap-3">
            {showAboutPricing && (
              <>
                <Button variant="ghost" asChild className="text-sm">
                  <Link to="/about">About</Link>
                </Button>
                <Button variant="ghost" asChild className="text-sm">
                  <Link to="/pricing">Pricing</Link>
                </Button>
              </>
            )}
            <ThemeToggle />
            <Button asChild>
              <Link to="/dashboard">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              AI-Powered AMC Exam Preparation
            </div>
            <h1 className="mb-6 text-5xl font-bold font-display leading-tight tracking-tight lg:text-6xl">
              AMC Exam Preparation.{' '}
              <span className="gradient-text">Train to pass.</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Zyntra is the AI-powered AMC prep platform for IMGs — covering AMC Part 1 MCQs and AMC Clinical (OSCE) with behavioral analytics, voice patient practice, and gold-standard AMC scoring.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="gap-2 text-base px-8">
                <Link to="/dashboard">
                  Start Training <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2 text-base px-8">
                <Link to="/stations?demo=true">
                  Try a Free Station <Stethoscope className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            {/* Trust Badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-primary" /> No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-primary" /> Free diagnostic assessment
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-primary" /> Cancel anytime
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t border-border/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold font-display">The APPE Advantage</h2>
            <p className="text-muted-foreground text-lg">
              Adaptive Performance & Preparation Engine
            </p>
          </motion.div>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={item}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/30"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-muted/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold font-display">How It Works</h2>
            <p className="text-muted-foreground text-lg">Practise. Score. Improve. Repeat.</p>
          </motion.div>
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-6 md:grid-cols-5">
              {[
                { step: '1', icon: Target, title: 'Diagnose', desc: 'Take a diagnostic assessment. We track every behavioral signal.' },
                { step: '2', icon: Stethoscope, title: 'Practice', desc: 'AI OSCE stations with voice. MCQ drills with pressure modes.' },
                { step: '3', icon: BarChart3, title: 'Analyze', desc: 'Get your Readiness DNA score, behavior profile, and psychograph.' },
                { step: '4', icon: Brain, title: 'Reinforce', desc: 'SRS flashcards and targeted drills fill your knowledge gaps.' },
                { step: '5', icon: TrendingUp, title: 'Master', desc: 'Full mock exams and adaptive training until you\'re exam ready.' },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative flex flex-col items-center text-center rounded-xl border border-border bg-card p-6"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Step {s.step}</span>
                  <h3 className="mb-1 font-display font-semibold text-foreground">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  {i < 4 && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Station Showcase */}
      <section className="py-24 border-t border-border/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold font-display">Practice Real Clinical Stations</h2>
            <p className="text-muted-foreground text-lg">AI-generated OSCE scenarios across key specialties</p>
          </motion.div>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto"
          >
            {stationShowcase.map((s) => (
              <motion.div key={s.title} variants={item}>
                <Link
                  to="/stations?demo=true"
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/30 group"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm">{s.title}</h3>
                    <span className="text-xs text-muted-foreground">{s.specialty}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-muted/50">
        <div className="container max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold font-display">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-lg">Everything you need to know about Zyntra</p>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border border-border bg-card px-6">
                <AccordionTrigger className="text-left font-display font-semibold text-sm hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Emotional CTA Banner */}
      <section className="py-16 gradient-primary">
        <div className="container text-center">
          <h2 className="mb-4 text-3xl font-bold font-display text-primary-foreground">Your training starts now.</h2>
          <p className="mb-8 text-primary-foreground/80 text-lg max-w-xl mx-auto">
            Join hundreds of AMC candidates who are training smarter with Zyntra's behavioral intelligence engine.
          </p>
          <Button size="lg" variant="secondary" asChild className="gap-2 text-base px-8">
            <Link to="/dashboard">
              Start Preparing <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Contact */}
      <section className="py-24">
        <div className="container max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold font-display">Get in Touch</h2>
            <p className="text-muted-foreground text-lg">Have a question? We'd love to hear from you.</p>
          </motion.div>
          <form onSubmit={handleContactSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                placeholder="Your name"
                value={contactForm.name}
                onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                maxLength={100}
                required
              />
              <Input
                type="email"
                placeholder="Email address"
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                maxLength={255}
                required
              />
            </div>
            <Select value={contactForm.category} onValueChange={(v) => setContactForm(prev => ({ ...prev, category: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Inquiry</SelectItem>
                <SelectItem value="support">Technical Support</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Your message..."
              value={contactForm.message}
              onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
              maxLength={2000}
              rows={4}
              required
            />
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        </div>
      </section>

      {/* AMC Disclaimer */}
      <section className="border-t border-border/50 py-6">
        <div className="container">
          <p className="text-center text-[10px] text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed">
            Zyntra is an independent exam preparation platform and is not affiliated with, endorsed by, or connected to the Australian Medical Council (AMC), the Medical Board of Australia, or any official medical regulatory body. "AMC" is used solely for descriptive purposes.
          </p>
        </div>
      </section>

      {/* Enhanced Footer */}
      <footer className="border-t border-border/40 bg-muted/30 py-12">
        <div className="container">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
                  <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="font-bold font-display">Zyntra</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI-powered AMC exam preparation. Train smarter, not harder.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                {showAboutPricing && (
                  <>
                    <li><Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                    <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                  </>
                )}
                <li><Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Get Started</Link></li>
                <li><Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Login</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.amc.org.au" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">AMC Official Site ↗</a></li>
                <li><a href="#faq" onClick={(e) => { e.preventDefault(); document.querySelector('[data-faq]')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link to="/refund" className="text-muted-foreground hover:text-foreground transition-colors">Refund Policy</Link></li>
                <li><a href={`mailto:${LEGAL_EMAIL}`} className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-border/30 pt-6 text-center">
            <p className="text-[10px] text-muted-foreground/60">
              © {new Date().getFullYear()} Zyntra. All rights reserved. Content protected under the Copyright Act 1968 (Cth).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
