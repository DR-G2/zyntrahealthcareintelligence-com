import { useMemo, useState } from "react";
import { Activity, Clock3, Eye, FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIMENSIONS, historySummary, type Dimension, type IntelligenceEvidence } from "@/lib/pie/intelligence-evidence";
import { authoritativePrismLayer, isolatedShadowPrismLayer, observedPrismLayer, prismDimensionsAreComplete, type PrismLayer, type PrismLayerModel } from "@/lib/pie/readiness-prism-adapter";

const LABELS: Record<Dimension, string> = {
  capability: "Capability",
  decision: "Decision",
  timing: "Timing",
  calibration: "Calibration",
  sustained_performance: "Sustained performance",
  learning: "Learning",
};
const LAYERS: { id: PrismLayer; label: string; icon: typeof Eye }[] = [
  { id: "observed", label: "Observed evidence", icon: Eye },
  { id: "authoritative", label: "Authoritative PIE", icon: ShieldCheck },
  { id: "shadow", label: "Shadow diagnostics", icon: FlaskConical },
];
const percent = (value: number | null) => value === null ? "Unavailable" : `${Math.round(value * 100)}%`;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Timestamp unavailable";

function PrismPlot({ model, selected, onSelect }: { model: PrismLayerModel; selected: Dimension; onSelect: (dimension: Dimension) => void }) {
  const complete = model.status === "ready" && prismDimensionsAreComplete(model.dimensions);
  const radius = 88;
  const point = (index: number, r: number) => {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    return { x: 120 + Math.cos(angle) * r, y: 120 + Math.sin(angle) * r };
  };
  const polygon = model.dimensions.map((item, index) => {
    const p = point(index, (item.estimate ?? 0) * radius);
    return `${p.x},${p.y}`;
  }).join(" ");
  return <div className="grid gap-5 md:grid-cols-[minmax(220px,0.9fr)_1.1fr] md:items-center">
    <div className="mx-auto w-full max-w-[320px]">
      <svg viewBox="0 0 240 240" role="img" aria-label={complete ? "Six-dimensional PIE estimate plot" : "Six-dimensional PIE plot, incomplete values"} className="w-full overflow-visible">
        {[0.25, 0.5, 0.75, 1].map(level => <polygon key={level} points={DIMENSIONS.map((_, index) => { const p = point(index, radius * level); return `${p.x},${p.y}`; }).join(" ")} fill="none" className="stroke-border" strokeWidth="1" />)}
        {DIMENSIONS.map((dimension, index) => { const p = point(index, radius); return <line key={dimension} x1="120" y1="120" x2={p.x} y2={p.y} className="stroke-border" />; })}
        {complete && <polygon points={polygon} fill="hsl(var(--primary) / 0.16)" stroke="hsl(var(--primary))" strokeWidth="2" />}
        {model.dimensions.map((item, index) => {
          const p = item.estimate === null ? point(index, radius + 7) : point(index, item.estimate * radius);
          const isSelected = item.dimension === selected;
          return <g key={item.dimension}>
            <circle cx={p.x} cy={p.y} r={isSelected ? 5 : 3.5} fill={item.estimate === null ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))"} />
            <text x={point(index, radius + 26).x} y={point(index, radius + 26).y} textAnchor="middle" dominantBaseline="middle" fontSize="8" className="fill-muted-foreground">{item.dimension === "sustained_performance" ? "Sustained" : LABELS[item.dimension]}</text>
          </g>;
        })}
        {!complete && <text x="120" y="117" textAnchor="middle" fontSize="9" className="fill-muted-foreground">No complete plot</text>}
      </svg>
      <p className="mt-1 text-center text-xs text-muted-foreground">The plot is shown only when all six values are valid for the selected layer.</p>
    </div>
    <div className="grid gap-1 sm:grid-cols-2">
      {DIMENSIONS.map(dimension => {
        const item = model.dimensions.find(entry => entry.dimension === dimension);
        return <button key={dimension} type="button" onClick={() => onSelect(dimension)} aria-pressed={selected === dimension} className={`min-h-14 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === dimension ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/50"}`}>
          <span className="block text-xs text-muted-foreground">{LABELS[dimension]}</span>
          <span className="mt-1 block font-mono text-base">{percent(item?.estimate ?? null)}</span>
        </button>;
      })}
    </div>
  </div>;
}

function LayerStatus({ model }: { model: PrismLayerModel }) {
  const title = model.status === "ready" ? "Evidence available" : model.status === "empty" ? "Building evidence" : model.status === "unavailable" ? "Source unavailable" : "Diagnostic layer isolated";
  return <div role="status" className="rounded-lg border border-border bg-muted/20 p-3">
    <p className="text-sm font-medium">{title}</p>
    {model.message && <p className="mt-1 text-sm text-muted-foreground">{model.message}</p>}
  </div>;
}

