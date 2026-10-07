import { articleWordCount, readTimeLabel, type BlogBody } from "@/lib/blogText";

export const NOT_AFFILIATED = "Zyntra is independent and not affiliated with the Australian Medical Council (AMC), AHPRA or the Medical Board of Australia.";

export type Article = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  /** ISO date the article was first published. */
  published: string;
  /** ISO date the article's facts were last checked against amc.org.au. */
  lastChecked: string;
  featured?: boolean;
};

export const articles: Article[] = [
  {
    slug: "amc-part-1-mcq",
    category: "AMC",
    title: "AMC MCQ Preparation: Train for the One-Way Exam",
    excerpt: "AMC MCQ preparation for IMGs: 150 one-way questions in 3.5 hours. How to train your pacing and your second guess, not just your recall.",
    published: "2026-10-03",
    lastChecked: "2026-10-06",
    featured: true,
  },
  {
    slug: "amc-part-2-osce",
    category: "AMC",
    title: "AMC Clinical Exam Tips: Train for the 8-Minute Clock",
    excerpt: "AMC clinical exam tips for IMGs: 16 stations, 8 minutes each, pass 9 of 14 scored. How to train for the clock and recover between stations.",
    published: "2026-10-03",
    lastChecked: "2026-10-06",
  },
  {
    slug: "amc-pass-rates-what-the-amc-publishes",
    category: "AMC",
    title: "AMC Pass Rates: What the AMC Publishes (and Doesn't)",
    excerpt: "AMC MCQ and clinical exam pass rates, taken only from AMC annual reports. What the numbers mean, what's missing, and how to read them calmly.",
    published: "2026-10-07",
    lastChecked: "2026-10-07",
  },
];


