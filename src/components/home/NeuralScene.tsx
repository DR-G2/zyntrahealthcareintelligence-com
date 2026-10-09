import { useState } from "react";

type NeuralSceneProps = { active: number; reduce: boolean };

const stageNames = ["Observe", "Diagnose", "Intervene", "Measure", "Adapt"];

export function NeuralScene({ active, reduce }: NeuralSceneProps) {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 7,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * -7,
    });
  }

  function resetPointer() {
    setHovered(false);
    setPointer({ x: 0, y: 0 });
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={resetPointer}
      aria-label="Interactive Zyntra brain-to-readiness illustration"
    >
      <div className="pointer-events-none absolute inset-8 rounded-full bg-cyan-500/10 blur-3xl" />
      <div
        className="relative h-full w-full"
        style={{
          transform: reduce ? undefined : `perspective(1100px) rotateX(${hovered ? pointer.y : 0}deg) rotateY(${hovered ? pointer.x : 0}deg) scale(${hovered ? 1.015 : 1})`,
          transition: reduce ? "none" : "transform 280ms ease-out",
          transformStyle: "preserve-3d",
        }}
      >
        <img
          src="/images/zyntra-brain.webp"
          alt="Glowing blue brain and spinal cord flowing through Observe, Diagnose, Intervene, Measure and Adapt toward the next best action"
          className="relative z-[1] mx-auto h-full w-full select-none object-contain drop-shadow-[0_0_30px_rgba(34,211,238,0.12)]"
          draggable={false}
          fetchPriority="high"
          decoding="async"
        />
        {!reduce && (
          <div className="pointer-events-none absolute inset-0 z-[2]">
            <span className="absolute left-1/2 top-[41%] h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-100 shadow-[0_0_16px_5px_rgba(103,232,249,0.85)] animate-pulse" />
            <span className="absolute left-1/2 top-[61%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_4px_rgba(34,211,238,0.9)] animate-pulse" />
          </div>
        )}
        <div className="absolute bottom-3 left-1/2 z-[3] -translate-x-1/2 rounded-full border border-cyan-200/35 bg-[#04101d]/85 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-cyan-100 backdrop-blur-sm sm:text-xs">
          {stageNames[active]} <span aria-hidden="true">→</span> NEXT BEST ACTION
        </div>
      </div>
    </div>
  );
}
