import { ReactNode, useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import { useLocation } from "react-router-dom";
import PwaInstallPrompt from "./PwaInstallPrompt";
import NetworkQualityBanner from "./NetworkQualityBanner";
import PushFallbackHint from "./PushFallbackHint";
import { ChevronRight } from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith('/messages');
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
    <div className="min-h-screen bg-background">
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
          className={`${isMessagesPage ? 'max-w-5xl' : 'max-w-2xl'} mx-auto animate-page-in transition-all duration-300 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pt-6 md:px-6 md:py-8 md:pb-8`}
        >
          <PwaInstallPrompt />
          <NetworkQualityBanner />
          <PushFallbackHint />
          {children}
        </div>
      </main>
    </div>
  );
}
