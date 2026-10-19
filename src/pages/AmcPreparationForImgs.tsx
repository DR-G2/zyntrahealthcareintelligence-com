import { SeoLandingPage } from "@/components/public/SeoLandingPage";

export default function AmcPreparationForImgs() {
  return (
    <SeoLandingPage
      path="/amc-preparation-for-imgs"
      title="AMC Preparation for International Medical Graduates | Zyntra"
      description="AMC preparation for IMGs: understanding registration pathways, adapting to Australian clinical context, and planning study around work and exam dates."
      breadcrumb="AMC preparation for IMGs"
      eyebrow="IMG exam preparation in Australia"
      h1="AMC Preparation for International Medical Graduates"
      intro="International medical graduates bring real clinical experience to the AMC examinations, but the exams test that experience in an Australian context. This page covers the practical questions IMGs face: which pathway applies, what changes in an Australian setting, and how to plan preparation alongside work."
      sections={[
        {
          heading: "Check your registration pathway first",
          paragraphs: [
            "Australian medical registration for IMGs runs through several pathways, including the Competent Authority, Expedited Specialist, Specialist and Standard Pathways. The AMC examinations are central to the Standard Pathway. Eligibility depends on your qualifications and circumstances, so confirm your pathway on the AMC and Medical Board of Australia websites before planning study.",
          ],
        },
        {
          heading: "Adapting to the Australian clinical context",
          bullets: [
            "Learn Australian guidelines and first-line management, which may differ from what you used in your home country.",
            "Know Australian population health priorities, screening programmes and public health structures.",
            "Practise patient-centred communication, shared decision-making and safety-netting, which are emphasised in clinical stations.",
            "Be aware of Aboriginal and Torres Strait Islander health and culturally safe care.",
          ],
        },
        {
          heading: "Planning around work and life",
          paragraphs: [
            "Many IMGs prepare while working. Short, regular timed sessions with careful explanation review usually fit better than occasional long sessions. Track which error types repeat, and spend more time on those than on topics you already answer reliably.",
            "Zyntra is built for this: practise AMC-style questions, review explanations, and use available accuracy, timing and answer-change signals to decide what to practise next. Confidence-related signals appear only where enabled. These are training signals, not an exam prediction.",
          ],
        },
      ]}
      related={[
        { to: "/amc-exam-preparation", label: "AMC exam preparation overview", note: "How the MCQ and Clinical exams fit together." },
        { to: "/amc-part-1-mcq", label: "AMC MCQ preparation", note: "Practice questions with explanations." },
        { to: "/amc-clinical-osce", label: "AMC Clinical preparation", note: "Station structure and communication." },
        { to: "/how-it-works", label: "How Zyntra works", note: "How practice signals guide your next step." },
      ]}
      faqs={[
        { q: "Do all IMGs need to sit the AMC exams?", a: "No. It depends on your pathway. Candidates on the Standard Pathway typically sit the AMC MCQ and Clinical examinations. Check the AMC's pathway guidance for your situation." },
        { q: "Is Australian clinical practice very different?", a: "Core medicine is similar, but guidelines, drug availability, screening and health system structures can differ. Exam questions expect Australian standards, so studying local guidance matters." },
        { q: "Is Zyntra affiliated with the AMC?", a: "No. Zyntra is independent of, and not endorsed by, the Australian Medical Council." },
      ]}
    />
  );
}
