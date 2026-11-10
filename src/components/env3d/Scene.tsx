"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, memo, useEffect, useMemo, useRef } from "react";
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
  // Fixed sharpness per quality setting. (Automatic adjustment misread throttled background
  // tabs as slow devices and blurred the picture, so the participant or researcher chooses.)
  const dpr = high ? 1.5 : 1;
  const Set = SETS[scene.id];
  const half = scene.length / 2 + 6;
  const night = scene.time === "night";
  return (
    <Canvas shadows={high} dpr={dpr} camera={{ fov: 55, near: 0.1, far: 400, position: [0, 2.5, 8] }} gl={{ antialias: high, powerPreference: "high-performance", toneMappingExposure: night ? 1.15 : 1 }}>
      {scene.bg && <color attach="background" args={[scene.bg]} />}
      <Suspense fallback={null}>
        <Environment files={`${ENV}/${scene.hdri}`} background={scene.sky} environmentIntensity={scene.envIntensity} backgroundRotation={[0, scene.hdriRotation ?? 0, 0]} environmentRotation={[0, scene.hdriRotation ?? 0, 0]} />
        <hemisphereLight args={[night ? "#9fb2d6" : "#ffffff", night ? "#1a1612" : "#8a8172", scene.setting === "indoor" ? 0.55 : night ? 0.35 : 0.15]} />
        <directionalLight
          position={scene.sun.position}
          intensity={scene.sun.intensity}
          color={scene.sun.color ?? "#ffffff"}
          castShadow={high}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-half}
          shadow-camera-right={half}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-camera-far={120}
          shadow-bias={-0.0004}
        />
        <Set scene={scene} placed={placed} />
        <Participant avatar={avatar} input={input} pose={pose} />
        <GoalMarker input={input} />
        <Ready onReady={onReady} />
      </Suspense>
      <FpsProbe onSample={onFps} />
      <Picker pick={pick} />
    </Canvas>
  );
});
