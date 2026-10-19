import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Brain, ChevronDown, CircleHelp, Clock3, Eye, GitBranch, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DIMENSIONS, historySummary, normalizePracticeMode, type Dimension, type IntelligenceEvidence, type PracticeMode, type SafeAttempt } from "@/lib/pie/intelligence-evidence";
import { authoritativePrismLayer, observedPrismLayer, prismDimensionsAreComplete, MIN_DIMENSION_OBSERVATIONS } from "@/lib/pie/readiness-prism-adapter";
import type { PrismDimensionValue } from "@/lib/pie/readiness-prism-adapter";

const LABELS: Record<Dimension, string> = {
  capability: "Capability", decision: "Decision", timing: "Timing", calibration: "Calibration",
  sustained_performance: "Sustained performance", learning: "Learning",
};
const DESCRIPTIONS: Record<Dimension, string> = {
  capability: "Clinical knowledge reflected in recorded performance.",
  decision: "Consistency of decisions across the available evidence.",
  timing: "Timing-related signal from the existing PIE projection.",
  calibration: "How confidence calibration is represented in PIE.",
  sustained_performance: "Performance evidence across available observations.",
  learning: "Learning-related signal from the existing PIE projection.",
};
const PRIMARY = [
  { id: "accuracy", label: "Clinical accuracy", icon: Target, detail: "Correct recorded attempts divided by eligible recorded attempts." },
  { id: "stability", label: "Decision stability", icon: GitBranch, detail: "Existing V2 readiness projection; its source window is not inferred here." },
  { id: "timing", label: "Timing control", icon: Clock3, detail: "Existing PIE timing estimate, not an average number of seconds." },
  { id: "confidence", label: "Confidence alignment", icon: Brain, detail: "Existing V2 confidence-calibration projection." },
] as const;
type SignalId = typeof PRIMARY[number]["id"];
const percent = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "Unavailable" : Math.round(value) + "%";
const dateLabel = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Timestamp unavailable";

function PathwayArt() {
  return <div aria-hidden="true" className="relative mx-auto flex h-28 w-full max-w-[280px] items-center justify-center sm:h-32">
    <svg viewBox="0 0 280 132" className="h-full w-full" fill="none">
      <defs>
        <linearGradient id="neural-path" x1="38" y1="22" x2="244" y2="116" gradientUnits="userSpaceOnUse"><stop stopColor="hsl(var(--primary))" stopOpacity=".9"/><stop offset="1" stopColor="hsl(var(--secondary))" stopOpacity=".45"/></linearGradient>
        <radialGradient id="brain-glow"><stop stopColor="hsl(var(--primary))" stopOpacity=".2"/><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="140" cy="54" rx="82" ry="58" fill="url(#brain-glow)"/>
      <g stroke="url(#neural-path)" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M128 48c-4-16-21-23-34-14-12-5-25 5-23 18-10 9-4 25 8 28 4 14 22 17 32 7 8 3 17-3 17-12V48Z"/>
        <path d="M132 48c4-16 21-23 34-14 12-5 25 5 23 18 10 9 4 25-8 28-4 14-22 17-32 7-8 3-17-3-17-12V48Z"/>
        <path d="M140 32v42M94 42c10 1 12 9 8 15m-23 0c9-1 13 7 12 14m55-29c-10 1-12 9-8 15m23 0c-9-1-13 7-12 14" opacity=".75"/>
        <path d="M140 77v12c0 5-7 6-7 12s7 7 7 12 0 6 0 6" strokeWidth="2.5"/>
        <path d="M132 83c0 6 16 6 16 0M132 92c0 6 16 6 16 0" opacity=".65"/>
        <path d="M121 111h38l-10 13h-18l-10-13Z" fill="hsl(var(--primary) / .08)"/><path d="M140 119v8" strokeWidth="2"/>
      </g>
      <g fill="hsl(var(--primary))"><circle cx="71" cy="52" r="2.2"/><circle cx="102" cy="29" r="2"/><circle cx="170" cy="29" r="2"/><circle cx="207" cy="54" r="2.2"/><circle cx="140" cy="91" r="2.5"/><circle cx="140" cy="126" r="2.5"/></g>
    </svg>
    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border border-primary/25 bg-background/80 px-2.5 py-1 text-[10px] font-medium tracking-wide text-primary">EVIDENCE → ACTION</span>
  </div>;
}

