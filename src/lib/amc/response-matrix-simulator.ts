/**
 * AMC CAT response-matrix simulator.
 *
 * This is a validation simulator, NOT a replica of AMC's proprietary
 * production CAT algorithm. Public AMC specifications define the exam
 * structure and adaptive direction, but not the proprietary selection/scoring
 * implementation.
 *
 * Public structural anchors:
 * - 150 MCQs
 * - 3.5 hours
 * - CAT
 * - five options, one correct
 * - at least half from previously calibrated items
 * - remaining new items are calibrated before scoring
 *
 * The simulator keeps truth separate from observations.
 */

export type AMCPatientGroup =
  | "ADULT_MEDICINE"
  | "ADULT_SURGERY"
  | "WOMENS_HEALTH"
  | "CHILD_HEALTH"
  | "MENTAL_HEALTH"
  | "POPULATION_HEALTH";

export type AMCItemStatus = "CALIBRATED" | "NEW";

export interface SimQuestion {
  id: string;
  patientGroup: AMCPatientGroup;
  difficulty: number;
  discrimination: number;
  itemStatus: AMCItemStatus;
  ambiguity: number;
  cognitiveDemand: number;
}

export interface SimCandidate {
  id: string;
  trueTheta: number;
  timingEfficiency: number;
  decisionQuality: number;
  calibration: number;
}

export interface SimAttempt {
  candidateId: string;
  questionId: string;
  position: number;
  itemStatus: AMCItemStatus;
  patientGroup: AMCPatientGroup;
  difficulty: number;
  response: 0 | 1;
  confidence: number;
  timeSeconds: number;
  answerChanged: boolean;
  thetaBefore: number;
}

export interface AMCResponseMatrix {
  seed: number;
  candidates: SimCandidate[];
  questions: SimQuestion[];
  attempts: SimAttempt[];
  /**
   * Sparse matrix:
   * rows = candidates
   * columns = pool questions
   * null = question was not administered to that candidate
   * 0 = incorrect
   * 1 = correct
   */
  matrix: Record<string, Record<string, 0 | 1 | null>>;
  administeredQuestionIds: Record<string, string[]>;
}

const GROUPS: AMCPatientGroup[] = [
  "ADULT_MEDICINE",
  "ADULT_SURGERY",
  "WOMENS_HEALTH",
  "CHILD_HEALTH",
  "MENTAL_HEALTH",
  "POPULATION_HEALTH",
];

const TARGET_PROPORTIONS: Record<AMCPatientGroup, number> = {
  ADULT_MEDICINE: 0.30,
  ADULT_SURGERY: 0.20,
  WOMENS_HEALTH: 0.125,
  CHILD_HEALTH: 0.125,
  MENTAL_HEALTH: 0.125,
  POPULATION_HEALTH: 0.125,
};

export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normal(rng: () => number): number {
  const u = Math.max(rng(), Number.EPSILON);
  const v = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function pick<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length)];
}

/**
 * Largest-remainder allocation.
 *
 * This prevents the 12.5% × 150 rounding problem from producing 151 items.
 * It is a simulator allocation utility, not a claim about AMC's internal
 * blueprint assembly algorithm.
 */
export function allocateBlueprint(totalItems = 150): Record<AMCPatientGroup, number> {
  const raw = GROUPS.map(group => ({
    group,
    raw: TARGET_PROPORTIONS[group] * totalItems,
    floor: Math.floor(TARGET_PROPORTIONS[group] * totalItems),
  }));
  let remaining = totalItems - raw.reduce((s, x) => s + x.floor, 0);
  raw.sort((a, b) => (b.raw - b.floor) - (a.raw - a.floor));
  for (let i = 0; i < remaining; i += 1) raw[i % raw.length].floor += 1;

  return raw.reduce((out, x) => {
    out[x.group] = x.floor;
    return out;
  }, {} as Record<AMCPatientGroup, number>);
}

function makeQuestions(
  rng: () => number,
  questionPoolSize: number,
): SimQuestion[] {
  const questions: SimQuestion[] = [];
  const calibratedCount = Math.ceil(questionPoolSize / 2);

  for (let i = 0; i < questionPoolSize; i += 1) {
    questions.push({
      id: `AMC-Q-${String(i + 1).padStart(5, "0")}`,
      patientGroup: pick(rng, GROUPS),
      difficulty: clamp(normal(rng) * 0.65, -2.5, 2.5),
      discrimination: clamp(0.85 + rng() * 0.75, 0.6, 1.8),
      itemStatus: i < calibratedCount ? "CALIBRATED" : "NEW",
      ambiguity: rng() * 0.04,
      cognitiveDemand: 0.2 + rng() * 0.8,
    });
  }
  return questions;
}

function selectQuestion(
  candidate: SimCandidate,
  questions: SimQuestion[],
  administered: Set<string>,
  targetGroup: AMCPatientGroup,
  theta: number,
  rng: () => number,
  requireCalibrated: boolean,
): SimQuestion {
  const available = questions.filter(q =>
    !administered.has(q.id) &&
    q.patientGroup === targetGroup &&
    (!requireCalibrated || q.itemStatus === "CALIBRATED"),
  );

  const fallback = questions.filter(q =>
    !administered.has(q.id) &&
    (!requireCalibrated || q.itemStatus === "CALIBRATED"),
  );

  const pool = available.length ? available : fallback;
  if (!pool.length) throw new Error("AMC simulator question pool exhausted");

  /**
   * Approximate CAT targeting:
   * choose an item close to the current ability estimate, with a small
   * random exploration component. This is deliberately not represented as
   * the AMC production algorithm.
   */
  if (rng() < 0.08) return pick(rng, pool);

  return [...pool].sort((a, b) =>
    Math.abs(a.difficulty - theta) - Math.abs(b.difficulty - theta),
  )[0];
}

