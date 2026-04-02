import { useState, useEffect } from "react";
import { Search, UserPlus, UserCheck, UserX, Clock, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { prefetchProfile } from "@/lib/prefetchData";

interface FriendItem {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  friend_profile: { user_id: string; username: string; first_name: string; avatar_url: string | null };
  direction: "sent" | "received";
}

export default function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [tab, setTab] = useState<"all" | "requests">("all");
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/friends");
      setFriends(data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoading(false);
    }
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
    try {
      const { data } = await api.get(`/profiles?q=${q}`);
      setSearchResults(data || []);
    } catch (error) {}
  };

  const sendRequest = async (friendUserId: string) => {
    if (!user) return;
    try {
      await api.post("/friends", { friendUserId });
      toast.success("Заявка отправлена!");
      fetchFriends();
    } catch (error) {
      toast.error("Ошибка при отправке заявки");
    }
  };

  const acceptFriend = async (id: string) => {
    try {
      await api.put(`/friends/${id}/accept`);
      toast.success("Заявка принята!");
      fetchFriends();
    } catch (error) {
      toast.error("Ошибка при принятии заявки");
    }
  };

  const removeFriend = async (id: string) => {
    try {
      await api.delete(`/friends/${id}`);
      toast.success("Удалено");
      fetchFriends();
    } catch (error) {
      toast.error("Ошибка при удалении");
    }
  };


  const filtered = friends.filter(f => {
    const matchSearch = f.friend_profile.first_name.toLowerCase().includes(search.toLowerCase()) ||
      f.friend_profile.username.toLowerCase().includes(search.toLowerCase());
    if (tab === "requests") return matchSearch && f.status === "PENDING";
    return matchSearch && f.status === "ACCEPTED";
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
            <div 
              key={r.id} 
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-accent/50 transition-all cursor-pointer"
              onPointerEnter={() => prefetchProfile(r.user_id)}
              onTouchStart={() => prefetchProfile(r.user_id)}
              onClick={() => navigate(`/profile/${r.user_id}`)}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-xs overflow-hidden">
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  r.first_name.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.first_name}</p>
                <p className="text-[11px] text-muted-foreground">@{r.username}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  sendRequest(r.user_id);
                }} 
                className="px-3 py-1.5 rounded-xl btn-gradient text-[11px]"
              >
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
            <div 
              key={friend.id} 
              className="flex items-center gap-3 p-3 rounded-2xl glass transition-all hover:shadow-md cursor-pointer"
              onPointerEnter={() => prefetchProfile(friend.friend_profile.user_id)}
              onTouchStart={() => prefetchProfile(friend.friend_profile.user_id)}
              onClick={() => navigate(`/profile/${friend.friend_profile.user_id}`)}
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm overflow-hidden">
                {friend.friend_profile.avatar_url ? (
                  <img src={friend.friend_profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  friend.friend_profile.first_name.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{friend.friend_profile.first_name}</p>
                <p className="text-[11px] text-muted-foreground">@{friend.friend_profile.username}</p>
              </div>
              <div className="flex items-center gap-2">
                {friend.status === "ACCEPTED" && (
                  <>
                    <UserCheck className="w-4 h-4 text-green-500" />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFriend(friend.id);
                      }} 
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </>
                )}
                {friend.status === "PENDING" && friend.direction === "received" && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      acceptFriend(friend.id);
                    }} 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl btn-gradient text-[11px]"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Принять
                  </button>
                )}
                {friend.status === "PENDING" && friend.direction === "sent" && (
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
