import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LegacyRedirect } from "./LegacyRedirect";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

const aliases = [
  ["/check", "/login"],
  ["/amc-part-1-mcq", "/blog/amc-part-1-mcq"],
  ["/review", "/practice"],
  ["/assess", "/practice"],
  ["/questions/osce", "/practice/osce"],
  ["/assess/osce", "/practice/osce"],
  ["/stations", "/practice/osce"],
  ["/osce-in-surgery", "/practice/osce"],
  ["/amc-clinical-osce", "/practice/osce"],
  ["/companion/groups", "/practice"],
  ["/companion/shared-tests", "/practice"],
  ["/notifications", "/inbox"],
] as const;

describe("LegacyRedirect", () => {
  it.each(aliases)("preserves search and hash from %s to %s", async (from, to) => {
    render(
      <MemoryRouter initialEntries={[`${from}?source=legacy&attempt=42#resume`]}>
        <Routes>
          <Route path={from} element={<LegacyRedirect to={to} />} />
          <Route path={to} element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("location")).toHaveTextContent(`${to}?source=legacy&attempt=42#resume`);
  });

  it.each([
    ["/profile", "performance"],
    ["/behavior", "behavior"],
    ["/trust-your-gut", "trust-your-gut"],
  ] as const)("merges existing query with the target tab for %s", async (from, tab) => {
    render(
      <MemoryRouter initialEntries={[`${from}?source=legacy&tab=old#details`]}>
        <Routes>
          <Route path={from} element={<LegacyRedirect to="/intelligence" tab={tab} />} />
          <Route path="/intelligence" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("location")).toHaveTextContent(`/intelligence?source=legacy&tab=${tab}#details`);
  });

  it("preserves the settings alias behavior", async () => {
    render(
      <MemoryRouter initialEntries={["/settings?tab=billing&return=checkout#billing"]}>
        <Routes>
          <Route path="/settings" element={<LegacyRedirect to="/account" />} />
          <Route path="/account" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("location")).toHaveTextContent("/account?tab=billing&return=checkout#billing");
  });
});