function targetGroupForPosition(
  position: number,
  allocation: Record<AMCPatientGroup, number>,
  rng: () => number,
): AMCPatientGroup {
  const counts = { ...allocation };
  const remaining = Object.values(counts).reduce((a, b) => a + b, 0);

  let offset = Math.floor(rng() * remaining);
  for (const group of GROUPS) {
    if (offset < counts[group]) return group;
    offset -= counts[group];
  }
  return GROUPS[position % GROUPS.length];
}

export interface SimulateOptions {
  seed?: number;
  candidateCount?: number;
  questionPoolSize?: number;
  itemsPerCandidate?: number;
}

export function simulateAMCResponseMatrix({
  seed = 20261005,
  candidateCount = 1000,
  questionPoolSize = 1000,
  itemsPerCandidate = 150,
}: SimulateOptions = {}): AMCResponseMatrix {
  if (itemsPerCandidate !== 150) {
    throw new Error("AMC CAT simulator currently requires 150 scored items per candidate");
  }
  if (questionPoolSize < itemsPerCandidate) {
    throw new Error("questionPoolSize must be at least 150");
  }

  const rng = seededRng(seed);
  const questions = makeQuestions(rng, questionPoolSize);
  const candidates: SimCandidate[] = Array.from({ length: candidateCount }, (_, i) => ({
    id: `AMC-C-${String(i + 1).padStart(5, "0")}`,
    trueTheta: clamp(normal(rng), -2.5, 2.5),
    timingEfficiency: clamp(0.65 + normal(rng) * 0.14, 0.2, 1),
    decisionQuality: clamp(0.7 + normal(rng) * 0.14, 0.2, 1),
    calibration: clamp(0.7 + normal(rng) * 0.16, 0.1, 1),
  }));

  const attempts: SimAttempt[] = [];
  const matrix: Record<string, Record<string, 0 | 1 | null>> = {};
  const administeredQuestionIds: Record<string, string[]> = {};
  const allocation = allocateBlueprint(itemsPerCandidate);

  for (const candidate of candidates) {
    const administered = new Set<string>();
    const row: Record<string, 0 | 1 | null> = {};
    for (const q of questions) row[q.id] = null;

    let theta = candidate.trueTheta;
    let calibratedAdministered = 0;

    for (let position = 0; position < itemsPerCandidate; position += 1) {
      const remaining = itemsPerCandidate - position;
      const requireCalibrated =
        calibratedAdministered < Math.ceil(itemsPerCandidate / 2) &&
        calibratedAdministered < remaining;

      const targetGroup = targetGroupForPosition(position, allocation, rng);
      const q = selectQuestion(
        candidate,
        questions,
        administered,
        targetGroup,
        theta,
        rng,
        requireCalibrated,
      );

      administered.add(q.id);
      if (q.itemStatus === "CALIBRATED") calibratedAdministered += 1;

      const pressure = position / (itemsPerCandidate - 1);
      const timePenalty = Math.max(0, pressure * 0.8 - candidate.timingEfficiency);
      const logit =
        (theta - q.difficulty) * q.discrimination -
        timePenalty * 1.1 -
        q.ambiguity +
        (candidate.decisionQuality - 0.5) * 0.25;

      const response: 0 | 1 = rng() < sigmoid(logit) ? 1 : 0;
      const confidence = clamp(
        candidate.calibration * (response ? 0.82 : 0.25) +
          (1 - candidate.calibration) * 0.5 +
          normal(rng) * 0.08,
        0,
        1,
      );
      const timeSeconds = clamp(
        55 +
          q.cognitiveDemand * 35 +
          (1 - candidate.timingEfficiency) * 65 +
          pressure * 30 +
          normal(rng) * 10,
        15,
        180,
      );
      const answerChanged =
        rng() < clamp(0.04 + (1 - candidate.decisionQuality) * 0.35, 0.02, 0.45);

      attempts.push({
        candidateId: candidate.id,
        questionId: q.id,
        position: position + 1,
        itemStatus: q.itemStatus,
        patientGroup: q.patientGroup,
        difficulty: q.difficulty,
        response,
        confidence,
        timeSeconds,
        answerChanged,
        thetaBefore: theta,
      });

      row[q.id] = response;

      /**
       * Transparent adaptive-state update.
       * This is only the simulator's latent process.
       */
      const learningNoise = normal(rng) * 0.015;
      theta = clamp(
        theta + (response ? 1 : -1) * 0.018 * q.discrimination + learningNoise,
        -3,
        3,
      );
    }

    matrix[candidate.id] = row;
    administeredQuestionIds[candidate.id] = [...administered];
  }

  return {
    seed,
    candidates,
    questions,
    attempts,
    matrix,
    administeredQuestionIds,
  };
}

export function responseMatrixToCSV(result: AMCResponseMatrix): string {
  const questionIds = result.questions.map(q => q.id);
  const header = ["candidate_id", ...questionIds].join(",");
  const rows = result.candidates.map(candidate => [
    candidate.id,
    ...questionIds.map(qid => {
      const value = result.matrix[candidate.id][qid];
      return value === null ? "" : String(value);
    }),
  ].join(","));
  return [header, ...rows].join("\n");
}
