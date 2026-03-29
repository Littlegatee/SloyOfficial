import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import { useLocation } from "react-router-dom";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith('/messages');

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-[260px] min-h-screen">
        <div className={`${isMessagesPage ? 'max-w-5xl' : 'max-w-2xl'} mx-auto py-8 px-6 animate-page-in transition-all duration-300`}>
          {children}
        </div>
      </main>
    </div>
  );
}
