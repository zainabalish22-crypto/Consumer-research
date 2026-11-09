"use client";

import { Environment, useGLTF, useTexture } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Participant, type MoveInput, type Pose } from "./Avatar";
import { STORES, STREET, frontZ, type AvatarChoice, type VillageStore, type WallTexture } from "./village";

const ENV = "/proto/env";

/** Diffuse + normal + roughness set from Poly Haven, tiled `rx` × `ry` times. */
function usePbr(id: string, rx: number, ry: number) {
  const [map, normalMap, roughnessMap] = useTexture([`${ENV}/tex/${id}/diff.jpg`, `${ENV}/tex/${id}/nor.jpg`, `${ENV}/tex/${id}/rough.jpg`]);
  return useMemo(() => {
    const clone = (t: THREE.Texture) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(rx, ry);
      c.anisotropy = 8;
      c.needsUpdate = true;
      return c;
    };
    const m = clone(map);
    m.colorSpace = THREE.SRGBColorSpace;
    return { map: m, normalMap: clone(normalMap), roughnessMap: clone(roughnessMap) };
  }, [map, normalMap, roughnessMap, rx, ry]);
}

/** Text drawn on a canvas, so signs need no web font download. */
function useLabel(text: string, bg: string, fg: string, w = 1024, h = 128, font = "600 64px Georgia, 'Times New Roman', serif") {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [text, bg, fg, w, h, font]);
}

function Ground() {
  const grass = usePbr("leafy_grass", 30, 18);
  const paving = usePbr("herringbone_pavement", STREET.length / 2.5, (STREET.width + STREET.setback * 2) / 2.5);
  const depth = STREET.width + STREET.setback * 2;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[140, 90]} />
        <meshStandardMaterial {...grass} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
        <planeGeometry args={[STREET.length, depth]} />
        <meshStandardMaterial {...paving} />
      </mesh>
    </group>
  );
}

