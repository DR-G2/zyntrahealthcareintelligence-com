import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cancelCopy } from '@/lib/billing';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });

/** Settings > Billing: one-click cancel. Server verifies the JWT and subscription ownership. */
export function BillingCard() {
  const { subscription } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inTrial: boolean; accessEndsAt: string } | null>(null);

  const cancel = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-razorpay-subscription', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ inTrial: !!data.in_trial, accessEndsAt: data.access_ends_at });
      toast.success('Subscription cancelled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel. Please try again.');
    }
    setBusy(false);
  };

  return (
    <Card id="billing">
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{cancelCopy(subscription.plan_interval === 'quarterly' ? 'quarterly' : 'monthly')}</p>
        {result ? (
          <p className="text-sm font-medium" data-testid="cancel-result">
            {result.inTrial
              ? `Your trial is cancelled. You won't be charged. Access ended on ${fmt(result.accessEndsAt)}.`
              : `Your subscription is cancelled. You keep access until ${fmt(result.accessEndsAt)}. You won't be charged again.`}
          </p>
        ) : (
          <Button variant="destructive" onClick={cancel} disabled={busy || !subscription.subscribed}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel subscription'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
