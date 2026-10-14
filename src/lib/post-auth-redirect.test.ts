import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./post-auth-redirect";

describe("sanitizeNextPath", () => {
  it("allows same-origin relative paths", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/practice?x=1#y")).toBe("/practice?x=1#y");
  });
  it("rejects empty, absolute and protocol-relative values", () => {
    for (const v of [null, undefined, "", "dashboard", "https://evil.com", "//evil.com", "///evil.com", "javascript:alert(1)"]) {
      expect(sanitizeNextPath(v)).toBeNull();
    }
  });
  it("rejects backslashes anywhere", () => {
    for (const v of ["/\\evil.com", "/\\\\evil.com", "/ok\\..\\x", "\\\\evil.com"]) expect(sanitizeNextPath(v)).toBeNull();
  });
  it("rejects control characters and whitespace", () => {
    for (const v of ["/\t/evil.com", "/\n/evil.com", "/ /evil.com", "/a\u0000b"]) expect(sanitizeNextPath(v)).toBeNull();
  });
});
