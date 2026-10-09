import { useState, type PointerEvent } from "react";

type SignalKey = "accuracy" | "timing" | "confidence" | "changes";
type NeuralSceneProps = {
  active: number;
  reduce: boolean;
  activeSignal: SignalKey;
  onSignalSelect: (signal: SignalKey) => void;
};

const signals: { key: SignalKey; title: string; short: string; detail: string; position: string }[] = [
  { key: "accuracy", title: "Accuracy", short: "Was it correct?", detail: "Correctness is the starting point. Repeated attempts help reveal which clinical topics need more work.", position: "left-[2%] top-[18%]" },
  { key: "timing", title: "Timing", short: "How long?", detail: "Decision time can reveal rushed or hesitant responses when interpreted alongside difficulty and correctness.", position: "right-[2%] top-[30%]" },
  { key: "confidence", title: "Confidence", short: "How sure?", detail: "Confidence is useful when compared with correctness over many attempts. One answer cannot establish calibration.", position: "left-[2%] bottom-[22%]" },
  { key: "changes", title: "Answer changes", short: "Did you switch?", detail: "Answer changes add context to reasoning. They are not automatically mistakes; review whether changes improve results over time.", position: "right-[2%] bottom-[13%]" },
];

export function NeuralScene({ active, reduce, activeSignal, onSignalSelect }: NeuralSceneProps) {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 8,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * -8,
    });
  }

  function resetPointer() {
    setHovered(false);
    setPointer({ x: 0, y: 0 });
  }

  const selected = signals.find((signal) => signal.key === activeSignal) ?? signals[0];

  return (
    <div className="relative flex h-full w-full items-center justify-center" onPointerMove={handlePointerMove} onPointerEnter={() => setHovered(true)} onPointerLeave={resetPointer} aria-label="Interactive brain illustration. Select a signal to learn how Zyntra works.">
      <div className="pointer-events-none absolute inset-8 rounded-full bg-cyan-500/15 blur-3xl" />
      <div
        className="relative h-full w-full"
        style={{
          transform: reduce ? undefined : `perspective(1100px) rotateX(${hovered ? pointer.y : 0}deg) rotateY(${hovered ? pointer.x : 0}deg) scale(${hovered ? 1.012 : 1})`,
          transition: reduce ? "none" : "transform 280ms ease-out",
          transformStyle: "preserve-3d",
        }}
      >
        <img src="/images/zyntra-brain.webp" alt="Glowing blue brain and spinal cord representing how Zyntra observes, analyses and adapts clinical practice" className="relative z-[1] mx-auto h-full w-full select-none object-contain drop-shadow-[0_0_32px_rgba(34,211,238,0.2)]" draggable={false} fetchPriority="high" decoding="async" />
        {!reduce && <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden="true"><span className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-100 shadow-[0_0_18px_6px_rgba(103,232,249,0.9)] transition-[top] duration-500" style={{ top: ["41%", "48%", "58%", "68%", "78%"][active] }} /></div>}
        <div className="absolute inset-0 z-[4]">
          {signals.map((signal) => (
            <button key={signal.key} type="button" onMouseEnter={() => onSignalSelect(signal.key)} onFocus={() => onSignalSelect(signal.key)} onClick={() => onSignalSelect(signal.key)} aria-pressed={activeSignal === signal.key} className={`absolute ${signal.position} max-w-[44%] rounded-xl border px-2.5 py-2 text-left backdrop-blur-md transition duration-200 sm:px-3 ${activeSignal === signal.key ? "border-cyan-200/80 bg-[#062033]/95 shadow-[0_0_22px_rgba(34,211,238,0.15)]" : "border-white/15 bg-[#06111d]/85 hover:border-cyan-200/50"}`}>
              <span className={`block text-[10px] font-semibold sm:text-xs ${activeSignal === signal.key ? "text-cyan-100" : "text-slate-200"}`}>{signal.title}</span>
              <span className="mt-0.5 block text-[9px] text-slate-400 sm:text-[10px]">{signal.short}</span>
            </button>
          ))}
        </div>
        <div className="absolute bottom-1 left-1/2 z-[5] w-max max-w-[85%] -translate-x-1/2 rounded-full border border-cyan-200/35 bg-[#04101d]/90 px-3 py-2 text-center text-[10px] text-cyan-100 shadow-lg backdrop-blur sm:text-xs">
          <span className="font-semibold">{selected.title}:</span> {selected.detail}
        </div>
      </div>
    </div>
  );
}
