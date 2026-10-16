import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  user: { email: "candidate-a@example.test" as string | null },
  rpc: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));
vi.mock("@/lib/admin-emails", () => ({
  ADMIN_EMAILS: ["admin-test@example.test"],
}));

import { AdminGate } from "./AdminGate";

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route path="/protected" element={<AdminGate><div data-testid="secret">Admin-only content</div></AdminGate>} />
        <Route path="/practice" element={<div data-testid="candidate-destination">Practice</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminGate", () => {
  beforeEach(() => {
    mocks.user.email = "candidate-a@example.test";
    mocks.rpc.mockReset();
  });
  afterEach(() => cleanup());

  it("denies an ordinary candidate without querying admin status or revealing children", async () => {
    renderGate();
    expect(await screen.findByTestId("candidate-destination")).toBeInTheDocument();
    expect(screen.queryByTestId("secret")).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("renders children only after the server confirms an allowlisted admin", async () => {
    mocks.user.email = "admin-test@example.test";
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    renderGate();
    expect(await screen.findByTestId("secret")).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("is_admin", { _email: "admin-test@example.test" });
  });

  it("denies an allowlisted identity when the server check fails", async () => {
    mocks.user.email = "admin-test@example.test";
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    renderGate();
    await waitFor(() => expect(screen.getByTestId("candidate-destination")).toBeInTheDocument());
    expect(screen.queryByTestId("secret")).not.toBeInTheDocument();
  });
});
