import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, BarChart3, Brain, Check, ChevronRight, Clock, Clock3, LockKeyhole,
  Mail, RotateCcw, Rss, Send, Sparkles, Stethoscope, Target, Timer, TrendingUp, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LEGAL_EMAIL } from "@/lib/legal";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PublicFooter } from "@/components/PublicFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useShowAboutPricing } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Question = {
  id: string;
  stem: string;
  options: string[];
  answer: number;
  domain: string;
  difficulty: "Core" | "Applied" | "Stretch";
};

type Attempt = {
  questionId: string;
  selected: number;
  correct: boolean;
  timeMs: number;
  changes: number;
  confidence: number;
};

const QUESTION_BANK: Question[] = [
  {
    id: "q1", domain: "Emergency medicine", difficulty: "Core",
    stem: "A 68-year-old man presents with sudden-onset central chest pain and diaphoresis. ECG shows ST elevation in leads II, III and aVF. BP is 92/58 mmHg and he has clear lungs. Which additional finding would most strongly support right ventricular infarction?",
    options: ["Raised JVP with clear lungs", "Bibasal crackles", "Wide pulse pressure", "Bradycardia with hypertension"],
    answer: 0
  },
  {
    id: "q2", domain: "Paediatrics", difficulty: "Applied",
    stem: "A 3-year-old child has a barking cough, hoarse voice and inspiratory stridor at rest. There is no drooling and oxygen saturation is 97% on room air. What is the most appropriate immediate treatment?",
    options: ["Oral amoxicillin", "Nebulised salbutamol", "Dexamethasone", "Urgent throat examination"],
    answer: 2
  },
  {
    id: "q3", domain: "General medicine", difficulty: "Applied",
    stem: "A 54-year-old woman with type 2 diabetes presents with fever, dysuria and right flank pain. She is haemodynamically stable. Urinalysis shows nitrites and leukocytes. What is the most appropriate next step?",
    options: ["Reassurance and repeat urine testing in one week", "Send urine culture and start appropriate antibiotics", "Start an SGLT2 inhibitor", "Arrange immediate cystoscopy"],
    answer: 1
  },
  {
    id: "q4", domain: "Obstetrics", difficulty: "Stretch",
    stem: "A woman at 34 weeks' gestation presents with painless vaginal bleeding. Her observations are stable and the uterus is soft and non-tender. Which diagnosis is most likely?",
    options: ["Placental abruption", "Placenta praevia", "Uterine rupture", "Chorioamnionitis"],
    answer: 1
  },
  {
    id: "q5", domain: "Psychiatry", difficulty: "Core",
    stem: "A 29-year-old patient reports two weeks of low mood, anhedonia, poor sleep and reduced appetite. There is no psychosis, mania or immediate suicide risk. Which feature would most clearly establish a major depressive episode?",
    options: ["Symptoms cause clinically significant impairment", "Symptoms occur only in the evening", "The patient prefers to be alone", "The patient has a family history of depression"],
    answer: 0
  },
  {
    id: "q6", domain: "Surgery", difficulty: "Applied",
    stem: "A 42-year-old patient has severe right upper-quadrant pain, fever and a positive Murphy sign. Ultrasound shows gallstones and gallbladder wall thickening. What is the most likely diagnosis?",
    options: ["Acute pancreatitis", "Acute cholecystitis", "Peptic ulcer disease", "Renal colic"],
    answer: 1
  },
  {
    id: "q7", domain: "General medicine", difficulty: "Stretch",
    stem: "A patient with atrial fibrillation develops sudden unilateral weakness and aphasia. Symptoms began 45 minutes ago. What is the first imaging study generally required before intravenous thrombolysis is considered?",
    options: ["Non-contrast CT brain", "MRI spine", "CT abdomen", "Carotid ultrasound"],
    answer: 0
  },
  {
    id: "q8", domain: "Emergency medicine", difficulty: "Stretch",
    stem: "A patient with asthma is speaking in single words, has a respiratory rate of 34/min and a silent chest. What does this presentation indicate?",
    options: ["Mild asthma", "Moderate asthma", "Life-threatening asthma", "Resolved bronchospasm"],
    answer: 2
  },
  {
    id: "q9", domain: "Infectious diseases", difficulty: "Core",
    stem: "A patient with suspected bacterial meningitis is confused and febrile. Which principle should guide initial management?",
    options: ["Wait for lumbar puncture before antibiotics in all cases", "Start appropriate empiric antibiotics promptly while arranging investigations", "Treat with oral antibiotics only", "Observe for 24 hours before treatment"],
    answer: 1
  },
  {
    id: "q10", domain: "Cardiology", difficulty: "Applied",
    stem: "A patient with heart failure has worsening dyspnoea, bilateral crackles and peripheral oedema. Which treatment most directly relieves acute pulmonary congestion?",
    options: ["IV loop diuretic", "Oral iron", "Long-term statin therapy", "Thyroxine"],
    answer: 0
  }
];