function SignalTile({ label, value, detail, selected, onClick, icon: Icon }: {
  label: string; value: string; detail: string; selected: boolean; onClick: () => void; icon: typeof Target;
}) {
  return <button type="button" onClick={onClick} aria-pressed={selected}
    className={"group min-h-[126px] min-w-0 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (selected ? "border-primary/60 bg-primary/[0.07]" : "border-border/70 bg-card/30 hover:border-primary/30 hover:bg-card/60")}>
    <span className="flex items-center justify-between gap-2"><span className="text-xs font-medium leading-5 text-muted-foreground">{label}</span><Icon aria-hidden="true" className={"h-4 w-4 shrink-0 " + (selected ? "text-primary" : "text-muted-foreground")}/></span>
    <span className="mt-3 block font-display text-2xl font-semibold tracking-tight">{value}</span>
    <span className="mt-2 block text-[11px] leading-4 text-muted-foreground">{detail}</span>
  </button>;
}

function DimensionMap({ dimensions, selected, onSelect }: {
  dimensions: PrismDimensionValue[]; selected: Dimension; onSelect: (dimension: Dimension) => void;
}) {
  const complete = prismDimensionsAreComplete(dimensions);
  const radius = 68;
  const point = (index: number, r: number) => ({ x: 100 + Math.cos(-Math.PI / 2 + index * Math.PI / 3) * r, y: 92 + Math.sin(-Math.PI / 2 + index * Math.PI / 3) * r });
  const polygon = dimensions.map((item,index) => { const p=point(index,(item.estimate ?? 0)*radius); return p.x + "," + p.y; }).join(" ");
  return <div className="grid items-center gap-4 sm:grid-cols-[minmax(180px,.8fr)_1.2fr]">
    <div className="mx-auto w-full max-w-[250px]">
      <svg viewBox="0 0 200 184" role="img" aria-label={complete ? "Six-dimensional PIE map with all values available" : "Six-dimensional PIE map with incomplete values"} className="w-full">
        {[.25,.5,.75,1].map(level => <polygon key={level} points={DIMENSIONS.map((_,i) => { const p=point(i,radius*level); return p.x + "," + p.y; }).join(" ")} fill="none" stroke="hsl(var(--border))" strokeWidth=".8"/>)}
        {DIMENSIONS.map((dimension,i) => { const p=point(i,radius); return <line key={dimension} x1="100" y1="92" x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth=".8"/>; })}
        {complete && <polygon points={polygon} fill="hsl(var(--primary) / .15)" stroke="hsl(var(--primary))" strokeWidth="1.8"/>}
        {dimensions.map((item,index) => { if (item.estimate === null) return null; const p=point(index,item.estimate*radius); return <circle key={item.dimension} cx={p.x} cy={p.y} r={item.dimension===selected?4:2.7} fill="hsl(var(--primary))"/>; })}
      </svg>
      <p className="text-center text-[11px] text-muted-foreground">{complete ? "All six dimension estimates meet their evidence gates." : "The map is partial while dimensions build evidence; unsupported values are not plotted."}</p>
    </div>
    <div className="grid gap-1.5 sm:grid-cols-2">{dimensions.map(item => <button key={item.dimension} type="button" onClick={() => onSelect(item.dimension)} aria-pressed={selected===item.dimension}
      className={"min-h-14 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (selected===item.dimension?"border-primary/50 bg-primary/[.06]":"border-border/60 hover:bg-muted/30")}>
      <span className="block text-xs text-muted-foreground">{LABELS[item.dimension]}</span><span className="mt-1 block font-mono text-sm">{item.estimate!==null?percent(item.estimate*100):item.evidenceCount!==null&&item.evidenceCount<MIN_DIMENSION_OBSERVATIONS?"Building":"Unavailable"}</span><span className="mt-1 block text-[10px] text-muted-foreground">{item.evidenceCount===null?"Valid observation count unavailable":item.evidenceCount+" / "+MIN_DIMENSION_OBSERVATIONS+" valid observations"}</span>
    </button>)}</div>
  </div>;
}

function buildSubjectRows(rows: SafeAttempt[]) {
  const groups = new Map<string, SafeAttempt[]>();
  rows.forEach(row => { const key=row.subjectId ?? row.subject; groups.set(key,[...(groups.get(key)??[]),row]); });
  return [...groups.entries()].map(([key,attempts]) => ({
    key, subject: attempts[0]?.subject ?? "Uncategorised", attempts, count: attempts.length,
    correct: attempts.filter(row=>row.correct).length,
    accuracy: attempts.length ? attempts.filter(row=>row.correct).length/attempts.length*100 : null,
    latest: attempts.reduce<string|null>((latest,row)=>!latest||Date.parse(row.at)>Date.parse(latest)?row.at:latest,null),
  })).sort((a,b)=>(a.accuracy??0)-(b.accuracy??0)||b.count-a.count);
}

export function ReadinessPrism({ evidence, loading, retry }: { evidence: IntelligenceEvidence | null; loading: boolean; retry: () => void }) {
  const [selectedMode,setSelectedMode]=useState<PracticeMode>("normal_mcq");
  const [selectedSignal,setSelectedSignal]=useState<SignalId>("accuracy");
  const [selectedDimension,setSelectedDimension]=useState<Dimension>("capability");
  const [expandedSubject,setExpandedSubject]=useState<string|null>(null);
  const [showEvidence,setShowEvidence]=useState(false);
  const modeRows=useMemo(()=>(evidence?.history.value??[]).filter(row=>normalizePracticeMode(row.sessionMode)===selectedMode),[evidence,selectedMode]);
  const summary=useMemo(()=>historySummary(modeRows),[modeRows]);
  const subjects=useMemo(()=>buildSubjectRows(modeRows),[modeRows]);
  const pieModel=useMemo(()=>evidence?authoritativePrismLayer(evidence.pie,selectedMode):authoritativePrismLayer({status:"unavailable",value:null},selectedMode),[evidence,selectedMode]);
  const observedModel=useMemo(()=>evidence?observedPrismLayer({...evidence,history:evidence.history.status==="ready"?{status:"ready",value:modeRows}:evidence.history}):null,[evidence,modeRows]);
  const confidenceCounts = [1,2,3,4,5].map(level => ({
    level,
    count: summary.rows.filter(row => row.confidence === level && typeof row.correct === "boolean").length,
  }));
  const calibrationEvidenceComplete = confidenceCounts.every(item => item.count >= 15);
  const displayDimensions = pieModel.dimensions.map(item => item.dimension === "calibration" && !calibrationEvidenceComplete
    ? { ...item, estimate: null, uncertainty: null, lower: null, upper: null }
    : item);
  const chosenDimension=displayDimensions.find(item=>item.dimension===selectedDimension) ?? displayDimensions[0];
  const decisionDimension = displayDimensions.find(item => item.dimension === "decision");
  const timingDimension = displayDimensions.find(item => item.dimension === "timing");
  const calibrationDimension = displayDimensions.find(item => item.dimension === "calibration");
  const timingValue=timingDimension?.estimate ?? null;
  const signals: Record<SignalId,{value:string;note:string;available:boolean}> = {
    accuracy:{value:summary.accuracy===null?"Unavailable":percent(summary.accuracy),note:summary.count+" recorded attempts in this mode",available:evidence?.history.status==="ready"&&summary.accuracy!==null},
    stability:{value:evidence?.stability.status==="ready" && normalizePracticeMode(evidence.stability.value.sessionMode)===selectedMode && decisionDimension?.estimate!==null && decisionDimension?.estimate!==undefined?percent(evidence.stability.value.percent):"Unavailable",note:evidence?.stability.status==="ready" && normalizePracticeMode(evidence.stability.value.sessionMode)===selectedMode && decisionDimension?.estimate!==null && decisionDimension?.estimate!==undefined?"Mode-specific V2 readiness projection":"Mode-specific Decision evidence is unavailable; no cross-mode estimate is shown",available:evidence?.stability.status==="ready" && normalizePracticeMode(evidence.stability.value.sessionMode)===selectedMode && decisionDimension?.estimate!==null && decisionDimension?.estimate!==undefined},
    timing:{value:timingValue!=null?percent(timingValue*100):"Unavailable",note:timingValue!==null?"PIE timing estimate · normalised score":"Timing requires 50 valid observations for this dimension",available:timingValue!==null},
    confidence:{value:evidence?.confidence.status==="ready" && normalizePracticeMode(evidence.confidence.value.sessionMode)===selectedMode && calibrationDimension?.estimate!==null && calibrationDimension?.estimate!==undefined && calibrationEvidenceComplete?percent(evidence.confidence.value.percent):"Unavailable",note:!calibrationEvidenceComplete?"Calibration requires at least 15 valid answers at each confidence level in one practice mode":normalizePracticeMode(evidence?.confidence.status==="ready"?evidence.confidence.value.sessionMode:null)!==selectedMode?"Mode-specific calibration projection is unavailable":"Existing mode-specific calibration projection",available:evidence?.confidence.status==="ready" && normalizePracticeMode(evidence.confidence.value.sessionMode)===selectedMode && calibrationDimension?.estimate!==null && calibrationDimension?.estimate!==undefined && calibrationEvidenceComplete},
  };
  const chosen=PRIMARY.find(item=>item.id===selectedSignal)!;
  const latestHistory=subjects.reduce<string|null>((latest,row)=>!latest||(row.latest&&Date.parse(row.latest)>Date.parse(latest))?row.latest:latest,null);
  const evidenceUnavailable=evidence?Object.values(evidence).some(source=>source.status==="unavailable"):false;
  const action=evidence?.action.status==="ready" && normalizePracticeMode(evidence.action.value.sessionMode)===selectedMode?evidence.action.value:null;

  return <section className="space-y-8" aria-busy={loading}>
    <header className="grid gap-4 border-b border-border/60 pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
      <div><p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-primary"><Activity className="h-3.5 w-3.5"/>Performance Intelligence Engine</p><h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Your decisions, made visible.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">A measured view of your practice evidence: what is observed, what PIE estimates, and what is still unknown.</p></div>
      <Button variant="outline" size="sm" onClick={retry} disabled={loading} className="min-h-11"><Activity className="mr-2 h-4 w-4"/>Refresh evidence</Button>
    </header>

    <section aria-label="Practice mode" className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">Practice mode · kept separate</p>
      <div role="group" aria-label="Choose practice mode" className="flex flex-wrap gap-2">
        {([{id:"normal_mcq",label:"Normal MCQ"},{id:"amc_exam",label:"AMC Exam mode"},{id:"nudge",label:"Nudge"}] as const).map(mode=><Button key={mode.id} type="button" variant={selectedMode===mode.id?"default":"outline"} aria-pressed={selectedMode===mode.id} className="min-h-11" onClick={()=>setSelectedMode(mode.id)}>{mode.label}</Button>)}
      </div>
      {evidence?.history.status==="ready"&&modeRows.length===0&&<p role="status" className="text-xs text-muted-foreground">No returned attempts are available for this mode. Other modes are not included.</p>}
    </section>

    <section aria-label="Intelligence pathway" className="grid items-center gap-4 border-b border-border/50 pb-6 sm:grid-cols-[1fr_auto]">
      <div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">The learning loop</p><h3 className="mt-2 font-display text-xl font-medium">Observe → understand → act</h3><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Recorded attempts feed evidence. Valid PIE estimates remain distinct from direct measurements. A next step appears only when a supported action is available.</p></div>
      <PathwayArt/>
    </section>

    <section aria-label="Primary performance signals" className="space-y-3">
      <div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">01 / Primary signals</p><h3 className="mt-1 font-display text-lg font-semibold">Four views of your performance</h3></div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">{PRIMARY.map(item=><SignalTile key={item.id} label={item.label} value={loading?"…":signals[item.id].value} detail={signals[item.id].note} icon={item.icon} selected={selectedSignal===item.id} onClick={()=>setSelectedSignal(item.id)}/>)}</div>
      <div className="flex gap-3 border-l-2 border-primary/40 py-1 pl-4" aria-live="polite"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><div><p className="text-sm font-medium">{chosen.label}: {signals[selectedSignal].value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{chosen.detail} {signals[selectedSignal].available?"The value is from the source noted above.":"This value is unavailable rather than inferred from another metric."}</p></div></div>
    </section>

    <section aria-label="Six-dimensional PIE map" className="space-y-4 border-t border-border/50 pt-6">
      <div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">02 / PIE state</p><h3 className="mt-1 font-display text-lg font-semibold">Six-dimensional map</h3><p className="mt-1 text-sm text-muted-foreground">Authoritative PIE estimates only. Missing dimensions are not plotted as zero.</p></div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="min-w-0 rounded-lg border border-border/70 p-3 sm:p-4"><DimensionMap dimensions={displayDimensions} selected={selectedDimension} onSelect={setSelectedDimension}/></div>
        <div className="flex flex-col justify-between gap-4 border-l border-border/50 pl-4">
          <div><p className="text-xs text-muted-foreground">Selected dimension</p><h4 className="mt-1 font-display text-lg font-semibold">{LABELS[selectedDimension]}</h4><p className="mt-2 text-sm leading-6 text-muted-foreground">{DESCRIPTIONS[selectedDimension]}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-muted-foreground">Estimate</p><p className="mt-1 font-mono text-base">{chosenDimension.estimate!==null?percent(chosenDimension.estimate*100):chosenDimension.evidenceCount!==null&&chosenDimension.evidenceCount<MIN_DIMENSION_OBSERVATIONS?"Building":"Unavailable"}</p></div>
            <div><p className="text-xs text-muted-foreground">Dimension evidence</p><p className="mt-1 font-mono text-base">{chosenDimension.evidenceCount===null?"Unavailable":chosenDimension.evidenceCount+" / "+MIN_DIMENSION_OBSERVATIONS+" valid observations"}</p></div>
            <div><p className="text-xs text-muted-foreground">95% interval</p><p className="mt-1 font-mono text-sm">{chosenDimension.lower===null||chosenDimension.upper===null||chosenDimension.estimateAligned===false?"Unavailable":percent(chosenDimension.lower*100)+"–"+percent(chosenDimension.upper*100)}</p></div>
            <div><p className="text-xs text-muted-foreground">Source timestamp</p><p className="mt-1 text-xs leading-5">{dateLabel(pieModel.timestamp)}</p></div>
          </div>
          <p role="status" className="text-xs leading-5 text-muted-foreground">{loading?"Loading your PIE projection…":chosenDimension.estimate===null&&chosenDimension.evidenceCount!==null&&chosenDimension.evidenceCount<MIN_DIMENSION_OBSERVATIONS?"Building evidence: this dimension needs 50 valid observations.":selectedDimension==="calibration"?"Calibration evidence for "+selectedMode+": "+confidenceCounts.map(item=>"C"+item.level+" "+item.count+"/15").join(" · ")+". The current PIE projection has no verified mode-specific calibration estimate.":pieModel.message??"PIE projection available. This is not a readiness guarantee."}</p>
        </div>
      </div>
    </section>

    <section aria-label="Subject evidence" className="space-y-4 border-t border-border/50 pt-6">
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">03 / Observed evidence</p><h3 className="mt-1 font-display text-lg font-semibold">Subject performance</h3><p className="mt-1 text-sm text-muted-foreground">Calculated from returned, deduplicated attempt history.</p></div><span className="text-xs text-muted-foreground">{summary.count} attempts in this mode</span></div>
      {evidence?.history.status==="unavailable"?<p role="status" className="rounded-md border border-border p-4 text-sm text-muted-foreground">Attempt history is temporarily unavailable. Other evidence sources remain independent.</p>
      :subjects.length===0?<div className="border-y border-dashed border-border py-7"><p className="text-sm font-medium">Your evidence starts with practice.</p><p className="mt-1 text-sm text-muted-foreground">Complete an MCQ session to populate subject-level observations. No sample data is displayed.</p><Button asChild variant="outline" className="mt-4 min-h-11"><Link to="/practice">Open Practice <ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div>
      :<div className="divide-y divide-border/60 border-y border-border/60">{subjects.slice(0,8).map(row=><div key={row.key}>
        <button type="button" onClick={()=>setExpandedSubject(expandedSubject===row.key?null:row.key)} aria-expanded={expandedSubject===row.key} className="flex min-h-[64px] w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.subject}</span><span className="mt-1 block text-xs text-muted-foreground">{row.count} recorded {row.count===1?"attempt":"attempts"} · {row.correct} correct</span></span>
          <span className="w-14 text-right font-mono text-sm">{percent(row.accuracy)}</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{width:(row.accuracy??0)+"%"}}/></span>
          <ChevronDown className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform "+(expandedSubject===row.key?"rotate-180":"")}/>
        </button>
        {expandedSubject===row.key&&<div className="grid gap-3 pb-4 pl-1 text-xs sm:grid-cols-3"><p><span className="text-muted-foreground">Observed accuracy</span><br/><strong className="mt-1 inline-block font-mono">{percent(row.accuracy)}</strong></p><p><span className="text-muted-foreground">Recorded duration</span><br/><strong className="mt-1 inline-block font-mono">{row.attempts.filter(a=>a.seconds!==null).length} timed attempts</strong></p><p><span className="text-muted-foreground">Latest returned attempt</span><br/><strong className="mt-1 inline-block font-normal">{dateLabel(row.latest)}</strong></p></div>}
      </div>)}</div>}
    </section>

    <section aria-label="Behaviour and calibration insights" className="space-y-4 border-t border-border/50 pt-6">
      <div><p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">04 / Interpretation</p><h3 className="mt-1 font-display text-lg font-semibold">What the evidence can tell you</h3></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex gap-3 border-l-2 border-primary/40 py-1 pl-4"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><div><h4 className="text-sm font-medium">Observed pattern</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{summary.count===0?"No attempt history is available for this mode yet.":"In returned history, "+summary.changed+" of "+summary.count+" attempts recorded at least one answer change. This describes records; it does not imply changing is always good or bad."}</p></div></div>
        <div className="flex gap-3 border-l-2 border-primary/40 py-1 pl-4"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><div><h4 className="text-sm font-medium">Confidence evidence</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{summary.confidenceCount===0?"No confidence-rated attempts were returned for this mode, so observed confidence alignment cannot be calculated.":summary.confidenceCount+" attempts include a confidence rating. "+summary.highConfidenceErrors+" were high-confidence incorrect responses and "+summary.lowConfidenceCorrect+" were low-confidence correct responses."}</p></div></div>
      </div>
    </section>

    <section aria-label="Next action" className="border-t border-border/50 pt-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[.14em] text-primary"><Sparkles className="h-3.5 w-3.5"/>05 / Next step</p><h3 className="mt-2 font-display text-lg font-semibold">{action?.title??"Build the next piece of evidence"}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{action?.reason??"Continue with an MCQ practice session. This is a general practice route, not a claim that a specific topic has been targeted."}</p></div><Button asChild className="min-h-11"><Link to="/practice">Go to Practice <ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div>
    </section>

    <section className="border-t border-border/50 pt-4">
      <button type="button" aria-expanded={showEvidence} onClick={()=>setShowEvidence(value=>!value)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary"/>Evidence transparency and limitations</span><ChevronDown className={"h-4 w-4 transition-transform "+(showEvidence?"rotate-180":"")}/></button>
      {showEvidence&&<div className="grid gap-4 border-l border-border py-3 pl-4 text-sm sm:grid-cols-2">
        <div><p className="font-medium">Observed history</p><p className="mt-1 leading-6 text-muted-foreground">{observedModel?.message??"Observed attempt history is not loaded."} {observedModel?.evidenceCount==null?"Count unavailable":observedModel.evidenceCount+" returned attempts"}. Latest timestamp: {dateLabel(latestHistory)}.</p></div>
        <div><p className="font-medium">Authoritative PIE projection</p><p className="mt-1 leading-6 text-muted-foreground">{pieModel.message??"PIE projection available."} Source timestamp: {dateLabel(pieModel.timestamp)}. Readiness DNA is not substituted.</p></div>
        <div><p className="font-medium">Independent source status</p><p className="mt-1 leading-6 text-muted-foreground">Attempt history: {evidence?.history.status??"unavailable"} for {selectedMode}. PIE state: {pieModel.status==="ready"?"available":pieModel.status==="empty"?"building or unavailable":pieModel.status}. Decision stability: {signals.stability.available?"available for selected mode":"unavailable for selected mode"}. Confidence calibration: {signals.confidence.available?"available for selected mode":"unavailable for selected mode"}.</p></div>
        <div><p className="font-medium">Limitations</p><p className="mt-1 leading-6 text-muted-foreground">This page describes returned evidence and existing projections. It does not promise exam outcomes, create new scores, or claim unavailable signals are zero.</p></div>
      </div>}
      {evidenceUnavailable&&<p role="status" className="mt-2 text-xs text-muted-foreground">At least one source is unavailable. Other successful sources are shown separately.</p>}
    </section>
  </section>;
}
