import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateMeeting, useUploadAudio, useProcessMeeting } from "@/hooks/use-meetings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, UploadCloud, ChevronLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/replit_integrations/audio";
import { motion } from "framer-motion";

export default function NewMeeting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const createMutation = useCreateMeeting();
  const uploadMutation = useUploadAudio();
  const processMutation = useProcessMeeting();
  
  // Replit Integration Recorder
  const recorder = useVoiceRecorder();

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please give your meeting a name.", variant: "destructive" });
      return;
    }

    try {
      // 1. Create meeting entry
      const meeting = await createMutation.mutateAsync({ 
        title,
        date: new Date().toISOString()
      });

      // 2. Upload Audio
      let audioFile = file;

      if (recorder.state === "stopped") {
         // This assumes useVoiceRecorder has a way to get the blob, 
         // but the provided integration hook returns a promise from stopRecording.
         // Since we handle stopRecording in the UI, we need to store the blob in state.
         // Let's adjust the UI to handle this.
      } else if (!file) {
        toast({ title: "Audio Required", description: "Please record or upload audio.", variant: "destructive" });
        return;
      }

      if (audioFile) {
        await uploadMutation.mutateAsync({ id: meeting.id, file: audioFile });
      }

      // 3. Trigger processing
      await processMutation.mutateAsync(meeting.id);

      // 4. Redirect
      setLocation(`/meeting/${meeting.id}`);

    } catch (error) {
      // Errors handled by mutation hooks
    }
  };

  const handleStopRecording = async () => {
    const blob = await recorder.stopRecording();
    const recordedFile = new File([blob], "recording.webm", { type: "audio/webm" });
    setFile(recordedFile);
    toast({ title: "Recording Saved", description: "Ready to process." });
  };

  const isPending = createMutation.isPending || uploadMutation.isPending;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto min-h-screen">
      <Button 
        variant="ghost" 
        className="mb-6 pl-0 hover:bg-transparent hover:text-primary"
        onClick={() => setLocation("/")}
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">New Meeting</h1>
        <p className="text-slate-500 mt-1">Record a conversation or upload an existing file.</p>
      </div>

      <div className="grid gap-8">
        {/* Title Input */}
        <div className="space-y-3">
          <Label htmlFor="title" className="text-base font-semibold text-slate-900">Meeting Title</Label>
          <Input 
            id="title"
            placeholder="e.g. Q4 Marketing Strategy"
            className="h-12 text-lg rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Audio Input Tabs */}
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

            {/* Record Tab */}
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

            {/* Upload Tab */}
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
