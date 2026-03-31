import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import { useLocation } from "react-router-dom";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith('/messages');

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="min-h-screen md:ml-[260px]">
        <div
          className={`${isMessagesPage ? 'max-w-5xl' : 'max-w-2xl'} mx-auto animate-page-in transition-all duration-300 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pt-6 md:px-6 md:py-8 md:pb-8`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
