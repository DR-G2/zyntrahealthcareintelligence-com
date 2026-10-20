export interface DrillFeedbackEvidence {
  total: number;
  totalChanges: number;
  avgTime: number;
  accuracy: number;
  easyWrong: number;
  hardCorrect: number;
  weaknesses: string[];
}

/**
 * Return a factual, heuristic feedback statement only after five questions.
 * Thresholds intentionally match the pre-existing drill heuristics.
 */
export function getDrillBehaviouralFeedback(evidence: DrillFeedbackEvidence): string | null {
  const { total, totalChanges, avgTime, accuracy, easyWrong, hardCorrect, weaknesses } = evidence;
  if (total < 5) return null;

  const changesPerQ = total > 0 ? totalChanges / total : 0;
  if (changesPerQ > 1.5) return 'High answer-change rate: more than 1.5 changes per question.';
  if (easyWrong > total * 0.2) return 'Incorrect answers on more than 20% of easy questions.';
  if (avgTime < 30 && accuracy < 60) return 'Average time is under 30 seconds with accuracy below 60%.';
  if (hardCorrect > 0 && easyWrong > 0) return 'Correct answers on difficult questions and incorrect answers on easy questions.';
  if (weaknesses.length > 0) return `Accuracy below 60% in: ${weaknesses.slice(0, 2).join(' and ')}.`;
  return null;
}
