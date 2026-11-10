/** The Tessellum mark: square brackets around a 3 × 3 mosaic of tiles, the centre tile lit. */
export function Mark({ size = 34, className }: { size?: number; className?: string }) {
  const tiles: [number, number][] = [];
  for (const y of [16.5, 28.5, 40.5]) for (const x of [16.5, 28.5, 40.5]) if (!(x === 28.5 && y === 28.5)) tiles.push([x, y]);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M14 8 H6 V56 H14 M50 8 H58 V56 H50" fill="none" stroke="currentColor" strokeWidth="4" />
      <g fill="currentColor">
        {tiles.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" />
        ))}
      </g>
      <rect x="27.5" y="27.5" width="9" height="9" fill="#FF6A2B" />
    </svg>
  );
}

/** Mark and wordmark. The wordmark stays in Latin letters in both languages. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-3 text-photon">
      <Mark />
      <span lang="en" dir="ltr" className="font-[family-name:var(--font-sora)] text-[22px] font-semibold tracking-[0.08em]">
        TESSELLUM
      </span>
    </span>
  );
}
