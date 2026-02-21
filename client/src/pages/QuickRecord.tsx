import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useCreateMeeting, useUploadAudio, useProcessMeeting } from "@/hooks/use-meetings";
import { useClients } from "@/hooks/use-clients";
import { useOnlineStatus } from "@/hooks/use-offline";
import { saveOfflineRecording } from "@/lib/offlineDb";
import { useVoiceRecorder } from "@/replit_integrations/audio";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Mic, Square, ChevronLeft, Loader2, Phone, WifiOff, Check, Pause, Play, ShieldCheck, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type Phase = "ready" | "recording" | "paused" | "saving";

export default function QuickRecord() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [consentStatus, setConsentStatus] = useState<"not_asked" | "yes" | "no">("not_asked");
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const recorder = useVoiceRecorder();
  const createMutation = useCreateMeeting();
  const uploadMutation = useUploadAudio();
  const processMutation = useProcessMeeting();
  const { data: clients } = useClients();

  useEffect(() => {
    if (phase === "recording" || phase === "paused") {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [phase]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 2;
      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue("--primary").trim();
      ctx.strokeStyle = primary ? `hsl(${primary})` : "#6366f1";
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      await recorder.startRecording();

      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err: any) {
      const isUnsupported = err?.message?.includes("does not support audio recording");
      toast({
        title: isUnsupported ? "Recording Not Supported" : "Microphone Access Denied",
        description: isUnsupported
          ? "Your browser doesn't support audio recording. Please upload an audio file instead."
          : "Please allow microphone access to record.",
        variant: "destructive",
      });
    }
  };

  const pauseRecording = () => {
    recorder.pauseRecording();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setPhase("paused");
  };

  const resumeRecording = () => {
    recorder.resumeRecording();
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    drawWaveform();
    setPhase("recording");
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const blob = await recorder.stopRecording();
    const ext = recorder.recordingExtension || ".webm";
    const mime = recorder.recordingMimeType || "audio/webm";
    const file = new File([blob], `phone-call${ext}`, { type: mime });
    setAudioFile(file);

    const now = new Date();
    setTitle(`Phone Call - ${format(now, "MMM d, yyyy h:mm a")}`);
    setPhase("saving");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Give your recording a name.", variant: "destructive" });
      return;
    }
    if (!audioFile) return;

    setIsSaving(true);

    try {
      if (!isOnline) {
        const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await saveOfflineRecording({
          id,
          title: title.trim(),
          audioBlob: audioFile,
          audioFileName: audioFile.name,
          audioMimeType: audioFile.type,
          clientId: selectedClientId ? Number(selectedClientId) : null,
          templateId: null,
          contextText: "",
          contextFile: null,
          contextFileName: null,
          includePreviousContext: false,
          createdAt: new Date().toISOString(),
          status: "pending",
        });
        toast({
          title: "Saved Offline",
          description: "Your recording will upload when you're back online.",
        });
        setLocation("/");
        return;
      }

      const meetingData: any = {
        title: title.trim(),
        date: new Date().toISOString(),
      };
      if (selectedClientId) {
        meetingData.clientId = Number(selectedClientId);
        if (consentStatus !== "not_asked") {
          meetingData.clientRecordingConsent = consentStatus;
        }
      }

      const meeting = await createMutation.mutateAsync(meetingData);
      await uploadMutation.mutateAsync({ id: meeting.id, file: audioFile });
      await processMutation.mutateAsync(meeting.id);
      setLocation(`/meeting/${meeting.id}`);
    } catch {
      toast({
        title: "Save Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const isPending = isSaving || createMutation.isPending || uploadMutation.isPending;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 sm:p-6">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          className="mb-6 pl-0"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium mb-4">
            <Phone className="w-4 h-4" />
            Quick Record
          </div>
          <p className="text-sm text-muted-foreground">
            {phase === "ready" && "Tap the button to start recording your call"}
            {phase === "recording" && "Recording in progress..."}
            {phase === "saving" && "Save your recording"}
          </p>
        </div>

        {!isOnline && (
          <div className="mb-6 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3" data-testid="banner-offline">
            <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              You're offline. Recording will be saved locally.
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {(phase === "ready" || phase === "recording" || phase === "paused") && (
            <motion.div
              key="recorder"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-8"
            >
              {phase === "recording" && (
                <div className="w-full h-20 rounded-xl overflow-hidden bg-muted/50">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={80}
                    className="w-full h-full"
                    data-testid="canvas-waveform"
                  />
                </div>
              )}

              {phase === "ready" && (
                <>
                  <div className="relative">
                    <Button
                      onClick={startRecording}
                      variant="default"
                      className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full"
                      data-testid="button-quick-record"
                    >
                      <Mic className="w-10 h-10 sm:w-12 sm:h-12" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Put your phone call on speaker, then tap the button to start recording both sides of the conversation.
                  </p>
                </>
              )}

              {(phase === "recording" || phase === "paused") && (
                <>
                  <div className="relative">
                    {phase === "recording" && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-red-500/20"
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    <div
                      className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center ${
                        phase === "recording"
                          ? "bg-red-500 shadow-lg shadow-red-500/30"
                          : "bg-amber-500 shadow-lg shadow-amber-500/30"
                      } text-white transition-all duration-300`}
                    >
                      <Mic className="w-10 h-10 sm:w-12 sm:h-12" />
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <p className="text-4xl font-mono font-bold tabular-nums text-foreground" data-testid="text-timer">
                      {formatTime(elapsed)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {phase === "recording" ? "Recording..." : "Paused"}
                    </p>
                  </motion.div>

                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 max-w-xs" data-testid="warning-stay-on-screen">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Keep this screen open while recording. Switching apps (especially on iPhone) may stop the recording.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {phase === "recording" ? (
                      <Button
                        variant="outline"
                        onClick={pauseRecording}
                        data-testid="button-pause-recording"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={resumeRecording}
                        data-testid="button-resume-recording"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={stopRecording}
                      data-testid="button-stop-recording"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop & Save
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {phase === "saving" && (
            <motion.div
              key="save-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground" data-testid="text-recording-duration">
                    Recording complete - {formatTime(elapsed)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ready to save and process</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="quick-title" className="text-sm font-medium">Title</Label>
                <Input
                  id="quick-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Call with John"
                  className="rounded-xl"
                  data-testid="input-quick-title"
                />
              </div>

              {isOnline && clients && clients.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Client (optional)</Label>
                  <Select value={selectedClientId} onValueChange={(v) => {
                    setSelectedClientId(v);
                    setConsentStatus("not_asked");
                    if (v) {
                      setTimeout(() => setConsentDialogOpen(true), 150);
                    }
                  }}>
                    <SelectTrigger className="rounded-xl" data-testid="select-quick-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)} data-testid={`select-quick-client-option-${client.id}`}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    setPhase("ready");
                    setAudioFile(null);
                    setElapsed(0);
                    setTitle("");
                  }}
                  disabled={isPending}
                  data-testid="button-discard"
                >
                  Discard
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  onClick={handleSave}
                  disabled={isPending || !title.trim()}
                  data-testid="button-save-recording"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      {!isOnline ? "Saving..." : "Processing..."}
                    </>
                  ) : !isOnline ? (
                    <>
                      <WifiOff className="mr-2 w-4 h-4" />
                      Save for Later
                    </>
                  ) : (
                    "Save & Process"
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
              data-testid="button-quick-consent-yes"
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
              data-testid="button-quick-consent-no"
            >
              No
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
