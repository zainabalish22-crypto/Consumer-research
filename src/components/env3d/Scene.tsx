"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Participant, type MoveInput, type Pose } from "./Avatar";
import { ENV } from "./kit";
import type { SceneDef } from "./scenes";
import { SETS, type Placed } from "./sets";
import type { AvatarChoice } from "./village";

function FpsProbe({ onSample }: { onSample: (fps: number) => void }) {
  const acc = useRef({ t: 0, n: 0 });
  useFrame(({ gl }, dt) => {
    // Prototype diagnostics: draw calls and triangles per frame, readable from the console.
    (window as unknown as { __tessRender?: unknown }).__tessRender = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, textures: gl.info.memory.textures, geometries: gl.info.memory.geometries };
    acc.current.t += dt;
    acc.current.n += 1;
    if (acc.current.t >= 1) {
      onSample(Math.round(acc.current.n / acc.current.t));
      acc.current = { t: 0, n: 0 };
    }
  });
  return null;
}

/**
 * Screen point to what is under it: a store (tap to enter) or a walkable floor (tap to walk).
 * The page calls this through `pick`.
 */
export type PickResult = { store: string } | { ground: [number, number] } | null;
export type PickFn = (clientX: number, clientY: number) => PickResult;
function Picker({ pick }: { pick: React.RefObject<PickFn | null> }) {
  const { camera, gl, scene } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  useEffect(() => {
    pick.current = (cx, cy) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.storeId) o = o.parent;
        if (o) return { store: o.userData.storeId as string };
        if (hit.object.userData.walkable) return { ground: [hit.point.x, hit.point.z] };
      }
      return null;
    };
    return () => {
      pick.current = null;
    };
  }, [camera, gl, scene, ray, pick]);
  return null;
}

/** A soft ring on the ground where the participant tapped to walk; hidden when there is no target. */
function GoalMarker({ input }: { input: React.RefObject<MoveInput> }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const g = input.current?.goto;
    const m = ring.current;
    if (!m) return;
    m.visible = !!g && !g.store;
    if (g) {
      m.position.set(g.x, 0.2, g.z);
      const s = 1 + 0.08 * Math.sin(clock.elapsedTime * 5);
      m.scale.set(s, s, s);
    }
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.32, 0.42, 48]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthTest={false} />
    </mesh>
  );
}

const SHADOW_RANGE = 16; // metres around the figure that receive shadows
const SHADOW_MAP = 1024;

/**
 * The sun. Its shadow covers only the area around the participant and moves with them, so
 * the shadow pass draws a few nearby objects instead of the whole scene, and shadows are
 * sharper. The shadow area moves in whole-texel steps, which stops shadow edges crawling.
 */
