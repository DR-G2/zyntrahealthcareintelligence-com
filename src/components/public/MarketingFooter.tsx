import { ArrowUpRight, Play } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function MarketingFooter() {
  return (
    <footer className="zh-footer"><div className="zh-container"><div className="zh-footer-top"><a className="zh-brand zh-footer-brand" href="/#top"><BrandMark className="h-9 w-9"/><span><b>ZYNTRA</b><small>HEALTHCARE INTELLIGENCE</small></span></a><nav aria-label="Footer navigation"><a href="/#features">Product</a><a href="/#pricing">Pricing</a><a href="/#about">About</a><a href="/how-it-works#faq">FAQ</a><a href="mailto:hello@zyntrahealthcareintelligence.com">Contact</a></nav><div className="zh-socials"><a href="https://x.com" aria-label="X"><ArrowUpRight/></a><a href="https://linkedin.com" aria-label="LinkedIn"><ArrowUpRight/></a><a href="https://instagram.com" aria-label="Instagram"><ArrowUpRight/></a><a href="https://youtube.com" aria-label="YouTube"><Play/></a></div></div><p className="zh-footer-legal">Zyntra is independent of, and not affiliated with, the Australian Medical Council.</p></div></footer>

  );
}
