"use client";

import { useAnimations } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { AvatarChoice } from "./village";

/**
 * Walk-to target set by tapping: a spot on the street, or a shop door (`store`, `face`), where
 * the figure turns to face the shop before arriving.
 */
export type GoTo = { x: number; z: number; store?: string; face?: number; onArrive?: () => void };
/** Movement intent written by the keyboard and touch controls, read every frame. */
export type MoveInput = { forward: number; turn: number; goto?: GoTo | null };
/**
 * Where the participant is; read by the page to detect approaching stores.
 * `v` (metres per second) and `w` (radians per second) are the eased speed and turn rate.
 * `bounds` is the walkable area [xMin, xMax, zMin, zMax] and `blockers` the circles [x, z, r]
 * to walk around (benches, stalls, posts), both set by the scene.
 */
export type Pose = { x: number; z: number; heading: number; v?: number; w?: number; bounds?: [number, number, number, number]; blockers?: [number, number, number][] };

const BODY = 0.3; // the participant's own radius when walking past things

const SPEED = 1.45; // metres per second at full stick: an ordinary walking pace
const TURN = 1.9; // radians per second at full stick: an unhurried turn
const ACCEL = 6; // how quickly speed and turning catch up with the input: about half a second, like a person
const OPEN: [number, number, number, number] = [-1e3, 1e3, -1e3, 1e3];

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = THREE.MathUtils.damp;

/**
 * Advances the pose by one frame from manual input, or from a tap-to-walk target when the
 * participant is not steering. Manual input always wins and cancels the target. Speed and
 * turning ease towards their targets, so starting, stopping and turning never jerk.
 */
function advance(p: Pose, i: MoveInput, d: number) {
  let wantV = i.forward * SPEED;
  let wantW = -i.turn * TURN;
  const manual = Math.abs(i.forward) > 0.05 || Math.abs(i.turn) > 0.05;
  if (manual && i.goto) i.goto = null;
  if (!manual && i.goto) {
    const g = i.goto;
    const dx = g.x - p.x;
    const dz = g.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.25) {
      const diff = wrapAngle(Math.atan2(dx, dz) - p.heading);
      wantW = THREE.MathUtils.clamp(diff * 4, -TURN * 1.4, TURN * 1.4);
      // Slow down while turning sharply and when close, so the figure arrives gently.
      wantV = SPEED * Math.min(1, dist / 1.2) * Math.max(0.15, Math.cos(Math.min(Math.abs(diff), Math.PI / 2)));
    } else if (g.face === undefined) {
      wantV = 0;
      wantW = 0;
      i.goto = null;
      g.onArrive?.();
    } else {
      const diff = wrapAngle(g.face - p.heading);
      wantV = 0;
      wantW = THREE.MathUtils.clamp(diff * 5, -TURN * 1.4, TURN * 1.4);
      if (Math.abs(diff) <= 0.06) {
        i.goto = null;
        g.onArrive?.();
      }
    }
  }
  p.v = damp(p.v ?? 0, wantV, ACCEL, d);
  p.w = damp(p.w ?? 0, wantW, ACCEL * 1.4, d);
  p.heading += p.w * d;
  const [x0, x1, z0, z1] = p.bounds ?? OPEN;
  p.x = THREE.MathUtils.clamp(p.x + Math.sin(p.heading) * p.v * d, x0, x1);
  p.z = THREE.MathUtils.clamp(p.z + Math.cos(p.heading) * p.v * d, z0, z1);
  // Slide around anything in the way rather than walking through it.
  for (const [bx, bz, br] of p.blockers ?? []) {
    const dx = p.x - bx;
    const dz = p.z - bz;
    const dist = Math.hypot(dx, dz);
    const min = br + BODY;
    if (dist < min && dist > 1e-4) {
      p.x = bx + (dx / dist) * min;
      p.z = bz + (dz / dist) * min;
    }
  }
}

