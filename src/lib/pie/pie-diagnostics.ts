/**
 * PIE hard-failure diagnostics.
 *
 * Ruling (P1/P2): there is no silent legacy fallback. When a PIE/V2 step fails, the
 * failure is surfaced as an explicit, observable diagnostic (structured console error,
 * a `pie:diagnostic` window event for telemetry, and a user-visible message). Answer
 * persistence is never rolled back or re-routed to the legacy pipeline because of it.
 */
import type { PieDiagnostic, PieSyncResult } from "./pie-state";

export type PieFailureCode =
  | "PIE_V2_SESSION_MISSING"
  | "PIE_V2_RESUME_FAILED"
  | "PIE_STATE_SYNC_FAILED";

export interface PieFailure {
  code: PieFailureCode;
  stage: string;
  message: string;
  detail?: string | null;
  at: string;
}

export class PieDiagnosticError extends Error {
  readonly failure: PieFailure;
  constructor(code: PieFailureCode, stage: string, message: string, detail?: string | null) {
    super(`[${code}] ${message}`);
    this.name = "PieDiagnosticError";
    this.failure = { code, stage, message, detail: detail ?? null, at: new Date().toISOString() };
  }
}

export function reportPieFailure(failure: PieFailure): PieFailure {
  console.error("[PIE_DIAGNOSTIC]", JSON.stringify(failure));
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent("pie:diagnostic", { detail: failure }));
  }
  return failure;
}

/** A session recorded as V2 must resume as V2. Never downgrade it to a legacy session. */
export function requireV2SessionId(config: Record<string, unknown> | null | undefined): string {
  const id = config?.v2SessionId;
  if (typeof id !== "string" || id.length === 0) {
    throw new PieDiagnosticError(
      "PIE_V2_SESSION_MISSING",
      "resume",
      "This session was started on the V2 engine but its V2 session id is missing. It cannot be resumed on the legacy pipeline.",
    );
  }
  return id;
}

/** Converts a post-attempt PIE sync result into a reported failure (or null when ok). */
export function pieSyncFailure(result: PieSyncResult): PieFailure | null {
  if (!("diagnostic" in result)) return null;
  const d: PieDiagnostic = result.diagnostic;
  return reportPieFailure({
    code: "PIE_STATE_SYNC_FAILED",
    stage: d.stage,
    message: d.message,
    detail: [d.code, d.details, d.hint].filter(Boolean).join(" | ") || null,
    at: new Date().toISOString(),
  });
}

export function describePieFailure(f: PieFailure): { title: string; description: string } {
  return {
    title: `Performance engine error (${f.code})`,
    description: `${f.message} Your answers are saved. Stage: ${f.stage}.`,
  };
}
