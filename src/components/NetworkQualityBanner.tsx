import { useEffect, useState } from "react";
import { WifiOff, Gauge } from "lucide-react";

function isBadConnection(): boolean {
  if (typeof navigator === "undefined" || !navigator.onLine) return true;
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!c) return false;
  if (c.saveData) return true;
  const t = String(c.effectiveType || "").toLowerCase();
  return t === "2g" || t === "slow-2g";
}

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, fn: () => void) => void;
  removeEventListener?: (type: string, fn: () => void) => void;
};

const DISMISS_KEY = "sloy_network_banner_dismiss_session";

export default function NetworkQualityBanner() {
  const [bad, setBad] = useState(isBadConnection);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === "1"
  );

  useEffect(() => {
    const tick = () => setBad(isBadConnection());
    tick();
    window.addEventListener("online", tick);
    window.addEventListener("offline", tick);
    const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    c?.addEventListener?.("change", tick);
    return () => {
      window.removeEventListener("online", tick);
      window.removeEventListener("offline", tick);
      c?.removeEventListener?.("change", tick);
    };
  }, []);

  if (!bad || dismissed) return null;

  const enableLite = () => {
    localStorage.setItem("feed_lite_mode", "1");
    window.dispatchEvent(new CustomEvent("sloy:liteMode", { detail: { enabled: true } }));
  };

  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100"
    >
      {navigator.onLine ? (
        <Gauge className="h-3.5 w-3.5 shrink-0 opacity-80" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 shrink-0 opacity-80" />
      )}
      <span className="flex-1 min-w-[200px]">
        Плохая сеть — включены облегчённые режимы (меньше трафика, проще медиа).
      </span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={enableLite}
          className="rounded-xl bg-amber-600/90 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-amber-600"
        >
          Lite-лента
        </button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="rounded-xl px-2.5 py-1 text-[10px] text-amber-900/80 hover:bg-amber-500/20 dark:text-amber-50/90"
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}
