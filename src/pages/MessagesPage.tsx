import { useState, useEffect, useRef } from "react";
import { Send, ArrowLeft, Loader2, Mic, Square, Smile, Play, Pause, Search, X, Paperclip, FileIcon, ImageIcon, VideoIcon, Camera, Image as ImageIcon2, Trash2, Edit2, Check } from "lucide-react";
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
  created_at: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    try {
      const { data } = await api.get("/messages/dialogs");
      if (data) {
        const formattedDialogs = data.map((d: any) => ({
          ...d,
          time: new Date(d.time).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        }));
        setDialogs(formattedDialogs);
        
        // Handle init user chat from URL
        const initUserId = searchParams.get("userId");
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
    } catch (error) {
      console.error("Error fetching dialogs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDialogs();
  }, [user]);

  const openChat = async (userId: string, name: string, avatar?: string | null) => {
    // Clear current messages immediately to avoid showing old chat content
    setMessages([]);
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
      const { data } = await api.get(`/messages/${userId}`);
      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      fetchDialogs(); // Refresh to clear unread counts
    } catch (error) {
      console.error("Error opening chat:", error);
    }
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
        }
        return;
      }

      const { data } = await api.post("/messages", {
        recipient_id: selectedUserId,
        message_type: type,
        content_text: textToSend,
        media_url: mediaUrl,
        voice_duration: voiceDuration,
      });
      if (data) {
        setMessages(prev => [...prev, data]);
        if (type === 'TEXT') setMessageText("");
        setShowStickers(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.response?.data?.error || "Ошибка при отправке сообщения");
    }
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, type: 'MESSAGE' | 'CHAT' } | null>(null);

  const deleteMessage = async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      fetchDialogs();
      setDeleteConfirmation(null);
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Не удалось удалить сообщение");
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
    socket.on('message_deleted', (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      fetchDialogs();
    });
    socket.on('chat_deleted', (deletedByUserId: string) => {
      if (selectedUserId === deletedByUserId) {
        setSelectedUserId(null);
        toast.info("Чат был удален собеседником");
      }
      fetchDialogs();
    });

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_edited');
      socket.off('message_deleted');
      socket.off('chat_deleted');
    };
  }, [user, selectedUserId]);

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
    return (
      <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? 'right-full mr-3' : 'left-full ml-3'} opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 z-20`}>
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

  return (
    <AppLayout>
      <h2 className="text-2xl font-bold mb-6">Сообщения</h2>

      <div className="glass rounded-3xl overflow-hidden shadow-sm" style={{ height: "calc(100vh - 140px)", minHeight: "500px" }}>
        <div className="flex h-full">
          {/* Dialog List */}
          <div className={`w-full md:w-[350px] border-r border-border/30 flex flex-col ${selectedUserId ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 border-b border-border/30 relative">
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
              ) : dialogs.filter(d => 
                d.first_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                d.username?.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-xs">Нет диалогов</div>
              ) : (
                <div className="divide-y divide-border/20">
                  {dialogs
                    .filter(d => 
                      d.first_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      d.username?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(dialog => (
                    <button
                      key={dialog.userId}
                      onClick={() => openChat(dialog.userId, dialog.first_name, dialog.avatar_url)}
                      className={`w-full flex items-center gap-3 p-3.5 text-left transition-all ${
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
                <div className="flex items-center gap-3 p-4 border-b border-border/30 glass-subtle shrink-0">
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
                      <p className="text-[10px] text-green-500 font-medium">онлайн</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDeleteConfirmation({ id: selectedUserId, type: 'CHAT' })}
                    className="ml-auto p-2 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Удалить чат"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 hide-scrollbar relative flex flex-col">
                  {/* Messages container that pushes content to bottom if it's short */}
                  <div className="flex-1 min-h-min flex flex-col justify-end">
                    <div className="space-y-2">
                      {messages.map(msg => {
                        const isMine = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                            <div className="relative group max-w-[75%]">
                              <MessageActions msg={msg} isMine={isMine} />
                              <div className={`px-4 py-2.5 text-sm ${
                                msg.message_type === 'STICKER' || msg.message_type === 'MEDIA' || msg.message_type === 'VIDEO_CIRCLE' ? "bg-transparent p-0" :
                                isMine
                                  ? "btn-gradient rounded-2xl rounded-br-lg shadow-none text-white"
                                  : "glass rounded-2xl rounded-bl-lg"
                              }`}>
                                {msg.message_type === 'TEXT' && (
                                  <div className="flex flex-col gap-0.5">
                                    <span>{msg.content_text}</span>
                                    {msg.is_edited && (
                                      <span className={`text-[10px] self-end ${isMine ? 'text-white/70' : 'text-muted-foreground'}`}>изменено</span>
                                    )}
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
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </div>

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

                <div className="p-3 border-t border-border/30 relative shrink-0">
                  {editingMessageId && (
                    <div className="absolute bottom-full left-0 right-0 p-2.5 bg-accent/50 backdrop-blur-md border-t border-border/30 flex items-center justify-between px-6 animate-in slide-in-from-bottom-2 z-20">
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
                    <div className="absolute bottom-full mb-2 left-14 w-64 p-3 glass rounded-2xl border border-border/30 shadow-xl grid grid-cols-4 gap-2 z-10">
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
                  <div className="flex items-center gap-2">
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
                      <div className="flex-1 px-4 py-3 rounded-2xl glass-subtle flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-500 animate-pulse">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-sm font-medium">Запись: {formatDuration(recordingDuration)}</span>
                        </div>
                        <button onClick={stopRecording} className="text-muted-foreground hover:text-foreground">
                          <Square className="w-4 h-4" />
                        </button>
                      </div>
                    ) : isVideoRecording ? (
                      <div className="flex-1 px-4 py-3 rounded-2xl glass-subtle flex items-center justify-between relative overflow-hidden">
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
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage('TEXT')}
                        placeholder="Написать сообщение..."
                        className="flex-1 px-4 py-3 rounded-2xl glass-subtle text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
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
                              recordMode === 'VOICE' ? startRecording() : startVideoRecording();
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
                              recordMode === 'VOICE' ? stopRecording() : stopVideoRecording();
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
                              recordMode === 'VOICE' ? stopRecording() : stopVideoRecording();
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
          <div className="flex gap-3 mt-2">
            <button 
              onClick={() => setDeleteConfirmation(null)}
              className="flex-1 px-4 py-2.5 rounded-2xl glass hover:bg-white/10 transition-colors text-sm font-medium"
            >
              Отмена
            </button>
            <button 
              onClick={() => {
                if (deleteConfirmation?.type === 'CHAT') {
                  deleteChat();
                } else if (deleteConfirmation?.id) {
                  deleteMessage(deleteConfirmation.id);
                }
              }}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-medium"
            >
              Удалить
            </button>
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
