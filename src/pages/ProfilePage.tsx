import { useState, useEffect, useRef } from "react";
import { MapPin, Calendar, Edit2, Loader2, X, Save, UserPlus, UserCheck, Clock, MessageCircle, Maximize2, Music as MusicIcon, Play } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useI18n } from "@/i18n/I18nContext";
import BlurImage from "@/components/BlurImage";

export default function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, profile: myProfile, refreshProfile } = useAuth();
  const { t } = useI18n();
  
  const isOwnProfile = !paramUserId || paramUserId === currentUser?.id;
  const effectiveUserId = isOwnProfile ? currentUser?.id : paramUserId;

  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "photos">("posts");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [viewAsGuest, setViewAsGuest] = useState(false);

  useEffect(() => {
    // Reset guest preview whenever we navigate to another profile.
    setViewAsGuest(false);
  }, [effectiveUserId]);

  const hidePrivateFields =
    Boolean(targetProfile?.is_limited) || (isOwnProfile && viewAsGuest);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    if (viewAsGuest) setIsEditing(false);
  }, [viewAsGuest]);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    status: "",
    city: "",
    country: "",
    language: "",
    interests: "",
    gender: "",
    favorite_movies: "",
    favorite_games: "",
  });
  const [saving, setSaving] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOwnProfile && myProfile) {
      setTargetProfile(myProfile);
      setEditForm({
        first_name: myProfile.first_name || "",
        last_name: myProfile.last_name || "",
        status: myProfile.status || "",
        city: myProfile.city || "",
        country: (myProfile as any).country || "",
        language: (myProfile as any).language || "",
        interests: (myProfile as any).interests || "",
        gender: (myProfile as any).gender || "",
        favorite_movies: (myProfile as any).favorite_movies || "",
        favorite_games: (myProfile as any).favorite_games || "",
      });
      setLoading(false);

      // Auth/profile boot response might not include `pinned_track` relation.
      // If user has a pinned track, fetch again to render it.
      if ((myProfile as any)?.pinned_track_id && !(myProfile as any)?.pinned_track) {
        api.get(`/profiles/${effectiveUserId}`)
          .then(({ data }) => setTargetProfile(data))
          .catch(() => undefined);
      }
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
      api
        .get(`/posts?user_id=${encodeURIComponent(effectiveUserId)}`)
        .then(({ data }) => setPosts(Array.isArray(data) ? data : []))
        .catch(() => setPosts([]));
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
      const payload: Record<string, string> = { ...editForm };
      if (pendingAvatar) payload.avatar_url = pendingAvatar;
      if (pendingCover) payload.cover_url = pendingCover;
      await api.put(`/profiles/${currentUser.id}`, payload);
      setPendingAvatar(null);
      setPendingCover(null);
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

  const tabs = [
    { id: "posts" as const, label: "Посты", count: posts.length },
    { id: "photos" as const, label: "Фото", count: posts.filter((p: any) => p.media_url).length },
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
      {/* Cover + avatar */}
      <div className="relative mb-16">
        <button
          type="button"
          onClick={() => targetProfile?.cover_url && setLightboxUrl(targetProfile.cover_url)}
          className="relative block w-full h-52 rounded-3xl overflow-hidden group text-left"
        >
          {targetProfile?.cover_url ? (
            <BlurImage
              src={targetProfile.cover_url}
              alt="Обложка"
              className="w-full h-full"
              objectFit="cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-purple-500/30 to-primary/20" />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            {targetProfile?.cover_url && (
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium flex items-center gap-1">
                <Maximize2 className="w-4 h-4" /> Просмотр
              </span>
            )}
          </div>
        </button>
        <div className="absolute -bottom-12 left-6 z-20">
          <button
            type="button"
            onClick={() => {
              const u = targetProfile?.avatar_url;
              if (u) setLightboxUrl(u);
            }}
            className="w-24 h-24 rounded-3xl border-4 border-background bg-gradient-subtle flex items-center justify-center text-gradient text-3xl font-black shadow-lg relative group overflow-hidden"
          >
            {targetProfile?.avatar_url ? (
              <BlurImage
                src={targetProfile.avatar_url}
                alt=""
                className="w-full h-full"
                objectFit="cover"
              />
            ) : (
              <span className="text-3xl font-black text-gradient">{targetProfile?.first_name?.charAt(0) || "?"}</span>
            )}
            {targetProfile?.avatar_url && (
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mb-8">
        {(targetProfile?.is_limited || (isOwnProfile && viewAsGuest)) && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm">
            <p className="font-medium">
              {isOwnProfile && viewAsGuest ? "Предпросмотр как гость" : t("profile.limited.title")}
            </p>
            <p className="text-muted-foreground mt-1">
              {isOwnProfile && viewAsGuest
                ? "Приватные поля скрыты в соответствии с настройками видимости профиля."
                : t("profile.limited.message")}
            </p>
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 flex-wrap">
              {targetProfile?.first_name} {targetProfile?.last_name || ""}
              {targetProfile?.is_verified && <VerifiedBadge className="w-[18px] h-[18px]" />}
            </h2>
            <p className="text-sm text-muted-foreground">@{targetProfile?.username}</p>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setViewAsGuest((v) => !v)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-2xl glass text-xs font-medium hover:border-primary/30 transition-all"
              >
                {viewAsGuest ? "Выйти из гостевого просмотра" : "Предпросмотр как гость"}
              </button>
            )}
          </div>
          
          {isOwnProfile && !viewAsGuest ? (
            <button
              type="button"
              onClick={() => {
                setPendingAvatar(null);
                setPendingCover(null);
                setIsEditing(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl glass text-xs font-medium hover:border-primary/30 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Редактировать
            </button>
          ) : isOwnProfile && viewAsGuest ? (
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl glass text-xs font-medium text-muted-foreground border border-border/50">
              Предпросмотр: редактирование недоступно
            </div>
          ) : (
            <div className="flex gap-2">
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
              
              {friendshipStatus === 'ACCEPTED' && (
                <button 
                  onClick={() => navigate(`/messages?userId=${effectiveUserId}`)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-medium transition-all btn-gradient text-white"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Написать
                </button>
              )}
            </div>
          )}
        </div>
        {!!targetProfile?.created_at || (!hidePrivateFields && targetProfile?.status) ? (
          <div className="mt-3 glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Публично</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {!hidePrivateFields && targetProfile?.status && (
                <p className="text-sm w-full">{targetProfile.status}</p>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                В СЛОЕ с{" "}
                {targetProfile?.created_at
                  ? new Date(targetProfile.created_at).getFullYear()
                  : new Date().getFullYear()}
              </span>
            </div>
          </div>
        ) : null}

        {hidePrivateFields ? (
          <div className="mt-3 glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Приватно</p>
            <p className="text-xs text-muted-foreground mt-2">
              {isOwnProfile && viewAsGuest
                ? "Приватные поля скрыты в гостевом предпросмотре. Это помогает увидеть профиль глазами других пользователей."
                : "Приватные поля скрыты настройками приватности профиля."}
            </p>
          </div>
        ) : (
          <div className="mt-3 glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Приватно</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-muted-foreground">
              {targetProfile?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {targetProfile.city}
                </span>
              )}
              {(targetProfile as any)?.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {(targetProfile as any).country}
                </span>
              )}
              {(targetProfile as any)?.language && (
                <span>Язык: {(targetProfile as any).language}</span>
              )}
              {(targetProfile as any)?.gender && (
                <span>Пол: {(targetProfile as any).gender}</span>
              )}
            </div>

            {(targetProfile as any)?.interests && (
              <p className="text-xs text-muted-foreground mt-2">
                Интересы: {(targetProfile as any).interests}
              </p>
            )}
            {((targetProfile as any)?.favorite_movies || (targetProfile as any)?.favorite_games) && (
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                {(targetProfile as any)?.favorite_movies && (
                  <p>Фильмы: {(targetProfile as any).favorite_movies}</p>
                )}
                {(targetProfile as any)?.favorite_games && (
                  <p>Игры: {(targetProfile as any).favorite_games}</p>
                )}
              </div>
            )}
          </div>
        )}

        {targetProfile?.pinned_track?.id && (
          <div className="mt-4 glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              {targetProfile?.pinned_track?.cover_url ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                  <BlurImage
                    src={targetProfile.pinned_track.cover_url}
                    alt="Обложка трека"
                    className="w-full h-full"
                    objectFit="cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <MusicIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">Закреплённый трек</p>
                <p className="text-xs text-muted-foreground truncate">
                  {targetProfile.pinned_track.title}
                  {targetProfile.pinned_track.artist ? ` · ${targetProfile.pinned_track.artist}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/music?trackId=${encodeURIComponent(targetProfile.pinned_track.id)}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-gradient text-xs font-medium text-white"
              >
                <Play className="w-3.5 h-3.5" />
                Слушать
              </button>
            </div>
          </div>
        )}

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

            <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Обложка</p>
                <div
                  className="h-28 rounded-2xl overflow-hidden glass-subtle relative cursor-pointer"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, "cover")} />
                  {(pendingCover || targetProfile?.cover_url) ? (
                    <img src={pendingCover || targetProfile?.cover_url || ""} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Нажмите, чтобы загрузить</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-2xl overflow-hidden glass-subtle shrink-0 cursor-pointer"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, "avatar")} />
                  {(pendingAvatar || targetProfile?.avatar_url) ? (
                    <img src={pendingAvatar || targetProfile?.avatar_url || ""} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Аватар</div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Нажмите на превью, чтобы выбрать новое фото. Сохраняется вместе с профилем.</p>
              </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Город</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Страна</label>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Язык</label>
                  <input
                    type="text"
                    value={editForm.language}
                    onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                    placeholder="Напр. Русский"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Пол</label>
                  <input
                    type="text"
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                    placeholder="По желанию"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Интересы</label>
                <textarea
                  value={editForm.interests}
                  onChange={(e) => setEditForm({ ...editForm, interests: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[60px]"
                  placeholder="Через запятую или свободным текстом"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Любимые фильмы</label>
                <textarea
                  value={editForm.favorite_movies}
                  onChange={(e) => setEditForm({ ...editForm, favorite_movies: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[50px]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Любимые игры</label>
                <textarea
                  value={editForm.favorite_games}
                  onChange={(e) => setEditForm({ ...editForm, favorite_games: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[50px]"
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
      ) : targetProfile?.is_limited ? (
        <div className="text-center py-16 text-muted-foreground text-sm glass rounded-3xl px-4">
          {t("profile.limited.message")}
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
          {activeTab === "photos" && posts.filter((p: any) => p.media_url).length === 0 && "Фотографий в постах пока нет."}
          {activeTab === "photos" && posts.filter((p: any) => p.media_url).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">
              {posts
                .filter((p: any) => p.media_url)
                .map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightboxUrl(p.media_url)}
                    className="aspect-square rounded-2xl overflow-hidden bg-black/10"
                  >
                    <BlurImage
                      src={p.media_url}
                      alt=""
                      className="w-full h-full"
                      objectFit="cover"
                    />
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-2 border-none bg-black/95">
          <DialogTitle className="sr-only">Просмотр фото</DialogTitle>
          <DialogDescription className="sr-only">Увеличенное изображение из профиля</DialogDescription>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="" className="w-full max-h-[85vh] object-contain rounded-xl" />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
