import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useMeeting, useUpdateMeetingClient } from "@/hooks/use-meetings";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { useSubscriptionStatus } from "@/hooks/use-auth";
import { useRoute, Link } from "wouter";
import { ChevronLeft, Calendar, User, LayoutList, FileText, CheckSquare, Sparkles, Users, Plus, Loader2, X, Pencil, Lock, CreditCard, Paperclip, MessageSquareText, RefreshCw, Copy, Check, Download, Mail, Globe, Shield } from "lucide-react";
import type { Template, Policy } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

function formatSummaryContent(content: string): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return jsonToMarkdown(parsed);
    } catch {
      return content;
    }
  }
  return content;
}

function jsonToMarkdown(obj: any, depth: number = 2): string {
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object" || obj === null) return String(obj);

  let md = "";
  const heading = "#".repeat(Math.min(depth, 4));

  for (const [key, value] of Object.entries(obj)) {
    const title = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();

    if (typeof value === "string") {
      md += `${heading} ${title}\n\n${value}\n\n`;
    } else if (Array.isArray(value)) {
      md += `${heading} ${title}\n\n`;
      for (const item of value) {
        if (typeof item === "string") {
          md += `- ${item}\n`;
        } else if (typeof item === "object" && item !== null) {
          const parts = Object.entries(item).map(
            ([k, v]) => `**${k.replace(/([A-Z])/g, " $1").trim()}**: ${v}`
          );
          md += `- ${parts.join(" | ")}\n`;
        }
      }
      md += "\n";
    } else if (typeof value === "object" && value !== null) {
      md += `${heading} ${title}\n\n`;
      md += jsonToMarkdown(value, depth + 1);
    } else {
      md += `${heading} ${title}\n\n${String(value)}\n\n`;
    }
  }
  return md;
}