const CONFIDENCE = [
  { value: 1, label: "Guessing" },
  { value: 2, label: "Not sure" },
  { value: 3, label: "Reasonably sure" },
  { value: 4, label: "Very sure" }
];

function pickNext(history: Attempt[], used: string[]) {
  if (history.length === 0) return QUESTION_BANK[0];
  const last = history[history.length - 1];
  const candidates = QUESTION_BANK.filter(q => !used.includes(q.id));
  if (!candidates.length) return QUESTION_BANK[0];

  if (!last.correct) {
    const sameDomain = candidates.filter(q => q.domain === QUESTION_BANK.find(x => x.id === last.questionId)?.domain);
    if (sameDomain.length) return sameDomain[0];
    const stretch = candidates.filter(q => q.difficulty === "Core" || q.difficulty === "Applied");
    return stretch[0] ?? candidates[0];
  }

  const confidence = last.confidence;
  if (confidence <= 2) {
    const applied = candidates.filter(q => q.difficulty === "Applied");
    return applied[0] ?? candidates[0];
  }

  const stretch = candidates.filter(q => q.difficulty === "Stretch");
  return stretch[0] ?? candidates[0];
}

function scoreSnapshot(attempts: Attempt[]) {
  const accuracy = Math.round((attempts.filter(a => a.correct).length / Math.max(attempts.length, 1)) * 100);
  const avgTime = attempts.reduce((sum, a) => sum + a.timeMs, 0) / Math.max(attempts.length, 1) / 1000;
  const changes = attempts.reduce((sum, a) => sum + a.changes, 0);
  const confidence = Math.round(attempts.reduce((sum, a) => sum + a.confidence, 0) / Math.max(attempts.length, 1) * 25);
  const stability = Math.max(0, Math.round(100 - changes * 18));
  const timing = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avgTime - 42) * 1.8)));
  const readiness = Math.round(accuracy * 0.45 + stability * 0.2 + confidence * 0.15 + timing * 0.2);
  return { accuracy, avgTime, changes, confidence, stability, timing, readiness };
}

const FEATURES = [
  {
    icon: Brain,
    title: "Behavioral Analysis",
    description: "Track answer changes, hesitation patterns and time management: the habits that quietly cost marks under exam conditions.",
  },
  {
    icon: Clock,
    title: "Pressure Training",
    description: "Timed drills and commitment exercises that simulate real exam conditions.",
  },
  {
    icon: Rss,
    title: "Feed",
    description: "Paste any clinical content and instantly generate exam-style MCQ questions or OSCE stations.",
  },
  {
    icon: Target,
    title: "Adaptive Engine",
    description: "AI identifies your weak patterns and builds a personalised training plan around them.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description: "Performance profiles with stability scores, readiness metrics and progress tracking.",
  },
];

const STEPS = [
  { step: "1", icon: Target, title: "Diagnose", desc: "Take a diagnostic assessment. We track timing, answer changes and confidence, not just right or wrong." },
  { step: "2", icon: Stethoscope, title: "Practice", desc: "MCQ drills with timed pressure modes. OSCE stations with voice practice are being rebuilt and switched on in stages." },
  { step: "3", icon: BarChart3, title: "Analyze", desc: "See your Readiness DNA score and behaviour profile." },
  { step: "4", icon: Brain, title: "Reinforce", desc: "Spaced-repetition flashcards and targeted drills fill your knowledge gaps." },
  { step: "5", icon: TrendingUp, title: "Master", desc: "Timed exam simulations and adaptive training as you build towards exam day." },
];

