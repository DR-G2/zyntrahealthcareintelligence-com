export type FeatureStatus = "Live" | "Beta" | "Coming soon";
export type PublicFeature = { key: string; name: string; status: FeatureStatus; tone: "live" | "beta" | "soon"; summary: string; detail: string };
/** Canonical public availability. Live describes the core capability, not every related signal or workflow. */
export const featureAvailability = {
  mcqPractice: { key:"mcqPractice", name:"AMC-style MCQ practice", status:"Live", tone:"live", summary:"Practise AMC-style multiple-choice questions and review explanations.", detail:"MCQ practice is available. Use explanations and recorded attempts to guide further study." },
  performanceIntelligence: { key:"performanceIntelligence", name:"Performance Intelligence", status:"Live", tone:"live", summary:"Review available practice outcomes and signals.", detail:"Core performance views are available. Signals and depth of analysis depend on activity and release." },
  aiStudyLab: { key:"aiStudyLab", name:"AI Study Lab", status:"Beta", tone:"beta", summary:"AI-assisted study support, subject to release and provider availability.", detail:"Beta availability can vary by release and provider setup." },
  studyPlan: { key:"studyPlan", name:"Study Plan", status:"Beta", tone:"beta", summary:"Planning tools can help organise areas to revisit when available.", detail:"Planning functionality is in beta and may depend on available practice data." },
  oscePractice: { key:"oscePractice", name:"OSCE practice", status:"Coming soon", tone:"soon", summary:"Clinical station practice is not live yet.", detail:"OSCE station practice is not available in the current public release." },
  behaviour: { key:"behaviour", name:"Behaviour insights", status:"Beta", tone:"beta", summary:"Decision-pattern analysis is being introduced incrementally.", detail:"Behaviour-related views depend on the current release and available observations." },
  confidence: { key:"confidence", name:"Confidence signals", status:"Beta", tone:"beta", summary:"Confidence and correctness comparisons are available only where enabled.", detail:"Confidence-related functionality is release-dependent; do not assume it is present in every activity." },
  evidence: { key:"evidence", name:"Evidence views", status:"Beta", tone:"beta", summary:"Evidence supporting an insight is available only in supported views.", detail:"Evidence views are partial and depend on the current release." },
  interventions: { key:"interventions", name:"Interventions and next actions", status:"Beta", tone:"beta", summary:"Some next-step guidance is available; the full intervention and follow-up workflow is not universal.", detail:"Intervention features and outcome measurement depend on the current release." },
  historyProgress: { key:"historyProgress", name:"History and progress", status:"Beta", tone:"beta", summary:"Review recorded attempts and available progress views.", detail:"History and progress coverage varies by activity; not every history workspace is complete." },
  flashcards: { key:"flashcards", name:"Flashcards", status:"Beta", tone:"beta", summary:"Flashcard functionality is implemented; public-release availability has not been fully verified.", detail:"Treat availability as beta until release coverage is confirmed." },
} as const satisfies Record<string, PublicFeature>;
export type FeatureKey = keyof typeof featureAvailability;
export const getFeatureStatus = (key: FeatureKey) => featureAvailability[key].status;
export const publicFeatureList: PublicFeature[] = Object.values(featureAvailability);
