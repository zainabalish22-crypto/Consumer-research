"use client";

import { useProgress } from "@react-three/drei";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MoveInput, Pose } from "./Avatar";
import type { PickFn } from "./Scene";
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
  const [bag, setBag] = useState<{ key: string; price: number }[]>([]);
  const bagTotal = bag.reduce((sum, b) => sum + b.price, 0);
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  const [fps, setFps] = useState(0);
  const [high, setHigh] = useState(true);
  const [showLog, setShowLog] = useState(true);
  const [ready, setReady] = useState(false);
  const { progress } = useProgress();
  const onReady = useCallback(() => setReady(true), []);
  const pick = useRef<PickFn | null>(null);
  const started = useRef(0);

  const log = useCallback((type: string, detail: string) => {
    setEvents((e) => [{ t: (performance.now() - started.current) / 1000, type, detail }, ...e].slice(0, 40));
  }, []);

  useEffect(() => {
    setHigh(window.matchMedia("(min-width: 900px)").matches);
  }, []);

  function begin(a: "woman" | "man" | "none") {
    const assigned = avatarFor(a);
    setAnswer(a);
    setAvatar(assigned);
    started.current = performance.now();
    // The representation is recorded, because the kind of figure can influence behaviour.
    log("enter_environment", `representation=${assigned ?? "first-person"}`);
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
  /** Tap on the scene: a shop means walk to its door and go in; the street means walk there. */
  function tap(x: number, y: number) {
    const hit = pick.current?.(x, y);
    if (!hit) return;
    if ("ground" in hit) {
      const [gx, gz] = hit.ground;
      log("tap_walk", `${gx.toFixed(1)}, ${gz.toFixed(1)}`);
      input.current = { forward: 0, turn: 0, goto: { x: gx, z: gz } };
      return;
    }
    const s = STORES.find((st) => st.id === hit.store);
    if (!s) return;
    const [dx, dz] = doorPoint(s);
    log("tap_store", s.id);
    input.current = { forward: 0, turn: 0, goto: { x: dx, z: dz, store: s.id, face: s.side === -1 ? Math.PI : 0, onArrive: () => enter(s) } };
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
          <p className="mt-4 text-xs text-[#5C6066]">Rule set by the researcher: Woman → woman figure, Man → man figure, Prefer not to say → a circle on the ground instead of a body.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <VillageScene avatar={avatar} input={input} pose={pose} high={high} onFps={setFps} onReady={onReady} pick={pick} />
      </div>

      {!inside && <TouchControl input={input} onTap={tap} />}

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
          <span className="ms-2 text-[#5C6066]">
            Bag · {bag.length} · BHD {bagTotal.toFixed(3)}
          </span>
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

      {inside && (
        <section aria-label={inside.name} className="absolute inset-0 z-10 flex flex-col bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={inside.interiorPhoto} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
          <div className="relative flex items-center justify-between gap-3 p-4">
            <h2 className="text-lg font-semibold">{inside.name}</h2>
            <span role="status" aria-live="polite" className="ms-auto rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-[#16181B]">
              Bag · {bag.length} {bag.length === 1 ? "item" : "items"} · BHD {bagTotal.toFixed(3)}
            </span>
            <button type="button" onClick={leave} className="h-11 rounded-xl bg-white/90 px-4 font-semibold text-[#16181B]">
              Leave store
            </button>
          </div>
          <div className="relative mt-auto grid gap-3 p-4 sm:grid-cols-2">
            {inside.products.map((p) => {
              const key = `${inside.id}/${p.id}`;
              const qty = bag.filter((b) => b.key === key).length;
              const add = () => {
                setBag((b) => [...b, { key, price: p.price }]);
                log("add_to_bag", key);
              };
              const remove = () => {
                setBag((b) => {
                  const i = b.findIndex((x) => x.key === key);
                  return i < 0 ? b : [...b.slice(0, i), ...b.slice(i + 1)];
                });
                log("remove_from_bag", key);
              };
              return (
                <article key={p.id} className={`flex gap-3 rounded-2xl bg-white p-3 text-[#16181B] ${qty ? "ring-2 ring-[#1F5C4E]" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo} alt="" className="h-24 w-24 rounded-xl object-cover" onLoad={() => log("product_view", key)} />
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm">
                      <strong>BHD {p.price.toFixed(3)}</strong>
                      {p.was && <s className="ms-2 text-[#5C6066]">BHD {p.was.toFixed(3)}</s>}
                    </p>
                    {qty === 0 ? (
                      <button type="button" onClick={add} className="mt-auto h-11 rounded-xl bg-[#16181B] font-semibold text-white">
                        Add to bag
                      </button>
                    ) : (
                      <div className="mt-auto flex items-center gap-2">
                        <button type="button" onClick={remove} aria-label={`Remove one ${p.name}`} className="h-11 w-11 rounded-xl border-[1.5px] border-[#E3E0D8] text-lg font-semibold">
                          −
                        </button>
                        <span className="flex-1 text-center text-sm font-semibold text-[#1F5C4E]">✓ {qty} in bag</span>
                        <button type="button" onClick={add} aria-label={`Add another ${p.name}`} className="h-11 w-11 rounded-xl bg-[#16181B] text-lg font-semibold text-white">
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

/**
 * Touch anywhere to walk: the joystick appears under the finger (or mouse) and follows the drag.
 * Up/down walks, left/right turns. Buttons and cards sit above this layer and stay tappable.
 * When idle, a faint joystick in the corner shows where to start. Arrow keys do the same.
 */
function TouchControl({ input, onTap }: { input: React.RefObject<MoveInput>; onTap: (x: number, y: number) => void }) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const downAt = useRef({ x: 0, y: 0, t: 0, far: false });
  const R = 52;
  function move(e: React.PointerEvent, o: { x: number; y: number }) {
    if (Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) > 10) downAt.current.far = true;
    if (!downAt.current.far) return;
    let x = e.clientX - o.x;
    let y = e.clientY - o.y;
    const len = Math.hypot(x, y);
    if (len > R) {
      x = (x / len) * R;
      y = (y / len) * R;
    }
    setKnob({ x, y });
    // A small dead zone so a resting finger does not drift.
    const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
    input.current = { forward: dz(-y / R), turn: dz(x / R) };
  }
  function end() {
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    // Releasing a drag stops walking but keeps any tap-to-walk target.
    input.current = { forward: 0, turn: 0, goto: input.current.goto };
  }
  // The joystick only shows once the finger actually drags, so a quick tap stays a tap.
  const base = origin && downAt.current.far ? origin : null;
  return (
    <div
      role="application"
      aria-label="Walk: touch anywhere and drag up to go forward, left or right to turn. Arrow keys also work."
      className="absolute inset-0 touch-none select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const o = { x: e.clientX, y: e.clientY };
        downAt.current = { x: e.clientX, y: e.clientY, t: performance.now(), far: false };
        setOrigin(o);
        setKnob({ x: 0, y: 0 });
      }}
      onPointerMove={(e) => origin && move(e, origin)}
      onPointerUp={(e) => {
        const quick = !downAt.current.far && performance.now() - downAt.current.t < 400;
        end();
        if (quick) onTap(e.clientX, e.clientY);
      }}
      onPointerCancel={end}
    >
      {base ? (
        <div className="pointer-events-none absolute h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-black/30 backdrop-blur-sm" style={{ left: base.x, top: base.y }}>
          <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/90 shadow" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-6 start-6 flex flex-col items-center gap-2">
          <div className="relative h-28 w-28 rounded-full border border-white/40 bg-black/25">
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
          </div>
          <p className="max-w-40 text-center text-xs text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">Tap the street to walk there, tap a shop to enter, or drag to steer</p>
        </div>
      )}
    </div>
  );
}
