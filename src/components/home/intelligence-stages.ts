export type IntelligenceStage = "observe" | "diagnose" | "intervene" | "measure" | "adapt";

export const INTELLIGENCE_STAGES = [
  { id: "observe", title: "Observe", description: "Capture answers, timing, confidence and answer changes.", region: "hemispheres", regionLabel: "Cerebral hemispheres" },
  { id: "diagnose", title: "Diagnose", description: "Identify recurring performance and decision-making patterns.", region: "hemispheres", regionLabel: "Cerebral hemispheres" },
  { id: "intervene", title: "Intervene", description: "Select a targeted learning action based on available evidence.", region: "cord", regionLabel: "Brainstem and spinal cord" },
  { id: "measure", title: "Measure", description: "Evaluate subsequent performance and behavioural change.", region: "cord", regionLabel: "Brainstem and spinal cord" },
  { id: "adapt", title: "Adapt", description: "Use new evidence to inform the next training action.", region: "funnel", regionLabel: "Next best action funnel" },
] as const;
