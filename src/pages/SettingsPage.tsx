import { useState, useEffect } from "react";
import { Save, Loader2, Moon, Sun, Monitor, Bell, Shield, User, Lock, Eye, ChevronRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "privacy" | "notifications">("profile");

  // Profile Form
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [status, setStatus] = useState(profile?.status || "");
  const [city, setCity] = useState(profile?.city || "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date || "");
  const [saving, setSaving] = useState(false);

  // Appearance State
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Privacy State (Mocked)
  const [privacySettings, setPrivacySettings] = useState({
    phoneNumber: "nobody",
    lastSeen: "contacts",
    profilePhoto: "everyone",
    messages: "everyone",
    calls: "contacts",
  });

  // Notifications State (Mocked)
  const [notifications, setNotifications] = useState({
    privateMessages: true,
    groupMessages: true,
    sounds: true,
    showPreview: false,
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("sloy_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme("system");
    }
  }, []);

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

  const savePrivacy = () => {
    toast.success("Настройки конфиденциальности сохранены");
  };

  const saveNotifications = () => {
    toast.success("Настройки уведомлений сохранены");
  };

  const menuItems = [
    { id: "profile", label: "Профиль", icon: User },
    { id: "appearance", label: "Оформление", icon: Moon },
    { id: "privacy", label: "Конфиденциальность", icon: Shield },
    { id: "notifications", label: "Уведомления", icon: Bell },
  ] as const;

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto">
        {/* Sidebar Menu */}
        <div className="w-full md:w-64 flex-shrink-0">
          <h2 className="text-2xl font-bold mb-6 px-2">Настройки</h2>
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
                    <span className="font-medium text-sm">{item.label}</span>
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

              <div>
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
            </div>
          )}

          {/* Privacy Settings */}
          {activeTab === "privacy" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Конфиденциальность
              </h3>
              
              <div className="space-y-6 max-w-xl">
                {[
                  { id: "phoneNumber", label: "Номер телефона", icon: Lock },
                  { id: "lastSeen", label: "Последняя активность", icon: Eye },
                  { id: "profilePhoto", label: "Фотография профиля", icon: User },
                  { id: "messages", label: "Личные сообщения", icon: Bell },
                ].map((setting) => (
                  <div key={setting.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-background/50 border border-border/50">
                    <div className="flex items-center gap-3">
                      <setting.icon className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium text-sm">{setting.label}</span>
                    </div>
                    <select
                      value={privacySettings[setting.id as keyof typeof privacySettings]}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, [setting.id]: e.target.value })}
                      className="bg-transparent border-none text-sm text-primary font-medium focus:ring-0 cursor-pointer outline-none"
                    >
                      <option value="everyone">Все</option>
                      <option value="contacts">Мои контакты</option>
                      <option value="nobody">Никто</option>
                    </select>
                  </div>
                ))}

                <div className="pt-4">
                  <button
                    onClick={savePrivacy}
                    className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить настройки
                  </button>
                </div>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
