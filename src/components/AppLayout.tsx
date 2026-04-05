import { ReactNode, useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import { useLocation, useNavigate } from "react-router-dom";
import PwaInstallPrompt from "./PwaInstallPrompt";
import NetworkQualityBanner from "./NetworkQualityBanner";
import PushFallbackHint from "./PushFallbackHint";
import { ChevronRight, Play, Pause, X, Music } from "lucide-react";
import { useMusic } from "@/contexts/MusicContext";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentTrack, isPlaying, togglePlay } = useMusic();
  const isMessagesPage = location.pathname.startsWith('/messages');
  const isMusicPage = location.pathname === '/music';
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === null) return true; // Default to collapsed on desktop
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(isSidebarCollapsed));
    window.dispatchEvent(new Event('sidebar_state_changed'));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    // Automatically collapse sidebar when navigating on desktop
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarCollapsed(true);
      }
    };
    
    // Collapse once on mount if on desktop
    handleResize();
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background relative pb-20 md:pb-0">
      <AppSidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      
      {isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="fixed left-0 top-[15%] z-[60] w-6 h-20 flex items-center justify-center rounded-r-xl bg-primary/20 hover:bg-primary/40 text-primary backdrop-blur-md border border-l-0 border-primary/20 shadow-lg transition-all hidden md:flex group"
          title="Открыть панель"
        >
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      <main className={`min-h-screen transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-0' : 'md:ml-[260px]'}`}>
        <div
          className={`${isMessagesPage ? 'max-w-7xl' : 'max-w-5xl'} mx-auto animate-page-in transition-all duration-300 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pt-6 md:px-6 md:py-8 md:pb-8`}
        >
          <PwaInstallPrompt />
          <NetworkQualityBanner />
          <PushFallbackHint />
          {children}
        </div>
      </main>

      {/* Mini Music Player */}
      {currentTrack && !isMusicPage && (
        <div 
          onClick={() => navigate(`/music?trackId=${currentTrack.id}`)}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-72 z-50 glass rounded-2xl p-3 border border-border/20 shadow-2xl animate-in slide-in-from-bottom-5 cursor-pointer hover:border-primary/30 transition-all flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
            {currentTrack.cover_url ? (
              <img src={currentTrack.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{currentTrack.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{currentTrack.artist || "—"}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="p-2 rounded-xl btn-gradient text-white shadow-md shadow-primary/20"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