const FAQS = [
  {
    q: "What is Zyntra?",
    a: "Zyntra is an AI-assisted exam preparation platform for candidates preparing for the Australian Medical Council (AMC) examinations. It goes beyond a traditional question bank by looking at how you answer (answer changes, hesitation, timing and confidence) and using those signals to decide what you should practise next. Zyntra is independent and is not affiliated with or endorsed by the AMC.",
  },
  {
    q: "How is Zyntra different from other AMC prep platforms?",
    a: "Zyntra is built around the APPE (Adaptive Performance & Preparation Engine), which tracks behavioural signals such as answer stability, composure under time pressure and confidence calibration alongside accuracy. It also includes AI explanations, a study plan generator and spaced-repetition flashcards.",
  },
  {
    q: "Is Zyntra content the same as real AMC exam questions?",
    a: "No. All Zyntra content is original, independently developed by our team and AI systems. Our scenarios are not recalled, copied or derived from actual AMC examination content. Zyntra is not affiliated with the Australian Medical Council.",
  },
  {
    q: "What does Zyntra cost?",
    a: "Free: $0, including the diagnostic MCQ test, basic performance results and a limited AI study companion. MCQ Only: $39/month or $109 for 3 months. Pass Guarantee: $59/month or $169 for 3 months (Pass Guarantee terms coming soon). Lifetime: $349 one-time, limited to the first 100 users. All prices are in USD. The 6-question check on this page is free and needs no account.",
  },
  {
    q: "Is OSCE and voice practice available?",
    a: "Our OSCE module, including voice practice, is being rebuilt and is switched on in stages. If it isn't available on your account yet, you'll see a 'coming soon' notice. When it's on, voice practice uses your browser's built-in speech features and works best in Chrome and Edge.",
  },
  {
    q: "Can I get a copy of my data or delete it?",
    a: `Yes. Email ${LEGAL_EMAIL} to request a copy of the personal information we hold about you, or to have your account and data deleted. See our Privacy Policy for details.`,
  },
];

