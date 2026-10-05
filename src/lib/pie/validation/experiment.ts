import { SyntheticDataset, SyntheticObservation, makeDataset, clamp01 } from "./synthetic";
import { brierScore, mean } from "./metrics";

export type ValidationModel = "A_accuracy" | "B_difficulty" | "C_time" | "D_confidence" | "E_behavior" | "F_temporal";

export interface OutOfSampleModelResult { model: ValidationModel; brier: number; logLoss: number; testCount: number; }
export interface SeedExperimentResult { seed: number; models: OutOfSampleModelResult[]; trainCount: number; testCount: number; }
export interface RepeatedExperimentResult {
  seeds: SeedExperimentResult[];
  summary: Array<{ model: ValidationModel; meanBrier: number; meanLogLoss: number; totalTestCount: number; }>;
}

const EPS = 1e-6;

function logLoss(probabilities: number[], outcomes: number[]): number {
  if (!probabilities.length || probabilities.length !== outcomes.length) return Infinity;
  return mean(probabilities.map((p, i) => {
    const q = Math.max(EPS, Math.min(1 - EPS, p));
    return -(outcomes[i] * Math.log(q) + (1 - outcomes[i]) * Math.log(1 - q));
  }));
}

function splitByTime(observations: SyntheticObservation[], trainFraction = 0.7) {
  const ordered = [...observations].sort((a, b) => a.position - b.position);
  const cut = Math.max(1, Math.min(ordered.length - 1, Math.floor(ordered.length * trainFraction)));
  return { train: ordered.slice(0, cut), test: ordered.slice(cut) };
}

function meanOutcome(observations: SyntheticObservation[]): number {
  const valid = observations.filter(o => !o.missing);
  return valid.length ? mean(valid.map(o => Number(o.outcome))) : 0.5;
}

function featureVector(model: ValidationModel, o: SyntheticObservation): number[] {
  switch (model) {
    case "B_difficulty": return [1, o.difficulty];
    case "C_time": return [1, o.difficulty, o.timePressure];
    case "D_confidence": return [1, o.difficulty, o.timePressure, o.confidence];
    case "E_behavior": return [1, o.difficulty, o.timePressure, o.confidence, Number(o.answerChanged)];
    case "F_temporal": return [1, o.difficulty, o.timePressure, o.confidence, Number(o.answerChanged), o.position];
    default: return [1];
  }
}

function fitLogistic(model: ValidationModel, observations: SyntheticObservation[]) {
  const valid = observations.filter(o => !o.missing);
  if (!valid.length || model === "A_accuracy") {
    const p = meanOutcome(valid);
    return () => p;
  }

  const dimension = featureVector(model, valid[0]).length;
  const weights = Array.from({ length: dimension }, () => 0);
  const learningRate = 0.08;

  for (let epoch = 0; epoch < 700; epoch += 1) {
    const gradient = Array.from({ length: dimension }, () => 0);
    for (const o of valid) {
      const x = featureVector(model, o);
      const z = x.reduce((sum, value, i) => sum + value * weights[i], 0);
      const p = 1 / (1 + Math.exp(-z));
      const error = p - Number(o.outcome);
      for (let i = 0; i < dimension; i += 1) gradient[i] += error * x[i];
    }
    for (let i = 0; i < dimension; i += 1) weights[i] -= learningRate * gradient[i] / valid.length;
  }

  return (o: SyntheticObservation) => {
    const x = featureVector(model, o);
    const z = x.reduce((sum, value, i) => sum + value * weights[i], 0);
    return clamp01(1 / (1 + Math.exp(-z)));
  };
}

function fitTemporalPredictor(train: SyntheticObservation[]) {
  const staticPredictor = fitLogistic("E_behavior", train);
  let ewma = meanOutcome(train);
  const validCount = train.filter(o => !o.missing).length;
  const alpha = validCount >= 5 ? 2 / (validCount + 1) : 0.2;

  return (test: SyntheticObservation[]) => {
    const predictions: number[] = [];
    for (const o of test) {
      const base = staticPredictor(o);
      predictions.push(clamp01(0.7 * base + 0.3 * ewma));
      if (!o.missing) ewma = alpha * Number(o.outcome) + (1 - alpha) * ewma;
    }
    return predictions;
  };
}

export function runSeedExperiment(seed: number, candidateCount = 30, questionCount = 100, attemptsPerCandidate = 60): SeedExperimentResult {
  const dataset: SyntheticDataset = makeDataset(seed, candidateCount, questionCount, attemptsPerCandidate);
  const grouped = new Map<string, SyntheticObservation[]>();

  for (const observation of dataset.observations) {
    const list = grouped.get(observation.candidateId) ?? [];
    list.push(observation);
    grouped.set(observation.candidateId, list);
  }

  const models: ValidationModel[] = ["A_accuracy", "B_difficulty", "C_time", "D_confidence", "E_behavior", "F_temporal"];
  const scored: Record<ValidationModel, { probabilities: number[]; outcomes: number[] }> = {
    A_accuracy: { probabilities: [], outcomes: [] }, B_difficulty: { probabilities: [], outcomes: [] },
    C_time: { probabilities: [], outcomes: [] }, D_confidence: { probabilities: [], outcomes: [] },
    E_behavior: { probabilities: [], outcomes: [] }, F_temporal: { probabilities: [], outcomes: [] },
  };

  for (const observations of grouped.values()) {
    const split = splitByTime(observations);
    for (const model of models.filter(m => m !== "F_temporal")) {
      const predict = fitLogistic(model, split.train);
      for (const o of split.test) {
        if (o.missing) continue;
        scored[model].probabilities.push(predict(o));
        scored[model].outcomes.push(Number(o.outcome));
      }
    }

    const temporalProbabilities = fitTemporalPredictor(split.train)(split.test);
    split.test.forEach((o, i) => {
      if (o.missing) return;
      scored.F_temporal.probabilities.push(temporalProbabilities[i]);
      scored.F_temporal.outcomes.push(Number(o.outcome));
    });
  }

  return {
    seed,
    trainCount: Math.floor(candidateCount * attemptsPerCandidate * 0.7),
    testCount: Math.ceil(candidateCount * attemptsPerCandidate * 0.3),
    models: models.map(model => ({
      model,
      brier: brierScore(scored[model].probabilities, scored[model].outcomes),
      logLoss: logLoss(scored[model].probabilities, scored[model].outcomes),
      testCount: scored[model].outcomes.length,
    })),
  };
}

export function runRepeatedOutOfSample(seeds: number[] = [101, 202, 303, 404, 505]): RepeatedExperimentResult {
  const results = seeds.map(seed => runSeedExperiment(seed));
  const modelNames: ValidationModel[] = ["A_accuracy", "B_difficulty", "C_time", "D_confidence", "E_behavior", "F_temporal"];
  return {
    seeds: results,
    summary: modelNames.map(model => {
      const rows = results.map(r => r.models.find(m => m.model === model)!);
      return {
        model,
        meanBrier: mean(rows.map(r => r.brier)),
        meanLogLoss: mean(rows.map(r => r.logLoss)),
        totalTestCount: rows.reduce((sum, r) => sum + r.testCount, 0),
      };
    }),
  };
}
