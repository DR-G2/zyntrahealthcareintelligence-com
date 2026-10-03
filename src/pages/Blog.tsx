import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Brain, Clock, Search, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";

type Article = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
  featured?: boolean;
};

const articles: Article[] = [
  {
    slug: "amc-part-2-osce",
    category: "AMC",
    title: "AMC Part 2 Clinical Examination: What the OSCE Actually Tests",
    excerpt: "A practical guide to the clinical examination, the skills being assessed, and how candidates can structure their preparation.",
    readTime: "8 min read",
    featured: true,
  },
  {
    slug: "amc-part-1-mcq",
    category: "AMC",
    title: "AMC Part 1 MCQ: What Candidates Actually Need to Practise",
    excerpt: "Beyond collecting questions: understanding clinical reasoning, decision-making, timing and consistency in AMC-style MCQs.",
    readTime: "7 min read",
  },
  {
    slug: "amc-exam-is-not-just-a-knowledge-test",
    category: "Clinical Reasoning",
    title: "The AMC Exam Is Not Just a Knowledge Test",
    excerpt: "Why knowing the medicine is only one part of performing well under examination conditions.",
    readTime: "6 min read",
  },
  {
    slug: "why-getting-a-question-wrong-isnt-the-whole-story",
    category: "Performance Intelligence",
    title: "Why Getting a Question Wrong Isn't the Whole Story",
    excerpt: "A wrong answer can reveal timing, uncertainty, reasoning and decision patterns that a score alone cannot show.",
    readTime: "5 min read",
  },
  {
    slug: "clinical-reasoning-vs-memorisation",
    category: "Study Strategy",
    title: "Clinical Reasoning vs Memorisation: What IMGs Need to Practise",
    excerpt: "A closer look at the difference between remembering information and using it to make a clinical decision.",
    readTime: "6 min read",
  },
  {
    slug: "hidden-cost-of-changing-a-correct-answer",
    category: "Performance Intelligence",
    title: "The Hidden Cost of Changing a Correct Answer",
    excerpt: "What answer changes can tell you about decision stability, hesitation and exam behaviour.",
    readTime: "5 min read",
  },
  {
    slug: "confidence-calibration",
    category: "Performance Intelligence",
    title: "How Confidence Calibration Can Change the Way You Study",
    excerpt: "Confidence is useful when it is measured against outcomes. Calibration helps separate certainty from accuracy.",
    readTime: "6 min read",
  },
  {
    slug: "why-zyntra-exists",
    category: "Zyntra",
    title: "From Question Bank to Training Intelligence: Why Zyntra Exists",
    excerpt: "The thinking behind building a training system that observes more than the final answer.",
    readTime: "7 min read",
  },
];

const categories = ["All", "AMC", "Clinical Reasoning", "Study Strategy", "IMG Journey", "Performance Intelligence", "Zyntra"];

const articleBody: Record<string, { intro: string; sections: { title: string; body: string }[] }> = {
  "amc-part-2-osce": {
    intro: "The AMC Part 2 Clinical Examination is a practical assessment of clinical skills, communication and clinical decision-making. Preparation therefore needs to go beyond memorising station scripts.",
    sections: [
      { title: "What the examination is designed to assess", body: "Clinical encounters require a candidate to gather relevant information, communicate clearly, perform an appropriate examination when required, identify the important problems and formulate a safe plan. The exact demands vary by station." },
      { title: "The skills worth practising", body: "History taking, focused examination, explanation, counselling, clinical reasoning, differential diagnosis and management planning all need deliberate practice. Candidates also need to practise moving from information gathering to a clear clinical decision." },
      { title: "Why structure matters", body: "A reliable consultation structure reduces cognitive load. The goal is not to sound scripted. It is to make sure important steps are consistently covered while leaving enough attention for the patient's actual presentation." },
      { title: "Preparation should include feedback", body: "Reading model answers is useful, but it cannot reproduce the pressure of a live encounter. Repeated practice with specific feedback on communication, reasoning, omissions and time management is a different kind of preparation." },
      { title: "Where Zyntra fits", body: "Zyntra's current live training room is MCQ practice. Its authenticated OSCE room is not yet live. This article is educational content, not a representation that live OSCE training is currently available in the product." },
    ],
  },
  "amc-part-1-mcq": {
    intro: "AMC Part 1 is a computer-based multiple-choice examination. Preparing effectively involves more than accumulating a large number of questions.",
    sections: [
      { title: "Knowledge is the foundation", body: "Candidates need broad clinical knowledge across the disciplines represented in the examination. But knowing a fact and selecting the best answer in a clinical vignette are different tasks." },
      { title: "Practise the decision", body: "AMC-style questions require candidates to identify the key information, prioritise possibilities and select the most appropriate action or diagnosis. Deliberate practice should therefore include the reasoning process, not just the answer key." },
      { title: "Timing and consistency matter", body: "A candidate may know the material but lose performance through rushing, hesitation or repeated answer changes. Those patterns are difficult to see if preparation records only right versus wrong." },
      { title: "Use errors as training signals", body: "A mistake should lead to a useful question: was the problem knowledge, interpretation, prioritisation, timing or decision stability? That distinction can make subsequent study more targeted." },
      { title: "Where Zyntra fits", body: "Zyntra combines MCQ practice with telemetry around timing, confidence, answer changes and consistency, then surfaces those signals through Performance Intelligence and Study Plan." },
    ],
  },
};

