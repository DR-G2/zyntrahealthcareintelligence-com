import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGate } from "@/components/AdminGate";

const { mockUseAuth, mockRpc } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: mockUseAuth }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: mockRpc } }));
vi.mock("@/lib/admin-emails", () => ({ ADMIN_EMAILS: ["admin@example.test"] }));

function renderGate(email: string | undefined) {
  mockUseAuth.mockReturnValue({ user: email ? { email } : null });
  return render(
    <MemoryRouter initialEntries={["/v2-auth-diagnostic"]}>
      <Routes>
        <Route path="/v2-auth-diagnostic" element={<AdminGate><div>Protected diagnostic</div></AdminGate>} />
        <Route path="/practice" element={<div>Practice destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders protected content only after the server confirms an allowlisted admin", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    renderGate("admin@example.test");
    expect(await screen.findByText("Protected diagnostic")).toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith("is_admin", { _email: "admin@example.test" });
  });

  it("redirects an ordinary candidate without rendering protected content", async () => {
    renderGate("candidate-a@example.test");
    expect(await screen.findByText("Practice destination")).toBeInTheDocument();
    expect(screen.queryByText("Protected diagnostic")).not.toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails closed when the server admin check errors", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("denied") });
    renderGate("admin@example.test");
    await waitFor(() => expect(screen.getByText("Practice destination")).toBeInTheDocument());
    expect(screen.queryByText("Protected diagnostic")).not.toBeInTheDocument();
  });

  it("redirects a signed-out visitor without rendering protected content", async () => {
    renderGate(undefined);
    expect(await screen.findByText("Practice destination")).toBeInTheDocument();
    expect(screen.queryByText("Protected diagnostic")).not.toBeInTheDocument();
  });
});
