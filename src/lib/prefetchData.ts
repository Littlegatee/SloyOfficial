import api from "@/lib/api";

const inflight = new Map<string, Promise<unknown>>();

function markInflight(key: string, p: Promise<unknown>) {
  inflight.set(key, p);
  p.finally(() => {
    window.setTimeout(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    }, 12_000);
  });
}

/** Warm cache for opening a chat: last page of messages + profile (HTTP cache / axios dedupe). */
export function prefetchChatForUser(userId: string) {
  const key = `chat:${userId}`;
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.all([
    api.get(`/messages/${userId}`, { params: { take: 50 } }).catch(() => null),
    api.get(`/profiles/${userId}`).catch(() => null),
  ]);
  markInflight(key, p);
  return p;
}

export function prefetchProfile(userId: string) {
  const key = `prof:${userId}`;
  if (inflight.has(key)) return inflight.get(key);
  const p = api.get(`/profiles/${userId}`).catch(() => null);
  markInflight(key, p);
  return p;
}
