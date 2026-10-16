import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LegacyRedirect } from "@/components/LegacyRedirect";

function Destination() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

function renderRedirect(from: string, to: string, tab?: string) {
  return render(
    <MemoryRouter initialEntries={[from]}>
      <Routes>
        <Route path={from.split("?")[0].split("#")[0]} element={<LegacyRedirect to={to} tab={tab} />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LegacyRedirect", () => {
  it("preserves the query string and hash for ordinary legacy aliases", () => {
    renderRedirect("/review?source=bookmark&page=2#answer", "/practice");
    expect(screen.getByTestId("location")).toHaveTextContent("/practice?source=bookmark&page=2#answer");
  });

  it("merges the target tab while preserving other query parameters and hash", () => {
    renderRedirect("/profile?source=old&tab=legacy&filter=recent#confidence", "/intelligence", "performance");
    expect(screen.getByTestId("location")).toHaveTextContent("/intelligence?source=old&tab=performance&filter=recent#confidence");
  });

  it("adds a target tab when the original URL has no query", () => {
    renderRedirect("/behavior#top", "/intelligence", "behavior");
    expect(screen.getByTestId("location")).toHaveTextContent("/intelligence?tab=behavior#top");
  });
});
