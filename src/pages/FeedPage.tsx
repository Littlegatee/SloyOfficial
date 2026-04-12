import { useState, useEffect, useRef, useMemo } from "react";
import { Heart, MessageCircle, Share2, Image as ImageIcon, Send, Loader2, Edit2, Trash2, X, MoreVertical, Maximize2, Link2, Users, Eye, BarChart2, TrendingUp, Repeat, Bookmark, CheckCircle2, BarChart3, PlusCircle, MinusCircle } from "lucide-react";
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
  DialogDescription,
  DialogTitle,
  DialogClose,
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
  views_count: number;
  is_repost?: boolean;
  is_promoted?: boolean;
  tags?: { tag: { name: string } }[];
  poll?: {
    id: string;
    question: string;
    options: { id: string, text: string }[];
    votes: { user_id: string, option_id: string }[];
  } | null;
  original_post_id?: string | null;
  original_post?: PostWithAuthor | null;
  created_at: string;
  author_type?: 'USER' | 'COMMUNITY';
  community_id?: string | null;
  community?: {
    id: string;
    name: string;
    avatar_url: string | null;
    is_verified?: boolean;
  };
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [statsPostId, setStatsPostId] = useState<string | null>(null);
  const [postStats, setPostStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [trendingTags, setTrendingTags] = useState<any[]>([]);
  const [pollOptions, setPollOptions] = useState<{ text: string }[]>([{ text: "" }, { text: "" }]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
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
            // If quota exceeded, clear all managed caches and try once more with even smaller subset
            if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
              try {
                const keys = Object.keys(localStorage);
                for (const key of keys) {
                  if (key.startsWith("feed_cache:") || key.startsWith("dialogs_cache:")) {
                    localStorage.removeItem(key);
                  }
                }
                const extraSlim = prepared.slice(0, 10); // Only 10 posts
                localStorage.setItem(feedCacheKey, JSON.stringify({ ts: Date.now(), posts: stripFeedPostsForCache(extraSlim) }));
              } catch (inner) {
                console.error("Critical cache failure after cleanup:", inner);
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
    fetchBookmarks();
    fetchTrendingTags();
  }, [user, recommendationType, isLiteMode]);

  const fetchBookmarks = async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/bookmarks");
      setBookmarks(new Set(data.map((b: any) => b.post_id).filter(Boolean)));
    } catch (error) {
      console.error("Failed to fetch bookmarks");
    }
  };

  const fetchTrendingTags = async () => {
    try {
      const { data } = await api.get("/tags/trending");
      setTrendingTags(data);
    } catch (error) {
      console.error("Failed to fetch trending tags");
    }
  };

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
    if ((!newPost.trim() && !selectedImage && !pollQuestion.trim()) || !user) return;
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
      
      // Extract tags
      const tags = newPost.match(/#[a-zA-Z0-9а-яА-Я]+/g) || [];

      const postData: any = { 
        content_text: newPost.trim(),
        media_url,
        media_type: selectedImage ? (isVid ? "VIDEO" : "IMAGE") : "NONE",
        author_type: selectedAuthor.type,
        community_id: selectedAuthor.id,
        tags
      };

      if (showPollCreator && pollQuestion.trim()) {
        postData.poll = {
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.text.trim()).map((o, i) => ({ id: String(i), text: o.text.trim() }))
        };
      }

      const { data } = await api.post("/posts", postData);
      setNewPost("");
      setSelectedImage(null);
      setPollQuestion("");
      setPollOptions([{ text: "" }, { text: "" }]);
      setShowPollCreator(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchPosts();
      toast.success("Пост опубликован!");
      
      // Promotion button popup
      toast("Продвинуть пост?", {
        description: "Ваш пост может увидеть больше людей!",
        action: {
          label: "Продвинуть",
          onClick: () => handlePromote(data.id)
        },
      });
    } catch (error) {
      toast.error("Ошибка при создании поста");
    } finally {
      setPosting(false);
    }
  };

  const handleRepost = async (post: PostWithAuthor) => {
    if (!user) return;
    if (!confirm("Репостнуть этот пост в свою ленту?")) return;
    try {
      await api.post("/posts", {
        content_text: "",
        original_post_id: post.id,
        author_type: "USER"
      });
      toast.success("Репост выполнен!");
      fetchPosts();
    } catch (error) {
      toast.error("Ошибка при репосте");
    }
  };

  const handlePromote = async (postId: string) => {
    try {
      // For demo, we just toast it. In real app, we would send a request to backend.
      toast.success("Запрос на продвижение отправлен!");
    } catch (error) {
      toast.error("Ошибка при запросе продвижения");
    }
  };

  const toggleBookmark = async (postId: string) => {
    if (!user) return;
    const isBookmarked = bookmarks.has(postId);
    try {
      if (isBookmarked) {
        await api.delete("/bookmarks", { data: { post_id: postId } });
        const newBookmarks = new Set(bookmarks);
        newBookmarks.delete(postId);
        setBookmarks(newBookmarks);
        toast.success("Удалено из закладок");
      } else {
        await api.post("/bookmarks", { post_id: postId });
        const newBookmarks = new Set(bookmarks);
        newBookmarks.add(postId);
        setBookmarks(newBookmarks);
        toast.success("Добавлено в закладки");
      }
    } catch (error) {
      toast.error("Ошибка при работе с закладками");
    }
  };

  const handlePollVote = async (postId: string, optionId: string) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/posts/${postId}/poll/vote`, { option_id: optionId });
      setPosts(posts.map(p => p.id === postId ? data : p));
      toast.success("Голос принят");
    } catch (error) {
      toast.error("Ошибка при голосовании");
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

  const sendPostToFriend = async (friendId: string) => {
    if (!sharePost) return;
    try {
      const url = getPostShareUrl(sharePost.id);
      const text = `Пост в Sloy:\n${url}\n\n${(sharePost.content_text || "").slice(0, 400)}`;
      await api.post("/messages", { recipient_id: friendId, content_text: text });
      toast.success("Пост отправлен в личные сообщения");
      navigate(`/messages?userId=${friendId}`);
    } catch (error) {
      toast.error("Не удалось отправить пост");
    } finally {
      setSharePost(null);
    }
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

  const fetchPostStats = async (postId: string) => {
    setStatsPostId(postId);
    setStatsLoading(true);
    try {
      const { data } = await api.get(`/posts/${postId}/stats`);
      setPostStats(data);
    } catch {
      toast.error("Не удалось загрузить статистику");
    } finally {
      setStatsLoading(false);
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
      <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-8 space-y-4">
          {/* Create Post */}
          <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Что нового?"
            className="w-full p-3 bg-muted rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary mb-3 text-sm"
            rows={3}
          />
          
          {selectedImage && (
            <div className="relative mb-3">
              <img
                src={URL.createObjectURL(selectedImage)}
                className="w-full max-h-96 object-cover rounded-lg"
                alt="Preview"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-muted-foreground hover:text-primary transition-colors"
                title="Прикрепить фото/видео"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden"
              />

              <button
                onClick={() => setShowPollCreator(!showPollCreator)}
                className={`p-2 transition-all ${showPollCreator ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                title="Добавить опрос"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              
              <Dialog>
                <DialogTrigger asChild>
                  <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
                    <Users className="w-5 h-5" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Опубликовать от имени</DialogTitle>
                  <DialogDescription>Выберите автора поста</DialogDescription>
                  <div className="space-y-2 mt-4">
                    <button
                      onClick={() => {
                        setSelectedAuthor({ type: 'USER', id: null });
                        // close dialog logic usually handled by UI
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        selectedAuthor.type === 'USER' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold">Я</div>
                      <span>Личный профиль</span>
                    </button>
                    {myCommunities.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedAuthor({ type: 'COMMUNITY', id: c.id })}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          selectedAuthor.id === c.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                        }`}
                      >
                        {c.avatar_url ? (
                          <img src={c.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold">C</div>
                        )}
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <button
              disabled={posting || (!newPost.trim() && !selectedImage && !pollQuestion.trim())}
              onClick={handleCreatePost}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Опубликовать
            </button>
          </div>

          {showPollCreator && (
            <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Создание опроса</span>
                <button onClick={() => setShowPollCreator(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
              </div>
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Задайте вопрос..."
                className="w-full bg-transparent border-b border-border py-2 text-sm focus:outline-none focus:border-primary transition-colors"
              />
              <div className="space-y-2">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                    <input
                      value={opt.text}
                      onChange={(e) => {
                        const newOpts = [...pollOptions];
                        newOpts[idx].text = e.target.value;
                        setPollOptions(newOpts);
                      }}
                      placeholder={`Вариант ${idx + 1}`}
                      className="flex-1 bg-transparent py-1 text-xs focus:outline-none"
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}>
                        <MinusCircle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 10 && (
                  <button 
                    onClick={() => setPollOptions([...pollOptions, { text: "" }])}
                    className="flex items-center gap-2 text-[10px] font-bold text-primary hover:opacity-80 transition-opacity pt-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Добавить вариант
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setRecommendationType('main')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              recommendationType === 'main' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground hover:bg-muted border border-border'
            }`}
          >
            Главная
          </button>
          <button
            onClick={() => setRecommendationType('friends')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              recommendationType === 'friends' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground hover:bg-muted border border-border'
            }`}
          >
            Друзья
          </button>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-card p-4 rounded-xl h-64 animate-pulse border border-border" />
            ))
          ) : posts.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground">Лента пока пуста</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(post.user_id === user?.id ? "/profile" : `/u/${post.user.profile.username}`)}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {post.user.profile.avatar_url ? (
                          <img src={post.user.profile.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">{post.user.profile.first_name.charAt(0)}</span>
                        )}
                      </div>
                      {post.user.profile.is_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                          <VerifiedBadge className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm hover:text-primary transition-colors">{post.user.profile.first_name}</p>
                        {post.is_promoted && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-black uppercase tracking-tighter border border-primary/20">
                            <TrendingUp className="w-2 h-2" />
                            Реклама
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                      className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {activeMenuId === post.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-xl border border-border z-10 py-1">
                        {post.user_id === user?.id ? (
                          <>
                            <button className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2">
                              <Edit2 className="w-4 h-4" /> Изменить
                            </button>
                            <button className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-destructive flex items-center gap-2">
                              <Trash2 className="w-4 h-4" /> Удалить
                            </button>
                          </>
                        ) : (
                          <button className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2">
                            <X className="w-4 h-4" /> Скрыть пост
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-2">
                  <p className="text-sm whitespace-pre-wrap">
                    {post.content_text.split(/(\s+)/).map((word, i) => 
                      word.startsWith('#') ? (
                        <span key={i} className="text-primary hover:underline cursor-pointer">{word}</span>
                      ) : word
                    )}
                  </p>
                </div>

                {post.poll && (
                  <div className="mx-4 mb-4 p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-bold">{post.poll.question}</h4>
                    </div>
                    <div className="space-y-2">
                      {post.poll.options.map((opt) => {
                        const totalVotes = post.poll?.votes.length || 0;
                        const optionVotes = post.poll?.votes.filter(v => v.option_id === opt.id).length || 0;
                        const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                        const hasVoted = post.poll?.votes.some(v => v.user_id === user?.id);
                        const isMyVote = post.poll?.votes.find(v => v.user_id === user?.id)?.option_id === opt.id;

                        return (
                          <button
                            key={opt.id}
                            disabled={hasVoted}
                            onClick={() => handlePollVote(post.id, opt.id)}
                            className={`w-full relative h-10 rounded-xl border transition-all overflow-hidden ${
                              isMyVote ? 'border-primary' : 'border-border/50 hover:border-primary/30'
                            }`}
                          >
                            {hasVoted && (
                              <div 
                                className={`absolute inset-0 h-full transition-all duration-1000 ${isMyVote ? 'bg-primary/10' : 'bg-muted/40'}`} 
                                style={{ width: `${percentage}%` }}
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-between px-4 text-xs">
                              <span className="font-medium flex items-center gap-2">
                                {opt.text}
                                {isMyVote && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                              </span>
                              {hasVoted && <span className="font-bold tabular-nums">{percentage}%</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Всего голосов: {post.poll.votes.length}
                    </p>
                  </div>
                )}

                {post.is_repost && post.original_post && (
                  <div className="mx-4 mb-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-muted overflow-hidden">
                        {post.original_post.user?.profile?.avatar_url && (
                          <img src={post.original_post.user.profile.avatar_url} className="w-full h-full object-cover" alt="" />
                        )}
                      </div>
                      <span className="text-xs font-semibold">{post.original_post.user?.profile?.first_name}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(post.original_post.created_at)}</span>
                    </div>
                    <p className="text-xs mb-2">{post.original_post.content_text}</p>
                    {post.original_post.media_url && (
                      <div 
                        className="relative rounded-md overflow-hidden border border-border/30 cursor-zoom-in"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedImage(post.original_post!.media_url);
                        }}
                      >
                        <BlurImage
                          src={post.original_post.media_url}
                          className="w-full h-auto max-h-40 object-cover"
                          alt=""
                        />
                      </div>
                    )}
                  </div>
                )}

                {post.media_url && (
                  <div className="px-4 pb-2">
                    <div 
                      className="relative rounded-lg overflow-hidden border border-border cursor-zoom-in bg-muted/20"
                      onClick={() => setZoomedImage(post.media_url)}
                    >
                      <BlurImage
                        src={post.media_url}
                        className="w-auto max-w-full h-auto max-h-[650px] mx-auto"
                        objectFit="contain"
                        alt=""
                      />
                    </div>
                  </div>
                )}

                <div className="p-4 flex items-center justify-between border-t border-border">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleLike(post.id, post.liked_by_me)}
                      className={`flex items-center gap-1 text-sm transition-colors ${
                        post.liked_by_me ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${post.liked_by_me ? 'fill-current' : ''}`} />
                      <span>{post.likes_count > 0 && post.likes_count}</span>
                    </button>
                    
                    <button
                      onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{post.comments_count > 0 && post.comments_count}</span>
                    </button>

                    <button
                      onClick={() => handleRepost(post)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-green-500 transition-colors"
                      title="Репостнуть"
                    >
                      <Repeat className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-1 text-sm text-muted-foreground/60">
                      <Eye className="w-4 h-4" />
                      <span>{post.views_count || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {post.user_id === user?.id && (
                      <button 
                        onClick={() => fetchPostStats(post.id)}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        title="Статистика"
                      >
                        <BarChart2 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleBookmark(post.id)}
                      className={`p-1.5 rounded-full hover:bg-muted transition-colors ${
                        bookmarks.has(post.id) ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                      }`}
                      title="Закладки"
                    >
                      <Bookmark className={`w-5 h-5 ${bookmarks.has(post.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button 
                      onClick={() => openShare(post)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {expandedPostId === post.id && (
                  <div className="p-4 border-t border-border bg-muted/30">
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {/* Comments would go here */}
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted shrink-0 overflow-hidden">
                        {profile?.avatar_url && <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />}
                      </div>
                      <div className="flex-1 relative">
                        <input
                          placeholder="Написать комментарий..."
                          className="w-full bg-card border border-border rounded-full py-1.5 px-3 text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:scale-110 transition-transform">
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

      {/* Sidebar Trends */}
      <aside className="lg:col-span-4 space-y-6 hidden lg:block">
          <div className="glass p-6 rounded-3xl sticky top-24">
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Популярное сейчас
            </h3>
            <div className="space-y-4">
              {trendingTags.length > 0 ? (
                trendingTags.map((tag) => (
                  <div key={tag.id} className="group cursor-pointer">
                    <p className="text-sm font-bold group-hover:text-primary transition-colors">#{tag.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      {tag.count} {tag.count === 1 ? 'пост' : tag.count < 5 ? 'поста' : 'постов'} за 24ч
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">Трендов пока нет</p>
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-border/50">
              <button 
                onClick={() => navigate('/bookmarks')}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Bookmark className="w-5 h-5 group-hover:fill-current" />
                  <span className="text-sm font-bold">Мои закладки</span>
                </div>
                <div className="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-black group-hover:bg-primary/20 transition-colors">
                  {bookmarks.size}
                </div>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Lightbox */}
      <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] p-0 overflow-hidden border-none bg-black/95 sm:rounded-none flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {zoomedImage && (
              <img
                src={zoomedImage}
                className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-200"
                alt="Full screen"
              />
            )}
            <DialogClose asChild>
              <button
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90 z-[100]"
                title="Закрыть"
              >
                <X className="w-6 h-6" />
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={!!statsPostId} onOpenChange={(open) => !open && setStatsPostId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Статистика поста</DialogTitle>
          <div className="py-6">
            {statsLoading ? (
              <div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : postStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <div className="flex justify-center text-muted-foreground"><Eye className="w-5 h-5" /></div>
                    <p className="text-xl font-bold">{postStats.views}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Просмотры</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-center text-muted-foreground"><Heart className="w-5 h-5" /></div>
                    <p className="text-xl font-bold">{postStats.likes}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Лайки</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-center text-muted-foreground"><MessageCircle className="w-5 h-5" /></div>
                    <p className="text-xl font-bold">{postStats.comments}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Комменты</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-muted-foreground">Engagement Rate</span>
                    <span className="text-xs font-bold text-primary">
                      {postStats.views > 0 
                        ? (((postStats.likes + postStats.comments) / postStats.views) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-6">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${Math.min(100, (postStats.views > 0 ? ((postStats.likes + postStats.comments) / postStats.views) * 100 : 0) * 5)}%` }}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Активность по дням</h4>
                    <div className="flex items-end justify-between h-16 gap-1">
                      {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-primary/20 rounded-t-sm transition-all hover:bg-primary/40 cursor-help" 
                            style={{ height: `${h}%` }}
                            title={`День ${i+1}: ${Math.round(postStats.views * (h/100))} просмотров`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[8px] text-muted-foreground px-1">
                      <span>7 дней назад</span>
                      <span>Сегодня</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
                    Активность аудитории относительно просмотров. Высокий показатель (&gt;10%) означает отличный отклик!
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Нет данных</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={!!sharePost} onOpenChange={(open) => !open && setSharePost(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Поделиться постом</DialogTitle>
          <DialogDescription>
            Выберите друга для отправки или скопируйте ссылку.
          </DialogDescription>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={copyPostLink}
              className="flex items-center justify-center gap-2 p-3 rounded-xl glass hover:bg-accent transition-colors text-sm"
            >
              <Link2 className="w-4 h-4" /> Копировать ссылку
            </button>
            <button
              onClick={sharePostNatively}
              className="flex items-center justify-center gap-2 p-3 rounded-xl glass hover:bg-accent transition-colors text-sm"
            >
              <Share2 className="w-4 h-4" /> Поделиться...
            </button>
          </div>
          
          <div className="mt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Отправить друзьям</p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {friendsForShare.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Нет доступных друзей</p>
              ) : (
                friendsForShare.map((f) => (
                  <button
                    key={f.friend_id}
                    onClick={() => sendPostToFriend(f.friend_id)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
                      {f.friend_profile?.avatar_url ? (
                        <img src={f.friend_profile.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                          {f.friend_profile?.first_name?.charAt(0) || "?"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.friend_profile?.first_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{f.friend_profile?.username}</p>
                    </div>
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