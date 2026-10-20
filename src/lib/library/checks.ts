import type { StudyConfig } from "@/lib/study/schema";
import type { LibrarySnapshot } from "@/lib/study/library";

/** Ads shown to participants must have media for every version that can be shown. */
export function mediaIssues(config: StudyConfig, lib: LibrarySnapshot): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  const needed = new Map<string, Set<string>>(); // ad id → version keys that can be shown
  const need = (adId: string | null | undefined, keys: string[]) => {
    if (!adId) return;
    const s = needed.get(adId) ?? new Set<string>();
    keys.forEach((k) => s.add(k));
    needed.set(adId, s);
  };
  for (const b of config.blocks) {
    const rules = b.type === "ad_exposure" ? b.rules : b.type === "village" || b.type === "online_shop" ? b.ads : null;
    if (!rules) continue;
    const keys = rules.version.mode === "fixed" ? [rules.version.key] : [rules.version.targetKey, rules.version.otherKey];
    if (b.type === "ad_exposure") b.ads.forEach((id) => need(id, keys));
    if (b.type === "online_shop") [...b.placements.banner, ...b.placements.sidebar, b.placements.popup].forEach((id) => need(id, keys));
    if (b.type === "village") {
      for (const sid of b.stores) {
        const s = lib.stores[sid];
        if (!s) continue;
        need(s.facadeAdId, keys);
        s.inStoreAdIds.forEach((id) => need(id, keys));
      }
    }
  }
  for (const [adId, keys] of needed) {
    const ad = lib.ads[adId];
    if (!ad) continue;
    for (const k of keys) {
      const v = ad.versions.find((x) => x.key === k);
      if (!v) out.push({ path: `library.ads.${ad.code}`, message: `Ad "${ad.code}" has no version "${k}"` });
      else if (!v.media) out.push({ path: `library.ads.${ad.code}`, message: `Ad "${ad.code}" version "${k}" has no image or video yet` });
    }
  }
  return out;
}