function Sun({ scene, pose, shadows }: { scene: SceneDef; pose: React.RefObject<Pose>; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const basis = useMemo(() => {
    const dir = new THREE.Vector3(...scene.sun.position).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    return { dir, right, up, c: new THREE.Vector3() };
  }, [scene]);
  useFrame(() => {
    const l = light.current;
    const p = pose.current;
    if (!l || !p) return;
    const { dir, right, up, c } = basis;
    const texel = (SHADOW_RANGE * 2) / SHADOW_MAP;
    c.set(p.x, 0, p.z);
    const u = c.dot(right);
    const v = c.dot(up);
    c.addScaledVector(right, Math.round(u / texel) * texel - u).addScaledVector(up, Math.round(v / texel) * texel - v);
    l.target.position.copy(c);
    l.target.updateMatrixWorld();
    l.position.copy(c).addScaledVector(dir, 50);
  });
  return (
    <directionalLight
      ref={light}
      position={scene.sun.position}
      intensity={scene.sun.intensity}
      color={scene.sun.color ?? "#ffffff"}
      castShadow={shadows}
      shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
      shadow-camera-left={-SHADOW_RANGE}
      shadow-camera-right={SHADOW_RANGE}
      shadow-camera-top={SHADOW_RANGE}
      shadow-camera-bottom={-SHADOW_RANGE}
      shadow-camera-near={1}
      shadow-camera-far={110}
      shadow-bias={-0.0004}
    />
  );
}

/**
 * Keeps walking smooth on slower devices. If the scene runs below about 40 frames a second
 * for a few seconds, quality steps down once (slightly lower resolution), then once more
 * (no shadows). It only ever steps down, so the picture never flickers between settings, and
 * it only measures while the page is visible and focused, because browsers slow hidden or
 * background pages on purpose.
 */
function AutoQuality({ onLevel }: { onLevel: (level: number) => void }) {
  const s = useRef({ t: 0, n: 0, slow: 0, level: 0, warm: 0 });
  useFrame((_, dt) => {
    const a = s.current;
    if (a.level >= 2 || document.visibilityState !== "visible" || !document.hasFocus() || dt > 0.25) {
      a.t = 0;
      a.n = 0;
      return;
    }
    // Ignore the first seconds, while textures upload and shaders compile.
    if (a.warm < 4) {
      a.warm += dt;
      return;
    }
    a.t += dt;
    a.n += 1;
    if (a.t < 2) return;
    const fps = a.n / a.t;
    a.t = 0;
    a.n = 0;
    a.slow = fps < 40 ? a.slow + 1 : 0;
    if (a.slow >= 2) {
      a.slow = 0;
      a.warm = 2;
      a.level += 1;
      onLevel(a.level);
    }
  });
  return null;
}

/** Mounts once everything inside the Suspense boundary has loaded. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/**
 * The 3D environment for one scene. Memoised so page updates (the fps readout, store cards,
 * the event log) never re-render the 3D tree; all props are stable refs or callbacks.
 */
export default memo(function EnvironmentScene({
  scene,
  placed,
  avatar,
  input,
  pose,
  high,
  onFps,
  onReady,
  pick,
}: {
  scene: SceneDef;
  placed: Placed[];
  avatar: AvatarChoice;
  input: React.RefObject<MoveInput>;
  pose: React.RefObject<Pose>;
  high: boolean;
  onFps: (fps: number) => void;
  onReady: () => void;
  pick: React.RefObject<PickFn | null>;
}) {
  // Sharpness: never more pixels than the screen really has (drawing 1.5× on a 1.25× screen
  // was wasted work), capped at 1.5×. `level` is the automatic step-down for slow devices.
  const [level, setLevel] = useState(0);
  const device = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const dpr = !high ? 1 : level === 0 ? Math.min(device, 1.5) : 1;
  const shadows = high && level < 2;
  const Set = SETS[scene.id];
  const night = scene.time === "night";
  return (
    <Canvas shadows={high} dpr={dpr} camera={{ fov: 55, near: 0.1, far: 400, position: [0, 2.5, 8] }} gl={{ antialias: high, powerPreference: "high-performance", toneMappingExposure: night ? 1.15 : 1 }}>
      {scene.bg && <color attach="background" args={[scene.bg]} />}
      <Suspense fallback={null}>
        <Environment files={`${ENV}/${scene.hdri}`} background={scene.sky} environmentIntensity={scene.envIntensity} backgroundRotation={[0, scene.hdriRotation ?? 0, 0]} environmentRotation={[0, scene.hdriRotation ?? 0, 0]} />
        <hemisphereLight args={[night ? "#9fb2d6" : "#ffffff", night ? "#1a1612" : "#8a8172", scene.setting === "indoor" ? 0.55 : night ? 0.35 : 0.15]} />
        <Sun scene={scene} pose={pose} shadows={shadows} />
        <Set scene={scene} placed={placed} />
        <Participant avatar={avatar} input={input} pose={pose} />
        <GoalMarker input={input} />
        <Ready onReady={onReady} />
      </Suspense>
      <FpsProbe onSample={onFps} />
      {high && <AutoQuality onLevel={setLevel} />}
      <Picker pick={pick} />
    </Canvas>
  );
});
