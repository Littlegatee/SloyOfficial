import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [status, setStatus] = useState(profile?.status || "");
  const [city, setCity] = useState(profile?.city || "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: firstName,
      last_name: lastName,
      status,
      city,
      birth_date: birthDate,
    }).eq("user_id", user.id);

    if (error) {
      toast.error("Ошибка при сохранении");
    } else {
      await refreshProfile();
      toast.success("Настройки сохранены!");
    }
    setSaving(false);
  };

  const toggleTheme = (dark: boolean) => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("sloy_theme", dark ? "dark" : "light");
    toast.success(dark ? "Тёмная тема" : "Светлая тема");
  };

  return (
    <AppLayout>
      <h2 className="text-2xl font-bold mb-6">Настройки</h2>

      {/* Profile Settings */}
      <div className="glass rounded-3xl p-6 mb-4">
        <h3 className="text-sm font-semibold mb-5 text-muted-foreground uppercase tracking-wider">Настройки профиля</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Имя</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Фамилия</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Статус (о себе)</label>
            <textarea
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Город</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Дата рождения</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl btn-gradient text-xs"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Сохранить изменения
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="glass rounded-3xl p-6">
        <h3 className="text-sm font-semibold mb-5 text-muted-foreground uppercase tracking-wider">Внешний вид</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => toggleTheme(false)}
            className={`py-4 rounded-2xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              !document.documentElement.classList.contains("dark")
                ? "btn-gradient"
                : "glass hover:border-primary/30"
            }`}
          >
            ☀️ Светлая
          </button>
          <button
            onClick={() => toggleTheme(true)}
            className={`py-4 rounded-2xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              document.documentElement.classList.contains("dark")
                ? "btn-gradient"
                : "glass hover:border-primary/30"
            }`}
          >
            🌙 Тёмная
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
