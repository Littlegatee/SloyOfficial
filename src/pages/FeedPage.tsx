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
            if (e instanceof DOMException && e.name === "QuotaExceededError") {
              try {
                localStorage.removeItem(feedCacheKey);
                enforceLocalStorageBudget(1_000_000);
                const slim = stripFeedPostsForCache(prepared);
                localStorage.setItem(feedCacheKey, JSON.stringify({ ts: Date.now(), posts: slim }));
              } catch {
                /* ignore — offline cache is best-effort */
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Лента</h2>
        
        {/* Recommendation Toggle */}
        <div className="glass-subtle p-1 rounded-2xl flex text-[11px] font-medium overflow-x-auto hide-scrollbar max-w-full">
          <button 
            onClick={() => setRecommendationType('main')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${recommendationType === 'main' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Главная
          </button>
          <button 
            onClick={() => setRecommendationType('friends')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${recommendationType === 'friends' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Друзья
          </button>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className={`text-xs ${isOnline ? "text-muted-foreground" : "text-destructive"}`}>
          {isOnline ? "Онлайн" : "Оффлайн: показываем кеш и экономим трафик"}
        </span>
        <button
          type="button"
          onClick={() => setIsLiteMode((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-xl glass hover:bg-white/5"
        >
          {isLiteMode ? "Легкий режим: вкл" : "Легкий режим: выкл"}
        </button>
      </div>

      {/* Create Post */}
      <div className="glass rounded-3xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              profile?.first_name?.charAt(0) || "?"
            )}
          </div>
          <div className="flex-1">
            {myCommunities.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Автор:</span>
                <select 
                  value={`${selectedAuthor.type}:${selectedAuthor.id || ''}`}
                  onChange={(e) => {
                    const [type, id] = e.target.value.split(':');
                    setSelectedAuthor({ type: type as 'USER' | 'COMMUNITY', id: id || null });
                  }}
                  className="bg-transparent text-xs font-semibold text-primary focus:outline-none cursor-pointer p-1 rounded hover:bg-white/5 transition-colors"
                >
                  <option value="USER:" className="bg-background text-foreground">От своего имени</option>
                  {myCommunities.map(c => (
                    <option key={c.id} value={`COMMUNITY:${c.id}`} className="bg-background text-foreground">
                      {c.type === 'CHANNEL' ? '📢' : '👥'} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Что нового?"
              className="w-full bg-transparent text-foreground text-sm resize-none focus:outline-none placeholder:text-muted-foreground min-h-[60px]"
            />
            {selectedImage && (
              <div className="relative inline-block mt-2">
                {selectedImage.type.startsWith("video/") ? (
                  <video
                    src={URL.createObjectURL(selectedImage)}
                    className="max-h-40 rounded-xl bg-black/80"
                    controls
                    muted
                    preload="metadata"
                  />
                ) : (
                  <img src={URL.createObjectURL(selectedImage)} alt="Preview" loading="lazy" className="h-20 rounded-xl object-cover" />
                )}
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
                  accept="image/*,video/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                  title="Фото или видео"
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

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm glass rounded-3xl">
          Пока нет постов. Будьте первым!
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="glass rounded-3xl p-5 transition-all hover:shadow-lg relative">
              {post.user_id === user?.id && (
                <div className="absolute top-4 right-4">
                  <button 
                    onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl transition-all"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {activeMenuId === post.id && (
                    <div className="absolute right-0 mt-1 w-36 glass-subtle border border-border/50 rounded-xl shadow-lg overflow-hidden z-10">
                      <button 
                        onClick={() => startEditPost(post)}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 flex items-center gap-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Редактировать
                      </button>
                      <button 
                        onClick={() => handleDeletePost(post.id)}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 text-destructive flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Удалить
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div 
                className="flex items-center gap-3 mb-3 cursor-pointer"
                onClick={() => {
                  if ((post as any).author_type === 'COMMUNITY' && (post as any).community_id) {
                    navigate(`/communities/${(post as any).community_id}`);
                    return;
                  }
                  navigate(`/profile/${post.user_id}`);
                }}
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm overflow-hidden">
                  {(post as any).author_type === 'COMMUNITY' && (post as any).community ? (
                    (post as any).community.avatar_url ? (
                      <img src={(post as any).community.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (post as any).community.name.charAt(0)
                    )
                  ) : (
                    post.user.profile.avatar_url ? (
                      <img src={post.user.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      post.user.profile.first_name.charAt(0)
                    )
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    {(post as any).author_type === 'COMMUNITY' && (post as any).community 
                      ? (post as any).community.name 
                      : post.user.profile.first_name}
                    {(post as any).author_type !== 'COMMUNITY' && post.user.profile.is_verified && (
                      <VerifiedBadge className="w-4 h-4" />
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(post as any).author_type === 'COMMUNITY' 
                      ? 'Сообщество' 
                      : `@${post.user.profile.username}`} · {timeAgo(post.created_at)}
                  </p>
                </div>
              </div>

              {editingPostId === post.id ? (
                <div className="mb-4">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-background/50 text-foreground text-sm resize-none focus:outline-none placeholder:text-muted-foreground min-h-[60px] p-3 rounded-xl border border-border/50"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button 
                      onClick={() => setEditingPostId(null)}
                      className="px-4 py-1.5 rounded-xl text-xs glass text-muted-foreground"
                    >
                      Отмена
                    </button>
                    <button 
                      onClick={() => handleSaveEdit(post.id)}
                      className="px-4 py-1.5 rounded-xl text-xs btn-gradient"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">{post.content_text}</p>
              )}

              {post.media_url && (
                post.media_type === "VIDEO" ? (
                  <div className="mb-4 rounded-2xl overflow-hidden bg-black/80">
                    <video
                      src={post.media_url}
                      controls
                      playsInline
                      preload={isLiteMode ? "metadata" : "auto"}
                      className="w-full max-h-[min(70vh,500px)] object-contain"
                    />
                  </div>
                ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="relative group cursor-zoom-in mb-4 rounded-2xl overflow-hidden bg-black/5">
                      <BlurImage
                        src={post.media_url}
                        alt=""
                        className="w-full max-h-[500px]"
                        objectFit="contain"
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
                      <img src={post.media_url} alt="" loading="lazy" className="max-w-full max-h-full object-contain cursor-zoom-out" />
                    </DialogTrigger>
                    <button className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </DialogContent>
                </Dialog>
                )
              )}

              <div className="flex items-center gap-6 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id, post.liked_by_me)}
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
                  onClick={() => toggleComments(post.id)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
                    expandedPostId === post.id ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <MessageCircle className={`w-4 h-4 ${expandedPostId === post.id ? "fill-current" : ""}`} />
                  {post.comments_count || 0}
                </button>
                <button 
                  type="button"
                  onClick={() => openShare(post)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              {/* Comments Section */}
              {expandedPostId === post.id && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-2">
                    {comments[post.id] ? (
                      comments[post.id].length > 0 ? (
                        comments[post.id]
                          .filter(c => !c.parent_id) // Show only root comments
                          .map(comment => (
                          <div key={comment.id} className="space-y-3">
                            <div className="flex gap-2">
                              <div 
                                className="w-8 h-8 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-xs shrink-0 mt-0.5 overflow-hidden cursor-pointer"
                                onClick={() => navigate(`/profile/${comment.user_id}`)}
                              >
                                {comment.user.profile.avatar_url ? (
                                  <img src={comment.user.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  comment.user.profile.first_name.charAt(0)
                                )}
                              </div>
                              <div className="flex-1 bg-background/40 rounded-2xl rounded-tl-none p-3 group/comment relative">
                                <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={() => navigate(`/profile/${comment.user_id}`)}>
                                  <span className="text-xs font-semibold">{comment.user.profile.first_name}</span>
                                  <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
                                </div>
                                <p className="text-xs">{comment.content_text}</p>
                                
                                <div className="flex items-center gap-3 mt-2">
                                  <button 
                                    onClick={() => toggleCommentLike(post.id, comment.id, !!comment.liked_by_me)}
                                    className={`flex items-center gap-1 text-[10px] transition-all ${
                                      comment.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                                    }`}
                                  >
                                    <Heart className={`w-3 h-3 ${comment.liked_by_me ? "fill-current" : ""}`} />
                                    {comment.likes_count || 0}
                                  </button>
                                  <button 
                                    onClick={() => setReplyTo({ id: comment.id, username: comment.user.profile.username })}
                                    className="text-[10px] text-muted-foreground hover:text-primary transition-all"
                                  >
                                    Ответить
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Replies (Nested) */}
                            <div className="ml-10 space-y-3">
                              {comments[post.id]
                                .filter(reply => reply.parent_id === comment.id)
                                .map(reply => (
                                  <div key={reply.id} className="flex gap-2">
                                    <div 
                                      className="w-6 h-6 rounded-xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-[10px] shrink-0 mt-0.5 overflow-hidden cursor-pointer"
                                      onClick={() => navigate(`/profile/${reply.user_id}`)}
                                    >
                                      {reply.user.profile.avatar_url ? (
                                        <img src={reply.user.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        reply.user.profile.first_name.charAt(0)
                                      )}
                                    </div>
                                    <div className="flex-1 bg-background/20 rounded-2xl rounded-tl-none p-3 group/comment relative">
                                      <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={() => navigate(`/profile/${reply.user_id}`)}>
                                        <span className="text-[11px] font-semibold">{reply.user.profile.first_name}</span>
                                        <span className="text-[9px] text-muted-foreground">{timeAgo(reply.created_at)}</span>
                                      </div>
                                      <p className="text-[11px]">{reply.content_text}</p>
                                      
                                      <div className="flex items-center gap-3 mt-2">
                                        <button 
                                          onClick={() => toggleCommentLike(post.id, reply.id, !!reply.liked_by_me)}
                                          className={`flex items-center gap-1 text-[9px] transition-all ${
                                            reply.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                                          }`}
                                        >
                                          <Heart className={`w-2.5 h-2.5 ${reply.liked_by_me ? "fill-current" : ""}`} />
                                          {reply.likes_count || 0}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-center text-muted-foreground py-2">Нет комментариев. Напишите первый!</p>
                      )
                    ) : (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  {replyTo && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 rounded-t-xl border-x border-t border-border/50">
                      <span className="text-[10px] text-muted-foreground">Ответ пользователю <span className="text-primary font-medium">@{replyTo.username}</span></span>
                      <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-black/5 rounded-full transition-all">
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateComment(post.id)}
                      placeholder={replyTo ? "Написать ответ..." : "Написать комментарий..."}
                      className={`flex-1 bg-background/50 px-4 py-2 text-xs focus:outline-none border border-border/50 focus:border-primary/50 ${replyTo ? 'rounded-b-xl border-t-0' : 'rounded-xl'}`}
                    />
                    <button 
                      onClick={() => handleCreateComment(post.id)}
                      disabled={!newComment.trim()}
                      className="p-2 rounded-xl btn-gradient disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!sharePost} onOpenChange={(open) => !open && setSharePost(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Поделиться постом</DialogTitle>
          <DialogDescription>
            Скопируйте прямую ссылку на пост или отправьте её другу в личные сообщения.
          </DialogDescription>
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="button"
              onClick={copyPostLink}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl glass text-sm font-medium hover:bg-white/5"
            >
              <Link2 className="w-4 h-4" />
              Скопировать ссылку на пост
            </button>
            <button
              type="button"
              onClick={sharePostNatively}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl glass text-sm font-medium hover:bg-white/5"
            >
              <Share2 className="w-4 h-4" />
              Поделиться (системно)
            </button>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Отправить в личные сообщения
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {friendsForShare.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Нет друзей для отправки</p>
              ) : (
                friendsForShare.map((f) => (
                  <button
                    key={f.friend_id}
                    type="button"
                    onClick={() => sendPostToFriend(f.friend_id)}
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

      <Dialog open={!!likesPostId} onOpenChange={(open) => !open && setLikesPostId(null)}>
        <DialogContent className="max-w-md rounded-3xl max-h-[70vh] overflow-hidden flex flex-col">
          <DialogTitle>Лайкнули</DialogTitle>
          <DialogDescription>Список пользователей, которым понравился пост</DialogDescription>
          <div className="overflow-y-auto flex-1 min-h-0 -mx-2 px-2">
            {likesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : likesList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Пока нет лайков</p>
            ) : (
              likesList.map((like) => (
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
    </AppLayout>
  );
}