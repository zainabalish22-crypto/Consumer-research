"use client";
/**
 * Experimental design: between-subject conditions, assigned factors (within-subject
 * variables and counterbalancing) and block order groups.
 */
import { useLocale, useTranslations } from "next-intl";
import { REF_KINDS, type Design, type Factor, type Language, type StudyConfig } from "@/lib/study/schema";
import { lt } from "@/lib/study/text";
import { useLibrary } from "./LibraryContext";
import { newCondition, newFactor, newOrderGroup, shortId, usedVariables } from "@/lib/study/factories";
import { Button, Card, Select } from "@/components/ui";
import { LocalizedField } from "./LocalizedField";
import { Checkbox, IconButton, NumberField, TextField, moveItem } from "./controls";

const codeOnly = (v: string) => v.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);

export function DesignEditor({ config, onChange }: { config: StudyConfig; onChange: (c: StudyConfig) => void }) {
  const t = useTranslations("builder.design");
  const d = config.design;
  const langs = config.settings.languages;
  const set = (patch: Partial<Design>) => onChange({ ...config, design: { ...d, ...patch } });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Conditions ----------------------------------------------------------- */}
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">{t("conditions")}</h2>
          <p className="text-sm text-muted">{t("conditionsHint")}</p>
        </div>
        {d.conditions.length === 0 && <p className="text-sm text-muted">{t("noConditions")}</p>}
        {d.conditions.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_5rem_6rem_auto] items-end gap-2">
            <TextField label={t("code")} value={c.id} dir="ltr" mono onChange={(v) => set({ conditions: d.conditions.map((x, k) => (k === i ? { ...x, id: codeOnly(v) } : x)) })} />
            <TextField label={t("label")} value={c.label} dir="auto" onChange={(v) => set({ conditions: d.conditions.map((x, k) => (k === i ? { ...x, label: v.slice(0, 120) } : x)) })} />
            <NumberField label={t("weight")} value={c.weight} min={1} max={100} onChange={(v) => set({ conditions: d.conditions.map((x, k) => (k === i ? { ...x, weight: Math.max(1, Math.min(100, v ?? 1)) } : x)) })} />
            <NumberField label={t("quota")} value={c.quota} optional min={1} onChange={(v) => set({ conditions: d.conditions.map((x, k) => (k === i ? { ...x, quota: v && v > 0 ? Math.floor(v) : undefined } : x)) })} />
            <IconButton label={t("remove")} onClick={() => set({ conditions: d.conditions.filter((_, k) => k !== i) })}>
              ✕
            </IconButton>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const add = d.conditions.length === 0 ? [newCondition([]), newCondition([newCondition([])])] : [newCondition(d.conditions)];
              set({ conditions: [...d.conditions, ...add] });
            }}
          >
            {d.conditions.length === 0 ? t("addTwoConditions") : t("addCondition")}
          </Button>
        </div>
        {d.conditions.length >= 2 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("assignment")}</legend>
            {(["balanced", "random"] as const).map((m) => (
              <label key={m} className="flex items-start gap-2 text-sm">
                <input type="radio" name="assignment" checked={d.assignment === m} onChange={() => set({ assignment: m })} className="mt-1" />
                <span>
                  <span className="font-medium">{t(`assignments.${m}.title`)}</span>
                  <span className="block text-xs text-muted">{t(`assignments.${m}.body`)}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-muted">{t("quotaHint")}</p>
          </fieldset>
        )}
      </Card>

      {/* Order groups ---------------------------------------------------------- */}
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">{t("orderGroups")}</h2>
          <p className="text-sm text-muted">{t("orderGroupsHint")}</p>
        </div>
        {d.orderGroups.map((g, i) => {
          const members = config.blocks.filter((b) => b.orderGroup === g.id).length;
          return (
            <div key={i} className="grid grid-cols-[6rem_1fr_9rem_auto] items-end gap-2">
              <TextField label={t("code")} value={g.id} dir="ltr" mono onChange={(v) => {
                const id = codeOnly(v);
                onChange({
                  ...config,
                  design: { ...d, orderGroups: d.orderGroups.map((x, k) => (k === i ? { ...x, id } : x)) },
                  blocks: config.blocks.map((b) => (b.orderGroup === g.id ? { ...b, orderGroup: id || undefined } : b)),
                });
              }} />
              <TextField label={t("name")} value={g.name} dir="auto" onChange={(v) => set({ orderGroups: d.orderGroups.map((x, k) => (k === i ? { ...x, name: v.slice(0, 120) } : x)) })} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor={`gm-${i}`}>
                  {t("method")}
                </label>
                <Select id={`gm-${i}`} value={g.method} onChange={(e) => set({ orderGroups: d.orderGroups.map((x, k) => (k === i ? { ...x, method: e.target.value as typeof g.method } : x)) })}>
                  {(["latin", "permutation", "random", "fixed"] as const).map((m) => (
                    <option key={m} value={m}>
                      {t(`methods.${m}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <IconButton
                label={t("remove")}
                onClick={() =>
                  onChange({
                    ...config,
                    design: { ...d, orderGroups: d.orderGroups.filter((_, k) => k !== i) },
                    blocks: config.blocks.map((b) => (b.orderGroup === g.id ? { ...b, orderGroup: undefined } : b)),
                  })
                }
              >
                ✕
              </IconButton>
              <p className="col-span-4 -mt-1 text-xs text-muted">{t("members", { n: members })}</p>
            </div>
          );
        })}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => set({ orderGroups: [...d.orderGroups, newOrderGroup(d.orderGroups)] })}>
          {t("addGroup")}
        </Button>
      </Card>

      {/* Factors ------------------------------------------------------------------ */}
      <Card className="flex flex-col gap-4 xl:col-span-2">
        <div>
          <h2 className="font-semibold">{t("factors")}</h2>
          <p className="text-sm text-muted">{t("factorsHint")}</p>
        </div>
        {d.factors.map((f, i) => (
          <FactorEditor
            key={f.id}
            factor={f}
            languages={langs}
            hasConditions={d.conditions.length >= 2}
            onChange={(nf) => set({ factors: d.factors.map((x, k) => (k === i ? nf : x)) })}
            onRemove={() =>
              onChange({
                ...config,
                design: { ...d, factors: d.factors.filter((_, k) => k !== i) },
                blocks: config.blocks.map((b) => (b.repeat?.factorId === f.id ? { ...b, repeat: undefined } : b)),
              })
            }
          />
        ))}
        <div className="flex flex-wrap gap-2">
          {(["pick", "order", "mapping"] as const).map((k) => (
            <Button key={k} variant="secondary" size="sm" onClick={() => set({ factors: [...d.factors, newFactor(k, d.factors, usedVariables(config))] })}>
              {t(`addFactor.${k}`)}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted">{t("factorsUsage")}</p>
      </Card>
    </div>
  );
}

function FactorEditor({
  factor: f,
  languages,
  hasConditions,
  onChange,
  onRemove,
}: {
  factor: Factor;
  languages: Language[];
  hasConditions: boolean;
  onChange: (f: Factor) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("builder.design");
  const lib = useLibrary();
  const locale = useLocale() as Language;
  const methods: Factor["method"][] = f.kind === "pick" ? ["balanced", "random", "fixed"] : ["latin", "permutation", "random", "fixed"];
  const refKindSelect = (key: "refKind" | "targetRefKind") => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={`${key}-${f.id}`}>
        {t(key === "refKind" ? "refKind" : "targetRefKind")}
      </label>
      <Select id={`${key}-${f.id}`} value={f[key] ?? ""} onChange={(e) => onChange({ ...f, [key]: (e.target.value || undefined) as Factor["refKind"] })}>
        <option value="">{t("refNone")}</option>
        {REF_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`refKinds.${k}`)}
          </option>
        ))}
      </Select>
    </div>
  );
  const listEditor = (key: "levels" | "targets") => {
    const list = f[key];
    const refKind = key === "levels" ? f.refKind : f.targetRefKind;
    const refItems = refKind ? Object.values(lib[`${refKind}s` as keyof typeof lib]) : [];
    const fillFromLibrary = () =>
      onChange({
        ...f,
        [key]: refItems.slice(0, 12).map((x) => ({ id: shortId(key === "levels" ? "l" : "t"), value: x.code, label: x.name, ref: x.id })),
      });
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t(key === "levels" ? "levels" : "targets")}</p>
        {refKind && refItems.length >= 2 && (
          <Button variant="secondary" size="sm" className="self-start" onClick={fillFromLibrary}>
            {t("fillFromLibrary", { n: Math.min(12, refItems.length) })}
          </Button>
        )}
        {list.map((l, i) => (
          <div key={l.id} className="flex flex-col gap-2 rounded-lg border border-line p-2 sm:flex-row sm:items-start">
            <TextField label={t("value")} className="sm:w-28" value={l.value} dir="ltr" mono onChange={(v) => onChange({ ...f, [key]: list.map((x, k) => (k === i ? { ...x, value: codeOnly(v) } : x)) })} />
            <div className="flex flex-1 flex-col gap-2">
              <LocalizedField label={t("levelLabel")} value={l.label} languages={languages} onChange={(v) => onChange({ ...f, [key]: list.map((x, k) => (k === i ? { ...x, label: v } : x)) })} />
              {refKind && (
                <Select
                  aria-label={t("linkedItem")}
                  value={l.ref ?? ""}
                  onChange={(e) => onChange({ ...f, [key]: list.map((x, k) => (k === i ? { ...x, ref: e.target.value || undefined } : x)) })}
                >
                  <option value="">{t("linkedNone")}</option>
                  {refItems.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {lt(x.name, locale, "en")}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="flex sm:flex-col">
              <IconButton label={t("moveUp")} disabled={i === 0} onClick={() => onChange({ ...f, [key]: moveItem(list, i, i - 1) })}>
                ↑
              </IconButton>
              <IconButton label={t("remove")} disabled={list.length <= 2} onClick={() => onChange({ ...f, [key]: list.filter((_, k) => k !== i) })}>
                ✕
              </IconButton>
            </div>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={list.length >= 12}
          onClick={() => {
            let n = list.length + 1;
            const prefix = key === "levels" ? "L" : "T";
            while (list.some((x) => x.value === `${prefix}${n}`)) n++;
            onChange({ ...f, [key]: [...list, { id: shortId(key === "levels" ? "l" : "t"), value: `${prefix}${n}`, label: {} }] });
          }}
        >
          {t(key === "levels" ? "addLevel" : "addTarget")}
        </Button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">
          <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">{t(`kinds.${f.kind}.title`)}</span>
          <span className="ms-2 text-xs text-muted">{t(`kinds.${f.kind}.body`)}</span>
        </p>
        <IconButton label={t("remove")} onClick={onRemove}>
          ✕
        </IconButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label={t("name")} value={f.name} dir="auto" onChange={(v) => onChange({ ...f, name: v.slice(0, 120) })} />
        <TextField
          label={t("variable")}
          hint={t("variableHint")}
          value={f.variable}
          dir="ltr"
          mono
          error={/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(f.variable) ? undefined : t("variableInvalid")}
          onChange={(v) => onChange({ ...f, variable: v.replace(/\s/g, "_").slice(0, 64) })}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`fm-${f.id}`}>
            {t("method")}
          </label>
          <Select id={`fm-${f.id}`} value={f.method} onChange={(e) => onChange({ ...f, method: e.target.value as Factor["method"] })}>
            {methods.map((m) => (
              <option key={m} value={m} disabled={m === "permutation" && f.levels.length > 6}>
                {t(`methods.${m}`)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted">{t(`methodHints.${f.method}`)}</p>
        </div>
      </div>
      {f.kind === "pick" && f.method === "fixed" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={`fx-${f.id}`}>
            {t("fixedValue")}
          </label>
          <Select id={`fx-${f.id}`} value={f.fixedValue ?? ""} onChange={(e) => onChange({ ...f, fixedValue: e.target.value })}>
            <option value="">{t("choose")}</option>
            {f.levels.map((l) => (
              <option key={l.id} value={l.value}>
                {l.value}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {refKindSelect("refKind")}
        {f.kind === "mapping" && refKindSelect("targetRefKind")}
      </div>
      <p className="-mt-1 text-xs text-muted">{t("refHint")}</p>
      {hasConditions && f.method !== "fixed" && f.method !== "random" && (
        <Checkbox label={t("balanceWithinCondition")} checked={f.balanceWithinCondition} onChange={(v) => onChange({ ...f, balanceWithinCondition: v })} />
      )}
      <div className={f.kind === "mapping" ? "grid gap-4 lg:grid-cols-2" : ""}>
        {listEditor("levels")}
        {f.kind === "mapping" && listEditor("targets")}
      </div>
    </div>
  );
}
