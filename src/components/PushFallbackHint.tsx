import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { hasActivePushSubscription } from "@/lib/pushNotifications";

const STORAGE_KEY = "sloy_push_fallback_hint_dismissed";

export default function PushFallbackHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
      const sub = await hasActivePushSubscription();
      if (cancelled || sub) return;
      if (typeof Notification !== "undefined" && Notification.permission === "denied") return;
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-3 flex flex-wrap items-start gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-[11px] leading-snug">
      <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="flex-1 min-w-[180px]">
        <p className="font-medium text-foreground">Push не включён</p>
        <p className="text-muted-foreground mt-0.5">
          Закрепите приложение на экране «Домой» и включите уведомления в{" "}
          <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
            Настройках
          </Link>
          , чтобы не пропускать сообщения, если вкладка закрыта.
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-xl px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
      >
        Понятно
      </button>
    </div>
  );
}
