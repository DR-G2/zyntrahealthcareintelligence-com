import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LegalFooter } from '@/components/LegalFooter';
import { LEGAL_EMAIL } from '@/lib/legal';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container max-w-3xl py-16 flex-1">
        <Button variant="ghost" asChild className="mb-8 gap-2">
          <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Home</Link>
        </Button>

        <h1 className="text-3xl font-bold font-display mb-2">Refund Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Free Trial</h2>
            <p>Zyntra offers a free diagnostic assessment so you can experience the platform before subscribing. No credit card is required for the free trial.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Subscription Refunds</h2>
            <p>If you are unsatisfied with your subscription, you may request a full refund within <strong>7 days</strong> of your initial purchase, provided you have not completed more than 3 full practice sessions during that period.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How to Request a Refund</h2>
            <p>Email us at <a href={`mailto:${LEGAL_EMAIL}?subject=Refund Request`} className="text-primary hover:underline">{LEGAL_EMAIL}</a> with your registered email address and reason for the refund. We aim to process all refund requests within 5 business days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Non-Refundable Items</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Subscriptions older than 7 days from the date of purchase</li>
              <li>Accounts that have been banned for Terms of Service violations</li>
              <li>Promotional or discounted plans marked as non-refundable at the time of purchase</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Cancellation</h2>
            <p>You can cancel your subscription at any time from the Settings page. Your access will continue until the end of your current billing period. No further charges will be made after cancellation.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Contact</h2>
            <p>For any billing or refund queries, please contact us at <a href={`mailto:${LEGAL_EMAIL}?subject=Billing Query`} className="text-primary hover:underline">{LEGAL_EMAIL}</a>.</p>
          </section>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
