import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SEO } from '@/components/SEO';
import { PublicFooter } from '@/components/PublicFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useShowAboutPricing } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const THEATRE = [
  { label: 'Stations', status: 'On the table' },
  { label: 'Voice practice', status: 'Anaesthetised' },
  { label: 'Marking checklist', status: 'Being sutured' },
  { label: 'Adaptive stations', status: 'Not closed yet' },
];

export default function OsceInSurgery() {
  const { user } = useAuth();
  const { show: showAboutPricing } = useShowAboutPricing();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('contact_submissions').insert({
        name: name.trim() || 'OSCE interest',
        email: email.trim().toLowerCase(),
        category: 'osce_interest',
        message: note.trim() || 'Wants to know when clinical stations leave surgery.',
      });
      if (error) throw error;
      setSaved(true);
      toast.success('Interest recorded. Theatre will call you.');
    } catch {
      toast.error('Could not record that. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="OSCE is in surgery | Zyntra"
        description="Zyntra clinical stations are in surgery. They are not live. Leave your email and the interest list is recorded for the admin theatre board."
        path="/osce-in-surgery"
      />
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="Zyntra home">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold font-display">Zyntra</span>
          </Link>
          <nav aria-label="Page" className="flex items-center gap-3">
            {showAboutPricing && (
              <>
                <Button variant="ghost" asChild className="hidden text-sm sm:inline-flex">
                  <Link to="/about">About</Link>
                </Button>
                <Button variant="ghost" asChild className="hidden text-sm sm:inline-flex">
                  <Link to="/pricing">Pricing</Link>
                </Button>
              </>
            )}
            <ThemeToggle />
            <Button asChild>
              <Link to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Log in'}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container pb-20 pt-28">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[.16em] text-primary">
          <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" /> Theatre 2 · not visiting hours
        </p>
        <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight lg:text-5xl">
          OSCE features are active in surgery.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          Not the exam. The product. Stations, voice practice and checklists are on the table.
          They are not on the website. MCQ practice is the only open ward.
        </p>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {THEATRE.map((row) => (
            <li key={row.label} className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4">
              <span className="font-medium">{row.label}</span>
              <span className="text-sm text-muted-foreground">{row.status}</span>
            </li>
          ))}
        </ul>

        <section className="mt-12 max-w-xl rounded-2xl border border-border bg-card p-6" aria-labelledby="interest">
          <h2 id="interest" className="font-display text-2xl font-bold">Leave your name with the desk</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This is the interest list. It shows up in the admin panel under Interest. No station opens from this form.
          </p>
          {saved ? (
            <p className="mt-6 text-sm font-medium">Recorded. We will write when the patient is out of theatre.</p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <Input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input aria-label="Email" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input aria-label="Note" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" disabled={sending}>{sending ? 'Recording…' : 'Record my interest'}</Button>
            </form>
          )}
        </section>

        <nav className="mt-10 text-sm font-semibold text-primary">
          <Link to="/amc-part-1-mcq" className="hover:underline">Back to Part 1 MCQ</Link>
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