export const articleBody: Record<string, BlogBody> = {
  "what-is-zyntra": {
    intro: "Zyntra is a medical examination training platform built around Performance Intelligence. The starting point is AMC preparation, but the larger ambition is to build a training environment that can support doctors and medical students across multiple examination systems.",
    sections: [
      { title: "Zyntra is a training platform, not another question bank", body: "The basic idea is simple. Learning the subject and performing under exam conditions are related, but they are not the same task. You can know a great deal of medicine and still lose marks through pacing that slips late in the exam, second-guessing that doesn't help, and decisions that get shakier under pressure. Zyntra is designed to train the performance side as well as the medical knowledge side." },
      { title: "Why AMC is the first platform", body: "AMC is where Zyntra is growing first. AMC preparation gives the platform a demanding environment in which broad medical knowledge, clinical reasoning and examination performance all matter. Part 1 and Part 2 also require different forms of preparation, making the AMC ecosystem a useful foundation for building a broader medical-examination training platform." },
      { title: "Where Zyntra is going", body: "The longer-term direction extends beyond AMC. Zyntra is being developed toward USMLE, Royal College examinations, medical school examinations, postgraduate medical examinations and other healthcare-related assessments. The examination changes, but the underlying training problem remains: learn the material, practise applying it, understand your performance and improve deliberately." },
      { title: "The Zyntra principle", body: "An answer is one signal. Your decision process is the dataset. Zyntra uses that distinction to help candidates understand not only what they got right or wrong, but how they are performing while they train." },
    ],
  },
  "amc-part-1-mcq": {
    intro: "Most AMC MCQ preparation is about the medicine. More questions. More topics. More notes. That matters. But the exam also tests something no question bank drills: making 150 decisions in a row, against a clock, with no way back. This guide covers what the AMC says about the format, and how to train for it.",
    sections: [
      { title: "What the AMC CAT MCQ actually looks like", body: "The AMC MCQ is 150 questions in one 3.5-hour session. Each question has five options and one best answer. It is computer adaptive: answer correctly and the next question is harder; answer incorrectly and the next one is easier. There is no negative marking. Results are reported on a 0 to 500 scale, and a pass is described as 250. From 2026 the AMC raised the pass standard slightly. The format and the reporting scale did not change." },
      { title: "The rule that changes everything: no going back", body: "You must answer each question before the next one appears. Once you answer, you cannot go back and change it, and you cannot skip a question and return to it later. The AMC also expects you to finish all 150. If you don't, your result can be recorded as \"Fail – insufficient data\". So \"flag it and come back\" is not a strategy here. Every question gets one decision, made once." },
      { title: "84 seconds, 150 times", body: "3.5 hours is 210 minutes. Spread across 150 questions, that is about 84 seconds each. That is an average, not a rule. Some questions take 40 seconds. Some take two minutes. The danger is drift. Two minutes on question 20 feels harmless, but you pay for it at question 130. Candidates often say the last hour is the hardest stretch, when they are tired and behind. So practise full 150-question blocks in 3.5 hours, not only 25-question sets. Then check your pace in quarters: questions 1–38, 39–75, 76–113 and 114–150. If your time per question or your accuracy drops in the last quarter, that is a training target, not a knowledge gap." },
      { title: "First, understand what you are training for", body: "Every question asks for the single best answer, and the AMC warns that other options may be partly correct. Knowledge is the foundation. But the exam also rewards spotting the key clue fast, ruling out the nearly-right options, and committing." },
      { title: "Stop measuring preparation only in questions completed", body: "A candidate can complete thousands of questions and keep the same weak spots. Better questions to ask: Which subjects are weak? Which errors repeat? Does my pace slip after question 100? Do I lose minutes stuck between two plausible options? When I switch options before clicking Next, does it help me or hurt me? Those answers tell you what to train next." },
      { title: "First instinct or second guess?", body: "On a one-way exam, the only place you can change your mind is inside the question, before you click Next. Common advice says never change your first answer. The research does not back that up. For decades, studies of multiple-choice exams have found that changed answers go from wrong to right more often than from right to wrong. A 2023 study of medical students found most of the class gained from changing answers, and the stronger students gained more. So the useful question is personal: when you switch, does it usually help you or hurt you? You can find out. For a few hundred practice questions, note your first pick and your final pick. Then count which way the changes went." },
      { title: "Learn the medicine, then train the decision", body: "Review explanations properly. Ask why the right answer fits and why the others don't. When you miss a question, name the cause: missing knowledge, misreading the stem, wrong priority, running out of time, or a switch that didn't help. Different problems need different fixes. More questions won't fix a pacing problem." },
      { title: "Skip the recalls", body: "Recall papers circulate in every IMG group. The AMC says it has reviewed these reconstructed papers and found many of the question stems and answers to be incorrect. Sharing or selling material that claims to be AMC exam content can also count as irregular behaviour under the AMC's rules. Use the free AMC MCQ preparation app, built with eMedici, and read the official [AMC MCQ examination specifications](https://www.amc.org.au/wp-content/uploads/2025/09/2025-09-09-MCQ-Specifications-V8.pdf) instead." },
      { title: "The practical rule", body: "Don't only ask, \"How many questions have I done?\" Ask, \"What happens to my pace and my judgement in the last hour?\" That is the part of the exam most preparation never touches." },
      { title: "Last checked", body: "Facts in this article were checked against amc.org.au on 6 October 2026. The AMC updates its rules from time to time, so confirm on the official [AMC CAT MCQ examination page](https://www.amc.org.au/pathways/standard-pathway/amc-assessments/mcq-examination/) before you book. Related: [AMC clinical exam tips: train for the 8-minute clock](/blog/amc-part-2-osce). Zyntra is independent and not affiliated with the Australian Medical Council." },
    ],
  },
  "amc-part-2-osce": {
    intro: "The AMC clinical exam is not a quiz. It is 16 short performances, each judged on its own. Knowing the medicine gets you into the room. Doing it calmly, in order, inside eight minutes, is what the examiner sees.",
    sections: [
      { title: "What the AMC clinical exam looks like", body: "You can sit it once you have passed the AMC CAT MCQ. There are 16 assessed stations plus four rest stations. Each station runs for 10 minutes: 2 minutes of reading, then 8 minutes of assessment. Stations may use simulated patients or video presentations, plus charts, images or photos. Each station focuses on one area: history taking, examination, diagnostic formulation, or management, counselling and education. Content covers medicine, surgery, women's health, paediatrics and mental health, in community and hospital settings. Two of the 16 stations are pilot stations. Your result comes from 14 scored stations, and you pass with 9 or more of the 14." },
      { title: "It is a performance, not a quiz", body: "There is no answer to click. You listen, talk, examine when asked, reason out loud and agree a plan with the patient. The examiner needs to see how you got there, not just hear a rehearsed conclusion." },
      { title: "Every station is a fresh start", body: "The AMC bases your result on the number of stations you pass. One great station does not rescue a bad one. And one bad station only sinks the next if you carry it in with you. That makes recovery a skill. Practise walking out of a station that went badly, taking one breath, and reading the next task clean." },
      { title: "The skills you need to train", body: "History taking. Focused examination. Clinical reasoning and differentials. Investigations and a management plan. Then the parts people skip: explaining clearly, sharing decisions, safety-netting, and treating the patient like a person." },
      { title: "Use frameworks without becoming robotic", body: "Good preparation gives you reliable structures. It should not turn every patient into a memorised script. Learn how to approach a station, then deliberately vary the presentation so that the underlying reasoning becomes transferable." },
      { title: "Practise under the real clock", body: "Reading a model station is useful. Doing it out loud, against a real 2 + 8 minute clock, then getting specific feedback is different. Review what you left out, how you spoke, your reasoning and where the minutes went. \"It felt fine\" is not feedback." },
      { title: "Booking: what the AMC has said about 2027", body: "The AMC says the next release of in-person clinical exam places is expected in November 2026, for 2027 exam dates, with more information due in October 2026. The expression-of-interest waitlist has reached capacity. Online exams on 10 and 11 November 2026 are closed, and no more online dates will be released this year. Fees are A$3,000 in person and A$3,400 online (A$3,000 plus a A$400 levy). The AMC's [fees page](https://www.amc.org.au/pathways/fees-and-charges/) lists a 50% refund if you withdraw within a month of paying, and none after that. Dates change, so check the [AMC clinical examination page](https://www.amc.org.au/pathways/standard-pathway/amc-assessments/clinical-examination/)." },
      { title: "Where Zyntra fits today", body: "Honest status: our clinical practice room is not live yet. Nothing in this article describes a Zyntra feature. For rules, eligibility and dates, the official AMC pages always win." },
      { title: "Last checked", body: "Facts in this article were checked against amc.org.au on 6 October 2026. Related: [AMC MCQ preparation: train for the one-way exam](/blog/amc-part-1-mcq). Zyntra is independent and not affiliated with the Australian Medical Council." },
    ],
  },
  "amc-pass-rates-what-the-amc-publishes": {
    intro: "If you are preparing for the AMC, you have probably seen a pass rate. In a group chat, an ad, a video thumbnail. Some of those numbers are close to real. Some are old. Some have no source at all. This post sticks to one rule: we only use numbers the Australian Medical Council itself has published, each with a year and a link. Where the AMC hasn't published a number, we say so.",
    sections: [
      { title: "Where AMC pass rates come from", body: "The AMC reports exam statistics in its annual reports. Each report covers a financial year, July to June, and is free to download from amc.org.au. Two reports matter right now. The [AMC 2023-24 Annual Report](https://www.amc.org.au/wp-content/uploads/2024/11/AMC-2023-24-Annual-Report.pdf) is the most recent one with pass rates. The [AMC 2024-25 Annual Report](https://www.amc.org.au/wp-content/uploads/2026/06/20260610-AMC-AnnualReport-PDFReport_Final.pdf) gives the number of exams sat, but no pass rates." },
      { title: "The MCQ: 51% in 2023-24", body: "From the 2023-24 Annual Report (Table 7, MCQ examination statistics): in 2023-24, 6,331 IMGs sat the MCQ, 4,278 for the first time, and 3,234 passed. That is a 51% pass rate. In 2022-23, 4,468 sat, 2,987 for the first time, and 2,119 passed: 47%. So in 2023-24 about half of MCQ sittings ended in a pass, up four points on the year before. Source: [AMC 2023-24 Annual Report](https://www.amc.org.au/wp-content/uploads/2024/11/AMC-2023-24-Annual-Report.pdf)." },
      { title: "The clinical exam: 24% in 2023-24", body: "The 2023-24 Annual Report says the AMC ran 126 clinical exam sessions and assessed 2,107 IMGs. Of these, 989 sat for the first time, and 509 passed: 24%. Source: [AMC 2023-24 Annual Report](https://www.amc.org.au/wp-content/uploads/2024/11/AMC-2023-24-Annual-Report.pdf). One note if you open the PDF: Table 9 in that report labels its columns \u201c2021-22\u201d and \u201c2022-23\u201d, but the text above it gives the 2,107 and 509 figures for 2023-24. We checked the previous year's report to settle it. The [AMC 2022-23 Annual Report](https://www.amc.org.au/wp-content/uploads/2023/11/AMC-2022-23-Annual-Report.pdf) (Table 7) gives 2022-23 as 2,053 assessed, 863 first-time, 426 passed, 21%. Those match the first column of the 2023-24 table, so the correct labels are 2022-23 (21%) and 2023-24 (24%)." },
      { title: "The pass mark changed partway through", body: "From 21 March 2024, the AMC lowered the clinical pass mark from 10 of 14 stations to 9 of 14. The 2023-24 report says this change will increase the pass rate. It came in partway through 2023-24, so the 24% only partly reflects it." },
      { title: "2024-25: no pass rates published", body: "The [2024-25 Annual Report](https://www.amc.org.au/wp-content/uploads/2026/06/20260610-AMC-AnnualReport-PDFReport_Final.pdf) shows how many exams were sat, but gives no pass rates for either exam. MCQ examinations: 7,821 (up 23% on the year before), 2,482 in Australia and 5,339 overseas. Clinical examinations: 2,401 (up 8%), 1,113 online and 1,288 in person. No pass count. No percentage. So if someone quotes you a \u201ccurrent\u201d AMC pass rate, ask where it came from. As of today, the newest official figures are from 2023-24." },
      { title: "How to read these numbers", body: "A pass rate feels like a verdict. It isn't one. They count sittings, not people: someone who sat the MCQ twice in a year appears twice, and many people who fail pass on a later try. The AMC doesn't publish what share of people pass eventually. They mix everyone together: first attempts, repeats, recent graduates and doctors who left practice years ago are in one figure. And the rules keep moving. The clinical pass mark changed in March 2024. The AMC also says that from 2026 it has made \u201ca small increase to the pass standard\u201d for the MCQ. Results are still reported on a 0 to 500 scale, with 250 described as a pass, and the content and format haven't changed ([AMC FAQ, update to the MCQ pass standard](https://www.amc.org.au/wp-content/uploads/2025/12/Update-to-MCQ-Exam-Pass-Standard.pdf)). Older pass rates may not predict newer ones." },
      { title: "Why so many good doctors fail", body: "Many candidates who fail know the medicine. What trips them up is often the exam conditions. The MCQ is 150 questions in 3.5 hours ([MCQ Examination Specifications V8, Sept 2025](https://www.amc.org.au/wp-content/uploads/2025/09/2025-09-09-MCQ-Specifications-V8.pdf)). That is about 84 seconds per question. You must answer each question before you get the next one, and the AMC is clear: \u201conce a question has been answered, a candidate cannot go back to a previous question and change a response.\u201d No flagging, no returning at the end. The clinical exam has its own pressure: you need to pass 9 of 14 scored stations, each a fresh start with a new patient and a new clock. That is a conditions problem, and conditions can be trained, just like knowledge." },
      { title: "What to do with this", body: "Don't let a percentage set your mood: it describes a crowd, not you. Use official sources and check amc.org.au for current rules before you book. Avoid recall papers: the AMC's [MCQ Examination Specifications](https://www.amc.org.au/wp-content/uploads/2025/09/2025-09-09-MCQ-Specifications-V8.pdf) say it has been given copies of these reconstructed papers and found many of the question stems and responses to be incorrect. Practise under real conditions: full 150-question blocks in 3.5 hours, one way only, and check whether your pace or accuracy drops in the last quarter. Name the cause of each miss: the medicine, misreading the stem, or the clock. Each needs a different fix. We're building Zyntra to help IMGs train for exam conditions, not just content. If that sounds useful, try the [free AMC readiness check](/check)." },
      { title: "Last checked", body: "Figures in this article were checked against amc.org.au on 7 October 2026. The AMC updates its rules and reports from time to time, so always confirm current details on amc.org.au. Related: [AMC MCQ preparation: train for the one-way exam](/blog/amc-part-1-mcq). Zyntra Healthcare Intelligence is independent and not affiliated with, or endorsed by, the Australian Medical Council." },
    ],
  },
  "performance-intelligence-engine": {
    intro: "A Performance Intelligence Engine is designed to make training information more useful than a simple right-or-wrong score. Zyntra uses performance signals to help candidates understand how they are performing while they practise.",
    sections: [
      { title: "Why accuracy alone is incomplete", body: "Imagine two candidates both score 70%. One is consistently performing around that level. The other gets questions right but rushes in the last hour, gets stuck between two options and struggles with a particular subject. The percentage is identical. The training problem is not." },
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
      { title: "5. Use mistakes and answer changes intelligently", body: "A wrong answer is not automatically the same type of mistake every time. If you switched options before submitting, check whether switching usually helps or hurts you." },
      { title: "6. Use repetition properly", body: "Repeatedly missing the same concept is more important than a single isolated error. Return to the underlying knowledge, practise a variation of the problem and check whether the mistake persists." },
      { title: "7. Use Zyntra alongside proper medical study", body: "Zyntra is an educational training platform, not a replacement for textbooks, guidelines, lectures or other appropriate medical learning resources. If the problem is missing knowledge, learn the knowledge. Then return and test whether it transfers into performance." },
      { title: "The Zyntra rule", body: "Do not use Zyntra merely to find out how many questions you got right. Use it to understand how you are performing while you answer them. That is where the training value lives." },
    ],
  },
  "why-getting-a-question-wrong-isnt-the-whole-story": {
    intro: "Two incorrect answers can represent completely different training problems. The result matters, but the path to the result can contain additional information.",
    sections: [
      { title: "Wrong is not one category", body: "A fast guess, a careful but incorrect decision and a right first pick switched to a wrong one before submitting are different events. Treating them as identical can hide useful training signals." },
      { title: "Review what happened", body: "Look at timing, confidence, answer changes and the clinical reasoning behind the decision. These signals do not diagnose personality. They help you decide what deserves another look." },
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

/** Read time computed from the article's actual word count. */
export function articleReadTime(slug: string): string {
  const body = articleBody[slug];
  return body ? readTimeLabel(articleWordCount(body)) : readTimeLabel(0);
}
