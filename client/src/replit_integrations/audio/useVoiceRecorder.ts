/**
 * React hook for voice recording using MediaRecorder API.
 * Auto-detects supported audio format (WebM/Opus preferred, MP4/AAC fallback for iOS Safari).
 * Supports pause and resume.
 */
import { useRef, useCallback, useState } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

const MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of MIME_PREFERENCES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("ogg")) return ".ogg";
  return ".webm";
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");

  const startRecording = useCallback(async (): Promise<void> => {
    setError(null);

    const supportedMime = getSupportedMimeType();
    if (!supportedMime) {
      const msg = "Your browser does not support audio recording. Please use the file upload option instead, or try a different browser.";
      setError(msg);
      throw new Error(msg);
    }

    mimeTypeRef.current = supportedMime;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime,
    });

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(100);
    setState("recording");
  }, []);

  const pauseRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setState("paused");
    }
  }, []);

  const resumeRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setState("recording");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || (recorder.state !== "recording" && recorder.state !== "paused")) {
        resolve(new Blob());
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        recorder.stream.getTracks().forEach((t) => t.stop());
        setState("stopped");
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const recordingMimeType = mimeTypeRef.current;
  const recordingExtension = getFileExtension(mimeTypeRef.current);

  return { state, error, startRecording, pauseRecording, resumeRecording, stopRecording, recordingMimeType, recordingExtension };
}
