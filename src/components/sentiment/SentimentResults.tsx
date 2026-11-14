"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { GROUP_KEYS, SMALL_GROUP, buildRecords, compare, summarise, trend, type Counts, type GroupKey, type Trend } from "@/lib/sentiment/aggregate";
import type { Sentiment } from "@/lib/sentiment/normalize";
import { getDataset, type SentimentDataset } from "@/lib/sentiment/session";
import { AgreementPanel, DisagreementList, agreementOf } from "./SentimentReview";

/**
 * Sentiment colours: blue for positive, orange for negative, a neutral grey between them.
 * Checked with the palette validator for colour-blind separation and contrast on the dark
 * surface. Every bar is also labelled in text, so colour is never the only cue.
 */
const COLOR: Record<Sentiment, string> = { positive: "#3B8FD9", neutral: "#6B7078", negative: "#D9722E" };
const ORDER: Sentiment[] = ["positive", "neutral", "negative"];
const MAX_GROUPS = 20;

const panel = "flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-6";
const h2 = "font-display text-xl";
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}`;

/** One bar split into positive, neutral and negative, with a 2px gap between segments. */
function Stacked({ counts, n, label, thin = false }: { counts: Counts; n: number; label: (k: Sentiment) => string; thin?: boolean }) {
  return (
    <div dir="ltr" className={`flex w-full gap-[2px] ${thin ? "h-3" : "h-7"}`} role="img" aria-label={ORDER.map((k) => `${label(k)} ${pct(counts[k], n)}%`).join(", ")}>
      {ORDER.map((k) =>
        counts[k] > 0 ? <span key={k} title={`${label(k)}: ${counts[k]} (${pct(counts[k], n)}%)`} className="h-full min-w-[3px] first:rounded-s-[4px] last:rounded-e-[4px]" style={{ width: `${(counts[k] / n) * 100}%`, background: COLOR[k] }} /> : null,
      )}
    </div>
  );
}

function Legend({ label }: { label: (k: Sentiment) => string }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-mist">
      {ORDER.map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: COLOR[k] }} />
          {label(k)}
        </li>
      ))}
    </ul>
  );
}

export function SentimentResults() {
  const t = useTranslations("tools.results");
  const u = useTranslations("tools.upload");
  const [data, setData] = useState<SentimentDataset | null | undefined>(undefined);
  useEffect(() => setData(getDataset()), []);
  const label = (k: Sentiment) => u(`sentiment.${k}`);

  const built = useMemo(() => (data ? buildRecords(data) : null), [data]);
  const groupKeys = useMemo(() => (data ? GROUP_KEYS.filter((k) => data.mapping[k]) : []), [data]);
  const [by, setBy] = useState<GroupKey | null>(null);
  const key = by && groupKeys.includes(by) ? by : (groupKeys[0] ?? null);
  const total = useMemo(() => (built ? summarise(built.records, built.numeric) : null), [built]);
  const cmp = useMemo(() => (built && key ? compare(built.records, key, built.numeric) : null), [built, key]);
  const tr = useMemo(() => (built && data?.mapping.date ? trend(built.records, built.numeric) : null), [built, data]);

  if (data === undefined) return null;
  if (!data || !built || !total || total.n === 0)
    return (
      <section className={panel}>
        <h2 className={h2}>{t("noFile")}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-dim">{t("noFileBody")}</p>
        <Link href="/tools/sentiment/upload" className="tracked inline-flex min-h-12 items-center self-start bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
          {t("goUpload")}
        </Link>
      </section>
    );

  const test = cmp?.test ?? null;
  const strength = test ? (test.cramersV < 0.1 ? "weak" : test.cramersV <= 0.3 ? "moderate" : "strong") : "weak";

  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="flex gap-3 rounded-lg border border-warn/60 bg-carbon p-4 text-sm leading-relaxed">
        <span aria-hidden="true" className="font-mono text-warn">
          !
        </span>
        {u("disclaimer")}
      </p>

      {/* Headline figures */}
      <section className="grid gap-px overflow-hidden rounded-lg border border-line-2 bg-line-2 sm:grid-cols-3" aria-label={t("analysed")}>
        <div className="flex flex-col gap-1 bg-carbon p-5">
          <span className="text-xs text-faint">{t("analysed")}</span>
          <span className="font-display text-4xl font-light" dir="ltr">
            {total.n}
          </span>
        </div>
        <div className="flex flex-col gap-1 bg-carbon p-5">
          <span className="text-xs text-faint">{t("net")}</span>
          <span className="font-display text-4xl font-light" dir="ltr">
            {signed(total.mean)}
          </span>
          <span className="text-xs text-faint">{t("netHint")}</span>
        </div>
        <div className="flex flex-col gap-1 bg-carbon p-5">
          <span className="text-xs text-faint">{t("leftOut")}</span>
          <span className="font-display text-4xl font-light" dir="ltr">
            {built.blank + built.unread}
          </span>
          {built.blank + built.unread > 0 && <span className="text-xs text-faint">{t("leftOutDetail", { blank: built.blank, unread: built.unread })}</span>}
        </div>
      </section>

      {/* Distribution */}
      <section className={panel} aria-labelledby="dist-h">
        <h2 id="dist-h" className={h2}>
          {t("distribution")}
        </h2>
        <Stacked counts={total.counts} n={total.n} label={label} />
        <table className="w-full border-collapse text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <td />
              <th scope="col" className="p-2 text-end font-normal">
                {t("count")}
              </th>
              <th scope="col" className="p-2 text-end font-normal">
                {t("share")}
              </th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((k) => (
              <tr key={k} className="border-t border-line-2">
                <th scope="row" className="p-2 text-start font-normal">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: COLOR[k] }} />
                    {label(k)}
                  </span>
                </th>
                <td className="p-2 text-end font-mono" dir="ltr">
                  {total.counts[k]}
                </td>
                <td className="p-2 text-end font-mono" dir="ltr">
                  {pct(total.counts[k], total.n)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Agreement between coders and the texts they disagreed on */}
      {agreementOf(data, built.records) && <AgreementPanel ag={agreementOf(data, built.records)!} />}
      {data.mapping.label2 && <DisagreementList data={data} records={built.records} onChange={setData} />}

      {/* Groups */}
      <section className={panel} aria-labelledby="cmp-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="cmp-h" className={h2}>
            {t("compareTitle")}
          </h2>
          {groupKeys.length > 0 && (
            <label className="flex items-center gap-3 text-sm text-mist">
              {t("compareBy")}
              <select value={key ?? ""} onChange={(e) => setBy(e.target.value as GroupKey)} className="min-h-11 rounded-md border border-line-2 bg-void px-3 text-photon focus:border-ice focus:outline-none">
                {groupKeys.map((k) => (
                  <option key={k} value={k}>
                    {u(`col.${k}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!cmp ? (
          <p className="text-sm text-dim">{t("noGroups")}</p>
        ) : (
          <>
            <Legend label={label} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="text-xs text-faint">
                  <tr>
                    <th scope="col" className="p-2 text-start font-normal">
                      {t("group")}
                    </th>
                    <th scope="col" className="p-2 text-end font-normal">
                      {t("count")}
                    </th>
                    <th scope="col" className="w-[42%] p-2 text-start font-normal">
                      {t("distribution")}
                    </th>
                    <th scope="col" className="p-2 text-end font-normal">
                      {t("net")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.groups.slice(0, MAX_GROUPS).map((g) => (
                    <tr key={g.name} className="border-t border-line-2">
                      <th scope="row" className="max-w-[220px] p-2 text-start font-normal">
                        <span className="block truncate" dir="auto" title={g.name}>
                          {g.name}
                        </span>
                        {g.small && <span className="text-xs text-warn">{t("small")}</span>}
                      </th>
                      <td className="p-2 text-end font-mono" dir="ltr">
                        {g.n}
                      </td>
                      <td className="p-2">
                        <Stacked counts={g.counts} n={g.n} label={label} thin />
                      </td>
                      <td className="p-2 text-end font-mono" dir="ltr">
                        {signed(g.mean)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-1 text-xs text-faint">
              {cmp.groups.length > MAX_GROUPS && <li>{t("more", { shown: MAX_GROUPS, total: cmp.groups.length })}</li>}
              {cmp.groups.some((g) => g.small) && <li>{t("smallNote", { n: SMALL_GROUP })}</li>}
              {cmp.missing > 0 && <li>{t("missing", { n: cmp.missing })}</li>}
            </ul>
            <div className="flex flex-col gap-2 rounded-md border border-line-2 bg-void p-4">
              <h3 className="text-sm font-semibold">{t("testTitle")}</h3>
              {!test ? (
                <p className="text-sm text-dim">{t("testNone", { n: SMALL_GROUP })}</p>
              ) : (
                <>
                  {/* An unreliable test gets no verdict: the caution leads instead. */}
                  {test.lowExpected > 0.2 ? (
                    <p className="text-[15px] leading-relaxed text-warn">{t("testLow", { pct: Math.round(test.lowExpected * 100) })}</p>
                  ) : (
                    <p className="text-[15px] leading-relaxed">{test.p < 0.05 ? t("testYes") : t("testNo")}</p>
                  )}
                  <p className="font-mono text-xs leading-relaxed text-dim">
                    {t("testDetail", { chi2: test.chi2.toFixed(2), df: test.df, p: test.p < 0.001 ? "< 0.001" : `= ${test.p.toFixed(3)}`, v: test.cramersV.toFixed(2), strength: t(`strength.${strength}`), groups: cmp.tested, n: test.n })}
                  </p>
                  <p className="text-xs text-faint">{t("testReminder")}</p>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {tr && <TrendPanel tr={tr} />}

      {/* Method */}
      <section className={panel} aria-labelledby="method-h">
        <h2 id="method-h" className={h2}>
          {t("methodTitle")}
        </h2>
        <ul className="flex max-w-3xl flex-col gap-2 text-sm leading-relaxed text-mist">
          <li>{t("method1")}</li>
          <li>{built.numeric ? t("method2Num") : t("method2Cat")}</li>
          <li>{t("method3")}</li>
        </ul>
      </section>

      <Link href="/tools/sentiment/export" className="tracked inline-flex min-h-12 items-center self-start bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white">
        {t("toExport")}
      </Link>
    </div>
  );
}

/** Net sentiment over time: one line on one axis, with a table view of the same numbers. */
function TrendPanel({ tr }: { tr: Trend }) {
  const t = useTranslations("tools.results");
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const pts = tr.points;
  const W = 720;
  const H = 240;
  const pad = { l: 44, r: 16, t: 16, b: 30 };
  const x = (i: number) => pad.l + (pts.length === 1 ? 0.5 : i / (pts.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((1 - v) / 2) * (H - pad.t - pad.b);
  const ticks = pts.length <= 6 ? pts.map((_, i) => i) : [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  return (
    <section className={panel} aria-labelledby="trend-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="trend-h" className={h2}>
            {t("trendTitle")}
          </h2>
          {pts.length > 0 && <span className="text-xs text-faint">{t(`trendUnit.${tr.unit}`)}</span>}
        </div>
        {pts.length > 1 && (
          <button type="button" onClick={() => setTable((v) => !v)} className="min-h-11 rounded-md border border-line-3 px-4 text-sm font-semibold hover:border-photon">
            {table ? t("showChart") : t("showTable")}
          </button>
        )}
      </div>
      {tr.unreadDates > 0 && <p className="text-sm text-warn">{t("trendUnread", { n: tr.unreadDates })}</p>}
      {pts.length === 1 && <p className="text-sm text-dim">{t("trendOne")}</p>}
      {pts.length > 1 && pts.filter((p) => p.n < SMALL_GROUP).length > pts.length / 2 && <p className="text-sm text-dim">{t("trendSmall", { n: SMALL_GROUP })}</p>}
      {pts.length > 1 && !table && (
        <div className="relative" dir="ltr">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${t("trendAxis")}: ${pts.map((p) => `${p.start} ${signed(p.mean)}`).join(", ")}`} onPointerLeave={() => setHover(null)}>
            {[1, 0.5, 0, -0.5, -1].map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#3A3E45" : "#1E2025"} strokeWidth="1" />
                <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#8B9097" fontFamily="var(--font-jetbrains), monospace">
                  {v > 0 ? `+${v}` : v}
                </text>
              </g>
            ))}
            <polyline fill="none" stroke="#CFE8F2" strokeWidth="2" strokeLinejoin="round" points={pts.map((p, i) => `${x(i)},${y(p.mean)}`).join(" ")} />
            {pts.map((p, i) => (
              <g key={p.start}>
                <circle cx={x(i)} cy={y(p.mean)} r={hover === i ? 6 : 4} fill="#CFE8F2" stroke="#0E0F11" strokeWidth="2" />
                {/* A wide invisible target so points are easy to hover or tap */}
                <rect x={x(i) - Math.max(10, (W - pad.l - pad.r) / pts.length / 2)} y={pad.t} width={Math.max(20, (W - pad.l - pad.r) / pts.length)} height={H - pad.t - pad.b} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
              </g>
            ))}
            {ticks.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize="11" fill="#8B9097" fontFamily="var(--font-jetbrains), monospace">
                {pts[i].start}
              </text>
            ))}
          </svg>
          {hover !== null && (
            <div role="status" className="pointer-events-none absolute top-2 rounded-md border border-line-3 bg-steel px-3 py-2 font-mono text-xs" style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 70px), calc(100% - 150px))` }}>
              <div>{pts[hover].start}</div>
              <div className="text-photon">
                {t("net")}: {signed(pts[hover].mean)}
              </div>
              <div className="text-faint">
                {t("count")}: {pts[hover].n}
              </div>
            </div>
          )}
        </div>
      )}
      {pts.length > 1 && table && (
        <div className="max-h-80 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="text-xs text-faint">
              <tr>
                <th scope="col" className="p-2 text-start font-normal">
                  {t("period")}
                </th>
                <th scope="col" className="p-2 text-end font-normal">
                  {t("count")}
                </th>
                <th scope="col" className="p-2 text-end font-normal">
                  {t("net")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.start} className="border-t border-line-2">
                  <th scope="row" className="p-2 text-start font-mono font-normal" dir="ltr">
                    {p.start}
                  </th>
                  <td className="p-2 text-end font-mono" dir="ltr">
                    {p.n}
                  </td>
                  <td className="p-2 text-end font-mono" dir="ltr">
                    {signed(p.mean)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
