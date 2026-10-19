import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { featureAvailability } from "./featureAvailability";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public claim and availability contract", () => {
  it("keeps public feature statuses aligned with the release contract", () => {
    expect(featureAvailability.mcqPractice.status).toBe("Live");
    expect(featureAvailability.performanceIntelligence.status).toBe("Live");
    expect(featureAvailability.behaviour.status).toBe("Beta");
    expect(featureAvailability.confidence.status).toBe("Beta");
    expect(featureAvailability.interventions.status).toBe("Beta");
    expect(featureAvailability.oscePractice.status).toBe("Coming soon");
  });

  it("uses the connected .app domain for public canonical, social and sitemap URLs", () => {
    const html = read("index.html");
    const seo = read("src/components/SEO.tsx");
    const landingSeo = read("src/components/public/SeoLandingPage.tsx");
    const sitemap = read("public/sitemap.xml");
    const robots = read("public/robots.txt");
    const blog = read("src/pages/Blog.tsx");
    const blogArticle = read("src/pages/BlogArticle.tsx");
    const osce = read("src/pages/AmcClinicalOsce.tsx");
    const mcq = read("src/pages/AmcPart1Mcq.tsx");

    expect(html).toContain('<link rel="canonical" href="https://zyntrahealthcareintelligence.app/"');
    expect(html).toContain('property="og:image" content="https://zyntrahealthcareintelligence.app/og.png"');
    expect(html).not.toContain("https://www.zyntrahealthcareintelligence.com");
    expect(seo).toContain("https://zyntrahealthcareintelligence.app");
    expect(landingSeo).toContain("https://zyntrahealthcareintelligence.app");
    expect(sitemap).toContain("<loc>https://zyntrahealthcareintelligence.app/</loc>");
    expect(sitemap).not.toContain("zyntrahealthcareintelligence.com");
    expect(robots).toContain("Sitemap: https://zyntrahealthcareintelligence.app/sitemap.xml");
    expect(blog).toContain("https://zyntrahealthcareintelligence.app/blog");
    expect(blogArticle).toContain("https://zyntrahealthcareintelligence.app");
    expect(osce).toContain("https://zyntrahealthcareintelligence.app/amc-clinical-osce");
    expect(mcq).toContain("https://zyntrahealthcareintelligence.app/amc-part-1-mcq");
  });

  it("does not promise a readiness score or live diagnostic on public entry points", () => {
    const home = read("src/pages/Home.tsx");
    const app = read("src/App.tsx");
    const html = read("index.html");
    const examGuide = read("src/pages/AmcExamPreparation.tsx");
    const imgGuide = read("src/pages/AmcPreparationForImgs.tsx");
    const blogPosts = read("src/data/blogPosts.ts");
    const osceGuide = read("src/pages/AmcClinicalOsce.tsx");
    const trustYourGut = read("src/pages/TrustYourGut.tsx");
    const faq = read("src/pages/FAQ.tsx");

    expect(home).not.toContain("to <em>Readiness.</em>");
    expect(home).not.toContain("increased hesitation under time pressure");
    expect(home).toContain("This is an example, not a live PIE recommendation.");
    expect(app).not.toContain("build a clearer picture of your exam readiness");
    expect(html).not.toContain("AMC Exam Preparation That Learns How You Think");
    expect(html).toContain("AMC Exam Preparation with Evidence-Led Practice");
    expect(examGuide).not.toContain("training readiness estimates");
    expect(imgGuide).toContain("Confidence-related signals appear only where enabled.");
    expect(blogPosts).not.toContain("[free AMC readiness check](/check)");
    expect(blogPosts).toContain("[AMC MCQ preparation guide](/amc-part-1-mcq)");
    expect(osceGuide).toContain("Interactive Zyntra");
    expect(osceGuide).toContain("not available in the current public release");
    expect(osceGuide).not.toContain("/stations?demo=true");
    expect(osceGuide).not.toContain("being rebuilt");
    expect(osceGuide).not.toContain("staged rollout");
    expect(trustYourGut).toContain("Review first and final answers and recorded change outcomes");
    expect(trustYourGut).not.toContain("reduce harmful answer changes");
    expect(faq).toContain("{featureAvailability.flashcards.name} are marked");
  });
});
