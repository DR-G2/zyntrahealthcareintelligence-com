import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Landing from "@/pages/Landing";

const renderLanding = () => render(<MemoryRouter><Landing /></MemoryRouter>);

describe("Landing readiness check (P5: PIE diagnostic only)", () => {
  it("sends anonymous visitors to log in, then to the PIE diagnostic", () => {
    auth.user = null;
    renderLanding();
    expect(screen.getByRole("link", { name: /log in to start the diagnostic/i })).toHaveAttribute("href", "/login?next=%2Fassess");
  });

  it("sends signed-in learners straight to /assess", () => {
    auth.user = { id: "u1" };
    renderLanding();
    expect(screen.getByRole("link", { name: /start the diagnostic/i })).toHaveAttribute("href", "/assess");
  });

  it("no longer calls the legacy diagnostic RPCs", () => {
    const src = readFileSync(resolve(__dirname, "../pages/Landing.tsx"), "utf8");
    expect(src).not.toMatch(/\.rpc\(|get_diagnostic_question\(|submit_diagnostic_answer\(|supabase/);
  });
});
