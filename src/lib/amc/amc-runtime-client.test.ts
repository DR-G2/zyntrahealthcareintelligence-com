import { describe, expect, it } from "vitest";
import { parseAMCPluginSummary } from "./amc-runtime-client";

describe("AMC V2 runtime response contracts", () => {
  it("does not invent readiness for a development plugin", () => {
    const result = parseAMCPluginSummary({ plugin: "AMC", pluginVersion: "1.0.0", status: "draft", environmentCode: "AMC_CAT_MCQ", environmentVersion: "V8", environment: { items: 150 }, readiness: null, nextAction: null });
    expect(result.readiness).toBeNull();
    expect(result.status).toBe("draft");
  });
  it("rejects an invalid plugin response", () => {
    expect(() => parseAMCPluginSummary({ plugin: "OTHER", pluginVersion: "1.0.0" })).toThrow();
  });
});
