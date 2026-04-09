import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Megaphone, Users, Settings, LogOut, Image as ImageIcon, Send, Loader2, Heart, MessageCircle, Share2, X, Maximize2, Link2, Trash2, ShoppingBag, Plus, Tag, Repeat, Eye, BarChart2, Star, ClipboardList, CheckCircle2 } from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ title: "", description: "", price: "", image_url: "", category: "" });
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>("all");
  const [productSearch, setProductSearch] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState<any>(null);
  const [orderNote, setOrderNote] = useState("");
  const [rating, setRating] = useState<any>({ average: 0, count: 0 });
  const [showReviewDialog, setShowReviewDialog] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
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
      const [commRes, postsRes, productsRes, ratingRes] = await Promise.all([
        api.get(`/communities/${id}`),
        api.get(`/communities/${id}/posts`),
        api.get(`/communities/${id}/products`).catch(() => ({ data: [] })),
        api.get(`/reviews/community/${id}`).catch(() => ({ data: { average: 0, count: 0 } }))
      ]);
      setCommunity(commRes.data);
      setPosts(postsRes.data);
      setProducts(productsRes.data);
      setRating(ratingRes.data);

      const isManager = commRes.data.role && ['OWNER', 'ADMIN', 'PRODUCT_EDITOR'].includes(commRes.data.role);
      if (isManager) {
        fetchOrders();
      }
    } catch (error) {
      toast.error("Ошибка при загрузке сообщества");
      navigate("/communities");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const { data } = await api.get(`/orders/community/${id}`);
      setOrders(data);
    } catch (e) {
      console.error("Orders load failed");
    } finally {
      setOrdersLoading(false);
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

  const handleAddProduct = async () => {
    if (!newProduct.title.trim() || !id) return;
    setProductsLoading(true);
    try {
      await api.post(`/communities/${id}/products`, newProduct);
      toast.success("Товар добавлен");
      setAddProductOpen(false);
      setNewProduct({ title: "", description: "", price: "", image_url: "", category: "" });
      fetchData();
    } catch (error) {
      toast.error("Ошибка при добавлении товара");
    } finally {
      setProductsLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!showOrderDialog) return;
    try {
      await api.post('/orders', {
        product_id: showOrderDialog.id,
        customer_note: orderNote
      });
      toast.success("Заказ успешно оформлен!");
      setShowOrderDialog(null);
      setOrderNote("");
    } catch (e) {
      toast.error("Ошибка при оформлении заказа");
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success("Статус обновлен");
      fetchOrders();
    } catch (e) {
      toast.error("Ошибка обновления статуса");
    }
  };

  const handleCreateReview = async () => {
    if (!showReviewDialog) return;
    try {
      if (showReviewDialog.type === 'community') {
        await api.post(`/reviews/community/${id}`, { rating: reviewRating, review_text: reviewText });
      } else {
        await api.post(`/reviews/product/${showReviewDialog.id}`, { rating: reviewRating, text: reviewText });
      }
      toast.success("Отзыв опубликован!");
      setShowReviewDialog(null);
      setReviewText("");
      fetchData();
    } catch (e) {
      toast.error("Ошибка при публикации отзыва");
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
  const isManager = myRole && ['OWNER', 'ADMIN', 'PRODUCT_EDITOR', 'ANALYST'].includes(myRole);
  const canPost =
    myRole === "OWNER" ||
    myRole === "ADMIN" ||
    myRole === "MODERATOR" ||
    myRole === "CHAT_MODERATOR" ||
    (community.type === "GROUP" && isMember);
  const isAdminSettings = myRole === "OWNER" || myRole === "ADMIN";
  const canEditProducts = myRole && ['OWNER', 'ADMIN', 'PRODUCT_EDITOR'].includes(myRole);
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
                {community.is_verified && <VerifiedBadge className="w-5 h-5" />}
                {community.type === 'CHANNEL' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Канал</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 uppercase tracking-wider">Группа</span>
                )}
                {rating.count > 0 && (
                  <button 
                    onClick={() => setShowReviewDialog({ type: 'community' })}
                    className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-black hover:bg-yellow-500/20 transition-colors"
                  >
                    <Star className="w-3 h-3 fill-current" />
                    {rating.average.toFixed(1)}
                  </button>
                )}
                {!rating.count && (
                  <button 
                    onClick={() => setShowReviewDialog({ type: 'community' })}
                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors ml-2"
                  >
                    Оценить
                  </button>
                )}
              </h1>
              {community.category && (
                <div className="flex items-center gap-1.5 text-primary text-xs font-medium mb-2">
                  <Tag className="w-3.5 h-3.5" />
                  {community.category}
                </div>
              )}
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

      {/* Content Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className={`grid w-full mb-6 ${isManager ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="posts">Публикации</TabsTrigger>
          <TabsTrigger value="products">Товары</TabsTrigger>
          {isManager && <TabsTrigger value="orders">Заказы</TabsTrigger>}
        </TabsList>

        <TabsContent value="posts">
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
        </TabsContent>

        <TabsContent value="products">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold">Товары и услуги</h3>
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Поиск по товарам..."
                  className="w-full bg-muted border-none rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
              {canEditProducts && (
              <button
                onClick={() => setAddProductOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-xs font-bold shrink-0"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            )}
            </div>
          </div>

          {products.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
              <button
                onClick={() => setSelectedProductCategory("all")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedProductCategory === "all" ? "bg-primary text-primary-foreground" : "glass text-muted-foreground hover:bg-white/5"
                }`}
              >
                Все
              </button>
              {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map((cat: any) => (
                <button
                  key={cat}
                  onClick={() => setSelectedProductCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedProductCategory === cat ? "bg-primary text-primary-foreground" : "glass text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.filter(p => (selectedProductCategory === "all" || p.category === selectedProductCategory) && (p.title.toLowerCase().includes(productSearch.toLowerCase()) || p.description?.toLowerCase().includes(productSearch.toLowerCase()))).length > 0 ? (
              products
                .filter(p => (selectedProductCategory === "all" || p.category === selectedProductCategory) && (p.title.toLowerCase().includes(productSearch.toLowerCase()) || p.description?.toLowerCase().includes(productSearch.toLowerCase())))
                .map(product => (
                <div key={product.id} className="glass rounded-3xl p-4 flex gap-4 transition-all hover:shadow-lg">
                  <div className="w-24 h-24 rounded-2xl bg-muted overflow-hidden shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-sm truncate">{product.title}</h4>
                      {product.category && <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-bold uppercase">{product.category}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{product.price} {product.currency}</span>
                      <button 
                        onClick={() => setShowOrderDialog(product)}
                        className="text-[10px] font-bold px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Заказать
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-20 glass-subtle rounded-3xl">
                <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">В этой категории пока нет товаров</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Управление заказами</h3>
            <button onClick={fetchOrders} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <Repeat className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-4">
            {orders.length > 0 ? (
              orders.map(order => (
                <div key={order.id} className="glass rounded-3xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                        {order.user.profile?.avatar_url && <img src={order.user.profile.avatar_url} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{order.user.profile?.first_name} {order.user.profile?.last_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{timeAgo(order.created_at)}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      order.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500' :
                      order.status === 'CONFIRMED' ? 'bg-blue-500/10 text-blue-500' :
                      order.status === 'DELIVERED' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      {order.status}
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-2xl p-4 mb-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Товар</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                        {order.product.image_url && <img src={order.product.image_url} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{order.product.title}</p>
                        <p className="text-xs text-primary font-black">{order.total_price} {order.currency}</p>
                      </div>
                    </div>
                    {order.customer_note && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Примечание клиента</p>
                        <p className="text-xs italic">"{order.customer_note}"</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {order.status === 'PENDING' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                        className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                      >
                        Подтвердить
                      </button>
                    )}
                    {(order.status === 'CONFIRMED' || order.status === 'SHIPPED') && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                        className="flex-1 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors"
                      >
                        Доставлено
                      </button>
                    )}
                    <button 
                      onClick={() => navigate(`/messages/${order.user_id}`)}
                      className="p-2 rounded-xl glass hover:bg-accent transition-colors"
                      title="Написать клиенту"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 glass-subtle rounded-3xl">
                <ClipboardList className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground">Заказов пока нет</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!showReviewDialog} onOpenChange={(o) => !o && setShowReviewDialog(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Оставить отзыв</DialogTitle>
          <DialogDescription>
            {showReviewDialog?.type === 'community' ? 'Как вам это сообщество?' : 'Ваши впечатления о товаре'}
          </DialogDescription>
          <div className="space-y-6 mt-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button 
                  key={s} 
                  onClick={() => setReviewRating(s)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star className={`w-8 h-8 ${reviewRating >= s ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Ваш отзыв</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Расскажите подробнее..."
                className="w-full bg-muted border-none rounded-2xl py-3 px-4 text-sm mt-1 focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
              />
            </div>
            <button
              onClick={handleCreateReview}
              className="w-full py-3 rounded-2xl btn-gradient text-sm font-bold shadow-lg shadow-primary/20"
            >
              Опубликовать
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showOrderDialog} onOpenChange={(o) => !o && setShowOrderDialog(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Оформление заказа</DialogTitle>
          <DialogDescription>Вы заказываете: {showOrderDialog?.title}</DialogDescription>
          <div className="space-y-4 mt-4">
            <div className="bg-muted/30 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden">
                {showOrderDialog?.image_url && <img src={showOrderDialog.image_url} className="w-full h-full object-cover" />}
              </div>
              <div>
                <p className="font-bold">{showOrderDialog?.title}</p>
                <p className="text-primary font-black">{showOrderDialog?.price} {showOrderDialog?.currency}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Комментарий к заказу</label>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Напр. цвет, размер, адрес доставки..."
                className="w-full bg-muted border-none rounded-2xl py-3 px-4 text-sm mt-1 focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
              />
            </div>
            <button
              onClick={handleCreateOrder}
              className="w-full py-3 rounded-2xl btn-gradient text-sm font-bold shadow-lg shadow-primary/20"
            >
              Подтвердить заказ
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Добавить товар или услугу</DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Название</label>
              <input
                value={newProduct.title}
                onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                placeholder="Название товара"
                className="w-full bg-muted border-none rounded-2xl py-3 px-4 text-sm mt-1 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Описание</label>
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                placeholder="Описание..."
                className="w-full bg-muted border-none rounded-2xl py-3 px-4 text-sm mt-1 focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Цена</label>
              <input
                type="number"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                placeholder="0"
                className="w-full bg-muted border-none rounded-2xl py-3 px-4 text-sm mt-1 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Категория</label>
              <input
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                placeholder="Напр. Одежда, Услуги..."
                className="w-full bg-muted border-none rounded-2xl py-3 px-4 text-sm mt-1 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">URL изображения</label>
              <input
                value={newProduct.image_url}
                onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                placeholder="https://..."
                className="w-full bg-muted border-none rounded-2xl py-3 px-4 text-sm mt-1 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              onClick={handleAddProduct}
              disabled={productsLoading || !newProduct.title.trim()}
              className="w-full py-3 rounded-2xl btn-gradient text-sm font-bold disabled:opacity-50 mt-2"
            >
              {productsLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Добавить"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
