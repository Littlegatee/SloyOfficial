import { NavLink, useLocation } from "react-router-dom";
import { Home, User, Users, MessageCircle, Settings, LogOut, Moon, Sun, Layers } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import UserSearch from "./UserSearch";

const navItems = [
  { to: "/feed", icon: Home, label: "Лента" },
  { to: "/profile", icon: User, label: "Профиль" },
  { to: "/friends", icon: Users, label: "Друзья" },
  { to: "/communities", icon: Layers, label: "Сообщества" },
  { to: "/messages", icon: MessageCircle, label: "Сообщения" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];

export default function AppSidebar() {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sloy_theme", next ? "dark" : "light");
  };

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
    <aside className="fixed left-0 top-0 h-full w-[260px] glass-strong flex flex-col z-40">
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
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
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
              <Icon className="w-[18px] h-[18px]" />
              {label}
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
  );
}
