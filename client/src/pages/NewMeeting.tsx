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
import { Mic, UploadCloud, ChevronLeft, Loader2, Plus, Users, FileText, Paperclip, WifiOff, Wifi, Pause, Play, Square, Globe, Shield, ClipboardPaste, FileUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/replit_integrations/audio";
import { motion } from "framer-motion";
import type { Template, Policy } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

export default function NewMeeting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [contextText, setContextText] = useState("");
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [includePreviousContext, setIncludePreviousContext] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState("en");
  const [isInternal, setIsInternal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<number[]>([]);
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [activeInputTab, setActiveInputTab] = useState("record");
  const [consentStatus, setConsentStatus] = useState<"not_asked" | "yes" | "no">("not_asked");
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  
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
  
  const { data: clientPolicies = [] } = useQuery<Policy[]>({
    queryKey: ["/api/clients", selectedClientId, "policies"],
    queryFn: () => fetch(`/api/clients/${selectedClientId}/policies`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedClientId,
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
      toast({ title: "Title Required", description: "Please give your meeting a name.", variant: "destructive" });
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
        policyIds: selectedPolicyIds,
        createdAt: new Date().toISOString(),
        status: "pending",
      });

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
      toast({ title: "Title Required", description: "Please give your meeting a name.", variant: "destructive" });
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
      const meetingData: any = { 
        title,
        date: new Date().toISOString(),
        outputLanguage,
      };
      if (selectedClientId) {
        meetingData.clientId = Number(selectedClientId);
      }

      const meeting = await createMutation.mutateAsync(meetingData);

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

      if (selectedPolicyIds.length > 0) {
        await fetch(`/api/meetings/${meeting.id}/policies`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ policyIds: selectedPolicyIds }),
        });
      }

      if (isTranscriptMode) {
        const content = await getTranscriptContent();
        const transcriptRes = await fetch(`/api/meetings/${meeting.id}/transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content }),
        });
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
          await uploadMutation.mutateAsync({ id: meeting.id, file: audioFile });
        }

        await processMutation.mutateAsync(meeting.id);
      }

      setLocation(`/meeting/${meeting.id}`);

    } catch (error: any) {
      console.error("Meeting creation/upload error:", error);
      toast({
        title: "Something Went Wrong",
        description: error?.message || "Failed to create or upload meeting. Please try again.",
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
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-foreground">New Meeting</h1>
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
          <Label htmlFor="title" className="text-base font-semibold text-slate-900">Meeting Title</Label>
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
              <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); setSelectedPolicyIds([]); setConsentStatus("not_asked"); }}>
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
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="h-12 rounded-xl border-slate-200" data-testid="select-template">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <SelectValue placeholder="Select a template (optional)" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={String(tpl.id)} data-testid={`select-template-option-${tpl.id}`}>
                    <div className="flex flex-col">
                      <span>{tpl.name}</span>
                      {tpl.description && <span className="text-xs text-slate-500">{tpl.description}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Controls how the AI structures the meeting summary.</p>
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

        <div className="space-y-3">
          <Label className="text-base font-semibold text-slate-900">Meeting Context (optional)</Label>
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
            <span className="font-medium">Internal Meeting</span>
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
              <span className="font-medium">Include previous meeting summaries</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI analysis will reference summaries from earlier meetings with this client for better continuity.
              </p>
            </label>
          </div>
        )}

        {selectedClientId && clientPolicies.length > 0 && isOnline && (
          <div className="space-y-3">
            <Label className="text-base font-semibold text-slate-900">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" />
                Link Policies
              </div>
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">Select the policies relevant to this meeting. Their details will be included in the AI analysis.</p>
            <div className="space-y-2">
              {clientPolicies.map((policy) => (
                <div
                  key={policy.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card"
                  data-testid={`policy-option-${policy.id}`}
                >
                  <Checkbox
                    id={`policy-${policy.id}`}
                    checked={selectedPolicyIds.includes(policy.id)}
                    onCheckedChange={(checked) => {
                      setSelectedPolicyIds(prev =>
                        checked
                          ? [...prev, policy.id]
                          : prev.filter(id => id !== policy.id)
                      );
                    }}
                    data-testid={`checkbox-policy-${policy.id}`}
                  />
                  <label htmlFor={`policy-${policy.id}`} className="flex-1 cursor-pointer select-none">
                    <span className="font-medium text-sm text-slate-900 dark:text-foreground">{policy.type}</span>
                    <span className="text-sm text-slate-500 ml-2">{policy.insurer} - {policy.policyNumber}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-base font-semibold text-slate-900">Meeting Input</Label>
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
                  {(recorder.state === "idle" || recorder.state === "stopped") && (
                    <>
                      <div className="relative mb-6">
                        <button
                          onClick={async () => {
                            try {
                              await recorder.startRecording();
                              if (selectedClientId) {
                                setConsentDialogOpen(true);
                              }
                            } catch {
                              toast({
                                title: "Recording Not Supported",
                                description: "Your browser doesn't support audio recording. Please upload an audio file instead.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 bg-primary text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20"
                          data-testid="button-record"
                        >
                          <Mic className="w-8 h-8" />
                        </button>
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-slate-900">Click to Record</h3>
                        <p className="text-sm text-slate-500 mt-1">Ensure microphone permission is granted</p>
                      </div>
                    </>
                  )}

                  {(recorder.state === "recording" || recorder.state === "paused") && (
                    <>
                      <div className="relative mb-6">
                        {recorder.state === "recording" && (
                          <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse-ring opacity-50" />
                        )}
                        <div
                          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center ${
                            recorder.state === "recording"
                              ? "bg-red-500 shadow-lg shadow-red-500/30 scale-110"
                              : "bg-amber-500 shadow-lg shadow-amber-500/30"
                          } text-white transition-all duration-300`}
                        >
                          <Mic className="w-8 h-8" />
                        </div>
                      </div>

                      <div className="text-center mb-6">
                        <h3 className="font-semibold text-slate-900">
                          {recorder.state === "recording" ? "Recording..." : "Paused"}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {recorder.state === "recording" ? "Speak clearly into your microphone" : "Recording is paused. Resume or stop when ready."}
                        </p>
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
                    <div className="mt-6 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium flex items-center animate-in fade-in slide-in-from-bottom-2">
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
                    placeholder="Paste your meeting transcript here..."
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
                      accept=".txt,.md,.csv,.json"
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
                    Supports .txt, .md, .csv, and .json files. The AI will analyse the text as if it were a recorded meeting.
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
            "Process Meeting"
          )}
        </Button>
      </div>

      <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Recording Consent
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Have you obtained the client's consent to record this meeting?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              It is recommended to obtain explicit consent before recording any meeting with a client.
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
