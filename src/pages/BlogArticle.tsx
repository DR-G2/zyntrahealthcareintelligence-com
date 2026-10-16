import React from "react";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { MarketingHeader } from "@/components/public/MarketingHeader";
import { MarketingFooter } from "@/components/public/MarketingFooter";
import "@/styles/zyntra-tokens.css";
import "@/styles/zyntra-phase2.css";
import { articles, articleBody, articleReadTime } from "@/data/blogPosts";
import { formatIsoDate, parseInlineLinks } from "@/lib/blogText";

const SITE_URL = "https://www.zyntrahealthcareintelligence.org";
const AUTHOR_NAME = "Zyntra Healthcare Intelligence";

/** Renders body text, turning [label](url) into links (internal routes via the router). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {parseInlineLinks(text).map((segment, i) => {
        if (segment.type === "text") return <React.Fragment key={i}>{segment.text}</React.Fragment>;
        if (segment.href.startsWith("/")) {
          return <Link key={i} to={segment.href} className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">{segment.text}</Link>;
        }
        return <a key={i} href={segment.href} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">{segment.text}</a>;
      })}
    </>
  );
}

export default function BlogArticle() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug);
  const content = slug ? articleBody[slug] : undefined;

  if (!article) {
    return (
      <div className="zh-phase2 zh-phase2-journal min-h-screen bg-[#040812] text-white flex flex-col"><MarketingHeader /><main className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Article not found</h1>
          <Link to="/blog" className="mt-4 inline-flex text-cyan-300">Back to the Intelligence Lab</Link>
        </div></main><MarketingFooter /></div>
    );
  }

  const sections = content?.sections ?? [
    {
      title: "Why this matters",
      body: article.excerpt + " This article is part of the Zyntra Intelligence Lab, where we explore practical approaches to AMC preparation and learning.",
    },
  ];

  return (
    <>
      <SEO
        title={article.title + " | Zyntra"}
        description={article.excerpt}
        path={"/blog/" + article.slug}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.excerpt,
          author: { "@type": "Organization", name: AUTHOR_NAME, url: SITE_URL },
          publisher: { "@type": "Organization", name: AUTHOR_NAME, url: SITE_URL },
          datePublished: article.published,
          dateModified: article.lastChecked,
          mainEntityOfPage: SITE_URL + "/blog/" + article.slug,
        }}
      />
      <div className="zh-phase2 zh-phase2-journal min-h-screen bg-[#040812] text-slate-100 overflow-x-hidden">
        <MarketingHeader />
        <main className="max-w-4xl mx-auto px-6 py-14 sm:py-20">
          <div className="text-xs font-bold uppercase tracking-[.18em] text-cyan-400">{article.category}</div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight text-white">{article.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>By {AUTHOR_NAME}</span><span>·</span><BookOpen className="w-4 h-4 text-cyan-400" /><span>Public article</span><span>·</span><Clock className="w-3.5 h-3.5" /><span>{articleReadTime(article.slug)}</span></div>
          <p className="mt-2 text-xs text-slate-500">Published <time dateTime={article.published}>{formatIsoDate(article.published)}</time> · Last checked against amc.org.au <time dateTime={article.lastChecked}>{formatIsoDate(article.lastChecked)}</time></p>
          <p className="mt-8 text-lg leading-8 text-slate-300 border-l-2 border-cyan-500/40 pl-5">{content?.intro ?? article.excerpt}</p>
          <article className="mt-12 space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                <p className="mt-3 text-base leading-8 text-slate-400"><RichText text={section.body} /></p>
              </section>
            ))}
          </article>
          <div className="mt-16 rounded-2xl border border-cyan-500/20 bg-[#081224]/80 p-6">
            <p className="text-xs uppercase tracking-[.18em] text-cyan-400">Continue with Zyntra</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">Continue into Zyntra’s authenticated training environment.</p>
            <Link to="/login" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-3 text-sm font-semibold text-white">Get started <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
