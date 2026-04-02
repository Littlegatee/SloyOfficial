import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function PostSharePage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    api
      .get(`/posts/${postId}`)
      .then(({ data }) => setPost(data))
      .catch(() => {
        toast.error("Пост не найден или недоступен");
        navigate("/feed");
      })
      .finally(() => setLoading(false));
  }, [postId, navigate]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!post) return null;

  const isCommunity = post.author_type === "COMMUNITY" && post.community;
  const title = isCommunity ? post.community?.name : post.user?.profile?.first_name;
  const subtitle = isCommunity ? "Сообщество" : `@${post.user?.profile?.username}`;

  return (
    <AppLayout>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад
      </button>
      <div className="max-w-xl mx-auto glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-subtle overflow-hidden flex items-center justify-center font-bold">
            {isCommunity ? (
              post.community?.avatar_url ? (
                <img src={post.community.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                post.community?.name?.charAt(0) || "?"
              )
            ) : post.user?.profile?.avatar_url ? (
              <img src={post.user.profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              post.user?.profile?.first_name?.charAt(0) || "?"
            )}
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap mb-4">{post.content_text}</p>
        {post.media_url &&
          (post.media_type === "VIDEO" ? (
            <video
              src={post.media_url}
              controls
              playsInline
              className="w-full rounded-2xl max-h-[70vh] bg-black/80 mb-4"
            />
          ) : (
            <img src={post.media_url} alt="" className="w-full rounded-2xl object-contain max-h-[70vh] bg-black/5 mb-4" />
          ))}
        <p className="text-xs text-muted-foreground mb-4">
          ❤️ {post.likes_count ?? 0} · 💬 {post.comments_count ?? 0}
        </p>
        <button
          type="button"
          onClick={() => navigate("/feed")}
          className="w-full py-3 rounded-2xl btn-gradient text-sm font-medium"
        >
          Открыть ленту
        </button>
        {user && !isCommunity && (
          <button
            type="button"
            onClick={() => navigate(`/profile/${post.user_id}`)}
            className="w-full mt-2 py-3 rounded-2xl glass text-sm font-medium"
          >
            Профиль автора
          </button>
        )}
        {user && isCommunity && post.community_id && (
          <button
            type="button"
            onClick={() => navigate(`/communities/${post.community_id}`)}
            className="w-full mt-2 py-3 rounded-2xl glass text-sm font-medium"
          >
            Сообщество
          </button>
        )}
      </div>
    </AppLayout>
  );
}
