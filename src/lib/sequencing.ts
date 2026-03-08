// Smart question sequencing engine based on AMC Blueprint escalation rules

export interface QuestionWithTier {
  id: string;
  category: string;
  difficulty_tier: number | null;
  [key: string]: any;
}

export interface SequencingState {
  position: number;
  consecutiveIncorrect: number;
  consecutiveSameSubject: number;
  lastSubject: string | null;
  recentResults: boolean[]; // last 5 results
  recentChanges: number[]; // last 5 change counts
  avgTimePerQuestion: number;
  initialAvgTime: number;
}

export function getTargetTier(state: SequencingState, totalQuestions: number): number[] {
  const { position, consecutiveIncorrect } = state;

  // After 3 consecutive incorrect: confidence builder
  if (consecutiveIncorrect >= 3) return [1];

  // Time increasing >20%: recovery questions
  if (state.initialAvgTime > 0 && state.avgTimePerQuestion > state.initialAvgTime * 1.2) {
    return [1, 2];
  }

  // First 5 questions: Tier 1-2 only
  if (position < 5) return [1, 2];

  // Questions 6-30: 60% Tier 2, 40% Tier 3
  if (position < 30) {
    if (position === 29) return [2]; // Q30 fatigue reset
    return Math.random() < 0.6 ? [2] : [3];
  }

  // Questions 31-55: Tier 3-4 dominant
  if (position < 55) return [3, 4];

  // Questions 56-60: Tier 2-3 (prevent give-up)
  return [2, 3];
}

export function selectNextQuestion(
  pool: QuestionWithTier[],
  usedIds: Set<string>,
  state: SequencingState,
  totalQuestions: number,
  weakAreas?: string[]
): QuestionWithTier | null {
  const targetTiers = getTargetTier(state, totalQuestions);

  // Filter out used questions
  let available = pool.filter(q => !usedIds.has(q.id));
  if (available.length === 0) return null;

  // Avoid 3 consecutive same subject
  if (state.consecutiveSameSubject >= 2 && state.lastSubject) {
    const filtered = available.filter(q => q.category !== state.lastSubject);
    if (filtered.length > 0) available = filtered;
  }

  // Prefer target tier questions
  const tierMatches = available.filter(q => {
    const tier = q.difficulty_tier || 2; // default to tier 2 if unclassified
    return targetTiers.includes(tier);
  });

  let candidates = tierMatches.length > 0 ? tierMatches : available;

  // Boost weak areas for targeting (when in hard tier range)
  if (weakAreas && weakAreas.length > 0 && targetTiers.some(t => t >= 3)) {
    const weakCandidates = candidates.filter(q => weakAreas.includes(q.category));
    if (weakCandidates.length > 0 && Math.random() < 0.4) {
      candidates = weakCandidates;
    }
  }

  // Random selection from candidates
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

export function shouldShowIntervention(state: SequencingState): string | null {
  // Change rate >50% in last 5 questions
  if (state.recentChanges.length >= 5) {
    const highChangeCount = state.recentChanges.filter(c => c > 0).length;
    if (highChangeCount / state.recentChanges.length > 0.5) {
      return 'trust_your_gut';
    }
  }

  // 3+ consecutive incorrect at low tier
  if (state.consecutiveIncorrect >= 3) {
    return 'review_mode';
  }

  return null;
}
