"use client";

/** Shared building blocks for the scene sets: textures, signs, photos, models, lights, water. */
import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export const ENV = "/proto/env";

/** Poly Haven surface (diffuse, normal, roughness) tiled `rx` × `ry` times. */
export function usePbr(id: string, rx: number, ry: number) {
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
export function useLabel(text: string, bg: string, fg: string, w = 1024, h = 128, font = "600 64px Georgia, 'Times New Roman', serif") {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    if (bg === "transparent") g.clearRect(0, 0, w, h);
    else {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines = text.split("\n");
    const lh = h / (lines.length + 0.4);
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh + 4));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [text, bg, fg, w, h, font]);
}

/** A sign panel. `glow` makes it self-lit (backlit signs, screens). */
export function Sign({ text, bg, fg, size, position, font, glow = 0, px = [1024, 128], transparent = false }: { text: string; bg: string; fg: string; size: [number, number]; position: [number, number, number]; font?: string; glow?: number; px?: [number, number]; transparent?: boolean }) {
  const tex = useLabel(text, bg, fg, px[0], px[1], font);
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} transparent={transparent} emissive={glow ? "#ffffff" : "#000000"} emissiveMap={glow ? tex : null} emissiveIntensity={glow} roughness={0.55} />
    </mesh>
  );
}

/** A researcher photo on a plane; `glow` lifts it like a lit window or a screen. */
export function Photo({ src, size, position, rotation, glow = 0.25, rough = 0.9 }: { src: string; size: [number, number]; position: [number, number, number]; rotation?: [number, number, number]; glow?: number; rough?: number }) {
  const t = useTexture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={t} emissive="#ffffff" emissiveMap={t} emissiveIntensity={glow} roughness={rough} />
    </mesh>
  );
}

/** Glass pane in front of a window photo. */
export function Glass({ size, position }: { size: [number, number]; position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshStandardMaterial color="#9fb3bf" transparent opacity={0.14} roughness={0.04} metalness={0.2} depthWrite={false} />
    </mesh>
  );
}

/** A plain box, for frames, counters, posts and panels. */
export function Box({ size, position, color, rough = 0.6, metal = 0, rotation, emissive, cast = false }: { size: [number, number, number]; position: [number, number, number]; color: string; rough?: number; metal?: number; rotation?: [number, number, number]; emissive?: number; cast?: boolean }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ? color : "#000000"} emissiveIntensity={emissive ?? 0} toneMapped={!emissive} />
    </mesh>
  );
}

