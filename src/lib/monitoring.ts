type ErrorContext = Record<string, unknown>;

type TelemetryItem = {
  ts: string;
  kind: "error" | "api";
  context: ErrorContext;
  error: unknown;
};

const BATCH_MAX = 12;
const FLUSH_MS = 8_000;
let queue: TelemetryItem[] = [];
let flushTimer: number | null = null;

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : safeStringify(error);
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushTelemetry();
  }, FLUSH_MS);
}

/** Flush batched client telemetry (errors / API failures). Safe to call on unload. */
export function flushTelemetry() {
  if (!queue.length) return;
  const batch = queue.splice(0, BATCH_MAX);
  // В проде не шумим console.error — это не падение приложения, а очередь событий.
  if (import.meta.env.DEV) {
    console.error("[telemetry-batch]", batch);
  }
}

function enqueue(item: TelemetryItem) {
  queue.push(item);
  if (queue.length >= BATCH_MAX) {
    flushTelemetry();
  } else {
    scheduleFlush();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    flushTelemetry();
  });
}

export function reportClientError(error: unknown, context: ErrorContext = {}) {
  enqueue({
    ts: new Date().toISOString(),
    kind: "error",
    context,
    error: normalizeError(error),
  });
}

/** API layer: same batching path to reduce console noise and future ingest load. */
export function reportApiFailure(error: unknown, context: ErrorContext = {}) {
  enqueue({
    ts: new Date().toISOString(),
    kind: "api",
    context,
    error: normalizeError(error),
  });
}

export function setupGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    reportClientError(event.error || event.message, { source: "window.error" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, { source: "window.unhandledrejection" });
  });
}
