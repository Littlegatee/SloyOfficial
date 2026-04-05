import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Music, Disc3, ListMusic, Upload, Trash2, Plus, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Share2, Pin, PinOff, Download, MoreVertical } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { AppLocale } from "@/i18n/translations";
import { useSearchParams } from "react-router-dom";
import BlurImage from "@/components/BlurImage";
import { useMusic, type Track } from "@/contexts/MusicContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MusicPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t, locale, setLocale, localeLabels } = useI18n();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    repeatMode,
    shuffleOn,
    playTrack,
    togglePlay,
    playNext,
    playPrev,
    seek,
    setRepeatMode,
    setShuffleOn,
  } = useMusic();

  const [tab, setTab] = useState<"tracks" | "albums" | "playlists">("tracks");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [searchParams] = useSearchParams();
  const initialTrackId = searchParams.get("trackId");

  const pinnedTrackId = profile?.pinned_track_id ?? null;

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${String(ss).padStart(2, "0")}`;
  };

  const cycleRepeat = () => {
    setRepeatMode(repeatMode === "none" ? "one" : repeatMode === "one" ? "all" : "none");
  };

  const togglePin = async (track: Track) => {
    if (!user) return;
    if (track.visibility !== "PUBLIC") {
      toast.error("Закреплять можно только PUBLIC треки");
      return;
    }
    const next = pinnedTrackId === track.id ? null : track.id;
    try {
      await api.put(`/profiles/${user.id}`, { pinned_track_id: next });
      await refreshProfile();
      toast.success(next ? "Трек закреплён" : "Закреп снят");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Не удалось изменить закреп");
    }
  };

  const shareTrack = async (track: Track) => {
    const url = `${window.location.origin}/music?trackId=${track.id}`;
    const text = `🎵 ${track.title}${track.artist ? ` — ${track.artist}` : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: track.title, text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
      } else {
        toast.info("Поделиться не поддерживается. Скопируйте ссылку вручную.");
      }
    } catch {
      // user cancelled or share failed
    }
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tr, al, pl] = await Promise.all([
        api.get("/music/tracks").catch(() => ({ data: [] })),
        api.get("/music/albums").catch(() => ({ data: [] })),
        api.get("/music/playlists").catch(() => ({ data: [] })),
      ]);
      setTracks(tr.data || []);
      setAlbums(al.data || []);
      setPlaylists(pl.data || []);
    } catch {
      toast.error("Не удалось загрузить музыку");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (user) refreshProfile();
  }, [user]); // refreshProfile added to context, calling here once

  // Pick initial track from deep link
  useEffect(() => {
    if (!tracks.length) return;
    if (initialTrackId && !currentTrack) {
      const found = tracks.find((t) => t.id === initialTrackId);
      if (found) playTrack(found, tracks);
    }
  }, [tracks, initialTrackId, currentTrack, playTrack]);

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleUpload = async () => {
    if (!pendingAudio || !title.trim()) {
      toast.error("Выберите файл и название");
      return;
    }
    setUploading(true);
    try {
      await api.post("/music/tracks", {
        title: title.trim(),
        artist: artist.trim() || null,
        file_url: pendingAudio,
        cover_url: pendingCover,
        visibility,
      });
      toast.success("Трек добавлен");
      setUploadOpen(false);
      setTitle("");
      setArtist("");
      setPendingAudio(null);
      setPendingCover(null);
      if (audioInputRef.current) audioInputRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const removeTrack = async (id: string) => {
    if (!confirm("Удалить трек?")) return;
    try {
      await api.delete(`/music/tracks/${id}`);
      await load();
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const createAlbum = async () => {
    const name = prompt("Название альбома");
    if (!name?.trim()) return;
    try {
      await api.post("/music/albums", { title: name.trim() });
      toast.success("Альбом создан");
      await load();
    } catch {
      toast.error("Ошибка");
    }
  };

  const createPlaylist = async () => {
    const name = prompt("Название плейлиста");
    if (!name?.trim()) return;
    try {
      await api.post("/music/playlists", { title: name.trim(), is_public: false });
      toast.success("Плейлист создан");
      await load();
    } catch {
      toast.error("Ошибка");
    }
  };

  const addTrackToAlbum = async (albumId: string) => {
    const tid = prompt("ID трека (из списка треков)");
    if (!tid?.trim()) return;
    try {
      await api.post(`/music/albums/${albumId}/tracks`, { track_id: tid.trim() });
      toast.success("Добавлено");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Ошибка");
    }
  };

  const addTrackToPlaylist = async (plId: string) => {
    const tid = prompt("ID трека");
    if (!tid?.trim()) return;
    try {
      await api.post(`/music/playlists/${plId}/tracks`, { track_id: tid.trim() });
      toast.success("Добавлено");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Ошибка");
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-7 h-7 text-primary" />
          {t("music.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground sr-only">Locale</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as AppLocale)}
            className="px-3 py-2 rounded-xl glass text-xs bg-background border border-border"
          >
            {(Object.keys(localeLabels) as AppLocale[]).map((loc) => (
              <option key={loc} value={loc}>
                {localeLabels[loc]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl btn-gradient text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            {t("music.upload")}
          </button>
        </div>
      </div>

      {currentTrack ? (
        <div className="mb-6 glass rounded-2xl p-4 space-y-3 border border-border/20 shadow-lg">
          <div className="flex items-center gap-3">
            {currentTrack.cover_url ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted">
                <BlurImage src={currentTrack.cover_url} alt="Обложка" className="w-full h-full" objectFit="cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                <Music className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{currentTrack.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist || "—"}</p>
              {pinnedTrackId === currentTrack.id ? (
                <p className="text-[10px] text-primary mt-1 font-medium">Закреплённый трек</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={playPrev}
                className="p-2 rounded-xl bg-accent hover:bg-accent/70 text-foreground"
                title="Предыдущий"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 rounded-xl btn-gradient text-white shadow-md shadow-primary/20"
                title="Play"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={playNext}
                className="p-2 rounded-xl bg-accent hover:bg-accent/70 text-foreground"
                title="Следующий"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full h-1.5 flex items-center group/slider">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime || 0}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full h-1 bg-accent/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-100" 
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <div 
                className="absolute w-3 h-3 bg-white rounded-full shadow-md border border-primary/20 pointer-events-none transition-all"
                style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 6px)` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap min-w-[65px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShuffleOn(!shuffleOn)}
              className={`p-2 rounded-xl ${shuffleOn ? "bg-primary/10 text-primary" : "bg-accent hover:bg-accent/70 text-foreground"}`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              className={`p-2 rounded-xl ${repeatMode !== "none" ? "bg-primary/10 text-primary" : "bg-accent hover:bg-accent/70 text-foreground"}`}
              title="Repeat"
            >
              {repeatMode === "one" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => togglePin(currentTrack)}
              className="p-2 rounded-xl bg-accent hover:bg-accent/70 text-foreground"
              title="Pin"
            >
              {pinnedTrackId === currentTrack.id ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => shareTrack(currentTrack)}
              className="p-2 rounded-xl bg-accent hover:bg-accent/70 text-foreground"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 mb-6">
        {(
          [
            ["tracks", "music.tracks", Music],
            ["albums", "music.albums", Disc3],
            ["playlists", "music.playlists", ListMusic],
          ] as const
        ).map(([id, key, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
              tab === id ? "btn-gradient" : "glass text-muted-foreground border border-border/10"
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(key)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {tab === "tracks" && (
            <div className="space-y-2">
              {tracks.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("music.empty")}</p>
              ) : (
                tracks.map((tr) => (
                  <div
                    key={tr.id}
                    onClick={() => {
                      if (currentTrack?.id === tr.id) togglePlay();
                      else playTrack(tr, tracks);
                    }}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group hover:bg-accent/50 border ${
                      currentTrack?.id === tr.id ? "bg-accent/30 border-primary/30 shadow-sm" : "border-border/10 bg-card/20"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {tr.cover_url ? (
                        <BlurImage
                          src={tr.cover_url}
                          alt=""
                          className="w-12 h-12 rounded-lg overflow-hidden"
                          objectFit="cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border/10">
                          <Music className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      {currentTrack?.id === tr.id && isPlaying && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
                          <div className="flex gap-0.5 items-end h-4">
                            <div className="w-1 bg-white animate-[music-bar_0.6s_ease-in-out_infinite]" />
                            <div className="w-1 bg-white animate-[music-bar_0.8s_ease-in-out_infinite]" />
                            <div className="w-1 bg-white animate-[music-bar_0.7s_ease-in-out_infinite]" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${currentTrack?.id === tr.id ? "text-primary" : ""}`}>
                        {tr.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{tr.artist || "—"}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={tr.file_url}
                        download={`${tr.artist || "Unknown"} - ${tr.title}.mp3`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                        title="Скачать"
                      >
                        <Download className="w-4 h-4 text-green-500" />
                      </a>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => shareTrack(tr)}>
                            <Share2 className="w-4 h-4 mr-2" /> Поделиться
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePin(tr)}>
                            {pinnedTrackId === tr.id ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                            {pinnedTrackId === tr.id ? "Открепить" : "Закрепить в профиле"}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => removeTrack(tr.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "albums" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={createAlbum}
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-sm"
              >
                <Plus className="w-4 h-4" />
                {t("music.createAlbum")}
              </button>
              {albums.map((a) => (
                <div key={a.id} className="glass rounded-2xl p-4 border border-border/10">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground">id: {a.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addTrackToAlbum(a.id)}
                      className="text-xs text-primary"
                    >
                      {t("music.addToAlbum")}
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(a.tracks || []).map((row: any) => (
                      <li key={row.id}>
                        {row.track?.title} — {row.track?.artist || "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === "playlists" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={createPlaylist}
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-sm"
              >
                <Plus className="w-4 h-4" />
                {t("music.createPlaylist")}
              </button>
              {playlists.map((p) => (
                <div key={p.id} className="glass rounded-2xl p-4 border border-border/10">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground">id: {p.id}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addTrackToPlaylist(p.id)}
                      className="text-xs text-primary"
                    >
                      {t("music.addToPlaylist")}
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(p.tracks || []).map((row: any) => (
                      <li key={row.id}>
                        {row.track?.title} — {row.track?.artist || "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 border border-border shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">{t("music.upload")}</h3>
            <input
              type="file"
              accept="audio/*"
              ref={audioInputRef}
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 45 * 1024 * 1024) {
                  toast.error("Файл больше 45 МБ");
                  return;
                }
                setPendingAudio(await readFile(f));
              }}
            />
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="w-full py-3 rounded-2xl glass text-sm"
            >
              {pendingAudio ? "Аудио выбрано" : "Выбрать файл с устройства"}
            </button>
            <input
              type="file"
              accept="image/*"
              ref={coverRef}
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setPendingCover(await readFile(f));
              }}
            />
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="w-full py-2 rounded-xl glass text-xs text-muted-foreground"
            >
              {t("music.cover")} (необязательно)
            </button>
            <div>
              <label className="text-xs text-muted-foreground">{t("music.titleLabel")}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 px-4 py-2 rounded-xl bg-background border border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("music.artist")}</label>
              <input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full mt-1 px-4 py-2 rounded-xl bg-background border border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("music.visibility")}</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "PRIVATE" | "PUBLIC")}
                className="w-full mt-1 px-4 py-2 rounded-xl bg-background border border-border"
              >
                <option value="PRIVATE">{t("music.private")}</option>
                <option value="PUBLIC">{t("music.public")}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="flex-1 py-3 rounded-2xl glass"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={handleUpload}
                className="flex-1 py-3 rounded-2xl btn-gradient disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
