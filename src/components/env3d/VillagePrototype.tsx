"use client";

import { useProgress } from "@react-three/drei";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MoveInput, Pose } from "./Avatar";
import { APPROACH_RADIUS, STORES, avatarFor, doorPoint, type AvatarChoice, type VillageStore } from "./village";

const VillageScene = dynamic(() => import("./Scene"), { ssr: false });

type LoggedEvent = { t: number; type: string; detail: string };

/** Prototype of the 3D garden village: avatar assignment, walking, approaching and entering stores. */
export function VillagePrototype() {
  const [answer, setAnswer] = useState<"woman" | "man" | "none" | null>(null);
  const [avatar, setAvatar] = useState<AvatarChoice>(null);
  const input = useRef<MoveInput>({ forward: 0, turn: 0 });
  const pose = useRef<Pose>({ x: -26, z: 0, heading: Math.PI / 2 });
  const [near, setNear] = useState<VillageStore | null>(null);
  const [inside, setInside] = useState<VillageStore | null>(null);
  const [bag, setBag] = useState<string[]>([]);
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const [fps, setFps] = useState(0);
  const [high, setHigh] = useState(true);
  const [showLog, setShowLog] = useState(true);
  const [ready, setReady] = useState(false);
  const { progress } = useProgress();
  const onReady = useCallback(() => setReady(true), []);
  const started = useRef(0);

  const log = useCallback((type: string, detail: string) => {
    setEvents((e) => [{ t: (performance.now() - started.current) / 1000, type, detail }, ...e].slice(0, 40));
  }, []);

  useEffect(() => {
    setHigh(window.matchMedia("(min-width: 900px)").matches);
  }, []);

  function begin(a: "woman" | "man" | "none") {
    setAnswer(a);
    setAvatar(avatarFor(a));
    started.current = performance.now();
    log("enter_environment", `avatar=${avatarFor(a) ?? "none (first person)"}`);
  }

  // Keyboard: arrows or WASD.
  useEffect(() => {
    if (!answer) return;
    const keys = new Set<string>();
    const apply = () => {
      const f = (keys.has("arrowup") || keys.has("w") ? 1 : 0) - (keys.has("arrowdown") || keys.has("s") ? 1 : 0);
      const t = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
      input.current = { forward: f, turn: t };
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (inside || !["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) return;
      e.preventDefault();
      keys.add(k);
      apply();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      apply();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [answer, inside]);

  // Approach detection, five times a second.
  const nearRef = useRef<string | null>(null);
  useEffect(() => {
    if (!answer) return;
    const id = window.setInterval(() => {
      const p = pose.current;
      let best: VillageStore | null = null;
      let bestD = APPROACH_RADIUS;
      for (const s of STORES) {
        const [dx, dz] = doorPoint(s);
        const d = Math.hypot(p.x - dx, p.z - dz);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      const idNow = best?.id ?? null;
      if (idNow !== nearRef.current) {
        if (nearRef.current) log("leave_store_area", nearRef.current);
        if (best) log("approach_store", best.id);
        nearRef.current = idNow;
        setNear(best);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [answer, log]);

  function enter(s: VillageStore) {
    input.current = { forward: 0, turn: 0 };
    setInside(s);
    log("enter_store", s.id);
  }
  function leave() {
    if (inside) log("leave_store", inside.id);
    setInside(null);
  }

  if (!answer) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F7F6F2] p-6 text-[#16181B]">
        <div className="w-full max-w-sm rounded-[22px] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#5C6066]">Prototype · step 3 of 11</p>
          <h1 className="mt-2 text-xl font-semibold leading-snug">Which best describes you?</h1>
          <p className="mt-1 text-sm text-[#5C6066]">Your answer sets your figure in the shopping street automatically.</p>
          <div className="mt-5 flex flex-col gap-3">
            {(
              [
                ["woman", "Woman"],
                ["man", "Man"],
                ["none", "Prefer not to say"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => begin(v)} className="h-[52px] rounded-[14px] border-[1.5px] border-[#E3E0D8] px-4 text-start text-base font-medium hover:border-[#1F5C4E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5C4E]">
                {label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-[#5C6066]">Rule set by the researcher: Woman → woman figure, Man → man figure, Prefer not to say → no figure (you see through your own eyes).</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <VillageScene avatar={avatar} input={input} pose={pose} high={high} onFps={setFps} onReady={onReady} />
      </div>

      {!ready && (
        <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#F7F6F2] p-6 text-[#16181B]">
          <p className="text-lg font-semibold">Preparing the shopping street…</p>
          <div className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-[#ECEAE4]">
            <div className="h-2 rounded-full bg-[#1F5C4E] transition-[width]" style={{ width: `${Math.round(progress)}%` }} />
          </div>
          <p className="text-sm text-[#5C6066]">{Math.round(progress)}% · this takes a few seconds the first time</p>
        </div>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto rounded-2xl bg-white/90 px-4 py-2 text-sm text-[#16181B] shadow">
          <strong className="font-semibold">Campus garden village</strong>
          <span className="ms-2 text-[#5C6066]">Bag · {bag.length}</span>
        </div>
        <div className="pointer-events-auto flex gap-2 text-xs">
          <button type="button" onClick={() => setHigh((h) => !h)} className="whitespace-nowrap rounded-xl bg-black/60 px-3 py-2">
            {high ? "High" : "Light"} · {fps} fps
          </button>
          <button type="button" onClick={() => setShowLog((v) => !v)} className="hidden rounded-xl bg-black/60 px-3 py-2 md:block">
            {showLog ? "Hide" : "Show"} recorded events
          </button>
        </div>
      </header>

      {showLog && (
        <aside aria-label="Recorded events (prototype)" className="absolute end-3 top-16 hidden max-h-[55vh] w-72 overflow-auto rounded-xl bg-black/70 p-3 font-mono text-[11px] leading-5 md:block">
          <p className="mb-1 text-white/60">What the study records</p>
          {events.map((e, i) => (
            <p key={i}>
              <span className="text-white/50">{e.t.toFixed(1)}s</span> {e.type} <span className="text-[#FFB38F]">{e.detail}</span>
            </p>
          ))}
        </aside>
      )}

      {near && !inside && (
        <div className="absolute inset-x-3 bottom-36 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-white p-3 text-[#16181B] shadow-lg md:bottom-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={near.storefrontPhoto} alt="" className="h-16 w-20 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{near.name}</p>
            {near.offer && <p className="text-sm text-[#5C6066]">{near.offer}</p>}
          </div>
          <button type="button" onClick={() => enter(near)} className="h-11 rounded-xl bg-[#16181B] px-4 font-semibold text-white">
            Enter
          </button>
        </div>
      )}

      {!inside && <Joystick input={input} />}

      {inside && (
        <section aria-label={inside.name} className="absolute inset-0 z-10 flex flex-col bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={inside.interiorPhoto} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
          <div className="relative flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold">{inside.name}</h2>
            <button type="button" onClick={leave} className="h-11 rounded-xl bg-white/90 px-4 font-semibold text-[#16181B]">
              Leave store
            </button>
          </div>
          <div className="relative mt-auto grid gap-3 p-4 sm:grid-cols-2">
            {inside.products.map((p) => (
              <article key={p.id} className="flex gap-3 rounded-2xl bg-white p-3 text-[#16181B]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo} alt="" className="h-24 w-24 rounded-xl object-cover" onLoad={() => log("product_view", `${inside.id}/${p.id}`)} />
                <div className="flex flex-1 flex-col gap-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm">
                    <strong>BHD {p.price.toFixed(3)}</strong>
                    {p.was && <s className="ms-2 text-[#5C6066]">BHD {p.was.toFixed(3)}</s>}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBag((b) => [...b, p.id]);
                      log("add_to_bag", `${inside.id}/${p.id}`);
                    }}
                    className="mt-auto h-11 rounded-xl bg-[#16181B] font-semibold text-white"
                  >
                    Add to bag
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/** Touch joystick: up/down walks, left/right turns. Keyboard arrows do the same. */
function Joystick({ input }: { input: React.RefObject<MoveInput> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 46;
  function move(e: React.PointerEvent) {
    const r = base.current!.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(x, y);
    if (len > R) {
      x = (x / len) * R;
      y = (y / len) * R;
    }
    setKnob({ x, y });
    input.current = { forward: -y / R, turn: x / R };
  }
  function end() {
    setKnob({ x: 0, y: 0 });
    input.current = { forward: 0, turn: 0 };
  }
  return (
    <div className="absolute bottom-6 start-6 select-none">
      <div
        ref={base}
        role="application"
        aria-label="Walk: drag up to go forward, left or right to turn. Arrow keys also work."
        className="relative h-28 w-28 touch-none rounded-full border border-white/40 bg-black/35 backdrop-blur-sm"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/85 shadow" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <p className="mt-2 hidden text-center text-xs text-white/80 md:block">Arrow keys or WASD</p>
    </div>
  );
}