export default function Blog() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => articles.filter((article) => {
    const categoryMatch = category === "All" || article.category === category;
    const haystack = (article.title + " " + article.excerpt + " " + article.category).toLowerCase();
    return categoryMatch && haystack.includes(query.toLowerCase());
  }), [category, query]);
  const featured = articles.find((a) => a.featured)!;

  return (
    <div className="min-h-screen bg-[#040812] text-slate-100 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[140px]" />
      </div>

      <header className="relative z-20 border-b border-white/5 backdrop-blur-md bg-[#040812]/70 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-500 p-[1.5px] shadow-lg shadow-cyan-500/25">
              <div className="w-full h-full bg-[#070e1e] rounded-[10px] flex items-center justify-center">
                <span className="font-black italic text-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">Z</span>
              </div>
            </div>
            <span className="text-xl font-extrabold tracking-widest text-white uppercase group-hover:text-cyan-400 transition-colors">Zyntra</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs uppercase tracking-[.18em] text-cyan-400">Intelligence Lab</span>
            <Link to="/login" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 transition-colors">Get Started</Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5" /> Zyntra Intelligence Lab
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">Ideas for better AMC preparation.</h1>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-400 max-w-2xl">
              Practical writing on AMC examinations, clinical reasoning, study strategy and the signals behind how candidates learn.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-14">
          <Link to={"/blog/" + featured.slug} className="group block rounded-3xl border border-cyan-500/20 bg-[#081224]/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-cyan-950/40 hover:border-cyan-400/40 transition-all">
            <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-400"><Target className="w-4 h-4" /> Featured · {featured.category}</div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-white group-hover:text-cyan-200 transition-colors">{featured.title}</h2>
                <p className="mt-4 text-sm sm:text-base leading-7 text-slate-400 max-w-2xl">{featured.excerpt}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Read article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-[#050b18] p-5">
                <div className="flex items-center gap-2 text-xs text-slate-500"><Brain className="w-4 h-4 text-cyan-400" /> CLINICAL REASONING</div>
                <div className="mt-6 grid grid-cols-3 gap-2 items-end h-28">
                  {[35, 60, 45, 78, 55, 92, 70, 86].map((h, i) => <div key={i} className="rounded-t bg-gradient-to-t from-cyan-500/20 to-cyan-400/70" style={{height: h + "%"}} />)}
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-[10px] uppercase tracking-wider text-slate-500"><span>Reasoning</span><span>Decision</span><span>Feedback</span></div>
              </div>
            </div>
          </Link>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-10">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={"px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors " + (category === item ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-300" : "border-white/10 text-slate-400 hover:text-white hover:border-white/20")}>{item}</button>)}
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the lab..." className="w-full rounded-xl border border-white/10 bg-[#071021]/80 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/40" />
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 pb-24">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#071021]/60 p-10 text-center text-sm text-slate-500">No articles match that search.</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((article) => <Link key={article.slug} to={"/blog/" + article.slug} className="group rounded-2xl border border-white/10 bg-[#071021]/70 p-5 hover:border-cyan-500/30 hover:bg-[#0a162e] transition-all">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[.16em] text-cyan-400"><span>{article.category}</span><span className="flex items-center gap-1 text-slate-500"><Clock className="w-3 h-3" /> {article.readTime}</span></div>
                <h3 className="mt-4 text-lg font-bold text-white leading-snug group-hover:text-cyan-200 transition-colors">{article.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{article.excerpt}</p>
                <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-cyan-300">Read <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" /></div>
              </Link>)}
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-[#02050b] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-slate-500">
          <span>Zyntra Healthcare Intelligence</span>
          <div className="flex gap-5"><Link to="/terms" className="hover:text-cyan-300">Terms</Link><Link to="/privacy" className="hover:text-cyan-300">Privacy</Link><Link to="/" className="hover:text-cyan-300">Zyntra</Link></div>
        </div>
      </footer>
    </div>
  );
}

export { articles, articleBody };
