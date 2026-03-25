import { useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, Image as ImageIcon, Send, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PostWithAuthor {
  id: string;
  user_id: string;
  content_text: string;
  media_url: string | null;
  media_type: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: {
    username: string;
    first_name: string;
    avatar_url: string | null;
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

export default function FeedPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchPosts = async () => {
    const { data: postsData } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username, first_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsData && user) {
      const { data: myLikes } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id);

      const likedPostIds = new Set(myLikes?.map(l => l.post_id) || []);

      setPosts(postsData.map((p: any) => ({
        ...p,
        profiles: p.profiles || { username: "unknown", first_name: "?", avatar_url: null },
        liked_by_me: likedPostIds.has(p.id),
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, [user]);

  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content_text: newPost.trim(),
    });
    if (error) {
      toast.error("Ошибка при создании поста");
    } else {
      setNewPost("");
      await fetchPosts();
      toast.success("Пост опубликован!");
    }
    setPosting(false);
  };

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
      await supabase.from("posts").update({ likes_count: posts.find(p => p.id === postId)!.likes_count - 1 }).eq("id", postId);
    } else {
      await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
      await supabase.from("posts").update({ likes_count: posts.find(p => p.id === postId)!.likes_count + 1 }).eq("id", postId);
    }
    setPosts(posts.map(p =>
      p.id === postId
        ? { ...p, liked_by_me: !liked, likes_count: liked ? p.likes_count - 1 : p.likes_count + 1 }
        : p
    ));
  };

  return (
    <AppLayout>
      <h2 className="text-2xl font-bold mb-6">Лента</h2>

      {/* Create Post */}
      <div className="glass rounded-3xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm shrink-0">
            {profile?.first_name?.charAt(0) || "?"}
          </div>
          <div className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Что нового?"
              className="w-full bg-transparent text-foreground text-sm resize-none focus:outline-none placeholder:text-muted-foreground min-h-[60px]"
            />
            <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
              <button className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleCreatePost}
                disabled={!newPost.trim() || posting}
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
            <div key={post.id} className="glass rounded-3xl p-5 transition-all hover:shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm">
                  {post.profiles.first_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{post.profiles.first_name}</p>
                  <p className="text-[11px] text-muted-foreground">@{post.profiles.username} · {timeAgo(post.created_at)}</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed mb-4">{post.content_text}</p>

              {post.media_url && (
                <img src={post.media_url} alt="" className="w-full rounded-2xl mb-4 object-cover max-h-80" />
              )}

              <div className="flex items-center gap-6 pt-3 border-t border-border/30">
                <button
                  onClick={() => toggleLike(post.id, post.liked_by_me)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
                    post.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${post.liked_by_me ? "fill-current" : ""}`} />
                  {post.likes_count || 0}
                </button>
                <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all">
                  <MessageCircle className="w-4 h-4" />
                  {post.comments_count || 0}
                </button>
                <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-all">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
