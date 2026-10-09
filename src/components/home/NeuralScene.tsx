import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function Assembly({ active, reduce }: { active: number; reduce: boolean }) {
  const rig = useRef<THREE.Group>(null);
  const stream = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 70;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 0.12;
      arr[i * 3 + 1] = 1.1 - Math.random() * 2.6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }
    return arr;
  }, []);
  const lobes = useMemo(() => [
    [-0.42, 1.72, 0.08, 0.46],
    [0.42, 1.72, 0.08, 0.46],
    [-0.18, 1.95, -0.05, 0.28],
    [0.18, 1.95, -0.05, 0.28],
    [0, 1.48, 0.18, 0.22],
  ] as const, []);

  useFrame((state, delta) => {
    if (rig.current) {
      const tx = reduce ? 0 : state.pointer.y * 0.22;
      const ty = reduce ? 0.15 : state.pointer.x * 0.4;
      rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, tx, 3.5, delta);
      rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, ty, 3.5, delta);
    }
    if (!stream.current || reduce) return;
    const pos = stream.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      let y = pos.getY(i) - delta * 0.45;
      if (y < -1.45) y = 1.05;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return (
    <group ref={rig}>
      <Float speed={reduce ? 0 : 1.2} floatIntensity={reduce ? 0 : 0.35} rotationIntensity={0.05}>
        {lobes.map((lobe, index) => (
          <mesh key={index} position={[lobe[0], lobe[1], lobe[2]]}>
            <sphereGeometry args={[lobe[3], 32, 32]} />
            <meshStandardMaterial color="#0b3c58" emissive="#22d3ee" emissiveIntensity={0.7} roughness={0.32} />
          </mesh>
        ))}
        <mesh position={[0, 1.78, 0]}>
          <sphereGeometry args={[0.86, 20, 20]} />
          <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.28} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.16, 0.08, 1.35, 24]} />
          <meshStandardMaterial color="#08344c" emissive="#22d3ee" emissiveIntensity={1.1} />
        </mesh>
        {[0, 1, 2, 3, 4].map((ring) => (
          <mesh key={ring} position={[0, -0.15 - ring * 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.62 - ring * 0.09, 0.018, 12, 48]} />
            <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={active === ring ? 2.2 : 0.55} />
          </mesh>
        ))}
        <points ref={stream}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#e0f2fe" size={0.03} transparent opacity={0.8} />
        </points>
      </Float>
    </group>
  );
}

export function NeuralScene({ active, reduce }: { active: number; reduce: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0.35, 4.6], fov: 40 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[1.5, 2, 2]} color="#67e8f9" intensity={7} />
      <Assembly active={active} reduce={reduce} />
    </Canvas>
  );
}
