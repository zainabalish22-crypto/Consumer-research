"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * The hero object: a cube of light points. Most points are faint; three glow brighter, one in
 * Signal orange, standing for the variables under study. It turns gently towards the pointer.
 * Reduced motion: the cube rests at a fixed angle and nothing pulses.
 */
const N = 5;
const S = 2.2; // cube edge length
const LIT: [number, number, number, string][] = [
  [2, 1, 2, "#ffffff"],
  [0, 3, 1, "#ffffff"],
  [4, 2, 3, "#FF6A2B"],
];

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,0.55)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const at = (i: number) => (i / (N - 1) - 0.5) * S * 0.78;

function Cube({ still, pointer }: { still: boolean; pointer: React.RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const lit = useRef<THREE.Group>(null);
  const glow = useMemo(glowTexture, []);
  const points = useMemo(() => {
    const p: number[] = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) if (!LIT.some(([a, b, c]) => a === x && b === y && c === z)) p.push(at(x), at(y), at(z));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    return g;
  }, []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(S, S, S)), []);
  const rest = useMemo(() => new THREE.Euler(-0.42, 0.62, 0), []);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const p = pointer.current ?? { x: 0, y: 0 };
    const tx = rest.x + (still ? 0 : p.y * 0.35);
    const ty = rest.y + (still ? 0 : p.x * 0.6 + t * 0.05);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, tx, 3, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ty, 3, dt);
    if (!still && lit.current)
      lit.current.children.forEach((c, i) => {
        const s = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.1 - i * 2.1));
        c.scale.setScalar(c.userData.base * s);
      });
  });

  return (
    <group ref={group} rotation={rest}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#F2F4F5" transparent opacity={0.85} />
      </lineSegments>
      {/* Inner guide planes, very faint */}
      {[-1, 1].map((s) => (
        <lineSegments key={s} position={[0, 0, (s * S) / 6]} geometry={edges} scale={[1, 1, 0.001]}>
          <lineBasicMaterial color="#CFE8F2" transparent opacity={0.08} />
        </lineSegments>
      ))}
      <points geometry={points}>
        <pointsMaterial color="#F2F4F5" size={0.045} sizeAttenuation transparent opacity={0.75} />
      </points>
      <group ref={lit}>
        {LIT.map(([x, y, z, color], i) => (
          <sprite key={i} position={[at(x), at(y), at(z)]} scale={0.42} userData={{ base: 0.42 }}>
            <spriteMaterial map={glow} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        ))}
      </group>
      {LIT.map(([x, y, z, color], i) => (
        <mesh key={i} position={[at(x), at(y), at(z)]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroCube() {
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setStill(mq.matches);
    set();
    mq.addEventListener("change", set);
    const move = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", move, { passive: true });
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (box.current) io.observe(box.current);
    return () => {
      mq.removeEventListener("change", set);
      window.removeEventListener("pointermove", move);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={box} className="absolute inset-0">
      <Canvas frameloop={visible ? "always" : "never"} dpr={[1, 2]} camera={{ position: [0, 0, 5.2], fov: 38 }} gl={{ antialias: true, alpha: true }}>
        <Cube still={still} pointer={pointer} />
      </Canvas>
    </div>
  );
}
