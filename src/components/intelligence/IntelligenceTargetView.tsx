import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ShieldCheck, ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIMENSIONS, normalizePracticeMode, type Dimension, type IntelligenceEvidence, type PracticeMode, type SafeAttempt } from "@/lib/pie/intelligence-evidence";
import { authoritativePrismLayer, MIN_DIMENSION_OBSERVATIONS } from "@/lib/pie/readiness-prism-adapter";

const LABELS: Record<Dimension, string> = {
  capability: "Capability", decision: "Decision", timing: "Timing",
  calibration: "Calibration", sustained_performance: "Sustained performance", learning: "Learning",
};
const DISPLAY_DIMENSIONS: Dimension[] = ["capability", "calibration", "sustained_performance", "learning", "decision", "timing"];
const MODES: { id: PracticeMode; label: string }[] = [
  { id: "normal_mcq", label: "Normal MCQ" }, { id: "amc_exam", label: "AMC Exam mode" }, { id: "nudge", label: "Nudge" },
];
const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? null : Math.round(value * 100);
const dateLabel = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : null;
const uniqueAttempts = (rows: SafeAttempt[]) => [...new Map(rows.map(row => [row.id, row])).values()];
function latestAt(rows: SafeAttempt[]) {
  return rows.reduce<string | null>((latest, row) => !latest || Date.parse(row.at) > Date.parse(latest) ? row.at : latest, null);
}
function wilsonInterval(correct: number, total: number): [number, number] {
  const z = 1.96, p = correct / total, z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) / total) + z2 / (4 * total * total)) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
