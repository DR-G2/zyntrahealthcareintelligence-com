import { SeoLandingPage } from "@/components/public/SeoLandingPage";

export default function AmcExamPreparation() {
  return (
    <SeoLandingPage
      path="/amc-exam-preparation"
      title="AMC Exam Preparation for IMGs | MCQ and Clinical | Zyntra"
      description="A practical guide to AMC exam preparation: how the MCQ and Clinical exams fit together, how to structure study, and how Zyntra helps you practise."
      breadcrumb="AMC exam preparation"
      eyebrow="Australian Medical Council exam preparation"
      h1="AMC Exam Preparation: A Practical Guide for the MCQ and Clinical Exams"
      intro="Preparing for the Australian Medical Council examinations means building two related skills: answering clinical multiple-choice questions accurately under time pressure, and demonstrating structured, safe clinical communication in stations. This guide explains how the two stages fit together and how Zyntra supports your practice."
      sections={[
        {
          heading: "How the AMC examinations fit together",
          paragraphs: [
            "On the Standard Pathway, candidates usually sit the AMC CAT MCQ examination first and the AMC Clinical examination afterwards. The MCQ tests applied medical knowledge across the major disciplines; the Clinical examination assesses history taking, examination, management and communication in timed stations.",
            "The AMC publishes the current format, eligibility rules, fees and booking windows. Treat the AMC website as the source of truth and check it before you plan your timeline.",
          ],
        },
        {
          heading: "Building an AMC study plan",
          bullets: [
            "Start from your exam date and work backwards in weekly blocks, leaving time for full timed practice near the end.",
            "Cover all core disciplines — adult medicine, surgery, women's health, child health, mental health and population health — rather than only favourite topics.",
            "Review every explanation, including for questions you answered correctly, to check that your reasoning was sound and not a lucky guess.",
            "Track recurring error types (misread stem, distractor attraction, knowledge gap) instead of only your overall percentage.",
            "Practise under exam-like timing regularly so pace becomes a habit, not a surprise.",
          ],
        },
        {
          heading: "How Zyntra supports AMC preparation",
          paragraphs: [
            "Zyntra provides AMC-style clinical MCQ practice with explanations. While you practise, it records signals such as time spent, the confidence you report, and whether you changed your answer, so you can review accuracy alongside answer stability, timing and confidence calibration.",
            "Available practice signals can help you review performance and choose a suggested next step. They are not a pass prediction or a replacement for official AMC guidance. Clinical station practice is being released in stages; the AMC Clinical page explains what is currently available.",
          ],
        },
      ]}
      related={[
        { to: "/amc-part-1-mcq", label: "AMC Part 1 MCQ preparation", note: "Practice questions, explanations and timing for the CAT MCQ." },
        { to: "/amc-clinical-osce", label: "AMC Clinical (OSCE) preparation", note: "Station structure and communication practice." },
        { to: "/amc-preparation-for-imgs", label: "AMC preparation for IMGs", note: "Pathways, Australian context and planning for international graduates." },
        { to: "/blog", label: "Zyntra Journal", note: "Articles on the AMC exams and preparation." },
      ]}
      faqs={[
        { q: "How long does AMC exam preparation take?", a: "It varies with your clinical background, recent study and available time. Many candidates plan several months for the MCQ. Build a plan around your exam date and adjust it as your practice results show where you need more work." },
        { q: "Should I prepare for the MCQ and Clinical exams together?", a: "Most candidates focus on the MCQ first because it usually comes first on the Standard Pathway. Clinical reasoning practised for the MCQ still helps later, so it is useful to keep station structure in mind." },
        { q: "Does Zyntra use real AMC exam questions?", a: "No. Zyntra's questions are written for education in an AMC style. They are not recalled or official AMC examination material." },
        { q: "Can Zyntra tell me if I will pass?", a: "No. Zyntra helps you review available practice evidence and decide what to study next. It does not predict or guarantee exam results." },
      ]}
    />
  );
}
