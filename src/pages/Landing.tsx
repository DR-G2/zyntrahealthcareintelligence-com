import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Brain, Clock, Target, BarChart3, ArrowRight, Rss, Send, ChevronDown, Stethoscope, MessageSquare, BookOpen, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LegalFooter } from '@/components/LegalFooter';
import { useShowAboutPricing } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
              Don't just study.{' '}
              <span className="gradient-text">Train to pass.</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Zyntra goes beyond question banks. Our APPE engine identifies why candidates fail — 
              time pressure, answer hesitation, composure breakdown — and trains you to overcome it.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" asChild className="gap-2 text-base px-8">
                <Link to="/dashboard">
                  Start Training <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
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
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
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

      {/* APPE Stages */}
      <section className="py-24 bg-muted/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold font-display">How It Works</h2>
            <p className="text-muted-foreground text-lg">Five stages to exam readiness</p>
          </motion.div>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              { step: '01', title: 'Assess', desc: 'Take a timed diagnostic — we track every behavioral signal.' },
              { step: '02', title: 'Feed', desc: 'Paste clinical content and generate targeted practice material instantly.' },
              { step: '03', title: 'Identify', desc: 'AI generates your Performance Profile with stability and composure scores.' },
              { step: '04', title: 'Adapt', desc: 'Get a personalized study plan targeting your specific failure patterns.' },
              { step: '05', title: 'Build', desc: 'Train with pressure drills, speed rounds, and commitment exercises.' },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 rounded-xl border border-border bg-card p-6"
              >
                <span className="text-3xl font-bold font-display text-primary/30">{s.step}</span>
                <div>
                  <h3 className="mb-1 font-display font-semibold text-lg">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 border-t border-border/50">
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

      {/* Contact */}
      <section className="py-24 bg-muted/50">
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

      {/* Footer */}
      <LegalFooter />
    </div>
  );
}
