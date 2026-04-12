import { ReactNode } from "react";
import { Navigation } from "./Navigation";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen w-full max-w-full bg-background overflow-hidden">
      {/* Sidebar Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden relative custom-scrollbar pb-24 md:pb-0">
        {children}
      </main>
    </div>
  );
}
