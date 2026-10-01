import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PracticeOsce() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('contact_submissions').insert({ name: email, email, category: 'osce_interest', message: 'OSCE interest from Practice' });
    setSent(true);
  };
  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-display text-3xl font-bold">OSCE</h1>
        <p className="text-muted-foreground">Not live yet. Stations, voice practice and checklists are not available. MCQ is the live room.</p>
        <p className="text-sm text-muted-foreground">Your review of stations will open here when OSCE is live. No station starts from this tab.</p>
        {sent ? <p className="text-sm">Interest recorded.</p> : (
          <form onSubmit={submit} className="flex gap-2">
            <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit">Record interest</Button>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
