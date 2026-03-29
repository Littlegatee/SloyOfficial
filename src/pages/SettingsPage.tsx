import { useState, useEffect, useRef } from "react";
import { Save, Loader2, Moon, Sun, Monitor, Bell, Shield, User, Lock, Eye, ChevronRight, Camera, Image as ImageIcon, Palette, LogOut, Check, ArrowLeft } from "lucide-react";
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
  const [globalWallpaper, setGlobalWallpaper] = useState<string | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

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
