import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { toast } from "sonner";
import { Save, ArrowLeft, Image as ImageIcon } from "lucide-react";

export default function CommunitySettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/communities/${id}`).then(res => {
      setFormData({
        name: res.data.name,
        description: res.data.description || ""
      });
      setAvatarPreview(res.data.avatar_url);
      setCoverPreview(res.data.cover_url);
      setLoading(false);
    }).catch(() => {
      toast.error("Ошибка загрузки");
      navigate("/communities");
    });
  }, [id]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      if (type === 'avatar') {
        setAvatarFile(file);
        setAvatarPreview(preview);
      } else {
        setCoverFile(file);
        setCoverPreview(preview);
      }
    }
  };

  const toBase64 = (file: File) => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      let avatar_url = avatarPreview;
      let cover_url = coverPreview;
      
      if (avatarFile) avatar_url = await toBase64(avatarFile);
      if (coverFile) cover_url = await toBase64(coverFile);

      await api.put(`/communities/${id}`, {
        name: formData.name,
        description: formData.description,
        avatar_url: avatarFile ? avatar_url : undefined,
        cover_url: coverFile ? cover_url : undefined
      });
      toast.success("Настройки сохранены");
      navigate(`/communities/${id}`);
    } catch (error) {
      toast.error("Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(`/communities/${id}`)} className="p-2 rounded-xl glass hover:text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold">Настройки сообщества</h2>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="glass p-6 rounded-3xl space-y-6">
          
          {/* Cover */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Обложка</label>
            <div 
              onClick={() => coverInputRef.current?.click()}
              className="w-full h-32 rounded-2xl glass-subtle flex items-center justify-center cursor-pointer overflow-hidden relative group"
            >
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black/50 px-3 py-1 rounded-lg text-xs text-white">Изменить</span>
              </div>
            </div>
            <input type="file" hidden ref={coverInputRef} accept="image/*" onChange={e => handleFile(e, 'cover')} />
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Аватар</label>
            <div className="flex items-center gap-4">
              <div 
                onClick={() => avatarInputRef.current?.click()}
                className="w-20 h-20 rounded-full glass-subtle flex items-center justify-center cursor-pointer overflow-hidden relative group shrink-0"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
              </div>
              <input type="file" hidden ref={avatarInputRef} accept="image/*" onChange={e => handleFile(e, 'avatar')} />
              <div className="text-xs text-muted-foreground">Нажмите на изображение, чтобы загрузить новое</div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Название</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl glass bg-black/20 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Описание</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl glass bg-black/20 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none h-24"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !formData.name}
            className="flex items-center justify-center gap-2 w-full py-3 btn-gradient rounded-xl text-white font-semibold shadow-lg disabled:opacity-50 transition-opacity"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить изменения
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
