import React, { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Brain, Clock, Search, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";

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
    slug: "what-is-zyntra",
    category: "Zyntra",
    title: "What Is Zyntra? AI-Powered Medical Exam Training Built Around Performance Intelligence",
    excerpt: "Zyntra is a medical examination training platform built around Performance Intelligence, starting with AMC preparation and expanding toward USMLE, Royal College, medical school and healthcare examinations.",
    readTime: "7 min read",
    featured: true,
  },
  {
    slug: "amc-part-1-mcq",
    category: "AMC",
    title: "AMC Part 1: What the AMC CAT MCQ Examination Actually Tests",
    excerpt: "A practical guide to AMC Part 1 preparation, clinical reasoning, decision-making, timing and the difference between knowing medicine and performing in the examination.",
    readTime: "8 min read",
  },
  {
    slug: "amc-part-2-osce",
    category: "AMC",
    title: "AMC Part 2 Clinical Examination: What the AMC OSCE Actually Tests",
    excerpt: "Understand what AMC Part 2 preparation really demands: history taking, examination, communication, clinical reasoning, management and safe clinical performance.",
    readTime: "9 min read",
  },
  {
    slug: "performance-intelligence-engine",
    category: "Performance Intelligence",
    title: "What Is a Performance Intelligence Engine? A New Way to Train for Medical Exams",
    excerpt: "Learn how performance intelligence adds context to accuracy by examining training signals such as timing, confidence, answer changes and consistency.",
    readTime: "7 min read",
  },
  {
    slug: "how-to-use-zyntra-properly",
    category: "Zyntra",
    title: "How to Use Zyntra Properly: A Practical AMC Exam Preparation Guide",
    excerpt: "A practical guide to using Zyntra as a training system rather than simply another question bank, from baseline assessment to targeted revision.",
    readTime: "10 min read",
  },
  {
    slug: "why-getting-a-question-wrong-isnt-the-whole-story",
    category: "Performance Intelligence",
    title: "Why Getting an AMC Question Wrong Isn't the Whole Story",
    excerpt: "Two wrong answers can represent completely different training problems. The path to the answer can contain useful information.",
    readTime: "5 min read",
  },
  {
    slug: "hidden-cost-of-changing-a-correct-answer",
    category: "Performance Intelligence",
    title: "The Hidden Cost of Changing a Correct AMC Answer",
    excerpt: "Changing an answer is sometimes good reasoning and sometimes avoidable uncertainty. Learn how to review the transition from first instinct to final answer.",
    readTime: "5 min read",
  },
  {
    slug: "confidence-calibration-and-study",
    category: "Performance Intelligence",
    title: "Confidence Calibration for AMC Preparation: When Certainty and Accuracy Don't Match",
    excerpt: "Confidence becomes useful when it is compared with outcomes. Calibration can help identify high-confidence errors and unstable knowledge.",
    readTime: "6 min read",
  },
];

const categories = ["All", "AMC", "Clinical Reasoning", "Study Strategy", "IMG Journey", "Performance Intelligence", "Zyntra"];

