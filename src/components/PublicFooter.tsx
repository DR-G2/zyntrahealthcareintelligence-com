import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { LEGAL_EMAIL } from '@/lib/legal';

export function PublicFooter() {
  const linkClass = 'hover:text-foreground transition-colors';
  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="container space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <Link to="/" className="flex items-center gap-2" aria-label="Zyntra home">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-foreground">Zyntra Healthcare Intelligence</span>
          </Link>
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <a href="/#faq" className={linkClass}>FAQ</a>
            <Link to="/terms" className={linkClass}>Terms</Link>
            <Link to="/privacy" className={linkClass}>Privacy</Link>
            <a href="/#contact" className={linkClass}>Contact</a>
            <a href="/#contact" className={linkClass}>Get in touch</a>
          </nav>
        </div>
        <p className="text-center text-xs">Zyntra is an independent exam preparation platform and is not affiliated with or endorsed by the Australian Medical Council. Clinical stations are not live.</p>
        <p className="text-center text-xs">© 2026 Zyntra · <a href={`mailto:${LEGAL_EMAIL}`} className={linkClass}>{LEGAL_EMAIL}</a></p>
      </div>
    </footer>
  );
}
