import { useState, useEffect, useRef } from "react";
import { Save, Loader2, Moon, Sun, Monitor, Bell, Shield, User, ChevronRight, Camera, Image as ImageIcon, Palette, LogOut, Check, ArrowLeft, Languages, BadgeCheck } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nContext";
import type { AppLocale } from "@/i18n/translations";
import {
  registerPushNotifications,
  sendPushTestNotification,
  unregisterPushNotifications,
} from "@/lib/pushNotifications";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t, locale, setLocale, localeLabels } = useI18n();
  const [activeTab, setActiveTab] = useState<
    "profile" | "appearance" | "privacy" | "notifications" | "language" | "admin"
  >("profile");

  // Profile Form
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [status, setStatus] = useState(profile?.status || "");
  const [city, setCity] = useState(profile?.city || "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date || "");
  const [saving, setSaving] = useState(false);

  // Appearance State
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [globalWallpaper, setGlobalWallpaper] = useState<string | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const [profileVisibility, setProfileVisibility] = useState<"PUBLIC" | "FRIENDS_ONLY" | "PRIVATE">("PUBLIC");
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const pv = (profile as any).profile_visibility as string | undefined;
    if (pv === "FRIENDS_ONLY" || pv === "PRIVATE" || pv === "PUBLIC") {
      setProfileVisibility(pv);
    }
    if (typeof (profile as any).allow_friend_requests === "boolean") {
      setAllowFriendRequests((profile as any).allow_friend_requests);
    }
  }, [profile]);

  useEffect(() => {
    api
      .get("/admin/me")
      .then((r) => setIsAdmin(!!r.data?.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  // Notifications State (Mocked)
  const [notifications, setNotifications] = useState({
    privateMessages: true,
    groupMessages: true,
    sounds: true,
    showPreview: false,
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sloy_notifications");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setNotifications((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // ignore corrupted local settings
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sloy_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any).standalone === true;
    setIsIosDevice(ios);
    setIsStandalone(Boolean(standalone));

    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setPushEnabled(Boolean(sub)))
      .catch(() => setPushEnabled(false));
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("sloy_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme("system");
    }
    
    const savedWallpaper = localStorage.getItem("global_chat_wallpaper");
    if (savedWallpaper) {
      setGlobalWallpaper(savedWallpaper);
    }
  }, []);

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Изображение слишком большое (максимум 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      
      // Create a temporary image to resize it for better quality/size ratio
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions (max 1920x1080)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw with high quality
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Save as high quality JPEG
        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.9);
        
        localStorage.setItem("global_chat_wallpaper", optimizedBase64);
        setGlobalWallpaper(optimizedBase64);
        toast.success("Общие обои для чатов обновлены");
      };
      img.src = base64data;
    };
  };

  const removeGlobalWallpaper = () => {
    localStorage.removeItem("global_chat_wallpaper");
    setGlobalWallpaper(null);
    toast.success("Общие обои сброшены");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.put(`/profiles/${user.id}`, {
        first_name: firstName,
        last_name: lastName,
        status,
        city,
        birth_date: birthDate,
      });
      await refreshProfile();
      toast.success("Настройки профиля сохранены!");
    } catch (error) {
      toast.error("Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "system") {
      localStorage.removeItem("sloy_theme");
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      toast.success("Установлена системная тема");
    } else {
      localStorage.setItem("sloy_theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      toast.success(newTheme === "dark" ? "Тёмная тема" : "Светлая тема");
    }
  };

  const applyAccentColor = (color: string) => {
    // color is like '262.1 83.3% 57.8%'
    document.documentElement.style.setProperty('--primary', color);
    localStorage.setItem("sloy_accent_color", color);
    toast.success("Цветовой акцент обновлен");
  };

  useEffect(() => {
    const savedColor = localStorage.getItem("sloy_accent_color");
    if (savedColor) {
      document.documentElement.style.setProperty('--primary', savedColor);
    }
  }, []);

  const savePrivacy = async () => {
    if (!user) return;
    setPrivacySaving(true);
    try {
      await api.patch(`/profiles/${user.id}/privacy`, {
        profile_visibility: profileVisibility,
        allow_friend_requests: allowFriendRequests,
      });
      await refreshProfile();
      toast.success(t("settings.privacy.saved"));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Ошибка");
    } finally {
      setPrivacySaving(false);
    }
  };

  const setVerification = async (verified: boolean) => {
    if (!adminUserId.trim()) {
      toast.error(t("admin.userId"));
      return;
    }
    setAdminBusy(true);
    try {
      await api.post(`/admin/users/${adminUserId.trim()}/verification`, { verified });
      toast.success(t("admin.done"));
      setAdminUserId("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Ошибка");
    } finally {
      setAdminBusy(false);
    }
  };

  const saveNotifications = () => {
    toast.success("Настройки уведомлений сохранены локально");
  };

  const enablePush = async () => {
    setPushBusy(true);
    try {
      await registerPushNotifications();
      setPushEnabled(true);
      toast.success("Push-уведомления включены");
    } catch (error: any) {
      toast.error(error?.message || "Не удалось включить push");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      await unregisterPushNotifications();
      setPushEnabled(false);
      toast.success("Push-уведомления выключены");
    } catch (error: any) {
      toast.error(error?.message || "Не удалось выключить push");
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    setPushBusy(true);
    try {
      await sendPushTestNotification();
      toast.success("Тестовое уведомление отправлено");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Не удалось отправить тест");
    } finally {
      setPushBusy(false);
    }
  };

  const menuItems = [
    { id: "profile" as const, labelKey: "settings.tab.profile" as const, icon: User },
    { id: "appearance" as const, labelKey: "settings.tab.appearance" as const, icon: Moon },
    { id: "privacy" as const, labelKey: "settings.tab.privacy" as const, icon: Shield },
    { id: "notifications" as const, labelKey: "settings.tab.notifications" as const, icon: Bell },
    { id: "language" as const, labelKey: "settings.tab.language" as const, icon: Languages },
    ...(isAdmin ? [{ id: "admin" as const, labelKey: "admin.verify" as const, icon: BadgeCheck }] as const : []),
  ];

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto">
        {/* Sidebar Menu */}
        <div className="w-full md:w-64 flex-shrink-0">
          <h2 className="text-2xl font-bold mb-6 px-2">{t("settings.title")}</h2>
          <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between p-3 md:p-4 rounded-2xl transition-all whitespace-nowrap md:whitespace-normal ${
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{t(item.labelKey)}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden md:block opacity-50" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 glass rounded-3xl p-6 md:p-8 min-h-[600px]">
          {/* Profile Settings */}
          {activeTab === "profile" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Настройки профиля
              </h3>
              <div className="space-y-5 max-w-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Имя</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Фамилия</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">О себе</label>
                  <textarea
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    placeholder="Напишите немного о себе..."
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[100px]"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Город</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Дата рождения</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 rounded-2xl btn-gradient text-sm font-medium"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Сохранить изменения
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === "appearance" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Moon className="w-5 h-5 text-primary" /> Оформление
              </h3>
              
              <div className="mb-8">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Тема приложения</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => applyTheme("light")}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                      theme === "light" ? "border-primary bg-primary/5" : "border-transparent glass hover:bg-muted"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                      <Sun className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-sm">Светлая</span>
                  </button>
                  <button
                    onClick={() => applyTheme("dark")}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                      theme === "dark" ? "border-primary bg-primary/5" : "border-transparent glass hover:bg-muted"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300">
                      <Moon className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-sm">Тёмная</span>
                  </button>
                  <button
                    onClick={() => applyTheme("system")}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                      theme === "system" ? "border-primary bg-primary/5" : "border-transparent glass hover:bg-muted"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <Monitor className="w-6 h-6" />
                    </div>
                    <span className="font-medium text-sm">Системная</span>
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Цветовой акцент</h4>
                <div className="flex gap-3">
                  {['262.1 83.3% 57.8%', '221.2 83.2% 53.3%', '160 84.1% 39.4%', '45.4 93.4% 47.5%', '0 84.2% 60.2%', '330 81.3% 60.6%'].map((color) => (
                    <button 
                      key={color} 
                      onClick={() => applyAccentColor(color)}
                      className="w-10 h-10 rounded-full border-2 border-transparent hover:scale-110 transition-transform focus:border-foreground" 
                      style={{ backgroundColor: `hsl(${color})` }} 
                    />
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-border/30 space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" /> Обои для чатов (Общие)
                </h3>
                <p className="text-sm text-muted-foreground max-w-xl">
                  Эти обои будут использоваться во всех чатах по умолчанию. Вы можете установить индивидуальные обои для конкретного чата в его настройках (мини-профиль).
                </p>
                
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="w-48 h-64 rounded-2xl border border-border/50 bg-black/20 overflow-hidden relative shrink-0 flex items-center justify-center">
                    {globalWallpaper ? (
                      <img src={globalWallpaper} alt="Wallpaper preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8 opacity-50" />
                        <span>По умолчанию</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <input 
                      type="file" 
                      ref={wallpaperInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleWallpaperChange} 
                    />
                    <button 
                      onClick={() => wallpaperInputRef.current?.click()}
                      className="px-6 py-3 rounded-xl btn-gradient font-medium flex items-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4" /> Выбрать из галереи
                    </button>
                    
                    {globalWallpaper && (
                      <button 
                        onClick={removeGlobalWallpaper}
                        className="px-6 py-3 rounded-xl bg-red-500/10 text-red-500 font-medium flex items-center gap-2 hover:bg-red-500/20 transition-colors"
                      >
                        Сбросить обои
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Settings */}
          {activeTab === "privacy" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> {t("settings.tab.privacy")}
              </h3>

              <div className="space-y-6 max-w-xl">
                <div className="p-4 rounded-2xl bg-background/50 border border-border/50 space-y-2">
                  <p className="font-medium text-sm">{t("settings.privacy.visibility")}</p>
                  <select
                    value={profileVisibility}
                    onChange={(e) =>
                      setProfileVisibility(e.target.value as "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE")
                    }
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm"
                  >
                    <option value="PUBLIC">{t("settings.privacy.public")}</option>
                    <option value="FRIENDS_ONLY">{t("settings.privacy.friends")}</option>
                    <option value="PRIVATE">{t("settings.privacy.private")}</option>
                  </select>
                </div>

                <label className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-background/50 border border-border/50 cursor-pointer">
                  <span className="font-medium text-sm">{t("settings.privacy.friendRequests")}</span>
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-primary"
                    checked={allowFriendRequests}
                    onChange={(e) => setAllowFriendRequests(e.target.checked)}
                  />
                </label>

                <p className="text-xs text-muted-foreground">
                  Личные сообщения и «онлайн» настраиваются отдельно в блоке ниже (если появится) или через
                  существующие параметры профиля.
                </p>

                <button
                  type="button"
                  onClick={savePrivacy}
                  disabled={privacySaving}
                  className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {privacySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t("settings.privacy.save")}
                </button>
              </div>
            </div>
          )}

          {activeTab === "language" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Languages className="w-5 h-5 text-primary" /> {t("settings.tab.language")}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xl">{t("settings.language.hint")}</p>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as AppLocale)}
                className="w-full max-w-md px-4 py-3 rounded-2xl bg-background border border-border text-sm"
              >
                {(Object.keys(localeLabels) as AppLocale[]).map((loc) => (
                  <option key={loc} value={loc}>
                    {localeLabels[loc]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "admin" && isAdmin && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-primary" /> {t("admin.verify")}
              </h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-xl">
                Укажите UUID пользователя (из профиля или БД). Доступ только для аккаунтов из
                ADMIN_EMAILS в .env на сервере.
              </p>
              <input
                value={adminUserId}
                onChange={(e) => setAdminUserId(e.target.value)}
                placeholder={t("admin.userId")}
                className="w-full max-w-md px-4 py-3 rounded-2xl bg-background border border-border text-sm mb-4"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={adminBusy}
                  onClick={() => setVerification(true)}
                  className="px-6 py-2 rounded-xl btn-gradient text-sm font-medium disabled:opacity-50"
                >
                  {t("admin.grant")}
                </button>
                <button
                  type="button"
                  disabled={adminBusy}
                  onClick={() => setVerification(false)}
                  className="px-6 py-2 rounded-xl glass text-sm font-medium disabled:opacity-50"
                >
                  {t("admin.revoke")}
                </button>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === "notifications" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" /> Уведомления и звуки
              </h3>
              
              <div className="space-y-4 max-w-xl">
                {[
                  { id: "privateMessages", label: "Личные сообщения", desc: "Уведомления о новых личных сообщениях" },
                  { id: "groupMessages", label: "Групповые чаты", desc: "Уведомления из бесед и групп" },
                  { id: "sounds", label: "Звук в приложении", desc: "Звуковые сигналы при получении сообщений" },
                  { id: "showPreview", label: "Показывать текст", desc: "Отображать текст сообщения в уведомлениях" },
                ].map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between p-4 rounded-2xl bg-background/50 border border-border/50">
                    <div>
                      <h4 className="font-medium text-sm">{setting.label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{setting.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={notifications[setting.id as keyof typeof notifications]}
                        onChange={(e) => setNotifications({ ...notifications, [setting.id]: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}

                <div className="pt-6">
                  <button
                    onClick={saveNotifications}
                    className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить настройки
                  </button>
                </div>
                <div className="mt-6 p-4 rounded-2xl bg-background/50 border border-border/50">
                  <h4 className="font-medium text-sm mb-1">Push-уведомления для iPhone/Android</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                  Для iOS: откройте сайт в Safari, нажмите "Поделиться", затем "На экран Домой", после этого включите push ниже.
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Статус: {isStandalone ? "режим веб-приложения активен" : "открыто в браузере"} ·
                    push {pushEnabled ? "включен" : "выключен"}
                    {isIosDevice && !isStandalone ? " · для iPhone нужен запуск с экрана Домой" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pushEnabled ? (
                      <button
                        type="button"
                        disabled={pushBusy}
                        onClick={disablePush}
                        className="px-4 py-2 rounded-xl glass text-xs font-medium disabled:opacity-50"
                      >
                        Выключить push
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pushBusy}
                        onClick={enablePush}
                        className="px-4 py-2 rounded-xl btn-gradient text-xs font-medium disabled:opacity-50"
                      >
                        Включить push
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pushBusy || !pushEnabled}
                      onClick={testPush}
                      className="px-4 py-2 rounded-xl glass text-xs font-medium disabled:opacity-50"
                    >
                      Тест push
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
