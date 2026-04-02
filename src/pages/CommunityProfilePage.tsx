import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Megaphone, Users, Settings, LogOut, Image as ImageIcon, Send, Loader2, Heart, MessageCircle, Share2, X, Maximize2, Link2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getPostShareUrl } from "@/lib/postShare";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн`;
}

export default function CommunityProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [newPost, setNewPost] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [likesList, setLikesList] = useState<any[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [sharePost, setSharePost] = useState<any | null>(null);
  const [friendsForShare, setFriendsForShare] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!membersOpen || !id) return;
    setMembersLoading(true);
    api
      .get(`/communities/${id}/members`)
      .then(({ data }) => setMembers(data || []))
      .catch(() => {
        toast.error("Не удалось загрузить участников");
        setMembers([]);
      })
      .finally(() => setMembersLoading(false));
  }, [membersOpen, id]);

  const fetchData = async () => {
    try {
      const [commRes, postsRes] = await Promise.all([
        api.get(`/communities/${id}`),
        api.get(`/communities/${id}/posts`)
      ]);
      setCommunity(commRes.data);
      setPosts(postsRes.data);
    } catch (error) {
      toast.error("Ошибка при загрузке сообщества");
      navigate("/communities");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      await api.post(`/communities/${id}/join`);
      toast.success("Вы вступили в сообщество");
      fetchData();
    } catch (error) {
      toast.error("Ошибка при вступлении");
    }
  };

  const handleLeave = async () => {
    try {
      await api.post(`/communities/${id}/leave`);
      toast.success("Вы покинули сообщество");
      fetchData();
    } catch (error) {
      toast.error("Ошибка при выходе");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handleCreatePost = async () => {
    if ((!newPost.trim() && !selectedImage) || !user || !id) return;
    setPosting(true);
    try {
      let media_url = null;
      if (selectedImage) {
        const reader = new FileReader();
        media_url = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target?.result);
          reader.readAsDataURL(selectedImage);
        });
      }

      await api.post("/posts", {
        content_text: newPost.trim(),
        media_url,
        media_type: selectedImage ? "IMAGE" : "NONE",
        author_type: "COMMUNITY",
        community_id: id
      });

      setNewPost("");
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchData();
      toast.success("Пост опубликован!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Ошибка при создании поста");
    } finally {
      setPosting(false);
    }
  };

  const toggleLikePost = async (postId: string) => {
    try {
      await api.post(`/posts/${postId}/like`);
      await fetchData();
    } catch {
      toast.error("Не удалось выполнить действие");
    }
  };

  const openLikesList = async (postId: string) => {
    setLikesPostId(postId);
    setLikesLoading(true);
    try {
      const { data } = await api.get(`/posts/${postId}/likes`);
      setLikesList(data || []);
    } catch {
      setLikesList([]);
    } finally {
      setLikesLoading(false);
    }
  };

  const openShare = (post: any) => {
    setSharePost(post);
    api
      .get("/friends")
      .then((r) => setFriendsForShare((r.data || []).filter((f: any) => f.status === "ACCEPTED")))
      .catch(() => setFriendsForShare([]));
  };

  const copyPostLink = async () => {
    if (!sharePost) return;
    try {
      await navigator.clipboard.writeText(getPostShareUrl(sharePost.id));
      toast.success("Ссылка на пост скопирована");
      setSharePost(null);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const deleteCommunityPost = async (postId: string) => {
    if (!confirm("Удалить этот пост?")) return;
    try {
      await api.delete(`/posts/${postId}`);
      toast.success("Пост удалён");
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Не удалось удалить");
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  if (!community) return <AppLayout><div>Сообщество не найдено</div></AppLayout>;

  const isMember = !!community.role;
  const myRole = community.role;
  const canPost =
    myRole === "OWNER" ||
    myRole === "ADMIN" ||
    myRole === "MODERATOR" ||
    (community.type === "GROUP" && isMember);
  const isAdminSettings = myRole === "OWNER" || myRole === "ADMIN";
  const canModerate = myRole === "OWNER" || myRole === "ADMIN" || myRole === "MODERATOR";

  return (
    <AppLayout>
      <div className="relative mb-8 rounded-3xl overflow-hidden glass-subtle">
        {/* Cover */}
        <div className="h-48 w-full bg-gradient-subtle relative">
          {community.cover_url && <img src={community.cover_url} alt="" className="w-full h-full object-cover" />}
        </div>
        
        {/* Info */}
        <div className="px-6 pb-6 pt-16 relative">
          <div className="absolute -top-12 left-6 w-24 h-24 rounded-full border-4 border-background bg-background overflow-hidden flex items-center justify-center">
            {community.avatar_url ? (
              <img src={community.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-subtle flex items-center justify-center text-primary">
                {community.type === 'CHANNEL' ? <Megaphone className="w-10 h-10" /> : <Users className="w-10 h-10" />}
              </div>
            )}
          </div>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                {community.name}
                {community.type === 'CHANNEL' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Канал</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 uppercase tracking-wider">Группа</span>
                )}
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">{community.description}</p>
              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                className="text-xs text-muted-foreground/70 mt-2 hover:text-primary text-left underline-offset-2 hover:underline"
              >
                {community._count?.members || 0} участников — смотреть список
              </button>
            </div>
            <div className="flex gap-2">
              {isAdminSettings && (
                <button onClick={() => navigate(`/communities/${id}/settings`)} className="p-2 rounded-xl glass hover:text-primary transition-colors">
                  <Settings className="w-5 h-5" />
                </button>
              )}
              {isMember ? (
                <button onClick={handleLeave} className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium">
                  <LogOut className="w-4 h-4" />
                  Выйти
                </button>
              ) : (
                <button onClick={handleJoin} className="px-6 py-2 rounded-xl btn-gradient text-sm font-bold">
                  Вступить
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div>
        <h3 className="text-xl font-bold mb-4">Публикации</h3>
        {canPost && (
          <div className="glass rounded-3xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm shrink-0 overflow-hidden">
                {community.avatar_url ? (
                  <img src={community.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  community.name?.charAt(0) || "?"
                )}
              </div>
              <div className="flex-1">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={`Написать от имени ${community.name}...`}
                  className="w-full bg-transparent text-foreground text-sm resize-none focus:outline-none placeholder:text-muted-foreground min-h-[60px]"
                />
                {selectedImage && (
                  <div className="relative inline-block mt-2">
                    <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="h-20 rounded-xl object-cover" />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                      title="Прикрепить изображение"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <button
                    onClick={handleCreatePost}
                    disabled={(!newPost.trim() && !selectedImage) || posting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl btn-gradient text-xs"
                  >
                    {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Опубликовать
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {posts.length > 0 ? (
            posts.map(post => (
              <div key={post.id} className="glass rounded-3xl p-5 transition-all hover:shadow-lg relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm overflow-hidden">
                    {community.avatar_url ? (
                      <img src={community.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      community.name?.charAt(0) || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{community.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {community.type === 'CHANNEL' ? 'Канал' : 'Группа'} · {timeAgo(post.created_at)}
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">{post.content_text}</p>

                {post.media_url && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="relative group cursor-zoom-in mb-4 rounded-2xl overflow-hidden">
                        <img
                          src={post.media_url}
                          alt=""
                          className="w-full h-auto max-h-[500px] object-contain bg-black/5"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-none w-screen h-screen p-0 m-0 overflow-hidden border-none bg-black/90 shadow-none flex items-center justify-center z-[100]">
                      <DialogTitle className="sr-only">Просмотр изображения</DialogTitle>
                      <DialogDescription className="sr-only">Полноэкранный просмотр прикрепленного изображения к посту</DialogDescription>
                      <DialogTrigger asChild>
                        <img src={post.media_url} alt="" className="max-w-full max-h-full object-contain cursor-zoom-out" />
                      </DialogTrigger>
                      <button className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
                        <X className="w-6 h-6" />
                      </button>
                    </DialogContent>
                  </Dialog>
                )}

                <div className="flex items-center gap-6 pt-3 border-t border-border/30 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleLikePost(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
                        post.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.liked_by_me ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openLikesList(post.id)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground tabular-nums"
                    >
                      {post.likes_count || 0}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/feed")}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all"
                    title="Комментарии в общей ленте"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {post.comments_count || 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => openShare(post)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  {canModerate && (
                    <button
                      type="button"
                      onClick={() => deleteCommunityPost(post.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-10 glass-subtle rounded-2xl">Нет публикаций</p>
          )}
        </div>
      </div>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-md rounded-3xl max-h-[70vh] overflow-hidden flex flex-col">
          <DialogTitle>Участники</DialogTitle>
          <DialogDescription>Нажмите на пользователя, чтобы открыть профиль</DialogDescription>
          <div className="overflow-y-auto flex-1 min-h-0 -mx-2 px-2">
            {membersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Нет участников</p>
            ) : (
              members.map((m: any) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    navigate(`/profile/${m.user_id}`);
                    setMembersOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 text-left"
                >
                  {m.user?.profile?.avatar_url ? (
                    <img src={m.user.profile.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded-xl bg-gradient-subtle flex items-center justify-center text-sm font-bold">
                      {m.user?.profile?.first_name?.charAt(0) || "?"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.user?.profile?.first_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{m.user?.profile?.username} · {m.role}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!likesPostId} onOpenChange={(o) => !o && setLikesPostId(null)}>
        <DialogContent className="max-w-md rounded-3xl max-h-[70vh] overflow-hidden flex flex-col">
          <DialogTitle>Лайкнули</DialogTitle>
          <div className="overflow-y-auto flex-1 min-h-0 -mx-2 px-2">
            {likesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : likesList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Пока нет лайков</p>
            ) : (
              likesList.map((like: any) => (
                <button
                  key={like.user_id}
                  type="button"
                  onClick={() => {
                    navigate(`/profile/${like.user_id}`);
                    setLikesPostId(null);
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 text-left"
                >
                  {like.user?.profile?.avatar_url ? (
                    <img src={like.user.profile.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded-xl bg-gradient-subtle flex items-center justify-center text-sm font-bold">
                      {like.user?.profile?.first_name?.charAt(0) || "?"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{like.user?.profile?.first_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{like.user?.profile?.username}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sharePost} onOpenChange={(o) => !o && setSharePost(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Поделиться постом</DialogTitle>
          <DialogDescription>Ссылка ведёт на страницу поста</DialogDescription>
          <button
            type="button"
            onClick={copyPostLink}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl glass text-sm font-medium hover:bg-white/5 mt-2"
          >
            <Link2 className="w-4 h-4" />
            Скопировать ссылку
          </button>
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Отправить в личку</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {friendsForShare.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Нет друзей</p>
              ) : (
                friendsForShare.map((f: any) => (
                  <button
                    key={f.friend_id}
                    type="button"
                    onClick={() => {
                      navigate(`/messages?userId=${f.friend_id}&forwardPost=${sharePost?.id}`);
                      setSharePost(null);
                      toast.success("Откройте чат — пост отправится");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm hover:bg-white/5"
                  >
                    {f.friend_profile?.avatar_url ? (
                      <img src={f.friend_profile.avatar_url} alt="" className="w-8 h-8 rounded-xl object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-xl bg-gradient-subtle flex items-center justify-center text-xs font-bold">
                        {f.friend_profile?.first_name?.charAt(0) || "?"}
                      </span>
                    )}
                    <span className="truncate">
                      {f.friend_profile?.first_name} · @{f.friend_profile?.username}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