/** Window frame: four bars around a w × h opening centred at (x, y). */
export function Frame({ x, y, w, h, t = 0.12, color = "#1f2124", z = 0.08 }: { x: number; y: number; w: number; h: number; t?: number; color?: string; z?: number }) {
  const bars: [number, number, number, number][] = [
    [x, y + h / 2, w + t, t],
    [x, y - h / 2, w + t, t],
    [x - w / 2, y, t, h + t],
    [x + w / 2, y, t, h + t],
  ];
  return (
    <>
      {bars.map(([bx, by, bw, bh], i) => (
        <mesh key={i} position={[bx, by, z]}>
          <boxGeometry args={[bw, bh, t]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
    </>
  );
}

/** A Poly Haven model (simplified copy in models-lite). Props never cast shadows, for speed. */
export function Prop({ id, position, rotation = 0, scale = 1 }: { id: string; position: [number, number, number]; rotation?: number; scale?: number | [number, number, number] }) {
  const { scene } = useGLTF(`${ENV}/models-lite/${id}/${id}.gltf`);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = false;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={obj} position={position} rotation-y={rotation} scale={scale} />;
}

/** A floor surface. `walkable` makes taps on it walk the participant there. */
export function Floor({ tex, size, tile = 2.5, position = [0, 0, 0], walkable = false, rough, color }: { tex: string; size: [number, number]; tile?: number; position?: [number, number, number]; walkable?: boolean; rough?: number; color?: string }) {
  const pbr = usePbr(tex, size[0] / tile, size[1] / tile);
  return (
    <mesh rotation-x={-Math.PI / 2} position={position} receiveShadow userData={walkable ? { walkable: true } : undefined}>
      <planeGeometry args={size} />
      <meshStandardMaterial {...pbr} color={color ?? "#ffffff"} roughnessMap={rough === undefined ? pbr.roughnessMap : null} roughness={rough ?? 1} envMapIntensity={rough !== undefined ? 1.2 : 1} />
    </mesh>
  );
}

/** A textured wall (box) using a Poly Haven surface. */
export function Wall({ tex, size, position, tile = 2.5, rotation, color }: { tex: string; size: [number, number, number]; position: [number, number, number]; tile?: number; rotation?: [number, number, number]; color?: string }) {
  const pbr = usePbr(tex, Math.max(size[0], size[2]) / tile, size[1] / tile);
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...pbr} color={color ?? "#ffffff"} />
    </mesh>
  );
}

/** Many small warm bulbs along straight runs, as one instanced mesh (string lights, LED rows). */
export function Bulbs({ runs, color = "#ffd59a", size = 0.05, sag = 0.25 }: { runs: { from: [number, number, number]; to: [number, number, number]; n: number }[]; color?: string; size?: number; sag?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = runs.reduce((s, r) => s + r.n, 0);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let i = 0;
    for (const r of runs) {
      for (let k = 0; k < r.n; k++) {
        const t = r.n === 1 ? 0.5 : k / (r.n - 1);
        o.position.set(r.from[0] + (r.to[0] - r.from[0]) * t, r.from[1] + (r.to[1] - r.from[1]) * t - Math.sin(t * Math.PI) * sag, r.from[2] + (r.to[2] - r.from[2]) * t);
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }, [runs, sag]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[size, 8, 6]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

/** Lit office windows for tower facades at dusk: a seeded grid, some lit warm, some cool, some dark. */
export function useWindowGrid(seed: number, cols = 8, rows = 20) {
  return useMemo(() => {
    const W = 256;
    const H = 512;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0b0f14";
    g.fillRect(0, 0, W, H);
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const cw = W / cols;
    const rh = H / rows;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const r = rnd();
        g.fillStyle = r < 0.35 ? "#ffe2b0" : r < 0.5 ? "#cfe8f2" : r < 0.62 ? "#5d6b78" : "#16202a";
        g.globalAlpha = r < 0.5 ? 0.75 + rnd() * 0.25 : 1;
        g.fillRect(x * cw + 3, y * rh + 3, cw - 6, rh - 6);
      }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [seed, cols, rows]);
}

/** Moving water: a reflective plane whose normal map drifts slowly. */
export function Water({ size, position }: { size: [number, number]; position: [number, number, number] }) {
  const normal = useMemo(() => {
    const N = 256;
    const data = new Uint8Array(N * N * 4);
    const h = (x: number, y: number) =>
      Math.sin((x / N) * Math.PI * 2 * 3 + (y / N) * Math.PI * 2 * 2) * 0.5 +
      Math.sin((x / N) * Math.PI * 2 * 7 - (y / N) * Math.PI * 2 * 5) * 0.25 +
      Math.sin((x / N) * Math.PI * 2 * 13 + (y / N) * Math.PI * 2 * 11) * 0.12;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dx = h(x + 1, y) - h(x - 1, y);
        const dy = h(x, y + 1) - h(x, y - 1);
        const n = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize();
        const i = (y * N + x) * 4;
        data[i] = (n.x * 0.5 + 0.5) * 255;
        data[i + 1] = (n.y * 0.5 + 0.5) * 255;
        data[i + 2] = (n.z * 0.5 + 0.5) * 255;
        data[i + 3] = 255;
      }
    const t = new THREE.DataTexture(data, N, N);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(size[0] / 6, size[1] / 6);
    t.needsUpdate = true;
    return t;
  }, [size]);
  useFrame((_, dt) => {
    normal.offset.x += dt * 0.012;
    normal.offset.y += dt * 0.008;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={position}>
      <planeGeometry args={size} />
      <meshStandardMaterial color="#1d4652" roughness={0.08} metalness={0.15} normalMap={normal} normalScale={new THREE.Vector2(0.35, 0.35)} envMapIntensity={1.4} />
    </mesh>
  );
}
