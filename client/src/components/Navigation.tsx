import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlusCircle, Users, Mic, CreditCard, LogOut, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useLogout, useSubscriptionStatus } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Clients", icon: Users, href: "/clients", requiresSubscription: true },
  { label: "New Meeting", icon: PlusCircle, href: "/new" },
  { label: "Subscription", icon: CreditCard, href: "/subscription" },
  { label: "Templates", icon: FileText, href: "/templates", adminOnly: true },
];

export function Navigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  const logout = useLogout();
  const { hasFullAccess, status } = useSubscriptionStatus();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-slate-200 md:static md:block md:w-64 md:border-r md:border-t-0 md:h-screen md:bg-slate-50">
      <div className="flex flex-col h-full">
        <div className="hidden md:flex items-center gap-3 px-6 py-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-slate-800 flex items-center justify-center shadow-lg shadow-primary/20">
            <Mic className="text-white w-6 h-6" />
          </div>
          <span className="font-display font-bold text-xl text-slate-900 tracking-tight">
            ScribeAI
          </span>
        </div>

        <div className="flex md:flex-col justify-around md:justify-start md:px-4 md:gap-2 p-2 md:py-4">
          {navItems.filter(item => !item.adminOnly || user?.isAdmin).map((item) => {
            const isActive = location === item.href;
            const isLocked = item.requiresSubscription && !hasFullAccess;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-white text-primary shadow-sm md:shadow-md md:shadow-slate-200/50"
                    : "text-slate-500 hover:text-primary hover:bg-white/50",
                  isLocked && "opacity-50"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
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

                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent md:hidden rounded-t-full mx-6" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex flex-col mt-auto p-4 gap-3 border-t border-slate-200/60">
          {user && (
            <div className="px-2">
              <p className="text-sm font-semibold text-slate-900 truncate" data-testid="text-user-name">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate" data-testid="text-user-email">{user.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-slate-500"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
