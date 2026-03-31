import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { toast } from "sonner";
import { Users, Megaphone, Plus, Search, Check, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'CHANNEL' | 'GROUP';
  role?: 'MEMBER' | 'ADMIN' | 'OWNER';
  _count?: {
    members: number;
  };
}

export default function CommunitiesPage() {
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [exploreCommunities, setExploreCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [createData, setCreateData] = useState({
    name: "",
    description: "",
    type: "GROUP" as 'CHANNEL' | 'GROUP'
  });

  const fetchData = async () => {
    try {
      const [myRes, exploreRes] = await Promise.all([
        api.get('/communities'),
        api.get('/communities/explore/all')
      ]);
      setMyCommunities(myRes.data);
      setExploreCommunities(exploreRes.data);
    } catch (error) {
      console.error("Error fetching communities:", error);
      toast.error("Не удалось загрузить сообщества");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!createData.name) return toast.error("Введите название");
    try {
      await api.post('/communities', createData);
      toast.success("Сообщество создано!");
      setShowCreateModal(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при создании");
    }
  };

  const handleJoin = async (id: string) => {
    try {
      await api.post(`/communities/${id}/join`);
      toast.success("Вы вступили в сообщество");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Ошибка при вступлении");
    }
  };

  const filteredMy = myCommunities.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredExplore = exploreCommunities.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Сообщества</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Создать</span>
        </button>
      </div>

      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="Поиск каналов и групп..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* My Communities */}
          {filteredMy.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                Мои сообщества
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">{filteredMy.length}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMy.map(community => (
                  <CommunityCard key={community.id} community={community} isMember={true} />
                ))}
              </div>
            </section>
          )}

          {/* Explore */}
          {filteredExplore.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Рекомендации</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredExplore.map(community => (
                  <CommunityCard 
                    key={community.id} 
                    community={community} 
                    isMember={false} 
                    onJoin={() => handleJoin(community.id)} 
                  />
                ))}
              </div>
            </section>
          )}

          {filteredMy.length === 0 && filteredExplore.length === 0 && (
            <div className="text-center py-10 text-muted-foreground glass-subtle rounded-3xl">
              Ничего не найдено
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md p-6 glass-subtle border-border/30">
          <DialogTitle className="text-xl font-bold mb-4">Создать сообщество</DialogTitle>
          <DialogDescription className="sr-only">Форма создания нового канала или группы</DialogDescription>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Тип</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreateData({ ...createData, type: 'CHANNEL' })}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border ${createData.type === 'CHANNEL' ? 'bg-primary/20 border-primary text-primary' : 'glass border-transparent text-muted-foreground hover:bg-white/5'}`}
                >
                  <Megaphone className="w-4 h-4" />
                  <span className="font-medium">Канал</span>
                </button>
                <button
                  onClick={() => setCreateData({ ...createData, type: 'GROUP' })}
                  className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border ${createData.type === 'GROUP' ? 'bg-primary/20 border-primary text-primary' : 'glass border-transparent text-muted-foreground hover:bg-white/5'}`}
                >
                  <Users className="w-4 h-4" />
                  <span className="font-medium">Группа</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {createData.type === 'CHANNEL' ? 'В канале писать можете только вы (админы). Подписчики только читают.' : 'В группе могут общаться все участники.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Название</label>
              <input
                type="text"
                value={createData.name}
                onChange={e => setCreateData({ ...createData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl glass bg-black/20 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                placeholder={createData.type === 'CHANNEL' ? "Название канала" : "Название группы"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Описание (необязательно)</label>
              <textarea
                value={createData.description}
                onChange={e => setCreateData({ ...createData, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl glass bg-black/20 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none h-24"
                placeholder="О чем это сообщество?"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={!createData.name}
              className="w-full py-3 mt-2 btn-gradient rounded-xl text-white font-semibold shadow-lg disabled:opacity-50 transition-opacity"
            >
              Создать
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function CommunityCard({ community, isMember, onJoin }: { community: Community, isMember: boolean, onJoin?: () => void }) {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => navigate(`/communities/${community.id}`)}
      className="p-4 rounded-2xl glass-subtle border border-border/30 hover:bg-white/5 transition-colors flex items-center gap-4 group cursor-pointer"
    >
      <div className="w-14 h-14 rounded-full bg-gradient-subtle flex items-center justify-center shrink-0 overflow-hidden relative">
        {community.avatar_url ? (
          <img src={community.avatar_url} alt={community.name} className="w-full h-full object-cover" />
        ) : (
          community.type === 'CHANNEL' ? <Megaphone className="w-6 h-6 text-primary" /> : <Users className="w-6 h-6 text-primary" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="font-semibold text-foreground truncate">{community.name}</h4>
          {community.type === 'CHANNEL' ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 uppercase tracking-wider">Канал</span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/20 text-green-400 uppercase tracking-wider">Группа</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{community.description || 'Нет описания'}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          {community._count?.members || 0} участников
        </p>
      </div>

      {isMember ? (
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      ) : (
        <button 
          onClick={(e) => { e.stopPropagation(); onJoin?.(); }}
          className="px-4 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors"
        >
          Вступить
        </button>
      )}
    </div>
  );
}