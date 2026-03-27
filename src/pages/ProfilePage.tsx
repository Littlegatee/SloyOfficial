import { useState, useEffect, useRef } from "react";
import { MapPin, Calendar, Edit2, Camera, Loader2, X, Save, Check, UserPlus, UserMinus, UserCheck, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { useParams } from "react-router-dom";

export default function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const { user: currentUser, profile: myProfile, refreshProfile } = useAuth();
  
  const isOwnProfile = !paramUserId || paramUserId === currentUser?.id;
  const effectiveUserId = isOwnProfile ? currentUser?.id : paramUserId;

  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "photos">("posts");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    status: "",
    city: "",
  });
  const [saving, setSaving] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (isOwnProfile && myProfile) {
      setTargetProfile(myProfile);
      setEditForm({
        first_name: myProfile.first_name || "",
        last_name: myProfile.last_name || "",
        status: myProfile.status || "",
        city: myProfile.city || "",
      });
    } else if (effectiveUserId) {
      setLoading(true);
      api.get(`/profiles/${effectiveUserId}`)
        .then(({ data }) => {
          setTargetProfile(data);
        })
        .catch(() => toast.error("Профиль не найден"))
        .finally(() => setLoading(false));
    }
  }, [effectiveUserId, isOwnProfile, myProfile]);

  useEffect(() => {
    if (effectiveUserId) {
      api.get("/posts")
        .then(({ data }) => {
          setPosts(data.filter((p: any) => p.user_id === effectiveUserId) || []);
        })
        .catch(() => {});
    }
  }, [effectiveUserId]);

  useEffect(() => {
    if (!isOwnProfile && effectiveUserId) {
      api.get(`/friends/status/${effectiveUserId}`)
        .then(({ data }) => setFriendshipStatus(data.status))
        .catch(() => setFriendshipStatus(null));
    }
  }, [effectiveUserId, isOwnProfile]);

  const handleFriendAction = async () => {
    if (!effectiveUserId) return;
    try {
      if (!friendshipStatus) {
        await api.post(`/friends/request/${effectiveUserId}`);
        setFriendshipStatus('PENDING');
        toast.success("Запрос в друзья отправлен");
      } else if (friendshipStatus === 'PENDING') {
        await api.post(`/friends/cancel/${effectiveUserId}`);
        setFriendshipStatus(null);
        toast.info("Запрос отменен");
      } else if (friendshipStatus === 'ACCEPTED') {
        await api.post(`/friends/remove/${effectiveUserId}`);
        setFriendshipStatus(null);
        toast.info("Пользователь удален из друзей");
      }
    } catch (e) {
      toast.error("Ошибка при выполнении действия");
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await api.put(`/profiles/${currentUser.id}`, editForm);
      await refreshProfile();
      setIsEditing(false);
      toast.success("Профиль обновлен");
    } catch (e) {
      toast.error("Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой (максимум 5МБ)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (type === 'avatar') setPendingAvatar(base64);
      if (type === 'cover') setPendingCover(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveImage = async (type: 'avatar' | 'cover') => {
    const base64 = type === 'avatar' ? pendingAvatar : pendingCover;
    if (!base64 || !currentUser) return;

    setIsUploadingImage(true);
    try {
      await api.put(`/profiles/${currentUser.id}`, { [`${type}_url`]: base64 });
      await refreshProfile();
      toast.success(type === 'avatar' ? "Аватарка обновлена" : "Обложка обновлена");
      if (type === 'avatar') setPendingAvatar(null);
      if (type === 'cover') setPendingCover(null);
    } catch (err: any) {
      if (err.response?.status === 413) {
         toast.error("Изображение слишком большое");
      } else {
         toast.error("Ошибка загрузки");
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const cancelImage = (type: 'avatar' | 'cover') => {
    if (type === 'avatar') setPendingAvatar(null);
    if (type === 'cover') setPendingCover(null);
  };

  const tabs = [
    { id: "posts" as const, label: "Посты", count: posts.length },
    { id: "photos" as const, label: "Фото", count: 0 },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Cover */}
      <div className="relative mb-16">
        <div className="relative h-52 rounded-3xl overflow-hidden group">
          {(pendingCover || targetProfile?.cover_url) ? (
            <img src={pendingCover || targetProfile?.cover_url || ''} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-purple-500/30 to-primary/20" />
          )}
          <div className="absolute inset-0 glass-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {isOwnProfile && (
            pendingCover ? (
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button 
                  onClick={() => saveImage('cover')} 
                  disabled={isUploadingImage} 
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 shadow-lg hover:bg-primary/90 transition-colors"
                >
                  {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Сохранить
                </button>
                <button 
                  onClick={() => cancelImage('cover')} 
                  disabled={isUploadingImage} 
                  className="p-2 rounded-xl bg-background/50 backdrop-blur-md border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, 'cover')} />
                <button 
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute top-4 right-4 p-2 rounded-xl glass text-muted-foreground hover:text-foreground transition-all text-[11px] flex items-center gap-1.5 font-medium z-10 opacity-0 group-hover:opacity-100"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Изменить обложку
                </button>
              </>
            )
          )}
        </div>
        {/* Avatar */}
        <div className="absolute -bottom-12 left-6 z-20">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl border-4 border-background bg-gradient-subtle flex items-center justify-center text-gradient text-3xl font-black shadow-lg relative group overflow-hidden">
              {(pendingAvatar || targetProfile?.avatar_url) ? (
                <img src={pendingAvatar || targetProfile?.avatar_url || ''} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-gradient">{targetProfile?.first_name?.charAt(0) || "?"}</span>
              )}
              
              {isOwnProfile && !pendingAvatar && (
                <>
                  <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, 'avatar')} />
                  <button 
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-1 right-1 p-1.5 rounded-full bg-background/80 border border-border text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
            
            {isOwnProfile && pendingAvatar && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-30">
                <button 
                  onClick={() => saveImage('avatar')} 
                  disabled={isUploadingImage} 
                  className="p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
                >
                  {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => cancelImage('avatar')} 
                  disabled={isUploadingImage} 
                  className="p-1.5 rounded-full bg-background border border-border shadow-md hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{targetProfile?.first_name} {targetProfile?.last_name || ""}</h2>
            <p className="text-sm text-muted-foreground">@{targetProfile?.username}</p>
          </div>
          
          {isOwnProfile ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl glass text-xs font-medium hover:border-primary/30 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Редактировать
            </button>
          ) : (
            <button 
              onClick={handleFriendAction}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-medium transition-all ${
                friendshipStatus === 'ACCEPTED' 
                ? 'bg-secondary text-secondary-foreground' 
                : 'btn-gradient text-white'
              }`}
            >
              {friendshipStatus === 'ACCEPTED' ? <UserCheck className="w-3.5 h-3.5" /> : friendshipStatus === 'PENDING' ? <Clock className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {friendshipStatus === 'ACCEPTED' ? 'В друзьях' : friendshipStatus === 'PENDING' ? 'Запрос отправлен' : 'Добавить в друзья'}
            </button>
          )}
        </div>
        {targetProfile?.status && (
          <p className="text-sm mt-3">{targetProfile.status}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {targetProfile?.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {targetProfile.city}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            В СЛОЕ с 2025
          </span>
        </div>
        <div className="flex items-center gap-6 mt-4">
          <span className="text-xs"><strong className="text-foreground text-sm">0</strong> <span className="text-muted-foreground">Друзей</span></span>
          <span className="text-xs"><strong className="text-foreground text-sm">{posts.length}</strong> <span className="text-muted-foreground">Постов</span></span>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 border border-border shadow-2xl relative">
            <button 
              onClick={() => setIsEditing(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Редактировать профиль</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Имя</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Фамилия</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Статус (о себе)</label>
                <textarea
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Город</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl btn-gradient text-sm font-medium mt-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

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
          {activeTab === "posts" && posts.length === 0 && (isOwnProfile ? "У вас пока нет постов. Создайте первый в ленте!" : "У пользователя пока нет постов.")}
          {activeTab === "posts" && posts.length > 0 && (
            <div className="space-y-3 text-left p-4">
              {posts.map(post => (
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
