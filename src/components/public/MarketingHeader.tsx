import { useState } from "react";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";

export function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkHeader, setDarkHeader] = useState(true);
  const nav = [["Why Zyntra", "/#why"], ["How it works", "/how-it-works"], ["Features", "/#features"], ["For IMGs", "/#imgs"], ["Pricing", "/pricing"], ["About", "/about"], ["FAQ", "/faq"]];
  return (
    <header className={`zh-header ${darkHeader ? "" : "zh-header-light"}`}>
      <div className="zh-header-inner">
        <a className="zh-brand" href="/#top" aria-label="Zyntra home"><BrandMark className="h-9 w-9" /><span><b>ZYNTRA</b><small>HEALTHCARE INTELLIGENCE</small></span></a>
        <nav className={`zh-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          {nav.map(([label, href])=><a key={label} href={href} onClick={()=>setMenuOpen(false)}>{label}</a>)}
          <button className="zh-theme" type="button" aria-label={darkHeader ? "Switch header to light theme" : "Switch header to dark theme"} onClick={()=>setDarkHeader(v=>!v)}>{darkHeader ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <Link to="/login" className="zh-signin">Sign in</Link>
          <Link to="/login" className="zh-join">Join Early Access <ArrowRight size={15}/></Link>
        </nav>
        <button className="zh-menu" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen ? <X/> : <Menu/>}</button>
      </div>
    </header>

  );
}
