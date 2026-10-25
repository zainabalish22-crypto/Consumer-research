/**
 * Small, dependency-free charts for the analytics page. Every chart shows its
 * numbers as text too, so nothing depends on reading a shape or a colour.
 */
import { cx } from "@/components/ui";

/** Distinct in lightness as well as hue, so neighbours stay distinguishable. */
export const SERIES = ["#0F6E6E", "#6D4AA8", "#B45309", "#475569", "#7FBDB8", "#B9A3DD", "#E8B07E", "#9AA5B1"];

export function Ring({ pct, label }: { pct: number | null; label: string }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <svg width="52" height="52" viewBox="0 0 36 36" role="img" aria-label={label} className="shrink-0">
      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-line)" strokeWidth="5" />
      {pct !== null && (
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeDasharray={`${(p / 100) * 94.2} 94.2`} strokeLinecap="round" transform="rotate(-90 18 18)" />
      )}
    </svg>
  );
}

/** Thick horizontal bars in order; the biggest drop between two steps is called out. */
export function Funnel({ rows, total, dropNote }: { rows: { key: string; label: string; value: number }[]; total: number; dropNote: (from: string, to: string, lost: number) => string }) {
  let drop: { from: string; to: string; lost: number } | null = null;
  for (let i = 1; i < rows.length; i++) {
    const lost = rows[i - 1].value - rows[i].value;
    if (lost > 0 && (!drop || lost > drop.lost)) drop = { from: rows[i - 1].label, to: rows[i].label, lost };
  }
  return (
    <div className="flex flex-col gap-2.5">
      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="truncate" dir="auto" title={r.label}>
              {r.label}
            </span>
            <span className="h-6 rounded-md bg-paper" aria-hidden>
              <span className="block h-6 rounded-md bg-accent" style={{ width: `${total ? (r.value / total) * 100 : 0}%` }} />
            </span>
            <span className="text-end tabular-nums">
              <span className="font-semibold">{r.value}</span>
              <span className="text-muted"> · {total ? Math.round((r.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ol>
      {drop && <p className="rounded-lg bg-shop-soft px-3 py-2 text-sm text-[#8a3f06]">{dropNote(drop.from, drop.to, drop.lost)}</p>}
    </div>
  );
}

/** Two columns per group (e.g. started and completed per condition). */
export function GroupedColumns({
  groups,
  series,
}: {
  groups: { key: string; label: string; values: number[]; caption: string }[];
  series: string[];
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const tones = ["bg-[#B9DAD7]", "bg-accent"];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-40 items-end gap-6 border-b border-line px-2" aria-hidden>
        {groups.map((g) => (
          <div key={g.key} className="flex h-full flex-1 items-end justify-center gap-1.5">
            {g.values.map((v, i) => (
              <span key={i} className={cx("w-8 rounded-t-md", tones[i % tones.length])} style={{ height: `${(v / max) * 100}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-6 px-2 text-sm">
        {groups.map((g) => (
          <p key={g.key} className="flex-1 text-center">
            <span className="block truncate" dir="auto">
              {g.label}
            </span>
            <span className="text-xs text-muted">{g.caption}</span>
          </p>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted" aria-hidden>
        {series.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cx("size-3 rounded-sm", tones[i % tones.length])} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/** One stacked bar for a single-choice question, with a legend that carries the numbers. */
export function StackedBar({ parts, total }: { parts: { key: string; label: string; count: number }[]; total: number }) {
  const shown = parts.filter((p) => p.count > 0);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-7 overflow-hidden rounded-lg bg-paper" aria-hidden>
        {shown.map((p) => (
          <span key={p.key} style={{ width: `${total ? (p.count / total) * 100 : 0}%`, background: SERIES[parts.indexOf(p) % SERIES.length] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {parts.map((p, i) => (
          <li key={p.key} className={cx("inline-flex items-center gap-1.5", p.count === 0 && "text-muted")}>
            <span className="size-3 shrink-0 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} aria-hidden />
            <span dir="auto">{p.label}</span>
            <span className="tabular-nums text-muted">
              {p.count} · {total ? Math.round((p.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