export default function Landing() {
  const { user } = useAuth();
  const { show: showAboutPricing } = useShowAboutPricing();
  const [started, setStarted] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [question, setQuestion] = useState<Question>(QUESTION_BANK[0]);
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [changes, setChanges] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [completed, setCompleted] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const progress = attempts.length + (started && !completed ? 1 : 0);
  const snapshot = useMemo(() => scoreSnapshot(attempts), [attempts]);

  const startDiagnostic = () => {
    setStarted(true);
    setCompleted(false);
    setAttempts([]);
    setQuestion(QUESTION_BANK[0]);
    setSelected(null);
    setConfidence(null);
    setChanges(0);
    setStartedAt(Date.now());
    document.getElementById("diagnostic")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chooseAnswer = (index: number) => {
    if (selected !== null && selected !== index) setChanges(v => v + 1);
    setSelected(index);
  };

  const nextQuestion = () => {
    if (selected === null || confidence === null) return;
    const attempt: Attempt = {
      questionId: question.id,
      selected,
      correct: selected === question.answer,
      timeMs: Date.now() - startedAt,
      changes,
      confidence
    };
    const nextAttempts = [...attempts, attempt];
    setAttempts(nextAttempts);

    if (nextAttempts.length === 6) {
      setCompleted(true);
      setSelected(null);
      setConfidence(null);
      return;
    }

    const next = pickNext(nextAttempts, nextAttempts.map(a => a.questionId));
    setQuestion(next);
    setSelected(null);
    setConfidence(null);
    setChanges(0);
    setStartedAt(Date.now());
    window.scrollTo({ top: document.getElementById("diagnostic")?.offsetTop ?? 0, behavior: "smooth" });
  };

  const [contactForm, setContactForm] = useState({ name: "", email: "", category: "general", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const scrollToDiagnostic = (e?: React.MouseEvent) => {
    e?.preventDefault();
    document.getElementById("diagnostic")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (contactForm.name.length > 100 || contactForm.email.length > 255 || contactForm.message.length > 2000) {
      toast.error("Input exceeds maximum length");
      return;
    }
    setContactSubmitting(true);
    try {
      const { error } = await supabase.from("contact_submissions").insert({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        category: contactForm.category,
        message: contactForm.message.trim(),
      });
      if (error) throw error;
      await supabase.functions.invoke("send-contact-notification", {
        body: {
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
          category: contactForm.category,
          message: contactForm.message.trim(),
        },
      }).catch(() => {});
      toast.success("Message sent! We'll get back to you soon.");
      setContactForm({ name: "", email: "", category: "general", message: "" });
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setContactSubmitting(false);
    }
  };

  const submitEarlyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSubmitting(true);
    const report = {
      accuracy: snapshot.accuracy,
      avgTimeSeconds: Math.round(snapshot.avgTime),
      answerChanges: snapshot.changes,
      confidenceCalibration: snapshot.confidence,
      stability: snapshot.stability,
      timing: snapshot.timing,
      limitedReadiness: snapshot.readiness,
      attempts: attempts.map(a => ({
        questionId: a.questionId,
        correct: a.correct,
        timeMs: a.timeMs,
        changes: a.changes,
        confidence: a.confidence
      }))
    };
    try {
      const { error } = await supabase.from("contact_submissions").insert({
        name: name.trim() || "Early Access Candidate",
        email: email.trim().toLowerCase(),
        category: "early_access",
        message: JSON.stringify({
          source: "zyntra_mcq_diagnostic_v1",
          requested: "Early Access & Notifications",
          diagnostic: report
        })
      });
      if (error) throw error;
      await supabase.functions.invoke("send-contact-notification", {
        body: {
          name: name.trim() || "Early Access Candidate",
          email: email.trim().toLowerCase(),
          category: "early_access",
          message: "Zyntra MCQ early access registration with 6-question diagnostic."
        }
      }).catch(() => {});
      setRegistered(true);
      toast.success("You're on the early-access list.");
    } catch {
      toast.error("We couldn't save that yet. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f6fbfc] text-slate-950">
      <SEO
        title="Zyntra | AMC exam preparation that learns how you think"
        description="AMC exam prep that tracks how you answer: timing, answer changes and confidence. Try the free 6-question MCQ diagnostic, no login needed. Not affiliated with the AMC."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Zyntra Healthcare Intelligence",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: "https://www.zyntrahealthcareintelligence.com/",
            description: "AMC exam preparation with adaptive MCQ practice, a free 6-question diagnostic and behavioural analytics.",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />

      {/* 1. Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#f6fbfc]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f5f68] text-white shadow-sm">
              <Zap className="h-4 w-4 fill-current" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Zyntra<span className="text-[#16858c]">.</span></span>
          </button>
          <nav aria-label="Main" className="flex items-center gap-1 text-xs font-semibold text-slate-500 sm:gap-2">
            <span className="hidden rounded-full border border-[#bfe5e7] bg-white px-3 py-1.5 lg:inline-flex">MCQ Intelligence</span>
            {showAboutPricing && (
              <>
                <Link to="/about" className="hidden rounded-full px-3 py-2 transition hover:text-[#0f5f68] md:inline-flex">About</Link>
                <Link to="/pricing" className="rounded-full px-2 py-2 transition hover:text-[#0f5f68] sm:px-3">Pricing</Link>
              </>
            )}
            {user ? (
              <Link to="/dashboard" className="rounded-full px-2 py-2 transition hover:text-[#0f5f68] sm:px-3">Dashboard</Link>
            ) : (
              <Link to="/login" className="rounded-full px-2 py-2 transition hover:text-[#0f5f68] sm:px-3">Log in</Link>
            )}
            <button onClick={startDiagnostic} className="rounded-full bg-[#0f5f68] px-4 py-2 text-white transition hover:bg-[#0a4b52]">
              Try 6 questions
            </button>
          </nav>
        </div>
      </header>

      {/* 2. Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-[#8edfe1]/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-[#78a9df]/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c6e6e8] bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-[#0f5f68]">
              <Zap className="h-3.5 w-3.5" /> AI-Powered AMC Exam Preparation
            </div>
            <h1 id="hero-title" className="max-w-3xl font-display text-[2.65rem] font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl lg:text-[4.35rem]">
              Don't just study. <span className="text-[#0f6d76]">Train to pass.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Zyntra goes beyond question banks. Our APPE engine looks for the patterns that cost candidates marks (time pressure, answer hesitation, composure under pressure) and trains you to work on them.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="h-12 rounded-xl bg-[#0f5f68] px-6 text-base shadow-lg shadow-[#0f5f68]/15 hover:bg-[#0a4b52]">
                <Link to="/dashboard">Get Started <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-[#bfe5e7] bg-white px-6 text-base text-[#0f5f68] hover:bg-[#eaf8f8] hover:text-[#0a4b52]">
                <Link to="/stations?demo=true">Try a demo station <Stethoscope className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-[#bfe5e7] bg-white px-6 text-base text-[#0f5f68] hover:bg-[#eaf8f8] hover:text-[#0a4b52]">
                <a href="#diagnostic" onClick={scrollToDiagnostic}>Take the 6-question check <ChevronRight className="ml-1 h-4 w-4" /></a>
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
              <Check className="h-4 w-4 shrink-0 text-[#16858c]" /> The 6-question check needs no login, no card and takes about 3 minutes.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .6, delay: .08 }} className="relative">
            <div className="rounded-[1.75rem] border border-[#cfe6e8] bg-white p-4 shadow-2xl shadow-[#0f5f68]/10 sm:p-6">
              <div className="rounded-[1.25rem] bg-[#0f5f68] p-5 text-white sm:p-6">
                <div className="flex items-center justify-between text-xs text-white/65">
                  <span>ADAPTIVE CONTRAST</span><span>Signal preview</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    ["Confidence", "Observed", "soft"],
                    ["Timing", "Measured", "bright"],
                    ["Changes", "Tracked", "soft"],
                    ["Next question", "Adapted", "bright"]
                  ].map(([a,b,c]) => (
                    <div key={a} className={`rounded-2xl border p-4 ${c === "bright" ? "border-white/25 bg-white/10" : "border-white/10 bg-white/5"}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/55">{a}</div>
                      <div className="mt-1 font-display text-sm font-semibold">{b}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-[#79d8da]/25 bg-[#79d8da]/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#b9f1f2]"><Sparkles className="h-3.5 w-3.5" /> Zyntra is learning your pattern</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-[#8de0e2]" /></div>
                </div>
              </div>
              <p className="px-1 pb-1 pt-4 text-center text-xs text-slate-500">The answer is only one signal. Your decision process is the dataset.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. MCQ diagnostic */}
      <section id="diagnostic" className="scroll-mt-20 border-y border-slate-200/80 bg-white px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          {!started ? (
            <div className="rounded-[1.75rem] border border-slate-200 bg-[#f8fcfc] p-6 text-center shadow-sm sm:p-10">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#dff4f4] text-[#0f5f68]"><Brain /></div>
              <div className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">Free diagnostic</div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Six questions. A surprisingly useful mirror.</h2>
              <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">You won't just pick an answer. Zyntra observes how quickly you commit, whether you change your mind, and how certain you feel.</p>
              <Button onClick={startDiagnostic} size="lg" className="mt-7 h-12 rounded-xl bg-[#0f5f68] px-7 hover:bg-[#0a4b52]">Start without logging in <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <p className="mt-3 text-xs text-slate-400">No account. No payment. Six AMC-style questions.</p>
            </div>
          ) : completed ? (
            <AnimatePresence mode="wait">
              <motion.div key="result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.75rem] border border-[#cfe6e8] bg-[#f8fcfc] p-6 shadow-sm sm:p-10">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#16858c]"><Sparkles className="h-4 w-4" /> Diagnostic complete</div>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your first signal is in.</h2>
                <p className="mt-3 max-w-2xl text-slate-600">Six questions are enough to expose a few patterns. They are not enough to pretend we know everything about your exam readiness.</p>

                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Accuracy", `${snapshot.accuracy}%`],
                    ["Stability", `${snapshot.stability}%`],
                    ["Confidence", `${snapshot.confidence}%`],
                    ["Timing", `${snapshot.timing}%`]
                  ].map(([label,value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
                      <div className="mt-1 font-display text-2xl font-bold text-[#0f5f68]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-[#bfe5e7] bg-[#eaf8f8] p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0f5f68]"><Target className="h-4 w-4" /> Limited readiness glimpse</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Your six-question snapshot suggests a <strong>{snapshot.readiness >= 70 ? "decisive" : snapshot.readiness >= 50 ? "developing" : "variable"}</strong> response pattern. The interesting part is not the number. It is what happens between knowing, doubting and committing.
                  </p>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-bold"><LockKeyhole className="h-4 w-4 text-[#0f5f68]" /> Full Learner DNA is locked</div>
                  <div className="mt-4 grid grid-cols-2 gap-3 blur-[2px] select-none" aria-hidden="true">
                    {["Rule-out behaviour","Hesitation index","Fatigue signature","Confidence calibration"].map((x,i) => (
                      <div key={x} className="rounded-xl bg-slate-100 p-4"><div className="text-xs font-semibold">{x}</div><div className="mt-2 h-2 rounded bg-slate-300" style={{width: `${55 + i*8}%`}} /></div>
                    ))}
                  </div>
                  <div className="absolute inset-0 grid place-items-center bg-white/65 backdrop-blur-[1px]">
                    <div className="rounded-full border border-[#bfe5e7] bg-white px-4 py-2 text-xs font-bold text-[#0f5f68] shadow-sm"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" /> Unlock with Early Access</div>
                  </div>
                </div>

                {!registered ? (
                  <form onSubmit={submitEarlyAccess} className="mt-6 rounded-2xl bg-[#0f5f68] p-5 text-white sm:p-6">
                    <div className="text-lg font-bold">Want the rest of the picture?</div>
                    <p className="mt-1 text-sm leading-6 text-white/70">Register for early access and notifications. Free to register. No payment. Just your place in the queue.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <Input value={email} onChange={e => setEmail(e.target.value)} type="email" required maxLength={255} placeholder="Email address" className="h-11 border-white/15 bg-white/10 text-white placeholder:text-white/45" />
                      <Input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Name (optional)" className="h-11 border-white/15 bg-white/10 text-white placeholder:text-white/45" />
                      <Button disabled={submitting} type="submit" className="h-11 bg-white text-[#0f5f68] hover:bg-[#e9ffff]">{submitting ? "Saving…" : "Register"}</Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-6 rounded-2xl border border-[#bfe5e7] bg-white p-5 text-center">
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#dff4f4] text-[#0f5f68]"><Check className="h-5 w-5" /></div>
                    <h3 className="mt-3 font-display text-lg font-bold">You're registered.</h3>
                    <p className="mt-1 text-sm text-slate-500">We'll use this email for Zyntra MCQ early-access and product notifications.</p>
                  </div>
                )}
                <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                  <p className="text-xs text-slate-500">Want a fresh read? The questions adapt to how you answer.</p>
                  <Button onClick={startDiagnostic} variant="outline" className="h-11 w-full rounded-xl border-[#bfe5e7] text-[#0f5f68] hover:bg-[#eaf8f8] sm:w-auto">
                    Run it again <RotateCcw className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div key="question" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#16858c]">Adaptive diagnostic</div>
                  <div className="mt-1 font-display text-lg font-bold">Question {attempts.length + 1} of 6</div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Clock3 className="h-4 w-4" /> Live timing</div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><motion.div className="h-full rounded-full bg-[#16858c]" animate={{width: `${((attempts.length + 1) / 6) * 100}%`}} /></div>

              <div className="mt-7">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#e7f7f7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0f5f68]">{question.domain}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{question.difficulty}</span>
                </div>
                <h2 className="font-display text-xl font-bold leading-8 tracking-tight sm:text-2xl">{question.stem}</h2>
                <div className="mt-6 space-y-3">
                  {question.options.map((option, index) => (
                    <button key={option} onClick={() => chooseAnswer(index)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm font-medium transition-all ${selected === index ? "border-[#16858c] bg-[#eaf8f8] text-[#0b4f57] ring-2 ring-[#16858c]/10" : "border-slate-200 bg-white hover:border-[#9ccfd1] hover:bg-[#f8fcfc]"}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${selected === index ? "bg-[#0f5f68] text-white" : "bg-slate-100 text-slate-500"}`}>{String.fromCharCode(65 + index)}</span>
                      <span className="pt-1 leading-6">{option}</span>
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {selected !== null && (
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} className="overflow-hidden">
                      <div className="mt-6 rounded-2xl border border-slate-200 bg-[#f8fafb] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">How certain are you?</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {CONFIDENCE.map(c => (
                            <button key={c.value} onClick={() => setConfidence(c.value)} className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${confidence === c.value ? "border-[#16858c] bg-white text-[#0f5f68]" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>{c.label}</button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button onClick={nextQuestion} disabled={selected === null || confidence === null} className="mt-5 h-12 w-full rounded-xl bg-[#0f5f68] text-base hover:bg-[#0a4b52] sm:w-auto sm:px-7">
                  {attempts.length === 5 ? "See my limited evaluation" : "Lock answer & continue"} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <p className="mt-3 text-center text-[11px] text-slate-400 sm:text-left">Your confidence is part of the signal. There is no penalty for being uncertain.</p>
              </div>
            </motion.div>
          )}

          {!completed && (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                [Brain, "Knowledge", "Was your clinical reasoning sound?"],
                [Timer, "Behaviour", "How did you manage the clock?"],
                [Target, "Adaptation", "What should you see next?"]
              ].map(([Icon,title,desc]) => (
                <div key={String(title)} className="rounded-2xl border border-slate-200 bg-[#f8fcfc] p-5">
                  <Icon className="h-5 w-5 text-[#16858c]" />
                  <div className="mt-3 font-display font-bold">{String(title)}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{String(desc)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-[1.75rem] bg-[#0b3f46] px-5 py-10 text-center text-white sm:px-10">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Sparkles className="h-5 w-5 text-[#9be7e9]" /></div>
            <h3 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">Six questions can show a pattern.</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/65 sm:text-base">The full Zyntra Learner DNA is built from much more: accuracy, timing, stability, confidence calibration, rule-out behaviour and how those signals move together.</p>
            <Button onClick={startDiagnostic} className="mt-7 h-12 rounded-xl bg-white px-6 text-[#0b3f46] hover:bg-[#efffff]">
              {completed ? "Run it again" : "Try the free diagnostic"} <RotateCcw className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>


      {/* 4-7. APPE, How It Works, FAQ, Get in Touch; 8. footer */}
      <section id="appe" aria-labelledby="appe-title" className="scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
            <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">How Zyntra trains you</div>
            <h2 id="appe-title" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">The APPE Advantage</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">Adaptive Performance &amp; Preparation Engine</p>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#9ccfd1] hover:shadow-lg hover:shadow-[#0f5f68]/5"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#dff4f4] text-[#0f5f68] transition-colors group-hover:bg-[#0f5f68] group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-y border-slate-200/80 bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
            <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">Step by step</div>
            <h2 id="how-title" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">From first login to exam day in 5 steps</p>
          </motion.div>
          <ol className="grid gap-4 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative flex gap-4 rounded-2xl border border-slate-200 bg-[#f8fcfc] p-5 md:flex-col md:items-center md:text-center"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#dff4f4] text-[#0f5f68]">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#16858c]">Step {s.step}</span>
                  <h3 className="mt-0.5 font-display font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-slate-300 md:block" />
                )}
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
            <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">FAQ</div>
            <h2 id="faq-title" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">Everything you need to know about Zyntra</p>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} value={`faq-${i}`} className="rounded-2xl border border-slate-200 bg-white px-5">
                <AccordionTrigger className="text-left font-display text-sm font-bold hover:no-underline sm:text-base">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-6 text-slate-600">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="mt-6 text-center text-sm text-slate-500">
            Full plan details are on the {showAboutPricing ? <Link to="/pricing" className="font-semibold text-[#0f5f68] underline-offset-4 hover:underline">Pricing page</Link> : "Pricing page"}. Read how we handle your data in our <Link to="/privacy" className="font-semibold text-[#0f5f68] underline-offset-4 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </section>

      <section id="contact" aria-labelledby="contact-title" className="scroll-mt-20 border-t border-slate-200/80 bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-xl">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
            <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">Contact</div>
            <h2 id="contact-title" className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Get in Touch</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">Have a question? We'd love to hear from you.</p>
          </motion.div>
          <form onSubmit={handleContactSubmit} className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-[#f8fcfc] p-5 shadow-sm sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                aria-label="Your name"
                placeholder="Your name"
                value={contactForm.name}
                onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                maxLength={100}
                required
                className="h-11 bg-white"
              />
              <Input
                aria-label="Email address"
                type="email"
                placeholder="Email address"
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                maxLength={255}
                required
                className="h-11 bg-white"
              />
            </div>
            <Select value={contactForm.category} onValueChange={(v) => setContactForm(prev => ({ ...prev, category: v }))}>
              <SelectTrigger aria-label="Category" className="h-11 bg-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Inquiry</SelectItem>
                <SelectItem value="support">Technical Support</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              aria-label="Your message"
              placeholder="Your message..."
              value={contactForm.message}
              onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
              maxLength={2000}
              rows={4}
              required
              className="bg-white"
            />
            <Button type="submit" className="h-12 w-full gap-2 rounded-xl bg-[#0f5f68] text-base hover:bg-[#0a4b52]" disabled={contactSubmitting}>
              <Send className="h-4 w-4" />
              {contactSubmitting ? "Sending..." : "Send Message"}
            </Button>
          </form>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-slate-600">
            <Mail className="h-4 w-4 text-[#16858c]" /> Prefer email?
            <a href={`mailto:${LEGAL_EMAIL}`} className="break-all font-semibold text-[#0f5f68] underline-offset-4 hover:underline">{LEGAL_EMAIL}</a>
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
