import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { normalizeDigits } from "@/components/participant/i18n";
import { IntlMessageFormat } from "intl-messageformat";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("interface translations", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("no Arabic message is empty or left in English by mistake", () => {
    const flat = (o: object, p = ""): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
    // The brand name is deliberately kept in English in both languages.
    const brand = new Set(["common.platformName"]);
    for (const [k, v] of flat(ar)) {
      expect(v.trim(), k).not.toBe("");
      if (brand.has(k)) continue;
      // Every Arabic message should contain at least one Arabic letter.
      expect(/[؀-ۿ]/.test(v), `${k}: ${v}`).toBe(true);
    }
  });

  it("every interface message is valid ICU syntax in both languages", () => {
    const flat = (o: object, p = ""): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
    const bad: string[] = [];
    for (const [locale, messages] of [["en", en], ["ar", ar]] as const) {
      for (const [k, v] of flat(messages)) {
        if (k.startsWith("participant.")) continue; // participant pages use simple {name} replacement
        try {
          new IntlMessageFormat(v, locale);
        } catch {
          bad.push(`${locale}:${k}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("every translation key used in the source exists", () => {
    const root = path.resolve(__dirname, "../../src");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk(root);
    const known = new Set(keys(en));
    const missing: string[] = [];
    for (const file of files) {
      // Each top-level function gets its own translator variables, so check per function.
      const segments = readFileSync(file, "utf8").split(/\n(?=(?:export )?(?:default )?(?:async )?function )/);
      for (const src of segments) {
        // Map local translator variables to namespaces: const t = useTranslations("ns") / await getTranslations("ns")
        const ns = new Map<string, string>();
        for (const m of src.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)\("([\w.]+)"\)/g)) ns.set(m[1], m[2]);
        for (const [v, namespace] of ns) {
          for (const m of src.matchAll(new RegExp(`\\b${v}\\("([\\w.]+)"`, "g"))) {
            const key = `${namespace}.${m[1]}`;
            if (!known.has(key) && ![...known].some((k) => k.startsWith(`${key}.`))) missing.push(`${path.basename(file)}: ${key}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("Arabic-Indic digits", () => {
  it("are normalised for numeric answers", () => {
    expect(normalizeDigits("٢٥")).toBe("25");
    expect(normalizeDigits("۱۲۳")).toBe("123");
    expect(normalizeDigits("٣٫٥")).toBe("3.5");
  });
});
