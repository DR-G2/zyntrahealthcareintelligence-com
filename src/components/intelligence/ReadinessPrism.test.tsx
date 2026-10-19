import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReadinessPrism } from "./ReadinessPrism";
import type { IntelligenceEvidence } from "@/lib/pie/intelligence-evidence";

function fixture(overrides: Partial<IntelligenceEvidence> = {}): IntelligenceEvidence {
  return {
    pie: { status: "ready", value: {
      dimensions: { capability: 0.8, decision: 0.7, timing: null, calibration: 0.6, sustained_performance: 0.75, learning: 0.5 },
      dimensionEvidence: {
        capability: { uncertainty: null, lower: null, upper: null, evidenceCount: 8, evidenceQuality: 0.8 },
        decision: { uncertainty: null, lower: null, upper: null, evidenceCount: 8, evidenceQuality: 0.8 },
        timing: { uncertainty: null, lower: null, upper: null, evidenceCount: null, evidenceQuality: null },
        calibration: { uncertainty: null, lower: null, upper: null, evidenceCount: 8, evidenceQuality: 0.8 },
        sustained_performance: { uncertainty: null, lower: null, upper: null, evidenceCount: 8, evidenceQuality: 0.8 },
        learning: { uncertainty: null, lower: null, upper: null, evidenceCount: 8, evidenceQuality: 0.8 },
      },
      count: 8, level: "PRELIMINARY", timestamp: "2026-10-16T08:00:00Z", sufficient: true,
    } },
    history: { status: "ready", value: [
      { id: "a1", subjectId: "medicine", subject: "Medicine", correct: false, confidence: null, seconds: 40, changes: 1, at: "2026-10-16T07:00:00Z" },
    ] },
    stability: { status: "ready", value: { percent: 65, at: "2026-10-16T08:00:00Z" } },
    confidence: { status: "empty", value: null },
    action: { status: "empty", value: null },
    ...overrides,
  };
}

describe("Intelligence overview", () => {
  it("keeps unavailable dimensions missing and does not draw a misleading complete polygon", () => {
    render(<MemoryRouter><ReadinessPrism evidence={fixture()} loading={false} retry={() => {}} /></MemoryRouter>);
    expect(screen.getByText("No polygon drawn: one or more estimates are unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timing Unavailable" })).toBeInTheDocument();
  });

  it("does not expose shadow diagnostics in the candidate overview", () => {
    render(<MemoryRouter><ReadinessPrism evidence={fixture()} loading={false} retry={() => {}} /></MemoryRouter>);
    expect(screen.queryByText(/shadow diagnostics/i)).toBeNull();
    expect(screen.queryByText(/inference hash|state version|model hash/i)).toBeNull();
  });

  it("shows observed zero accuracy as zero but never invents an empty-history score", () => {
    const noAttempts = fixture({ history: { status: "ready", value: [] } });
    const { rerender } = render(<MemoryRouter><ReadinessPrism evidence={noAttempts} loading={false} retry={() => {}} /></MemoryRouter>);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    rerender(<MemoryRouter><ReadinessPrism evidence={fixture()} loading={false} retry={() => {}} /></MemoryRouter>);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("expands a subject using the actual returned attempt records", () => {
    render(<MemoryRouter><ReadinessPrism evidence={fixture()} loading={false} retry={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Medicine/ }));
    expect(screen.getByText("1 timed attempts")).toBeInTheDocument();
    expect(screen.getByText("Latest returned attempt")).toBeInTheDocument();
  });

  it("offers a generic practice route when no supported action projection exists", () => {
    render(<MemoryRouter><ReadinessPrism evidence={fixture()} loading={false} retry={() => {}} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Go to Practice/ })).toHaveAttribute("href", "/practice");
    expect(screen.getByText(/general practice route/i)).toBeInTheDocument();
  });
});
