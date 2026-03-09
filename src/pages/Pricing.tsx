import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Check, X, MessageCircle, Shield, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { RAZORPAY_TIERS, type TierKey } from '@/lib/razorpay-config';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const faqGroups = [
  {
    title: 'Pricing & Money',
    questions: [
      {
        q: '$39 is still hard. I\'m working extra shifts just to pay rent.',
        a: 'Use the contact form. Subject: "Hardship." Tell me your situation. I\'ll work something out. I spent 2 years in the system because I couldn\'t afford fees. I won\'t let money stop you.',
      },
      {
        q: 'Why charge at all?',
        a: "Server costs ($400/month). And people don't value free tools. I've seen free groups with 10,000 members and zero engagement. Paying means you actually use it. That said—genuinely broke? I'll give you access. Just ask.",
      },
      {
        q: 'Why is Lifetime $349?',
        a: 'My MCQ-to-PGY1 journey: 2 years. $59 x 12 months = $708. $349 is less than half. Also: Lifetime users get direct access to me for quick questions. I limit to 50 so I can respond.',
      },
    ],
  },
  {
    title: 'Product & Features',
    questions: [
      {
        q: 'Do you have actual AMC recalls?',
        a: "No. Sharing real exam questions is copyright violation. AMC bans people for this. What I have: 5,000+ questions written by IMGs who passed. We study the blueprint and candidate feedback.",
      },
      {
        q: 'How is this different from eMedici?',
        a: 'eMedici is a question bank. Zyntra is a question bank + coach. eMedici: "You got 65% in Cardio." Zyntra: "You got 65% in Cardio, but took 5 minutes per question and changed 40% from right to wrong. You\'re panicking, not ignorant. Here\'s how to fix it."',
      },
      {
        q: 'Mobile app?',
        a: "Not yet. Website works on mobile browsers. I study on my phone during breaks. It works.",
      },
    ],
  },
  {
    title: 'Specific Situations',
    questions: [
      {
        q: 'Failed AMC twice. Which plan?',
        a: "Full Access. You don't need more questions. You need to know why you're failing. The behavioral analytics show if it's knowledge gaps (study more) or panic changes (trainable).",
      },
      {
        q: 'Working 40hrs/week. Which plan?',
        a: 'MCQ Only. You need efficiency. Weakness targeting tells you "skip Cardio, focus on Psych." Do 30 mins/day on commute.',
      },
      {
        q: 'Sitting AMC in 6 weeks. Too late?',
        a: "MCQ Only. 100 questions/day. Use weakness report to cram worst 3 topics. Just grind.",
      },
      {
        q: '6 months away. What to do?',
        a: "Free tier 2 months. Learn baseline. Then MCQ Only or Full Access depending on whether you need OSCE prep too.",
      },
    ],
  },
];

