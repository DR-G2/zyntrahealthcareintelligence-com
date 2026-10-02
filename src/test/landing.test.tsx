import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent, within } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useSiteSettings", () => ({ useShowAboutPricing: () => ({ show: true, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: async () => ({ error: null }) }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

import Landing from "@/pages/Landing";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
});

const renderLanding = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </HelmetProvider>
  );

describe("Landing (combined homepage)", () => {
  it("renders every section in order", () => {
    const { container } = renderLanding();
    const order = ["hero-title", "diagnostic", "appe-title", "how-title", "faq-title", "contact-title"];
    const nodes = order.map(id => container.querySelector(`#${id}`));
    nodes.forEach(n => expect(n).not.toBeNull());
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i - 1]!.compareDocumentPosition(nodes[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByText("Six questions. A surprisingly useful mirror.")).toBeInTheDocument();
    expect(container.querySelector("footer")).not.toBeNull();
  });

  it("has the three hero actions", () => {
    renderLanding();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /demo station/i })).toHaveAttribute("href", "/stations?demo=true");
    const check = screen.getByRole("link", { name: /take the 6-question check/i });
    expect(check).toHaveAttribute("href", "#diagnostic");
    fireEvent.click(check);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("completes the diagnostic and resets cleanly", () => {
    const { container } = renderLanding();
    const diag = container.querySelector("#diagnostic") as HTMLElement;
    fireEvent.click(within(diag).getByRole("button", { name: /start without logging in/i }));
    for (let i = 1; i <= 6; i++) {
      expect(within(diag).getByText(`Question ${i} of 6`)).toBeInTheDocument();
      const option = within(diag).getAllByRole("button").find(b => /^A/.test(b.textContent || ""))!;
      fireEvent.click(option);
      fireEvent.click(within(diag).getByRole("button", { name: "Reasonably sure" }));
      fireEvent.click(within(diag).getByRole("button", { name: /lock answer|see my limited evaluation/i }));
    }
    expect(within(diag).getByText("Your first signal is in.")).toBeInTheDocument();
    fireEvent.click(within(diag).getAllByRole("button", { name: /run it again/i })[0]);
    expect(within(diag).getByText("Question 1 of 6")).toBeInTheDocument();
  });

  it("uses current pricing and avoids retired or risky claims", () => {
    const { container } = renderLanding();
    let text = container.textContent || "";
    // FAQ answers only mount when their accordion item is open
    for (const trigger of within(container.querySelector("#faq") as HTMLElement).getAllByRole("button")) {
      fireEvent.click(trigger);
      text += " " + (container.querySelector("#faq")?.textContent || "");
    }
    for (const p of ["$39/month", "$100 for 3 months", "$59/month", "$159 for 3 months", "$349", "first 100 users", "available under the applicable commercial terms"]) {
      expect(text).toContain(p);
    }
    for (const bad of [/full access/i, /osce[ -]?only/i, /paypal/i, /AMC[- ]approved/i, /pass rate/i, /docdoc/i, /cannabis/i]) {
      expect(text).not.toMatch(bad);
    }
    expect(text).toMatch(/not affiliated with or endorsed by the Australian Medical Council/);
    expect(text).toContain("heisenberg@zyntrahealthcareintelligence.com");
  });
});
