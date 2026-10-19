import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadMock } = vi.hoisted(() => ({ loadMock: vi.fn() }));

vi.mock("@/lib/pie/intelligence-evidence", () => ({ loadIntelligenceEvidence: loadMock }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "candidate-1" } }) }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/intelligence/ReadinessPrism", () => ({ ReadinessPrism: () => <div>Performance pane</div> }));
vi.mock("./BehaviorProfile", () => ({ default: () => <div>Behaviour pane</div> }));
vi.mock("./TrustYourGut", () => ({ default: () => <div>Trust Your Gut pane</div> }));

import PerformanceIntelligence from "./PerformanceIntelligenceV2";

describe("Performance Intelligence tab accessibility", () => {
  beforeEach(() => {
    loadMock.mockReset();
    loadMock.mockResolvedValue(null);
  });

  it("keeps every tab's aria-controls target in the document", async () => {
    render(
      <MemoryRouter initialEntries={["/intelligence"]}>
        <PerformanceIntelligence />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadMock).toHaveBeenCalled());
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      const controlledId = tab.getAttribute("aria-controls");
      expect(controlledId).toBeTruthy();
      expect(document.getElementById(controlledId!)).not.toBeNull();
      expect(document.getElementById(controlledId!)?.getAttribute("aria-labelledby")).toBe(tab.id);
    }
  });
});