export function ReadinessPrism({ evidence, loading, retry }: { evidence: IntelligenceEvidence | null; loading: boolean; retry: () => void }) {
  const [layer, setLayer] = useState<PrismLayer>("authoritative");
  const [selected, setSelected] = useState<Dimension>("capability");
  const model = useMemo(() => {
    if (!evidence) return layer === "shadow"
      ? isolatedShadowPrismLayer()
      : { ...authoritativePrismLayer({ status: "unavailable", value: null }), layer, message: loading ? "Loading your evidence…" : "Evidence is not available." };
    if (layer === "observed") return observedPrismLayer(evidence);
    if (layer === "shadow") return isolatedShadowPrismLayer();
    return authoritativePrismLayer(evidence.pie);
  }, [evidence, layer, loading]);
  const selectedItem = model.dimensions.find(item => item.dimension === selected);
  const summary = historySummary(evidence?.history.value ?? []);
  const observedReady = evidence?.history.status === "ready";
  const metric = (label: string, value: string, detail: string) => <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;

  return <section className="space-y-6" aria-busy={loading}>
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-5">
      <div><p className="font-mono text-xs uppercase tracking-wider text-primary">PIE · Candidate intelligence</p><h2 className="mt-2 font-display text-2xl font-medium">Readiness Prism</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Six dimensions, grounded in your evidence. Missing values stay missing.</p></div>
      <Button variant="outline" size="sm" onClick={retry} disabled={loading}><Activity className="mr-2 h-4 w-4" />Refresh evidence</Button>
    </header>
    <div role="tablist" aria-label="Readiness Prism evidence layers" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {LAYERS.map(item => <Button key={item.id} type="button" role="tab" aria-selected={layer === item.id} variant={layer === item.id ? "default" : "outline"} className="min-h-11 justify-start" onClick={() => setLayer(item.id)}><item.icon className="mr-2 h-4 w-4" />{item.label}</Button>)}
    </div>
    {layer === "shadow" && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-sm font-semibold">Non-authoritative diagnostic only</p><p className="mt-1 text-sm text-muted-foreground">Shadow values are not fetched or shown in this candidate-facing view. Server-side diagnostic exposure must be approved before that read path is enabled.</p></div>}
    {loading ? <div role="status" className="grid gap-3 md:grid-cols-2"><div className="h-64 animate-pulse rounded-xl bg-muted/40"/><div className="h-64 animate-pulse rounded-xl bg-muted/40"/></div> : <LayerStatus model={model} />}
    {layer !== "shadow" && !loading && <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">{layer === "observed" ? "Observed evidence" : "Authoritative PIE dimensions"}</h3><p className="mt-1 text-xs text-muted-foreground">{model.provenance}</p></div><div className="text-right text-xs text-muted-foreground"><p>{model.evidenceCount === null ? "Evidence count unavailable" : `${model.evidenceCount} observations/attempts`}</p><p className="mt-1">{formatDate(model.timestamp)}</p></div></div>
      {layer === "authoritative" && <div className="mt-4"><PrismPlot model={model} selected={selected} onSelect={setSelected}/></div>}
      {layer === "observed" && <p className="mt-4 text-sm text-muted-foreground">Observed records are displayed as measurements, not converted into the six inferred dimension scores.</p>}
      {layer === "authoritative" && <div className="mt-4 rounded-lg bg-muted/30 p-3"><p className="text-sm font-medium">{LABELS[selected]}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div><p className="text-xs text-muted-foreground">Estimate</p><p className="mt-1 font-mono text-sm">{percent(selectedItem?.estimate ?? null)}</p></div>
        <div><p className="text-xs text-muted-foreground">Uncertainty bound (95%)</p><p className="mt-1 font-mono text-sm">{selectedItem?.uncertainty == null ? "Unavailable" : percent(selectedItem.uncertainty)}</p></div>
        <div><p className="text-xs text-muted-foreground">95% interval</p><p className="mt-1 font-mono text-sm">{selectedItem?.lower == null || selectedItem?.upper == null ? "Unavailable" : `${percent(selectedItem.lower)}–${percent(selectedItem.upper)}`}</p></div>
        <div><p className="text-xs text-muted-foreground">Dimension evidence count</p><p className="mt-1 font-mono text-sm">{selectedItem?.evidenceCount == null ? "Unavailable" : selectedItem.evidenceCount}</p></div>
        <div><p className="text-xs text-muted-foreground">Evidence quality</p><p className="mt-1 font-mono text-sm">{selectedItem?.evidenceQuality == null ? "Unavailable" : percent(selectedItem.evidenceQuality)}</p></div>
      </div><p className="mt-3 text-xs text-muted-foreground">Uncertainty is a conservative 95% bound calculated from authoritative observation counts and signal quality. These values are computed independently of shadow inference.</p></div>}
    </div>}
    {layer === "shadow" && <div className="rounded-xl border border-border p-4"><div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-amber-500"/><h3 className="font-medium">Shadow provenance</h3></div><p className="mt-2 text-sm text-muted-foreground">{model.provenance}</p><p className="mt-1 text-xs text-muted-foreground">Inference timestamp, model hash, uncertainty and dimension estimates are intentionally not requested or fabricated.</p></div>}
    {evidence && Object.values(evidence).some(source => source.status === "unavailable") && <p className="text-xs text-muted-foreground">One or more evidence sources are unavailable. Each layer reports its own source status.</p>}
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5"/><span>All timestamps are source timestamps; absent timestamps are explicitly unavailable.</span></div>
  </section>;
}