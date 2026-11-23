import type { Block, L10n, Question, Study } from "@/lib/study/types";

/** Both languages of a piece of researcher text, on one line. */
const both = (x?: L10n) => {
  if (!x) return "";
  const parts = [x.en && `EN: ${x.en}`, x.ar && `AR: ${x.ar}`].filter(Boolean);
  return parts.join(" | ");
};

function question(q: Question, n: number): string[] {
  const lines = [`  Q${n} [${q.type}] ${q.variable}${q.required ? " (required)" : ""}: ${both(q.text)}`];
  if (q.help && both(q.help)) lines.push(`     help: ${both(q.help)}`);
  if (q.options?.length) lines.push(`     options: ${q.options.map((o) => `${o.value}=${o.label.en ?? o.label.ar ?? ""}${o.label.ar && o.label.en ? ` / ${o.label.ar}` : ""}`).join("; ")}`);
  if (q.rows?.length) lines.push(`     rows: ${q.rows.map((r) => r.label.en ?? r.label.ar ?? r.value).join("; ")}`);
  if (q.scale) lines.push(`     scale: ${q.scale.points} points, ${both(q.scale.left)} … ${both(q.scale.right)}`);
  if (q.range) lines.push(`     range: ${q.range.min}–${q.range.max} step ${q.range.step}`);
  if (q.randomize) lines.push("     options shuffled per participant");
  if (q.attention) lines.push(`     attention check, expected answer: ${q.attention}`);
  if (q.showIf) lines.push(`     shown only if ${q.showIf.variable} ${q.showIf.op === "is" ? "=" : "≠"} ${q.showIf.value}`);
  if (q.endIf?.length) lines.push(`     ends the study (screening) if answer is: ${q.endIf.join(", ")}`);
  if (q.media) lines.push("     has an image or video");
  return lines;
}

function block(b: Block, i: number): string[] {
  const head = `${i + 1}. ${b.type.toUpperCase()}: ${both(b.title)}`;
  switch (b.type) {
    case "questions": {
      const out = [head];
      if (b.description && both(b.description)) out.push(`  ${both(b.description)}`);
      b.questions.forEach((q, n) => out.push(...question(q, n + 1)));
      return out;
    }
    case "consent":
      return [head, `  ${both(b.body)}`, `  agree: ${both(b.agree)} · decline: ${both(b.decline)}`];
    case "media":
      return [head, `  ${both(b.body)}`, `  ${b.items.length} item(s)${b.minSeconds ? `, at least ${b.minSeconds} s` : ""}`];
    default:
      return "body" in b && both(b.body) ? [head, `  ${both(b.body)}`] : [head];
  }
}

/**
 * The study as plain text for the assistant: its structure and wording only. Responses and
 * participant data are never part of it.
 */
export function studyOutline(study: Study): string {
  const lines = [
    `Study: ${study.name} (${study.kind === "shop" ? "e-commerce simulator" : "form"}, ${study.status}, version ${study.version})`,
    `Languages: ${study.languages.join(", ")}`,
    "Flow:",
    ...study.blocks.flatMap(block),
  ];
  const shop = study.shop;
  if (shop) {
    lines.push(`Shop: ${both(shop.name)}, currency ${shop.currency}, product order ${shop.order}${shop.budget ? `, budget ${shop.budget}` : ""}`);
    for (const p of shop.products)
      lines.push(`  - ${p.name.en ?? p.name.ar ?? p.id}: ${p.price}${p.was ? ` (was ${p.was})` : ""}${p.offer && both(p.offer) ? `, offer ${both(p.offer)}` : ""}${p.sponsored ? ", sponsored" : ""}`);
  }
  return lines.join("\n");
}
