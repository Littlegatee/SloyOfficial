/** Keys used for offline-ish caches (feed, dialogs). TTL + size budget to avoid unbounded growth. */

const CACHE_KEY_PREFIXES = ["feed_cache:", "dialogs_cache:"] as const;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_TOTAL_BYTES = 1_500_000; // Slightly lower default

/** Strip heavy fields from feed posts so cache fits in ~5MB localStorage budget. */
export function stripFeedPostsForCache(posts: unknown[]): unknown[] {
  if (!Array.isArray(posts)) return [];
  // Take only top 30 posts to save space
  return posts.slice(0, 30).map((raw) => {
    const p = raw as Record<string, unknown>;
    const u = p.user as Record<string, unknown> | undefined;
    const prof = u?.profile as Record<string, unknown> | undefined;
    const comm = p.community as Record<string, unknown> | undefined;
    return {
      id: p.id,
      content_text: p.content_text,
      media_type: p.media_type,
      media_url: p.media_url,
      likes_count: p.likes_count,
      comments_count: p.comments_count,
      created_at: p.created_at,
      updated_at: p.updated_at,
      is_edited: p.is_edited,
      liked_by_me: p.liked_by_me,
      author_type: p.author_type,
      community_id: p.community_id,
      community: comm
        ? {
            id: comm.id,
            name: comm.name,
            avatar_url: comm.avatar_url,
          }
        : undefined,
      user: u
        ? {
            id: u.id,
            profile: prof
              ? {
                  username: prof.username,
                  first_name: prof.first_name,
                  last_name: prof.last_name,
                  avatar_url: prof.avatar_url,
                }
              : undefined,
          }
        : undefined,
    };
  });
}

function keyIsManaged(key: string) {
  return CACHE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

function entrySize(key: string, raw: string) {
  return (key.length + raw.length) * 2;
}

export function clearAllManagedCaches() {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (keyIsManaged(key)) {
      localStorage.removeItem(key);
    }
  }
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
  try {
    pruneExpiredLocalCaches();
    enforceLocalStorageBudget();
  } catch (e) {
    console.error("Cache maintenance failed, clearing all:", e);
    clearAllManagedCaches();
  }
}
