import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const url = required("V2_URL").replace(/\/$/, "");
const key = required("V2_PUBLISHABLE_KEY");
const email = required("PIE_TEST_USER_A_EMAIL");
const password = required("PIE_TEST_PASSWORD");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
};

async function main() {
  const auth = await supabase.auth.signInWithPassword({ email, password });
  if (auth.error || !auth.data.session?.access_token) {
    throw new Error(`Disposable test account authentication failed: ${auth.error?.message ?? "session missing"}`);
  }

  // Read-only action: must not create AI Lab sessions, attempts, or telemetry rows.
  const { data, error } = await supabase.functions.invoke("v2-ai-lab", {
    body: { action: "pie_snapshot" },
  });

  let invokeErrorDetail = "";
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        invokeErrorDetail = `HTTP ${context.status}: ${payload?.code ?? "FUNCTION_ERROR"}: ${payload?.error ?? payload?.message ?? "request rejected"}`;
      } catch {
        invokeErrorDetail = `HTTP ${context.status}: ${error.message}`;
      }
    }
  }

  check(
    "deployed v2-ai-lab accepts pie_snapshot",
    !error && data?.success === true,
    invokeErrorDetail || error?.message || data?.error || "success response received",
  );

  if (!error && data?.success === true) {
    const pie = data.pie;
    const expectedModes = ["normal_mcq", "amc_exam", "nudge"];
    const expectedDimensions = ["capability", "decision", "timing", "calibration", "sustained_performance", "learning"];
    const modes = Array.isArray(pie?.modeEvidence) ? pie.modeEvidence : [];

    check(
      "snapshot keeps the three practice modes separate",
      expectedModes.every((mode) => modes.filter((entry: any) => entry?.mode === mode).length === 1)
        && modes.length === expectedModes.length,
      `modes=${modes.map((entry: any) => entry?.mode).join(",")}`,
    );

    check(
      "each mode contains the six canonical PIE dimensions",
      modes.length === 3 && modes.every((entry: any) =>
        Array.isArray(entry.dimensions)
        && entry.dimensions.length === expectedDimensions.length
        && expectedDimensions.every((dimension) =>
          entry.dimensions.filter((item: any) => item?.key === dimension).length === 1
        )
      ),
      `mode_count=${modes.length}`,
    );

    check(
      "source list and snapshot timestamp are well-formed",
      Array.isArray(pie?.sources)
        && (pie.snapshotAt === null || (typeof pie.snapshotAt === "string" && Number.isFinite(Date.parse(pie.snapshotAt))))
        && data.snapshot_at === pie.snapshotAt,
      `sources=${Array.isArray(pie?.sources) ? pie.sources.length : "invalid"}`,
    );

    check(
      "unavailable values are not coerced to zero",
      modes.length === 3 && modes.every((entry: any) =>
        Array.isArray(entry.dimensions) && entry.dimensions.every((dimension: any) =>
          dimension.status === "available"
            ? typeof dimension.valuePercent === "number"
            : dimension.valuePercent === null
        )
      ),
      "building/unavailable dimensions must return null values",
    );
  }

  await supabase.auth.signOut();
  const failures = checks.filter((item) => !item.ok);
  console.log(`\nAI LAB V1 READ-ONLY LIVE SMOKE: PASS=${checks.length - failures.length} FAIL=${failures.length}`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error("AI Lab V1 live smoke aborted:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
