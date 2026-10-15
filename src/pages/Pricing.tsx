import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Check, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { RAZORPAY_TIERS, CHECKOUT_DISABLED, type TierKey } from '@/lib/razorpay-config';
import { checkoutSummary, resubscribeSummary, COPY_CANCEL_RESUBSCRIBE, cancelCopy, COPY_CARD_CHECK, COPY_CANCEL } from '@/lib/billing';
import { SEO } from '@/components/SEO';
import { PublicFooter } from '@/components/PublicFooter';
import { PAYPAL_ENABLED } from '@/lib/payment-flags';

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
    title: 'Pricing & Billing',
    questions: [
      { q: 'How much is Zyntra?', a: 'One plan, Full Access: A$39/month or A$99 for 3 months. Prices are in Australian dollars (AUD). Both have a 7-calendar-day trial. Signup date counts as day 1; billing begins at 00:01 IST on day 7.' },
      { q: 'Why is there an A$1 charge?', a: COPY_CARD_CHECK },
      { q: 'How does billing work?', a: 'An A$1 card verification is taken at signup. Signup date counts as day 1 of the 7-calendar-day trial. If you do not cancel before then, the first subscription charge begins at 00:01 IST on day 7: A$39 monthly or A$99 every 3 months. Renewals follow the same IST calendar-day anchor.' },
      { q: 'Can I cancel?', a: COPY_CANCEL },
      { q: 'A$39 is still hard for me.', a: 'Use the contact form with the subject "Hardship" and tell us your situation.' },
    ],
  },
  {
    title: 'Product & Features',
    questions: [
      { q: 'Do you have actual AMC recalls?', a: "No. Sharing real exam questions is copyright violation. All questions are original, written against the blueprint and candidate feedback." },
      { q: 'How is this different from a question bank?', a: 'Zyntra records timing, confidence and answer changes alongside your score, so you can see whether a weak area is a knowledge gap or a pressure pattern.' },
      { q: 'Mobile app?', a: "Not yet. The website works on mobile browsers." },
    ],
  },
];

