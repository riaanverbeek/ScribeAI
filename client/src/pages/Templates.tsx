import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, Loader2, Star } from "lucide-react";
import { motion } from "framer-motion";
import type { Template } from "@shared/schema";
import { Switch } from "@/components/ui/switch";

export default function Templates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
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
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete template", description: err.message, variant: "destructive" });
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

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-templates-title">Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage AI summary format templates. Users can select a template to control how the AI structures its analysis.</p>
        </div>

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
                {editingTemplate ? "Update the template details below." : "Define a format prompt that the AI will use to structure meeting summaries."}
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
                  placeholder="e.g. Format the summary as formal meeting minutes with numbered sections: 1. Attendees, 2. Agenda Items, 3. Decisions Made, 4. Action Items with owners and deadlines..."
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

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !templatesList || templatesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-2xl bg-muted/30">
          <FileText className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No templates yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first template to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templatesList.map((tpl, idx) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card data-testid={`card-template-${tpl.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <span data-testid={`text-template-name-${tpl.id}`}>{tpl.name}</span>
                      {tpl.isDefault && (
                        <Badge variant="secondary" className="shrink-0" data-testid={`badge-default-${tpl.id}`}>
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                    {tpl.description && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-template-desc-${tpl.id}`}>{tpl.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(tpl)}
                      data-testid={`button-edit-template-${tpl.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(tpl.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-template-${tpl.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Format Prompt</p>
                    <p className="text-sm whitespace-pre-wrap" data-testid={`text-template-prompt-${tpl.id}`}>{tpl.formatPrompt}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
