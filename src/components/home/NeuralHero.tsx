import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState, type PointerEvent } from "react";
import art from "@/assets/home-brain-funnel.jpg";

/**
 * One coherent assembly: brain -> spinal cord -> glass funnel -> Next Best Action.
 * Artwork is a plain image (no WebGL needed). Reduced motion disables float, signal and parallax.
 */
const STAGES = [
  ["Observe", 42], ["Diagnose", 50], ["Intervene", 58], ["Measure", 66], ["Adapt", 74],
] as const;

export function NeuralHero() {
  const reduce = useReducedMotion();
  const [fine, setFine] = useState(false);
  const [active, setActive] = useState(false);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 }), sy = useSpring(my, { stiffness: 60, damping: 18 });
  const x = useTransform(sx, v => v * 8), y = useTransform(sy, v => v * 8);
  const rotate = useTransform(sx, v => v * 2);

  useEffect(() => { setFine(window.matchMedia("(pointer: fine)").matches); }, []);
  const parallax = fine && !reduce;
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!parallax) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width * 2 - 1);
    my.set((e.clientY - r.top) / r.height * 2 - 1);
  };
  const reset = () => { mx.set(0); my.set(0); setActive(false); };

  return (
    <div
      className="gj-hero relative mx-auto aspect-[4/5] w-full max-w-[22rem] md:max-w-md"
      onPointerMove={onMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={reset}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      tabIndex={0}
      role="img"
      aria-label="Glowing brain connected by a spinal cord to a glass funnel labelled Next Best Action, passing through Observe, Diagnose, Intervene, Measure and Adapt"
    >
      <motion.div className="relative h-full w-full" style={parallax ? { x, y, rotate } : undefined}>
        <motion.div
          className="relative h-full w-full"
          animate={reduce ? undefined : { y: [0, -6, 0, 6, 0] }}
          transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <img src={art} alt="" width={1024} height={1280} fetchPriority="high" className="gj-art h-full w-full object-contain" />

          {/* Signal travelling down the cord */}
          {!reduce && <span className="gj-signal-dot" />}

          {/* Funnel rings brighten on hover/focus */}
          {[40, 48, 56, 63, 70].map((top, i) => (
            <span
              key={top}
              className="gj-ring"
              style={{ top: `${top}%`, width: `${62 - i * 9}%`, transitionDelay: active ? `${i * 60}ms` : "0ms", opacity: active || reduce ? 0.9 : 0, transform: `translateX(-50%) scale(${active && !reduce ? 1.04 : 1})` }}
            />
          ))}

          <ol className="pointer-events-none absolute inset-0 hidden lg:block">
            {STAGES.map(([label, top]) => (
              <li key={label} className="gj-stage" style={{ top: `${top}%` }}>
                <span className="gj-stage-line" />{label}
              </li>
            ))}
          </ol>

          <span className="gj-nba">Next Best Action</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
