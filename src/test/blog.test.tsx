import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Blog from "@/pages/Blog";
import { articles, articleBody, articleReadTime } from "@/data/blogPosts";
import BlogArticle from "@/pages/BlogArticle";
import { articleWordCount, countWords, formatIsoDate, parseInlineLinks, readTimeLabel, toPlainText } from "@/lib/blogText";

const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogArticle />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

const publishedText = (slug: string) => {
  const body = articleBody[slug];
  const meta = articles.find((a) => a.slug === slug)!;
  return [meta.title, meta.excerpt, body.intro, ...body.sections.flatMap((s) => [s.title, toPlainText(s.body)])].join("\n");
};

describe("blog text helpers", () => {
  it("parses inline markdown links", () => {
    expect(parseInlineLinks("See [the page](/blog/x) now.")).toEqual([
      { type: "text", text: "See " },
      { type: "link", text: "the page", href: "/blog/x" },
      { type: "text", text: " now." },
    ]);
    expect(toPlainText("a [b c](https://x.y/z) d")).toBe("a b c d");
    expect(countWords("a [b c](https://x.y/z) d")).toBe(4);
  });

  it("computes read time from word count", () => {
    expect(readTimeLabel(0)).toBe("1 min read");
    expect(readTimeLabel(200)).toBe("1 min read");
    expect(readTimeLabel(201)).toBe("2 min read");
  });

  it("formats ISO dates without timezone drift", () => {
    expect(formatIsoDate("2026-10-03")).toBe("3 Oct 2026");
  });
});

describe("published blog content", () => {
  it("every listed article has a body, real dates and a computed read time", () => {
    for (const a of articles) {
      const body = articleBody[a.slug];
      expect(body, a.slug).toBeDefined();
      expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(articleReadTime(a.slug)).toBe(readTimeLabel(articleWordCount(body)));
    }
  });

  it("meta descriptions are unique and within length", () => {
    const excerpts = articles.map((a) => a.excerpt);
    expect(new Set(excerpts).size).toBe(excerpts.length);
    for (const e of excerpts) expect(e.length).toBeLessThanOrEqual(160);
  });

  it("does not use answer-changing framing, pass claims or identifying details", () => {
    for (const a of articles) {
      const text = publishedText(a.slug);
      expect(text, a.slug).not.toMatch(/changing answers unnecessarily|changed? (a |the )?correct answer|go back and review/i);
      expect(text, a.slug).not.toMatch(/Ehrmantraut|heisenberg|321|Sydney|PGY ?1|AMC[- ]approved|guarantee/i);
    }
  });

  it("drops the hidden-cost draft", () => {
    expect(articleBody["hidden-cost-of-changing-a-correct-answer"]).toBeUndefined();
  });
});

describe("blog pages render", () => {
  it("article shows brand byline, dates, read time and affiliation line", () => {
    renderAt("/blog/amc-part-1-mcq");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("AMC MCQ Preparation: Train for the One-Way Exam");
    expect(screen.getByText("By Zyntra Healthcare Intelligence")).toBeInTheDocument();
    expect(screen.queryByText(/Ehrmantraut/)).toBeNull();
    expect(screen.getByText(/Published/).textContent).toContain("3 Oct 2026");
    expect(screen.getByText(articleReadTime("amc-part-1-mcq"))).toBeInTheDocument();
    expect(screen.getAllByText(/not affiliated with the Australian Medical Council/).length).toBeGreaterThan(0);
    const related = screen.getByRole("link", { name: /AMC clinical exam tips/i });
    expect(related.getAttribute("href")).toBe("/blog/amc-part-2-osce");
  });

  it("second post renders", () => {
    renderAt("/blog/amc-part-2-osce");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("AMC Clinical Exam Tips: Train for the 8-Minute Clock");
  });

  it("index lists only live posts with computed read times", () => {
    renderAt("/blog");
    expect(screen.getAllByText(articleReadTime("amc-part-2-osce")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/8 min read|9 min read/)).toBeNull();
  });
});
