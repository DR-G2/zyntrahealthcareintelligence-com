import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";

export function StandaloneFooter() {
  return (
    <footer className="zh-phase2-footer">
      <Link to="/" className="zh-phase2-footer-brand" aria-label="Zyntra home">
        <BrandMark className="h-7 w-7" />
        <span>Zyntra</span>
      </Link>
      <nav aria-label="Footer navigation">
        <Link to="/features">Features</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/about">About</Link>
        <Link to="/faq">FAQ</Link>
        <Link to="/blog">Journal</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <a href="mailto:hello@zyntrahealthcareintelligence.com">Contact</a>
      </nav>
    </footer>
  );
}
