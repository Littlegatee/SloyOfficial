import { useState, useEffect } from "react";
import { MapPin, Calendar, Edit2, Camera, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"posts" | "photos">("posts");
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      api.get("/posts") // In a real app, you'd have a /posts/user/:id endpoint
        .then(({ data }) => {
          setMyPosts(data.filter((p: any) => p.user_id === user.id) || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user]);


  const tabs = [
    { id: "posts" as const, label: "Посты", count: myPosts.length },
    { id: "photos" as const, label: "Фото", count: 0 },
  ];

  return (
    <AppLayout>
      {/* Cover */}
      <div className="relative h-52 rounded-3xl overflow-hidden mb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-purple-500/30 to-primary/20" />
        <div className="absolute inset-0 glass-subtle" />
        <button className="absolute top-4 right-4 p-2 rounded-xl glass text-muted-foreground hover:text-foreground transition-all text-[11px] flex items-center gap-1.5 font-medium">
          <Camera className="w-3.5 h-3.5" />
          Обложка
        </button>
        {/* Avatar */}
        <div className="absolute -bottom-12 left-6">
          <div className="w-24 h-24 rounded-3xl border-4 border-background bg-gradient-subtle flex items-center justify-center text-gradient text-3xl font-black shadow-lg">
            {profile?.first_name?.charAt(0) || "?"}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{profile?.first_name} {profile?.last_name || ""}</h2>
            <p className="text-sm text-muted-foreground">@{profile?.username}</p>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-2xl glass text-xs font-medium hover:border-primary/30 transition-all">
            <Edit2 className="w-3.5 h-3.5" />
            Редактировать
          </button>
        </div>
        {profile?.status && (
          <p className="text-sm mt-3">{profile.status}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {profile?.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {profile.city}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            В СЛОЕ с 2025
          </span>
        </div>
        <div className="flex items-center gap-6 mt-4">
          <span className="text-xs"><strong className="text-foreground text-sm">0</strong> <span className="text-muted-foreground">Друзей</span></span>
          <span className="text-xs"><strong className="text-foreground text-sm">{myPosts.length}</strong> <span className="text-muted-foreground">Постов</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-2xl text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "btn-gradient"
                : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label} {tab.count > 0 && `(${tab.count})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground text-sm glass rounded-3xl">
          {activeTab === "posts" && myPosts.length === 0 && "У вас пока нет постов. Создайте первый в ленте!"}
          {activeTab === "posts" && myPosts.length > 0 && (
            <div className="space-y-3 text-left p-4">
              {myPosts.map(post => (
                <div key={post.id} className="glass rounded-2xl p-4">
                  <p className="text-sm">{post.content_text}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    ❤️ {post.likes_count || 0} · 💬 {post.comments_count || 0}
                  </p>
                </div>
              ))}
            </div>
          )}
          {activeTab === "photos" && "Фотографий пока нет."}
        </div>
      )}
    </AppLayout>
  );
}
