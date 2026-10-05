import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent, within } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useSiteSettings", () => ({ useShowAboutPricing: () => ({ show: true, loading: false }) }));

const makeQuestion = (index: number) => ({
  id: `diagnostic-q-${index}`,
  question_text: `Diagnostic question ${index}`,
  options: ["Option A", "Option B", "Option C", "Option D"],
  category: "Adult Medicine",
  difficulty: "moderate",
  difficulty_tier: 2,
});

let currentQuestion = 1;

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_diagnostic_question") {
        currentQuestion = 1;
        return { data: makeQuestion(1), error: null };
      }

      if (name === "submit_diagnostic_answer") {
        const position = Number(args.p_question_position);
        if (position === 6) {
          return { data: { is_correct: true, final: true }, error: null };
        }
        currentQuestion = position + 1;
        return {
          data: { is_correct: true, final: false, next_question: makeQuestion(currentQuestion) },
          error: null,
        };
      }

      return { data: null, error: new Error("unexpected_rpc") };
    }),
  },
}));

import Landing from "@/pages/Landing";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
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

describe("Landing diagnostic", () => {
  it("loads the first diagnostic question", async () => {
    renderLanding();
    expect(await screen.findByText("Question 1 of 6")).toBeInTheDocument();
    expect(screen.getByText("Diagnostic question 1")).toBeInTheDocument();
  });

  it("progresses through all six questions", async () => {
    const { container } = renderLanding();
    const main = container.querySelector("main") as HTMLElement;

    for (let i = 1; i <= 6; i++) {
      expect(await within(main).findByText(`Question ${i} of 6`)).toBeInTheDocument();
      const option = within(main).getByRole("button", { name: /Option A/i });
      fireEvent.click(option);
      fireEvent.click(within(main).getByRole("button", { name: i === 6 ? /Submit/i : /Next/i }));
    }

    expect(await within(main).findByText("Diagnostic score")).toBeInTheDocument();
    expect(within(main).getByRole("link", { name: /log in to see performance intelligence/i }))
      .toHaveAttribute("href", "/login?next=%2Fintelligence");
  });

  it("keeps the six-question contract visible", async () => {
    renderLanding();
    expect(await screen.findByText("Question 1 of 6")).toBeInTheDocument();
    expect(screen.getByText("100%")).not.toBeInTheDocument();
  });
});
