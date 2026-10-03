import React from "react";
import { ArrowLeft, ArrowRight, BookOpen, Clock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { articles, articleBody } from "./Blog";

export default function BlogArticle() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug);
  const content = slug ? articleBody[slug] : undefined;

  if (!article) {
    return <div className="min-h-screen bg-[#040812] text-white grid place-items-center p-6"><div className="text-center"><h1 className="text-2xl font-bold">Article not found</h1><Link to="/blog" className="mt-4 inline-flex text-cyan-300">Back to the Intelligence Lab</Link></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#040812] text-slate-100 overflow-x-hidden">
      <header className="border-b border-white/5 backdrop-blur-md bg-[#040812]/80 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold tracking-widest text-white uppercase hover:text-cyan-400">Zyntra</Link>
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300"><ArrowLeft className="w-4 h-4" /> Intelligence Lab</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-14 sm:py-20">
        <div className="text-xs font-bold uppercase tracking-[.18em] text-cyan-400">{article.category}</div>
        <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight text-white">{article.title}</h1>
        <div className="mt-5 flex items-center gap-3 text-xs text-slate-500"><BookOpen className="w-4 h-4 text-cyan-400" /><span>Public article</span><span>·</span><Clock className="w-3.5 h-3.5" /><span>{article.readTime}</span></div>
        <p className="mt-8 text-lg leading-8 text-slate-300 border-l-2 border-cyan-500/40 pl-5">{content?.intro ?? article.excerpt}</p>
        <article className="mt-12 space-y-10">
          {(content?.sections ?? []).map((section) => <section key={section.title}><h2 className="text-2xl font-bold text-white">{section.title}</h2><p className="mt-3 text-base leading-8 text-slate-400">{section.body}</p></section>)}
        </article>
        <div className="mt-16 rounded-2xl border border-cyan-500/20 bg-[#081224]/80 p-6">
          <p className="text-xs uppercase tracking-[.18em] text-cyan-400">Continue with Zyntra</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">Experience the free six-question adaptive diagnostic, then decide whether you want to continue into the authenticated training environment.</p>
          <Link to="/check" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-3 text-sm font-semibold text-white">Start diagnostic <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </main>
    </div>
  );
}