const articleBody: Record<string, { intro: string; sections: { title: string; body: string }[] }> = {
  "what-is-zyntra": {
    intro: "Zyntra is a medical examination training platform built around Performance Intelligence. The starting point is AMC preparation, but the larger ambition is to build a training environment that can support doctors and medical students across multiple examination systems.",
    sections: [
      { title: "Zyntra is a training platform, not another question bank", body: "The basic idea is simple. Learning the subject and learning to crack the examination are related, but they are not the same task. You can know a great deal of medicine and still lose marks through poor timing, avoidable answer changes, weak decision-making or inconsistent performance. Zyntra is designed to train the performance side as well as the medical knowledge side." },
      { title: "Why AMC is the first platform", body: "AMC is where Zyntra is growing first. AMC preparation gives the platform a demanding environment in which broad medical knowledge, clinical reasoning and examination performance all matter. Part 1 and Part 2 also require different forms of preparation, making the AMC ecosystem a useful foundation for building a broader medical-examination training platform." },
      { title: "Where Zyntra is going", body: "The longer-term direction extends beyond AMC. Zyntra is being developed toward USMLE, Royal College examinations, medical school examinations, postgraduate medical examinations and other healthcare-related assessments. The examination changes, but the underlying training problem remains: learn the material, practise applying it, understand your performance and improve deliberately." },
      { title: "The Zyntra principle", body: "An answer is one signal. Your decision process is the dataset. Zyntra uses that distinction to help candidates understand not only what they got right or wrong, but how they are performing while they train." },
    ],
  },
  "amc-part-1-mcq": {
    intro: "AMC Part 1 is not simply a test of how many medical facts you can remember. Preparation requires broad knowledge, clinical reasoning, prioritisation and the ability to make decisions consistently under examination conditions.",
    sections: [
      { title: "First, understand what you are training for", body: "AMC-style clinical questions ask you to interpret information and select the most appropriate answer. That means knowledge is the foundation, but the examination also rewards the ability to recognise the problem, identify the important clue and decide what matters most." },
      { title: "Stop measuring preparation only in questions completed", body: "A candidate can complete thousands of questions and still have the same recurring weaknesses. The useful questions are different: Which subjects are weak? Which errors repeat? Are you rushing? Are you changing answers unnecessarily? Are you spending too long between two plausible options? Those answers tell you what to train next." },
      { title: "Learn the medicine, then train the decision", body: "Review explanations properly. Ask why the correct answer fits and why the alternatives do not. When you miss a question, decide whether the problem was knowledge, interpretation, prioritisation, timing or decision stability. Different problems need different corrections." },
      { title: "Build examination discipline", body: "Timed practice should eventually become normal. You are not trying to become excellent at answering questions in comfortable conditions. You are trying to become reliable when the clock is running and the options are deliberately close." },
      { title: "The practical rule", body: "Do not ask only, 'How many questions have I done?' Ask, 'What is my performance telling me, and what should I train next?' That is a much more useful AMC preparation question." },
    ],
  },
  "amc-part-2-osce": {
    intro: "AMC Part 2 is a clinical performance examination. Preparing for it means learning to demonstrate safe, structured clinical practice rather than simply memorising station scripts.",
    sections: [
      { title: "AMC Part 2 is a performance environment", body: "You are no longer selecting an answer on a screen. You have to listen, communicate, examine when required, reason through the findings and formulate an appropriate plan. The examiner needs to see the clinical process, not merely hear a rehearsed conclusion." },
      { title: "The skills you need to train", body: "History taking, communication, focused examination, clinical reasoning, differential diagnosis, investigation and management planning all matter. So do explanation, shared decision-making, safety-netting and professional interaction." },
      { title: "Use frameworks without becoming robotic", body: "Good preparation gives you reliable structures. It should not turn every patient into a memorised script. Learn how to approach a station, then deliberately vary the presentation so that the underlying reasoning becomes transferable." },
      { title: "Feedback changes the quality of practice", body: "Reading a model station is useful. Performing the station under time pressure and receiving specific feedback is different. Review omissions, communication, reasoning, structure and time management rather than simply asking whether the station felt good." },
      { title: "Where Zyntra fits today", body: "Zyntra's authenticated OSCE room is currently marked 'Not live yet'. This article is educational content and does not represent a live Zyntra OSCE engine. Candidates should use current official AMC information for examination rules, eligibility, format and scheduling." },
    ],
  },
  "performance-intelligence-engine": {
    intro: "A Performance Intelligence Engine is designed to make training information more useful than a simple right-or-wrong score. Zyntra uses performance signals to help candidates understand how they are performing while they practise.",
    sections: [
      { title: "Why accuracy alone is incomplete", body: "Imagine two candidates both score 70%. One is consistently performing around that level. The other gets questions right but repeatedly rushes, changes correct answers and struggles with a particular subject. The percentage is identical. The training problem is not." },
      { title: "What performance intelligence observes", body: "Depending on the training activity and available data, useful signals can include accuracy, response time, confidence, answer changes, consistency, recurring mistakes and subject-level performance. These signals add context to the outcome of the question." },
      { title: "It is not a personality test", body: "Performance signals should be treated as training information, not psychological diagnoses. A pattern can tell you what deserves review without telling you what kind of person you are." },
      { title: "The useful question", body: "The purpose of performance intelligence is not to create a mysterious score and leave you staring at a dashboard. The useful question is practical: what does the evidence from my training suggest I should work on next?" },
      { title: "A deliberate boundary", body: "Zyntra does not publish every implementation detail of its underlying intelligence systems. Candidates do not need a technical blueprint to use the resulting information effectively. They need clear signals, sensible interpretation and useful training actions." },
    ],
  },
  "how-to-use-zyntra-properly": {
    intro: "Zyntra works best when you treat it as a training system rather than a scoreboard. The quality of the information you give the platform directly affects the usefulness of the performance picture you get back.",
    sections: [
      { title: "1. Establish a genuine baseline", body: "Answer honestly. Do not deliberately manipulate your timing or confidence to make the dashboard look better. Your early performance is useful precisely because it shows where you are starting." },
      { title: "2. Review the explanation, not just the letter", body: "After an incorrect answer, ask why the correct option is correct and why the alternatives are less appropriate. Then decide what actually caused the miss. Knowledge gaps, stem interpretation errors and poor prioritisation require different responses." },
      { title: "3. Stop worshipping the percentage", body: "A score is important, but one percentage cannot describe an entire preparation. Look for trends, recurring weaknesses, timing problems and changes in decision behaviour across your training." },
      { title: "4. Attack weaknesses", body: "Do not spend every session in subjects you enjoy simply because the scores feel good. Use performance information to identify where additional training is required. Avoiding a weak area does not make it disappear." },
      { title: "5. Use mistakes and answer changes intelligently", body: "A wrong answer is not automatically the same type of mistake every time. If you changed a correct answer, ask what evidence changed your mind. If nothing meaningful changed, that transition deserves review." },
      { title: "6. Use repetition properly", body: "Repeatedly missing the same concept is more important than a single isolated error. Return to the underlying knowledge, practise a variation of the problem and check whether the mistake persists." },
      { title: "7. Use Zyntra alongside proper medical study", body: "Zyntra is an educational training platform, not a replacement for textbooks, guidelines, lectures or other appropriate medical learning resources. If the problem is missing knowledge, learn the knowledge. Then return and test whether it transfers into performance." },
      { title: "The Zyntra rule", body: "Do not use Zyntra merely to find out how many questions you got right. Use it to understand how you are performing while you answer them. That is where the training value lives." },
    ],
  },
  "why-getting-a-question-wrong-isnt-the-whole-story": {
    intro: "Two incorrect answers can represent completely different training problems. The result matters, but the path to the result can contain additional information.",
    sections: [
      { title: "Wrong is not one category", body: "A fast guess, a careful but incorrect decision and a correct answer changed into an incorrect one are different events. Treating them as identical can hide useful training signals." },
      { title: "Review what happened", body: "Look at timing, confidence, answer changes and the clinical reasoning behind the decision. These signals do not diagnose personality. They help you decide what deserves another look." },
    ],
  },
  "hidden-cost-of-changing-a-correct-answer": {
    intro: "Changing an answer is not automatically a mistake. Sometimes it is exactly what good reasoning requires. The useful question is what happened between the first and final decision.",
    sections: [
      { title: "Changing is not automatically bad", body: "A changed answer can reflect a genuine correction after noticing a missed clue. It can also reflect uncertainty without new evidence. The distinction is more useful than simply counting changes." },
      { title: "Review the transition", body: "When a first answer becomes a final answer, review what changed your mind. If the evidence changed, the revision may represent good reasoning. If nothing meaningful changed, the event may deserve closer review." },
    ],
  },
  "confidence-calibration-and-study": {
    intro: "Confidence calibration asks whether certainty tends to match outcomes. It is useful because confidence and accuracy are not automatically the same thing.",
    sections: [
      { title: "Confidence versus calibration", body: "A candidate can be highly confident and well calibrated, or highly confident and frequently wrong. Those are different training situations." },
      { title: "Turn the signal into action", body: "High-confidence errors can deserve deliberate review. Low-confidence correct answers can reveal knowledge that is present but not yet stable. The point is not to maximise confidence. It is to make confidence more informative." },
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
    <>
      <SEO
        title="AMC Exam Preparation, Clinical Reasoning & Medical Exam Strategy | Zyntra"
        description="Practical AMC exam preparation guidance on Part 1 MCQs, Part 2 clinical examination, clinical reasoning, study strategy and Zyntra Performance Intelligence."
        path="/blog"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Zyntra Intelligence Lab",
          description: "AMC exam preparation, clinical reasoning and medical examination training insights.",
          url: "https://www.zyntrahealthcareintelligence.com/blog",
        }}
      />
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
    </>
  );
}

export { articles, articleBody };
