import { useState, type PointerEvent } from "react";

type NeuralSceneProps = { active: number; reduce: boolean };

export function NeuralScene({ active, reduce }: NeuralSceneProps) {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
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
          <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden="true">
            <span
              className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-100 shadow-[0_0_18px_6px_rgba(103,232,249,0.9)] transition-[top] duration-500"
              style={{ top: ["41%", "48%", "58%", "68%", "78%"][active] }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
