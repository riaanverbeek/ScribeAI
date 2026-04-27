import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus, Users, Briefcase, Calendar, Shield, ShieldCheck, Tag, ArrowLeft, Eye, ChevronRight, Loader2, Building2, Globe, Palette, ArrowUpDown, Languages, MessageSquare, RotateCcw, Save, ChevronDown, ChevronUp, Cpu, CheckCircle, XCircle, AlertTriangle, RefreshCw, Images, Upload } from "lucide-react";
import { format } from "date-fns";
import type { SafeUser, Client, Meeting, Role, Transcript, ActionItem, Topic, MeetingSummary, Tenant, AudioLanguageOption, PromptSetting, SystemSetting, SiteImage } from "@shared/schema";

type SuperuserUser = SafeUser & { isSuperuser: boolean };

type AuditRetry = {
  attemptedAt: string;
  attemptedBy: string;
  result: "ok" | "error";
  detail: string | null;
};
type AuditUser = SuperuserUser & { lastRetry: AuditRetry | null };

type MeetingDetail = Meeting & {
  transcript?: Transcript | null;
  actionItems?: ActionItem[];
  topics?: Topic[];
  summary?: MeetingSummary | null;
};

function UserAccountView({ user, onBack }: { user: SuperuserUser; onBack: () => void }) {
  const [viewingMeeting, setViewingMeeting] = useState<number | null>(null);

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/superuser/meetings", { userId: user.id }],
    queryFn: async () => {
      const res = await fetch(`/api/superuser/meetings?userId=${user.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sessions");
      return res.json();
    },
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/superuser/users", user.id, "clients"],
    queryFn: async () => {
      const res = await fetch(`/api/superuser/users/${user.id}/clients`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
  });

  const { data: meetingDetail, isLoading: detailLoading } = useQuery<MeetingDetail>({
    queryKey: ["/api/superuser/meetings", viewingMeeting],
    queryFn: async () => {
      const res = await fetch(`/api/superuser/meetings/${viewingMeeting}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    enabled: viewingMeeting !== null,
  });

  if (viewingMeeting !== null) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setViewingMeeting(null)} data-testid="button-back-to-user">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to {user.firstName}'s account
        </Button>

        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : meetingDetail ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-meeting-detail-title">{meetingDetail.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={meetingDetail.status === "completed" ? "default" : meetingDetail.status === "failed" ? "destructive" : "secondary"}>
                  {meetingDetail.status}
                </Badge>
                {meetingDetail.date && <span className="text-xs text-muted-foreground">{format(new Date(meetingDetail.date), "MMM d, yyyy 'at' h:mm a")}</span>}
                {meetingDetail.outputLanguage && <Badge variant="outline" className="text-xs">{meetingDetail.outputLanguage === "af" ? "Afrikaans" : "English"}</Badge>}
                {meetingDetail.isInternal && <Badge variant="outline" className="text-xs">Internal</Badge>}
              </div>
            </div>

            {meetingDetail.summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm whitespace-pre-wrap" data-testid="text-meeting-summary">
                    {meetingDetail.summary.content}
                  </div>
                </CardContent>
              </Card>
            )}

            {meetingDetail.transcript && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto" data-testid="text-meeting-transcript">
                    {meetingDetail.transcript.content}
                  </p>
                </CardContent>
              </Card>
            )}

            {meetingDetail.actionItems && meetingDetail.actionItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Action Items ({meetingDetail.actionItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {meetingDetail.actionItems.map((item) => (
                      <li key={item.id} className="text-sm flex items-start gap-2">
                        <Badge variant={item.status === "completed" ? "default" : "secondary"} className="text-[10px] mt-0.5 shrink-0">{item.status}</Badge>
                        <div>
                          <span>{item.content}</span>
                          {item.assignee && <span className="text-muted-foreground ml-1">— {item.assignee}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {meetingDetail.topics && meetingDetail.topics.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Topics ({meetingDetail.topics.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {meetingDetail.topics.map((topic) => (
                      <li key={topic.id} className="text-sm">
                        <span className="font-medium">{topic.title}</span>
                        {topic.relevanceScore !== null && <Badge variant="outline" className="text-[10px] ml-2">{topic.relevanceScore}%</Badge>}
                        {topic.summary && <p className="text-muted-foreground text-xs mt-0.5">{topic.summary}</p>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Session not found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-users">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Users
      </Button>

      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold" data-testid="text-user-account-name">{user.firstName} {user.lastName}</h3>
          {user.isSuperuser && <Badge variant="default" className="text-[10px]"><ShieldCheck className="w-3 h-3 mr-1" />Superuser</Badge>}
          {user.isAdmin && !user.isSuperuser && <Badge variant="secondary" className="text-[10px]"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant={user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing" || user.subscriptionStatus === "lifetime" ? "default" : "secondary"} className="text-[10px]">
            {user.subscriptionStatus === "lifetime" ? "Lifetime Access" : user.subscriptionStatus}
          </Badge>
          {!user.isVerified && <Badge variant="destructive" className="text-[10px]">Unverified</Badge>}
          {user.createdAt && <span className="text-[10px] text-muted-foreground">Joined {format(new Date(user.createdAt), "MMM d, yyyy")}</span>}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> Sessions ({meetings.length})
        </h4>
        {meetingsLoading ? (
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        ) : meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">No sessions found for this user.</p>
        ) : (
          <div className="space-y-1 rounded-lg border overflow-hidden divide-y">
            {meetings.map((m) => (
              <button
                key={m.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setViewingMeeting(m.id)}
                data-testid={`button-view-meeting-${m.id}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{m.title}</span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant={m.status === "completed" ? "default" : m.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                      {m.status}
                    </Badge>
                    {m.date && <span className="text-[10px] text-muted-foreground">{format(new Date(m.date), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Briefcase className="w-4 h-4" /> Clients ({clients.length})
        </h4>
        {clientsLoading ? (
          <p className="text-sm text-muted-foreground">Loading clients...</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">No clients found for this user.</p>
        ) : (
          <div className="space-y-1 rounded-lg border overflow-hidden divide-y">
            {clients.map((c) => (
              <div key={c.id} className="px-3 py-2.5">
                <span className="text-sm font-medium">{c.name}</span>
                {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const { data: users = [], isLoading } = useQuery<SuperuserUser[]>({ queryKey: ["/api/superuser/users"] });
  const [editUser, setEditUser] = useState<SuperuserUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SuperuserUser | null>(null);
  const [viewingUser, setViewingUser] = useState<SuperuserUser | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", isAdmin: false, isSuperuser: false, isVerified: false, subscriptionStatus: "none" as string });
  const [usersSortMode, setUsersSortMode] = useState(() => localStorage.getItem("superuser-users-sort") || "name-az");

  const sortedUsers = useMemo(() => {
    const sorted = [...users];
    switch (usersSortMode) {
      case "name-az":
        sorted.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
        break;
      case "name-za":
        sorted.sort((a, b) => `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`));
        break;
      case "email-az":
        sorted.sort((a, b) => a.email.localeCompare(b.email));
        break;
      case "date-newest":
        sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case "date-oldest":
        sorted.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        break;
      case "subscription":
        sorted.sort((a, b) => a.subscriptionStatus.localeCompare(b.subscriptionStatus));
        break;
      case "verification":
        sorted.sort((a, b) => (a.isVerified === b.isVerified ? 0 : a.isVerified ? 1 : -1));
        break;
    }
    return sorted;
  }, [users, usersSortMode]);

  const handleUsersSortChange = (value: string) => {
    setUsersSortMode(value);
    localStorage.setItem("superuser-users-sort", value);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/superuser/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/users"] });
      setEditUser(null);
      toast({ title: "User updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/superuser/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/users"] });
      setDeleteUser(null);
      toast({ title: "User deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (u: SuperuserUser) => {
    setEditForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, isAdmin: u.isAdmin, isSuperuser: u.isSuperuser, isVerified: u.isVerified, subscriptionStatus: u.subscriptionStatus });
    setEditUser(u);
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading users...</div>;

  if (viewingUser) {
    return <UserAccountView user={viewingUser} onBack={() => setViewingUser(null)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={usersSortMode} onValueChange={handleUsersSortChange}>
          <SelectTrigger className="w-[200px]" data-testid="select-users-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name (A-Z)</SelectItem>
            <SelectItem value="name-za">Name (Z-A)</SelectItem>
            <SelectItem value="email-az">Email (A-Z)</SelectItem>
            <SelectItem value="date-newest">Date joined (newest)</SelectItem>
            <SelectItem value="date-oldest">Date joined (oldest)</SelectItem>
            <SelectItem value="subscription">Subscription status</SelectItem>
            <SelectItem value="verification">Verification status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedUsers.map((u) => (
        <Card key={u.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <button
              className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
              onClick={() => setViewingUser(u)}
              data-testid={`button-view-user-${u.id}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm" data-testid={`text-user-name-${u.id}`}>{u.firstName} {u.lastName}</span>
                {u.isSuperuser && <Badge variant="default" className="text-[10px]"><ShieldCheck className="w-3 h-3 mr-1" />Superuser</Badge>}
                {u.isAdmin && !u.isSuperuser && <Badge variant="secondary" className="text-[10px]"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
                {!u.isVerified && <Badge variant="destructive" className="text-[10px]" data-testid={`badge-unverified-${u.id}`}>Unverified</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate" data-testid={`text-user-email-${u.id}`}>{u.email}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing" || u.subscriptionStatus === "lifetime" ? "default" : "secondary"} className="text-[10px]">
                  {u.subscriptionStatus === "lifetime" ? "Lifetime Access" : u.subscriptionStatus}
                </Badge>
                {u.createdAt && <span className="text-[10px] text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</span>}
              </div>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => setViewingUser(u)} title="View account" data-testid={`button-view-account-${u.id}`}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(u)} disabled={u.isSuperuser} data-testid={`button-edit-user-${u.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteUser(u)} disabled={u.isSuperuser} data-testid={`button-delete-user-${u.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>First Name</Label>
              <Input value={editForm.firstName} onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-edit-user-firstname" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={editForm.lastName} onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-edit-user-lastname" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} data-testid="input-edit-user-email" />
            </div>
            <div className="flex items-center gap-3">
              <Label>Admin</Label>
              <Select value={editForm.isAdmin ? "yes" : "no"} onValueChange={(v) => setEditForm(f => ({ ...f, isAdmin: v === "yes" }))}>
                <SelectTrigger className="w-24" data-testid="select-edit-user-admin"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>Superuser</Label>
              <Select value={editForm.isSuperuser ? "yes" : "no"} onValueChange={(v) => setEditForm(f => ({ ...f, isSuperuser: v === "yes" }))}>
                <SelectTrigger className="w-24" data-testid="select-edit-user-superuser"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>Email Verified</Label>
              <Select value={editForm.isVerified ? "yes" : "no"} onValueChange={(v) => setEditForm(f => ({ ...f, isVerified: v === "yes" }))}>
                <SelectTrigger className="w-24" data-testid="select-edit-user-verified"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subscription Status</Label>
              <Select value={editForm.subscriptionStatus} onValueChange={(v) => setEditForm(f => ({ ...f, subscriptionStatus: v }))}>
                <SelectTrigger data-testid="select-edit-user-subscription"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="lifetime">Lifetime Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={() => editUser && updateMutation.mutate({ id: editUser.id, data: editForm })} disabled={updateMutation.isPending} data-testid="button-save-user">
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteUser?.firstName} {deleteUser?.lastName} ({deleteUser?.email}) and all their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)} data-testid="button-confirm-delete-user">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientsTab() {
  const { toast } = useToast();
  const { data: clients = [], isLoading } = useQuery<Client[]>({ queryKey: ["/api/superuser/clients"] });
  const { data: users = [] } = useQuery<SuperuserUser[]>({ queryKey: ["/api/superuser/users"] });
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", company: "" });
  const [clientsSortMode, setClientsSortMode] = useState(() => localStorage.getItem("superuser-clients-sort") || "name-az");

  const handleClientsSortChange = (value: string) => {
    setClientsSortMode(value);
    localStorage.setItem("superuser-clients-sort", value);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/superuser/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/clients"] });
      setEditClient(null);
      toast({ title: "Client updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/superuser/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/clients"] });
      setDeleteClient(null);
      toast({ title: "Client deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (c: Client) => {
    setEditForm({ name: c.name, email: c.email || "", company: c.company || "" });
    setEditClient(c);
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return "Unknown";
    const u = users.find(u => u.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : `User #${userId}`;
  };

  const sortedClients = useMemo(() => {
    const sorted = [...clients];
    switch (clientsSortMode) {
      case "name-az":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-za":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "company-az":
        sorted.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
        break;
      case "owner-az":
        sorted.sort((a, b) => getUserName(a.userId).localeCompare(getUserName(b.userId)));
        break;
    }
    return sorted;
  }, [clients, clientsSortMode, users]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading clients...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={clientsSortMode} onValueChange={handleClientsSortChange}>
          <SelectTrigger className="w-[200px]" data-testid="select-clients-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name (A-Z)</SelectItem>
            <SelectItem value="name-za">Name (Z-A)</SelectItem>
            <SelectItem value="company-az">Company (A-Z)</SelectItem>
            <SelectItem value="owner-az">Owner (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedClients.length === 0 && <p className="text-sm text-muted-foreground p-4">No clients found.</p>}
      {sortedClients.map((c) => (
        <Card key={c.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm" data-testid={`text-client-name-${c.id}`}>{c.name}</span>
              {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
              {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">Owner: {getUserName(c.userId)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(c)} data-testid={`button-edit-client-${c.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteClient(c)} data-testid={`button-delete-client-${c.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-client-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} data-testid="input-edit-client-email" />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={editForm.company} onChange={(e) => setEditForm(f => ({ ...f, company: e.target.value }))} data-testid="input-edit-client-company" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button onClick={() => editClient && updateMutation.mutate({ id: editClient.id, data: { name: editForm.name, email: editForm.email || null, company: editForm.company || null } })} disabled={updateMutation.isPending} data-testid="button-save-client">
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteClient} onOpenChange={(open) => !open && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteClient?.name}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteClient && deleteMutation.mutate(deleteClient.id)} data-testid="button-confirm-delete-client">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MeetingsTab() {
  const { toast } = useToast();
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({ queryKey: ["/api/superuser/meetings"] });
  const { data: users = [] } = useQuery<SuperuserUser[]>({ queryKey: ["/api/superuser/users"] });
  const [deleteMeeting, setDeleteMeeting] = useState<Meeting | null>(null);
  const [viewingMeeting, setViewingMeeting] = useState<number | null>(null);

  const { data: meetingDetail, isLoading: detailLoading } = useQuery<MeetingDetail>({
    queryKey: ["/api/superuser/meetings", viewingMeeting],
    queryFn: async () => {
      const res = await fetch(`/api/superuser/meetings/${viewingMeeting}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    enabled: viewingMeeting !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/superuser/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/meetings"] });
      setDeleteMeeting(null);
      toast({ title: "Session deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const getUserName = (userId: number | null) => {
    if (!userId) return "Unknown";
    const u = users.find(u => u.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : `User #${userId}`;
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading sessions...</div>;

  if (viewingMeeting !== null) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setViewingMeeting(null)} data-testid="button-back-to-meetings">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Sessions
        </Button>

        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : meetingDetail ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{meetingDetail.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={meetingDetail.status === "completed" ? "default" : meetingDetail.status === "failed" ? "destructive" : "secondary"}>
                  {meetingDetail.status}
                </Badge>
                <span className="text-xs text-muted-foreground">Owner: {getUserName(meetingDetail.userId)}</span>
                {meetingDetail.date && <span className="text-xs text-muted-foreground">{format(new Date(meetingDetail.date), "MMM d, yyyy 'at' h:mm a")}</span>}
              </div>
            </div>

            {meetingDetail.summary && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm whitespace-pre-wrap">{meetingDetail.summary.content}</div>
                </CardContent>
              </Card>
            )}

            {meetingDetail.transcript && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Transcript</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">{meetingDetail.transcript.content}</p>
                </CardContent>
              </Card>
            )}

            {meetingDetail.actionItems && meetingDetail.actionItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Action Items ({meetingDetail.actionItems.length})</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {meetingDetail.actionItems.map((item) => (
                      <li key={item.id} className="text-sm flex items-start gap-2">
                        <Badge variant={item.status === "completed" ? "default" : "secondary"} className="text-[10px] mt-0.5 shrink-0">{item.status}</Badge>
                        <div>
                          <span>{item.content}</span>
                          {item.assignee && <span className="text-muted-foreground ml-1">— {item.assignee}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {meetingDetail.topics && meetingDetail.topics.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Topics ({meetingDetail.topics.length})</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {meetingDetail.topics.map((topic) => (
                      <li key={topic.id} className="text-sm">
                        <span className="font-medium">{topic.title}</span>
                        {topic.relevanceScore !== null && <Badge variant="outline" className="text-[10px] ml-2">{topic.relevanceScore}%</Badge>}
                        {topic.summary && <p className="text-muted-foreground text-xs mt-0.5">{topic.summary}</p>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Session not found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {meetings.length === 0 && <p className="text-sm text-muted-foreground p-4">No sessions found.</p>}
      {meetings.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <button
              className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
              onClick={() => setViewingMeeting(m.id)}
              data-testid={`button-view-meeting-${m.id}`}
            >
              <span className="font-medium text-sm" data-testid={`text-meeting-title-${m.id}`}>{m.title}</span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={m.status === "completed" ? "default" : m.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                  {m.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Owner: {getUserName(m.userId)}</span>
                {m.date && <span className="text-[10px] text-muted-foreground">{format(new Date(m.date), "MMM d, yyyy")}</span>}
              </div>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => setViewingMeeting(m.id)} title="View details" data-testid={`button-view-meeting-detail-${m.id}`}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteMeeting(m)} data-testid={`button-delete-meeting-${m.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!deleteMeeting} onOpenChange={(open) => !open && setDeleteMeeting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteMeeting?.title}" and all its data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMeeting && deleteMutation.mutate(deleteMeeting.id)} data-testid="button-confirm-delete-meeting">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RolesTab() {
  const { toast } = useToast();
  const { data: rolesList = [], isLoading } = useQuery<Role[]>({ queryKey: ["/api/superuser/roles"] });
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [roleName, setRoleName] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", "/api/superuser/roles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setShowCreate(false);
      setRoleName("");
      toast({ title: "Role created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string } }) => {
      const res = await apiRequest("PATCH", `/api/superuser/roles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setEditRole(null);
      setRoleName("");
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/superuser/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setDeleteRole(null);
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (r: Role) => {
    setRoleName(r.name);
    setEditRole(r);
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading roles...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setRoleName(""); setShowCreate(true); }} data-testid="button-create-role">
          <Plus className="w-4 h-4 mr-1" /> New Role
        </Button>
      </div>
      {rolesList.length === 0 && <p className="text-sm text-muted-foreground p-4">No roles found. Create roles for users to select from.</p>}
      {rolesList.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm" data-testid={`text-role-name-${r.id}`}>{r.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)} data-testid={`button-edit-role-${r.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteRole(r)} data-testid={`button-delete-role-${r.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showCreate || !!editRole} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditRole(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRole ? "Edit Role" : "New Role"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role Name</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Project Manager" data-testid="input-role-name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditRole(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (editRole) {
                  updateMutation.mutate({ id: editRole.id, data: { name: roleName } });
                } else {
                  createMutation.mutate({ name: roleName });
                }
              }}
              disabled={!roleName.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-role"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRole} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteRole?.name}". Users with this role will have their role cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRole && deleteMutation.mutate(deleteRole.id)} data-testid="button-confirm-delete-role">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TenantsTab() {
  const { toast } = useToast();
  const { data: tenantsList = [], isLoading } = useQuery<Tenant[]>({ queryKey: ["/api/tenants"] });
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    domain: "",
    logoUrl: "",
    primaryColor: "",
    accentColor: "",
    tagline: "",
    isActive: true,
  });

  const resetForm = () => {
    setForm({ name: "", slug: "", domain: "", logoUrl: "", primaryColor: "", accentColor: "", tagline: "", isActive: true });
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (t: Tenant) => {
    setForm({
      name: t.name,
      slug: t.slug,
      domain: t.domain || "",
      logoUrl: t.logoUrl || "",
      primaryColor: t.primaryColor || "",
      accentColor: t.accentColor || "",
      tagline: t.tagline || "",
      isActive: t.isActive,
    });
    setEditTenant(t);
  };

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/tenants", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Tenant created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/tenants/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setEditTenant(null);
      resetForm();
      toast({ title: "Tenant updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tenants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setDeleteTenant(null);
      toast({ title: "Tenant deactivated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      slug: form.slug,
      domain: form.domain || null,
      logoUrl: form.logoUrl || null,
      primaryColor: form.primaryColor || null,
      accentColor: form.accentColor || null,
      tagline: form.tagline || null,
      isActive: form.isActive,
    };

    if (editTenant) {
      updateMutation.mutate({ id: editTenant.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading tenants...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate} data-testid="button-create-tenant">
          <Plus className="w-4 h-4 mr-1" /> New Tenant
        </Button>
      </div>

      {tenantsList.length === 0 && <p className="text-sm text-muted-foreground p-4">No tenants found.</p>}

      {tenantsList.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm" data-testid={`text-tenant-name-${t.id}`}>{t.name}</span>
                <Badge variant={t.isActive ? "default" : "secondary"} className="text-[10px]" data-testid={`badge-tenant-status-${t.id}`}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground" data-testid={`text-tenant-slug-${t.id}`}>/{t.slug}</span>
                {t.domain && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span data-testid={`text-tenant-domain-${t.id}`}>{t.domain}</span>
                  </span>
                )}
                {(t.primaryColor || t.accentColor) && (
                  <span className="flex items-center gap-1">
                    {t.primaryColor && <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: t.primaryColor }} />}
                    {t.accentColor && <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: t.accentColor }} />}
                  </span>
                )}
              </div>
              {t.tagline && <p className="text-xs text-muted-foreground mt-0.5 truncate" data-testid={`text-tenant-tagline-${t.id}`}>{t.tagline}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-tenant-${t.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteTenant(t)} data-testid={`button-delete-tenant-${t.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showCreate || !!editTenant} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditTenant(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTenant ? "Edit Tenant" : "New Tenant"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Organization name" data-testid="input-tenant-name" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="unique-slug" data-testid="input-tenant-slug" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Used in URLs. Lowercase letters, numbers, and hyphens only.</p>
            </div>
            <div>
              <Label>Custom Domain</Label>
              <Input value={form.domain} onChange={(e) => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="app.example.com (optional)" data-testid="input-tenant-domain" />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={form.logoUrl} onChange={(e) => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://example.com/logo.png (optional)" data-testid="input-tenant-logo-url" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input value={form.primaryColor} onChange={(e) => setForm(f => ({ ...f, primaryColor: e.target.value }))} placeholder="#3b82f6" data-testid="input-tenant-primary-color" />
                  {form.primaryColor && <span className="w-8 h-8 rounded-md border shrink-0" style={{ backgroundColor: form.primaryColor }} />}
                </div>
              </div>
              <div>
                <Label>Accent Color</Label>
                <div className="flex items-center gap-2">
                  <Input value={form.accentColor} onChange={(e) => setForm(f => ({ ...f, accentColor: e.target.value }))} placeholder="#f59e0b" data-testid="input-tenant-accent-color" />
                  {form.accentColor && <span className="w-8 h-8 rounded-md border shrink-0" style={{ backgroundColor: form.accentColor }} />}
                </div>
              </div>
            </div>
            <div>
              <Label>Tagline</Label>
              <Input value={form.tagline} onChange={(e) => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Your meetings, simplified (optional)" data-testid="input-tenant-tagline" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm(f => ({ ...f, isActive: checked }))} data-testid="switch-tenant-active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditTenant(null); resetForm(); }}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.slug.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-tenant"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTenant} onOpenChange={(open) => !open && setDeleteTenant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate "{deleteTenant?.name}". Users under this tenant will no longer be able to access the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTenant && deleteMutation.mutate(deleteTenant.id)} data-testid="button-confirm-delete-tenant">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LanguageOptionsTab() {
  const { toast } = useToast();
  const { data: options = [], isLoading } = useQuery<AudioLanguageOption[]>({ queryKey: ["/api/superuser/audio-language-options"] });
  const [editOpt, setEditOpt] = useState<AudioLanguageOption | null>(null);
  const [deleteOpt, setDeleteOpt] = useState<AudioLanguageOption | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: "", label: "", normalize: false, normalizationPrompt: "" as string | null, sortOrder: 0, isActive: true });

  const resetForm = () => setForm({ code: "", label: "", normalize: false, normalizationPrompt: "", sortOrder: 0, isActive: true });

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const openEdit = (opt: AudioLanguageOption) => {
    setForm({ code: opt.code, label: opt.label, normalize: opt.normalize, normalizationPrompt: opt.normalizationPrompt ?? "", sortOrder: opt.sortOrder, isActive: opt.isActive });
    setEditOpt(opt);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/superuser/audio-language-options", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/audio-language-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audio-language-options"] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Language option created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await apiRequest("PATCH", `/api/superuser/audio-language-options/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/audio-language-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audio-language-options"] });
      setEditOpt(null);
      toast({ title: "Language option updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/superuser/audio-language-options/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/audio-language-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audio-language-options"] });
      setDeleteOpt(null);
      toast({ title: "Language option deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.code.trim() || !form.label.trim()) return;
    const payload = { ...form, sortOrder: Number(form.sortOrder) };
    if (editOpt) {
      updateMutation.mutate({ id: editOpt.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading language options...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Control which audio language options appear in the recording form. Enable normalization to post-process transcripts into pure language via AI.</p>
        <Button size="sm" onClick={openCreate} data-testid="button-create-language-option">
          <Plus className="w-4 h-4 mr-1" /> Add Language
        </Button>
      </div>

      {options.length === 0 && <p className="text-sm text-muted-foreground p-4">No language options found.</p>}

      {options.map((opt) => (
        <Card key={opt.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm" data-testid={`text-lang-label-${opt.id}`}>{opt.label}</span>
                <Badge variant="outline" className="text-[10px] font-mono" data-testid={`badge-lang-code-${opt.id}`}>{opt.code}</Badge>
                <Badge variant={opt.isActive ? "default" : "secondary"} className="text-[10px]" data-testid={`badge-lang-active-${opt.id}`}>
                  {opt.isActive ? "Active" : "Inactive"}
                </Badge>
                {opt.normalize && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400" data-testid={`badge-lang-normalize-${opt.id}`}>
                    Normalize
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Sort order: {opt.sortOrder}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => openEdit(opt)} data-testid={`button-edit-lang-${opt.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteOpt(opt)} data-testid={`button-delete-lang-${opt.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showCreate || !!editOpt} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditOpt(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editOpt ? "Edit Language Option" : "Add Language Option"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Language Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toLowerCase().trim() }))}
                placeholder="e.g. af, en, fr, de, zu"
                data-testid="input-lang-code"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">ISO 639-1 language code (e.g. "af" for Afrikaans, "en" for English). Use "auto" for auto-detect.</p>
            </div>
            <div>
              <Label>Display Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Afrikaans / English (ZA)"
                data-testid="input-lang-label"
              />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                placeholder="0"
                data-testid="input-lang-sort-order"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Lower numbers appear first in the dropdown.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Normalize Transcript</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">When enabled, the AI will post-process the transcript into pure language (e.g. removing code-switching).</p>
              </div>
              <Switch checked={form.normalize} onCheckedChange={(checked) => setForm(f => ({ ...f, normalize: checked }))} data-testid="switch-lang-normalize" />
            </div>
            {form.normalize && (
              <div>
                <Label>Custom Normalization Prompt (optional)</Label>
                <Textarea
                  value={form.normalizationPrompt ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, normalizationPrompt: e.target.value || null }))}
                  placeholder="Leave blank to use the global prompt from the Prompts tab..."
                  className="font-mono text-xs min-h-[100px] resize-y mt-1"
                  data-testid="textarea-lang-normalization-prompt"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Override the global normalization prompt for this language specifically. If blank, the system uses the global normalization prompt from the Prompts tab. Use <code>{"{{languageCode}}"}</code> as a placeholder for this language's ISO code.</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm(f => ({ ...f, isActive: checked }))} data-testid="switch-lang-active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditOpt(null); resetForm(); }}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.code.trim() || !form.label.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-language-option"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOpt} onOpenChange={(open) => !open && setDeleteOpt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Language Option</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteOpt?.label}" from the language list. Users who have selected this language will retain their setting, but it won't appear in the dropdown for new recordings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteOpt && deleteMutation.mutate(deleteOpt.id)} data-testid="button-confirm-delete-lang">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const PROMPT_VAR_HINTS: Record<string, string[]> = {
  "normalization": ["{{languageCode}}"],
  "analysis.core": ["{{outputLanguage}}", "{{clientName}}", "{{detailInstruction}}"],
  "analysis.detail.high": ["{{outputLanguage}}", "{{clientName}}"],
  "analysis.detail.medium": ["{{outputLanguage}}", "{{clientName}}"],
  "analysis.detail.low": ["{{outputLanguage}}", "{{clientName}}"],
  "analysis.summary_format": ["{{outputLanguage}}", "{{clientName}}"],
};

function PromptCard({ prompt, onSave, onReset, isSaving, isResetting }: {
  prompt: PromptSetting;
  onSave: (key: string, value: string) => void;
  onReset: (key: string) => void;
  isSaving: boolean;
  isResetting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editValue, setEditValue] = useState(prompt.value);
  const isDirty = editValue !== prompt.value;
  const isDefault = prompt.value === prompt.defaultValue;
  const vars = PROMPT_VAR_HINTS[prompt.key] || [];

  useEffect(() => { setEditValue(prompt.value); }, [prompt.value]);

  return (
    <Card key={prompt.key} data-testid={`card-prompt-${prompt.key}`}>
      <CardContent className="p-4 space-y-3">
        <div
          className="flex items-start justify-between gap-2 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
          data-testid={`button-toggle-prompt-${prompt.key}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm" data-testid={`text-prompt-label-${prompt.key}`}>{prompt.label}</span>
              {!isDefault && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">Modified</Badge>
              )}
            </div>
            {prompt.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>
            )}
            {vars.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Available variables:</span>
                {vars.map(v => (
                  <Badge key={v} variant="secondary" className="text-[10px] font-mono">{v}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 mt-0.5">
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 pt-1">
            <Textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="font-mono text-xs min-h-[180px] resize-y"
              data-testid={`textarea-prompt-${prompt.key}`}
            />
            <div className="flex items-center gap-2 justify-end flex-wrap">
              {!isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { onReset(prompt.key); setEditValue(prompt.defaultValue); }}
                  disabled={isResetting || isSaving}
                  data-testid={`button-reset-prompt-${prompt.key}`}
                >
                  {isResetting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  Reset to default
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => onSave(prompt.key, editValue)}
                disabled={!isDirty || isSaving || isResetting || editValue.trim().length === 0}
                data-testid={`button-save-prompt-${prompt.key}`}
              >
                {isSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface LlmModelWithAvailability {
  id: string;
  name: string;
  description: string;
  requiresEnvVar: string | null;
  supportsTranscription: boolean;
  supportsAnalysis: boolean;
  available: boolean;
}

function LlmTab() {
  const { toast } = useToast();

  const { data: models = [], isLoading: modelsLoading } = useQuery<LlmModelWithAvailability[]>({
    queryKey: ["/api/superuser/llm-registry"],
  });

  const { data: settings = [], isLoading: settingsLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/superuser/system-settings"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PATCH", `/api/superuser/system-settings/${encodeURIComponent(key)}`, { value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/system-settings"] });
      toast({ title: "Setting saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isLoading = modelsLoading || settingsLoading;

  const getSetting = (key: string) => settings.find(s => s.key === key)?.value ?? "";

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <Card key={i}><CardContent className="p-4 h-20 animate-pulse bg-muted/40 rounded" /></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure which AI models are used for transcription and session analysis. Changes take effect immediately for all new sessions.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Transcription Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Used to convert audio recordings into text.</p>
            <Select
              value={getSetting("transcription_model")}
              onValueChange={(val) => saveMutation.mutate({ key: "transcription_model", value: val })}
              disabled={saveMutation.isPending}
              data-testid="select-transcription-model"
            >
              <SelectTrigger data-testid="trigger-transcription-model">
                <SelectValue placeholder="Select model…" />
              </SelectTrigger>
              <SelectContent>
                {models.map(m => {
                  const disabled = !m.available || !m.supportsTranscription;
                  const reason = !m.supportsTranscription ? "analysis only" : !m.available ? "not configured" : null;
                  return (
                    <SelectItem key={m.id} value={m.id} disabled={disabled} data-testid={`option-transcription-${m.id}`}>
                      <span className="flex items-center gap-2">
                        {!disabled
                          ? <CheckCircle className="w-3 h-3 text-green-500" />
                          : <XCircle className="w-3 h-3 text-muted-foreground" />}
                        {m.name}
                        {reason && <span className="text-xs text-muted-foreground ml-1">({reason})</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Default Analysis Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Used when no template-specific model is set.</p>
            <Select
              value={getSetting("default_analysis_model")}
              onValueChange={(val) => saveMutation.mutate({ key: "default_analysis_model", value: val })}
              disabled={saveMutation.isPending}
              data-testid="select-analysis-model"
            >
              <SelectTrigger data-testid="trigger-analysis-model">
                <SelectValue placeholder="Select model…" />
              </SelectTrigger>
              <SelectContent>
                {models.map(m => {
                  const disabled = !m.available || !m.supportsAnalysis;
                  const reason = !m.supportsAnalysis ? "transcription only" : !m.available ? "not configured" : null;
                  return (
                    <SelectItem key={m.id} value={m.id} disabled={disabled} data-testid={`option-analysis-${m.id}`}>
                      <span className="flex items-center gap-2">
                        {!disabled
                          ? <CheckCircle className="w-3 h-3 text-green-500" />
                          : <XCircle className="w-3 h-3 text-muted-foreground" />}
                        {m.name}
                        {reason && <span className="text-xs text-muted-foreground ml-1">({reason})</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Available Models</h3>
        <div className="space-y-2">
          {models.map(m => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border px-4 py-3" data-testid={`model-row-${m.id}`}>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.available
                  ? <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Available</Badge>
                  : <Badge variant="outline" className="text-muted-foreground text-xs">Not configured</Badge>
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptsTab() {
  const { toast } = useToast();
  const { data: prompts = [], isLoading } = useQuery<PromptSetting[]>({
    queryKey: ["/api/superuser/prompt-settings"],
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [resettingKey, setResettingKey] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PATCH", `/api/superuser/prompt-settings/${encodeURIComponent(key)}`, { value });
      return res.json();
    },
    onMutate: ({ key }) => setSavingKey(key),
    onSettled: () => setSavingKey(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/prompt-settings"] });
      toast({ title: "Prompt saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/superuser/prompt-settings/${encodeURIComponent(key)}/reset`, {});
      return res.json();
    },
    onMutate: (key) => setResettingKey(key),
    onSettled: () => setResettingKey(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/prompt-settings"] });
      toast({ title: "Prompt reset to default" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4 h-16 animate-pulse bg-muted/40 rounded" /></Card>
        ))}
      </div>
    );
  }

  const groups = [
    { title: "Transcript Normalization", keys: ["normalization"] },
    { title: "Analysis Core Prompt", keys: ["analysis.core"] },
    { title: "Detail Level Instructions", keys: ["analysis.detail.high", "analysis.detail.medium", "analysis.detail.low"] },
    { title: "Summary Structure Template", keys: ["analysis.summary_format"] },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Edit the AI prompts used during transcription normalization and meeting analysis. Changes take effect immediately for all new sessions — no deployment needed. Use <code className="text-[10px] bg-muted px-1 rounded">{"{{variable}}"}</code> placeholders where indicated.
      </p>
      {groups.map(group => {
        const groupPrompts = group.keys.map(k => prompts.find(p => p.key === k)).filter(Boolean) as PromptSetting[];
        if (groupPrompts.length === 0) return null;
        return (
          <div key={group.title} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h3>
            {groupPrompts.map(prompt => (
              <PromptCard
                key={prompt.key}
                prompt={prompt}
                onSave={(key, value) => saveMutation.mutate({ key, value })}
                onReset={(key) => resetMutation.mutate(key)}
                isSaving={savingKey === prompt.key && saveMutation.isPending}
                isResetting={resettingKey === prompt.key && resetMutation.isPending}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PayfastAuditTab() {
  const { toast } = useToast();
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryResults, setRetryResults] = useState<Record<number, { ok: boolean; message: string }>>({});

  const { data: auditUsers = [], isLoading, refetch } = useQuery<AuditUser[]>({
    queryKey: ["/api/superuser/payfast-audit"],
    queryFn: async () => {
      const res = await fetch("/api/superuser/payfast-audit", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load audit data");
      return res.json();
    },
  });

  async function retryCancel(userId: number) {
    setRetryingId(userId);
    try {
      const res = await fetch(`/api/superuser/payfast-audit/${userId}/retry-cancel`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (res.ok) {
        setRetryResults(prev => ({ ...prev, [userId]: { ok: true, message: body.message } }));
        toast({ title: "Cancellation confirmed", description: body.message });
      } else {
        setRetryResults(prev => ({ ...prev, [userId]: { ok: false, message: body.detail || body.message } }));
        toast({ title: "Retry failed", description: body.message, variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setRetryResults(prev => ({ ...prev, [userId]: { ok: false, message: msg } }));
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setRetryingId(null);
      refetch();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-payfast-audit-heading">PayFast Billing Reconciliation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Users shown below are marked <strong>cancelled</strong> in our database but still have a PayFast subscription token with no confirming CANCELLED notification from PayFast — meaning PayFast may still be billing them. For each user, retry the PayFast cancellation to confirm it is stopped on PayFast's side. Note: ITN history is only tracked from the time this feature was deployed, so some historically-cancelled users may appear until they are resolved.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-audit">
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : auditUsers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-medium" data-testid="text-audit-clean">No affected users found</p>
            <p className="text-sm text-muted-foreground mt-1">All cancelled users either have no PayFast token or are accounted for.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span data-testid="text-audit-count">{auditUsers.length} user{auditUsers.length !== 1 ? "s" : ""} may still be billed by PayFast</span>
          </div>
          {auditUsers.map(user => {
            const result = retryResults[user.id];
            const lastRetry = user.lastRetry;
            return (
              <Card key={user.id} data-testid={`card-audit-user-${user.id}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-audit-name-${user.id}`}>{user.firstName} {user.lastName}</span>
                        <Badge variant="outline" className="text-xs">{user.email}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Cancelled: {user.cancelledAt ? format(new Date(user.cancelledAt), "MMM d, yyyy") : "—"}</span>
                        <span>Period ends: {user.subscriptionCurrentPeriodEnd ? format(new Date(user.subscriptionCurrentPeriodEnd), "MMM d, yyyy") : "—"}</span>
                        <span className="font-mono truncate max-w-[200px]" data-testid={`text-audit-token-${user.id}`}>Token: {user.payfastToken}</span>
                      </div>
                      {lastRetry && !result && (
                        <div
                          className={`flex items-center gap-1.5 text-xs mt-1 ${lastRetry.result === "ok" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}
                          data-testid={`text-audit-last-retry-${user.id}`}
                        >
                          {lastRetry.result === "ok" ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          <span>
                            Last attempted {format(new Date(lastRetry.attemptedAt), "MMM d, yyyy 'at' HH:mm")} by {lastRetry.attemptedBy}
                            {lastRetry.result === "error" && lastRetry.detail && <> — {lastRetry.detail}</>}
                          </span>
                        </div>
                      )}
                      {result && (
                        <div className={`flex items-center gap-1.5 text-xs mt-1 ${result.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-audit-result-${user.id}`}>
                          {result.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {result.message}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={result?.ok ? "outline" : "default"}
                      disabled={retryingId === user.id || result?.ok === true}
                      onClick={() => retryCancel(user.id)}
                      data-testid={`button-retry-cancel-${user.id}`}
                    >
                      {retryingId === user.id ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Cancelling…</>
                      ) : result?.ok ? (
                        <><CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Confirmed</>
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Cancel</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SECTION_COLORS: Record<string, string> = {
  "Hero": "bg-blue-100 text-blue-700",
  "Features": "bg-purple-100 text-purple-700",
  "Analysis": "bg-amber-100 text-amber-700",
  "How It Works": "bg-green-100 text-green-700",
  "Mobile": "bg-teal-100 text-teal-700",
  "Security": "bg-red-100 text-red-700",
};

function SiteImageCard({ slot, onUploaded }: { slot: SiteImage; onUploaded: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/superuser/site-images/${slot.key}/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      toast({ title: "Image updated", description: `${slot.label} has been replaced.` });
      onUploaded();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sectionClass = SECTION_COLORS[slot.section] ?? "bg-gray-100 text-gray-700";
  const currentUrl = slot.url;

  return (
    <Card className="overflow-hidden" data-testid={`site-image-card-${slot.key}`}>
      <div className="relative h-40 bg-gray-100 border-b">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={slot.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
            <Images className="w-8 h-8" />
            <span className="text-xs">No image yet</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sectionClass}`}>
            {slot.section}
          </span>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm leading-tight">{slot.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{slot.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-md px-2 py-1 font-mono">
            {slot.requiredWidth} × {slot.requiredHeight} px
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid={`button-upload-image-${slot.key}`}
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Upload</>
            )}
          </Button>
        </div>
      </CardContent>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        data-testid={`input-file-${slot.key}`}
      />
    </Card>
  );
}

function SiteImagesTab() {
  const { data: slots = [], isLoading, refetch } = useQuery<SiteImage[]>({
    queryKey: ["/api/superuser/site-images"],
  });

  const grouped = useMemo(() => {
    const map: Record<string, SiteImage[]> = {};
    for (const slot of slots) {
      if (!map[slot.section]) map[slot.section] = [];
      map[slot.section].push(slot);
    }
    return map;
  }, [slots]);

  const handleUploaded = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/landing/images"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Upload images for each section of the public landing page. The required pixel dimensions are shown on each card — upload at exactly that size (or larger with the same aspect ratio) for best results.
      </p>
      {Object.entries(grouped).map(([section, sectionSlots]) => (
        <div key={section}>
          <h3 className="text-base font-semibold mb-3">{section}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectionSlots.map(slot => (
              <SiteImageCard key={slot.key} slot={slot} onUploaded={handleUploaded} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SuperuserAdmin() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-superuser-heading">Superuser Panel</h1>
        </div>
        <p className="text-sm text-muted-foreground">Manage all users, clients, sessions, roles, and tenants across the platform.</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="w-full grid grid-cols-10 mb-4" data-testid="tabs-superuser">
          <TabsTrigger value="users" className="gap-1" data-testid="tab-users">
            <Users className="w-4 h-4 hidden sm:block" /> Users
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1" data-testid="tab-clients">
            <Briefcase className="w-4 h-4 hidden sm:block" /> Clients
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-1" data-testid="tab-meetings">
            <Calendar className="w-4 h-4 hidden sm:block" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1" data-testid="tab-roles">
            <Tag className="w-4 h-4 hidden sm:block" /> Roles
          </TabsTrigger>
          <TabsTrigger value="tenants" className="gap-1" data-testid="tab-tenants">
            <Building2 className="w-4 h-4 hidden sm:block" /> Tenants
          </TabsTrigger>
          <TabsTrigger value="languages" className="gap-1" data-testid="tab-languages">
            <Languages className="w-4 h-4 hidden sm:block" /> Languages
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1" data-testid="tab-prompts">
            <MessageSquare className="w-4 h-4 hidden sm:block" /> Prompts
          </TabsTrigger>
          <TabsTrigger value="llm" className="gap-1" data-testid="tab-llm">
            <Cpu className="w-4 h-4 hidden sm:block" /> LLM
          </TabsTrigger>
          <TabsTrigger value="payfast-audit" className="gap-1" data-testid="tab-payfast-audit">
            <AlertTriangle className="w-4 h-4 hidden sm:block" /> PF Audit
          </TabsTrigger>
          <TabsTrigger value="site-images" className="gap-1" data-testid="tab-site-images">
            <Images className="w-4 h-4 hidden sm:block" /> Images
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="clients"><ClientsTab /></TabsContent>
        <TabsContent value="meetings"><MeetingsTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="tenants"><TenantsTab /></TabsContent>
        <TabsContent value="languages"><LanguageOptionsTab /></TabsContent>
        <TabsContent value="prompts"><PromptsTab /></TabsContent>
        <TabsContent value="llm"><LlmTab /></TabsContent>
        <TabsContent value="payfast-audit"><PayfastAuditTab /></TabsContent>
        <TabsContent value="site-images"><SiteImagesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
