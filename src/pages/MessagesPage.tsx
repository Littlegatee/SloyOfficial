import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Send, ArrowLeft, Loader2, Mic, Square, Smile, Play, Pause, Search, X, Paperclip, FileIcon, ImageIcon, VideoIcon, Camera, Image as ImageIcon2, Trash2, Edit2, Check, CheckCheck, Reply, Pin, Forward, CalendarDays, BellOff, Archive, ArchiveX, MoreHorizontal } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth, Profile } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Dialog as UIDialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Dialog {
  userId: string;
  username: string;
  first_name: string;
  avatar_url?: string | null;
  lastMessage: string;
  unreadCount: number;
  time: string;
  pinned?: boolean;
  muted?: boolean;
  mutedUntil?: string | null;
  mutedForever?: boolean;
  archived?: boolean;
  isSaved?: boolean;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'TEXT' | 'VOICE' | 'STICKER' | 'MEDIA' | 'FILE' | 'VIDEO_CIRCLE';
  content_text: string | null;
  media_url: string | null;
  voice_duration: number | null;
  is_edited: boolean;
  is_read: boolean;
  reactions?: Array<{ emoji: string; user_id: string }>;
  reply_to_id?: string | null;
  reply_to?: {
    id: string;
    content_text: string | null;
    message_type: string;
    media_url?: string | null;
    voice_duration?: number | null;
    sender: {
      profile: {
        first_name: string;
      }
    }
  } | null;
  sender?: {
    profile: {
      first_name: string;
    }
  };
  created_at: string;
  forwarded_from_id?: string | null;
}

