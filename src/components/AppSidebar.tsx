import { NavLink, useLocation } from "react-router-dom";
import { Home, User, Users, MessageCircle, Settings, LogOut, Moon, Sun, Layers, Music } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { hasActivePushSubscription } from "@/lib/pushNotifications";
import { useI18n } from "@/i18n/I18nContext";
import { useState, useEffect, useRef } from "react";
import UserSearch from "./UserSearch";

const navItems = [
  { to: "/feed", icon: Home, labelKey: "nav.feed" as const },
  { to: "/profile", icon: User, labelKey: "nav.profile" as const },
  { to: "/friends", icon: Users, labelKey: "nav.friends" as const },
  { to: "/communities", icon: Layers, labelKey: "nav.communities" as const },
  { to: "/messages", icon: MessageCircle, labelKey: "nav.messages" as const },
  { to: "/music", icon: Music, labelKey: "nav.music" as const },
  { to: "/settings", icon: Settings, labelKey: "nav.settings" as const },
];

export default function AppSidebar() {
  const { user, profile, logout } = useAuth();
  const [messagesFallbackBadge, setMessagesFallbackBadge] = useState(false);
  const badgeFetchAt = useRef(0);
  const { t } = useI18n();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sloy_theme", next ? "dark" : "light");
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refreshBadge = async (force = false) => {
      const now = Date.now();
      if (!force && now - badgeFetchAt.current < 45_000) return;
      badgeFetchAt.current = now;
      try {
        const [sub, { data: dialogs }] = await Promise.all([
          hasActivePushSubscription(),
          api.get("/messages/dialogs"),
        ]);
        if (cancelled) return;
        const list = Array.isArray(dialogs) ? dialogs : [];
        const total = list.reduce((s: number, d: { unreadCount?: number }) => s + (d.unreadCount || 0), 0);
        setMessagesFallbackBadge(!sub && total > 0);
      } catch {
        if (!cancelled) setMessagesFallbackBadge(false);
      }
    };
    refreshBadge(true);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshBadge(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem("sloy_theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else if (saved === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  return (
    <>
      <aside className="fixed left-0 top-0 hidden h-full w-[260px] glass-strong md:flex md:flex-col z-40">
        {/* Logo */}
        <div className="p-6 pb-4">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="logo-animated">СЛОЙ</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5 font-medium">social platform</p>
        </div>

        {/* Search */}
        <UserSearch />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map(({ to, icon: Icon, labelKey }) => {
            const isActive = location.pathname === to;
            const showMsgDot = to === "/messages" && messagesFallbackBadge;
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "btn-gradient shadow-none"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <span className="relative inline-flex">
                  <Icon className="w-[18px] h-[18px]" />
                  {showMsgDot && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive shadow-sm" title="Есть непрочитанные (push выключен)" />
                  )}
                </span>
                {t(labelKey)}
              </NavLink>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div className="px-4 pb-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-2xl text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? "Светлая тема" : "Тёмная тема"}
          </button>
        </div>

        {/* User */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                profile?.first_name?.charAt(0) || "?"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile?.first_name || "Гость"}</p>
              <p className="text-[11px] text-muted-foreground truncate">@{profile?.username || "guest"}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-4 py-2 rounded-2xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 glass-strong border-t border-border/40 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-7 gap-0.5 px-1 py-2">
          {navItems.map(({ to, icon: Icon, labelKey }) => {
            const isActive = location.pathname === to;
            const showMsgDot = to === "/messages" && messagesFallbackBadge;
            return (
              <NavLink
                key={to}
                to={to}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[8px] transition-colors ${
                  isActive ? "text-primary bg-primary/10" : "text-muted-foreground"
                }`}
              >
                <span className="relative inline-flex">
                  <Icon className="w-3.5 h-3.5" />
                  {showMsgDot && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                </span>
                <span className="leading-tight text-center line-clamp-2">{t(labelKey)}</span>
              </NavLink>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-3 pb-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {isDark ? "Светлая" : "Темная"}
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </nav>
    </>
  );
}
