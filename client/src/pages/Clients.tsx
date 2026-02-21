import { Link } from "wouter";
import { useClients, useDeleteClient } from "@/hooks/use-clients";
import { format } from "date-fns";
import { Plus, ChevronRight, MoreVertical, Trash2, Users, Building2, Mail, CheckSquare } from "lucide-react";
import { useViewMode } from "@/hooks/use-view-mode";
import { ViewToggle } from "@/components/ViewToggle";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useCreateClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Clients() {
  const { data: clients, isLoading, isError } = useClients();
  const deleteMutation = useDeleteClient();
  const createClientMutation = useCreateClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode("clients-view");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast({ title: "Name Required", description: "Please enter a client name.", variant: "destructive" });
      return;
    }
    try {
      await createClientMutation.mutateAsync({
        name: newClientName.trim(),
        email: newClientEmail.trim() || null,
        company: newClientCompany.trim() || null,
      });
      setNewClientName("");
      setNewClientEmail("");
      setNewClientCompany("");
      setDialogOpen(false);
      toast({ title: "Client Created", description: "New client has been added." });
    } catch (error) {}
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-slate-500">Failed to load clients.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-foreground" data-testid="text-clients-heading">Clients</h1>
            <p className="text-slate-500 mt-1 font-body text-sm sm:text-base">Manage your clients and view their sessions.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="lg"
              className="rounded-xl w-full sm:w-auto"
              data-testid="button-add-client"
            >
              <Plus className="mr-2 w-5 h-5" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="client-name-page">Name *</Label>
                <Input
                  id="client-name-page"
                  placeholder="e.g. John Smith"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  data-testid="input-client-name-page"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email-page">Email</Label>
                <Input
                  id="client-email-page"
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  data-testid="input-client-email-page"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-company-page">Company</Label>
                <Input
                  id="client-company-page"
                  placeholder="e.g. Acme Corp"
                  value={newClientCompany}
                  onChange={(e) => setNewClientCompany(e.target.value)}
                  data-testid="input-client-company-page"
                />
              </div>
              <Button 
                onClick={handleCreateClient}
                disabled={createClientMutation.isPending}
                className="w-full"
                data-testid="button-save-client-page"
              >
                {createClientMutation.isPending ? (
                  <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  "Add Client"
                )}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {clients && clients.length > 0 ? (
        viewMode === "tile" ? (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {clients.map((client) => (
              <motion.div 
                key={client.id} 
                variants={item}
                className="group relative bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-5 sm:p-6 hover-elevate transition-all duration-300"
                data-testid={`card-client-${client.id}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-slate-500" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 -mt-2 text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg cursor-pointer"
                        onClick={() => deleteMutation.mutate(client.id)}
                      >
                        <Trash2 className="mr-2 w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Link href={`/client/${client.id}`}>
                  <div className="block cursor-pointer">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors" data-testid={`text-client-name-${client.id}`}>
                      {client.name}
                    </h3>
                    
                    <div className="flex flex-col gap-2 mt-4 text-sm text-slate-500">
                      {client.company && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {client.company}
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {client.email}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-center gap-4">
                      <span className="flex items-center text-primary font-medium text-sm">
                        View Sessions
                        <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
                <Link href={`/client/${client.id}?tab=tasks`}>
                  <div className="flex items-center text-slate-500 hover:text-primary font-medium text-sm cursor-pointer mt-2 transition-colors" data-testid={`link-client-tasks-${client.id}`}>
                    <CheckSquare className="w-4 h-4 mr-1.5" />
                    View Tasks
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {clients.map((client) => (
              <motion.div
                key={client.id}
                variants={item}
                className="group relative bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border hover-elevate transition-all duration-200"
                data-testid={`row-client-${client.id}`}
              >
                <div className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-muted flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-slate-500" />
                  </div>
                  <Link href={`/client/${client.id}`} className="flex-1 min-w-0" data-testid={`link-client-${client.id}`}>
                    <div className="flex items-center gap-4 cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-foreground truncate group-hover:text-primary transition-colors" data-testid={`text-client-name-${client.id}`}>
                          {client.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                          {client.company && (
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {client.company}
                            </span>
                          )}
                          {client.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{client.email}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                  <Link href={`/client/${client.id}?tab=tasks`}>
                    <Button variant="ghost" size="sm" className="text-slate-500 shrink-0 text-xs" data-testid={`button-list-tasks-${client.id}`}>
                      <CheckSquare className="w-3.5 h-3.5 mr-1" />
                      Tasks
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-400 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg cursor-pointer"
                        onClick={() => deleteMutation.mutate(client.id)}
                      >
                        <Trash2 className="mr-2 w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <Users className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No clients yet</h3>
          <p className="text-slate-500 mt-1 mb-6">Add your first client to get started.</p>
          <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(true)} data-testid="button-add-first-client">
            Add Client
          </Button>
        </div>
      )}
    </div>
  );
}
