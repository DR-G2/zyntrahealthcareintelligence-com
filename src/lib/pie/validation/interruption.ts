import { clamp01, seededRng, normal, sigmoid } from "./synthetic";
import { mean } from "./metrics";

export type InterruptionKind =
  | "TAB_HIDDEN"
  | "WINDOW_BLURRED"
  | "SESSION_PAUSED"
  | "PAGE_REFRESHED"
  | "NETWORK_OFFLINE";

export type TelemetryConsistency = "VALID" | "SUSPICIOUS" | "CONTRADICTORY" | "UNUSABLE";

export interface InterruptionEvent {
  position: number;
  kind: InterruptionKind;
  duration: number;
  consistency: TelemetryConsistency;
}

export interface InterruptionObservation {
  position: number;
  trueCapability: number;
  outcome: boolean;
  interruption: InterruptionEvent | null;
}

export interface InterruptionValidationResult {
  kind: InterruptionKind;
  performanceBefore: number;
  performanceDuring: number;
  performanceAfter: number;
  observedChangeAfterInterruption: number;
  controlChangeAfterInterruption: number;
  telemetryContaminationDelta: number;
  correctlyIgnoredAsCause: boolean;
  observations: number;
}

const INTERRUPTION_KINDS: InterruptionKind[] = [
  "TAB_HIDDEN",
  "WINDOW_BLURRED",
  "SESSION_PAUSED",
  "PAGE_REFRESHED",
  "NETWORK_OFFLINE",
];

export function generateInterruptionScenario(
  seed: number,
  kind: InterruptionKind,
  length = 60,
): InterruptionObservation[] {
  const rng = seededRng(seed);
  const baseCapability = clamp01(0.68 + normal(rng) * 0.04);
  const interruptionStart = Math.floor(length * 0.45);
  const interruptionEnd = interruptionStart + 4;
  const observations: InterruptionObservation[] = [];

  for (let position = 0; position < length; position += 1) {
    const inInterruption = position >= interruptionStart && position < interruptionEnd;
    const trueCapability = baseCapability;
    const probability = clamp01(sigmoid((trueCapability - 0.5) * 4));
    observations.push({
      position,
      trueCapability,
      outcome: rng() < probability,
      interruption: inInterruption
        ? {
            position,
            kind,
            duration: kind === "PAGE_REFRESHED" ? 1 : 10 + Math.floor(rng() * 90),
            consistency: "VALID",
          }
        : null,
    });
  }

  return observations;
}

function rate(points: InterruptionObservation[]): number {
  return mean(points.map(point => Number(point.outcome)));
}

function classifyTelemetry(event: InterruptionEvent | null): TelemetryConsistency {
  if (!event) return "VALID";
  if (event.duration < 0) return "CONTRADICTORY";
  if (!Number.isFinite(event.duration)) return "UNUSABLE";
  if (event.kind === "PAGE_REFRESHED" && event.duration > 5) return "SUSPICIOUS";
  return event.consistency;
}

export function validateInterruptionScenario(
  observations: InterruptionObservation[],
): InterruptionValidationResult {
  const interruption = observations.find(point => point.interruption !== null)?.interruption ?? null;
  if (!interruption) {
    throw new Error("Interruption scenario requires an interruption event.");
  }

  const start = interruption.position;
  const before = observations.filter(point => point.position >= start - 10 && point.position < start);
  const during = observations.filter(point => point.position >= start && point.position < start + 4);
  const after = observations.filter(point => point.position >= start + 4 && point.position < start + 14);
  const control = observations.filter(point => point.position >= start + 14 && point.position < start + 24);

  const performanceBefore = rate(before);
  const performanceDuring = rate(during);
  const performanceAfter = rate(after);
  const controlChangeAfterInterruption = rate(control) - performanceBefore;
  const observedChangeAfterInterruption = performanceAfter - performanceBefore;

  const telemetryContaminationDelta = Math.abs(observedChangeAfterInterruption - controlChangeAfterInterruption);
  const correctlyIgnoredAsCause =
    classifyTelemetry(interruption) === "VALID" &&
    telemetryContaminationDelta <= 0.35;

  return {
    kind: interruption.kind,
    performanceBefore,
    performanceDuring,
    performanceAfter,
    observedChangeAfterInterruption,
    controlChangeAfterInterruption,
    telemetryContaminationDelta,
    correctlyIgnoredAsCause,
    observations: observations.length,
  };
}

export function runInterruptionValidation(
  seeds: number[] = [101, 202, 303, 404, 505],
): InterruptionValidationResult[] {
  return seeds.flatMap(seed =>
    INTERRUPTION_KINDS.map(kind =>
      validateInterruptionScenario(generateInterruptionScenario(seed, kind)),
    ),
  );
}
