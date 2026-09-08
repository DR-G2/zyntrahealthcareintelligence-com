import { Link } from 'react-router-dom';
import { LEGAL_EMAIL } from '@/lib/legal';

export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-border/40 py-6">
      <div className="container space-y-2 text-center">
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/70">
          <span>© 2026 Zyntra</span>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span>·</span>
          <a href={`mailto:${LEGAL_EMAIL}?subject=Zyntra Support Request`} className="hover:text-foreground transition-colors">Contact</a>
        </div>
        <p className="text-[10px] text-muted-foreground/60 max-w-lg mx-auto leading-relaxed">
          All Zyntra content is protected under the Copyright Act 1968 (Cth). Unauthorized copying, redistribution, scraping, or sharing of content is prohibited.
        </p>
      </div>
    </footer>
  );
}