function subjectRows(rows: SafeAttempt[]) {
  const groups = new Map<string, SafeAttempt[]>();
  rows.forEach(row => { const key = row.subjectId ?? row.subject; groups.set(key, [...(groups.get(key) ?? []), row]); });
  return [...groups.entries()].map(([key, attempts]) => {
    const scored = attempts.filter(row => row.answerKeyAvailable === true && typeof row.correct === "boolean");
    return { key, name: attempts[0]?.subject ?? "Uncategorised", count: attempts.length,
      scored: scored.length, correct: scored.filter(row => row.correct).length,
      accuracy: scored.length ? scored.filter(row => row.correct).length / scored.length : null, latest: latestAt(attempts) };
  }).sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2));
}
export function ReadinessPrism({ evidence, loading, retry }: { evidence: IntelligenceEvidence | null; loading: boolean; retry: () => void }) {
  const [mode, setMode] = useState<PracticeMode>("normal_mcq");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rows = useMemo(() => uniqueAttempts((evidence?.history.value ?? []).filter(row => normalizePracticeMode(row.sessionMode) === mode)), [evidence, mode]);
  const subjects = useMemo(() => subjectRows(rows), [rows]);
  const pie = useMemo(() => authoritativePrismLayer(evidence?.pie ?? { status: "unavailable", value: null }, mode), [evidence, mode]);
  const dimensions = pie.dimensions;
  const qualified = dimensions.filter(item => item.estimate !== null && item.evidenceCount !== null && item.evidenceCount >= MIN_DIMENSION_OBSERVATIONS);
  const limiter = [...qualified].sort((a, b) => (a.estimate ?? 1) - (b.estimate ?? 1))[0] ?? null;
  const action = evidence?.action.status === "ready" && normalizePracticeMode(evidence.action.value.sessionMode) === mode ? evidence.action.value : null;
  const beforeAction = action?.at ? rows.filter(row => Date.parse(row.at) < Date.parse(action.at) && row.answerKeyAvailable === true && typeof row.correct === "boolean") : [];
  const afterAction = action?.at ? rows.filter(row => Date.parse(row.at) >= Date.parse(action.at) && row.answerKeyAvailable === true && typeof row.correct === "boolean") : [];
  const beforeCorrect = beforeAction.filter(row => row.correct).length;
  const afterCorrect = afterAction.filter(row => row.correct).length;
  const beforeRate = beforeAction.length ? beforeCorrect / beforeAction.length : null;
  const afterRate = afterAction.length ? afterCorrect / afterAction.length : null;
  const beforeInterval = beforeAction.length >= 15 ? wilsonInterval(beforeCorrect, beforeAction.length) : null;
  const afterInterval = afterAction.length >= 15 ? wilsonInterval(afterCorrect, afterAction.length) : null;
  const distinguishable = beforeInterval !== null && afterInterval !== null
    && (beforeInterval[1] < afterInterval[0] || afterInterval[1] < beforeInterval[0]);
  const sourceUnavailable = !evidence || Object.values(evidence).some(item => item.status === "unavailable");
  const modeLabel = MODES.find(item => item.id === mode)?.label ?? mode;
  return <section className="space-y-5" aria-busy={loading}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
      <div><h2 className="font-display text-2xl font-semibold">Your evidence, your next step</h2><p className="mt-1 text-sm text-muted-foreground">Personal practice evidence only. Missing data remains unavailable.</p></div>
      <Button variant="outline" size="sm" onClick={retry} disabled={loading} className="min-h-11"><Activity className="mr-2 h-4 w-4" />Refresh evidence</Button>
    </header>
    <section aria-label="Practice mode" className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Practice mode, kept separate</p>
      <div className="flex flex-wrap gap-2">{MODES.map(item => <Button key={item.id} type="button" variant={mode === item.id ? "default" : "outline"} aria-pressed={mode === item.id} className="min-h-11" onClick={() => setMode(item.id)}>{item.label}</Button>)}</div>
      {evidence?.history.status === "ready" && rows.length === 0 && <p role="status" className="text-sm text-muted-foreground">No attempts with verified {modeLabel} provenance are available. Unclassified sessions are excluded.</p>}
    </section>
    <section aria-label="Next Best Action" className="rounded-xl border border-primary/25 bg-card/50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next Best Action</p>
      <h3 className="mt-2 font-display text-lg font-semibold">{action?.title ?? "Build the next piece of evidence"}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{action?.reason ?? "General suggestion, not yet personalised. Continue with a practice session in the selected mode."}</p>
      {action?.subjectId && <p className="mt-2 text-sm text-muted-foreground">Supporting evidence: {rows.filter(row => row.subjectId === action.subjectId && row.answerKeyAvailable === true).length} scored attempts in the recommended subject for {modeLabel}.</p>}
      <Button asChild className="mt-3 min-h-11"><Link to="/practice">Go to Practice <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
    </section>
    <section aria-label="Evidence status" className="rounded-xl border border-border/70 p-4">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="font-semibold">Evidence status</h3></div>
      <p className="mt-2 text-sm text-muted-foreground">{sourceUnavailable ? "At least one evidence source is unavailable. Other sources are kept separate." : "Evidence sources are evaluated independently for " + modeLabel + "."}</p>
      <p className="mt-1 text-xs text-muted-foreground">Recorded attempts in this mode: {evidence?.history.status === "ready" ? rows.length : "Unavailable"}</p>
    </section>
    <section aria-label="Six dimensions" className="space-y-3">
      <div><h3 className="font-display text-lg font-semibold">Six dimensions</h3><p className="text-sm text-muted-foreground">Each dimension uses its own valid-observation count. Cards are collapsed by default.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {DISPLAY_DIMENSIONS.map(name => {
          const item = dimensions.find(value => value.dimension === name)!;
          const isOpen = expanded === name;
          const count = item.evidenceCount;
          const enough = count !== null && count >= MIN_DIMENSION_OBSERVATIONS && item.estimate !== null;
          const display = enough ? pct(item.estimate) + "%" : count !== null && count < MIN_DIMENSION_OBSERVATIONS ? "Building" : "Unavailable";
          return <article key={name} className="rounded-xl border border-border/70 bg-card/40">
            <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : name)} className="flex min-h-[84px] w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{LABELS[name]}</span><span className="mt-1 block font-display text-xl font-semibold">{display}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{count !== null && count < MIN_DIMENSION_OBSERVATIONS ? "Building, " + count + " of " + MIN_DIMENSION_OBSERVATIONS : count === null ? "Valid observation count unavailable" : count + " valid observations"}</span></span>
              <ChevronDown aria-hidden="true" className={"h-4 w-4 shrink-0 transition-transform " + (isOpen ? "rotate-180" : "")} />
            </button>
            <div className="px-4 pb-3"><div role="progressbar" aria-label={LABELS[name] + " evidence progress"} aria-valuemin={0} aria-valuemax={MIN_DIMENSION_OBSERVATIONS} aria-valuenow={count === null ? 0 : Math.min(count, MIN_DIMENSION_OBSERVATIONS)} aria-valuetext={count === null ? "Evidence count unavailable" : count + " of " + MIN_DIMENSION_OBSERVATIONS + " valid observations"} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: count === null ? "0%" : Math.min(count / MIN_DIMENSION_OBSERVATIONS, 1) * 100 + "%" }} /></div></div>
            {isOpen && <div className="grid gap-2 border-t border-border/60 px-4 py-3 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Estimate</span><br />{enough ? pct(item.estimate) + "%" : count !== null && count < MIN_DIMENSION_OBSERVATIONS ? "Building" : "Unavailable"}</p>
              <p><span className="text-muted-foreground">Uncertainty interval</span><br />{enough && item.lower !== null && item.upper !== null ? pct(item.lower) + "% to " + pct(item.upper) + "%" : "Unavailable"}</p>
              <p><span className="text-muted-foreground">Evidence count</span><br />{count === null ? "Unavailable" : count + " valid observations"}</p>
              <p><span className="text-muted-foreground">Latest observation</span><br />{dateLabel(item.latestObservationAt) ?? "Unavailable"}</p>
            </div>}
          </article>;
        })}
      </div>
    </section>
    <section aria-label="Main limiter" className="rounded-xl border border-border/70 p-4">
      <h3 className="font-semibold">Main limiter</h3>
      <p className="mt-1 text-sm text-muted-foreground">{limiter ? LABELS[limiter.dimension] + " tends to be the lowest of the dimensions that meet the evidence threshold. This is an observed comparison, not a causal explanation." : "Not enough evidence yet"}</p>
      {limiter && limiter.lower !== null && limiter.upper !== null && <p className="mt-1 text-xs text-muted-foreground">Uncertainty interval: {pct(limiter.lower)}% to {pct(limiter.upper)}%.</p>}
    </section>
    <section aria-label="Did it work" className="rounded-xl border border-border/70 p-4">
      <h3 className="font-semibold">Did it work?</h3>
      {!action?.at || afterAction.length < 15
        ? <p className="mt-1 text-sm text-muted-foreground">Not enough practice since the suggestion.</p>
        : beforeAction.length < 15
          ? <p className="mt-1 text-sm text-muted-foreground">Not enough practice since the suggestion.</p>
          : <div className="mt-2 space-y-2 text-sm">
              <p>Before suggestion ({dateLabel(action.at) ? "before " + dateLabel(action.at) : "earlier"}): {Math.round((beforeRate ?? 0) * 100)}%, n={beforeAction.length}, 95% interval {Math.round((beforeInterval![0]) * 100)}% to {Math.round((beforeInterval![1]) * 100)}%.</p>
              <p>After suggestion: {Math.round((afterRate ?? 0) * 100)}%, n={afterAction.length}, 95% interval {Math.round((afterInterval![0]) * 100)}% to {Math.round((afterInterval![1]) * 100)}%.</p>
              <p className="text-muted-foreground">{distinguishable ? "The observed results differ beyond these intervals. This is an association over time, not evidence that the suggestion caused the change." : "No clear change"}</p>
            </div>}
    </section>
    <section className="rounded-xl border border-border/70">
      <button type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-semibold">Expandable detail</span><ChevronDown className={"h-4 w-4 transition-transform " + (detailsOpen ? "rotate-180" : "")} /></button>
      {detailsOpen && <div className="space-y-5 border-t border-border/60 p-4">
        <section aria-label="Subject evidence"><h4 className="font-medium">Subjects</h4>{subjects.length ? <div className="mt-2 divide-y divide-border/60">{subjects.map(subject => <div key={subject.key} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{subject.name}</span><span>{subject.accuracy === null ? "Accuracy unavailable" : Math.round(subject.accuracy * 100) + "%"} · {subject.scored} scored answers</span><span className="text-xs text-muted-foreground">Latest: {dateLabel(subject.latest) ?? "Unavailable"}</span></div>)}</div> : <p className="mt-1 text-sm text-muted-foreground">No verified subject evidence for this mode.</p>}</section>
        <section aria-label="Behaviour evidence"><h4 className="font-medium">Behaviour: answer changes and timing</h4><p className="mt-1 text-sm text-muted-foreground">{rows.filter(row => row.changes !== null).length} attempts have answer-change evidence; {rows.filter(row => row.seconds !== null).length} have timing evidence. These counts are shown separately and are not treated as missing zeros.</p></section>
        <section aria-label="Trust Your Gut"><h4 className="font-medium">Trust Your Gut</h4><p className="mt-1 text-sm text-muted-foreground">Trust Your Gut remains candidate-wide. Open its existing view to see its evidence and recommendation.</p><Button asChild variant="outline" className="mt-2 min-h-11"><Link to="/intelligence?tab=trust-your-gut">Open Trust Your Gut</Link></Button></section>
        <section aria-label="Calibration curve"><h4 className="font-medium">Calibration curve</h4>{[1,2,3,4,5].map(level => { const valid = rows.filter(row => row.answerKeyAvailable === true && row.confidence === level && typeof row.correct === "boolean"); return <div key={level} className="flex items-center justify-between gap-3 border-b border-border/40 py-2 text-sm"><span>Confidence level {level}</span><span>{valid.length >= 15 ? Math.round(valid.filter(row => row.correct).length / valid.length * 100) + "% observed accuracy, n=" + valid.length : "Building, " + valid.length + " of 15"}</span></div>; })}<p className="mt-2 text-xs text-muted-foreground">Only observed levels with at least 15 valid scored answers are displayed. No values are interpolated.</p></section>
        <section aria-label="Supporting observations"><h4 className="font-medium">Supporting observations</h4><p className="mt-1 text-sm text-muted-foreground">{evidence?.history.status === "ready" ? rows.length + " verified-mode attempts are available. Latest observation: " + (dateLabel(latestAt(rows)) ?? "Unavailable") + "." : "Supporting observations are unavailable."}</p></section>
      </div>}
    </section>
  </section>;
}
