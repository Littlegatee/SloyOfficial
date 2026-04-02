/** Keys used for offline-ish caches (feed, dialogs). TTL + size budget to avoid unbounded growth. */

const CACHE_KEY_PREFIXES = ["feed_cache:", "dialogs_cache:"] as const;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_TOTAL_BYTES = 2_500_000;

function keyIsManaged(key: string) {
  return CACHE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

function entrySize(key: string, raw: string) {
  return key.length * 2 + raw.length * 2;
}

export function pruneExpiredLocalCaches(maxAgeMs = DEFAULT_TTL_MS) {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (!keyIsManaged(key)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { ts?: number };
      if (typeof parsed.ts !== "number" || Number.isNaN(parsed.ts)) {
        localStorage.removeItem(key);
        continue;
      }
      if (Date.now() - parsed.ts > maxAgeMs) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}

export function enforceLocalStorageBudget(maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES) {
  const entries: { key: string; ts: number; size: number }[] = [];
  let total = 0;
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (!keyIsManaged(key)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { ts?: number };
      const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
      const size = entrySize(key, raw);
      entries.push({ key, ts, size });
      total += size;
    } catch {
      localStorage.removeItem(key);
    }
  }
  if (total <= maxTotalBytes) return;
  entries.sort((a, b) => a.ts - b.ts);
  for (const e of entries) {
    if (total <= maxTotalBytes) break;
    localStorage.removeItem(e.key);
    total -= e.size;
  }
}

export function runLocalStorageCacheMaintenance() {
  pruneExpiredLocalCaches();
  enforceLocalStorageBudget();
}
