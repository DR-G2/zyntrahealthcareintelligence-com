import { BarChart3, Brain, Clock, RotateCcw } from "lucide-react";
import type { ComponentType } from "react";

type Tone = "blue" | "purple" | "red" | "green";

function MiniTelemetryBars({ tone }: { tone: Tone }) {
  const bars = [28, 42, 58, 35, 67, 48, 74];
  return (
    <div className={`mini-bars tone-${tone}`} aria-hidden="true">
      {bars.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
    </div>
  );
}

const metrics: Array<{ tone: Tone; icon: ComponentType<{ className?: string }>; label: string; state: string }> = [
  { tone: "blue", icon: Brain, label: "Confidence", state: "Observed" },
  { tone: "purple", icon: Clock, label: "Timing", state: "Measured" },
  { tone: "red", icon: RotateCcw, label: "Answer changes", state: "Tracked" },
  { tone: "green", icon: BarChart3, label: "Consistency", state: "Analysed" },
];

export default function TelemetryStrip() {
  return (
    <div className="shell telemetry-strip">
      <div className="strip-shell">
        {metrics.map(({ tone, icon: Icon, label, state }) => (
          <div className={`strip-card tone-${tone}`} key={label}>
            <span className="strip-icon"><Icon className="h-5 w-5" /></span>
            <div><b>{label}</b><span>{state}</span></div>
            <MiniTelemetryBars tone={tone} />
          </div>
        ))}
      </div>
    </div>
  );
}
