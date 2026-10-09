import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type AssemblyProps = { active: number; reduce: boolean };

function makeBrainGeometry(side: -1 | 1) {
  const geometry = new THREE.SphereGeometry(0.72, 72, 56);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const original = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    original.fromBufferAttribute(position, i);
    const x = original.x;
    const y = original.y;
    const z = original.z;
    const folds =
      Math.sin(y * 22 + z * 7) * 0.018 +
      Math.sin(z * 25 - y * 9) * 0.014 +
      Math.sin(x * 29 + y * 13) * 0.012;
    const hemisphereGap = Math.max(0, 0.075 - Math.abs(x)) * 0.75;
    const scale = 1 + folds;
    position.setXYZ(
      i,
      (x * scale + side * hemisphereGap) * 0.92,
      y * scale * 0.94,
      z * scale * 0.84
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

function makeGyri(side: -1 | 1) {
  const curves: THREE.Vector3[][] = [];
  for (let i = 0; i < 13; i += 1) {
    const y = -0.43 + i * 0.071;
    const points: THREE.Vector3[] = [];
    for (let j = 0; j <= 28; j += 1) {
      const t = j / 28;
      const x = side * (0.13 + 0.49 * Math.sin(t * Math.PI));
      const yy = y + Math.sin(t * Math.PI * 3 + i * 0.7) * 0.065;
      const z = 0.62 * Math.cos((t - 0.5) * Math.PI) * Math.cos(y * 1.2);
      points.push(new THREE.Vector3(x, 1.72 + yy, z + 0.02));
    }
    curves.push(points);
  }
  return curves;
}

function BrainHemisphere({ side }: { side: -1 | 1 }) {
  const brainGeometry = useMemo(() => makeBrainGeometry(side), [side]);
  const gyri = useMemo(() => makeGyri(side), [side]);
  const lineMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#5eeaff", transparent: true, opacity: 0.58 }),
    []
  );

  return (
    <group>
      <mesh geometry={brainGeometry} position={[side * 0.31, 1.72, 0]}>
        <meshPhysicalMaterial
          color="#0a4566"
          emissive="#087fa5"
          emissiveIntensity={0.8}
          roughness={0.26}
          metalness={0.18}
          transparent
          opacity={0.78}
          clearcoat={0.8}
        />
      </mesh>
      {gyri.map((points, index) => {
        const curve = new THREE.CatmullRomCurve3(points);
        return (
          <mesh key={index} geometry={new THREE.TubeGeometry(curve, 36, 0.009, 5, false)} material={lineMaterial} />
        );
      })}
    </group>
  );
}

function Assembly({ active, reduce }: AssemblyProps) {
  const rig = useRef<THREE.Group>(null);
  const signal = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const rings = useMemo(
    () => [0, 1, 2, 3, 4].map((index) => ({
      y: 0.22 - index * 0.31,
      radius: 0.56 - index * 0.085,
    })),
    []
  );
  const cordCurve = useMemo(
    () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.26, 0),
      new THREE.Vector3(0.025, 0.91, 0),
      new THREE.Vector3(-0.018, 0.54, 0),
      new THREE.Vector3(0.012, 0.16, 0),
      new THREE.Vector3(0, -0.38, 0),
      new THREE.Vector3(0, -0.88, 0),
      new THREE.Vector3(0, -1.23, 0),
    ]),
    []
  );
  const cordGeometry = useMemo(() => new THREE.TubeGeometry(cordCurve, 96, 0.07, 12, false), [cordCurve]);
  const particles = useMemo(() => {
    const count = 46;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 0.045;
      positions[i * 3 + 1] = -1.25 + Math.random() * 2.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.045;
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    if (rig.current) {
      const targetX = reduce ? 0 : -state.pointer.y * 0.18;
      const targetY = reduce ? 0 : state.pointer.x * 0.28;
      rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, targetX, 3.2, delta);
      rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, targetY, 3.2, delta);
      const targetYPosition = reduce ? 0 : Math.sin(state.clock.elapsedTime * 0.7) * 0.035;
      rig.current.position.y = THREE.MathUtils.damp(rig.current.position.y, targetYPosition, 2.5, delta);
    }

    if (signal.current) {
      if (reduce) {
        signal.current.visible = false;
      } else {
        signal.current.visible = true;
        phase.current = (phase.current + delta * 0.42) % 1;
        signal.current.position.copy(cordCurve.getPoint(phase.current));
      }
    }
  });

  return (
    <group ref={rig}>
      <group>
        <BrainHemisphere side={-1} />
        <BrainHemisphere side={1} />
        <mesh position={[0, 1.1, 0]}>
          <capsuleGeometry args={[0.12, 0.36, 8, 16]} />
          <meshPhysicalMaterial color="#0a6380" emissive="#22d3ee" emissiveIntensity={1.05} roughness={0.24} transparent opacity={0.88} />
        </mesh>
        <mesh geometry={cordGeometry}>
          <meshPhysicalMaterial color="#0b5575" emissive="#22d3ee" emissiveIntensity={1.2} roughness={0.22} transparent opacity={0.72} clearcoat={1} />
        </mesh>
        <mesh geometry={new THREE.TubeGeometry(cordCurve, 96, 0.018, 8, false)}>
          <meshBasicMaterial color="#b6f7ff" transparent opacity={0.85} />
        </mesh>
        <mesh ref={signal}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshBasicMaterial color="#f0feff" />
        </mesh>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[particles, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#67e8f9" size={0.025} transparent opacity={reduce ? 0 : 0.72} />
        </points>
        {rings.map((ring, index) => (
          <mesh key={index} position={[0, ring.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[ring.radius, active === index ? 0.027 : 0.012, 12, 72]} />
            <meshStandardMaterial
              color={active === index ? "#b7fbff" : "#22d3ee"}
              emissive={active === index ? "#22d3ee" : "#087e9d"}
              emissiveIntensity={active === index ? 2.5 : 0.75}
              metalness={0.3}
              roughness={0.24}
            />
          </mesh>
        ))}
        <mesh position={[0, -1.48, 0]}>
          <cylinderGeometry args={[0.49, 0.36, 0.18, 48, 1, false]} />
          <meshPhysicalMaterial color="#06243a" emissive="#036b86" emissiveIntensity={0.75} metalness={0.6} roughness={0.22} transparent opacity={0.95} />
        </mesh>
        <mesh position={[0, -1.385, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.43, 0.018, 10, 64]} />
          <meshBasicMaterial color="#67e8f9" />
        </mesh>
      </group>
    </group>
  );
}

export function NeuralScene({ active, reduce }: AssemblyProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.28, 5.15], fov: 38 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      fallback={<div className="h-full w-full rounded-3xl border border-cyan-400/20 bg-cyan-950/20" aria-label="Static neural intelligence illustration" />}
    >
      <ambientLight intensity={0.62} />
      <pointLight position={[1.5, 2.5, 2.5]} color="#67e8f9" intensity={5} />
      <pointLight position={[-2, 1, -1]} color="#2563eb" intensity={2.5} />
      <Assembly active={active} reduce={reduce} />
    </Canvas>
  );
}
