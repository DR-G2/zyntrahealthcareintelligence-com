import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import "@/styles/zyntra-home.css";
import "@/styles/zyntra-amc-mcq.css";
import "@/styles/zyntra-tokens.css";

const SITE = "https://www.zyntrahealthcareintelligence.com";

export interface LandingSection { heading: string; paragraphs?: string[]; bullets?: string[] }
export interface LandingLink { to: string; label: string; note: string }

interface Props {
  path: string;
  title: string;
  description: string;
  breadcrumb: string;
  eyebrow: string;
  h1: string;
  intro: string;
  sections: LandingSection[];
  related: LandingLink[];
  faqs: { q: string; a: string }[];
}

/** Shared, content-driven layout for public AMC preparation guides. */
export function SeoLandingPage({ path, title, description, breadcrumb, eyebrow, h1, intro, sections, related, faqs }: Props) {
  const url = `${SITE}${path}`;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: h1, url, description },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: breadcrumb, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <div className="zyntra-home amc-mcq-page min-h-screen bg-background text-foreground">
      <SEO title={title} description={description} path={path} jsonLd={jsonLd} />
      <MarketingHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-2">
            <li><Link to="/" className="hover:text-foreground">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">{breadcrumb}</li>
          </ol>
        </nav>
        <p className="text-sm font-semibold uppercase text-primary">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">{h1}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90">
            Create an account <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/pricing" className="inline-flex items-center rounded-md border border-border px-5 py-3 font-semibold hover:bg-muted">
            See plans and trial terms
          </Link>
        </div>

        {sections.map((s) => (
          <section key={s.heading} className="mt-14">
            <h2 className="font-display text-2xl font-bold">{s.heading}</h2>
            {s.paragraphs?.map((p) => <p key={p} className="mt-4 leading-relaxed text-muted-foreground">{p}</p>)}
            {s.bullets && (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
                {s.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}

        <section className="mt-14" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-display text-2xl font-bold">Related preparation guides</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.to}>
                <Link to={r.to} className="block h-full rounded-lg border border-border p-4 hover:bg-muted">
                  <span className="font-semibold text-foreground">{r.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{r.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-display text-2xl font-bold">Frequently asked questions</h2>
          <div className="mt-4 space-y-6">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold text-foreground">{f.q}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-14 border-t border-border pt-6 text-sm text-muted-foreground">
          Zyntra is independent of, and not affiliated with or endorsed by, the Australian Medical Council. Always check the AMC website for official eligibility, exam format, dates and fees. Practice and analytics do not guarantee an exam result.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
