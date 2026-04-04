import { useState, useEffect, useRef } from "react";
import { MapPin, Calendar, Edit2, Loader2, X, Save, UserPlus, UserCheck, Clock, MessageCircle, Maximize2, Music as MusicIcon, Play, Heart, Share2, MoreVertical } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth, Profile } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useI18n } from "@/i18n/I18nContext";
import BlurImage from "@/components/BlurImage";
import { socket } from "@/lib/socket";

export default function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, profile: myProfile, refreshProfile } = useAuth();
  const { t } = useI18n();
  
  const isOwnProfile = !paramUserId || paramUserId === currentUser?.id;
  const effectiveUserId = isOwnProfile ? currentUser?.id : paramUserId;

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "photos">("posts");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time socket events
  useEffect(() => {
    if (!effectiveUserId) return;

    const handlePostLiked = ({ postId, likesCount, likedByMe, userId }: any) => {
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, likes_count: likesCount, liked_by_me: userId === currentUser?.id ? likedByMe : p.liked_by_me } : p
      ));
    };

    const handleNewComment = ({ postId, commentsCount }: any) => {
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, comments_count: commentsCount } : p
      ));
    };

    const handleNewPost = (post: any) => {
      if (post.user_id === effectiveUserId) {
        setPosts(prev => [post, ...prev]);
      }
    };

    socket.on("post_liked", handlePostLiked);
    socket.on("new_comment", handleNewComment);
    socket.on("new_post", handleNewPost);

    return () => {
      socket.off("post_liked", handlePostLiked);
      socket.off("new_comment", handleNewComment);
      socket.off("new_post", handleNewPost);
    };
  }, [effectiveUserId, currentUser?.id]);

  const toggleLike = async (postId: string, currentlyLiked: boolean) => {
    try {
      // Optimistic update
      setPosts(prev => prev.map(p => 
        p.id === postId ? { 
          ...p, 
          liked_by_me: !currentlyLiked, 
          likes_count: p.likes_count + (currentlyLiked ? -1 : 1) 
        } : p
      ));

      if (currentlyLiked) {
        await api.delete(`/posts/${postId}/like`);
      } else {
        await api.post(`/posts/${postId}/like`);
      }
    } catch (error) {
      // Revert on error
      setPosts(prev => prev.map(p => 
        p.id === postId ? { 
          ...p, 
          liked_by_me: currentlyLiked, 
          likes_count: p.likes_count 
        } : p
      ));
      toast.error("Не удалось изменить лайк");
    }
  };
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [viewAsGuest, setViewAsGuest] = useState(false);

  useEffect(() => {
    // Reset guest preview whenever we navigate to another profile.
    setViewAsGuest(false);
  }, [effectiveUserId]);

  const isFriend = friendshipStatus === 'ACCEPTED';
  const hidePrivateFields =
    isOwnProfile 
      ? viewAsGuest // If own profile, only hide if guest view is on
      : (
          targetProfile?.is_limited || 
          (targetProfile?.profile_visibility === 'PRIVATE' && !isFriend) ||
          (targetProfile?.profile_visibility === 'FRIENDS_ONLY' && !isFriend)
        );

  // Content visibility (posts, photos)
  const canSeeContent = isOwnProfile || isFriend || targetProfile?.profile_visibility === 'PUBLIC';

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
        country: myProfile.country || "",
        language: myProfile.language || "",
        interests: myProfile.interests || "",
        gender: myProfile.gender || "",
        favorite_movies: myProfile.favorite_movies || "",
        favorite_games: myProfile.favorite_games || "",
      });
      setLoading(false);

      // Auth/profile boot response might not include `pinned_track` relation.
      // If user has a pinned track, fetch again to render it.
      if (myProfile.pinned_track_id && !myProfile.pinned_track) {
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
              {targetProfile?.country && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {targetProfile.country}
                </span>
              )}
              {targetProfile?.language && (
                <span>{t("profile.language")}: {targetProfile.language}</span>
              )}
              {targetProfile?.gender && (
                <span>{t("profile.gender")}: {targetProfile.gender}</span>
              )}
            </div>

            {targetProfile?.interests && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("profile.interests")}: {targetProfile.interests}
              </p>
            )}
            {(targetProfile?.favorite_movies || targetProfile?.favorite_games) && (
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                {targetProfile?.favorite_movies && (
                  <p>{t("profile.movies")}: {targetProfile.favorite_movies}</p>
                )}
                {targetProfile?.favorite_games && (
                  <p>{t("profile.games")}: {targetProfile.favorite_games}</p>
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
            <h3 className="text-lg font-bold mb-4">{t("profile.edit")}</h3>

            <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{t("music.cover")}</p>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.firstName")}</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.lastName")}</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.status")}</label>
                <textarea
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.city")}</label>
                  <select
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background appearance-none"
                  >
                    <option value="">{t("profile.notSpecified")}</option>
                    <option value="Москва">Москва</option>
                    <option value="Санкт-Петербург">Санкт-Петербург</option>
                    <option value="Новосибирск">Новосибирск</option>
                    <option value="Екатеринбург">Екатеринбург</option>
                    <option value="Казань">Казань</option>
                    <option value="Нижний Новгород">Нижний Новгород</option>
                    <option value="Челябинск">Челябинск</option>
                    <option value="Самара">Самара</option>
                    <option value="Омск">Омск</option>
                    <option value="Ростов-на-Дону">Ростов-на-Дону</option>
                    <option value="Уфа">Уфа</option>
                    <option value="Красноярск">Красноярск</option>
                    <option value="Воронеж">Воронеж</option>
                    <option value="Пермь">Пермь</option>
                    <option value="Волгоград">Волгоград</option>
                    <option value="Краснодар">Краснодар</option>
                    <option value="Саратов">Саратов</option>
                    <option value="Тюмень">Тюмень</option>
                    <option value="Тольятти">Тольятти</option>
                    <option value="Ижевск">Ижевск</option>
                    <option value="Барнаул">Барнаул</option>
                    <option value="Ульяновск">Ульяновск</option>
                    <option value="Иркутск">Иркутск</option>
                    <option value="Хабаровск">Хабаровск</option>
                    <option value="Махачкала">Махачкала</option>
                    <option value="Владивосток">Владивосток</option>
                    <option value="Грозный">Грозный</option>
                    <option value="Другой">Другой</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.country")}</label>
                  <select
                    value={editForm.country}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background appearance-none"
                  >
                    <option value="">{t("profile.notSpecified")}</option>
                    <option value="Россия">Россия</option>
                    <option value="Беларусь">Беларусь</option>
                    <option value="Казахстан">Казахстан</option>
                    <option value="Армения">Армения</option>
                    <option value="Грузия">Грузия</option>
                    <option value="Узбекистан">Узбекистан</option>
                    <option value="Азербайджан">Азербайджан</option>
                    <option value="Кыргызстан">Кыргызстан</option>
                    <option value="Таджикистан">Таджикистан</option>
                    <option value="Турция">Турция</option>
                    <option value="Германия">Германия</option>
                    <option value="США">США</option>
                    <option value="ОАЭ">ОАЭ</option>
                    <option value="Другая">Другая</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.language")}</label>
                  <select
                    value={editForm.language}
                    onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background appearance-none"
                  >
                    <option value="">{t("profile.notSpecified")}</option>
                    <option value="Русский">Русский</option>
                    <option value="English">English</option>
                    <option value="Татарча">Татарча</option>
                    <option value="Нохчийн">Нохчийн</option>
                    <option value="Հայերեն">Հայերեն</option>
                    <option value="Türkçe">Türkçe</option>
                    <option value="Deutsch">Deutsch</option>
                    <option value="Français">Français</option>
                    <option value="Español">Español</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.gender")}</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background appearance-none"
                  >
                    <option value="">{t("profile.notSpecified")}</option>
                    <option value="Мужской">Мужской</option>
                    <option value="Женский">Женский</option>
                    <option value="Другой">Другой</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.interests")}</label>
                <textarea
                  value={editForm.interests}
                  onChange={(e) => setEditForm({ ...editForm, interests: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[60px]"
                  placeholder="Через запятую или свободным текстом"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.movies")}</label>
                <textarea
                  value={editForm.favorite_movies}
                  onChange={(e) => setEditForm({ ...editForm, favorite_movies: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-background resize-none min-h-[50px]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("profile.games")}</label>
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
                {t("profile.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 glass rounded-2xl border border-border/40 w-fit mb-6">
        <button
          onClick={() => setActiveTab("posts")}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === "posts" ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          Посты ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab("photos")}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === "photos" ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          Фото
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : !canSeeContent ? (
        <div className="text-center py-16 text-muted-foreground text-sm glass rounded-3xl px-4 border border-border/40 shadow-xl">
          <Clock className="w-10 h-10 mx-auto mb-4 opacity-20" />
          {t("profile.limited.message")}
        </div>
      ) : (
        <div className="pb-20">
          {activeTab === "posts" && posts.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm glass rounded-3xl border border-border/40">
              {isOwnProfile ? "У вас пока нет постов. Создайте первый в ленте!" : "У пользователя пока нет постов."}
            </div>
          )}
          
          {activeTab === "posts" && posts.length > 0 && (
            <div className="space-y-4">
              {posts.map(post => (
                <div 
                  key={post.id} 
                  className="glass rounded-3xl overflow-hidden border border-border/40 shadow-xl shadow-black/5 hover:shadow-black/10 transition-all cursor-pointer group/post"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  {/* Post Header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-subtle flex items-center justify-center overflow-hidden border border-white/10">
                        {targetProfile?.avatar_url ? (
                          <img src={targetProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-sm font-bold text-gradient">{targetProfile?.first_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{targetProfile?.first_name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button className="p-2 rounded-xl hover:bg-accent text-muted-foreground opacity-0 group-hover/post:opacity-100 transition-all">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Post Content */}
                  <div className="px-4 pb-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">{post.content_text}</p>
                  </div>

                  {/* Post Media */}
                  {post.media_url && (
                    <div className="px-2 pb-2">
                      <div className="relative rounded-2xl overflow-hidden bg-accent/50 aspect-video group/media">
                        <BlurImage
                          src={post.media_url}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105"
                          alt=""
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="w-8 h-8 text-white scale-90 group-hover/media:scale-100 transition-transform" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="p-3 flex items-center justify-between border-t border-border/5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(post.id, post.liked_by_me);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs ${
                          post.liked_by_me ? 'bg-red-500/10 text-red-500' : 'hover:bg-accent text-muted-foreground'
                        }`}
                      >
                        <Heart className={`w-4 h-4 transition-transform ${post.liked_by_me ? 'fill-current scale-110' : 'group-hover:scale-110'}`} />
                        <span>{post.likes_count > 0 && post.likes_count}</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/post/${post.id}`);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-accent text-muted-foreground transition-all font-bold text-xs group/btn"
                      >
                        <MessageCircle className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        <span>{post.comments_count > 0 && post.comments_count}</span>
                      </button>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // share logic
                      }}
                      className="p-2.5 rounded-xl hover:bg-accent text-muted-foreground transition-all"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "photos" && posts.filter((p: any) => p.media_url).length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm glass rounded-3xl border border-border/40">
              Фотографий в постах пока нет.
            </div>
          )}
          
          {activeTab === "photos" && posts.filter((p: any) => p.media_url).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {posts
                .filter((p: any) => p.media_url)
                .map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightboxUrl(p.media_url)}
                    className="aspect-square rounded-3xl overflow-hidden glass border border-border/40 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all group/photo"
                  >
                    <BlurImage
                      src={p.media_url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-110"
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