export default function Pricing() {
  const { user, subscription } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<TierKey | null>(null);
  const [paymentChoiceTier, setPaymentChoiceTier] = useState<TierKey | null>(null);
  const location = useLocation();

  // Support deep links such as /pricing#faq from the site footer
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
    return () => window.clearTimeout(t);
  }, [location.hash]);


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
    if (CHECKOUT_DISABLED) return; // fail closed: VITE_CHECKOUT_ENABLED must be exactly 'true'
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
        // Server owns plan IDs, price and trial dates; the client sends the interval only.
        body: { interval: config.interval },
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

  // Show the payment-method choice (Razorpay or PayPal) for a plan.
  // PayPal is behind VITE_PAYPAL_ENABLED (off by default): when off, go straight to Razorpay.
  const choosePayment = (tierKey: TierKey) => {
    if (CHECKOUT_DISABLED) return; // fail closed: VITE_CHECKOUT_ENABLED must be exactly 'true'
    if (!user) {
      navigate('/login');
      return;
    }
    if (!PAYPAL_ENABLED) {
      handleCheckout(tierKey);
      return;
    }
    setPaymentChoiceTier(tierKey);
  };

  // PayPal: redirect approval flow. The server looks up the price/plan for the tier.
  const handlePayPalCheckout = async (tierKey: TierKey) => {
    if (!PAYPAL_ENABLED) return;
    if (!user) {
      navigate('/login');
      return;
    }
    setLoadingTier(tierKey);
    try {
      const { data, error } = await supabase.functions.invoke('create-paypal-order', {
        body: { tierKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.approve_url) throw new Error('PayPal did not return an approval link');
      window.location.href = data.approve_url;
      return;
    } catch (e) {
      toast({ title: 'Checkout failed', description: (e instanceof Error && e.message) || 'Please try again', variant: 'destructive' });
    }
    setLoadingTier(null);
  };

  // PayPal return: /pricing?paypal=return&token=ORDER_ID or &subscription_id=I-XXXX
  useEffect(() => {
    if (!PAYPAL_ENABLED || !user) return;
    const params = new URLSearchParams(window.location.search);
    const paypalState = params.get('paypal');
    if (!paypalState) return;
    const subscriptionId = params.get('subscription_id');
    const orderId = params.get('token');
    window.history.replaceState({}, '', window.location.pathname);
    if (paypalState === 'cancel') {
      toast({ title: 'PayPal checkout cancelled' });
      return;
    }
    if (paypalState !== 'return' || (!subscriptionId && !orderId)) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
          body: subscriptionId ? { subscription_id: subscriptionId } : { order_id: orderId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: 'Payment successful!', description: 'Your subscription is now active.' });
        navigate('/dashboard?payment=success');
      } catch (vErr) {
        toast({ title: 'Payment verification failed', description: vErr instanceof Error ? vErr.message : String(vErr), variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Returning customers (already used a trial) resubscribe without a trial; server enforces the same rule.
  const returning = !!user && subscription.trial_eligible === false;
  const isCurrentTier = (_tierKey: string) => subscription.subscribed && subscription.tier === 'full_access';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Zyntra Pricing — Full Access in AUD"
        description="One plan, Full Access: A$39/month or A$99 for 3 months (AUD), with a 7-calendar-day trial and A$1 card verification at signup. Cancel before the trial ends to avoid the subscription charge."
        path="/pricing"
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
            {!user && (
              <Button variant="ghost" asChild className="hidden text-sm sm:inline-flex">
                <Link to="/login">Log in</Link>
              </Button>
            )}
            <Button asChild>
              <Link to="/dashboard">{user ? 'Dashboard' : 'Get Started'}</Link>
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
            <p className="text-lg text-muted-foreground">Simple pricing designed for IMGs. One plan. All prices in Australian dollars (AUD).</p>
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
            className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3"
          >
            {/* FREE */}
            <motion.div variants={fadeUp}>
              <Card className="h-full flex flex-col border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Free</CardTitle>
                  <p className="text-xs text-muted-foreground">Explore the platform</p>
                  <p className="mt-3 text-3xl font-bold font-display">A$0</p>
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

            {/* FULL ACCESS — the only paid plan */}
            {(['full_access', 'full_access_3m'] as const).map((tierKey) => {
              const cfg = RAZORPAY_TIERS[tierKey];
              return (
              <motion.div key={tierKey} variants={fadeUp}>
                <Card className={`h-full flex flex-col ${tierKey === 'full_access_3m' ? 'border-2 border-primary' : 'border-border'}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Full Access {tierKey === 'full_access_3m' ? '· 3 months' : '· Monthly'}</CardTitle>
                    <p className="text-xs text-muted-foreground">7-calendar-day trial · A$1 card verification at signup</p>
                    <div className="mt-3"><span className="text-3xl font-bold font-display">A${cfg.price}</span><span className="text-muted-foreground text-sm">{tierKey === 'full_access_3m' ? ' / 3 months' : ' / month'}</span></div>
                    <p className="text-xs text-muted-foreground">AUD</p>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="mb-4 space-y-2 flex-1">
                      {['Full MCQ question bank', 'Clinical / OSCE practice as available', 'Performance analytics', 'AI study companion', 'Study plan generator'].map((f) => (
                        <li key={f} className="flex gap-2 text-xs"><Check className="h-3.5 w-3.5 mt-0.5 text-secondary shrink-0" /><span>{f}</span></li>
                      ))}
                    </ul>
                    <p className="mb-2 text-xs text-foreground" data-testid={`checkout-summary-${tierKey}`}>{returning ? resubscribeSummary(cfg.interval) : checkoutSummary(cfg.interval)}</p>
                    <p className="mb-4 text-xs text-muted-foreground">{returning ? COPY_CANCEL_RESUBSCRIBE : <>{COPY_CARD_CHECK} {cancelCopy(cfg.interval)}</>}</p>
                    <Button size="sm" className="w-full" onClick={() => choosePayment(tierKey)} disabled={CHECKOUT_DISABLED || loadingTier === tierKey || isCurrentTier(tierKey)}>
                      {isCurrentTier(tierKey) ? 'Current' : loadingTier === tierKey ? <Loader2 className="h-4 w-4 animate-spin" /> : CHECKOUT_DISABLED ? 'Coming soon' : returning ? 'Resubscribe' : 'Start 7-calendar-day trial'}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-20 bg-muted/50">
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

      {/* Payment method choice (only rendered when PayPal is enabled) */}
      {PAYPAL_ENABLED && (
      <Dialog open={paymentChoiceTier !== null} onOpenChange={(open) => { if (!open) setPaymentChoiceTier(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose payment method</DialogTitle>
            <DialogDescription>
              {paymentChoiceTier ? `${RAZORPAY_TIERS[paymentChoiceTier].name} — A$${RAZORPAY_TIERS[paymentChoiceTier].price} AUD` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => { const t = paymentChoiceTier; setPaymentChoiceTier(null); if (t) handleCheckout(t); }}
            >
              Pay with Razorpay
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { const t = paymentChoiceTier; setPaymentChoiceTier(null); if (t) handlePayPalCheckout(t); }}
            >
              Pay with PayPal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
