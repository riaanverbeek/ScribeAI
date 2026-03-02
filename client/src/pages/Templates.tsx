import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, Loader2, Star, ChevronRight, ArrowUpDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Template } from "@shared/schema";
import { Switch } from "@/components/ui/switch";

export default function Templates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<string>(() => localStorage.getItem("templates-sort") || "name-asc");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formatPrompt, setFormatPrompt] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { data: templatesList, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; formatPrompt: string; isDefault: boolean }) => {
      const res = await apiRequest("POST", "/api/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template created" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create template", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; description?: string | null; formatPrompt?: string; isDefault?: boolean } }) => {
      const res = await apiRequest("PATCH", `/api/templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template updated" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Failed to update template", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted" });
      setDeleteId(null);
      if (expandedId === deleteId) setExpandedId(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete template", description: err.message, variant: "destructive" });
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setFormatPrompt("");
    setIsDefault(false);
    setEditingTemplate(null);
    setDialogOpen(false);
  };

  const openEdit = (template: Template) => {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description || "");
    setFormatPrompt(template.formatPrompt);
    setIsDefault(template.isDefault);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!name.trim() || !formatPrompt.trim()) {
      toast({ title: "Missing fields", description: "Name and format prompt are required.", variant: "destructive" });
      return;
    }
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: { name, description: description || null, formatPrompt, isDefault } });
    } else {
      createMutation.mutate({ name, description, formatPrompt, isDefault });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSortChange = (value: string) => {
    setSortMode(value);
    localStorage.setItem("templates-sort", value);
  };

  const sortedTemplates = useMemo(() => {
    if (!templatesList) return [];
    const list = [...templatesList];
    switch (sortMode) {
      case "name-asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "date-newest":
        return list.sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da;
        });
      case "date-oldest":
        return list.sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return da - db;
        });
      default:
        return list;
    }
  }, [templatesList, sortMode]);

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-templates-title">Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage AI summary format templates.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={sortMode} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px]" data-testid="select-templates-sort">
              <ArrowUpDown className="w-4 h-4 mr-1.5 shrink-0" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="date-newest">Date created (newest)</SelectItem>
              <SelectItem value="date-oldest">Date created (oldest)</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-template">
                <Plus className="w-4 h-4 mr-1.5" />
                New Template
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
              <DialogDescription>
                {editingTemplate ? "Update the template details below." : "Define a format prompt that the AI will use to structure session summaries."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  placeholder="e.g. Formal Minutes"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-desc">Description (optional)</Label>
                <Input
                  id="tpl-desc"
                  placeholder="Brief description of this template"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  data-testid="input-template-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-prompt">Format Prompt</Label>
                <p className="text-xs text-muted-foreground">This is sent to the AI to dictate the format and style of the summary output.</p>
                <Textarea
                  id="tpl-prompt"
                  placeholder="e.g. Format the summary as formal session minutes with numbered sections: 1. Attendees, 2. Agenda Items, 3. Decisions Made, 4. Action Items with owners and deadlines..."
                  value={formatPrompt}
                  onChange={e => setFormatPrompt(e.target.value)}
                  rows={6}
                  data-testid="input-template-prompt"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="tpl-default"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                  data-testid="switch-template-default"
                />
                <Label htmlFor="tpl-default" className="text-sm">Set as default template</Label>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="w-full"
                data-testid="button-save-template"
              >
                {isPending ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Saving...</> : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !sortedTemplates || sortedTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-2xl bg-muted/30">
          <FileText className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No templates yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first template to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden divide-y">
          {sortedTemplates.map((tpl, idx) => {
            const isExpanded = expandedId === tpl.id;
            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                data-testid={`card-template-${tpl.id}`}
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                  data-testid={`button-expand-template-${tpl.id}`}
                >
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  />
                  <span className="font-medium text-sm flex-1 truncate" data-testid={`text-template-name-${tpl.id}`}>
                    {tpl.name}
                  </span>
                  {tpl.isDefault && (
                    <Badge variant="secondary" className="shrink-0 text-xs" data-testid={`badge-default-${tpl.id}`}>
                      <Star className="w-3 h-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 pl-11 space-y-3">
                        {tpl.description && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-template-desc-${tpl.id}`}>
                            {tpl.description}
                          </p>
                        )}
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Format Prompt</p>
                          <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-template-prompt-${tpl.id}`}>
                            {tpl.formatPrompt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openEdit(tpl); }}
                            data-testid={`button-edit-template-${tpl.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(tpl.id); }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-template-${tpl.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
