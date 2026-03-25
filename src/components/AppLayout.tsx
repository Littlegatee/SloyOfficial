import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-[260px] min-h-screen">
        <div className="max-w-2xl mx-auto py-8 px-6 animate-page-in">
          {children}
        </div>
      </main>
    </div>
  );
}
