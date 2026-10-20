import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReadinessPrism } from "./ReadinessPrism";
import type { Dimension, IntelligenceEvidence, ModeDimensionEvidence, PracticeMode, SafeAttempt, StateEvidence } from "@/lib/pie/intelligence-evidence";

const dims: Dimension[] = ["capability", "decision", "timing", "calibration", "sustained_performance", "learning"];
function modeDimensions(count: number): Record<Dimension, ModeDimensionEvidence> {
  return Object.fromEntries(dims.map(dimension => [dimension, {
    latestObservationAt: "2026-10-18T10:00:00Z", estimate: 0.8, uncertainty: 0.1, lower: 0.65, upper: 0.9,
    evidenceCount: count, evidenceQuality: 0.9, estimateAligned: true, calibrationReady: true,
  }])) as Record<Dimension, ModeDimensionEvidence>;
}
function attempt(id: string, mode: PracticeMode, index: number, correct = true): SafeAttempt {
  return { id, subjectId: "medicine", subject: "Medicine", correct, answerKeyAvailable: true, confidence: 3,
    seconds: 35, changes: index % 3 === 0 ? 1 : 0, at: new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString(), sessionMode: mode };
}
function fixture(options: { normalCount?: number; examCount?: number; nudgeCount?: number } = {}): IntelligenceEvidence {
  const normalCount = options.normalCount ?? 0, examCount = options.examCount ?? 0, nudgeCount = options.nudgeCount ?? 0;
  const state: StateEvidence = {
    dimensions: { capability: null, decision: null, timing: null, calibration: null, sustained_performance: null, learning: null },
    modeEvidence: { normal_mcq: modeDimensions(normalCount), amc_exam: modeDimensions(examCount), nudge: modeDimensions(nudgeCount) },
    count: normalCount + examCount + nudgeCount, level: "INSUFFICIENT", timestamp: "2026-10-18T10:00:00Z", sufficient: false,
  };
  const history: SafeAttempt[] = [
    ...Array.from({ length: normalCount }, (_, i) => attempt("normal-" + i, "normal_mcq", i, i % 4 !== 0)),
    ...Array.from({ length: examCount }, (_, i) => attempt("exam-" + i, "amc_exam", i, i % 3 !== 0)),
    ...Array.from({ length: nudgeCount }, (_, i) => attempt("nudge-" + i, "nudge", i, i % 2 === 0)),
  ];
  return {
    pie: { status: "ready", value: state }, history: { status: "ready", value: history },
    stability: { status: "empty", value: null }, confidence: { status: "empty", value: null }, action: { status: "empty", value: null },
  };
}
function mount(evidence: IntelligenceEvidence) {
  return render(<MemoryRouter><ReadinessPrism evidence={evidence} loading={false} retry={() => {}} /></MemoryRouter>);
}
describe("/intelligence target evidence gates", () => {
  it("account A: zero attempts never invents a score and shows each known zero count as Building", () => {
    mount(fixture());
    expect(screen.getAllByText("Building, 0 of 50").length).toBeGreaterThan(0);
    expect(screen.queryByText("80%")).toBeNull();
    expect(screen.getByText("Not enough evidence yet")).toBeInTheDocument();
    expect(screen.getByText("Not enough practice since the suggestion.")).toBeInTheDocument();
  });
  it("account B: 30 attempts stay below the 50-observation threshold", () => {
    mount(fixture({ normalCount: 30 }));
    expect(screen.getAllByText("Building, 30 of 50").length).toBeGreaterThan(0);
    expect(screen.queryByText("80%")).toBeNull();
    expect(screen.getByText("Recorded attempts in this mode: 30. Latest: Oct 1, 2026.")).toBeInTheDocument();
  });
  it("account C: 60 attempts in Normal MCQ do not unlock AMC Exam or Nudge", () => {
    mount(fixture({ normalCount: 60 }));
    expect(screen.getByText("Recorded attempts in this mode: 60. Latest: Oct 1, 2026.")).toBeInTheDocument();
    expect(screen.getAllByText("80%").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "AMC Exam mode" }));
    expect(screen.getByText("Recorded attempts in this mode: 0. Latest: Unavailable.")).toBeInTheDocument();
    expect(screen.getAllByText("Building, 0 of 50").length).toBeGreaterThan(0);
    expect(screen.queryByText("80%")).toBeNull();
  });
  it("account D: larger multi-mode history remains scoped to the selected mode", () => {
    mount(fixture({ normalCount: 60, examCount: 45, nudgeCount: 80 }));
    expect(screen.getByText("Recorded attempts in this mode: 60. Latest: Oct 1, 2026.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nudge" }));
    expect(screen.getByText("Recorded attempts in this mode: 80. Latest: Oct 1, 2026.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AMC Exam mode" }));
    expect(screen.getByText("Recorded attempts in this mode: 45. Latest: Oct 1, 2026.")).toBeInTheDocument();
  });
  it("keeps dimension cards collapsed by default and exposes the valid-observation progress", () => {
    mount(fixture({ normalCount: 30 }));
    expect(screen.getByRole("button", { name: /Capability/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("progressbar", { name: "Capability evidence progress" })).toHaveAttribute("aria-valuetext", "30 of 50 valid observations");
    fireEvent.click(screen.getByRole("button", { name: /Capability/ }));
    expect(screen.getByText("Uncertainty interval")).toBeInTheDocument();
  });
});