function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      toast({ title: `${label} copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export default function MeetingDetail() {
  const [, params] = useRoute("/meeting/:id");
  const id = params ? parseInt(params.id) : null;
  const { data: meeting, isLoading, error } = useMeeting(id);
  const { data: clients } = useClients();
  const updateClientMutation = useUpdateMeetingClient();
  const createClientMutation = useCreateClient();
  const { toast } = useToast();
  const { hasFullAccess } = useSubscriptionStatus();
  const [isExporting, setIsExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSections, setExportSections] = useState({
    summary: true,
    transcript: true,
    actionItems: true,
    topics: true,
  });

  const queryClient = useQueryClient();

  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  const { data: meetingPolicies = [] } = useQuery<Policy[]>({
    queryKey: ["/api/meetings", id, "policies"],
    queryFn: () => fetch(`/api/meetings/${id}/policies`, { credentials: "include" }).then(r => r.json()),
    enabled: !!id,
  });

  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");

  const [isEditingContext, setIsEditingContext] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string>("");
  const [editContextText, setEditContextText] = useState("");
  const [editContextFile, setEditContextFile] = useState<File | null>(null);
  const [editIncludePreviousContext, setEditIncludePreviousContext] = useState(false);
  const [editOutputLanguage, setEditOutputLanguage] = useState("en");
  const [editIsInternal, setEditIsInternal] = useState(false);
  const [editPolicyIds, setEditPolicyIds] = useState<number[]>([]);

  const { data: clientPolicies = [] } = useQuery<Policy[]>({
    queryKey: ["/api/clients", meeting?.clientId, "policies"],
    queryFn: () => fetch(`/api/clients/${meeting?.clientId}/policies`, { credentials: "include" }).then(r => r.json()),
    enabled: !!meeting?.clientId,
  });

  const getSummaryText = () => {
    if (!meeting?.summary?.content) return "";
    return formatSummaryContent(meeting.summary.content);
  };

  const getTranscriptText = () => {
    if (!meeting?.transcript?.content) return "";
    return meeting.transcript.content;
  };

  const getActionItemsText = () => {
    if (!meeting?.actionItems?.length) return "";
    return meeting.actionItems
      .map((item, i) => `${i + 1}. ${item.content}${item.assignee ? ` (Assigned to: ${item.assignee})` : ""}`)
      .join("\n");
  };

  const getTopicsText = () => {
    if (!meeting?.topics?.length) return "";
    return meeting.topics
      .map((topic) => `${topic.title}${topic.relevanceScore ? ` (${topic.relevanceScore}%)` : ""}\n${topic.summary}`)
      .join("\n\n");
  };

  const handleExportWord = async () => {
    if (!meeting || !id) return;
    const anySelected = Object.values(exportSections).some(Boolean);
    if (!anySelected) {
      toast({ title: "Please select at least one section to export", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    setExportDialogOpen(false);
    try {
      const params = new URLSearchParams();
      if (exportSections.summary) params.set("summary", "1");
      if (exportSections.transcript) params.set("transcript", "1");
      if (exportSections.actionItems) params.set("actionItems", "1");
      if (exportSections.topics) params.set("topics", "1");
      const res = await fetch(`/api/meetings/${id}/export-word?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meeting.title || "Meeting Report"}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Report exported successfully" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const reprocessMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const res = await apiRequest("POST", `/api/meetings/${meetingId}/reprocess`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/:id", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Analysis is being regenerated", description: "The page will update automatically when complete." });
    },
    onError: (err: any) => {
      toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (meetingId: number) => {
      const res = await apiRequest("POST", `/api/meetings/${meetingId}/send-email`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: "The meeting report has been sent to your email." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-10 text-center text-slate-500">Loading details...</div>;
  if (error || !meeting) return <div className="p-10 text-center text-red-500">Meeting not found</div>;

  const linkedClient = meeting.clientId && clients ? clients.find(c => c.id === meeting.clientId) : null;
  const linkedTemplate = meeting.templateId && templates ? templates.find(t => t.id === meeting.templateId) : null;

  const startEditingContext = () => {
    setEditTemplateId(meeting.templateId ? String(meeting.templateId) : "");
    setEditContextText(meeting.contextText || "");
    setEditContextFile(null);
    setEditIncludePreviousContext(meeting.includePreviousContext ?? false);
    setEditOutputLanguage(meeting.outputLanguage || "en");
    setEditIsInternal(meeting.isInternal ?? false);
    setEditPolicyIds(meetingPolicies.map((p: Policy) => p.id));
    setIsEditingContext(true);
  };

  const handleSaveContextAndReprocess = async () => {
    if (!id) return;
    try {
      const contextPayload: any = {
        templateId: editTemplateId ? Number(editTemplateId) : null,
        contextText: editContextText.trim() || null,
        includePreviousContext: editIncludePreviousContext,
        outputLanguage: editOutputLanguage,
        isInternal: editIsInternal,
      };
      await apiRequest("PATCH", `/api/meetings/${id}/context`, contextPayload);

      if (editContextFile) {
        const formData = new FormData();
        formData.append("file", editContextFile);
        await fetch(`/api/meetings/${id}/context-file`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      }

      const policyRes = await fetch(`/api/meetings/${id}/policies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ policyIds: editPolicyIds }),
      });
      if (!policyRes.ok) {
        throw new Error("Failed to update linked policies");
      }

      setIsEditingContext(false);
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/:id", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", id, "policies"] });
      reprocessMutation.mutate(id);
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  const handleLinkClient = async (clientIdStr: string) => {
    if (!id) return;
    const clientId = clientIdStr ? Number(clientIdStr) : null;
    await updateClientMutation.mutateAsync({ meetingId: id, clientId });
    setIsEditingClient(false);
    setSelectedClientId("");
  };

  const handleUnlinkClient = async () => {
    if (!id) return;
    await updateClientMutation.mutateAsync({ meetingId: id, clientId: null });
    setIsEditingClient(false);
    setSelectedClientId("");
  };

  const handleCreateAndLink = async () => {
    if (!newClientName.trim() || !id) {
      toast({ title: "Name Required", description: "Please enter a client name.", variant: "destructive" });
      return;
    }
    try {
      const client = await createClientMutation.mutateAsync({
        name: newClientName.trim(),
        email: newClientEmail.trim() || null,
        company: newClientCompany.trim() || null,
      });
      await updateClientMutation.mutateAsync({ meetingId: id, clientId: client.id });
      setNewClientName("");
      setNewClientEmail("");
      setNewClientCompany("");
      setDialogOpen(false);
      setIsEditingClient(false);
    } catch (error) {}
  };

  const startEditing = () => {
    setSelectedClientId(meeting.clientId ? String(meeting.clientId) : "");
    setIsEditingClient(true);
  };

  const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
        
      <header className="bg-white dark:bg-background border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 shrink-0">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full shrink-0" data-testid="button-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-display font-bold truncate" data-testid="text-meeting-title">{meeting.title}</h1>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-0.5 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {format(new Date(meeting.date), "MMM d, yyyy")}
            </span>
            <StatusBadge status={meeting.status as any} />
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">
            
            <motion.section {...fadeIn}>
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-muted-foreground">Linked Client</p>
                        {linkedClient ? (
                          <Link href={`/client/${linkedClient.id}`}>
                            <span className="text-sm font-semibold hover:underline cursor-pointer truncate block" data-testid="text-linked-client">
                              {linkedClient.name}
                              {linkedClient.company && <span className="text-muted-foreground font-normal"> — {linkedClient.company}</span>}
                            </span>
                          </Link>
                        ) : (
                          <p className="text-sm text-muted-foreground" data-testid="text-no-client">No client linked</p>
                        )}
                      </div>
                    </div>

                    {!isEditingClient ? (
                      <div className="flex items-center gap-2 shrink-0">
                        {linkedClient && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleUnlinkClient}
                            disabled={updateClientMutation.isPending}
                            data-testid="button-unlink-client"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Unlink
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startEditing}
                          data-testid="button-change-client"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          {linkedClient ? "Change" : "Link Client"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={selectedClientId}
                          onValueChange={(val) => handleLinkClient(val)}
                        >
                          <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-link-client">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={String(client.id)} data-testid={`select-client-option-${client.id}`}>
                                <span>{client.name}</span>
                                {client.company && <span className="text-xs text-muted-foreground ml-1">({client.company})</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" data-testid="button-create-new-client">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Create & Link Client</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="detail-client-name">Name *</Label>
                                <Input
                                  id="detail-client-name"
                                  placeholder="e.g. John Smith"
                                  value={newClientName}
                                  onChange={(e) => setNewClientName(e.target.value)}
                                  data-testid="input-new-client-name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="detail-client-email">Email</Label>
                                <Input
                                  id="detail-client-email"
                                  type="email"
                                  placeholder="e.g. john@example.com"
                                  value={newClientEmail}
                                  onChange={(e) => setNewClientEmail(e.target.value)}
                                  data-testid="input-new-client-email"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="detail-client-company">Company</Label>
                                <Input
                                  id="detail-client-company"
                                  placeholder="e.g. Acme Corp"
                                  value={newClientCompany}
                                  onChange={(e) => setNewClientCompany(e.target.value)}
                                  data-testid="input-new-client-company"
                                />
                              </div>
                              <Button
                                onClick={handleCreateAndLink}
                                disabled={createClientMutation.isPending || updateClientMutation.isPending}
                                className="w-full"
                                data-testid="button-save-and-link-client"
                              >
                                {createClientMutation.isPending || updateClientMutation.isPending ? (
                                  <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Creating...</>
                                ) : (
                                  "Create & Link"
                                )}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingClient(false)}
                          data-testid="button-cancel-edit-client"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.section>

            {meetingPolicies.length > 0 && !(hasFullAccess && (meeting.status === "completed" || meeting.status === "failed")) && (
              <motion.section {...fadeIn}>
                <Card>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Linked Policies</p>
                    </div>
                    <div className="space-y-2">
                      {meetingPolicies.map((policy) => (
                        <div
                          key={policy.id}
                          className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                          data-testid={`meeting-policy-${policy.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-foreground">{policy.type}</span>
                            <span className="text-sm text-muted-foreground ml-2">{policy.insurer} - {policy.policyNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.section>
            )}

            {hasFullAccess && (meeting.status === "completed" || meeting.status === "failed") && (
              <motion.section {...fadeIn}>
                <Card>
                  <CardContent className="p-5">
                    {!isEditingContext ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <p className="text-sm font-medium text-muted-foreground">AI Settings</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={startEditingContext}
                            data-testid="button-edit-context"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit & Regenerate
                          </Button>
                        </div>
                        {linkedTemplate && (
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Template</p>
                              <p className="text-sm font-semibold" data-testid="text-meeting-template">{linkedTemplate.name}</p>
                            </div>
                          </div>
                        )}
                        {meeting.contextText && (
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                              <MessageSquareText className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Context</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="text-meeting-context">{meeting.contextText}</p>
                            </div>
                          </div>
                        )}
                        {meeting.contextFileName && (
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <Paperclip className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Attached File</p>
                              <p className="text-sm font-semibold" data-testid="text-meeting-context-file">{meeting.contextFileName}</p>
                            </div>
                          </div>
                        )}
                        {meeting.includePreviousContext && (
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <RefreshCw className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Client History</p>
                              <p className="text-sm font-semibold" data-testid="text-include-previous-context">Including previous meeting summaries</p>
                            </div>
                          </div>
                        )}
                        {meeting.isInternal && (
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Meeting Type</p>
                              <p className="text-sm font-semibold" data-testid="text-is-internal">Internal Discussion / Dictation</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Output Language</p>
                            <p className="text-sm font-semibold" data-testid="text-output-language">
                              {meeting.outputLanguage === "af" ? "Afrikaans" : "English"}
                            </p>
                          </div>
                        </div>
                        {meetingPolicies.length > 0 && (
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                              <Shield className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Linked Policies</p>
                              <div className="space-y-1 mt-1">
                                {meetingPolicies.map((policy: Policy) => (
                                  <p key={policy.id} className="text-sm text-foreground" data-testid={`text-linked-policy-${policy.id}`}>
                                    {policy.type} <span className="text-muted-foreground">- {policy.insurer} ({policy.policyNumber})</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {!linkedTemplate && !meeting.contextText && !meeting.contextFileName && !meeting.includePreviousContext && !meeting.isInternal && meetingPolicies.length === 0 && (
                          <p className="text-sm text-muted-foreground">No template or context set. Edit to add one and regenerate the analysis.</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm font-medium text-muted-foreground">Edit AI Settings</p>
                        <p className="text-xs text-muted-foreground -mt-2">Changes will regenerate the summary, action items, and topics using the existing transcript.</p>

                        {templates && templates.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm">Template</Label>
                            <Select value={editTemplateId} onValueChange={setEditTemplateId}>
                              <SelectTrigger data-testid="select-edit-template">
                                <SelectValue placeholder="No template selected" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map((tpl) => (
                                  <SelectItem key={tpl.id} value={String(tpl.id)} data-testid={`select-edit-template-option-${tpl.id}`}>
                                    {tpl.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editTemplateId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditTemplateId("")}
                                className="text-xs text-muted-foreground"
                                data-testid="button-clear-template"
                              >
                                <X className="w-3 h-3 mr-1" /> Clear template
                              </Button>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-sm">Context</Label>
                          <Textarea
                            placeholder="Provide background info for the AI..."
                            value={editContextText}
                            onChange={(e) => setEditContextText(e.target.value)}
                            rows={3}
                            data-testid="input-edit-context-text"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Attach File</Label>
                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              id="edit-context-file"
                              className="hidden"
                              accept=".txt,.md,.csv,.json,.doc,.docx,.pdf"
                              onChange={(e) => {
                                if (e.target.files?.[0]) setEditContextFile(e.target.files[0]);
                              }}
                              data-testid="input-edit-context-file"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById("edit-context-file")?.click()}
                              type="button"
                              data-testid="button-attach-edit-file"
                            >
                              <Paperclip className="w-4 h-4 mr-1.5" />
                              {meeting.contextFileName ? "Replace File" : "Attach File"}
                            </Button>
                            {(editContextFile || meeting.contextFileName) && (
                              <span className="text-sm text-muted-foreground" data-testid="text-edit-context-file-name">
                                {editContextFile ? editContextFile.name : meeting.contextFileName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3 pt-1">
                          <input
                            type="checkbox"
                            id="edit-is-internal"
                            checked={editIsInternal}
                            onChange={(e) => setEditIsInternal(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                            data-testid="checkbox-edit-is-internal"
                          />
                          <label htmlFor="edit-is-internal" className="text-sm cursor-pointer select-none">
                            <span className="font-medium">Internal Meeting</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Internal Discussion / Dictation without the client being present
                            </p>
                          </label>
                        </div>

                        {meeting.clientId && (
                          <div className="flex items-start gap-3 pt-1">
                            <input
                              type="checkbox"
                              id="edit-include-previous"
                              checked={editIncludePreviousContext}
                              onChange={(e) => setEditIncludePreviousContext(e.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                              data-testid="checkbox-include-previous-context"
                            />
                            <label htmlFor="edit-include-previous" className="text-sm cursor-pointer select-none">
                              <span className="font-medium">Include previous meeting summaries</span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                When checked, AI analysis will reference summaries from earlier meetings with the same client for better continuity.
                              </p>
                            </label>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-sm">Output Language</Label>
                          <Select value={editOutputLanguage} onValueChange={setEditOutputLanguage}>
                            <SelectTrigger data-testid="select-edit-output-language">
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-muted-foreground" />
                                <SelectValue placeholder="Select language" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en" data-testid="select-edit-output-language-en">English</SelectItem>
                              <SelectItem value="af" data-testid="select-edit-output-language-af">Afrikaans</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">AI summaries, action items, and topics will be generated in this language. The transcript stays in the original spoken language.</p>
                        </div>

                        {meeting.clientId && clientPolicies.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm">Linked Policies</Label>
                            <p className="text-xs text-muted-foreground -mt-1">Select the policies relevant to this meeting. Their details will appear at the beginning of the AI summary.</p>
                            <div className="space-y-2">
                              {clientPolicies.filter((p: Policy) => p.isActive).map((policy: Policy) => (
                                <div
                                  key={policy.id}
                                  className="flex items-start gap-3"
                                  data-testid={`edit-policy-option-${policy.id}`}
                                >
                                  <input
                                    type="checkbox"
                                    id={`edit-policy-${policy.id}`}
                                    checked={editPolicyIds.includes(policy.id)}
                                    onChange={() =>
                                      setEditPolicyIds(prev =>
                                        prev.includes(policy.id)
                                          ? prev.filter(pid => pid !== policy.id)
                                          : [...prev, policy.id]
                                      )
                                    }
                                    className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                                    data-testid={`edit-checkbox-policy-${policy.id}`}
                                  />
                                  <label htmlFor={`edit-policy-${policy.id}`} className="flex-1 cursor-pointer select-none">
                                    <span className="font-medium text-sm text-foreground">{policy.type}</span>
                                    <span className="text-sm text-muted-foreground ml-2">{policy.insurer} - {policy.policyNumber}</span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            onClick={handleSaveContextAndReprocess}
                            disabled={reprocessMutation.isPending}
                            data-testid="button-regenerate"
                          >
                            {reprocessMutation.isPending ? (
                              <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Regenerating...</>
                            ) : (
                              <><RefreshCw className="w-4 h-4 mr-1.5" /> Save & Regenerate</>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingContext(false)}
                            disabled={reprocessMutation.isPending}
                            data-testid="button-cancel-edit-context"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.section>
            )}

            {meeting.audioUrl && (
              <motion.section {...fadeIn} className="mb-8">
                 <AudioPlayer url={`/api/audio/${meeting.id}`} />
              </motion.section>
            )}

            {!hasFullAccess && (
              <motion.div {...fadeIn}>
                <Card className="border-dashed">
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">AI analysis features are locked</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          Subscribe to unlock transcription, summaries, action items, and topic analysis.
                        </p>
                      </div>
                    </div>
                    <Link href="/subscription" className="w-full sm:w-auto shrink-0">
                      <Button size="sm" className="w-full sm:w-auto" data-testid="button-subscribe-cta">
                        <CreditCard className="w-4 h-4 mr-1.5" />
                        Subscribe
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-b p-0 h-auto rounded-none gap-4 sm:gap-8 mb-6 overflow-x-auto flex-nowrap">
                <TabsTrigger 
                  value="summary" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Executive </span>Summary
                </TabsTrigger>
                <TabsTrigger 
                  value="transcript" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium whitespace-nowrap shrink-0"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  Transcript
                </TabsTrigger>
                <TabsTrigger 
                  value="actions" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium whitespace-nowrap shrink-0"
                >
                  <CheckSquare className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Action </span>Items
                </TabsTrigger>
                <TabsTrigger 
                  value="topics" 
                  className="rounded-none border-b-2 border-transparent px-0 py-3 data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none font-medium whitespace-nowrap shrink-0"
                >
                  <LayoutList className="w-4 h-4 mr-1.5" />
                  Topics
                </TabsTrigger>
              </TabsList>

              <div className="min-h-[400px]">
                <TabsContent value="summary" className="outline-none">
                  {meeting.summary ? (
                    <motion.div {...fadeIn} className="bg-card rounded-2xl border p-4 sm:p-6 md:p-8">
                      <div className="flex justify-end gap-2 mb-4">
                        <CopyButton getText={getSummaryText} label="Summary" />
                        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isExporting}
                              data-testid="button-export-word"
                            >
                              {isExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                              Export Word
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Export to Word</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground">Select the sections you want to include in the Word document:</p>
                            <div className="space-y-3 py-2">
                              <label className="flex items-center gap-3 cursor-pointer" data-testid="checkbox-export-summary">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-input"
                                  checked={exportSections.summary}
                                  onChange={(e) => setExportSections(prev => ({ ...prev, summary: e.target.checked }))}
                                />
                                <span className="text-sm font-medium">Executive Summary</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer" data-testid="checkbox-export-transcript">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-input"
                                  checked={exportSections.transcript}
                                  onChange={(e) => setExportSections(prev => ({ ...prev, transcript: e.target.checked }))}
                                />
                                <span className="text-sm font-medium">Transcript</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer" data-testid="checkbox-export-action-items">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-input"
                                  checked={exportSections.actionItems}
                                  onChange={(e) => setExportSections(prev => ({ ...prev, actionItems: e.target.checked }))}
                                />
                                <span className="text-sm font-medium">Action Items</span>
                              </label>
                              <label className="flex items-center gap-3 cursor-pointer" data-testid="checkbox-export-topics">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-input"
                                  checked={exportSections.topics}
                                  onChange={(e) => setExportSections(prev => ({ ...prev, topics: e.target.checked }))}
                                />
                                <span className="text-sm font-medium">Topics</span>
                              </label>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleExportWord}
                                disabled={!Object.values(exportSections).some(Boolean)}
                                data-testid="button-confirm-export"
                              >
                                <Download className="w-4 h-4 mr-1.5" />
                                Export
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sendEmailMutation.isPending}
                          onClick={() => id && sendEmailMutation.mutate(id)}
                          data-testid="button-send-email"
                        >
                          {sendEmailMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mail className="w-4 h-4 mr-1.5" />}
                          Email Report
                        </Button>
                      </div>
                      <div className="prose prose-sm sm:prose-base prose-slate dark:prose-invert max-w-none prose-headings:font-display" data-testid="text-summary-content">
                        <ReactMarkdown>{formatSummaryContent(meeting.summary.content)}</ReactMarkdown>
                      </div>
                    </motion.div>
                  ) : (
                    <EmptyState type="summary" status={meeting.status} />
                  )}
                </TabsContent>

                <TabsContent value="transcript" className="outline-none">
                  {meeting.transcript ? (
                    <motion.div {...fadeIn} className="bg-card rounded-2xl border overflow-hidden">
                      <div className="flex justify-end gap-2 p-4 sm:p-6 pb-0">
                        <CopyButton getText={getTranscriptText} label="Transcript" />
                      </div>
                      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                        {meeting.transcript.content.split('\n\n').map((block, idx) => (
                          <div key={idx} className="flex gap-3 sm:gap-4">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold mb-1">Speaker {idx % 2 === 0 ? 'A' : 'B'}</p>
                              <p className="text-muted-foreground leading-relaxed">{block}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <EmptyState type="transcript" status={meeting.status} />
                  )}
                </TabsContent>

                <TabsContent value="actions" className="outline-none">
                  {meeting.actionItems && meeting.actionItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex justify-end">
                        <CopyButton getText={getActionItemsText} label="Action Items" />
                      </div>
                      {meeting.actionItems.map((item, idx) => (
                        <motion.div 
                          key={item.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                        >
                           <Card>
                             <CardContent className="p-4 sm:p-6 flex items-start gap-3 sm:gap-4">
                               <div className="mt-0.5">
                                 <input type="checkbox" className="w-5 h-5 rounded border-input cursor-pointer" />
                               </div>
                               <div className="flex-1">
                                 <p className="font-medium">{item.content}</p>
                                 {item.assignee && (
                                   <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-muted text-xs font-medium text-muted-foreground">
                                     <User className="w-3 h-3 mr-1" />
                                     {item.assignee}
                                   </div>
                                 )}
                               </div>
                             </CardContent>
                           </Card>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState type="action items" status={meeting.status} />
                  )}
                </TabsContent>

                <TabsContent value="topics" className="outline-none">
                  {meeting.topics && meeting.topics.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <CopyButton getText={getTopicsText} label="Topics" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {meeting.topics.map((topic, idx) => (
                         <motion.div 
                           key={topic.id}
                           initial={{ opacity: 0, scale: 0.95 }}
                           animate={{ opacity: 1, scale: 1 }}
                           transition={{ delay: idx * 0.1 }}
                         >
                           <Card className="h-full">
                             <CardHeader>
                               <CardTitle className="text-lg font-bold flex justify-between items-start gap-2">
                                 {topic.title}
                                 {topic.relevanceScore && (
                                   <Badge variant="secondary" className="shrink-0">
                                     {topic.relevanceScore}%
                                   </Badge>
                                 )}
                               </CardTitle>
                             </CardHeader>
                             <CardContent>
                               <p className="text-muted-foreground text-sm leading-relaxed">{topic.summary}</p>
                             </CardContent>
                           </Card>
                         </motion.div>
                      ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState type="topics" status={meeting.status} />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </ScrollArea>
    </div>
  );
}

function EmptyState({ type, status }: { type: string, status: string | undefined }) {
  if (status === 'processing' || status === 'uploading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
        </div>
        <h3 className="font-semibold">AI is working on it</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          We are currently generating the {type}. This typically takes 1-2 minutes depending on the audio length.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-muted/30">
      <p className="text-muted-foreground">No {type} available for this meeting.</p>
    </div>
  );
}
