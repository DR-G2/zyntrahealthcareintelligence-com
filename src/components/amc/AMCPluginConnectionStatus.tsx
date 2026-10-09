import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { getAMCBlueprint, getAMCPluginSummary, getAMCPracticeStatus, type AMCBlueprintResponse, type AMCPluginSummary, type AMCPracticeStatus } from "@/lib/amc/amc-runtime-client";

export function AMCPluginConnectionStatus() {
  const [summary, setSummary] = useState<AMCPluginSummary | null>(null);
  const [blueprint, setBlueprint] = useState<AMCBlueprintResponse | null>(null);
  const [practiceStatus, setPracticeStatus] = useState<AMCPracticeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAMCPluginSummary("MCQ"), getAMCBlueprint("MCQ"), getAMCPracticeStatus("MCQ")])
      .then(([nextSummary, nextBlueprint, nextPracticeStatus]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setBlueprint(nextBlueprint);
        setPracticeStatus(nextPracticeStatus);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "AMC plugin connection failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section aria-labelledby="amc-plugin-status" className="mt-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="amc-plugin-status" className="font-display text-lg font-bold">AMC plugin connection</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This checks the signed-in V2 runtime and source blueprint only. It does not estimate your chance of passing the AMC exam.
          </p>
          {loading && (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking plugin contract…
            </p>
          )}
          {!loading && error && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
          {!loading && !error && summary && blueprint && practiceStatus && (
            <div className="mt-4 space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                Runtime responded. Plugin v{summary.pluginVersion}, status <strong>{summary.status}</strong>.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Exam environment</p>
                  <p className="mt-1 font-medium">{summary.environmentCode ?? "Not configured"}</p>
                  <p className="text-xs text-muted-foreground">{summary.environmentVersion ?? "No version returned"} · {summary.environmentStatus ?? "status unreported"}</p>
                </div>
                <div className="rounded-xl border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">MCQ blueprint</p>
                  <p className="mt-1 font-medium">{blueprint.blueprint.length} rows returned</p>
                  <p className="text-xs text-muted-foreground">Versioned source proportions</p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm font-semibold">AMC question delivery: not enabled</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {practiceStatus.approvedQuestionCount} approved mappings of {practiceStatus.mappedQuestionCount} mapped questions.
                  The PIE AMC selector is not certified, so this track will not silently fall back to generic questions.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Readiness probability remains uncalibrated. No pass-probability claim is displayed.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
