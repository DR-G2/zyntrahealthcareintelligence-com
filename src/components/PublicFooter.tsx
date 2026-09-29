import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { LEGAL_EMAIL } from '@/lib/legal';
import { useAuth } from '@/contexts/AuthContext';
import { useShowAboutPricing } from '@/hooks/useSiteSettings';

interface PublicFooterProps {
  /** Show the AMC independence disclaimer (hide if the page already shows it). */
  showDisclaimer?: boolean;
}

/** Shared footer for public (logged-out) pages: home, about, pricing, terms, privacy. */
export function PublicFooter({ showDisclaimer = true }: PublicFooterProps) {
  const { user } = useAuth();
  const { show: showAboutPricing } = useShowAboutPricing();
  const linkClass = 'hover:text-foreground transition-colors';

  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="container space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <Link to="/" className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground">Zyntra</span>
          </Link>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link to="/" className={linkClass}>Home</Link>
            {showAboutPricing && <Link to="/about" className={linkClass}>About</Link>}
            {showAboutPricing && <Link to="/pricing" className={linkClass}>Pricing</Link>}
            {showAboutPricing && <Link to="/pricing#faq" className={linkClass}>FAQ</Link>}
            <Link to="/terms" className={linkClass}>Terms</Link>
            <Link to="/privacy" className={linkClass}>Privacy</Link>
            <a href={`mailto:${LEGAL_EMAIL}?subject=Zyntra Support Request`} className={linkClass}>Contact</a>
            {user
              ? <Link to="/dashboard" className={linkClass}>Dashboard</Link>
              : <Link to="/login" className={linkClass}>Log in / Sign up</Link>}
          </nav>
        </div>
        {showDisclaimer && (
          <p className="text-center text-xs text-muted-foreground/70">
            Zyntra is an independent exam preparation platform and is not affiliated with or endorsed by the Australian Medical Council.
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground/70">© 2026 Zyntra · <a href={`mailto:${LEGAL_EMAIL}`} className={linkClass}>{LEGAL_EMAIL}</a></p>
      </div>
    </footer>
  );
}
