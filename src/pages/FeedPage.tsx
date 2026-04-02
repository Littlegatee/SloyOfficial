import { useState, useEffect, useRef, useMemo } from "react";
import { Heart, MessageCircle, Share2, Image as ImageIcon, Send, Loader2, Edit2, Trash2, X, MoreVertical, Maximize2, Link2, Users } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import {
  enforceLocalStorageBudget,
  runLocalStorageCacheMaintenance,
  stripFeedPostsForCache,
} from "@/lib/localStorageCache";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content_text: string;
  likes_count: number;
  created_at: string;
  parent_id?: string | null;
  user: {
    profile: {
      username: string;
      first_name: string;
      avatar_url: string | null;
    };
  };
  liked_by_me?: boolean;
}

interface PostWithAuthor {
  id: string;
  user_id: string;
  content_text: string;
  media_url: string | null;
  media_type: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user: {
    profile: {
      username: string;
      first_name: string;
      avatar_url: string | null;
      is_verified?: boolean;
    };
  };
  liked_by_me: boolean;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн`;
}

import { socket } from "@/lib/socket";
import { getPostShareUrl } from "@/lib/postShare";
import VerifiedBadge from "@/components/VerifiedBadge";
import BlurImage from "@/components/BlurImage";

import { useNavigate } from "react-router-dom";

export default function FeedPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  // ... rest of the code stays the same, just showing context for socket usage
  
  useEffect(() => {
    if (user) {
      socket.connect();
      socket.emit('join', user.id);
      
      socket.on('new_post', (post: any) => {
        setPosts(prev => {
          if (prev.some((p) => p.id === post.id)) return prev;
          const row = {
            ...post,
            liked_by_me: post.liked_by_me ?? false,
          };
          return [row, ...prev];
        });
        const authorName =
          post?.author_type === 'COMMUNITY'
            ? (post?.community?.name || 'сообщества')
            : (post?.user?.profile?.first_name || 'пользователя');
        toast.info(`Новый пост от ${authorName}`);
      });

      socket.on('post_liked', ({ postId, likesCount, userId }: any) => {
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, likes_count: likesCount, liked_by_me: userId === user.id ? p.liked_by_me : p.liked_by_me } 
            : p
        ));
      });

      return () => {
        socket.off('new_post');
        socket.off('post_liked');
      };
    }
  }, [user]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string, username: string } | null>(null);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [recommendationType, setRecommendationType] = useState<'main' | 'friends'>('main');
  const [myCommunities, setMyCommunities] = useState<any[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<{ type: 'USER' | 'COMMUNITY', id: string | null }>({ type: 'USER', id: null });

  const [sharePost, setSharePost] = useState<PostWithAuthor | null>(null);
  const [friendsForShare, setFriendsForShare] = useState<Array<{ friend_id: string; friend_profile: any }>>([]);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [likesList, setLikesList] = useState<Array<{ user_id: string; user: { profile: { first_name: string; username: string; avatar_url: string | null } } }>>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [isLiteMode, setIsLiteMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("feed_lite_mode");
    if (stored === "1") return true;
    if (stored === "0") return false;
    const connection = (navigator as any).connection;
    if (connection?.saveData) return true;
    const type = String(connection?.effectiveType || "").toLowerCase();
    return type.includes("2g") || type === "slow-2g";
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const feedCacheKey = useMemo(
    () => (user?.id ? `feed_cache:${user.id}:${recommendationType}` : null),
    [user?.id, recommendationType]
  );

  const fetchPosts = async () => {
    try {
      const { data } = await api.get(`/posts?recommendation_type=${recommendationType}&lite_mode=${isLiteMode ? "1" : "0"}`);
      if (data && user) {
        const prepared = data.map((p: any) => ({
            ...p,
            liked_by_me:
              typeof p.liked_by_me === "boolean"
                ? p.liked_by_me
                : p.likes?.some?.((l: any) => l.user_id === user.id) ?? false,
          }));
        setPosts(prepared);
        if (feedCacheKey) {
          try {
            runLocalStorageCacheMaintenance();
            enforceLocalStorageBudget();
            const slim = stripFeedPostsForCache(prepared);
            localStorage.setItem(feedCacheKey, JSON.stringify({ ts: Date.now(), posts: slim }));
          } catch (e) {
            console.error("Cache write failed:", e);
            if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
              try {
                // Clear all feed caches if one fails, to make room
                const keys = Object.keys(localStorage);
                for (const key of keys) {
                  if (key.startsWith("feed_cache:")) localStorage.removeItem(key);
                }
                const slim = stripFeedPostsForCache(prepared);
                localStorage.setItem(feedCacheKey, JSON.stringify({ ts: Date.now(), posts: slim }));
              } catch (inner) {
                console.error("Critical cache failure:", inner);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      if (feedCacheKey) {
        try {
          const cached = localStorage.getItem(feedCacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed?.posts)) {
              setPosts(parsed.posts);
              toast.info("Показываем сохраненную ленту (сеть недоступна)");
            }
          }
        } catch {
          // ignore cache parse errors
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [user, recommendationType, isLiteMode]);

  useEffect(() => {
    localStorage.setItem("feed_lite_mode", isLiteMode ? "1" : "0");
  }, [isLiteMode]);

  useEffect(() => {
    const onLite = (e: Event) => {
      const ce = e as CustomEvent<{ enabled: boolean }>;
      if (typeof ce.detail?.enabled === "boolean") {
        setIsLiteMode(ce.detail.enabled);
      }
    };
    window.addEventListener("sloy:liteMode", onLite);
    return () => window.removeEventListener("sloy:liteMode", onLite);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    // Fetch communities for author selector
    api.get('/communities').then(res => {
      // Only show communities where user can post (Owner or Admin in channels, anyone in groups)
      const postable = res.data.filter((c: any) => c.type === 'GROUP' || c.role !== 'MEMBER');
      setMyCommunities(postable);
    }).catch(console.error);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 45 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 45 МБ)");
      e.target.value = "";
      return;
    }
    setSelectedImage(file);
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target?.result || ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

  const compressImageToDataUrl = (file: File, lite: boolean) =>
    new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas unavailable"));

        const maxDim = lite ? 1280 : 1920;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", lite ? 0.75 : 0.86));
      };
      img.onerror = () => reject(new Error("image decode failed"));
      fileToDataUrl(file).then((raw) => (img.src = raw)).catch(reject);
    });

  const handleCreatePost = async () => {
    if ((!newPost.trim() && !selectedImage) || !user) return;
    setPosting(true);
    try {
      let media_url = null;
      if (selectedImage) {
        if (selectedImage.type.startsWith("image/")) {
          media_url = await compressImageToDataUrl(selectedImage, isLiteMode);
        } else {
          media_url = await fileToDataUrl(selectedImage);
        }
      }

      const isVid = selectedImage?.type.startsWith("video/");
      await api.post("/posts", { 
        content_text: newPost.trim(),
        media_url,
        media_type: selectedImage ? (isVid ? "VIDEO" : "IMAGE") : "NONE",
        author_type: selectedAuthor.type,
        community_id: selectedAuthor.id
      });
      setNewPost("");
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchPosts();
      toast.success("Пост опубликован!");
    } catch (error) {
      toast.error("Ошибка при создании поста");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;
    try {
      await api.post(`/posts/${postId}/like`);
      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, liked_by_me: !liked, likes_count: liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      ));
    } catch (error) {
      toast.error("Ошибка при выполнении действия");
    }
  };

  const toggleCommentLike = async (postId: string, commentId: string, liked: boolean) => {
    if (!user) return;
    try {
      await api.post(`/posts/comments/${commentId}/like`);
      setComments(prev => ({
        ...prev,
        [postId]: prev[postId]?.map(c => 
          c.id === commentId 
            ? { ...c, liked_by_me: !liked, likes_count: liked ? c.likes_count - 1 : c.likes_count + 1 }
            : c
        ) || []
      }));
    } catch (error) {
      toast.error("Ошибка при лайке комментария");
    }
  };

  const openShare = (post: PostWithAuthor) => {
    setSharePost(post);
    api
      .get("/friends")
      .then((res) => {
        const accepted = (res.data || []).filter((f: any) => f.status === "ACCEPTED");
        setFriendsForShare(accepted);
      })
      .catch(() => setFriendsForShare([]));
  };

  const copyPostLink = async () => {
    if (!sharePost) return;
    const url = getPostShareUrl(sharePost.id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка на пост скопирована");
      setSharePost(null);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const sharePostNatively = async () => {
    if (!sharePost) return;
    const url = getPostShareUrl(sharePost.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Sloy",
          text: "Посмотри этот пост",
          url,
        });
        setSharePost(null);
        return;
      } catch {
        // ignore and fallback to copy
      }
    }
    await copyPostLink();
  };

  const sendPostToFriend = (friendId: string) => {
    if (!sharePost) return;
    navigate(`/messages?userId=${friendId}&forwardPost=${sharePost.id}`);
    setSharePost(null);
    toast.success("Откройте чат — пост отправится");
  };

  const openLikesList = async (postId: string) => {
    setLikesPostId(postId);
    setLikesLoading(true);
    try {
      const { data } = await api.get(`/posts/${postId}/likes`);
      setLikesList(data || []);
    } catch {
      toast.error("Не удалось загрузить список");
      setLikesList([]);
    } finally {
      setLikesLoading(false);
    }
  };

  const toggleComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      if (!comments[postId]) {
        try {
          const { data } = await api.get(`/posts/${postId}/comments`);
          if (data && user) {
            setComments(prev => ({ 
              ...prev, 
              [postId]: data.map((c: any) => ({
                ...c,
                liked_by_me: c.likes?.some((l: any) => l.user_id === user.id) || false
              }))
            }));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleCreateComment = async (postId: string) => {
    if (!newComment.trim()) return;
    try {
      const { data } = await api.post(`/posts/${postId}/comments`, { 
        content_text: newComment.trim(),
        parent_id: replyTo?.id || null
      });
      
      const formattedComment = {
        ...data,
        liked_by_me: false
      };

      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), formattedComment]
      }));
      setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
      setNewComment("");
      setReplyTo(null);
    } catch (error) {
      toast.error("Ошибка при отправке комментария");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Вы уверены, что хотите удалить пост?")) return;
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(posts.filter(p => p.id !== postId));
      toast.success("Пост удален");
    } catch (error) {
      toast.error("Ошибка при удалении поста");
    }
  };

  const startEditPost = (post: PostWithAuthor) => {
    setEditingPostId(post.id);
    setEditContent(post.content_text);
    setActiveMenuId(null);
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editContent.trim()) return;
    try {
      await api.put(`/posts/${postId}`, { content_text: editContent.trim() });
      setPosts(posts.map(p => p.id === postId ? { ...p, content_text: editContent.trim() } : p));
      setEditingPostId(null);
      toast.success("Пост обновлен");
    } catch (error) {
      toast.error("Ошибка при обновлении поста");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Create Post Card */}
        <div className="glass rounded-3xl p-5 border border-border/40 shadow-xl shadow-black/5">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-subtle flex items-center justify-center shrink-0 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
              ) : (
                <span className="text-xl font-bold text-gradient">{profile?.first_name?.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Что нового?"
                className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-muted-foreground resize-none min-h-[100px]"
              />
              
              {selectedImage && (
                <div className="relative rounded-2xl overflow-hidden border border-border/50 group">
                  <img
                    src={URL.createObjectURL(selectedImage)}
                    className="w-full max-h-[400px] object-cover"
                    alt="Preview"
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border/10">
                <div className="flex gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
                    title="Прикрепить фото/видео"
                  >
                    <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="p-3 rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group">
                        <Users className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="glass-strong border-border/40 rounded-3xl">
                      <DialogTitle className="text-xl font-bold">Опубликовать от имени</DialogTitle>
                      <DialogDescription className="text-muted-foreground mt-2">Выберите автора поста</DialogDescription>
                      <div className="space-y-2 mt-4">
                        <button
                          onClick={() => {
                            setSelectedAuthor({ type: 'USER', id: null });
                            // close dialog logic usually handled by UI
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                            selectedAuthor.type === 'USER' ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-accent'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold">Я</div>
                          <span className="font-medium">Личный профиль</span>
                        </button>
                        {myCommunities.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedAuthor({ type: 'COMMUNITY', id: c.id })}
                            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                              selectedAuthor.id === c.id ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-accent'
                            }`}
                          >
                            {c.avatar_url ? (
                              <img src={c.avatar_url} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center font-bold">C</div>
                            )}
                            <span className="font-medium">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <button
                  disabled={posting || (!newPost.trim() && !selectedImage)}
                  onClick={handleCreatePost}
                  className="btn-gradient px-8 py-3 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
                >
                  {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  <span>Опубликовать</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Feed Filter */}
        <div className="flex items-center gap-2 p-1.5 glass rounded-2xl border border-border/40 w-fit">
          <button
            onClick={() => setRecommendationType('main')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              recommendationType === 'main' ? 'bg-white/10 dark:bg-white/5 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Для вас
          </button>
          <button
            onClick={() => setRecommendationType('friends')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              recommendationType === 'friends' ? 'bg-white/10 dark:bg-white/5 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Друзья
          </button>
        </div>

        {/* Posts List */}
        <div className="space-y-6 pb-20">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="glass rounded-3xl p-6 h-96 animate-pulse" />
            ))
          ) : posts.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto">
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Лента пока пуста. Подпишитесь на кого-нибудь!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="glass rounded-3xl overflow-hidden border border-border/40 shadow-xl shadow-black/5 feed-card-entrance group">
                {/* Post Header */}
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(post.user_id === user?.id ? "/profile" : `/u/${post.user.profile.username}`)}>
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-subtle flex items-center justify-center overflow-hidden border border-white/10 shadow-lg">
                        {post.user.profile.avatar_url ? (
                          <img src={post.user.profile.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-lg font-bold text-gradient">{post.user.profile.first_name.charAt(0)}</span>
                        )}
                      </div>
                      {post.user.profile.is_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-black rounded-full p-0.5 shadow-sm">
                          <VerifiedBadge className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm hover:text-primary transition-colors">{post.user.profile.first_name}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{timeAgo(post.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                      className="p-2 rounded-xl hover:bg-accent text-muted-foreground transition-all"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {activeMenuId === post.id && (
                      <div className="absolute right-0 mt-2 w-48 glass-strong rounded-2xl border border-border/40 shadow-2xl z-20 py-1.5 animate-in fade-in zoom-in duration-200">
                        {post.user_id === user?.id ? (
                          <>
                            <button className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-3">
                              <Edit2 className="w-4 h-4" /> Изменить
                            </button>
                            <button className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-red-500/10 text-red-500 transition-colors flex items-center gap-3">
                              <Trash2 className="w-4 h-4" /> Удалить
                            </button>
                          </>
                        ) : (
                          <button className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-accent transition-colors flex items-center gap-3">
                            <X className="w-4 h-4" /> Скрыть пост
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-5 pb-4">
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{post.content_text}</p>
                </div>

                {/* Post Media */}
                {post.media_url && (
                  <div className="px-2 pb-2">
                    <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-accent/50 aspect-video group/media">
                      <BlurImage
                        src={post.media_url}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105"
                        alt=""
                      />
                      <button className="absolute top-4 right-4 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover/media:opacity-100 transition-all scale-90 group-hover/media:scale-100">
                        <Maximize2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Post Actions */}
                <div className="p-4 flex items-center justify-between border-t border-border/5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleLike(post.id, post.liked_by_me)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all font-bold text-sm ${
                        post.liked_by_me ? 'bg-red-500/10 text-red-500' : 'hover:bg-accent text-muted-foreground'
                      }`}
                    >
                      <Heart className={`w-5 h-5 transition-transform ${post.liked_by_me ? 'fill-current scale-110' : 'group-hover:scale-110'}`} />
                      <span>{post.likes_count > 0 && post.likes_count}</span>
                    </button>
                    
                    <button
                      onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-2xl hover:bg-accent text-muted-foreground transition-all font-bold text-sm group/btn"
                    >
                      <MessageCircle className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                      <span>{post.comments_count > 0 && post.comments_count}</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      setSharePost(post);
                      // fetch friends logic
                    }}
                    className="p-3 rounded-2xl hover:bg-accent text-muted-foreground transition-all group/btn"
                  >
                    <Share2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                  </button>
                </div>

                {/* Comments Section (Optional: expanded) */}
                {expandedPostId === post.id && (
                  <div className="p-5 border-t border-border/5 bg-accent/5 animate-in slide-in-from-top-4 duration-300">
                    <div className="space-y-4 max-h-[400px] overflow-y-auto hide-scrollbar">
                      {/* Comments would go here */}
                      <p className="text-center text-xs text-muted-foreground py-4 font-medium uppercase tracking-widest">Комментарии</p>
                    </div>
                    
                    <div className="mt-4 flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-accent shrink-0 overflow-hidden">
                        {profile?.avatar_url && <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          placeholder="Написать комментарий..."
                          className="w-full glass rounded-2xl py-2 px-4 text-sm pr-10 border-none focus:ring-1 focus:ring-primary/30"
                        />
                        <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:scale-110 transition-transform">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}