"use client";

import { useAnimations } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { STREET, type AvatarChoice } from "./village";

/** Movement intent written by the keyboard and touch controls, read every frame. */
export type MoveInput = { forward: number; turn: number };
/** Where the participant is; read by the page to detect approaching stores. */
export type Pose = { x: number; z: number; heading: number };

const SPEED = 2.4; // metres per second, a relaxed walk
const TURN = 2.2; // radians per second
const LIMIT_Z = STREET.width / 2 + STREET.setback - 0.9;
const LIMIT_X = STREET.length / 2 - 1;

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

/** Rocketbox skins: the FBX points at .tga files we converted, so maps are assigned here. */
function useSkin(avatar: Exclude<AvatarChoice, null>) {
  const base = `/proto/avatars/${avatar}`;
  return useLoader(THREE.TextureLoader, [
    `${base}/body_color.jpg`,
    `${base}/body_normal.jpg`,
    `${base}/head_color.jpg`,
    `${base}/head_normal.jpg`,
    `${base}/opacity_color.png`,
  ]);
}

function Person({ avatar, input, pose }: { avatar: Exclude<AvatarChoice, null>; input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  const model = useLoader(FBXLoader, `/proto/avatars/${avatar}/${avatar}.fbx`, withManager);
  const walk = useLoader(FBXLoader, `/proto/avatars/anims/${avatar.startsWith("Female") ? "f" : "m"}_walk_neutral.fbx`, withManager);
  const [bodyC, bodyN, headC, headN, opacity] = useSkin(avatar);
  const group = useRef<THREE.Group>(null);

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

  const clips = useMemo(() => {
    const clip = walk.animations[0]?.clone();
    if (clip) clip.name = "walk";
    return clip ? [clip] : [];
  }, [walk]);
  const { actions } = useAnimations(clips, group);

  useEffect(() => {
    const a = actions.walk;
    if (!a) return;
    a.play();
    a.timeScale = 0;
    return () => {
      a.stop();
    };
  }, [actions]);

  const camera = useThree((s) => s.camera);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const p = pose.current!;
    const i = input.current!;
    const d = Math.min(dt, 0.05);
    p.heading += -i.turn * TURN * d;
    const step = i.forward * SPEED * d;
    p.x = THREE.MathUtils.clamp(p.x + Math.sin(p.heading) * step, -LIMIT_X, LIMIT_X);
    p.z = THREE.MathUtils.clamp(p.z + Math.cos(p.heading) * step, -LIMIT_Z, LIMIT_Z);
    const g = group.current;
    if (g) {
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.heading;
    }
    const a = actions.walk;
    if (a) {
      const moving = Math.abs(i.forward) > 0.05 || Math.abs(i.turn) > 0.05;
      a.timeScale = THREE.MathUtils.lerp(a.timeScale, moving ? Math.max(0.6, Math.abs(i.forward)) * Math.sign(i.forward || 1) : 0, 0.2);
      if (!moving && Math.abs(a.timeScale) < 0.02) a.time = 0;
    }
    // Third-person camera: behind and above the participant, easing into place.
    camPos.set(p.x - Math.sin(p.heading) * 4.6, 2.5, p.z - Math.cos(p.heading) * 4.6);
    camera.position.lerp(camPos, 1 - Math.pow(0.001, d));
    camTarget.set(p.x + Math.sin(p.heading) * 2, 1.4, p.z + Math.cos(p.heading) * 2);
    camera.lookAt(camTarget);
  });

  return (
    <group ref={group}>
      <primitive object={person} scale={0.01} />
    </group>
  );
}

/** First-person camera for participants who are not given an avatar. */
function Eyes({ input, pose }: { input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  const camera = useThree((s) => s.camera);
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const p = pose.current!;
    const i = input.current!;
    const d = Math.min(dt, 0.05);
    p.heading += -i.turn * TURN * d;
    const step = i.forward * SPEED * d;
    p.x = THREE.MathUtils.clamp(p.x + Math.sin(p.heading) * step, -LIMIT_X, LIMIT_X);
    p.z = THREE.MathUtils.clamp(p.z + Math.cos(p.heading) * step, -LIMIT_Z, LIMIT_Z);
    camera.position.set(p.x, 1.6, p.z);
    look.set(p.x + Math.sin(p.heading), 1.55, p.z + Math.cos(p.heading));
    camera.lookAt(look);
  });
  return null;
}

export function Participant({ avatar, input, pose }: { avatar: AvatarChoice; input: React.RefObject<MoveInput>; pose: React.RefObject<Pose> }) {
  return avatar ? <Person avatar={avatar} input={input} pose={pose} /> : <Eyes input={input} pose={pose} />;
}
