import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Tag, Check, Search, ChevronDown } from "lucide-react";
import type { Role } from "@shared/schema";

function RoleSelector() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({ queryKey: ["/api/roles"] });

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [otherMode, setOtherMode] = useState(false);
  const [customRoleText, setCustomRoleText] = useState(user?.customRole || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentRoleId = user?.roleId ?? null;
  const currentCustomRole = user?.customRole ?? null;
  const hasCustomRole = currentCustomRole !== null && currentCustomRole !== "";
  const currentRoleName = hasCustomRole
    ? `Other: ${currentCustomRole}`
    : roles.find(r => r.id === currentRoleId)?.name || "";

  useEffect(() => {
    if (hasCustomRole) {
      setOtherMode(true);
      setCustomRoleText(currentCustomRole || "");
    }
  }, [hasCustomRole, currentCustomRole]);

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { roleId: number | null; customRole: string | null }) => {
      const res = await apiRequest("PATCH", "/api/users/me/role", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Role updated" });
      setIsOpen(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const noMatchesFound = search.length > 0 && filteredRoles.length === 0;

  const handleSelectRole = (role: Role) => {
    setOtherMode(false);
    setCustomRoleText("");
    updateRoleMutation.mutate({ roleId: role.id, customRole: null });
    setSearch("");
  };

  const handleSelectOther = () => {
    setOtherMode(true);
    setCustomRoleText(search);
    setIsOpen(false);
    setSearch("");
  };

  const handleSaveCustomRole = () => {
    if (!customRoleText.trim()) return;
    updateRoleMutation.mutate({ roleId: null, customRole: customRoleText.trim() });
    setSearch("");
  };

  const handleClearRole = () => {
    updateRoleMutation.mutate({ roleId: null, customRole: null });
    setSearch("");
    setCustomRoleText("");
    setOtherMode(false);
  };

  if (rolesLoading) return <div className="text-sm text-muted-foreground">Loading roles...</div>;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Your Role</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          This tells the AI what your position is when analyzing your meeting recordings.
        </p>
      </div>

      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full rounded-md border border-input bg-background px-3 min-h-9 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="button-role-selector"
        >
          <span className={currentRoleName ? "text-foreground" : "text-muted-foreground"}>
            {currentRoleName || "Select your role..."}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                data-testid="input-role-search"
              />
            </div>

            <div className="max-h-48 overflow-y-auto p-1">
              {filteredRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelectRole(role)}
                  className="flex items-center justify-between w-full rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer"
                  data-testid={`option-role-${role.id}`}
                >
                  <span>{role.name}</span>
                  {currentRoleId === role.id && !hasCustomRole && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}

              {filteredRoles.length === 0 && search.length === 0 && roles.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">No roles available. Type to search or add a custom role.</p>
              )}

              {noMatchesFound && (
                <button
                  type="button"
                  onClick={handleSelectOther}
                  className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer"
                  data-testid="option-role-other"
                >
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <span>Other: "{search}"</span>
                </button>
              )}

              {!noMatchesFound && roles.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setOtherMode(true); setIsOpen(false); setSearch(""); }}
                  className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover-elevate cursor-pointer border-t mt-1 pt-2"
                  data-testid="option-role-other-generic"
                >
                  <Tag className="w-4 h-4" />
                  <span>Other (type your own)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {otherMode && (
        <div className="flex items-center gap-2">
          <Input
            value={customRoleText}
            onChange={(e) => setCustomRoleText(e.target.value)}
            placeholder="Type your custom role..."
            className="flex-1"
            data-testid="input-custom-role"
          />
          <Button
            size="sm"
            onClick={handleSaveCustomRole}
            disabled={!customRoleText.trim() || updateRoleMutation.isPending}
            data-testid="button-save-custom-role"
          >
            {updateRoleMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      )}

      {currentRoleName && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <Tag className="w-3 h-3 mr-1" />
            {currentRoleName}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearRole}
            disabled={updateRoleMutation.isPending}
            className="text-xs text-muted-foreground"
            data-testid="button-clear-role"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-settings-heading">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">Manage your account preferences.</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">First Name</Label>
                <p className="text-sm font-medium" data-testid="text-profile-firstname">{user?.firstName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Last Name</Label>
                <p className="text-sm font-medium" data-testid="text-profile-lastname">{user?.lastName}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium" data-testid="text-profile-email">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Role</CardTitle>
          </CardHeader>
          <CardContent>
            <RoleSelector />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
