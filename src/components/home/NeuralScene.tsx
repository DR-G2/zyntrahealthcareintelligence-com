import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

type Props = { active: number; reduce: boolean };

function Brain({ reduce }: { reduce: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lobes = useMemo(() => {
    const spots: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * Math.PI * 2;
      spots.push([Math.cos(a) * 0.72, 0.15 + (i % 3) * 0.12, Math.sin(a) * 0.46, 0.28 + (i % 4) * 0.04]);
    }
    return spots;
  }, []);

  useFrame((_, delta) => {
    if (!group.current || reduce) return;
    group.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={group} position={[0, 1.35, 0]}>
      <mesh>
        <sphereGeometry args={[0.92, 48, 48]} />
        <meshStandardMaterial color="#08324a" emissive="#22d3ee" emissiveIntensity={0.55} metalness={0.2} roughness={0.25} transparent opacity={0.82} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.96, 24, 24]} />
        <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.35} />
      </mesh>
      {lobes.map((spot, index) => (
        <mesh key={index} position={[spot[0], spot[1] - 0.2, spot[2]]}>
          <sphereGeometry args={[spot[3], 16, 16]} />
          <meshStandardMaterial color="#0b3b55" emissive={index % 2 ? "#38bdf8" : "#22d3ee"} emissiveIntensity={0.8} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Funnel({ active, reduce }: Props) {
  const stream = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 80;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 0.18;
      arr[i * 3 + 1] = -Math.random() * 2.4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!stream.current || reduce) return;
    const pos = stream.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      let y = pos.getY(i) - delta * 0.55;
      if (y < -2.4) y = 0.2;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={[0, 0.35, 0]}>
      {[0, 1, 2, 3, 4].map((ring) => (
        <mesh key={ring} position={[0, -ring * 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.72 - ring * 0.11, 0.015, 16, 64]} />
          <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={active === ring ? 2.4 : 0.7} />
        </mesh>
      ))}
      <points ref={stream}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e0f2fe" size={0.035} transparent opacity={0.85} />
      </points>
    </group>
  );
}

function Rig({ active, reduce }: Props) {
  const rig = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!rig.current) return;
    const targetX = reduce ? 0 : state.pointer.y * 0.28;
    const targetY = reduce ? 0.2 : state.pointer.x * 0.45;
    rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, targetX, 4, state.clock.getDelta());
    rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, targetY, 4, 1 / 60);
  });
  return (
    <group ref={rig}>
      <Float speed={reduce ? 0 : 1.4} rotationIntensity={0.15} floatIntensity={reduce ? 0 : 0.45}>
        <Brain reduce={reduce} />
        <Funnel active={active} reduce={reduce} />
      </Float>
    </group>
  );
}

export function NeuralScene({ active, reduce }: Props) {
  return (
    <Canvas camera={{ position: [0, 0.2, 4.4], fov: 42 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.35} />
      <pointLight position={[2, 2, 2]} color="#67e8f9" intensity={8} />
      <pointLight position={[-2, -1, 1]} color="#38bdf8" intensity={3} />
      <Rig active={active} reduce={reduce} />
    </Canvas>
  );
}
