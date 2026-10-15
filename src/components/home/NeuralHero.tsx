import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState, type PointerEvent } from "react";

/**
 * One coherent assembly: brain hemispheres -> spinal cord -> glass funnel (Next Best Action).
 * Pure SVG + Framer Motion, so it renders without WebGL. Reduced motion disables float, signal and parallax.
 */
const CORD = "M200 214 C200 246 198 270 200 300 C202 330 199 356 200 386";
const RINGS = [
  { cy: 392, rx: 92, ry: 16 },
  { cy: 420, rx: 70, ry: 12 },
  { cy: 446, rx: 50, ry: 9 },
  { cy: 468, rx: 32, ry: 6 },
];
const LEFT_GYRI = [
  "M190 70 C160 58 120 66 104 92",
  "M186 96 C150 86 118 98 100 126",
  "M184 124 C150 116 112 130 98 160",
  "M184 152 C152 148 122 160 112 188",
  "M180 180 C160 180 140 190 132 208",
  "M150 70 C142 92 150 108 134 126",
  "M124 138 C138 150 132 168 146 178",
];
const mirror = (d: string) => d.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (_, x, y) => `${400 - Number(x)} ${y}`);

export function NeuralHero() {
  const reduce = useReducedMotion();
  const [fine, setFine] = useState(false);
  const [active, setActive] = useState(false);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 }), sy = useSpring(my, { stiffness: 60, damping: 18 });
  const x = useTransform(sx, v => v * 8), y = useTransform(sy, v => v * 8);
  const rotate = useTransform(sx, v => v * 3);

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
      aria-label="Brain connected by a spinal cord to a funnel labelled Next Best Action"
    >
      <motion.div className="h-full w-full" style={parallax ? { x, y, rotate } : undefined}>
        <motion.svg
          viewBox="0 0 400 500"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
          animate={reduce ? undefined : { y: [0, -6, 0, 6, 0] }}
          transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <defs>
            <radialGradient id="gj-brain" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="hsl(var(--gj-cyan))" stopOpacity=".38" />
              <stop offset="70%" stopColor="hsl(var(--gj-teal))" stopOpacity=".14" />
              <stop offset="100%" stopColor="hsl(var(--gj-teal))" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="gj-cord" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--gj-cyan))" />
              <stop offset="100%" stopColor="hsl(var(--gj-teal))" />
            </linearGradient>
            <linearGradient id="gj-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--gj-cyan))" stopOpacity=".22" />
              <stop offset="100%" stopColor="hsl(var(--gj-cyan))" stopOpacity=".03" />
            </linearGradient>
            <filter id="gj-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <ellipse cx="200" cy="140" rx="170" ry="130" fill="url(#gj-brain)" />

          {/* Hemispheres */}
          <g filter="url(#gj-glow)" strokeLinecap="round" fill="none">
            <path d="M196 52 C140 40 78 70 72 132 C68 182 104 214 150 214 C172 214 188 206 196 196 Z" fill="hsl(var(--gj-glass))" stroke="hsl(var(--gj-cyan))" strokeOpacity=".85" strokeWidth="1.6" />
            <path d="M204 52 C260 40 322 70 328 132 C332 182 296 214 250 214 C228 214 212 206 204 196 Z" fill="hsl(var(--gj-glass))" stroke="hsl(var(--gj-cyan))" strokeOpacity=".85" strokeWidth="1.6" />
            {LEFT_GYRI.map(d => <path key={d} d={d} stroke="hsl(var(--gj-cyan))" strokeOpacity=".55" strokeWidth="1.2" />)}
            {LEFT_GYRI.map(d => <path key={`r${d}`} d={mirror(d)} stroke="hsl(var(--gj-cyan))" strokeOpacity=".55" strokeWidth="1.2" />)}
          </g>

          {/* Spinal cord with vertebral ticks */}
          <path d="M188 200 C192 214 196 220 200 222 C204 220 208 214 212 200" fill="none" stroke="hsl(var(--gj-cyan))" strokeOpacity=".7" strokeWidth="1.4" />
          <path d={CORD} fill="none" stroke="url(#gj-cord)" strokeWidth="5" strokeOpacity=".35" strokeLinecap="round" />
          <path d={CORD} fill="none" stroke="hsl(var(--gj-cyan))" strokeWidth="1.4" filter="url(#gj-glow)" />
          {[240, 268, 296, 324, 352].map((cy, i) => (
            <line key={cy} x1={200 - (9 - i)} x2={200 + (9 - i)} y1={cy} y2={cy} stroke="hsl(var(--gj-line))" strokeOpacity=".5" strokeWidth="1" />
          ))}

          {/* Signal travelling down the cord */}
          {!reduce && (
            <circle r="4" fill="hsl(var(--gj-cyan))" filter="url(#gj-glow)" className="gj-signal" style={{ offsetPath: `path("${CORD}")` }} />
          )}

          {/* Glass funnel */}
          <path d="M108 392 C130 430 168 462 186 472 L214 472 C232 462 270 430 292 392 Z" fill="url(#gj-glass)" stroke="hsl(var(--gj-cyan))" strokeOpacity=".35" strokeWidth="1" />
          {RINGS.map((ring, i) => (
            <motion.ellipse
              key={ring.cy}
              cx="200" cy={ring.cy} rx={ring.rx} ry={ring.ry}
              fill="none" stroke="hsl(var(--gj-cyan))" strokeWidth="1.2"
              initial={false}
              animate={{ strokeOpacity: active || reduce ? 0.95 : 0.5, scale: active && !reduce ? 1.04 : 1 }}
              transition={{ delay: active ? i * 0.06 : 0, duration: 0.35 }}
              style={{ transformOrigin: `200px ${ring.cy}px` }}
            />
          ))}
          <text x="200" y="496" textAnchor="middle" className="gj-label" fill="hsl(var(--gj-cyan))">NEXT BEST ACTION</text>
        </motion.svg>
      </motion.div>
    </div>
  );
}
