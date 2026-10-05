export type SeededRng = () => number;

export interface SyntheticQuestion {
  id: string;
  difficulty: number;
  discrimination: number;
  ambiguity: number;
  cognitiveDemand: number;
  novelty: number;
}

export interface SyntheticObservation {
  candidateId: string;
  questionId: string;
  position: number;
  trueCapability: number;
  trueTiming: number;
  trueDecision: number;
  trueCalibration: number;
  difficulty: number;
  timePressure: number;
  confidence: number;
  firstCorrect: boolean;
  finalCorrect: boolean;
  outcome: boolean;
  answerChanged: boolean;
  missing: boolean;
}

export interface SyntheticCandidate {
  id: string;
  capability: number;
  timing: number;
  decision: number;
  calibration: number;
}

export interface SyntheticDataset {
  seed: number;
  candidates: SyntheticCandidate[];
  questions: SyntheticQuestion[];
  observations: SyntheticObservation[];
}

export function seededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function normal(rng: SeededRng): number {
  const u = Math.max(rng(), Number.EPSILON);
  const v = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function makeDataset(
  seed: number,
  candidateCount = 40,
  questionCount = 80,
  attemptsPerCandidate = 50,
): SyntheticDataset {
  const rng = seededRng(seed);
  const candidates: SyntheticCandidate[] = Array.from({ length: candidateCount }, (_, i) => ({
    id: `C${i + 1}`,
    capability: clamp01(0.15 + rng() * 0.7),
    timing: clamp01(0.2 + rng() * 0.65),
    decision: clamp01(0.25 + rng() * 0.6),
    calibration: clamp01(0.2 + rng() * 0.7),
  }));

  const questions: SyntheticQuestion[] = Array.from({ length: questionCount }, (_, i) => ({
    id: `Q${i + 1}`,
    difficulty: 0.15 + rng() * 0.7,
    discrimination: 0.7 + rng() * 0.7,
    ambiguity: rng() * 0.08,
    cognitiveDemand: 0.2 + rng() * 0.7,
    novelty: 0.1 + rng() * 0.8,
  }));

  const observations: SyntheticObservation[] = [];

  for (const candidate of candidates) {
    for (let position = 0; position < attemptsPerCandidate; position += 1) {
      const q = questions[Math.floor(rng() * questions.length)];
      const timePressure = clamp01(
        0.15 + (position / Math.max(1, attemptsPerCandidate - 1)) * 0.7 + normal(rng) * 0.08,
      );
      const decisionSignal = candidate.decision - q.cognitiveDemand * 0.18;
      const timingPenalty = Math.max(0, timePressure - candidate.timing) * 0.9;
      const logit =
        (candidate.capability - q.difficulty) * q.discrimination +
        decisionSignal * 0.65 -
        timingPenalty -
        q.ambiguity;
      const outcome = rng() < sigmoid(logit);

      const changeProbability =
        0.05 +
        (1 - candidate.decision) * 0.3 +
        Math.abs(0.5 - candidate.calibration) * 0.12;
      const answerChanged = rng() < changeProbability;
      const firstCorrect = answerChanged ? rng() < sigmoid(logit + normal(rng) * 0.35) : outcome;
      const finalCorrect = outcome;

      const confidenceNoise = normal(rng) * (0.10 + q.novelty * 0.08);
      const confidence =
        clamp01(candidate.calibration * (outcome ? 0.82 : 0.22) + (1 - candidate.calibration) * 0.5 + confidenceNoise);

      const missing = rng() < 0.04;

      observations.push({
        candidateId: candidate.id,
        questionId: q.id,
        position,
        trueCapability: candidate.capability,
        trueTiming: candidate.timing,
        trueDecision: candidate.decision,
        trueCalibration: candidate.calibration,
        difficulty: q.difficulty,
        timePressure,
        confidence,
        firstCorrect,
        finalCorrect,
        outcome,
        answerChanged,
        missing,
      });
    }
  }

  return { seed, candidates, questions, observations };
}