/**
 * Third-person camera. It sits at a fixed distance behind the figure, so the figure holds
 * perfectly still on screen however uneven the frame rate is (easing the camera's position
 * separately made the figure wobble against the view whenever a frame ran long). Only the
 * direction eases: the view trails the figure's heading, so turning sweeps instead of jolting.
 */
function useFollowCamera(distance: number, height: number, lookHeight: number) {
  const camera = useThree((s) => s.camera);
  const state = useMemo(() => ({ heading: null as number | null, look: new THREE.Vector3() }), []);
  return (p: Pose, d: number) => {
    if (state.heading === null) state.heading = p.heading;
    state.heading += wrapAngle(p.heading - state.heading) * (1 - Math.exp(-7 * d));
    const h = state.heading;
    camera.position.set(p.x - Math.sin(h) * distance, height, p.z - Math.cos(h) * distance);
    state.look.set(p.x + Math.sin(h) * 2, lookHeight, p.z + Math.cos(h) * 2);
    camera.lookAt(state.look);
  };
}

/**
 * The FBX files name their original .tga skins, which are replaced below by compressed copies.
 * This manager answers those requests with empty textures so nothing is fetched.
 */
const fbxManager = new THREE.LoadingManager();
fbxManager.addHandler(/\.tga$/i, {
  load: () => new THREE.Texture(),
  setPath() {
    return this;
  },
  setCrossOrigin() {
    return this;
  },
} as unknown as THREE.Loader);
const withManager = (loader: FBXLoader) => {
  loader.manager = fbxManager;
};

type Human = "Female_Adult_01" | "Male_Adult_01";

/** Rocketbox skins: the FBX points at .tga files we converted, so maps are assigned here. */
function useSkin(avatar: Human) {
  const base = `/proto/avatars/${avatar}`;
  return useLoader(THREE.TextureLoader, [
    `${base}/body_color.jpg`,
    `${base}/body_normal.jpg`,
    `${base}/head_color.jpg`,
    `${base}/head_normal.jpg`,
    `${base}/opacity_color.png`,
  ]);
}

