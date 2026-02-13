import { useState } from "react";
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
import { Pencil, Trash2, Plus, Users, Briefcase, Calendar, FileText, Shield, ShieldCheck, Tag } from "lucide-react";
import { format } from "date-fns";
import type { SafeUser, Client, Meeting, Template, Role } from "@shared/schema";

type SuperuserUser = SafeUser & { isSuperuser: boolean };

function UsersTab() {
  const { toast } = useToast();
  const { data: users = [], isLoading } = useQuery<SuperuserUser[]>({ queryKey: ["/api/superuser/users"] });
  const [editUser, setEditUser] = useState<SuperuserUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SuperuserUser | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", isAdmin: false, subscriptionStatus: "none" as string });

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
    setEditForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, isAdmin: u.isAdmin, subscriptionStatus: u.subscriptionStatus });
    setEditUser(u);
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading users...</div>;

  return (
    <div className="space-y-3">
      {users.map((u) => (
        <Card key={u.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm" data-testid={`text-user-name-${u.id}`}>{u.firstName} {u.lastName}</span>
                {u.isSuperuser && <Badge variant="default" className="text-[10px]"><ShieldCheck className="w-3 h-3 mr-1" />Superuser</Badge>}
                {u.isAdmin && !u.isSuperuser && <Badge variant="secondary" className="text-[10px]"><Shield className="w-3 h-3 mr-1" />Admin</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate" data-testid={`text-user-email-${u.id}`}>{u.email}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing" ? "default" : "secondary"} className="text-[10px]">
                  {u.subscriptionStatus}
                </Badge>
                {u.createdAt && <span className="text-[10px] text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
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

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading clients...</div>;

  return (
    <div className="space-y-3">
      {clients.length === 0 && <p className="text-sm text-muted-foreground p-4">No clients found.</p>}
      {clients.map((c) => (
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/superuser/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/meetings"] });
      setDeleteMeeting(null);
      toast({ title: "Meeting deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const getUserName = (userId: number | null) => {
    if (!userId) return "Unknown";
    const u = users.find(u => u.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : `User #${userId}`;
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading meetings...</div>;

  return (
    <div className="space-y-3">
      {meetings.length === 0 && <p className="text-sm text-muted-foreground p-4">No meetings found.</p>}
      {meetings.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm" data-testid={`text-meeting-title-${m.id}`}>{m.title}</span>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={m.status === "completed" ? "default" : m.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                  {m.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground">Owner: {getUserName(m.userId)}</span>
                {m.date && <span className="text-[10px] text-muted-foreground">{format(new Date(m.date), "MMM d, yyyy")}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
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
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
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

function TemplatesTab() {
  const { toast } = useToast();
  const { data: templates = [], isLoading } = useQuery<Template[]>({ queryKey: ["/api/superuser/templates"] });
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", formatPrompt: "", isDefault: false });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/superuser/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/templates"] });
      setShowCreate(false);
      setEditForm({ name: "", description: "", formatPrompt: "", isDefault: false });
      toast({ title: "Template created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/superuser/templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/templates"] });
      setEditTemplate(null);
      toast({ title: "Template updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/superuser/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superuser/templates"] });
      setDeleteTemplate(null);
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (t: Template) => {
    setEditForm({ name: t.name, description: t.description || "", formatPrompt: t.formatPrompt, isDefault: t.isDefault });
    setEditTemplate(t);
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditForm({ name: "", description: "", formatPrompt: "", isDefault: false }); setShowCreate(true); }} data-testid="button-create-template">
          <Plus className="w-4 h-4 mr-1" /> New Template
        </Button>
      </div>
      {templates.length === 0 && <p className="text-sm text-muted-foreground p-4">No templates found.</p>}
      {templates.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm" data-testid={`text-template-name-${t.id}`}>{t.name}</span>
                {t.isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
              </div>
              {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-template-${t.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDeleteTemplate(t)} data-testid={`button-delete-template-${t.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showCreate || !!editTemplate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditTemplate(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTemplate ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="input-template-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} data-testid="input-template-description" />
            </div>
            <div>
              <Label>Format Prompt</Label>
              <Textarea value={editForm.formatPrompt} onChange={(e) => setEditForm(f => ({ ...f, formatPrompt: e.target.value }))} rows={4} data-testid="input-template-formatprompt" />
            </div>
            <div className="flex items-center gap-3">
              <Label>Default Template</Label>
              <Select value={editForm.isDefault ? "yes" : "no"} onValueChange={(v) => setEditForm(f => ({ ...f, isDefault: v === "yes" }))}>
                <SelectTrigger className="w-24" data-testid="select-template-default"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditTemplate(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                const payload = { name: editForm.name, description: editForm.description || null, formatPrompt: editForm.formatPrompt, isDefault: editForm.isDefault };
                if (editTemplate) {
                  updateMutation.mutate({ id: editTemplate.id, data: payload });
                } else {
                  createMutation.mutate(payload);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-template"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTemplate?.name}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTemplate && deleteMutation.mutate(deleteTemplate.id)} data-testid="button-confirm-delete-template">
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

export default function SuperuserAdmin() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-superuser-heading">Superuser Panel</h1>
        </div>
        <p className="text-sm text-muted-foreground">Manage all users, clients, meetings, templates, and roles across the platform.</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="w-full grid grid-cols-5 mb-4" data-testid="tabs-superuser">
          <TabsTrigger value="users" className="gap-1" data-testid="tab-users">
            <Users className="w-4 h-4 hidden sm:block" /> Users
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1" data-testid="tab-clients">
            <Briefcase className="w-4 h-4 hidden sm:block" /> Clients
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-1" data-testid="tab-meetings">
            <Calendar className="w-4 h-4 hidden sm:block" /> Meetings
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1" data-testid="tab-templates">
            <FileText className="w-4 h-4 hidden sm:block" /> Templates
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1" data-testid="tab-roles">
            <Tag className="w-4 h-4 hidden sm:block" /> Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="clients"><ClientsTab /></TabsContent>
        <TabsContent value="meetings"><MeetingsTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
