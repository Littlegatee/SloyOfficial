import { useState, useEffect } from "react";
import { Search, UserPlus, UserCheck, UserX, Clock, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FriendItem {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  friend_profile: { username: string; first_name: string; avatar_url: string | null };
  direction: "sent" | "received";
}

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [tab, setTab] = useState<"all" | "requests">("all");
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    if (!user) return;

    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendships) {
      const items: FriendItem[] = [];
      for (const f of friendships) {
        const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, first_name, avatar_url")
          .eq("user_id", otherId)
          .single();
        items.push({
          id: f.id,
          user_id: f.user_id,
          friend_id: f.friend_id,
          status: f.status || "pending",
          friend_profile: profile || { username: "unknown", first_name: "?", avatar_url: null },
          direction: f.user_id === user.id ? "sent" : "received",
        });
      }
      setFriends(items);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFriends();
  }, [user]);

  const searchUsers = async (q: string) => {
    setSearch(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("user_id", user?.id)
      .or(`username.ilike.%${q}%,first_name.ilike.%${q}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const sendRequest = async (friendUserId: string) => {
    if (!user) return;
    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: friendUserId,
    });
    if (error) {
      toast.error("Ошибка при отправке заявки");
    } else {
      toast.success("Заявка отправлена!");
      fetchFriends();
    }
  };

  const acceptFriend = async (id: string) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    toast.success("Заявка принята!");
    fetchFriends();
  };

  const removeFriend = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
    toast.success("Удалено");
    fetchFriends();
  };

  const filtered = friends.filter(f => {
    const matchSearch = f.friend_profile.first_name.toLowerCase().includes(search.toLowerCase()) ||
      f.friend_profile.username.toLowerCase().includes(search.toLowerCase());
    if (tab === "requests") return matchSearch && f.status === "pending";
    return matchSearch;
  });

  return (
    <AppLayout>
      <h2 className="text-2xl font-bold mb-6">Друзья</h2>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => searchUsers(e.target.value)}
          placeholder="Поиск людей..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl glass text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="glass rounded-3xl p-3 mb-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1 font-medium">Результаты поиска</p>
          {searchResults.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-accent/50 transition-all">
              <div className="w-9 h-9 rounded-xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-xs">
                {r.first_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.first_name}</p>
                <p className="text-[11px] text-muted-foreground">@{r.username}</p>
              </div>
              <button onClick={() => sendRequest(r.user_id)} className="px-3 py-1.5 rounded-xl btn-gradient text-[11px]">
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(["all", "requests"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-medium transition-all ${
              tab === t ? "btn-gradient" : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all" ? "Все" : "Заявки"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(friend => (
            <div key={friend.id} className="flex items-center gap-3 p-3 rounded-2xl glass transition-all hover:shadow-md">
              <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm">
                {friend.friend_profile.first_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{friend.friend_profile.first_name}</p>
                <p className="text-[11px] text-muted-foreground">@{friend.friend_profile.username}</p>
              </div>
              <div className="flex items-center gap-2">
                {friend.status === "accepted" && (
                  <>
                    <UserCheck className="w-4 h-4 text-green-500" />
                    <button onClick={() => removeFriend(friend.id)} className="p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                      <UserX className="w-4 h-4" />
                    </button>
                  </>
                )}
                {friend.status === "pending" && friend.direction === "received" && (
                  <button onClick={() => acceptFriend(friend.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl btn-gradient text-[11px]">
                    <UserPlus className="w-3.5 h-3.5" />
                    Принять
                  </button>
                )}
                {friend.status === "pending" && friend.direction === "sent" && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    Отправлено
                  </span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-muted-foreground text-sm glass rounded-3xl">
              {tab === "requests" ? "Нет заявок" : "Пока нет друзей. Найдите кого-нибудь через поиск!"}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