// Utility to convert AudioBuffer to standard WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const wavData = new Uint8Array(44 + buffer.length * blockAlign);
  const view = new DataView(wavData.buffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * blockAlign, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, buffer.length * blockAlign, true);
  
  let offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedUserOnline, setSelectedUserOnline] = useState<boolean | null>(null);
  const [selectedUserLastSeen, setSelectedUserLastSeen] = useState<number | null>(null);
  const [typingFromOther, setTypingFromOther] = useState(false);
  const [recordingFromOther, setRecordingFromOther] = useState<'VOICE' | 'VIDEO' | null>(null);
  const typingClearTimerRef = useRef<number | null>(null);
  const stopTypingTimerRef = useRef<number | null>(null);
  const recordingClearTimerRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null);
  const [jumpToDateOpen, setJumpToDateOpen] = useState(false);
  const [jumpToDateValue, setJumpToDateValue] = useState<string>("");
  const [muteMenuOpen, setMuteMenuOpen] = useState(false);
  const [chatActionsOpen, setChatActionsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Search in current chat (fast UX)
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchServerResults, setChatSearchServerResults] = useState<ChatMessage[]>([]);
  const [chatSearchNextCursor, setChatSearchNextCursor] = useState<string | null>(null);
  const [chatSearching, setChatSearching] = useState(false);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);

  const selectedDialog = useMemo(() => {
    if (!selectedUserId) return null;
    return dialogs.find(d => d.userId === selectedUserId) || null;
  }, [dialogs, selectedUserId]);

  const fetchPinnedMessages = async (userId: string) => {
    try {
      const { data } = await api.get(`/messages/${userId}/pins`);
      setPinnedMessages(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!user) return;
    socket.connect();
    socket.emit('join', user.id);
  }, [user]);

  useEffect(() => {
    if (!selectedUserId) return;
    setSelectedUserOnline(null);
    setSelectedUserLastSeen(null);
    setTypingFromOther(false);
    socket.emit('presence_request', { userIds: [selectedUserId] });
  }, [selectedUserId]);

  const draftStorageKey = useCallback((otherUserId: string) => {
    if (!user?.id) return null;
    return `draft:${user.id}:${otherUserId}`;
  }, [user?.id]);

  // Drafts: restore when switching chats
  useEffect(() => {
    if (!selectedUserId) return;
    if (editingMessageId) return;
    const key = draftStorageKey(selectedUserId);
    if (!key) return;
    const draft = localStorage.getItem(key) || "";
    setMessageText(draft);
  }, [selectedUserId, editingMessageId, draftStorageKey]);

  // Drafts: persist on each chat independently
  useEffect(() => {
    if (!selectedUserId) return;
    const key = draftStorageKey(selectedUserId);
    if (!key) return;
    localStorage.setItem(key, messageText);
  }, [messageText, selectedUserId, draftStorageKey]);

  // Mini profile
  const [showMiniProfile, setShowMiniProfile] = useState(false);
  const [miniProfileData, setMiniProfileData] = useState<Profile | null>(null);
  const [miniProfileView, setMiniProfileView] = useState<'MAIN' | 'MEDIA' | 'FILE' | 'VOICE'>('MAIN');

  // Fullscreen image viewer
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Stickers
  const [showStickers, setShowStickers] = useState(false);
  const MOCK_STICKERS = [
    "https://api.dicebear.com/7.x/bottts/svg?seed=1",
    "https://api.dicebear.com/7.x/bottts/svg?seed=2",
    "https://api.dicebear.com/7.x/bottts/svg?seed=3",
    "https://api.dicebear.com/7.x/bottts/svg?seed=4",
  ]; // Замените эти ссылки на пути к вашим реальным стикерам в папке public/ (например: '/stickers/1.png')

  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPressingRef = useRef(false);
  const recordStartTimeRef = useRef<number>(0);

  // Video Circle Recording
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecordingDuration, setVideoRecordingDuration] = useState(0);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const [recordStream, setRecordStream] = useState<MediaStream | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [recordMode, setRecordMode] = useState<'VOICE' | 'VIDEO'>('VOICE');

  // Chat Wallpaper
  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // Attachments
  const [showAttachments, setShowAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'MEDIA' | 'FILE') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g., 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Файл слишком большой (максимум 50MB)");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      sendMessage(type, file.name, base64data);
    };
    setShowAttachments(false);
    
    // Reset input
    if (e.target) e.target.value = '';
  };

  const fetchDialogs = async () => {
    if (!user) return;
    const initUserId = searchParams.get("userId");
    try {
      const { data } = await api.get("/messages/dialogs");
      if (data) {
        const formattedDialogs: Dialog[] = (data as any[]).map((d: any) => ({
          ...d,
          time: new Date(d.time).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        }));
        // Keep server order mostly; ensure "Избранное" stays on top, then pinned.
        const saved =
          formattedDialogs.find(d => d.isSaved) ||
          formattedDialogs.find(
            d => d.userId === user.id && (d.first_name === "Избранное" || d.first_name === "Saved Messages")
          ) ||
          null;
        const rest = formattedDialogs.filter(
          d => !d.isSaved && !(d.userId === user.id && (d.first_name === "Избранное" || d.first_name === "Saved Messages"))
        );
        const sortedRest = [...rest].sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))));
        setDialogs(saved ? [saved, ...sortedRest] : sortedRest);
        
        // Handle init user chat from URL
        if (initUserId) {
          const existingDialog = formattedDialogs.find((d: any) => d.userId === initUserId);
          if (existingDialog) {
            openChat(existingDialog.userId, existingDialog.first_name, existingDialog.avatar_url);
          } else {
            // Need to fetch target user's profile to start a new dialog
            try {
              const { data: profileData } = await api.get(`/profiles/${initUserId}`);
              if (profileData) {
                // Add temporary dialog
                setDialogs(prev => [{
                  userId: initUserId,
                  username: profileData.username,
                  first_name: profileData.first_name,
                  avatar_url: profileData.avatar_url,
                  lastMessage: "Новый диалог",
                  unreadCount: 0,
                  time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
                }, ...prev]);
                openChat(initUserId, profileData.first_name, profileData.avatar_url);
              }
            } catch (err) {
              console.error("Error fetching init user profile:", err);
            }
          }
          // Remove userId from URL to avoid reopening on refresh
          setSearchParams({});
        }
      }
    } catch (error: any) {
      console.error("Error fetching dialogs:", error?.response?.data || error);

      // Even if dialogs list fails (400/500), still try to open the personal chat
      // so the "Написать" button works.
      if (initUserId) {
        try {
          const { data: profileData } = await api.get(`/profiles/${initUserId}`);
          if (profileData) {
            openChat(initUserId, profileData.first_name, profileData.avatar_url);
          }
        } catch (err) {
          console.error("Error opening chat from URL after dialogs failure:", err);
        } finally {
          setSearchParams({});
        }
      } else {
        toast.error(error?.response?.data?.error || "Не удалось загрузить диалоги");
      }
    } finally {
      setLoading(false);
    }
  };

  const setDialogArchive = async (otherUserId: string, archived: boolean) => {
    try {
      await api.post(`/messages/dialogs/${otherUserId}/archive`, { archived });
      await fetchDialogs();
      toast.success(archived ? "В архиве" : "Возвращено из архива");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Не удалось изменить архив");
    }
  };

  const setDialogMute = async (mode: '1h' | '8h' | 'forever' | 'off') => {
    if (!selectedUserId) return;
    try {
      await api.post(`/messages/dialogs/${selectedUserId}/mute`, { mode });
      await fetchDialogs();
      toast.success(mode === 'off' ? "Заглушение выключено" : "Чат заглушен");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Не удалось изменить заглушение");
    } finally {
      setMuteMenuOpen(false);
    }
  };

  const userIdFromUrl = searchParams.get("userId");
  useEffect(() => {
    fetchDialogs();
  }, [user, userIdFromUrl]);

  const loadMessagesPage = async (userId: string, cursor: string | null, mode: 'replace' | 'prepend') => {
    if (!user) return;
    if (mode === 'prepend') setLoadingMore(true);
    try {
      const { data } = await api.get(`/messages/${userId}`, {
        params: { take: 50, cursor: cursor || undefined }
      });

      const pageMessages: ChatMessage[] = data?.messages || [];
      const pageNextCursor: string | null = data?.nextCursor || null;

      if (mode === 'replace') {
        setMessages(pageMessages);
      } else {
        setMessages(prev => {
          const existing = new Set(prev.map(m => m.id));
          const toAdd = pageMessages.filter(m => !existing.has(m.id));
          return [...toAdd, ...prev];
        });
      }
      setNextCursor(pageNextCursor);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      if (mode === 'prepend') setLoadingMore(false);
    }
  };

  const jumpToDate = async (dateYYYYMMDD: string) => {
    if (!selectedUserId) return;
    try {
      const { data } = await api.get(`/messages/${selectedUserId}/by-date`, {
        params: { date: dateYYYYMMDD, take: 120 }
      });
      const pageMessages: ChatMessage[] = data?.messages || [];
      const pageNextCursor: string | null = data?.nextCursor || null;
      setMessages(pageMessages);
      setNextCursor(pageNextCursor);
      setTimeout(() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: "auto" }), 80);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Не удалось перейти к дате");
    }
  };

  const openChat = async (userId: string, name: string, avatar?: string | null) => {
    // Clear current messages immediately to avoid showing old chat content
    setMessages([]);
    setMessageText("");
    setNextCursor(null);
    setChatSearchOpen(false);
    setChatSearchQuery("");
    setChatSearchServerResults([]);
    setChatSearchNextCursor(null);
    setMuteMenuOpen(false);
    setChatActionsOpen(false);
    setReactionPickerForId(null);
    setJumpToDateOpen(false);
    setArchiveOpen(false);
    setSelectedUserId(userId);
    setSelectedName(name);
    setSelectedAvatar(avatar || null);
    
    // Load local wallpaper if exists
    const savedWallpaper = localStorage.getItem(`chat_wallpaper_${userId}`);
    if (savedWallpaper) {
      setChatWallpaper(savedWallpaper);
    } else {
      const globalWallpaper = localStorage.getItem('global_chat_wallpaper');
      setChatWallpaper(globalWallpaper || null);
    }
    
    if (!user) return;

    try {
      await loadMessagesPage(userId, null, 'replace');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 100);
      // Avoid loops when openChat is triggered by /messages?userId=...
      // fetchDialogs() may try to open the chat again until the URL param is cleared.
      if (!searchParams.get("userId")) {
        fetchDialogs(); // Refresh to clear unread counts
      }
      fetchPinnedMessages(userId);
    } catch (error) {
      console.error("Error opening chat:", error);
    }
  };

  const handleTypingChanged = (text: string) => {
    setMessageText(text);
    if (!user || !selectedUserId) return;

    socket.emit('typing', { toUserId: selectedUserId, fromUserId: user.id });
    if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = window.setTimeout(() => {
      socket.emit('stop_typing', { toUserId: selectedUserId, fromUserId: user.id });
    }, 650);
  };

  const loadOlder = async () => {
    if (!selectedUserId || loadingMore || !nextCursor) return;

    const scroller = scrollContainerRef.current;
    const prevScrollHeight = scroller?.scrollHeight || 0;
    const prevScrollTop = scroller?.scrollTop || 0;

    await loadMessagesPage(selectedUserId, nextCursor, 'prepend');

    // Keep scroll position stable after prepending
    requestAnimationFrame(() => {
      const newScrollHeight = scroller?.scrollHeight || 0;
      const delta = newScrollHeight - prevScrollHeight;
      if (scroller) scroller.scrollTop = prevScrollTop + delta;
    });
  };

  const openMiniProfile = async () => {
    if (!selectedUserId) return;
    try {
      const { data } = await api.get(`/profiles/${selectedUserId}`);
      setMiniProfileData(data);
      setMiniProfileView('MAIN');
      setShowMiniProfile(true);
    } catch (error) {
      console.error("Error fetching mini profile:", error);
      toast.error("Не удалось загрузить профиль");
    }
  };

  const sendMessage = async (type: 'TEXT' | 'STICKER' | 'VOICE' | 'MEDIA' | 'FILE' | 'VIDEO_CIRCLE' = 'TEXT', content: string | null = null, mediaUrl: string | null = null, voiceDuration: number | null = null) => {
    const textToSend = type === 'TEXT' ? (content || messageText.trim()) : content;
    
    if (type === 'TEXT' && !textToSend) return;
    if (!user || !selectedUserId) return;
    
    try {
      // If we are editing a message
      if (editingMessageId && type === 'TEXT') {
        const { data } = await api.patch(`/messages/${editingMessageId}`, {
          content_text: textToSend
        });
        if (data) {
          setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content_text: textToSend, is_edited: true } : m));
          setEditingMessageId(null);
          setMessageText("");
          const key = selectedUserId ? draftStorageKey(selectedUserId) : null;
          if (key) localStorage.removeItem(key);
        }
        return;
      }

      const { data } = await api.post("/messages", {
        recipient_id: selectedUserId,
        message_type: type,
        content_text: textToSend,
        media_url: mediaUrl,
        voice_duration: voiceDuration,
        reply_to_id: replyingToMessage?.id || null,
      });
      if (data) {
        setMessages(prev => [...prev, data]);
        if (type === 'TEXT') {
          setMessageText("");
          const key = selectedUserId ? draftStorageKey(selectedUserId) : null;
          if (key) localStorage.removeItem(key);
        }
        setReplyingToMessage(null);
        setShowStickers(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.response?.data?.error || "Ошибка при отправке сообщения");
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const { data } = await api.post(`/messages/${messageId}/reactions`, { emoji });
      if (data?.messageId && Array.isArray(data?.reactions)) {
        setMessages(prev => prev.map(m => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m)));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Не удалось поставить реакцию");
    }
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, type: 'MESSAGE' | 'CHAT' } | null>(null);

  const deleteMessage = async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}`, { params: { scope: 'me' } });
      setMessages(prev => prev.filter(m => m.id !== messageId));
      fetchDialogs();
      setDeleteConfirmation(null);
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Не удалось удалить сообщение");
    }
  };

  const deleteMessageForEveryone = async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}`, { params: { scope: 'everyone' } });
      setMessages(prev => prev.filter(m => m.id !== messageId));
      fetchDialogs();
      setDeleteConfirmation(null);
    } catch (error: any) {
      console.error("Error deleting message for everyone:", error);
      toast.error(error?.response?.data?.error || "Не удалось удалить у всех");
    }
  };

  const deleteChat = async () => {
    if (!selectedUserId) return;
    try {
      await api.delete(`/messages/chat/${selectedUserId}`);
      setSelectedUserId(null);
      fetchDialogs();
      toast.success("Чат удален");
      setDeleteConfirmation(null);
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Не удалось удалить чат");
    }
  };

  const startRecording = async () => {
    if (isPressingRef.current) return; // Prevent double start
    isPressingRef.current = true;
    recordStartTimeRef.current = Date.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isPressingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const actualDuration = Math.max(1, Math.round((Date.now() - recordStartTimeRef.current) / 1000));
        
        // Prevent sending empty audio
        if (audioChunksRef.current.length > 0) {
          const finalMimeType = (mediaRecorderRef.current?.mimeType || 'audio/webm').split(';')[0];
          const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
          
          if (audioBlob.size >= 1000) {
            try {
              // Convert any browser audio format (webm/ogg/mp4) to universally supported WAV
              const arrayBuffer = await audioBlob.arrayBuffer();
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              const audioContext = new AudioContextClass();
              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
              
              const wavBlob = audioBufferToWav(audioBuffer);
              
              const reader = new FileReader();
              reader.readAsDataURL(wavBlob);
              reader.onloadend = () => {
                sendMessage('VOICE', null, reader.result as string, actualDuration);
              };
            } catch (err) {
              console.error("Error converting audio to wav:", err);
              // Fallback to sending original blob if conversion fails
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                sendMessage('VOICE', null, reader.result as string, actualDuration);
              };
            }
          }
        }
        
        stream.getTracks().forEach(track => track.stop());
        setRecordingDuration(0);
        durationRef.current = 0;
      };

      mediaRecorder.start();
      setIsRecording(true);
      if (user && selectedUserId) {
        socket.emit('recording_start', { toUserId: selectedUserId, fromUserId: user.id, kind: 'VOICE' });
      }
      durationRef.current = 0;
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);

    } catch (err) {
      console.error("Microphone error:", err);
      toast.error("Не удалось получить доступ к микрофону");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    isPressingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (user && selectedUserId) {
      socket.emit('recording_stop', { toUserId: selectedUserId, fromUserId: user.id, kind: 'VOICE' });
    }
  };

  const startVideoRecording = async () => {
    if (isPressingRef.current) return; // Prevent double start
    isPressingRef.current = true;
    setShowVideoPreview(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user", 
          aspectRatio: 1,
          width: { ideal: 480 },
          height: { ideal: 480 }
        }, 
        audio: true 
      });

      if (!isPressingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        setShowVideoPreview(false);
        setRecordStream(null);
        return;
      }

      videoStreamRef.current = stream;
      setRecordStream(stream);
      
      let mediaRecorder: MediaRecorder;
      try {
        let options: MediaRecorderOptions = {};
        const types = [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=h264,opus',
          'video/webm',
          'video/mp4;codecs=h264,aac',
          'video/mp4'
        ];
        
        for (const t of types) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
            options.mimeType = t;
            break;
          }
        }
        mediaRecorder = new MediaRecorder(stream, options.mimeType ? options : undefined);
      } catch (e) {
        console.warn("Failed to create MediaRecorder with specific mimeType, falling back to default", e);
        mediaRecorder = new MediaRecorder(stream);
      }

      videoRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const duration = recordStartTimeRef.current > 0 
          ? Math.max(1, Math.round((Date.now() - recordStartTimeRef.current) / 1000))
          : 0;
        
        if (videoChunksRef.current.length > 0 && duration > 0) {
          const finalMimeType = (videoRecorderRef.current?.mimeType || 'video/webm').split(';')[0];
          const videoBlob = new Blob(videoChunksRef.current, { type: finalMimeType });
          
          if (videoBlob.size >= 1000) {
            const reader = new FileReader();
            reader.readAsDataURL(videoBlob);
            reader.onloadend = () => {
              sendMessage('VIDEO_CIRCLE', null, reader.result as string, duration);
            };
          }
        }
        
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach(track => track.stop());
          videoStreamRef.current = null;
        }
        setVideoRecordingDuration(0);
        setShowVideoPreview(false);
        setRecordStream(null);
      };

      // We do NOT start recording here anymore.
      // We will start recording in the onPreviewPlaying callback
      // to ensure the camera is warmed up and we don't record a black screen.

    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Не удалось получить доступ к камере");
      setShowVideoPreview(false);
      setIsVideoRecording(false);
      isPressingRef.current = false;
    }
  };

  const onPreviewPlaying = () => {
    // Now we start the actual recording when the video element starts playing frames!
    if (videoRecorderRef.current && videoRecorderRef.current.state === 'inactive' && isPressingRef.current) {
      try {
        videoRecorderRef.current.start();
        setIsVideoRecording(true);
        if (user && selectedUserId) {
          socket.emit('recording_start', { toUserId: selectedUserId, fromUserId: user.id, kind: 'VIDEO' });
        }
        recordStartTimeRef.current = Date.now();
        
        videoTimerRef.current = setInterval(() => {
          setVideoRecordingDuration(prev => prev + 1);
        }, 1000);
      } catch (e) {
        console.error("Failed to start MediaRecorder on playing:", e);
      }
    }
  };

  const stopVideoRecording = () => {
    isPressingRef.current = false;
    if (videoRecorderRef.current && videoRecorderRef.current.state === 'recording') {
      videoRecorderRef.current.stop();
    } else {
      setShowVideoPreview(false);
      setRecordStream(null);
    }
    setIsVideoRecording(false);
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    if (user && selectedUserId) {
      socket.emit('recording_stop', { toUserId: selectedUserId, fromUserId: user.id, kind: 'VIDEO' });
    }
  };

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Изображение слишком большое (максимум 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      
      // Create a temporary image to resize it for better quality/size ratio
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions (max 1920x1080)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw with high quality
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Save as high quality JPEG
        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.9);
        
        if (selectedUserId) {
          localStorage.setItem(`chat_wallpaper_${selectedUserId}`, optimizedBase64);
          setChatWallpaper(optimizedBase64);
          toast.success("Обои чата обновлены");
        }
      };
      img.src = base64data;
    };
  };

  const removeWallpaper = () => {
    if (selectedUserId) {
      localStorage.removeItem(`chat_wallpaper_${selectedUserId}`);
      const globalWallpaper = localStorage.getItem('global_chat_wallpaper');
      setChatWallpaper(globalWallpaper || null);
      toast.success("Обои чата сброшены");
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Video Circle Player Component
  const VideoCircleMessage = ({ url, duration }: { url: string, duration: number }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(duration);
    const [hasError, setHasError] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Fix for legacy base64 URLs without data URI prefix
    let videoUrl = url;
    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      videoUrl = `data:video/webm;base64,${url}`;
    }
    
    // Clean up codecs from base64 string to prevent decoding errors in some browsers
    if (videoUrl?.startsWith('data:')) {
      videoUrl = videoUrl.replace(/;codecs=[^;]+/, '');
    }

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !videoUrl) return;

      const handleLoadedMetadata = () => {
        if (video.duration && video.duration !== Infinity && duration === 0) {
          setVideoDuration(video.duration);
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
      };
      
      const handleError = (e: any) => {
        console.error("Video element error:", video.error);
        setHasError(true);
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('error', handleError);

  return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('error', handleError);
      };
    }, [videoUrl, duration]);

    const togglePlay = () => {
      if (!videoRef.current || hasError) return;
      
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        const allMedia = document.querySelectorAll('audio, video');
        allMedia.forEach(media => {
          if (media !== videoRef.current) (media as HTMLMediaElement).pause();
        });
        
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Error playing video:", err);
          setIsPlaying(false);
          setHasError(true);
        });
      }
    };

    const displayDuration = videoDuration || duration || 0;
    const progress = displayDuration > 0 ? Math.min((currentTime / displayDuration) * 100, 100) : 0;

    if (hasError || !url) {
      return (
        <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-red-500/50 shadow-lg relative bg-black flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] text-center px-6 leading-relaxed">
            Ошибка воспроизведения.<br/>Формат не поддерживается.
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-2 group">
        <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-primary/50 shadow-lg relative bg-black flex-shrink-0 cursor-pointer" onClick={togglePlay}>
          <video 
            ref={videoRef}
            src={videoUrl} 
            className="w-full h-full object-cover scale-x-[-1]" 
            playsInline 
            loop={false}
            preload="metadata"
          />
          
          <div 
            className={`absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
          >
            <button className="p-4 rounded-full bg-black/30 text-white backdrop-blur-sm transform transition-transform hover:scale-110">
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
          </div>
        </div>

        <div className="w-48 flex items-center gap-2 transition-opacity opacity-0 group-hover:opacity-100">
          <span className="text-[10px] text-muted-foreground font-medium shrink-0">
            {formatDuration(Math.floor(currentTime))}
          </span>
          <div className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium shrink-0">
            {formatDuration(Math.round(displayDuration))}
          </span>
        </div>
      </div>
    );
  };
  const VoiceMessage = ({ url, duration }: { url: string, duration: number }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
      if (url && !audioRef.current) {
        // Fix for base64 URLs without data URI prefix
        let audioUrl = url;
        if (!url.startsWith('http') && !url.startsWith('data:')) {
          // Detect actual audio format or fallback to webm
          const mimeType = url.startsWith('UklGR') ? 'audio/wav' : 'audio/webm';
          audioUrl = `data:${mimeType};base64,${url}`;
        }
        
        // Firefox records as audio/ogg, Safari records as audio/mp4, Chrome records as audio/webm
        // When Safari tries to play Firefox's audio/ogg base64, it might fail.
        // For broad compatibility, we let the browser handle it natively if possible.

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onloadedmetadata = () => {
          if (audio.duration && audio.duration !== Infinity && duration === 0) {
            setAudioDuration(audio.duration);
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };

        audio.ontimeupdate = () => {
          setCurrentTime(audio.currentTime);
        };

        // Try to preload to avoid playback issues
        audio.load();
      }
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }
      };
    }, [url, duration]);

    const togglePlay = async () => {
      if (!audioRef.current) return;
      
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          // Pause all other audio elements on the page before playing this one
          const allAudios = document.getElementsByTagName('audio');
          for (let i = 0; i < allAudios.length; i++) {
            allAudios[i].pause();
          }
          
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (err) {
        console.error("Error playing audio:", err);
        // It's possible the browser blocked auto-play or format is unsupported
        toast.error("Не удалось воспроизвести аудио");
        setIsPlaying(false);
      }
    };

    const displayDuration = audioDuration || duration || 0;
    // Calculate progress percentage
    const progress = displayDuration > 0 ? Math.min((currentTime / displayDuration) * 100, 100) : 0;

    return (
      <div className="flex items-center gap-3 min-w-[160px]">
        <button onClick={togglePlay} className="p-2 bg-black/20 rounded-full hover:bg-black/30 transition-all shrink-0">
          {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
        </button>
        <div className="flex-1">
          <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 h-full bg-white transition-all duration-100" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
        <span className="text-[10px] text-white/80 font-medium shrink-0">
          {isPlaying ? formatDuration(Math.floor(currentTime)) : formatDuration(Math.round(displayDuration))}
        </span>
      </div>
    );
  };

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const handleReceiveMessage = (msg: ChatMessage) => {
      if (selectedUserId && (msg.sender_id === selectedUserId || msg.recipient_id === selectedUserId)) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        
        // If we are currently in this chat and receive a message from the other person, mark it as read
        if (msg.sender_id === selectedUserId) {
          api.post(`/messages/${selectedUserId}/read`)
            .then(() => fetchDialogs())
            .catch(console.error);
        } else {
          fetchDialogs();
        }
      } else {
        fetchDialogs();
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_edited', (updatedMsg: ChatMessage) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });
    socket.on('message_deleted', (payload: any) => {
      const messageId = typeof payload === 'string' ? payload : payload?.messageId;
      if (!messageId) return;
      setMessages(prev => prev.filter(m => m.id !== messageId));
      fetchDialogs();
    });
    socket.on('message_reactions_updated', (payload: { messageId: string; reactions: Array<{ emoji: string; user_id: string }> }) => {
      if (!payload?.messageId) return;
      setMessages(prev =>
        prev.map(m => (m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m))
      );
    });
    socket.on('messages_read', (readByUserId: string) => {
      if (selectedUserId === readByUserId) {
        setMessages(prev => prev.map(m => m.sender_id === user.id ? { ...m, is_read: true } : m));
      }
      fetchDialogs();
    });

    socket.on('typing', ({ fromUserId }: { fromUserId: string }) => {
      if (selectedUserId && fromUserId === selectedUserId) {
        setTypingFromOther(true);
        if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current);
        typingClearTimerRef.current = window.setTimeout(() => setTypingFromOther(false), 1500);
      }
    });
    socket.on('stop_typing', ({ fromUserId }: { fromUserId: string }) => {
      if (selectedUserId && fromUserId === selectedUserId) {
        setTypingFromOther(false);
      }
    });
    socket.on('presence_update', ({ userId, online, lastSeen }: { userId: string; online: boolean; lastSeen: number | null }) => {
      if (selectedUserId && userId === selectedUserId) {
        setSelectedUserOnline(online);
        setSelectedUserLastSeen(lastSeen);
      }
    });
    socket.on('presence_snapshot', (snapshot: Array<{ userId: string; online: boolean; lastSeen: number | null }>) => {
      if (!selectedUserId) return;
      const row = snapshot.find(s => s.userId === selectedUserId);
      if (row) {
        setSelectedUserOnline(row.online);
        setSelectedUserLastSeen(row.lastSeen);
      }
    });

    socket.on('recording_start', ({ fromUserId, kind }: { fromUserId: string; kind: 'VOICE' | 'VIDEO' }) => {
      if (selectedUserId && fromUserId === selectedUserId) {
        setRecordingFromOther(kind);
        if (recordingClearTimerRef.current) window.clearTimeout(recordingClearTimerRef.current);
        recordingClearTimerRef.current = window.setTimeout(() => setRecordingFromOther(null), 2500);
      }
    });
    socket.on('recording_stop', ({ fromUserId }: { fromUserId: string }) => {
      if (selectedUserId && fromUserId === selectedUserId) {
        setRecordingFromOther(null);
      }
    });

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_edited');
      socket.off('message_deleted');
      socket.off('message_reactions_updated');
      socket.off('messages_read');
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('presence_update');
      socket.off('presence_snapshot');
      socket.off('recording_start');
      socket.off('recording_stop');
      if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current);
      if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
      if (recordingClearTimerRef.current) window.clearTimeout(recordingClearTimerRef.current);
    };
  }, [user, selectedUserId]);

  const localSearchMatches = useMemo(() => {
    const q = chatSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter(m => (m.content_text || '').toLowerCase().includes(q));
  }, [messages, chatSearchQuery]);

  const runServerSearch = async (cursor: string | null) => {
    if (!selectedUserId) return;
    const q = chatSearchQuery.trim();
    if (!q) {
      setChatSearchServerResults([]);
      setChatSearchNextCursor(null);
      return;
    }
    setChatSearching(true);
    try {
      const { data } = await api.get(`/messages/${selectedUserId}/search`, {
        params: { q, take: 20, cursor: cursor || undefined }
      });
      const resultMessages: ChatMessage[] = data?.messages || [];
      const resultCursor: string | null = data?.nextCursor || null;

      if (!cursor) {
        setChatSearchServerResults(resultMessages);
      } else {
        setChatSearchServerResults(prev => {
          const existing = new Set(prev.map(m => m.id));
          return [...prev, ...resultMessages.filter(m => !existing.has(m.id))];
        });
      }
      setChatSearchNextCursor(resultCursor);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setChatSearching(false);
    }
  };

  // Preview Video Component to handle stream binding correctly
  const VideoPreview = ({ stream, onPlaying }: { stream: MediaStream | null, onPlaying: () => void }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error("Preview play error:", err));
      }
    }, [stream]);

    return (
      <div className="w-full h-full bg-black relative">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover scale-x-[-1]" 
          muted 
          playsInline 
          autoPlay
          onPlaying={onPlaying}
        />
        {/* Black overlay that fades out to prevent flickering */}
        <div className={`absolute inset-0 bg-black transition-opacity duration-300 pointer-events-none ${stream ? 'opacity-0' : 'opacity-100'}`} />
      </div>
    );
  };

  const MessageActions = ({ msg, isMine }: { msg: ChatMessage, isMine: boolean }) => {
    const pickerOpen = reactionPickerForId === msg.id;

    return (
      <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? 'right-full mr-3' : 'left-full ml-3'} ${pickerOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all duration-300 flex items-center gap-1.5 z-20`}>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReactionPickerForId(prev => (prev === msg.id ? null : msg.id));
            }}
            className="p-2 rounded-full glass hover:bg-yellow-500/20 text-muted-foreground hover:text-yellow-500 transition-all shadow-sm hover:scale-110 active:scale-95"
            title="Реакция"
          >
            <Smile className="w-4 h-4" />
          </button>
          {pickerOpen && (
            <div
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full glass border border-border/30 shadow-lg flex items-center gap-1 z-30"
              onClick={(e) => e.stopPropagation()}
            >
              {["👍", "❤️", "😂", "🔥", "😮", "😢"].map((em) => (
                <button
                  key={em}
                  onClick={() => {
                    toggleReaction(msg.id, em);
                    setReactionPickerForId(null);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-white/10 transition-colors text-base"
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setForwardingMessage(msg);
            setForwardPickerOpen(true);
          }}
          className="p-2 rounded-full glass hover:bg-amber-500/20 text-muted-foreground hover:text-amber-500 transition-all shadow-sm hover:scale-110 active:scale-95"
          title="Переслать"
        >
          <Forward className="w-4 h-4" />
        </button>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await api.post(`/messages/${msg.id}/pin`);
              if (selectedUserId) fetchPinnedMessages(selectedUserId);
              toast.success("Готово");
            } catch (err: any) {
              toast.error(err?.response?.data?.error || "Не удалось закрепить");
            }
          }}
          className="p-2 rounded-full glass hover:bg-violet-500/20 text-muted-foreground hover:text-violet-500 transition-all shadow-sm hover:scale-110 active:scale-95"
          title="Закрепить"
        >
          <Pin className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setReplyingToMessage(msg);
            // Focus input ideally
          }}
          className="p-2 rounded-full glass hover:bg-blue-500/20 text-muted-foreground hover:text-blue-500 transition-all shadow-sm hover:scale-110 active:scale-95"
          title="Ответить"
        >
          <Reply className="w-4 h-4" />
        </button>
        {isMine && msg.message_type === 'TEXT' && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setEditingMessageId(msg.id);
              setMessageText(msg.content_text || "");
            }}
            className="p-2 rounded-full glass hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all shadow-sm hover:scale-110 active:scale-95"
            title="Редактировать"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmation({ id: msg.id, type: 'MESSAGE' });
          }}
          className="p-2 rounded-full glass hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all shadow-sm hover:scale-110 active:scale-95"
          title="Удалить"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const MessageItem = ({ msg, isMine }: { msg: ChatMessage, isMine: boolean }) => {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const itemRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
      itemRef.current!.dataset.startX = e.touches[0].clientX.toString();
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      const startX = parseFloat(itemRef.current!.dataset.startX || '0');
      const currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      
      if (diff < 0 && diff > -60) {
        setSwipeOffset(diff);
      }
    };

    const handleTouchEnd = () => {
      if (swipeOffset < -40) {
        setReplyingToMessage(msg);
      }
      setSwipeOffset(0);
    };

    const timeString = new Date(msg.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

    return (
      <div 
        ref={itemRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex ${isMine ? "justify-end" : "justify-start"} relative`}
      >
        <div 
          className="relative group max-w-[88vw] sm:max-w-[75%] min-w-0 transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${swipeOffset}px)` }}
        >
          <MessageActions msg={msg} isMine={isMine} />
          <div className={`px-4 py-2.5 text-sm ${
            msg.message_type === 'STICKER' || msg.message_type === 'MEDIA' || msg.message_type === 'VIDEO_CIRCLE' ? "bg-transparent p-0" :
            isMine
              ? "btn-gradient rounded-2xl rounded-br-lg shadow-none text-white"
              : "glass rounded-2xl rounded-bl-lg"
          }`}>
            {msg.reply_to && (
              <div 
                className={`mb-2 pl-3 py-1 border-l-2 text-xs opacity-80 cursor-pointer ${isMine ? 'border-white/50 text-white' : 'border-primary/50 text-foreground'}`}
                onClick={() => {
                  // Optional: scroll to message
                  const el = document.getElementById(`msg-${msg.reply_to_id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el?.classList.add('bg-primary/20');
                  setTimeout(() => el?.classList.remove('bg-primary/20'), 1000);
                }}
              >
                <div className="flex items-center gap-2">
                  {(msg.reply_to.message_type === 'MEDIA' && msg.reply_to.media_url && !msg.reply_to.media_url.startsWith('data:video') && !msg.reply_to.media_url.includes('.mp4') && !msg.reply_to.media_url.includes('.webm')) ? (
                    <img
                      src={msg.reply_to.media_url}
                      alt="preview"
                      className="w-7 h-7 rounded-lg object-cover shrink-0 border border-white/10"
                    />
                  ) : msg.reply_to.message_type === 'MEDIA' ? (
                    <div className={`w-7 h-7 rounded-lg ${isMine ? 'bg-white/15' : 'bg-black/10 dark:bg-white/10'} flex items-center justify-center shrink-0`}>
                      <VideoIcon className="w-3.5 h-3.5 opacity-80" />
                    </div>
                  ) : msg.reply_to.message_type === 'VOICE' ? (
                    <div className={`w-7 h-7 rounded-lg ${isMine ? 'bg-white/15' : 'bg-black/10 dark:bg-white/10'} flex items-center justify-center shrink-0`}>
                      <Mic className="w-3.5 h-3.5 opacity-80" />
                    </div>
                  ) : msg.reply_to.message_type === 'VIDEO_CIRCLE' ? (
                    <div className={`w-7 h-7 rounded-lg ${isMine ? 'bg-white/15' : 'bg-black/10 dark:bg-white/10'} flex items-center justify-center shrink-0`}>
                      <Camera className="w-3.5 h-3.5 opacity-80" />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{msg.reply_to.sender?.profile?.first_name || 'Пользователь'}</p>
                    <p className="truncate opacity-75">
                      {msg.reply_to.message_type === 'TEXT' ? msg.reply_to.content_text : 
                       msg.reply_to.message_type === 'VOICE' ? 'Голосовое сообщение' :
                       msg.reply_to.message_type === 'VIDEO_CIRCLE' ? 'Видеосообщение' :
                       msg.reply_to.message_type === 'MEDIA' ? 'Медиа' :
                       msg.reply_to.message_type === 'FILE' ? 'Файл' : 'Стикер'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {msg.message_type === 'TEXT' && (
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content_text}</span>
              </div>
            )}
            {msg.message_type === 'STICKER' && <img src={msg.media_url!} alt="sticker" className="w-24 h-24 object-contain drop-shadow-lg" />}
            {msg.message_type === 'VOICE' && <VoiceMessage url={msg.media_url!} duration={msg.voice_duration!} />}
            {msg.message_type === 'VIDEO_CIRCLE' && (
              <VideoCircleMessage url={msg.media_url!} duration={msg.voice_duration!} />
            )}
            {msg.message_type === 'MEDIA' && (
              msg.media_url?.startsWith('data:video') || msg.media_url?.includes('.mp4') || msg.media_url?.includes('.webm') ? (
                <video src={msg.media_url} controls className="max-w-xs md:max-w-sm rounded-2xl max-h-60 object-contain bg-black/20" />
              ) : (
                <img 
                  src={msg.media_url!} 
                  alt="media" 
                  className="max-w-xs md:max-w-sm rounded-2xl max-h-60 object-contain bg-black/20 cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => setFullscreenImage(msg.media_url!)}
                />
              )
            )}
            {msg.message_type === 'FILE' && (
              <a href={msg.media_url!} download={msg.content_text || 'file'} className="flex items-center gap-3 no-underline text-current">
                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                  <FileIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white">{msg.content_text || 'Вложенный файл'}</p>
                  <p className="text-[10px] text-white/70">Нажмите, чтобы скачать</p>
                </div>
              </a>
            )}

            {!!(msg.reactions?.length) && (
              <div className={`flex flex-wrap gap-1 mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {Object.entries(
                  (msg.reactions || []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
                    const prev = acc[r.emoji] || { count: 0, mine: false };
                    acc[r.emoji] = {
                      count: prev.count + 1,
                      mine: prev.mine || r.user_id === user?.id,
                    };
                    return acc;
                  }, {})
                ).map(([emoji, info]) => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    className={`px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      info.mine
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-black/10 dark:bg-white/10 border-border/30 text-muted-foreground hover:text-foreground'
                    }`}
                    title="Переключить реакцию"
                  >
                    <span className="mr-1">{emoji}</span>
                    {info.count}
                  </button>
                ))}
              </div>
            )}
            
            <div className={`flex items-center gap-1 mt-1 justify-end ${
              msg.message_type === 'STICKER' || msg.message_type === 'MEDIA' || msg.message_type === 'VIDEO_CIRCLE' 
              ? 'absolute bottom-2 right-4 bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-sm' 
              : ''
            }`}>
              {msg.is_edited && (
                <span className={`text-[10px] ${msg.message_type !== 'TEXT' ? 'text-white' : isMine ? 'text-white/70' : 'text-muted-foreground'} mr-1`}>
                  изменено
                </span>
              )}
              <span className={`text-[10px] ${msg.message_type !== 'TEXT' ? 'text-white' : isMine ? 'text-white/80' : 'text-muted-foreground'}`}>
                {timeString}
              </span>
              {isMine && (
                msg.is_read ? (
                  <CheckCheck className={`w-3.5 h-3.5 ${msg.message_type !== 'TEXT' ? 'text-blue-400' : 'text-white'}`} />
                ) : (
                  <Check className={`w-3 h-3 ${msg.message_type !== 'TEXT' ? 'text-white' : 'text-white/80'}`} />
                )
              )}
            </div>
          </div>
          
          {/* Reply Icon when swiping */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 -right-12 text-muted-foreground transition-opacity pointer-events-none"
            style={{ opacity: Math.min(Math.abs(swipeOffset) / 40, 1) }}
          >
            <Reply className="w-5 h-5" />
          </div>
        </div>
      </div>
    );
  };

  const messagesWithDividers = useMemo(() => {
    const items: Array<
      | { kind: 'divider'; key: string; label: string }
      | { kind: 'msg'; key: string; msg: ChatMessage }
    > = [];

    const now = new Date();
    const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    let lastDay: string | null = null;

    for (const msg of messages) {
      const d = new Date(msg.created_at);
      const key = dayKey(d);
      if (key !== lastDay) {
        const diffDays = Math.floor(
          (startOfDay(now).getTime() - startOfDay(d).getTime()) / (24 * 60 * 60 * 1000)
        );
        const label =
          diffDays === 0
            ? "Сегодня"
            : diffDays === 1
              ? "Вчера"
              : d.toLocaleDateString("ru", { day: "2-digit", month: "long", year: "numeric" });
        items.push({ kind: 'divider', key: `div-${key}`, label });
        lastDay = key;
      }
      items.push({ kind: 'msg', key: msg.id, msg });
    }

    return items;
  }, [messages]);

  return (
    <AppLayout>
      <h2 className="mb-3 text-xl font-bold sm:mb-6 sm:text-2xl">Сообщения</h2>

      <div
        className="glass rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm"
        style={{ height: "calc(100dvh - 150px)", minHeight: "460px" }}
      >
        <div className="flex h-full">
          {/* Dialog List */}
          <div className={`w-full md:w-[350px] border-r border-border/30 flex flex-col ${selectedUserId ? "hidden md:flex" : "flex"}`}>
            <div className="p-2.5 sm:p-3 border-b border-border/30 relative">
              <input
                type="text"
                placeholder="Поиск диалогов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
              />
              <Search className="w-4 h-4 absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            </div>
            
            <div className="flex-1 overflow-y-auto hide-scrollbar">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : (() => {
                const saved = dialogs.find(d => d.isSaved) || null;
                const archived = dialogs.filter(d => !d.isSaved && d.archived);
                const normal = dialogs.filter(d => !d.isSaved && !d.archived);
                const list = archiveOpen ? archived : normal;

                const filtered = list.filter(d =>
                  d.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  d.username?.toLowerCase().includes(searchQuery.toLowerCase())
                );

                const archiveCount = archived.length;
                const showArchiveRow = true;

                if (!saved && filtered.length === 0 && !showArchiveRow) {
                  return <div className="text-center py-16 text-muted-foreground text-xs">Нет диалогов</div>;
                }

                return (
                  <div className="divide-y divide-border/20">
                    {saved && !archiveOpen && (
                      <button
                        key="saved-messages"
                        onClick={() => openChat(saved.userId, saved.first_name, saved.avatar_url)}
                        className={`w-full flex items-center gap-3 p-3.5 text-left transition-all ${
                          selectedUserId === saved.userId ? "bg-accent" : "hover:bg-accent/30"
                        }`}
                      >
                        {saved.avatar_url ? (
                          <img src={saved.avatar_url} alt={saved.first_name} className="w-10 h-10 rounded-2xl object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm shrink-0">
                            ★
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold truncate">{saved.first_name}</p>
                            <span className="text-[10px] text-muted-foreground">{saved.time}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{saved.lastMessage}</p>
                        </div>
                      </button>
                    )}

                    {showArchiveRow && (
                      <button
                        key="archive-folder"
                        onClick={() => setArchiveOpen(v => !v)}
                        className={`w-full flex items-center gap-3 p-3.5 text-left transition-all ${
                          archiveOpen ? "bg-accent" : "hover:bg-accent/30"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-2xl glass-subtle flex items-center justify-center shrink-0">
                          <Archive className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold truncate">Архив</p>
                            <span className="text-[10px] text-muted-foreground">{archiveOpen ? "Открыт" : ""}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {archiveCount} {archiveCount === 1 ? "чат" : archiveCount < 5 ? "чата" : "чатов"}
                          </p>
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          {archiveOpen ? <ArchiveX className="w-4 h-4" /> : null}
                        </span>
                      </button>
                    )}

                    {filtered.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground text-xs">
                        {archiveOpen ? "Архив пуст" : "Нет диалогов"}
                      </div>
                    ) : (
                      filtered.map(dialog => (
                        <button
                          key={dialog.userId}
                          onClick={() => openChat(dialog.userId, dialog.first_name, dialog.avatar_url)}
                          className={`w-full flex items-center gap-3 p-3.5 text-left transition-all group ${
                            selectedUserId === dialog.userId ? "bg-accent" : "hover:bg-accent/30"
                          }`}
                        >
                          {dialog.avatar_url ? (
                            <img src={dialog.avatar_url} alt={dialog.first_name} className="w-10 h-10 rounded-2xl object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-sm shrink-0">
                              {dialog.first_name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold truncate">{dialog.first_name}</p>
                              <span className="text-[10px] text-muted-foreground">{dialog.time}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{dialog.lastMessage}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {dialog.muted && (
                              <span className="shrink-0 text-muted-foreground" title="Чат заглушен">
                                <BellOff className="w-4 h-4" />
                              </span>
                            )}

                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDialogArchive(dialog.userId, !Boolean(dialog.archived));
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                e.stopPropagation();
                                setDialogArchive(dialog.userId, !Boolean(dialog.archived));
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl hover:bg-white/5 text-muted-foreground cursor-pointer"
                              title={dialog.archived ? "Вернуть из архива" : "В архив"}
                            >
                              {dialog.archived ? <ArchiveX className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                            </div>

                            {dialog.unreadCount > 0 && (
                              <span className="w-5 h-5 rounded-full btn-gradient text-[10px] flex items-center justify-center font-bold">
                                {dialog.unreadCount}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col relative ${!selectedUserId ? "hidden md:flex" : "flex"}`}>
            {chatWallpaper && (
              <div 
                className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${chatWallpaper})` }}
              />
            )}
            {selectedUserId ? (
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-4 border-b border-border/30 glass-subtle shrink-0">
                  <button onClick={() => setSelectedUserId(null)} className="md:hidden p-1 text-muted-foreground">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={openMiniProfile}
                  >
                    {selectedAvatar ? (
                      <img src={selectedAvatar} alt={selectedName} className="w-8 h-8 rounded-xl object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-xs">
                        {selectedName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold">{selectedName}</p>
                      <p className="text-[10px] font-medium">
                        {recordingFromOther ? (
                          <span className="text-primary">
                            {recordingFromOther === 'VOICE' ? 'записывает голосовое…' : 'записывает видео…'}
                          </span>
                        ) : typingFromOther ? (
                          <span className="text-primary">печатает…</span>
                        ) : selectedUserOnline === null ? (
                          <span className="text-muted-foreground">...</span>
                        ) : selectedUserOnline ? (
                          <span className="text-green-500">онлайн</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {selectedUserLastSeen
                              ? `был(а) ${new Date(selectedUserLastSeen).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                              : "оффлайн"}
                          </span>
                        )}
                        {selectedDialog?.muted && (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary">
                            <BellOff className="w-3.5 h-3.5" />
                            заглушен
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="ml-auto relative">
                    <button
                      onClick={() => {
                        setChatActionsOpen(v => !v);
                        setMuteMenuOpen(false);
                      }}
                      className={`p-2 rounded-xl transition-colors ${chatActionsOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-primary'}`}
                      title="Действия"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {chatActionsOpen && (
                      <div
                        className="absolute right-0 top-full mt-2 p-2 rounded-2xl glass border border-border/30 shadow-xl z-30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setChatSearchOpen(v => !v);
                            setShowAttachments(false);
                            setShowStickers(false);
                            if (!chatSearchOpen) {
                              setTimeout(() => {
                                const el = document.getElementById('chat-search-input') as HTMLInputElement | null;
                                el?.focus();
                              }, 0);
                            }
                            setChatActionsOpen(false);
                          }}
                          className={`p-2 rounded-xl transition-colors ${chatSearchOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-primary'}`}
                          title="Поиск по сообщениям"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setJumpToDateOpen(true);
                            setJumpToDateValue("");
                            setShowAttachments(false);
                            setShowStickers(false);
                            setChatActionsOpen(false);
                          }}
                          className="p-2 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-primary transition-colors"
                          title="Прыжок к дате"
                        >
                          <CalendarDays className="w-5 h-5" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setMuteMenuOpen(v => !v)}
                            className={`p-2 rounded-xl transition-colors ${
                              selectedDialog?.muted ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-primary'
                            }`}
                            title="Заглушить чат"
                          >
                            <BellOff className="w-5 h-5" />
                          </button>
                          {muteMenuOpen && (
                            <div
                              className="absolute right-0 top-full mt-2 w-52 rounded-2xl glass border border-border/30 shadow-xl overflow-hidden z-40"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button onClick={() => setDialogMute('1h')} className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors">
                                Заглушить на 1 час
                              </button>
                              <button onClick={() => setDialogMute('8h')} className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors">
                                Заглушить на 8 часов
                              </button>
                              <button onClick={() => setDialogMute('forever')} className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors">
                                Заглушить навсегда
                              </button>
                              <div className="h-px bg-border/20" />
                              <button onClick={() => setDialogMute('off')} className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                                Выключить заглушение
                              </button>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            setDeleteConfirmation({ id: selectedUserId, type: 'CHAT' });
                            setChatActionsOpen(false);
                          }}
                          className="p-2 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Удалить чат"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {pinnedMessages.length > 0 && (
                  <div className="px-4 py-2 border-b border-border/10 glass-subtle">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Pin className="w-3.5 h-3.5" />
                      <span className="font-semibold">Закреплено</span>
                      <span className="ml-auto">{pinnedMessages.length}</span>
                    </div>
                    <div className="mt-1 flex gap-2 overflow-x-auto hide-scrollbar">
                      {pinnedMessages.slice(0, 10).map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            const el = document.getElementById(`msg-${m.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el?.classList.add('bg-primary/10');
                            setTimeout(() => el?.classList.remove('bg-primary/10'), 900);
                          }}
                          className="shrink-0 px-3 py-1.5 rounded-full glass hover:bg-white/5 transition-colors text-[11px] max-w-[240px] truncate"
                          title={m.content_text || m.message_type}
                        >
                          {m.message_type === 'TEXT' ? (m.content_text || '…') : m.message_type}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatSearchOpen && (
                  <div className="p-3 border-b border-border/20 glass-subtle">
                    <div className="flex items-center gap-2">
                      <input
                        id="chat-search-input"
                        type="text"
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') runServerSearch(null);
                          if (e.key === 'Escape') setChatSearchOpen(false);
                        }}
                        placeholder="Поиск по сообщениям…"
                        className="flex-1 px-4 py-2.5 rounded-2xl glass text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                      />
                      <button
                        onClick={() => runServerSearch(null)}
                        disabled={!chatSearchQuery.trim() || chatSearching}
                        className="px-4 py-2.5 rounded-2xl btn-gradient text-xs disabled:opacity-60"
                        title="Искать во всей переписке"
                      >
                        {chatSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Найти"}
                      </button>
                      <button
                        onClick={() => {
                          setChatSearchQuery("");
                          setChatSearchServerResults([]);
                          setChatSearchNextCursor(null);
                        }}
                        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                        title="Очистить"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {(chatSearchQuery.trim() && localSearchMatches.length > 0) && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Совпадения среди загруженных: <span className="text-foreground font-semibold">{localSearchMatches.length}</span>
                      </div>
                    )}

                    {chatSearchServerResults.length > 0 && (
                      <div className="mt-3 glass rounded-2xl border border-border/20 overflow-hidden">
                        <div className="max-h-48 overflow-y-auto hide-scrollbar divide-y divide-border/10">
                          {chatSearchServerResults.map(m => (
                            <button
                              key={m.id}
                              onClick={() => {
                                const el = document.getElementById(`msg-${m.id}`);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  el.classList.add('bg-primary/10');
                                  setTimeout(() => el.classList.remove('bg-primary/10'), 900);
                                } else {
                                  toast.info("Сообщение найдено, но оно ещё не загружено. Прокрутите вверх для подгрузки истории.");
                                }
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] text-muted-foreground">
                                  {new Date(m.created_at).toLocaleDateString("ru")}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {new Date(m.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="text-xs text-foreground/90 truncate">
                                {m.content_text}
                              </div>
                            </button>
                          ))}
                        </div>
                        {chatSearchNextCursor && (
                          <button
                            onClick={() => runServerSearch(chatSearchNextCursor)}
                            className="w-full px-4 py-2 text-xs text-primary hover:bg-primary/10 transition-colors"
                          >
                            Показать ещё
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2 hide-scrollbar relative flex flex-col"
                  onScroll={() => {
                    const scroller = scrollContainerRef.current;
                    if (!scroller) return;
                    if (scroller.scrollTop <= 40) {
                      loadOlder();
                    }
                  }}
                >
                  {/* Messages container that pushes content to bottom if it's short */}
                  <div className="flex-1 min-h-min flex flex-col justify-end">
                    {nextCursor && (
                      <div className="flex justify-center pb-2">
                        <button
                          onClick={loadOlder}
                          disabled={loadingMore}
                          className="px-4 py-1.5 rounded-full glass text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-60"
                        >
                          {loadingMore ? "Загрузка..." : "Загрузить ещё"}
                        </button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {messagesWithDividers.map(item => {
                        if (item.kind === 'divider') {
                          return (
                            <div key={item.key} className="flex justify-center py-2">
                              <span className="px-3 py-1 rounded-full text-[10px] font-semibold glass-subtle text-muted-foreground border border-border/20">
                                {item.label}
                              </span>
                            </div>
                          );
                        }
                        const msg = item.msg;
                        const isMine = msg.sender_id === user?.id;
                        return (
                          <div key={item.key} id={`msg-${msg.id}`}>
                            <MessageItem msg={msg} isMine={isMine} />
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>

                {/* Jump to date */}
                <UIDialog open={jumpToDateOpen} onOpenChange={(open) => !open && setJumpToDateOpen(false)}>
                  <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/30 glass-subtle">
                    <DialogTitle className="p-4 pb-2 text-base font-bold">Прыжок к дате</DialogTitle>
                    <DialogDescription className="px-4 pb-3 text-sm text-muted-foreground">
                      Выберите дату, чтобы открыть сообщения за этот день.
                    </DialogDescription>
                    <div className="px-4 pb-4">
                      <input
                        type="date"
                        value={jumpToDateValue}
                        onChange={(e) => setJumpToDateValue(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => setJumpToDateOpen(false)}
                          className="flex-1 px-4 py-2.5 rounded-2xl glass text-xs hover:bg-white/5 transition-colors"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={async () => {
                            if (!jumpToDateValue) return;
                            await jumpToDate(jumpToDateValue);
                            setJumpToDateOpen(false);
                          }}
                          disabled={!jumpToDateValue}
                          className="flex-1 px-4 py-2.5 rounded-2xl btn-gradient text-xs disabled:opacity-60"
                        >
                          Перейти
                        </button>
                        <button
                          onClick={async () => {
                            if (!selectedUserId) return;
                            await loadMessagesPage(selectedUserId, null, 'replace');
                            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 100);
                            setJumpToDateOpen(false);
                          }}
                          className="px-4 py-2.5 rounded-2xl glass text-xs hover:bg-white/5 transition-colors"
                          title="К последним"
                        >
                          Сейчас
                        </button>
                      </div>
                    </div>
                  </DialogContent>
                </UIDialog>

                {/* Forward Picker */}
                <UIDialog open={forwardPickerOpen} onOpenChange={(open) => !open && setForwardPickerOpen(false)}>
                  <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/30 glass-subtle">
                    <DialogTitle className="p-4 pb-2 text-base font-bold">Переслать сообщение</DialogTitle>
                    <DialogDescription className="px-4 pb-3 text-sm text-muted-foreground">
                      Выберите друга из списка диалогов.
                    </DialogDescription>
                    <div className="max-h-[60vh] overflow-y-auto hide-scrollbar divide-y divide-border/10">
                      {dialogs.map(d => (
                        <button
                          key={d.userId}
                          onClick={async () => {
                            if (!forwardingMessage) return;
                            try {
                              await api.post('/messages/forward', {
                                message_id: forwardingMessage.id,
                                recipient_id: d.userId,
                              });
                              toast.success("Переслано");
                              setForwardPickerOpen(false);
                              setForwardingMessage(null);
                            } catch (err: any) {
                              toast.error(err?.response?.data?.error || "Не удалось переслать");
                            }
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3"
                        >
                          {d.avatar_url ? (
                            <img src={d.avatar_url} alt={d.first_name} className="w-9 h-9 rounded-2xl object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-2xl bg-gradient-subtle flex items-center justify-center text-gradient font-bold text-xs">
                              {d.first_name?.charAt(0) || "?"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{d.first_name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">@{d.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </DialogContent>
                </UIDialog>

                {/* Video Recording Preview Circle - Moved outside scrollable area */}
                {showVideoPreview && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-72 h-72 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-primary shadow-[0_0_40px_rgba(var(--primary),0.3)] relative bg-black animate-in zoom-in duration-200">
                        <VideoPreview stream={recordStream} onPlaying={onPreviewPlaying} />
                      </div>
                      <div className="bg-black/50 px-4 py-2 rounded-full text-sm font-medium text-white flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-bottom-4">
                        <div className={`w-3 h-3 rounded-full ${isVideoRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                        {isVideoRecording ? formatDuration(videoRecordingDuration) : "Подключение..."}
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-2 sm:p-3 border-t border-border/30 relative shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                  {replyingToMessage && (
                    <div className="absolute bottom-full left-0 right-0 p-2.5 bg-accent/30 backdrop-blur-md border-t border-border/30 flex items-center justify-between px-3 sm:px-6 animate-in slide-in-from-bottom-2 z-20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Reply className="w-5 h-5 text-primary shrink-0" />
                        {(replyingToMessage.message_type === 'MEDIA' && replyingToMessage.media_url && !replyingToMessage.media_url.startsWith('data:video') && !replyingToMessage.media_url.includes('.mp4') && !replyingToMessage.media_url.includes('.webm')) ? (
                          <img
                            src={replyingToMessage.media_url}
                            alt="preview"
                            className="w-9 h-9 rounded-xl object-cover shrink-0 border border-border/20"
                          />
                        ) : replyingToMessage.message_type === 'MEDIA' ? (
                          <div className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <VideoIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        ) : replyingToMessage.message_type === 'VOICE' ? (
                          <div className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <Mic className="w-4 h-4 text-muted-foreground" />
                          </div>
                        ) : replyingToMessage.message_type === 'VIDEO_CIRCLE' ? (
                          <div className="w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                            <Camera className="w-4 h-4 text-muted-foreground" />
                          </div>
                        ) : null}
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-primary text-[11px] font-semibold">
                            В ответ {replyingToMessage.sender_id === user?.id ? "Вам" : selectedName}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-[400px]">
                            {replyingToMessage.message_type === 'TEXT' ? replyingToMessage.content_text :
                             replyingToMessage.message_type === 'VOICE' ? 'Голосовое сообщение' :
                             replyingToMessage.message_type === 'VIDEO_CIRCLE' ? 'Видеосообщение' :
                             replyingToMessage.message_type === 'MEDIA' ? 'Медиа' :
                             replyingToMessage.message_type === 'FILE' ? 'Файл' : 'Стикер'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setReplyingToMessage(null)} 
                        className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors shrink-0"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {editingMessageId && (
                    <div className="absolute bottom-full left-0 right-0 p-2.5 bg-accent/50 backdrop-blur-md border-t border-border/30 flex items-center justify-between px-3 sm:px-6 animate-in slide-in-from-bottom-2 z-20">
                      <div className="flex items-center gap-2 text-primary text-[11px] font-semibold uppercase tracking-wider">
                        <Edit2 className="w-3 h-3" />
                        <span>Редактирование</span>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingMessageId(null);
                          setMessageText("");
                        }} 
                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {/* Attachments Menu */}
                  {showAttachments && (
                    <div className="absolute bottom-full mb-2 left-3 p-2 glass rounded-2xl border border-border/30 shadow-xl flex flex-col gap-1 z-10 w-48">
                      <button 
                        onClick={() => mediaInputRef.current?.click()}
                        className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-xl transition-colors text-sm"
                      >
                        <ImageIcon className="w-4 h-4 text-blue-400" />
                        Фото или видео
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-xl transition-colors text-sm"
                      >
                        <FileIcon className="w-4 h-4 text-purple-400" />
                        Файл
                      </button>
                    </div>
                  )}
                  
                  {showStickers && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-14 sm:translate-x-0 w-[min(92vw,16rem)] p-3 glass rounded-2xl border border-border/30 shadow-xl grid grid-cols-4 gap-2 z-10">
                      {MOCK_STICKERS.map((sticker, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendMessage('STICKER', null, sticker)}
                          className="p-1 hover:bg-white/10 rounded-xl transition-colors"
                        >
                          <img src={sticker} alt="sticker" className="w-full h-auto object-contain" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => {
                        setShowAttachments(!showAttachments);
                        setShowStickers(false);
                      }}
                      className={`p-2 rounded-xl transition-colors ${showAttachments ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setShowStickers(!showStickers);
                        setShowAttachments(false);
                      }}
                      className={`p-2 rounded-xl transition-colors ${showStickers ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    
                    {/* Hidden Inputs */}
                    <input 
                      type="file" 
                      ref={mediaInputRef} 
                      className="hidden" 
                      accept="image/*,video/*" 
                      onChange={(e) => handleFileUpload(e, 'MEDIA')} 
                    />
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="*" 
                      onChange={(e) => handleFileUpload(e, 'FILE')} 
                    />
                    
                    {isRecording ? (
                      <div className="flex-1 px-3 sm:px-4 py-3 rounded-2xl glass-subtle flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-500 animate-pulse">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-sm font-medium">Запись: {formatDuration(recordingDuration)}</span>
                        </div>
                        <button onClick={stopRecording} className="text-muted-foreground hover:text-foreground">
                          <Square className="w-4 h-4" />
                        </button>
                      </div>
                    ) : isVideoRecording ? (
                      <div className="flex-1 px-3 sm:px-4 py-3 rounded-2xl glass-subtle flex items-center justify-between relative overflow-hidden">
                        <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                        <div className="flex items-center gap-2 text-red-500 z-10">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-sm font-medium">Запись видео: {formatDuration(videoRecordingDuration)}</span>
                        </div>
                        <button onClick={stopVideoRecording} className="text-muted-foreground hover:text-foreground z-10">
                          <Square className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => handleTypingChanged(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage('TEXT')}
                        placeholder="Написать сообщение..."
                        className="flex-1 min-w-0 px-3 sm:px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                      />
                    )}

                    {messageText.trim() ? (
                      <button
                        onClick={() => sendMessage('TEXT')}
                        className="p-3 rounded-2xl btn-gradient"
                      >
                        {editingMessageId ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      </button>
                    ) : (
                      <div className="relative group">
                        <button
                          onPointerDown={(e) => {
                            if (e.button !== 0 && e.button !== -1) return; // Only left click or touch
                            e.preventDefault();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            // Store the time we started pressing
                            e.currentTarget.dataset.pressStartTime = Date.now().toString();
                            
                            // Set a small timeout so a quick tap doesn't start recording
                            timerRef.current = setTimeout(() => {
                              if (recordMode === 'VOICE') startRecording();
                              else startVideoRecording();
                            }, 150);
                          }}
                          onPointerUp={(e) => {
                            e.preventDefault();
                            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                              e.currentTarget.releasePointerCapture(e.pointerId);
                            }
                            if (timerRef.current) {
                              clearTimeout(timerRef.current);
                            }
                            
                            const pressStartTime = parseInt(e.currentTarget.dataset.pressStartTime || '0');
                            const pressDuration = Date.now() - pressStartTime;
                            
                            if (isPressingRef.current) {
                              // It was a long press (recording)
                              if (recordMode === 'VOICE') stopRecording();
                              else stopVideoRecording();
                            } else if (pressDuration < 200) {
                              // It was a short tap, toggle mode
                              setRecordMode(prev => prev === 'VOICE' ? 'VIDEO' : 'VOICE');
                            }
                          }}
                          onPointerCancel={(e) => {
                            e.preventDefault();
                            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                              e.currentTarget.releasePointerCapture(e.pointerId);
                            }
                            if (timerRef.current) {
                              clearTimeout(timerRef.current);
                            }
                            if (isPressingRef.current) {
                              if (recordMode === 'VOICE') stopRecording();
                              else stopVideoRecording();
                            }
                          }}
                          className={`p-3 rounded-2xl transition-all touch-none ${isRecording || isVideoRecording ? 'bg-red-500/20 text-red-500 scale-110' : 'glass hover:bg-white/10'}`}
                          title={`Нажмите для переключения на ${recordMode === 'VOICE' ? 'видео' : 'аудио'}, удерживайте для записи`}
                        >
                          {recordMode === 'VOICE' ? <Mic className="w-4 h-4 pointer-events-none" /> : <Camera className="w-4 h-4 pointer-events-none" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                <MessageCircleIcon />
                <span>Выберите чат</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mini Profile Dialog */}
      <UIDialog open={showMiniProfile} onOpenChange={setShowMiniProfile}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/30 glass-subtle flex flex-col max-h-[85vh]">
          <DialogTitle className="sr-only">Профиль пользователя</DialogTitle>
          <DialogDescription className="sr-only">Краткая информация о пользователе и его медиа-файлы</DialogDescription>
          {miniProfileData && miniProfileView === 'MAIN' && (
            <div className="flex flex-col relative overflow-y-auto hide-scrollbar">
              <button 
                onClick={() => setShowMiniProfile(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              {/* Cover Banner */}
              <div className="h-32 w-full bg-gradient-to-r from-primary/20 to-secondary/20 relative shrink-0">
                {miniProfileData.cover_url && (
                  <img 
                    src={miniProfileData.cover_url} 
                    alt="Cover" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="px-6 pb-6 relative">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full border-4 border-background absolute -top-12 left-6 bg-gradient-subtle flex items-center justify-center overflow-hidden">
                  {miniProfileData.avatar_url ? (
                    <img 
                      src={miniProfileData.avatar_url} 
                      alt={miniProfileData.first_name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-gradient">
                      {miniProfileData.first_name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="mt-14 flex flex-col">
                  <h3 className="text-xl font-bold text-foreground">
                    {miniProfileData.first_name} {miniProfileData.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    @{miniProfileData.username}
                  </p>
                  
                  {miniProfileData.status && (
                    <div className="mt-4 pt-4 border-t border-border/30">
                      <p className="text-sm font-medium text-foreground/80 mb-1">О себе</p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {miniProfileData.status}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Имя пользователя</p>
                      <p className="text-sm font-medium text-primary">
                        @{miniProfileData.username}
                      </p>
                    </div>
                  </div>

                  {/* Media Categories */}
                  <div className="mt-4 pt-4 border-t border-border/30 flex flex-col gap-3">
                    <div 
                      className="flex items-center gap-3 text-sm cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors"
                      onClick={() => setMiniProfileView('MEDIA')}
                    >
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      <span className="flex-1 text-foreground/90">Медиа</span>
                      <span className="text-muted-foreground text-xs font-medium">
                        {messages.filter(m => m.message_type === 'MEDIA').length}
                      </span>
                    </div>
                    
                    <div 
                      className="flex items-center gap-3 text-sm cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors"
                      onClick={() => setMiniProfileView('FILE')}
                    >
                      <FileIcon className="w-5 h-5 text-muted-foreground" />
                      <span className="flex-1 text-foreground/90">Файлы</span>
                      <span className="text-muted-foreground text-xs font-medium">
                        {messages.filter(m => m.message_type === 'FILE').length}
                      </span>
                    </div>

                    <div 
                      className="flex items-center gap-3 text-sm cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors"
                      onClick={() => setMiniProfileView('VOICE')}
                    >
                      <Mic className="w-5 h-5 text-muted-foreground" />
                      <span className="flex-1 text-foreground/90">Голосовые сообщения</span>
                      <span className="text-muted-foreground text-xs font-medium">
                        {messages.filter(m => m.message_type === 'VOICE').length}
                      </span>
                    </div>

                    <div className="pt-2 mt-2 border-t border-border/30">
                      <input 
                        type="file" 
                        ref={wallpaperInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleWallpaperChange} 
                      />
                      <button 
                        onClick={() => wallpaperInputRef.current?.click()}
                        className="w-full flex items-center gap-3 text-sm hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors text-primary"
                      >
                        <ImageIcon2 className="w-5 h-5" />
                        <span className="flex-1 text-left">Изменить обои чата</span>
                      </button>
                      
                      {chatWallpaper && (
                        <button 
                          onClick={removeWallpaper}
                          className="w-full flex items-center gap-3 text-sm hover:bg-red-500/10 p-2 -mx-2 rounded-xl transition-colors text-red-500 mt-1"
                        >
                          <X className="w-5 h-5" />
                          <span className="flex-1 text-left">Сбросить обои</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {miniProfileData && miniProfileView !== 'MAIN' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border/30 glass-subtle sticky top-0 z-10 shrink-0">
                <button onClick={() => setMiniProfileView('MAIN')} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <h3 className="font-semibold text-lg">
                  {miniProfileView === 'MEDIA' ? 'Медиа' : miniProfileView === 'FILE' ? 'Файлы' : 'Голосовые сообщения'}
                </h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1 hide-scrollbar">
                {messages.filter(m => m.message_type === miniProfileView).length === 0 ? (
                  <p className="text-center text-muted-foreground mt-10">Пусто</p>
                ) : miniProfileView === 'MEDIA' ? (
                  <div className="grid grid-cols-3 gap-2">
                    {messages.filter(m => m.message_type === 'MEDIA').map(msg => (
                      <div 
                        key={msg.id} 
                        className="aspect-square rounded-xl overflow-hidden bg-black/20 relative cursor-pointer"
                        onClick={() => {
                          if (!msg.media_url?.startsWith('data:video') && !msg.media_url?.includes('.mp4') && !msg.media_url?.includes('.webm')) {
                            setFullscreenImage(msg.media_url!);
                          }
                        }}
                      >
                        {msg.media_url?.startsWith('data:video') || msg.media_url?.includes('.mp4') || msg.media_url?.includes('.webm') ? (
                          <video src={msg.media_url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={msg.media_url!} alt="media" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : miniProfileView === 'FILE' ? (
                  <div className="flex flex-col gap-3">
                    {messages.filter(m => m.message_type === 'FILE').map(msg => (
                      <a key={msg.id} href={msg.media_url!} download={msg.content_text || 'file'} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors no-underline text-current border border-border/10">
                        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                          <FileIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{msg.content_text || 'Вложенный файл'}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleDateString()}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.filter(m => m.message_type === 'VOICE').map(msg => (
                      <div key={msg.id} className="p-3 rounded-2xl glass border border-border/10 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{msg.sender_id === user?.id ? 'Вы' : miniProfileData?.first_name}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleDateString()}</span>
                        </div>
                        <VoiceMessage url={msg.media_url!} duration={msg.voice_duration!} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </UIDialog>

      {/* Delete Confirmation Dialog */}
      <UIDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
        <DialogContent className="sm:max-w-md p-6 border-border/30 glass-subtle flex flex-col gap-4">
          <DialogTitle className="text-lg font-bold">
            {deleteConfirmation?.type === 'CHAT' ? 'Удалить чат?' : 'Удалить сообщение?'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {deleteConfirmation?.type === 'CHAT' 
              ? `Вы действительно хотите полностью удалить диалог с пользователем ${selectedName}? Это действие необратимо.`
              : 'Вы уверены, что хотите удалить это сообщение?'}
          </DialogDescription>
          <div className="flex gap-3 mt-2 flex-wrap">
            <button 
              onClick={() => setDeleteConfirmation(null)}
              className="flex-1 px-4 py-2.5 rounded-2xl glass hover:bg-white/10 transition-colors text-sm font-medium"
            >
              Отмена
            </button>
            {deleteConfirmation?.type === 'CHAT' ? (
              <button 
                onClick={() => deleteChat()}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-medium"
              >
                Удалить
              </button>
            ) : (
              <>
                <button 
                  onClick={() => deleteConfirmation?.id && deleteMessage(deleteConfirmation.id)}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-medium"
                >
                  Удалить у меня
                </button>
                <button 
                  onClick={() => deleteConfirmation?.id && deleteMessageForEveryone(deleteConfirmation.id)}
                  className="flex-1 px-4 py-2.5 rounded-2xl glass hover:bg-red-500/10 text-red-500 transition-colors text-sm font-medium"
                >
                  Удалить у всех
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </UIDialog>

      {/* Fullscreen Image Dialog */}
      <UIDialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
          <DialogTitle className="sr-only">Просмотр изображения</DialogTitle>
          <DialogDescription className="sr-only">Полноэкранный просмотр выбранного изображения</DialogDescription>
          <button 
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {fullscreenImage && (
            <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
          )}
        </DialogContent>
      </UIDialog>
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
