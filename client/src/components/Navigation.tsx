import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlusCircle, Users, Mic, CreditCard, LogOut, FileText, Menu, X, ShieldCheck, Settings, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useLogout, useSubscriptionStatus } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";

const navItems = [
  { label: "Sessions", icon: LayoutDashboard, href: "/" },
  { label: "New Session", icon: PlusCircle, href: "/new" },
  { label: "Quick Record", icon: Phone, href: "/quick-record" },
  { label: "Clients", icon: Users, href: "/clients", requiresSubscription: true },
  { label: "Subscription", icon: CreditCard, href: "/subscription" },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Templates", icon: FileText, href: "/templates", adminOnly: true },
  { label: "Superuser", icon: ShieldCheck, href: "/superuser", superuserOnly: true },
];

export function Navigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  const logout = useLogout();
  const { hasFullAccess, status } = useSubscriptionStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { branding } = useTenant();

  const filteredItems = navItems.filter(item => {
    if (item.superuserOnly && !user?.isSuperuser) return false;
    if (item.adminOnly && !user?.isAdmin) return false;
    return true;
  });
  const mobileItems = filteredItems.slice(0, 4);

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[55] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed top-0 left-0 z-[60] w-72 h-[100dvh] bg-slate-50 dark:bg-background border-r transform transition-transform duration-200 ease-in-out md:hidden flex flex-col overflow-hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b shrink-0">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="h-9 w-9 rounded-xl object-contain" data-testid="img-nav-tenant-logo-mobile" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-slate-800 flex items-center justify-center shadow-lg shadow-primary/20">
                <Mic className="text-white w-5 h-5" />
              </div>
            )}
            <span className="font-display font-bold text-lg text-slate-900 dark:text-foreground tracking-tight" data-testid="text-nav-tenant-name-mobile">
              {branding.name}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} data-testid="button-close-mobile-menu">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {filteredItems.map((item) => {
            const isActive = location === item.href;
            const isLocked = item.requiresSubscription && !hasFullAccess;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-white dark:bg-muted text-primary shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-muted/50",
                  isLocked && "opacity-50"
                )}
                data-testid={`nav-mobile-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-accent" : "text-slate-400")} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t shrink-0">
          {user && (
            <div className="px-2 mb-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-foreground truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-slate-500 w-full"
            onClick={() => { logout.mutate(); setMobileMenuOpen(false); }}
            disabled={logout.isPending}
            data-testid="button-logout-mobile"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-background/90 backdrop-blur-lg border-t md:static md:block md:w-64 md:border-r md:border-t-0 md:h-screen md:bg-slate-50 dark:md:bg-background">
        <div className="flex flex-col h-full">
          <div className="hidden md:flex items-center gap-3 px-6 py-8">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="h-10 w-10 rounded-xl object-contain" data-testid="img-nav-tenant-logo" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-slate-800 flex items-center justify-center shadow-lg shadow-primary/20">
                <Mic className="text-white w-6 h-6" />
              </div>
            )}
            <span className="font-display font-bold text-xl text-slate-900 dark:text-foreground tracking-tight" data-testid="text-nav-tenant-name">
              {branding.name}
            </span>
          </div>

          <div className="flex md:flex-col justify-around md:justify-start md:px-4 md:gap-2 p-1 md:py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 rounded-xl text-slate-500 md:hidden no-default-hover-elevate"
              data-testid="button-open-mobile-menu"
            >
              <Menu className="w-6 h-6" />
              <span className="text-[10px] font-medium">More</span>
            </Button>

            {mobileItems.map((item) => {
              const isActive = location === item.href;
              const isLocked = item.requiresSubscription && !hasFullAccess;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col md:flex-row items-center gap-0.5 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "text-primary md:bg-white md:dark:bg-muted md:shadow-md md:shadow-slate-200/50"
                      : "text-slate-500 md:hover:text-primary md:hover:bg-white/50 md:dark:hover:bg-muted/50",
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
                    "text-[10px] md:text-base font-medium md:block",
                    isActive ? "text-primary md:text-slate-900 md:dark:text-foreground" : "text-slate-500 md:text-slate-600"
                  )}>
                    {item.label}
                  </span>

                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent md:hidden rounded-t-full mx-4" />
                  )}
                </Link>
              );
            })}

            {filteredItems.length > 4 && filteredItems.slice(4).map((item) => {
              const isActive = location === item.href;
              const isLocked = item.requiresSubscription && !hasFullAccess;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "hidden md:flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-white dark:bg-muted text-primary shadow-md shadow-slate-200/50"
                      : "text-slate-500 hover:text-primary hover:bg-white/50 dark:hover:bg-muted/50",
                    isLocked && "opacity-50"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isActive ? "text-accent" : "text-slate-400 group-hover:text-primary"
                    )}
                  />
                  <span className={cn(
                    "text-base font-medium",
                    isActive ? "text-slate-900 dark:text-foreground" : "text-slate-600"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex flex-col mt-auto p-4 gap-3 border-t border-slate-200/60">
            {user && (
              <div className="px-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-foreground truncate" data-testid="text-user-name">
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
    </>
  );
}
