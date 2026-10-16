import { motion } from "framer-motion";
import { Activity, Database, Fingerprint, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { P13_SHADOW_DIMENSIONS, type P13ShadowDimension, type P13ShadowView } from "@/lib/pie/p13-shadow-client";

const LABELS: Record<string, string> = {
  capability: "Capability",
  decision: "Decision",
  timing: "Timing",
  calibration: "Calibration",
  sustained_performance: "Sustained performance",
  learning: "Learning",
};

const pct = (value: number | null) => value == null ? "—" : Math.round(value * 100) + "%";
const qualityLabel = (value: number | null) => value == null ? "—" : value >= 0.75 ? "High" : value >= 0.5 ? "Medium" : "Low";

function DimensionCard({ item }: { item: P13ShadowDimension }) {
  const estimate = item.estimate;
  const lower = item.lower;
  const upper = item.upper;
  return (
    <motion.div layout whileHover={{ y: -2 }} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{LABELS[item.dimension] ?? item.dimension}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-white">{pct(estimate)}</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-amber-200">Shadow</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
        {estimate != null && <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-300" style={{ width: Math.max(0, Math.min(100, estimate * 100)) + "%" }} />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <MetaValue label="Uncertainty" value={item.uncertainty == null ? "—" : "±" + pct(item.uncertainty)} />
        <MetaValue label="95% interval" value={lower == null || upper == null ? "—" : pct(lower) + "–" + pct(upper)} />
        <MetaValue label="Evidence" value={item.evidence_count == null ? "—" : String(item.evidence_count)} />
        <MetaValue label="Quality" value={qualityLabel(item.evidence_quality)} />
      </div>
    </motion.div>
  );
}

function MetaValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/[0.025] px-2 py-2"><span className="block text-slate-600">{label}</span><span className="mt-0.5 block font-mono text-slate-300">{value}</span></div>;
}

function Header() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />SHADOW · P13</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">Certified P12 output</span>
        </div>
        <h2 className="mt-3 font-display text-xl font-semibold text-white">PIE Shadow Inference</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">A diagnostic view of the certified six-dimensional PIE inference. It is outside the authoritative adaptation loop.</p>
      </div>
      <div className="text-right"><p className="text-[10px] font-mono uppercase tracking-[0.14em] text-amber-200">Not authoritative</p><p className="mt-1 text-[10px] text-slate-600">No adaptive decisions are changed by this panel.</p></div>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"><div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-600"><Icon className="h-3 w-3" />{label}</div><p className="mt-1 truncate font-mono text-xs text-slate-300">{value}</p></div>;
}

export function P13ShadowInferencePanel({ view }: { view: P13ShadowView }) {
  if (view.status === "loading") {
    return <section className="rounded-3xl border border-cyan-400/15 bg-[#081224]/75 p-5 backdrop-blur-xl"><Header /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{P13_SHADOW_DIMENSIONS.map((d) => <div key={d} className="h-44 animate-pulse rounded-2xl bg-white/[0.03]" />)}</div></section>;
  }

  if (view.status === "unavailable") {
    return <section className="rounded-3xl border border-amber-400/15 bg-[#081224]/75 p-5 backdrop-blur-xl" role="status"><Header /><Empty title="Shadow inference unavailable" detail={view.message} /></section>;
  }

  if (view.status === "empty") {
    const copy = view.reason === "no_inference"
      ? ["No shadow inference yet", "PIE has not produced a shadow inference for this candidate."]
      : view.reason === "insufficient_evidence"
        ? ["Building evidence", "The certified shadow model does not have enough evidence for a complete learner profile yet."]
        : ["Incomplete shadow evidence", "The latest shadow inference is incomplete. No missing values are fabricated."];
    return <section className="rounded-3xl border border-cyan-400/15 bg-[#081224]/75 p-5 backdrop-blur-xl" role="status"><Header /><Empty title={copy[0]} detail={copy[1]} /></section>;
  }

  const { inference } = view;
  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.055] via-[#081224]/90 to-[#07101e]/90 p-5 shadow-[0_20px_80px_rgba(0,0,0,.25)] backdrop-blur-xl">
      <Header />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_1.95fr]">
        <div className="rounded-2xl border border-cyan-400/10 bg-black/10 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Sparkles className="h-4 w-4 text-cyan-300" />Current shadow state</div>
          <p className="mt-4 font-display text-3xl font-semibold text-white">Six signals online</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Diagnostic only. This state is read through the P13 application boundary from certified P12 output and does not alter scoring, selection, readiness, or adaptation.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Meta icon={ShieldCheck} label="Signal quality" value={inference.signal_quality ?? "—"} />
            <Meta icon={Database} label="Evidence maturity" value={inference.evidence_maturity ?? "—"} />
            <Meta icon={Fingerprint} label="Source state" value={inference.source_state_version == null ? "—" : "#" + inference.source_state_version} />
            <Meta icon={Activity} label="Model" value={inference.model_version ?? "—"} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {P13_SHADOW_DIMENSIONS.map((name) => {
            const item = inference.dimensions.find((d) => d.dimension === name);
            return <DimensionCard key={name} item={item ?? { dimension: name, estimate: null, uncertainty: null, lower: null, upper: null, evidence_count: null, evidence_quality: null }} />;
          })}
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">P12 explanation / provenance</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{inference.explanation?.shadow_only === true ? "P12 explicitly marked this inference shadow-only." : "No additional explanation was supplied by the inference output."}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600"><span className="rounded-lg border border-white/[0.06] px-2 py-1">Hash {inference.inference_hash ? inference.inference_hash.slice(0, 12) + "…" : "—"}</span></div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Inference timestamp</p>
          <p className="mt-3 font-mono text-sm text-white">{inference.inferred_at ? new Date(inference.inferred_at).toLocaleString() : "—"}</p>
          <p className="mt-2 text-[10px] leading-4 text-slate-600">Raw P12 estimates remain unchanged. Percentages are presentation-only multiplication by 100.</p>
        </div>
      </div>
    </section>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="mt-5 rounded-2xl border border-dashed border-white/10 py-10 text-center"><p className="text-sm font-semibold text-slate-200">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p><p className="mt-2 text-[10px] text-slate-600">This diagnostic shadow state does not influence authoritative adaptation.</p></div>;
}