export default function Pricing() {
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);
  const [lifetimeSoldOut, setLifetimeSoldOut] = useState(false);

  useEffect(() => {
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('tier', 'lifetime')
      .eq('status', 'active')
      .then(({ count }) => {
        if (count !== null && count >= 100) setLifetimeSoldOut(true);
      });
  }, []);

  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async (tierKey: TierKey) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setLoadingTier(tierKey);
    try {
      await loadRazorpayScript();
      const config = RAZORPAY_TIERS[tierKey];

      // Determine the tier name for storage (strip _3m suffix)
      const baseTier = tierKey.replace('_3m', '');

      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          planId: config.plan_id || undefined,
          mode: config.mode,
          tier: baseTier,
          amount: config.price,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const options: any = {
        key: data.key_id,
        name: 'Zyntra',
        description: config.name,
        handler: async (response: any) => {
          // Verify payment
          try {
            const verifyBody: any = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              tier: baseTier,
              amount: config.price,
            };
            if (data.order_id) {
              verifyBody.razorpay_order_id = data.order_id;
            }
            if (data.subscription_id) {
              verifyBody.razorpay_subscription_id = response.razorpay_subscription_id || data.subscription_id;
            }
            const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: verifyBody,
            });
            if (verifyError) throw verifyError;
            toast({ title: 'Payment successful!', description: 'Your subscription is now active.' });
            navigate('/dashboard?payment=success');
          } catch (vErr: any) {
            toast({ title: 'Payment verification failed', description: vErr.message, variant: 'destructive' });
          }
        },
        prefill: { email: user.email },
        theme: { color: '#6366f1' },
      };

      if (data.subscription_id) {
        options.subscription_id = data.subscription_id;
      } else if (data.order_id) {
        options.order_id = data.order_id;
        options.amount = data.amount;
        options.currency = data.currency;
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast({ title: 'Checkout failed', description: e.message || 'Please try again', variant: 'destructive' });
    }
    setLoadingTier(null);
  };

  const isCurrentTier = (tierKey: string) => {
    if (!subscription.subscribed) return false;
    const tierMap: Record<string, string[]> = {
      'mcq_only': ['mcq_only'],
      'mcq_only_3m': ['mcq_only'],
      'osce_only': ['osce_only'],
      'osce_only_3m': ['osce_only'],
      'full_access': ['full_access'],
      'full_access_3m': ['full_access'],
      'lifetime': ['lifetime'],
    };
    return tierMap[tierKey]?.includes(subscription.tier) ?? false;
  };

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
              Pricing
            </div>
            <h1 className="mb-4 text-4xl font-bold font-display leading-tight tracking-tight lg:text-5xl">
              Choose Your <span className="gradient-text">Plan</span>
            </h1>
            <p className="text-lg text-muted-foreground">Simple pricing designed for IMGs.</p>
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
            variants={stagger}
            className="mx-auto grid max-w-6xl gap-5 md:grid-cols-5"
          >
            {/* FREE */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Free</CardTitle>
                  <p className="text-xs text-muted-foreground">Explore the platform</p>
                  <p className="mt-3 text-3xl font-bold font-display">$0</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="mb-6 space-y-2 flex-1">
                    {['Diagnostic MCQ test', 'Diagnostic OSCE station', 'Basic performance results', 'AI study companion (limited)'].map((f) => (
                      <li key={f} className="flex gap-2 text-xs"><Check className="h-3.5 w-3.5 mt-0.5 text-secondary shrink-0" /><span>{f}</span></li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="w-full" asChild><Link to="/dashboard">Start Free</Link></Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* MCQ ONLY */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">MCQ Only</CardTitle>
                  <p className="text-xs text-muted-foreground">AMC MCQ preparation</p>
                  <div className="mt-3"><span className="text-3xl font-bold font-display">$39</span><span className="text-muted-foreground text-sm">/mo</span></div>
                  <p className="text-xs text-muted-foreground">or $109/3mo</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="mb-6 space-y-2 flex-1">
                    {['Full MCQ question bank', 'Unlimited practice', 'Detailed performance analytics', 'AMC readiness score', 'AI explanations', 'Study plan generator'].map((f) => (
                      <li key={f} className="flex gap-2 text-xs"><Check className="h-3.5 w-3.5 mt-0.5 text-secondary shrink-0" /><span>{f}</span></li>
                    ))}
                  </ul>
                  <p className="mb-4 text-xs text-muted-foreground italic">Best for candidates focusing on AMC MCQ.</p>
                  <div className="space-y-2">
                    <Button size="sm" className="w-full" onClick={() => handleCheckout('mcq_only')} disabled={loadingTier === 'mcq_only' || isCurrentTier('mcq_only')}>
                      {isCurrentTier('mcq_only') ? 'Current' : loadingTier === 'mcq_only' ? <Loader2 className="h-4 w-4 animate-spin" /> : '$39/mo'}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleCheckout('mcq_only_3m')} disabled={loadingTier === 'mcq_only_3m'}>
                      {loadingTier === 'mcq_only_3m' ? <Loader2 className="h-4 w-4 animate-spin" /> : '$109/3mo'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* OSCE ONLY */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">OSCE Only</CardTitle>
                  <p className="text-xs text-muted-foreground">AMC Clinical preparation</p>
                  <div className="mt-3"><span className="text-3xl font-bold font-display">$39</span><span className="text-muted-foreground text-sm">/mo</span></div>
                  <p className="text-xs text-muted-foreground">or $109/3mo</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="mb-6 space-y-2 flex-1">
                    {['Unlimited OSCE stations', 'Adaptive OSCE training', '16-station exam simulations', 'AI patient interaction', 'Psychograph feedback'].map((f) => (
                      <li key={f} className="flex gap-2 text-xs"><Check className="h-3.5 w-3.5 mt-0.5 text-secondary shrink-0" /><span>{f}</span></li>
                    ))}
                  </ul>
                  <p className="mb-4 text-xs text-muted-foreground italic">Designed for AMC Clinical preparation.</p>
                  <div className="space-y-2">
                    <Button size="sm" className="w-full" onClick={() => handleCheckout('osce_only')} disabled={loadingTier === 'osce_only' || isCurrentTier('osce_only')}>
                      {isCurrentTier('osce_only') ? 'Current' : loadingTier === 'osce_only' ? <Loader2 className="h-4 w-4 animate-spin" /> : '$39/mo'}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleCheckout('osce_only_3m')} disabled={loadingTier === 'osce_only_3m'}>
                      {loadingTier === 'osce_only_3m' ? <Loader2 className="h-4 w-4 animate-spin" /> : '$109/3mo'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* FULL ACCESS */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-2 border-primary relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold"><Star className="h-3 w-3 mr-1" /> Best Value</Badge>
                </div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Full Access ⭐</CardTitle>
                  <p className="text-xs text-muted-foreground">Complete AMC preparation</p>
                  <div className="mt-3"><span className="text-3xl font-bold font-display">$59</span><span className="text-muted-foreground text-sm">/mo</span></div>
                  <p className="text-xs text-muted-foreground">or $169/3mo</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="mb-4 space-y-2 flex-1">
                    {['Full MCQ question bank', 'Unlimited OSCE stations', 'Adaptive OSCE training', 'Exam simulations', 'Behavioural analytics (Trust Your Gut)', 'AI Study Companion', 'Study plan generator', 'Mistake review engine', 'Social study groups'].map((f) => (
                      <li key={f} className="flex gap-2 text-xs"><Check className="h-3.5 w-3.5 mt-0.5 text-secondary shrink-0" /><span>{f}</span></li>
                    ))}
                  </ul>
                  <p className="mb-4 text-xs text-muted-foreground italic">Best for candidates preparing for both MCQ and Clinical.</p>
                  <div className="mb-3 rounded-lg bg-muted p-2">
                    <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-semibold">Pass Guarantee</span></div>
                  </div>
                  <div className="space-y-2">
                    <Button size="sm" className="w-full" onClick={() => handleCheckout('full_access')} disabled={loadingTier === 'full_access' || isCurrentTier('full_access')}>
                      {isCurrentTier('full_access') ? 'Current' : loadingTier === 'full_access' ? <Loader2 className="h-4 w-4 animate-spin" /> : '$59/mo'}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleCheckout('full_access_3m')} disabled={loadingTier === 'full_access_3m'}>
                      {loadingTier === 'full_access_3m' ? <Loader2 className="h-4 w-4 animate-spin" /> : '$169/3mo'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* LIFETIME */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">{lifetimeSoldOut ? '❌ Sold Out' : '🔥 First 100 Users'}</Badge>
                </div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Lifetime</CardTitle>
                  <p className="text-xs text-muted-foreground">One Payment, Forever</p>
                  <div className="mt-3"><span className="text-3xl font-bold font-display">$349</span><span className="text-muted-foreground text-sm"> once</span></div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="mb-6 space-y-2 flex-1">
                    {['Everything in Full Access', 'Lifetime platform access', 'Future updates included', 'No recurring payments'].map((f) => (
                      <li key={f} className="flex gap-2 text-xs"><Check className="h-3.5 w-3.5 mt-0.5 text-secondary shrink-0" /><span>{f}</span></li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleCheckout('lifetime')} disabled={lifetimeSoldOut || loadingTier === 'lifetime' || isCurrentTier('lifetime')}>
                    {lifetimeSoldOut ? 'Sold Out' : isCurrentTier('lifetime') ? 'Current' : loadingTier === 'lifetime' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Lifetime'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="mb-4 text-3xl font-bold font-display text-center">Feature Comparison</h2>
            <p className="mb-10 text-center text-muted-foreground">See what's included in each plan</p>

            <div className="mx-auto max-w-5xl">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Feature</TableHead>
                        <TableHead className="text-center">Free</TableHead>
                        <TableHead className="text-center">MCQ Only</TableHead>
                        <TableHead className="text-center">OSCE Only</TableHead>
                        <TableHead className="text-center font-semibold text-primary">Full Access</TableHead>
                        <TableHead className="text-center">Lifetime</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { feature: 'MCQ Questions', free: '20/day', mcq: 'Unlimited', osce: '20/day', full: 'Unlimited', life: 'Unlimited' },
                        { feature: 'OSCE Stations', free: '1/day', mcq: '1/day', osce: 'Unlimited', full: 'Unlimited', life: 'Unlimited' },
                        { feature: 'Question Bank', free: 'Limited', mcq: 'Full', osce: 'Limited', full: 'Full', life: 'Full' },
                        { feature: 'Performance Analytics', free: 'Basic', mcq: 'Full', osce: 'Full', full: 'Full', life: 'Full' },
                        { feature: 'AI Companion', free: 'Limited', mcq: 'Unlimited', osce: 'Unlimited', full: 'Unlimited', life: 'Unlimited' },
                        { feature: 'Trust Your Gut', free: false, mcq: true, osce: false, full: true, life: true },
                        { feature: 'Adaptive OSCE', free: false, mcq: false, osce: true, full: true, life: true },
                        { feature: 'Exam Simulations', free: false, mcq: false, osce: true, full: true, life: true },
                        { feature: 'Mistake Review', free: false, mcq: true, osce: true, full: true, life: true },
                        { feature: 'Study Groups', free: false, mcq: false, osce: false, full: true, life: true },
                        { feature: 'Pass Guarantee', free: false, mcq: false, osce: false, full: true, life: true },
                      ].map((row) => (
                        <TableRow key={row.feature}>
                          <TableCell className="font-medium">{row.feature}</TableCell>
                          {['free', 'mcq', 'osce', 'full', 'life'].map((key) => {
                            const val = row[key as keyof typeof row];
                            return (
                              <TableCell key={key} className="text-center">
                                {val === true ? <Check className="h-4 w-4 text-secondary mx-auto" /> :
                                 val === false ? <X className="h-4 w-4 text-muted-foreground/40 mx-auto" /> :
                                 <span className="text-xs">{val}</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
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

      {/* Footer */}
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
