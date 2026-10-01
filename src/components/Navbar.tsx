import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a className="brand" href="#top" aria-label="Zyntra home">
          <span className="brand-mark" aria-hidden="true"><span className="brand-z">Z</span></span>
          <span className="brand-word">ZYNTRA</span>
        </a>
        <Link to="/login" className="header-cta">Get Started</Link>
      </div>
    </header>
  );
}
