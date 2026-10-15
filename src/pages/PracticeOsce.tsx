import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';

export default function PracticeOsce() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const { error: saveError } = await supabase.from('contact_submissions').insert({ name: email, email, category: 'osce_interest', message: 'OSCE interest from Practice' });
      if (saveError) throw saveError;
      setSent(true);
    } catch { setError('Your interest could not be recorded. Please try again.'); }
    finally { setSaving(false); }
  };
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-border/60 pb-6"><p className="mb-3 flex items-center gap-2 text-sm font-medium text-primary"><ClipboardCheck className="h-4 w-4" />Encounter room</p><h1 className="font-display text-3xl font-semibold">OSCE</h1></header>
        <section className="grid gap-10 py-10 md:grid-cols-[1.2fr_1fr] md:py-14">
          <div><span className="text-sm font-medium text-warning">Not available yet</span><h2 className="mt-4 font-display text-2xl font-medium">Clinical stations are not live.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">Stations, voice practice, checklists and station feedback are not available from this room.</p><Button asChild className="mt-6"><Link to="/practice">Continue MCQ practice <ArrowRight className="h-4 w-4" /></Link></Button></div>
          <div className="border-t border-border/60 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0"><h2 className="text-lg font-semibold">Record your interest</h2>
            {sent ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-5 w-5" />Interest recorded.</p> : (
              <form onSubmit={submit} className="mt-5 space-y-3">
                <Label htmlFor="osce-interest-email">Email address</Label>
                <Input id="osce-interest-email" type="email" required autoComplete="email" value={email} disabled={saving} onChange={(e) => setEmail(e.target.value)} />
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button variant="outline" type="submit" disabled={saving} className="min-h-11 w-full">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Recording…' : 'Record interest'}</Button>
              </form>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