/** A realistic person: Rocketbox model with its own skin textures. */
function Person({ avatar, input, pose }: { avatar: Human; input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  const model = useLoader(FBXLoader, `/proto/avatars/${avatar}/${avatar}.fbx`, withManager);
  const walk = useLoader(FBXLoader, `/proto/avatars/anims/${avatar.startsWith("Female") ? "f" : "m"}_walk_neutral.fbx`, withManager);
  const [bodyC, bodyN, headC, headN, opacity] = useSkin(avatar);

  const person = useMemo(() => {
    for (const t of [bodyC, headC]) t.colorSpace = THREE.SRGBColorSpace;
    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = mats.map((m) => {
        const name = (m.name || "").toLowerCase();
        const std = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
        if (name.includes("opacity") || name.includes("lash") || name.includes("hair")) {
          Object.assign(std, { map: headC, alphaMap: opacity, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
        } else if (name.includes("head") || name.includes("face")) {
          Object.assign(std, { map: headC, normalMap: headN });
        } else {
          Object.assign(std, { map: bodyC, normalMap: bodyN });
        }
        std.name = m.name;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    return model;
  }, [model, bodyC, bodyN, headC, headN, opacity]);

  return <Walker object={person} walk={walk} input={input} pose={pose} />;
}

/** Ground speed the Rocketbox walk cycle covers at normal playback, in metres per second. */
const CYCLE_SPEED = 1.45;

/**
 * Shared walking behaviour for a human figure. The walk cycle and a standing pose (the first
 * frame of the walk) are blended by speed, and the cycle plays in step with the actual ground
 * speed, so the feet don't slide and the figure never snaps between walking and standing.
 */
function Walker({ object, walk, input, pose }: { object: THREE.Object3D; walk: THREE.Group; input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  const group = useRef<THREE.Group>(null);
  const clips = useMemo(() => {
    const src = walk.animations[0];
    if (!src) return [];
    const w = src.clone();
    w.name = "walk";
    const stand = THREE.AnimationUtils.subclip(src, "stand", 0, 1, 30);
    return [w, stand];
  }, [walk]);
  const { actions } = useAnimations(clips, group);

  useEffect(() => {
    const { walk: w, stand } = actions;
    if (!w || !stand) return;
    for (const a of [w, stand]) {
      a.enabled = true;
      a.play();
    }
    w.setEffectiveWeight(0);
    stand.setEffectiveWeight(1);
    return () => {
      w.stop();
      stand.stop();
    };
  }, [actions]);

  const follow = useFollowCamera(4.6, 2.5, 1.4);
  const turnTo = useRef<number | null>(null);

  useFrame((_, dt) => {
    const p = pose.current!;
    const d = Math.min(dt, 0.05);
    advance(p, input.current!, d);
    const g = group.current;
    if (g) {
      g.position.set(p.x, 0, p.z);
      // The body turns a touch behind the heading, like a person turning, not a sign rotating.
      turnTo.current = turnTo.current === null ? p.heading : turnTo.current + wrapAngle(p.heading - turnTo.current) * (1 - Math.exp(-22 * d));
      g.rotation.y = turnTo.current;
    }
    const { walk: w, stand } = actions;
    if (w && stand) {
      const speed = Math.abs(p.v ?? 0);
      const walkWeight = THREE.MathUtils.clamp(speed / 0.7, 0, 1);
      // Turning on the spot also takes small steps.
      const stepping = Math.max(walkWeight, Math.min(1, Math.abs(p.w ?? 0) / 2) * 0.6);
      w.setEffectiveWeight(stepping);
      stand.setEffectiveWeight(1 - stepping);
      w.timeScale = Math.max(0.6, speed / CYCLE_SPEED) * Math.sign(p.v || 1);
    }
    follow(p, d);
  });

  return (
    <group ref={group}>
      <primitive object={object} scale={0.01} />
    </group>
  );
}

/** First-person camera for participants who are not given an avatar. */
function Eyes({ input, pose }: { input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  const camera = useThree((s) => s.camera);
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const p = pose.current!;
    advance(p, input.current!, Math.min(dt, 0.05));
    camera.position.set(p.x, 1.6, p.z);
    look.set(p.x + Math.sin(p.heading), 1.55, p.z + Math.cos(p.heading));
    camera.lookAt(look);
  });
  return null;
}

/** Tessellum's brand orange (Signal), used for the presence. */
const PRESENCE_COLOR = "#FF6A2B";

/**
 * Abstract presence: a circle on the ground marking where the participant stands. It shows
 * position without giving them a body, so it carries no gender, age or ethnicity.
 * Researchers can also use it for every participant.
 */
function Presence({ input, pose }: { input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  const group = useRef<THREE.Group>(null);
  const follow = useFollowCamera(4.2, 2.3, 1.1);
  useFrame((_, dt) => {
    const p = pose.current!;
    const d = Math.min(dt, 0.05);
    advance(p, input.current!, d);
    group.current?.position.set(p.x, 0, p.z);
    follow(p, d);
  });
  return (
    <group ref={group}>
      {/* A crisp ring on the ground marking where the participant stands */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.42, 0.5, 64]} />
        <meshStandardMaterial color={PRESENCE_COLOR} roughness={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.019}>
        <circleGeometry args={[0.42, 64]} />
        <meshStandardMaterial color={PRESENCE_COLOR} transparent opacity={0.18} roughness={0.8} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Participant({ avatar, input, pose }: { avatar: AvatarChoice; input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  if (avatar === "presence") return <Presence input={input} pose={pose} />;
  return avatar ? <Person avatar={avatar} input={input} pose={pose} /> : <Eyes input={input} pose={pose} />;
}
