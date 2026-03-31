import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Megaphone, Users, Settings, LogOut, Image as ImageIcon, Send, Loader2, Heart, MessageCircle, Share2, X, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

  useEffect(() => {
    fetchData();
  }, [id]);

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

  if (loading) return <AppLayout><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  if (!community) return <AppLayout><div>Сообщество не найдено</div></AppLayout>;

  const isMember = !!community.role;
  const myRole = community.role;
  const canPost = myRole === 'OWNER' || myRole === 'ADMIN' || (community.type === 'GROUP' && isMember);
  const isAdmin = myRole === 'OWNER' || myRole === 'ADMIN';

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
              <p className="text-xs text-muted-foreground/70 mt-2">{community._count?.members || 0} участников</p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
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

                <div className="flex items-center gap-6 pt-3 border-t border-border/30">
                  <button
                    onClick={() => navigate('/feed')}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all"
                    title="Лайки и комментарии доступны в общей ленте"
                  >
                    <Heart className="w-4 h-4" />
                    {post.likes_count || 0}
                  </button>
                  <button
                    onClick={() => navigate('/feed')}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all"
                    title="Лайки и комментарии доступны в общей ленте"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {post.comments_count || 0}
                  </button>
                  <button
                    onClick={async () => {
                      const shareText = `Пост от ${community.name}:\n${post.content_text}`;
                      try {
                        await navigator.clipboard.writeText(shareText);
                        toast.success("Текст поста скопирован");
                      } catch {
                        toast.error("Не удалось скопировать");
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-10 glass-subtle rounded-2xl">Нет публикаций</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
