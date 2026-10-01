import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Question = {
  id: string;
  stem: string;
  options: string[];
  answer: number;
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
];

export default function Landing() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const question = QUESTION_BANK[index];
  const isLast = index === QUESTION_BANK.length - 1;

  const continueToNext = () => {
    if (selected === null) return;

    if (isLast) {
      setSubmitted(true);
      return;
    }

    setIndex((value) => value + 1);
    setSelected(null);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#f6fbfc] px-4 py-8 text-slate-950 sm:py-12">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">6 / 6</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6fbfc] px-4 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between text-xs font-bold uppercase tracking-[.16em] text-slate-500">
          <span>Question {index + 1} of 6</span>
          <span>{Math.round(((index + 1) / 6) * 100)}%</span>
        </div>

        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#16858c] transition-all"
            style={{ width: ((index + 1) / 6) * 100 + "%" }}
          />
        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="font-display text-xl font-bold leading-8 tracking-tight sm:text-2xl">
            {question.stem}
          </h1>

          <div className="mt-7 space-y-3">
            {question.options.map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelected(optionIndex)}
                className={
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm font-medium transition-all sm:text-base " +
                  (selected === optionIndex
                    ? "border-[#16858c] bg-[#eaf8f8] text-[#0b4f57] ring-2 ring-[#16858c]/10"
                    : "border-slate-200 bg-white hover:border-[#9ccfd1] hover:bg-[#f8fcfc]")
                }
              >
                <span
                  className={
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold " +
                    (selected === optionIndex
                      ? "bg-[#0f5f68] text-white"
                      : "bg-slate-100 text-slate-500")
                  }
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="pt-1 leading-6">{option}</span>
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={continueToNext}
            disabled={selected === null}
            className="mt-7 h-12 w-full rounded-xl bg-[#0f5f68] text-base hover:bg-[#0a4b52]"
          >
            {isLast ? "Submit" : "Next"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </section>
      </div>
    </main>
  );
}
