import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { toast } from "sonner";
import { Users, Megaphone, MessageSquare, BarChart, ShieldCheck, CheckCircle, Loader2 } from "lucide-react";

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch (error) {
      toast.error("Доступ запрещен или ошибка сервера");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-black">Админ-панель</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass p-6 rounded-3xl text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats?.users || 0}</p>
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Пользователи</p>
          </div>
          <div className="glass p-6 rounded-3xl text-center">
            <MessageSquare className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats?.posts || 0}</p>
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Посты</p>
          </div>
          <div className="glass p-6 rounded-3xl text-center">
            <Megaphone className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats?.communities || 0}</p>
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Сообщества</p>
          </div>
          <div className="glass p-6 rounded-3xl text-center">
            <BarChart className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats?.messages || 0}</p>
            <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Сообщения</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="glass p-6 rounded-3xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Новые пользователи
            </h3>
            <div className="space-y-3">
              {stats?.recentUsers?.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                    {u.profile?.avatar_url ? <img src={u.profile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">{u.profile?.first_name?.charAt(0)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate">{u.profile?.first_name} {u.profile?.last_name}</p>
                      {u.profile?.is_verified && <CheckCircle className="w-3 h-3 text-primary" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">@{u.profile?.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6 rounded-3xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Новые сообщества
            </h3>
            <div className="space-y-3">
              {stats?.recentCommunities?.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted overflow-hidden">
                    {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs">{c.name?.charAt(0)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.is_verified && <CheckCircle className="w-3 h-3 text-primary" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{c.type === 'CHANNEL' ? 'Канал' : 'Группа'} · {c.category || "Без категории"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Инструменты верификации
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Для выдачи верификации используйте API или специальную кнопку в профиле (в разработке).
            В текущей версии верификация выдается автоматически разработчикам.
          </p>
          <div className="flex gap-4">
            <button className="px-6 py-3 rounded-2xl btn-gradient text-sm font-bold opacity-50 cursor-not-allowed">
              Список запросов
            </button>
            <button className="px-6 py-3 rounded-2xl glass text-sm font-bold opacity-50 cursor-not-allowed">
              Журнал действий
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
