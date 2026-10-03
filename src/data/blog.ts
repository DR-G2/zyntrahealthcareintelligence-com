export type BlogArticle = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
  featured?: boolean;
  body: { heading?: string; paragraphs: string[] }[];
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "amc-part-1-mcq",
    category: "AMC",
    title: "AMC Part 1: What the AMC CAT MCQ Examination Actually Tests",
    excerpt: "AMC-style preparation is not only about collecting correct answers. Applied reasoning, timing and decision behaviour matter to the way you train.",
    readTime: "6 min read",
    date: "October 2026",
    featured: true,
    body: [
      { heading: "Beyond the score", paragraphs: [
        "A question bank can tell you whether an answer was correct. A useful training system can also help you understand what happened while you reached that answer.",
        "For AMC preparation, that means paying attention to clinical reasoning, timing, confidence and what happens when your first decision is challenged."
      ]},
      { heading: "What to practise", paragraphs: [
        "Use original practice questions to build applied clinical reasoning across the domains relevant to your preparation. Review the explanation, identify the decision point you missed, and return to the problem later.",
        "Zyntra adds a second layer by keeping selected behavioural signals with the result, so practice can become a longitudinal training dataset."
      ]},
      { heading: "Where Zyntra fits", paragraphs: [
        "Zyntra is an independent educational platform. It is not the Australian Medical Council and its practice content is not official AMC examination content."
      ]}
    ]
  },
  {
    slug: "amc-part-2-osce",
    category: "AMC",
    title: "AMC Part 2 Clinical Examination: What the AMC OSCE Actually Tests",
    excerpt: "A practical introduction to clinical examination preparation, from structured reasoning and communication to examination, management and safe clinical decisions.",
    readTime: "8 min read",
    date: "October 2026",
    body: [
      { heading: "Think beyond memorised scripts", paragraphs: [
        "Clinical examination preparation is different from memorising isolated phrases. A strong station performance requires you to gather information, communicate clearly, interpret findings and arrive at a defensible clinical decision.",
        "The useful question is not simply, “What do I say next?” It is, “What information do I need, why do I need it, and what will I do with the answer?”"
      ]},
      { heading: "The skills worth training", paragraphs: [
        "Preparation can be organised around history taking, focused examination, explanation and communication, differential diagnosis, investigation and management reasoning, safety-netting and professional interaction.",
        "Practise the structure until it becomes reliable, then deliberately vary the clinical context. That is where rote scripts start giving way to transferable clinical reasoning."
      ]},
      { heading: "Where Zyntra fits today", paragraphs: [
        "Zyntra's authenticated Practice room currently keeps OSCE as a clearly marked “Not live yet” mode. This article is educational content, not a claim that a live Zyntra OSCE engine is available.",
        "Zyntra is independent of the Australian Medical Council. Candidates should use current official AMC information for examination rules, eligibility, format and scheduling."
      ]}
    ]
  },
  {
    slug: "amc-exam-not-just-knowledge-test",
    category: "Clinical Reasoning",
    title: "The AMC Exam Is Not Just a Knowledge Test: Knowledge vs Clinical Performance",
    excerpt: "Knowing the medicine is necessary. Turning that knowledge into a timely, defensible clinical decision is a different skill.",
    readTime: "5 min read",
    date: "October 2026",
    body: [
      { heading: "Knowledge is the starting point", paragraphs: [
        "Clinical questions rarely reward a list of facts in isolation. They ask you to recognise the problem, identify the important evidence and choose the action that fits the situation.",
        "That is why preparation improves when knowledge review is connected to repeated decision-making."
      ]},
      { heading: "Train the decision, not only the answer", paragraphs: [
        "After each question, ask what clue changed your differential, what you ruled out, and whether your final choice followed from the evidence.",
        "Over time, those small reflections can reveal recurring patterns that a percentage score cannot show."
      ]}
    ]
  },
  {
    slug: "why-getting-a-question-wrong-isnt-the-whole-story",
    category: "Performance Intelligence",
    title: "Why Getting an AMC Question Wrong Isn't the Whole Story",
    excerpt: "Two incorrect answers can represent completely different training problems. The path to the answer contains useful information.",
    readTime: "5 min read",
    date: "October 2026",
    body: [
      { heading: "Wrong is not one category", paragraphs: [
        "A fast guess, a careful but incorrect decision, and a correct option changed to an incorrect one are different events.",
        "Treating them as identical can hide useful signals about what to practise next."
      ]},
      { heading: "The training signal", paragraphs: [
        "Timing, answer changes, confidence and consistency can add context to correctness. They should be treated as training signals, not as personality labels or diagnoses."
      ]}
    ]
  },
  {
    slug: "hidden-cost-of-changing-a-correct-answer",
    category: "Performance Intelligence",
    title: "The Hidden Cost of Changing a Correct AMC Answer",
    excerpt: "Changing an answer is sometimes exactly what good reasoning requires. The useful question is what happened between the first and final decision.",
    readTime: "5 min read",
    date: "October 2026",
    body: [
      { heading: "Changing is not automatically bad", paragraphs: [
        "A changed answer can reflect a genuine correction after noticing a missed clue. It can also reflect uncertainty without new evidence.",
        "The distinction is more useful than simply counting how often answers change."
      ]},
      { heading: "Review the transition", paragraphs: [
        "When a first answer becomes a final answer, review what changed your mind. If the evidence changed, the revision may represent good reasoning. If nothing meaningful changed, the event may deserve closer review."
      ]}
    ]
  },
  {
    slug: "confidence-calibration-and-study",
    category: "Performance Intelligence",
    title: "Confidence Calibration for AMC Preparation: When Certainty and Accuracy Don't Match",
    excerpt: "Confidence becomes useful when it is compared with outcomes rather than treated as a feeling to maximise.",
    readTime: "6 min read",
    date: "October 2026",
    body: [
      { heading: "Confidence versus calibration", paragraphs: [
        "Confidence calibration asks whether your certainty tends to match what happens on the question. It is not a score of how confident or capable you are as a person.",
        "A candidate can be highly confident and well calibrated, or highly confident and frequently wrong. Those are different training situations."
      ]},
      { heading: "Turn the signal into action", paragraphs: [
        "High-confidence errors can deserve deliberate review because the problem may be recognition, anchoring or an over-trusted rule. Low-confidence correct answers can reveal knowledge that is present but not yet stable."
      ]}
    ]
  }
];