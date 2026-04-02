import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type AppLocale,
  type Key,
  translate,
  LOCALE_LABELS,
} from "./translations";

const STORAGE_KEY = "sloy_locale";

const I18nContext = createContext<{
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  t: (key: Key) => string;
  localeLabels: typeof LOCALE_LABELS;
} | null>(null);

function detectLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
  if (stored && LOCALE_LABELS[stored]) return stored;
  const nav = navigator.language || "en-GB";
  if (nav.startsWith("ru")) return "ru";
  if (nav === "en-US" || nav.startsWith("en-US")) return "en-US";
  if (nav.startsWith("en")) return "en-GB";
  if (nav.startsWith("tt")) return "tt";
  if (nav.startsWith("ce")) return "ce";
  if (nav.startsWith("hy")) return "hy";
  if (nav.startsWith("tr")) return "tr";
  if (nav.startsWith("de")) return "de";
  return "en-GB";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => detectLocale());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: Key) => translate(locale, key),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, localeLabels: LOCALE_LABELS }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
