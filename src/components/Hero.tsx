import { BarChart3, Brain, ChevronRight, Clock, RotateCcw } from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";

type Tone = "blue" | "purple" | "red" | "green";

function SignalTelemetry({
  tone,
  values,
  icon: Icon,
  label,
  state,
}: {
  tone: Tone;
  values: number[];
  icon: ComponentType<{ className?: string }>;
  label: string;
  state: string;
}) {
  const points = values.map((value, index) => `${index * (120 / (values.length - 1))},${28 - value}`).join(" ");
  return (
    <div className={`signal-tele-card tone-${tone}`}>
      <div className="signal-tele-icon"><Icon className="h-5 w-5" /></div>
      <div className="signal-tele-copy"><span>{label}</span><strong>{state}</strong></div>
      <svg className="signal-tele-spark" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ZyntraVisual() {
  const telemetry = [
    { tone: "blue" as const, icon: Brain, label: "Confidence", state: "Observed", values: [5, 9, 7, 15, 11, 19, 16, 22, 18, 24] },
    { tone: "purple" as const, icon: Clock, label: "Timing", state: "Measured", values: [4, 18, 10, 22, 8, 15, 11, 24, 14, 22] },
    { tone: "red" as const, icon: RotateCcw, label: "Answer changes", state: "Tracked", values: [2, 8, 22, 11, 24, 17, 20, 9, 23, 13] },
    { tone: "green" as const, icon: BarChart3, label: "Consistency", state: "Analysed", values: [6, 12, 8, 19, 13, 23, 17, 21, 15, 25] },
  ];

  return (
    <div className="hero-visual" aria-label="Zyntra behavioural telemetry visual">
      <div className="brain-halo brain-halo-a" aria-hidden="true" />
      <div className="brain-halo brain-halo-b" aria-hidden="true" />
      <div className="brain-art" aria-hidden="true">
        <div className="brain-cortex cortex-a" />
        <div className="brain-cortex cortex-b" />
        <div className="brain-cortex cortex-c" />
        <div className="brain-cortex cortex-d" />
        <div className="brain-cortex cortex-e" />
        <div className="brain-cortex cortex-f" />
        <div className="brain-rim rim-1" />
        <div className="brain-rim rim-2" />
        <div className="brain-rim rim-3" />
        <div className="brain-spine" />
      </div>
      <div className="chip-base" aria-hidden="true">
        <span className="chip-z">Z</span>
      </div>
      <div className="telemetry-stack">
        {telemetry.map((item) => <SignalTelemetry key={item.label} {...item} />)}
      </div>
      <div className="visual-lines" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="visual-caption">Zyntra learns your pattern, then training adapts.</div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-glow hero-glow-a" aria-hidden="true" />
      <div className="hero-glow hero-glow-b" aria-hidden="true" />
      <div className="hero-grid-lines" aria-hidden="true" />
      <div className="shell hero-layout">
        <div className="hero-copy">
          <p className="eyebrow">WHAT IS ZYNTRA?</p>
          <h1 id="hero-title">Zyntra is an AI-powered AMC exam preparation platform for medical students, medical graduates and doctors preparing for the Australian Medical Council examinations.</h1>
          <p className="hero-lead">Zyntra goes beyond whether an answer is right or wrong. It learns how you approach questions and uses those signals to make preparation more targeted.</p>
          <p className="hero-signal">Your answer is one signal. Your decision process is the dataset.</p>
          <Link to="/login" className="primary-button">Get Started <ChevronRight className="h-4 w-4" /></Link>
        </div>
        <ZyntraVisual />
      </div>
    </section>
  );
}
