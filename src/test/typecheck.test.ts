import { execFileSync } from "node:child_process";
import path from "node:path";

// Type-checking is part of the test suite: `tsc --noEmit` must be clean.
describe("typecheck", () => {
  it.each(["tsconfig.app.json", "tsconfig.node.json"])("tsc --noEmit -p %s is clean", (cfg) => {
    const root = path.resolve(__dirname, "../..");
    const tsc = path.join(root, "node_modules/typescript/bin/tsc");
    let out = "";
    try {
      execFileSync(process.execPath, [tsc, "--noEmit", "-p", cfg], { cwd: root, encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    expect(out).toBe("");
  }, 180_000);
});
