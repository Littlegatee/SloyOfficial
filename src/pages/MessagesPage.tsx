import { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Dialog {
  userId: string;
  username: string;
  first_name: string;
  lastMessage: string;
  unreadCount: number;
  time: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  content_text: string;
  created_at: string;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchDialogs = async () => {
    if (!user) return;
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (msgs) {
      const dialogMap: Record<string, Dialog> = {};
      for (const msg of msgs) {
        const otherId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        if (!dialogMap[otherId]) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, first_name")
            .eq("user_id", otherId)
            .single();

          const unreadCount = msgs.filter(m =>
            m.sender_id === otherId && m.recipient_id === user.id && !m.is_read
          ).length;

          dialogMap[otherId] = {
            userId: otherId,
            username: profile?.username || "?",
            first_name: profile?.first_name || "?",
            lastMessage: msg.content_text,
            unreadCount,
            time: new Date(msg.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
          };
        }
      }
      setDialogs(Object.values(dialogMap));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDialogs();
  }, [user]);

  const openChat = async (userId: string, name: string) => {
    setSelectedUserId(userId);
    setSelectedName(name);
    if (!user) return;

    // Mark as read
    await supabase.from("messages")
      .update({ is_read: true })
      .eq("sender_id", userId)
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    // Fetch messages
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    setMessages(data || []);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !user || !selectedUserId) return;
    const { data, error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: selectedUserId,
      content_text: messageText.trim(),
    }).select().single();

    if (!error && data) {
      setMessages([...messages, data]);
      setMessageText("");
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  // Real-time subscription
  useEffect(() => {
    if (!user || !selectedUserId) return;

    const channel = supabase.channel("messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `recipient_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new && (payload.new as any).sender_id === selectedUserId) {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUserId]);

  return (
    <AppLayout>
      <h2 className="text-2xl font-bold mb-6">Сообщения</h2>

      <div className="glass rounded-3xl overflow-hidden" style={{ minHeight: "520px" }}>
        <div className="flex h-full" style={{ minHeight: "520px" }}>
          {/* Dialog List */}
          <div className={`w-full md:w-80 border-r border-border/30 ${selectedUserId ? "hidden md:block" : ""}`}>
            <div className="p-3 border-b border-border/30">
              <input
                type="text"
                placeholder="Поиск диалогов..."
                className="w-full px-4 py-2.5 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
              />
            </div>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : dialogs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">Нет диалогов</div>
            ) : (
              <div className="divide-y divide-border/20">
                {dialogs.map(dialog => (
                  <button
                    key={dialog.userId}
                    onClick={() => openChat(dialog.userId, dialog.first_name)}
                    className={`w-full flex items-center gap-3 p-3.5 text-left transition-all ${
                      selectedUserId === dialog.userId ? "bg-accent" : "hover:bg-accent/30"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm shrink-0">
                      {dialog.first_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">{dialog.first_name}</p>
                        <span className="text-[10px] text-muted-foreground">{dialog.time}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{dialog.lastMessage}</p>
                    </div>
                    {dialog.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full btn-gradient text-[10px] flex items-center justify-center font-bold">
                        {dialog.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${!selectedUserId ? "hidden md:flex" : "flex"}`}>
            {selectedUserId ? (
              <>
                <div className="flex items-center gap-3 p-4 border-b border-border/30 glass-subtle">
                  <button onClick={() => setSelectedUserId(null)} className="md:hidden p-1 text-muted-foreground">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-xs">
                    {selectedName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedName}</p>
                    <p className="text-[10px] text-green-500 font-medium">онлайн</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 hide-scrollbar">
                  {messages.map(msg => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] px-4 py-2.5 text-sm ${
                          isMine
                            ? "btn-gradient rounded-2xl rounded-br-lg shadow-none"
                            : "glass rounded-2xl rounded-bl-lg"
                        }`}>
                          {msg.content_text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Написать сообщение..."
                      className="flex-1 px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!messageText.trim()}
                      className="p-3 rounded-2xl btn-gradient disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                <MessageCircleIcon />
                <span>Выберите чат</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MessageCircleIcon() {
  return (
    <svg className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
