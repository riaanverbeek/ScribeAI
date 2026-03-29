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
import { Mic, Square, ChevronLeft, Loader2, Phone, WifiOff, Check, Pause, Play, ShieldCheck, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type Phase = "ready" | "continue" | "recording" | "paused" | "saving";

function getFileExtensionFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("ogg")) return ".ogg";
  return ".webm";
}

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
  const animFrameRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (recorder.hasRecoverableRecording && phase === "ready") {
      setElapsed(recorder.recoverableElapsed);
      setPhase("continue");
    }
  }, [recorder.hasRecoverableRecording, recorder.recoverableElapsed, phase]);

  useEffect(() => {
    recorder.setElapsedRef(elapsed);
  }, [elapsed, recorder.setElapsedRef]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastLevel = 0;
    const bars = 40;
    const barHeights = new Float32Array(bars);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const level = recorder.audioLevel;
      lastLevel = lastLevel * 0.7 + level * 0.3;

      for (let i = bars - 1; i > 0; i--) {
        barHeights[i] = barHeights[i - 1];
      }
      barHeights[0] = lastLevel;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue("--primary").trim();
      ctx.fillStyle = primary ? `hsl(${primary})` : "#6366f1";

      const barWidth = w / bars - 2;
      for (let i = 0; i < bars; i++) {
        const barH = Math.max(2, barHeights[i] * h * 0.9);
        const x = i * (barWidth + 2);
        const y = (h - barH) / 2;
        ctx.fillRect(x, y, barWidth, barH);
      }
    };

    draw();
  }, [recorder.audioLevel]);

  const startRecording = async () => {
    try {
      await recorder.startRecording();

      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err: any) {
      const errType = recorder.errorType;
      let title = "Recording Failed";
      let description = err?.message || "An unexpected error occurred.";

      if (errType === "unsupported" || errType === "no_mediadevices") {
        title = "Recording Not Supported";
        description = err?.message + " You can create a new session and upload an audio file instead.";
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

    const blob = await recorder.stopRecording();
    const ext = recorder.recordingExtension || ".webm";
    const mime = recorder.recordingMimeType || "audio/webm";
    const file = new File([blob], `phone-call${ext}`, { type: mime });
    setAudioFile(file);

    const now = new Date();
    setTitle(`Quick Record - ${format(now, "MMM d, yyyy h:mm a")}`);
    setPhase("saving");
  };

  const handleContinueRecording = async () => {
    try {
      const { totalElapsed } = await recorder.startContinueRecording();

      setPhase("recording");
      setElapsed(totalElapsed);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err: any) {
      const errType = recorder.errorType;
      let title = "Recording Failed";
      let description = err?.message || "An unexpected error occurred.";

      if (errType === "unsupported" || errType === "no_mediadevices") {
        title = "Recording Not Supported";
        description = err?.message + " You can create a new session and upload an audio file instead.";
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
  };

  const handleSaveRecovered = async () => {
    const recovered = await recorder.recoverRecording();
    if (recovered) {
      const ext = getFileExtensionFromMime(recovered.mimeType);
      const file = new File([recovered.blob], `recovered-call${ext}`, { type: recovered.mimeType });
      setAudioFile(file);
      setElapsed(recovered.elapsed);
      const now = new Date();
      setTitle(`Quick Record - ${format(now, "MMM d, yyyy h:mm a")}`);
      setPhase("saving");
    } else {
      toast({
        title: "Recovery Failed",
        description: "The interrupted recording could not be recovered.",
        variant: "destructive",
      });
      setElapsed(0);
      setPhase("ready");
    }
  };

  const handleDiscardRecovery = async () => {
    await recorder.discardRecovery();
    setElapsed(0);
    setPhase("ready");
    toast({ title: "Recording discarded" });
  };

  const [failedMeetingId, setFailedMeetingId] = useState<number | null>(null);

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
          outputLanguage: "english",
          isInternal: false,
          policyIds: [],
        });
        await recorder.clearRecoveryData();
        toast({
          title: "Saved Offline",
          description: "Your recording will upload when you're back online.",
        });
        setLocation("/");
        return;
      }

      const meetingId = failedMeetingId;
      let meeting: any;

      if (meetingId) {
        meeting = { id: meetingId };
      } else {
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
        meeting = await createMutation.mutateAsync(meetingData);
      }

      try {
        await uploadMutation.mutateAsync({ id: meeting.id, file: audioFile });
      } catch {
        setFailedMeetingId(meeting.id);
        toast({
          title: "Upload Failed",
          description: "The audio upload failed. Your recording is safe — tap \"Save & Process\" to retry.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      setFailedMeetingId(null);
      await recorder.clearRecoveryData();
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
    };
  }, []);

  const isPending = isSaving || createMutation.isPending || uploadMutation.isPending;

  const pulseScale = 1 + recorder.audioLevel * 1.2;

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
            {phase === "continue" && "Your previous recording can be continued"}
            {phase === "recording" && "Recording in progress..."}
            {phase === "paused" && "Recording paused"}
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
          {phase === "continue" && (
            <motion.div
              key="continue"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-full rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-5" data-testid="banner-continue-session">
                <div className="flex items-start gap-3">
                  <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      Interrupted recording found
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      {formatTime(recorder.recoverableElapsed)} of audio was captured before the interruption.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-4xl font-mono font-bold tabular-nums text-foreground" data-testid="text-recovered-time">
                  {formatTime(elapsed)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">previously captured</p>
              </div>

              <Button
                onClick={handleContinueRecording}
                variant="default"
                className="w-full rounded-xl py-6 text-base"
                data-testid="button-continue-recording"
              >
                <Mic className="w-5 h-5 mr-2" />
                Continue Recording
              </Button>

              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={handleSaveRecovered}
                  data-testid="button-save-recovered"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Save what was captured
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl"
                  onClick={handleDiscardRecovery}
                  data-testid="button-discard-recovery"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Discard
                </Button>
              </div>
            </motion.div>
          )}

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
                  {recorder.error && (
                    <div className="w-full max-w-xs rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 mb-2" data-testid="banner-recording-error">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 dark:text-red-200">
                            {recorder.errorType === "unsupported" || recorder.errorType === "no_mediadevices"
                              ? "Recording Not Available"
                              : "Recording Failed"}
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1">{recorder.error}</p>
                          {(recorder.errorType === "unsupported" || recorder.errorType === "no_mediadevices") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3"
                              onClick={() => setLocation("/meeting/new")}
                              data-testid="button-go-upload"
                            >
                              Upload Audio Instead
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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
                  <div className="relative flex items-center justify-center">
                    {phase === "recording" && (
                      <>
                        <motion.div
                          className="absolute rounded-full bg-red-500/5"
                          style={{ width: 200, height: 200 }}
                          animate={{ scale: pulseScale * 1.5, opacity: 0.15 + recorder.audioLevel * 0.3 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        />
                        <motion.div
                          className="absolute rounded-full bg-red-500/10"
                          style={{ width: 170, height: 170 }}
                          animate={{ scale: pulseScale * 1.25, opacity: 0.25 + recorder.audioLevel * 0.4 }}
                          transition={{ duration: 0.1 }}
                        />
                        <motion.div
                          className="absolute rounded-full bg-red-500/20"
                          style={{ width: 145, height: 145 }}
                          animate={{ scale: pulseScale, opacity: 0.35 + recorder.audioLevel * 0.35 }}
                          transition={{ duration: 0.1 }}
                        />
                      </>
                    )}
                    <div
                      className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center ${
                        phase === "recording"
                          ? "bg-red-500 text-white"
                          : "bg-amber-500 shadow-lg shadow-amber-500/30 text-white"
                      } transition-colors duration-300`}
                      style={phase === "recording" ? {
                        transform: `scale(${1 + recorder.audioLevel * 0.15})`,
                        transition: "transform 0.1s ease-out",
                        boxShadow: `0 0 ${20 + recorder.audioLevel * 40}px ${8 + recorder.audioLevel * 20}px rgba(239, 68, 68, ${0.3 + recorder.audioLevel * 0.4})`
                      } : undefined}
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
                    {recorder.segmentCount > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1" data-testid="text-segment-count">
                        {recorder.segmentCount} segment{recorder.segmentCount !== 1 ? "s" : ""} saved
                      </p>
                    )}
                  </motion.div>

                  {recorder.autoRestarted && (
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 max-w-xs" data-testid="banner-auto-restarted">
                      <RotateCcw className="w-4 h-4 text-blue-500 shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        Recording was interrupted and automatically resumed. Your previous audio is saved.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 max-w-xs" data-testid="warning-stay-on-screen">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      If a call interrupts your recording, it will be saved and resumed automatically.
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
              {failedMeetingId && (
                <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3" data-testid="banner-upload-failed">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900 dark:text-red-200">Upload Failed</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                      The audio upload failed. Your recording is safe — tap "Save & Process" to retry.
                    </p>
                  </div>
                </div>
              )}
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
                    setFailedMeetingId(null);
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
