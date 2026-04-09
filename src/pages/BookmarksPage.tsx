import { useState, useEffect } from "react";
import { Loader2, Bookmark, Trash2, Heart, MessageCircle, Share2, ArrowLeft } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const { data } = await api.get("/bookmarks");
      setBookmarks(data);
    } catch (error) {
      toast.error("Не удалось загрузить закладки");
    } finally {
      setLoading(false);
    }
  };

  const removeBookmark = async (id: string, type: 'post' | 'product' | 'community') => {
    try {
      const body: any = {};
      if (type === 'post') body.post_id = id;
      else if (type === 'product') body.product_id = id;
      else if (type === 'community') body.community_id = id;

      await api.delete("/bookmarks", { data: body });
      setBookmarks(bookmarks.filter(b => 
        (type === 'post' && b.post_id !== id) || 
        (type === 'product' && b.product_id !== id) ||
        (type === 'community' && b.community_id !== id)
      ));
      toast.success("Удалено из закладок");
    } catch (error) {
      toast.error("Ошибка при удалении");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-primary fill-current" />
            <h1 className="text-3xl font-black">Закладки</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl">
            <Bookmark className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">У вас пока нет закладок</p>
            <button 
              onClick={() => navigate("/feed")}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Перейти в ленту
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {bookmarks.map((b) => (
              <div key={b.id} className="glass rounded-3xl p-6 relative group">
                {b.post && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                        {b.post.user?.profile?.avatar_url && (
                          <img src={b.post.user.profile.avatar_url} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{b.post.user?.profile?.first_name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Пост</p>
                      </div>
                    </div>
                    <p className="text-sm line-clamp-3">{b.post.content_text}</p>
                    <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Heart className="w-4 h-4" /> {b.post.likes_count}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageCircle className="w-4 h-4" /> {b.post.comments_count}
                      </div>
                      <button 
                        onClick={() => removeBookmark(b.post_id, 'post')}
                        className="ml-auto p-2 text-muted-foreground hover:text-destructive transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {/* Product and Community types can be added similarly */}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