function Storefront({ store }: { store: VillageStore }) {
  const W = STREET.storeWidth;
  const H = 6.6;
  const D = STREET.storeDepth;
  const walls = usePbr(store.wall as WallTexture, W / 2.5, H / 2.5);
  const interior = useTexture(store.interiorPhoto);
  interior.colorSpace = THREE.SRGBColorSpace;
  const sign = useLabel(store.name, store.sign.bg, store.sign.fg);
  const offer = useLabel(store.offer ?? "", "#F7E27A", "#1A1A1A", 512, 256, "700 54px Arial, sans-serif");
  const rotation = store.side === -1 ? 0 : Math.PI;
  return (
    <group position={[store.x, 0, frontZ(store.side)]} rotation-y={rotation}>
      {/* Building body */}
      <mesh position={[0, H / 2, -D / 2]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial {...walls} />
      </mesh>
      {/* Cornice */}
      <mesh position={[0, H + 0.12, -D / 2 + 0.1]} castShadow>
        <boxGeometry args={[W + 0.3, 0.24, D + 0.4]} />
        <meshStandardMaterial color="#d9d4ca" roughness={0.8} />
      </mesh>
      {/* Shop window: the interior photo behind glass */}
      <mesh position={[-1, 1.75, 0.02]}>
        <planeGeometry args={[5.4, 2.7]} />
        <meshStandardMaterial map={interior} emissive="#ffffff" emissiveMap={interior} emissiveIntensity={0.25} roughness={0.9} />
      </mesh>
      <mesh position={[-1, 1.75, 0.06]}>
        <planeGeometry args={[5.4, 2.7]} />
        <meshPhysicalMaterial color="#9fb3bf" transparent opacity={0.16} roughness={0.05} metalness={0.1} clearcoat={1} />
      </mesh>
      {/* Window frame */}
      {[
        [-1, 3.15, 5.7, 0.12],
        [-1, 0.35, 5.7, 0.12],
        [-3.76, 1.75, 0.12, 2.9],
        [1.76, 1.75, 0.12, 2.9],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.08]} castShadow>
          <boxGeometry args={[w, h, 0.12]} />
          <meshStandardMaterial color="#1f2124" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[3, 1.25, 0.04]}>
        <planeGeometry args={[1.5, 2.5]} />
        <meshPhysicalMaterial color="#15181b" roughness={0.1} metalness={0.3} clearcoat={1} />
      </mesh>
      <mesh position={[3, 2.55, 0.08]}>
        <boxGeometry args={[1.7, 0.1, 0.12]} />
        <meshStandardMaterial color="#1f2124" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Offer poster inside the window */}
      {store.offer && (
        <mesh position={[0.8, 1.2, 0.05]}>
          <planeGeometry args={[1.3, 0.65]} />
          <meshStandardMaterial map={offer} roughness={0.8} />
        </mesh>
      )}
      {/* Sign band */}
      <mesh position={[0, 3.75, 0.05]}>
        <planeGeometry args={[7.2, 0.9]} />
        <meshStandardMaterial map={sign} roughness={0.6} />
      </mesh>
      {/* Awning */}
      <mesh position={[-1, 3.25, 0.6]} rotation-x={0.32} castShadow>
        <boxGeometry args={[5.8, 0.06, 1.3]} />
        <meshStandardMaterial color={store.awning} roughness={0.95} />
      </mesh>
      {/* Upper floor windows */}
      {[-2.8, 0, 2.8].map((x) => (
        <group key={x} position={[x, 5.15, 0.03]}>
          <mesh>
            <planeGeometry args={[1.3, 1.5]} />
            <meshPhysicalMaterial color="#2a3238" roughness={0.08} metalness={0.4} clearcoat={1} />
          </mesh>
          <mesh position={[0, -0.82, 0.06]}>
            <boxGeometry args={[1.5, 0.08, 0.2]} />
            <meshStandardMaterial color="#d9d4ca" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Prop({ id, position, rotation = 0, scale = 1 }: { id: string; position: [number, number, number]; rotation?: number; scale?: number }) {
  const { scene } = useGLTF(`${ENV}/models/${id}/${id}.gltf`);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={obj} position={position} rotation-y={rotation} scale={scale} />;
}

/** Garden dressing along both kerbs: planters, shrubs, flowers, lamps, benches, a café table. */
function Garden() {
  const edge = STREET.width / 2 + 0.7;
  const items: { id: string; p: [number, number, number]; r?: number; s?: number }[] = [];
  for (let x = -28; x <= 28; x += 8) {
    items.push({ id: "street_lamp_01", p: [x, 0, -edge], r: 0 });
    items.push({ id: "street_lamp_01", p: [x + 4, 0, edge], r: Math.PI });
  }
  for (let x = -30; x <= 30; x += 4.5) {
    if (Math.abs(x % 9) < 0.01) continue;
    items.push({ id: x % 2 === 0 ? "shrub_02" : "shrub_03", p: [x, 0, -(STREET.width / 2 + STREET.setback + 0.2) - 0.1], r: x });
  }
  items.push({ id: "planter_box_02", p: [-13.5, 0, -edge + 0.2] }, { id: "planter_box_02", p: [4.5, 0, -edge + 0.2] }, { id: "planter_box_02", p: [-4.5, 0, edge - 0.2] });
  items.push({ id: "potted_plant_02", p: [-15, 0, -STREET.width / 2 - STREET.setback + 0.6] }, { id: "potted_plant_02", p: [21, 0, -STREET.width / 2 - STREET.setback + 0.6] });
  items.push({ id: "painted_wooden_bench", p: [-6, 0, -edge + 0.4], r: 0 }, { id: "painted_wooden_bench", p: [13, 0, edge - 0.4], r: Math.PI });
  items.push({ id: "outdoor_table_chair_set_01", p: [3.5, 0, -STREET.width / 2 - 1.2], r: 0.3 });
  for (let x = -26; x <= 26; x += 13) items.push({ id: "flower_gazania", p: [x + 2, 0, edge + 0.2], s: 1.6 });
  return (
    <group>
      {items.map((it, i) => (
        <Prop key={i} id={it.id} position={it.p} rotation={it.r} scale={it.s} />
      ))}
    </group>
  );
}

function FpsProbe({ onSample }: { onSample: (fps: number) => void }) {
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt;
    acc.current.n += 1;
    if (acc.current.t >= 1) {
      onSample(Math.round(acc.current.n / acc.current.t));
      acc.current = { t: 0, n: 0 };
    }
  });
  return null;
}

/** Mounts once everything inside the Suspense boundary has loaded. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

export default function VillageScene({
  avatar,
  input,
  pose,
  high,
  onFps,
  onReady,
}: {
  avatar: AvatarChoice;
  input: React.RefObject<MoveInput>;
  pose: React.RefObject<Pose>;
  high: boolean;
  onFps: (fps: number) => void;
  onReady: () => void;
}) {
  return (
    <Canvas shadows={high} dpr={high ? [1, 1.75] : [1, 1.25]} camera={{ fov: 55, near: 0.1, far: 300, position: [0, 2.5, 8] }} gl={{ antialias: high }}>
      <Suspense fallback={null}>
        <Environment files={`${ENV}/sunny_rose_garden_2k.hdr`} background environmentIntensity={0.9} />
        <directionalLight
          position={[18, 26, 12]}
          intensity={2.4}
          castShadow={high}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-36}
          shadow-camera-right={36}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-bias={-0.0004}
        />
        <Ground />
        {STORES.map((s) => (
          <Storefront key={s.id} store={s} />
        ))}
        <Garden />
        <Participant avatar={avatar} input={input} pose={pose} />
        <Ready onReady={onReady} />
      </Suspense>
      <FpsProbe onSample={onFps} />
    </Canvas>
  );
}
