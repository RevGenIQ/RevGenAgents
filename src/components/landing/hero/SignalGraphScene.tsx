"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NODE_COUNT = 96;
const PULSE_COUNT = 14;
const SHELL_RADIUS = 2.5;
const NODE_COLOR = new THREE.Color("#A5B4FC");
const HUB_COLOR = new THREE.Color("#5B4BFF");
const SIGNAL_COLOR = new THREE.Color("#F5B544");

/** Deterministic PRNG so the constellation is identical on every load. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

interface GraphData {
  nodes: THREE.Vector3[];
  edgePositions: Float32Array;
}

/** Fibonacci-sphere shell of company nodes, each linked to its two nearest neighbours. */
function buildGraph(): GraphData {
  const random = createRandom(42);
  const nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    const radius = SHELL_RADIUS * (0.78 + random() * 0.32);
    return new THREE.Vector3(Math.cos(theta) * ring * radius, y * radius * 0.82, Math.sin(theta) * ring * radius);
  });

  const segments = nodes.flatMap((node, i) => {
    const nearest = nodes
      .map((other, j) => ({ j, distance: node.distanceTo(other) }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
    return nearest.flatMap(({ j }) => [...node.toArray(), ...nodes[j].toArray()]);
  });

  return { nodes, edgePositions: new Float32Array(segments) };
}

interface Pulse {
  from: number;
  progress: number;
  speed: number;
}

function SignalGraph({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const nodeMesh = useRef<THREE.InstancedMesh>(null);
  const pulseMesh = useRef<THREE.InstancedMesh>(null);
  const hubHalo = useRef<THREE.Mesh>(null);
  const graph = useMemo(() => buildGraph(), []);
  const random = useMemo(() => createRandom(7), []);
  const pulses = useRef<Pulse[]>(
    Array.from({ length: PULSE_COUNT }, (_, i) => ({
      from: (i * 37) % NODE_COUNT,
      progress: i / PULSE_COUNT,
      speed: 0.18 + (i % 5) * 0.04,
    }))
  );
  const scratch = useMemo(() => new THREE.Object3D(), []);
  const hub = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const edgeGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(graph.edgePositions, 3));
    return geometry;
  }, [graph]);

  useFrame((state, delta) => {
    const mesh = nodeMesh.current;
    if (mesh && mesh.userData.placed !== true) {
      graph.nodes.forEach((node, i) => {
        scratch.position.copy(node);
        scratch.scale.setScalar(0.028 + (i % 4) * 0.008);
        scratch.updateMatrix();
        mesh.setMatrixAt(i, scratch.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.placed = true;
    }

    if (!animate) return;

    if (group.current) {
      group.current.rotation.y += delta * 0.07;
      const targetTilt = state.pointer.y * 0.18;
      group.current.rotation.x += (targetTilt - group.current.rotation.x) * 0.04;
    }

    if (hubHalo.current) {
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.08;
      hubHalo.current.scale.setScalar(breathe);
    }

    const pulsesMesh = pulseMesh.current;
    if (!pulsesMesh) return;
    pulses.current = pulses.current.map((pulse) => {
      const progress = pulse.progress + delta * pulse.speed;
      return progress >= 1
        ? { from: Math.floor(random() * NODE_COUNT), progress: 0, speed: 0.18 + random() * 0.16 }
        : { ...pulse, progress };
    });
    pulses.current.forEach((pulse, i) => {
      const eased = pulse.progress * pulse.progress * (3 - 2 * pulse.progress);
      scratch.position.lerpVectors(graph.nodes[pulse.from], hub, eased);
      scratch.scale.setScalar(0.045 * (1 - pulse.progress * 0.6));
      scratch.updateMatrix();
      pulsesMesh.setMatrixAt(i, scratch.matrix);
    });
    pulsesMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} rotation={[0.2, 0, 0]}>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color={NODE_COLOR} transparent opacity={0.16} />
      </lineSegments>

      <instancedMesh ref={nodeMesh} args={[undefined, undefined, NODE_COUNT]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={NODE_COLOR} transparent opacity={0.85} />
      </instancedMesh>

      <instancedMesh ref={pulseMesh} args={[undefined, undefined, PULSE_COUNT]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color={SIGNAL_COLOR} toneMapped={false} />
      </instancedMesh>

      <mesh>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshBasicMaterial color={HUB_COLOR} toneMapped={false} />
      </mesh>
      <mesh ref={hubHalo}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshBasicMaterial color={HUB_COLOR} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function SignalGraphScene({ animate }: { animate: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.4], fov: 45 }}
      dpr={[1, 1.75]}
      frameloop={animate ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      aria-hidden="true"
    >
      <SignalGraph animate={animate} />
    </Canvas>
  );
}
