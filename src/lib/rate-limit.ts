/**
 * Small fixed-window rate limiter for public endpoints.
 * It is per server instance (in memory), which is enough to blunt casual abuse
 * on a single self-hosted server. On serverless hosting each instance keeps its
 * own window; see docs/LIMITS.md.
 */
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (now - v.start > windowMs) windows.delete(k);
    }
    return true;
  }
  w.count++;
  return w.count <= limit;
}

export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
