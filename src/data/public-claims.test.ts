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

  it("does not promise a readiness score or live diagnostic on public entry points", () => {
    const home = read("src/pages/Home.tsx");
    const app = read("src/App.tsx");
    const html = read("index.html");
    const examGuide = read("src/pages/AmcExamPreparation.tsx");
    const imgGuide = read("src/pages/AmcPreparationForImgs.tsx");
    const blogPosts = read("src/data/blogPosts.ts");
    const osceGuide = read("src/pages/AmcClinicalOsce.tsx");
    const trustYourGut = read("src/pages/TrustYourGut.tsx");

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
    expect(trustYourGut).toContain("Review first and final answers and recorded change outcomes");
    expect(trustYourGut).not.toContain("reduce harmful answer changes");
  });
});
