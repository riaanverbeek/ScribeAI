import { useRef, useCallback, useState, useEffect } from "react";
import {
  saveInProgressChunks,
  getInProgressRecording,
  deleteInProgressRecording,
  type InProgressRecording,
} from "@/lib/offlineDb";
import { reportError } from "@/lib/logError";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export type RecordingErrorType =
  | "unsupported"
  | "no_mediadevices"
  | "permission_denied"
  | "not_found"
  | "not_readable"
  | "aborted"
  | "unknown";

const MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const AUTO_SAVE_INTERVAL_MS = 5000;

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

function classifyMediaError(err: unknown): { type: RecordingErrorType; message: string } {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return {
          type: "permission_denied",
          message: "Microphone access was denied. Please allow microphone permission in your browser settings and try again.",
        };
      case "NotFoundError":
        return {
          type: "not_found",
          message: "No microphone was found on this device. Please connect a microphone and try again.",
        };
      case "NotReadableError":
        return {
          type: "not_readable",
          message: "Your microphone is being used by another app. Please close the other app and try again.",
        };
      case "AbortError":
        return {
          type: "aborted",
          message: "Microphone access was interrupted. This can happen on iPhones when using the home screen app. Please try again, or upload an audio file instead.",
        };
      case "OverconstrainedError":
        return {
          type: "not_found",
          message: "No suitable microphone was found. Please try again or upload an audio file instead.",
        };
      default:
        return {
          type: "unknown",
          message: `Microphone error: ${err.message || err.name}. Please try again or upload an audio file instead.`,
        };
    }
  }

  if (err instanceof Error && err.message) {
    return { type: "unknown", message: err.message };
  }

  return {
    type: "unknown",
    message: "An unexpected error occurred while accessing the microphone. Please try again or upload an audio file instead.",
  };
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<RecordingErrorType | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [hasRecoverableRecording, setHasRecoverableRecording] = useState(false);
  const [recoverableElapsed, setRecoverableElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    getInProgressRecording()
      .then((rec) => {
        if (rec && rec.chunks && rec.chunks.length > 0) {
          setHasRecoverableRecording(true);
          setRecoverableElapsed(rec.elapsed || 0);
        }
      })
      .catch(() => {});
  }, []);

  const flushToIndexedDB = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    try {
      await saveInProgressChunks(
        [...chunksRef.current],
        mimeTypeRef.current,
        elapsedRef.current
      );
    } catch (e) {
      console.warn("Auto-save to IndexedDB failed:", e);
    }
  }, []);

  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        setAudioLevel(avg);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.warn("Audio level monitoring failed:", e);
    }
  }, []);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const cleanupAudioContext = useCallback(() => {
    stopAudioLevelMonitoring();
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, [stopAudioLevelMonitoring]);

  const startAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setInterval(() => {
      flushToIndexedDB();
    }, AUTO_SAVE_INTERVAL_MS);
  }, [flushToIndexedDB]);

  const stopAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "hidden" && mediaRecorderRef.current?.state === "recording") {
      flushToIndexedDB();
    }
  }, [flushToIndexedDB]);

  const handlePageHide = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      flushToIndexedDB();
    }
  }, [flushToIndexedDB]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [handleVisibilityChange, handlePageHide]);

  const startRecording = useCallback(async (): Promise<MediaStream> => {
    setError(null);
    setErrorType(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Your browser does not support microphone access. This can happen when using the home screen app on older iPhones. Please open the app in Safari or Chrome instead, or upload an audio file.";
      setError(msg);
      setErrorType("no_mediadevices");
      reportError(msg, "startRecording:no_mediadevices");
      throw new Error(msg);
    }

    const supportedMime = getSupportedMimeType();
    if (!supportedMime) {
      const msg = "Your browser does not support audio recording. Please use the file upload option instead, or try a different browser.";
      setError(msg);
      setErrorType("unsupported");
      reportError(msg, "startRecording:unsupported_mime");
      throw new Error(msg);
    }

    mimeTypeRef.current = supportedMime;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (mediaErr) {
      const classified = classifyMediaError(mediaErr);
      setError(classified.message);
      setErrorType(classified.type);
      const errDetail = mediaErr instanceof DOMException
        ? `${mediaErr.name}: ${mediaErr.message}`
        : String(mediaErr);
      reportError(`getUserMedia failed: ${errDetail}`, `startRecording:${classified.type}`);
      throw new Error(classified.message);
    }

    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, {
      mimeType: supportedMime,
    });

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    elapsedRef.current = 0;

    await deleteInProgressRecording().catch(() => {});
    setHasRecoverableRecording(false);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onerror = () => {
      console.error("MediaRecorder error — saving chunks to IndexedDB");
      reportError("MediaRecorder onerror fired during recording", "MediaRecorder:onerror");
      flushToIndexedDB();
      stopAutoSave();
      cleanupAudioContext();
      setState("idle");
    };

    recorder.start(100);
    setState("recording");

    startAudioLevelMonitoring(stream);
    startAutoSave();

    return stream;
  }, [flushToIndexedDB, startAutoSave, stopAutoSave, startAudioLevelMonitoring, cleanupAudioContext]);

  const pauseRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setState("paused");
      stopAudioLevelMonitoring();
      flushToIndexedDB();
    }
  }, [stopAudioLevelMonitoring, flushToIndexedDB]);

  const resumeRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setState("recording");
      if (streamRef.current) {
        startAudioLevelMonitoring(streamRef.current);
      }
    }
  }, [startAudioLevelMonitoring]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || (recorder.state !== "recording" && recorder.state !== "paused")) {
        resolve(new Blob());
        return;
      }

      stopAutoSave();
      cleanupAudioContext();

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        recorder.stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setState("stopped");
        await flushToIndexedDB().catch(() => {});
        resolve(blob);
      };

      recorder.stop();
    });
  }, [stopAutoSave, cleanupAudioContext, flushToIndexedDB]);

  const clearRecoveryData = useCallback(async () => {
    await deleteInProgressRecording().catch(() => {});
    setHasRecoverableRecording(false);
  }, []);

  const recoverRecording = useCallback(async (): Promise<{ blob: Blob; mimeType: string; elapsed: number } | null> => {
    try {
      const rec = await getInProgressRecording();
      if (!rec || !rec.chunks || rec.chunks.length === 0) {
        setHasRecoverableRecording(false);
        return null;
      }

      const blob = new Blob(rec.chunks, { type: rec.mimeType });
      const result = { blob, mimeType: rec.mimeType, elapsed: rec.elapsed };
      await deleteInProgressRecording();
      setHasRecoverableRecording(false);
      return result;
    } catch {
      setHasRecoverableRecording(false);
      return null;
    }
  }, []);

  const discardRecovery = useCallback(async () => {
    await deleteInProgressRecording().catch(() => {});
    setHasRecoverableRecording(false);
  }, []);

  const setElapsedRef = useCallback((elapsed: number) => {
    elapsedRef.current = elapsed;
  }, []);

  useEffect(() => {
    return () => {
      stopAutoSave();
      cleanupAudioContext();
    };
  }, [stopAutoSave, cleanupAudioContext]);

  const recordingMimeType = mimeTypeRef.current;
  const recordingExtension = getFileExtension(mimeTypeRef.current);

  return {
    state,
    error,
    errorType,
    audioLevel,
    hasRecoverableRecording,
    recoverableElapsed,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    recoverRecording,
    discardRecovery,
    clearRecoveryData,
    setElapsedRef,
    recordingMimeType,
    recordingExtension,
  };
}
