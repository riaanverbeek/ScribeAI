import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCreateMeeting, useUploadAudio, useProcessMeeting } from "@/hooks/use-meetings";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { useOnlineStatus } from "@/hooks/use-offline";
import { saveOfflineRecording } from "@/lib/offlineDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Mic, UploadCloud, CloudUpload, ChevronLeft, Loader2, Plus, Users, FileText, Paperclip, WifiOff, Wifi, Pause, Play, Square, Globe, ClipboardPaste, FileUp, AlertTriangle, ShieldCheck, Check, ChevronsUpDown, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/replit_integrations/audio";
import { motion } from "framer-motion";
import type { Template } from "@shared/schema";

export default function NewMeeting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [contextText, setContextText] = useState("");
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [includePreviousContext, setIncludePreviousContext] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState("en");
  const [isInternal, setIsInternal] = useState(false);
  const [detailLevel, setDetailLevel] = useState<"high" | "medium" | "low">("high");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [activeInputTab, setActiveInputTab] = useState("record");
  const [consentStatus, setConsentStatus] = useState<"not_asked" | "yes" | "no">("not_asked");
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [failedMeetingId, setFailedMeetingId] = useState<number | null>(null);
  
  const createMutation = useCreateMeeting();
  const uploadMutation = useUploadAudio();
  const processMutation = useProcessMeeting();
  const { data: clients } = useClients();
  const createClientMutation = useCreateClient();
  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });
  
  const recorder = useVoiceRecorder();

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast({ title: "Name Required", description: "Please enter a client name.", variant: "destructive" });
      return;
    }
    try {
      const client = await createClientMutation.mutateAsync({
        name: newClientName.trim(),
        email: newClientEmail.trim() || null,
        company: newClientCompany.trim() || null,
      });
      setSelectedClientId(String(client.id));
      setNewClientName("");
      setNewClientEmail("");
      setNewClientCompany("");
      setDialogOpen(false);
      toast({ title: "Client Created", description: `${client.name} has been added.` });
    } catch (error) {}
  };

  const handleSaveOffline = async () => {
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please give your session a name.", variant: "destructive" });
      return;
    }

    if (!file) {
      toast({ title: "Audio Required", description: "Please record or upload audio first.", variant: "destructive" });
      return;
    }

    const actualBlob: Blob = file;
    const audioFileName = file.name || "recording.webm";
    const audioMimeType = file.type || "audio/webm";
    setIsSavingOffline(true);

    try {
      const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let ctxBlob: Blob | null = null;
      let ctxFileName: string | null = null;
      if (contextFile) {
        ctxBlob = contextFile;
        ctxFileName = contextFile.name;
      }

      await saveOfflineRecording({
        id,
        title: title.trim(),
        audioBlob: actualBlob,
        audioFileName,
        audioMimeType,
        clientId: selectedClientId ? Number(selectedClientId) : null,
        templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
        contextText: contextText,
        contextFile: ctxBlob,
        contextFileName: ctxFileName,
        includePreviousContext: includePreviousContext,
        outputLanguage: outputLanguage,
        isInternal: isInternal,
        policyIds: [],
        createdAt: new Date().toISOString(),
        status: "pending",
      });
      await recorder.clearRecoveryData();

      toast({
        title: "Saved Offline",
        description: "Your recording has been saved. It will upload automatically when you're back online.",
      });

      setLocation("/");
    } catch (err) {
      toast({
        title: "Save Failed",
        description: "Could not save the recording locally. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingOffline(false);
    }
  };

  const getTranscriptContent = async (): Promise<string | null> => {
    if (transcriptText.trim()) return transcriptText.trim();
    if (transcriptFile) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read transcript file"));
        reader.readAsText(transcriptFile);
      });
    }
    return null;
  };

  const handleCreate = async () => {
    if (!isOnline) {
      if (activeInputTab === "transcript") {
        toast({ title: "Not Available Offline", description: "Transcript processing requires an internet connection. Please try again when you're online.", variant: "destructive" });
        return;
      }
      return handleSaveOffline();
    }

    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please give your session a name.", variant: "destructive" });
      return;
    }

    const isTranscriptMode = activeInputTab === "transcript";

    if (isTranscriptMode) {
      const content = await getTranscriptContent();
      if (!content || !content.trim()) {
        toast({ title: "Transcript Required", description: "Please paste your transcript text or upload a transcript file.", variant: "destructive" });
        return;
      }
    }

    try {
      let meeting: any;

      if (failedMeetingId) {
        meeting = { id: failedMeetingId };
      } else {
        const meetingData: any = { 
          title,
          date: new Date().toISOString(),
          outputLanguage,
          detailLevel,
        };
        if (selectedClientId) {
          meetingData.clientId = Number(selectedClientId);
        }

        meeting = await createMutation.mutateAsync(meetingData);
      }

      if (!failedMeetingId) {
        const contextPayload: any = {};
        if (selectedTemplateId) {
          contextPayload.templateId = Number(selectedTemplateId);
        }
        if (contextText.trim()) {
          contextPayload.contextText = contextText.trim();
        }
        if (includePreviousContext) {
          contextPayload.includePreviousContext = true;
        }
        if (isInternal) {
          contextPayload.isInternal = true;
        }
        if (selectedClientId && consentStatus !== "not_asked") {
          contextPayload.clientRecordingConsent = consentStatus;
        }
        if (Object.keys(contextPayload).length > 0) {
          await fetch(`/api/meetings/${meeting.id}/context`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(contextPayload),
          });
        }

        if (contextFile) {
          const formData = new FormData();
          formData.append("file", contextFile);
          await fetch(`/api/meetings/${meeting.id}/context-file`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
        }
      }

      if (isTranscriptMode) {
        let transcriptRes: Response;
        const isDocx = transcriptFile && transcriptFile.name.toLowerCase().endsWith(".docx");
        if (isDocx) {
          const formData = new FormData();
          formData.append("file", transcriptFile);
          transcriptRes = await fetch(`/api/meetings/${meeting.id}/transcript`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
        } else {
          const content = await getTranscriptContent();
          transcriptRes = await fetch(`/api/meetings/${meeting.id}/transcript`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ content }),
          });
        }
        if (!transcriptRes.ok) {
          const err = await transcriptRes.json().catch(() => ({ message: "Failed to save transcript" }));
          throw new Error(err.message);
        }
        await processMutation.mutateAsync(meeting.id);
      } else {
        let audioFile = file;

        if (recorder.state === "stopped") {
        } else if (!file) {
          toast({ title: "Audio Required", description: "Please record or upload audio.", variant: "destructive" });
          return;
        }

        if (audioFile) {
          try {
            await uploadMutation.mutateAsync({ id: meeting.id, file: audioFile });
            await recorder.clearRecoveryData();
          } catch {
            setFailedMeetingId(meeting.id);
            toast({
              title: "Upload Failed",
              description: "The audio upload failed. Your recording is safe — tap \"Process Session\" to retry.",
              variant: "destructive",
            });
            return;
          }
        }

        await processMutation.mutateAsync(meeting.id);
      }

      setFailedMeetingId(null);
      setLocation(`/meeting/${meeting.id}`);

    } catch (error: any) {
      console.error("Meeting creation/upload error:", error);
      toast({
        title: "Something Went Wrong",
        description: error?.message || "Failed to create or upload session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    const blob = await recorder.stopRecording();
    const ext = recorder.recordingExtension || ".webm";
    const mime = recorder.recordingMimeType || "audio/webm";
    const recordedFile = new File([blob], `recording${ext}`, { type: mime });
    setFile(recordedFile);
    toast({ title: "Recording Saved", description: "Ready to process." });
  };

  const isPending = createMutation.isPending || uploadMutation.isPending || isSavingOffline;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-3xl mx-auto">
      <Button 
        variant="ghost" 
        className="mb-6 pl-0 hover:bg-transparent hover:text-primary"
        onClick={() => setLocation("/")}
        data-testid="button-back"
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-foreground">New Session</h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">Record a conversation or upload an existing file.</p>
      </div>

      {!isOnline && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3" data-testid="banner-offline">
          <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">You're offline</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">You can still record audio. It will be saved locally and uploaded when you're back online.</p>
          </div>
        </div>
      )}

      <div className="grid gap-8">
        <div className="space-y-3">
          <Label htmlFor="title" className="text-base font-semibold text-slate-900">Session Title</Label>
          <Input 
            id="title"
            placeholder="e.g. Q4 Marketing Strategy"
            className="h-12 text-lg rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="input-title"
          />
        </div>

        {isOnline && (
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-900">Client</Label>
            <div className="flex items-center gap-3">
              <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setConsentStatus("not_asked"); }}>
                <SelectTrigger className="h-12 rounded-xl border-slate-200 flex-1" data-testid="select-client">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <SelectValue placeholder="Select a client (optional)" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)} data-testid={`select-client-option-${client.id}`}>
                      <div className="flex flex-col">
                        <span>{client.name}</span>
                        {client.company && <span className="text-xs text-slate-500">{client.company}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0" data-testid="button-new-client">
                    <Plus className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Client</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="client-name">Name *</Label>
                      <Input
                        id="client-name"
                        placeholder="e.g. John Smith"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        data-testid="input-client-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-email">Email</Label>
                      <Input
                        id="client-email"
                        type="email"
                        placeholder="e.g. john@example.com"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        data-testid="input-client-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-company">Company</Label>
                      <Input
                        id="client-company"
                        placeholder="e.g. Acme Corp"
                        value={newClientCompany}
                        onChange={(e) => setNewClientCompany(e.target.value)}
                        data-testid="input-client-company"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateClient}
                      disabled={createClientMutation.isPending}
                      className="w-full"
                      data-testid="button-save-client"
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
        )}

        {isOnline && templates && templates.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-900">Summary Template</Label>
            <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={templateOpen}
                  className="w-full h-12 rounded-xl border-slate-200 justify-between font-normal"
                  data-testid="select-template"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className={cn("truncate", !selectedTemplateId && "text-muted-foreground")}>
                      {selectedTemplateId
                        ? templates.find((t) => String(t.id) === selectedTemplateId)?.name
                        : "Search templates..."}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search templates..." data-testid="search-template-input" />
                  <CommandList>
                    <CommandEmpty>No templates found.</CommandEmpty>
                    <CommandGroup>
                      {templates.map((tpl) => (
                        <CommandItem
                          key={tpl.id}
                          value={tpl.name}
                          onSelect={() => {
                            setSelectedTemplateId(
                              String(tpl.id) === selectedTemplateId ? "" : String(tpl.id)
                            );
                            setTemplateOpen(false);
                          }}
                          data-testid={`select-template-option-${tpl.id}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedTemplateId === String(tpl.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{tpl.name}</span>
                            {tpl.description && <span className="text-xs text-slate-500">{tpl.description}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Controls how the AI structures the session summary.</p>
          </div>
        )}

        {isOnline && (
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-900">Output Language</Label>
            <Select value={outputLanguage} onValueChange={setOutputLanguage}>
              <SelectTrigger className="h-12 rounded-xl border-slate-200" data-testid="select-output-language">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <SelectValue placeholder="Select language" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en" data-testid="select-output-language-en">English</SelectItem>
                <SelectItem value="af" data-testid="select-output-language-af">Afrikaans</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">The language for AI-generated summaries, action items, and topics. The transcript stays in the original spoken language.</p>
          </div>
        )}

        {isOnline && (
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-900">Detail Level</Label>
            <Select value={detailLevel} onValueChange={(v) => setDetailLevel(v as "high" | "medium" | "low")}>
              <SelectTrigger className="h-12 rounded-xl border-slate-200" data-testid="select-detail-level">
                <SelectValue placeholder="Select detail level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high" data-testid="select-detail-level-high">High - Comprehensive analysis</SelectItem>
                <SelectItem value="medium" data-testid="select-detail-level-medium">Medium - Balanced overview</SelectItem>
                <SelectItem value="low" data-testid="select-detail-level-low">Low - Brief summary</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Controls how detailed the AI-generated summary and analysis will be.</p>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-base font-semibold text-slate-900">Session Context (optional)</Label>
          <p className="text-xs text-muted-foreground -mt-1">Provide any background info the AI should consider during analysis.</p>
          <Textarea
            placeholder="e.g. This is a follow-up to last week's budget review. Focus on action items related to cost reduction."
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            rows={3}
            className="rounded-xl border-slate-200"
            data-testid="input-context-text"
          />
          <div className="flex items-center gap-3">
            <input
              type="file"
              id="context-file-upload"
              className="hidden"
              accept=".txt,.md,.csv,.json,.doc,.docx,.pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) setContextFile(e.target.files[0]);
              }}
              data-testid="input-context-file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("context-file-upload")?.click()}
              type="button"
              data-testid="button-attach-context-file"
            >
              <Paperclip className="w-4 h-4 mr-1.5" />
              Attach File
            </Button>
            {contextFile && (
              <span className="text-sm text-muted-foreground" data-testid="text-context-file-name">
                {contextFile.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="is-internal-meeting"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
            data-testid="checkbox-is-internal"
          />
          <label htmlFor="is-internal-meeting" className="text-sm cursor-pointer select-none">
            <span className="font-medium">Internal Session</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Internal Discussion / Dictation without the client being present
            </p>
          </label>
        </div>

        {selectedClientId && (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="include-previous-context"
              checked={includePreviousContext}
              onChange={(e) => setIncludePreviousContext(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input accent-primary cursor-pointer"
              data-testid="checkbox-include-previous-context"
            />
            <label htmlFor="include-previous-context" className="text-sm cursor-pointer select-none">
              <span className="font-medium">Include previous session summaries</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI analysis will reference summaries from earlier sessions with this client for better continuity.
              </p>
            </label>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-base font-semibold text-slate-900">Session Input</Label>
          <Tabs defaultValue="record" className="w-full" onValueChange={setActiveInputTab}>
            <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl mb-4">
              <TabsTrigger value="record" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-xs sm:text-sm">
                Record Audio
              </TabsTrigger>
              <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-xs sm:text-sm">
                Upload Audio
              </TabsTrigger>
              <TabsTrigger value="transcript" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-xs sm:text-sm">
                Paste Transcript
              </TabsTrigger>
            </TabsList>

            <TabsContent value="record">
              <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 shadow-none rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  {failedMeetingId && file && recorder.state !== "recording" && recorder.state !== "paused" && (
                    <div className="mb-6 w-full max-w-sm rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4" data-testid="banner-upload-failed">
                      <div className="flex items-start gap-3">
                        <CloudUpload className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 dark:text-red-200">
                            Upload failed
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                            Your recording is safe. Tap "Process Session" below to retry the upload.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {recorder.hasRecoverableRecording && (recorder.state === "idle" || recorder.state === "stopped") && !file && (
                    <div className="mb-6 w-full max-w-sm rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4" data-testid="banner-recovery-newmeeting">
                      <div className="flex items-start gap-3">
                        <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            Interrupted recording found
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                            A previous recording was interrupted{recorder.recoverableElapsed > 0 ? ` (${Math.floor(recorder.recoverableElapsed / 60)}:${String(recorder.recoverableElapsed % 60).padStart(2, "0")} captured)` : ""}. Would you like to recover it?
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={async () => {
                                const recovered = await recorder.recoverRecording();
                                if (recovered) {
                                  const ext = recovered.mimeType.includes("webm") ? ".webm" : recovered.mimeType.includes("mp4") ? ".mp4" : ".webm";
                                  const recoveredFile = new File([recovered.blob], `recovered${ext}`, { type: recovered.mimeType });
                                  setFile(recoveredFile);
                                  toast({ title: "Recording Recovered", description: "Your interrupted recording has been restored." });
                                } else {
                                  toast({ title: "Recovery Failed", variant: "destructive" });
                                }
                              }}
                              data-testid="button-recover-newmeeting"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                              Recover
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => recorder.discardRecovery()}
                              data-testid="button-discard-recovery-newmeeting"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Discard
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(recorder.state === "idle" || recorder.state === "stopped") && (
                    <>
                      {recorder.error && (
                        <div className="w-full max-w-sm rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 mb-4" data-testid="banner-recording-error-newmeeting">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-red-900 dark:text-red-200">
                                {recorder.errorType === "unsupported" || recorder.errorType === "no_mediadevices"
                                  ? "Recording Not Available"
                                  : "Recording Failed"}
                              </p>
                              <p className="text-xs text-red-700 dark:text-red-400 mt-1">{recorder.error}</p>
                              <p className="text-xs text-red-600 dark:text-red-300 mt-1 font-medium">
                                Switch to the "Upload Audio" tab above to upload a file instead.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="relative mb-6">
                        <button
                          onClick={async () => {
                            try {
                              await recorder.startRecording();
                              if (selectedClientId) {
                                setTimeout(() => setConsentDialogOpen(true), 150);
                              }
                            } catch (err: any) {
                              const errType = recorder.errorType;
                              let title = "Recording Failed";
                              let description = err?.message || "An unexpected error occurred.";

                              if (errType === "unsupported" || errType === "no_mediadevices") {
                                title = "Recording Not Available";
                                description += ' Switch to the "Upload Audio" tab to upload a file instead.';
                              } else if (errType === "permission_denied") {
                                title = "Microphone Access Denied";
                              } else if (errType === "not_found") {
                                title = "No Microphone Found";
                              } else if (errType === "not_readable") {
                                title = "Microphone Unavailable";
                              } else if (errType === "aborted") {
                                title = "Recording Interrupted";
                              }

                              toast({ title, description, variant: "destructive" });
                            }
                          }}
                          className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 bg-primary text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20"
                          data-testid="button-record"
                        >
                          <Mic className="w-8 h-8" />
                        </button>
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Click to Record</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ensure microphone permission is granted</p>
                      </div>
                    </>
                  )}

                  {(recorder.state === "recording" || recorder.state === "paused") && (
                    <>
                      <div className="relative mb-6 flex items-center justify-center">
                        {recorder.state === "recording" && (
                          <>
                            <motion.div
                              className="absolute rounded-full bg-red-500/5"
                              style={{ width: 130, height: 130 }}
                              animate={{ scale: 1 + recorder.audioLevel * 1.5, opacity: 0.15 + recorder.audioLevel * 0.3 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                            />
                            <motion.div
                              className="absolute rounded-full bg-red-500/10"
                              style={{ width: 110, height: 110 }}
                              animate={{ scale: 1 + recorder.audioLevel * 1.2, opacity: 0.25 + recorder.audioLevel * 0.4 }}
                              transition={{ duration: 0.1 }}
                            />
                            <motion.div
                              className="absolute rounded-full bg-red-500/20"
                              style={{ width: 92, height: 92 }}
                              animate={{ scale: 1 + recorder.audioLevel * 0.9, opacity: 0.35 + recorder.audioLevel * 0.35 }}
                              transition={{ duration: 0.1 }}
                            />
                          </>
                        )}
                        <div
                          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center ${
                            recorder.state === "recording"
                              ? "bg-red-500 text-white"
                              : "bg-amber-500 shadow-lg shadow-amber-500/30 text-white"
                          } transition-colors duration-300`}
                          style={recorder.state === "recording" ? {
                            transform: `scale(${1 + recorder.audioLevel * 0.15})`,
                            transition: "transform 0.1s ease-out",
                            boxShadow: `0 0 ${16 + recorder.audioLevel * 30}px ${6 + recorder.audioLevel * 15}px rgba(239, 68, 68, ${0.3 + recorder.audioLevel * 0.4})`
                          } : undefined}
                        >
                          <Mic className="w-8 h-8" />
                        </div>
                      </div>

                      <div className="text-center mb-6">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {recorder.state === "recording" ? "Recording..." : "Paused"}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {recorder.state === "recording" ? "Speak clearly into your microphone" : "Recording is paused. Resume or stop when ready."}
                        </p>
                        {recorder.segmentCount > 0 && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1" data-testid="text-segment-count-newmeeting">
                            {recorder.segmentCount} segment{recorder.segmentCount !== 1 ? "s" : ""} saved
                          </p>
                        )}
                        {recorder.autoRestarted && (
                          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 mt-3 mx-auto max-w-xs" data-testid="banner-auto-restarted-newmeeting">
                            <RotateCcw className="w-4 h-4 text-blue-500 shrink-0" />
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              Recording interrupted and resumed automatically.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {recorder.state === "recording" ? (
                          <Button
                            variant="outline"
                            onClick={recorder.pauseRecording}
                            data-testid="button-pause-recording"
                          >
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={recorder.resumeRecording}
                            data-testid="button-resume-recording"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Resume
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          onClick={handleStopRecording}
                          data-testid="button-stop-recording"
                        >
                          <Square className="w-4 h-4 mr-2" />
                          Stop & Save
                        </Button>
                      </div>
                    </>
                  )}

                  {file && recorder.state === "stopped" && (
                    <div className="mt-6 px-4 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-medium flex items-center animate-in fade-in slide-in-from-bottom-2">
                      Recording saved ready for processing
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload">
              <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 shadow-none rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <input
                    type="file"
                    id="audio-upload"
                    className="hidden"
                    accept="audio/*,video/mp4,.mp4,.m4a,.mp3,.wav,.ogg,.webm,.aac,.caf"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setFile(e.target.files[0]);
                    }}
                    data-testid="input-audio-file"
                  />
                  <label 
                    htmlFor="audio-upload" 
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-primary hover:text-accent transition-colors">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <span className="font-semibold text-slate-900 hover:underline">Choose a file</span>
                    <p className="text-sm text-slate-500 mt-1">MP3, WAV, M4A, MP4 up to 200MB</p>
                  </label>
                  
                  {file && recorder.state !== "stopped" && (
                     <div className="mt-4 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">
                       Selected: {file.name}
                     </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transcript">
              <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 shadow-none rounded-xl">
                <CardContent className="py-6 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardPaste className="w-5 h-5 text-slate-400" />
                    <span className="font-semibold text-slate-900 dark:text-foreground text-sm">Paste or upload your transcript</span>
                  </div>
                  <Textarea
                    placeholder="Paste your session transcript here..."
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    rows={8}
                    className="rounded-xl border-slate-200 text-sm"
                    data-testid="input-transcript-text"
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">or</span>
                    <input
                      type="file"
                      id="transcript-file-upload"
                      className="hidden"
                      accept=".txt,.md,.csv,.json,.docx"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setTranscriptFile(e.target.files[0]);
                          setTranscriptText("");
                        }
                      }}
                      data-testid="input-transcript-file"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("transcript-file-upload")?.click()}
                      type="button"
                      data-testid="button-upload-transcript-file"
                    >
                      <FileUp className="w-4 h-4 mr-1.5" />
                      Upload Text File
                    </Button>
                    {transcriptFile && (
                      <span className="text-sm text-muted-foreground" data-testid="text-transcript-file-name">
                        {transcriptFile.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports .txt, .md, .csv, .json, and .docx files. The AI will analyse the text as if it were a recorded session.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Button 
          size="lg" 
          className="w-full h-14 text-lg rounded-xl bg-primary hover:bg-slate-800 shadow-xl shadow-slate-900/20"
          onClick={handleCreate}
          disabled={isPending || (activeInputTab === "transcript" ? (!transcriptText.trim() && !transcriptFile) : (!file || recorder.state === "recording" || recorder.state === "paused"))}
          data-testid="button-process"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 w-5 h-5 animate-spin" />
              {isSavingOffline ? "Saving Offline..." : "Creating & Uploading..."}
            </>
          ) : !isOnline ? (
            <>
              <WifiOff className="mr-2 w-5 h-5" />
              Save for Later
            </>
          ) : (
            "Process Session"
          )}
        </Button>
      </div>

      <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Recording Consent
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Have you obtained the client's consent to record this session?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              It is recommended to obtain explicit consent before recording any session with a client.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                setConsentStatus("yes");
                setConsentDialogOpen(false);
              }}
              data-testid="button-consent-yes"
            >
              Yes, consent obtained
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setConsentStatus("no");
                setConsentDialogOpen(false);
                toast({
                  title: "Consent Not Obtained",
                  description: "Recording without explicit client consent is not advisable. Consider obtaining consent before proceeding.",
                  variant: "destructive",
                  duration: 6000,
                });
              }}
              data-testid="button-consent-no"
            >
              No
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
