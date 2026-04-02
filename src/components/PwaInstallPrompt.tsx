import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pwa_install_prompt_dismissed";

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState<boolean>(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [busy, setBusy] = useState(false);

  const isIos = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), []);
  const isStandalone = useMemo(() => {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any).standalone === true
    );
  }, []);

  useEffect(() => {
    // Chrome may log a hint until the user clicks «Установить» and we call prompt() — expected.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (hidden || isStandalone) return null;
  if (!isIos && !deferredPrompt) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setBusy(false);
      setDeferredPrompt(null);
      dismiss();
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-border/60 bg-background/80 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm mb-1">Установить Sloy на экран домой</p>
          {isIos ? (
            <p className="text-muted-foreground">
              В Safari нажмите "Поделиться", затем "На экран Домой". После установки заработают iOS push.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Установите приложение для быстрого запуска и лучшей стабильности на мобильной сети.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="px-2 py-1 rounded-lg text-muted-foreground hover:bg-white/5"
          aria-label="Закрыть подсказку установки"
        >
          ✕
        </button>
      </div>
      {!isIos && deferredPrompt && (
        <div className="mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={install}
            className="px-3 py-2 rounded-xl btn-gradient text-xs font-medium disabled:opacity-50"
          >
            {busy ? "Устанавливаем..." : "Установить приложение"}
          </button>
        </div>
      )}
    </div>
  );
}
