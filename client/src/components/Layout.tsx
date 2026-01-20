import { ReactNode } from "react";
import { Navigation } from "./Navigation";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar Navigation */}
      <Navigation />
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar pb-24 md:pb-0">
        {children}
      </main>
    </div>
  );
}
