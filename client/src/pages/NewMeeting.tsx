import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCreateMeeting, useUploadAudio, useProcessMeeting } from "@/hooks/use-meetings";
import { useClients, useCreateClient } from "@/hooks/use-clients";
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
import { Mic, UploadCloud, ChevronLeft, Loader2, Plus, Users, FileText, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/replit_integrations/audio";
import { motion } from "framer-motion";
import type { Template } from "@shared/schema";

export default function NewMeeting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [contextText, setContextText] = useState("");
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
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

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please give your meeting a name.", variant: "destructive" });
      return;
    }

    try {
      const meetingData: any = { 
        title,
        date: new Date().toISOString(),
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

      setLocation(`/meeting/${meeting.id}`);

    } catch (error) {}
  };

  const handleStopRecording = async () => {
    const blob = await recorder.stopRecording();
    const recordedFile = new File([blob], "recording.webm", { type: "audio/webm" });
    setFile(recordedFile);
    toast({ title: "Recording Saved", description: "Ready to process." });
  };

  const isPending = createMutation.isPending || uploadMutation.isPending;

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

        <div className="space-y-3">
          <Label className="text-base font-semibold text-slate-900">Client</Label>
          <div className="flex items-center gap-3">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
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

        {templates && templates.length > 0 && (
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

        <div className="space-y-3">
          <Label className="text-base font-semibold text-slate-900">Audio Source</Label>
          <Tabs defaultValue="record" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl mb-4">
              <TabsTrigger value="record" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Record Audio
              </TabsTrigger>
              <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="record">
              <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 shadow-none rounded-xl">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="relative mb-6">
                    {recorder.state === "recording" && (
                      <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse-ring opacity-50" />
                    )}
                    <button
                      onClick={recorder.state === "idle" || recorder.state === "stopped" ? recorder.startRecording : handleStopRecording}
                      className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                        recorder.state === "recording" 
                          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110" 
                          : "bg-primary text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20"
                      }`}
                      data-testid="button-record"
                    >
                      {recorder.state === "recording" ? (
                        <div className="w-8 h-8 bg-white rounded-md" />
                      ) : (
                        <Mic className="w-8 h-8" />
                      )}
                    </button>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="font-semibold text-slate-900">
                      {recorder.state === "recording" ? "Recording..." : "Click to Record"}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {recorder.state === "recording" ? "Speak clearly into your microphone" : "Ensure microphone permission is granted"}
                    </p>
                  </div>

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
                    accept="audio/*"
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
                    <p className="text-sm text-slate-500 mt-1">MP3, WAV, M4A up to 50MB</p>
                  </label>
                  
                  {file && recorder.state !== "stopped" && (
                     <div className="mt-4 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium">
                       Selected: {file.name}
                     </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Button 
          size="lg" 
          className="w-full h-14 text-lg rounded-xl bg-primary hover:bg-slate-800 shadow-xl shadow-slate-900/20"
          onClick={handleCreate}
          disabled={isPending || (!file && recorder.state !== "recording")}
          data-testid="button-process"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 w-5 h-5 animate-spin" />
              Creating & Uploading...
            </>
          ) : (
            "Process Meeting"
          )}
        </Button>
      </div>
    </div>
  );
}
