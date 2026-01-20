import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlusCircle, Settings, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "New Meeting", icon: PlusCircle, href: "/new" },
];

export function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-slate-200 md:static md:block md:w-64 md:border-r md:border-t-0 md:h-screen md:bg-slate-50">
      <div className="flex flex-col h-full">
        {/* Logo Area - Hidden on mobile, visible on desktop */}
        <div className="hidden md:flex items-center gap-3 px-6 py-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-slate-800 flex items-center justify-center shadow-lg shadow-primary/20">
            <Mic className="text-white w-6 h-6" />
          </div>
          <span className="font-display font-bold text-xl text-slate-900 tracking-tight">
            ScribeAI
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex md:flex-col justify-around md:justify-start md:px-4 md:gap-2 p-2 md:py-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-white text-primary shadow-sm md:shadow-md md:shadow-slate-200/50"
                    : "text-slate-500 hover:text-primary hover:bg-white/50"
                )}
              >
                <item.icon
                  className={cn(
                    "w-6 h-6 md:w-5 md:h-5 transition-colors",
                    isActive ? "text-accent" : "text-slate-400 group-hover:text-primary"
                  )}
                />
                <span className={cn(
                  "hidden md:block font-medium",
                  isActive ? "text-slate-900" : "text-slate-600"
                )}>
                  {item.label}
                </span>
                
                {/* Mobile Active Indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent md:hidden rounded-t-full mx-6" />
                )}
              </Link>
            );
          })}
        </div>
        
        {/* Desktop Footer Info */}
        <div className="hidden md:flex mt-auto p-6 border-t border-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <Settings className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Workspace</p>
              <p className="text-xs text-slate-500">Pro Plan</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
