import { useRef, useCallback, useState, useEffect } from "react";
import {
  saveInProgressChunks,
  getInProgressRecording,
  deleteInProgressRecording,
  saveSegment,
  getSegmentCount,
  clearSegments,
  combineSegmentsWithCurrentChunks,
  getSegments,
  type InProgressRecording,
} from "@/lib/offlineDb";
import { reportError } from "@/lib/logError";
import { invalidateRecoveryState } from "@/hooks/use-recovery";
import { Capacitor } from "@capacitor/core";
import { VoiceRecorder } from "capacitor-voice-recorder";

const IS_NATIVE = Capacitor.isNativePlatform();

interface VoiceRecorderResult {
  value: {
    recordDataBase64: string;
    mimeType: string;
    msDuration: number;
  };
}

interface VoiceRecorderPermissionResult {
  value: boolean;
}

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export type RecordingErrorType =
  | "unsupported"
  | "no_mediadevices"
  | "permission_denied"
  | "not_found"
  | "not_readable"
  | "aborted"
  | "unknown";

const RECORDER_TIMESLICE_MS = 1000;

const IOS_MIME_PREFERENCES = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
];

const MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const AUTO_SAVE_INTERVAL_MS = 5000;

function isIOS(): boolean {
  return typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/i.test(navigator.userAgent) &&
    !("MSStream" in window);
}

/**
 * Returns the MIME type to use for recording:
 * - A non-empty string → use as explicit mimeType
 * - ""               → iOS browser-default (omit mimeType from constructor)
 * - null             → MediaRecorder not available at all
 *
 * On iOS, mp4 variants are tried first. If none are reported as supported
 * (can happen on some iOS versions despite actually working), we return ""
 * so the MediaRecorder constructor uses its own default, which is reliable
 * on iOS Safari even when isTypeSupported gives false negatives.
 */
function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const onIOS = isIOS();
  const prefs = onIOS ? [...IOS_MIME_PREFERENCES, ...MIME_PREFERENCES] : MIME_PREFERENCES;
  for (const mime of prefs) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  if (onIOS) return "";
  return null;
}

/** Build MediaRecorderOptions — omit mimeType entirely when empty/null so iOS uses its own default. */
function makeRecorderOptions(mime: string | null): MediaRecorderOptions {
  return mime ? { mimeType: mime } : {};
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
  const [segmentCount, setSegmentCount] = useState(0);
  const [autoRestarted, setAutoRestarted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isAutoRestartingRef = useRef(false);
  const onSegmentSavedRef = useRef<((count: number) => void) | null>(null);
  const nativeRecordingRef = useRef(false);
  const nativePulsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativePulsPhaseRef = useRef(0);

  useEffect(() => {
    const checkRecovery = async () => {
      try {
        const rec = await getInProgressRecording();
        const segments = await getSegments();
        const hasInProgress = !!(rec && rec.chunks && rec.chunks.length > 0);
        const hasSegments = segments.length > 0;

        if (hasInProgress || hasSegments) {
          setHasRecoverableRecording(true);
          let totalElapsed = 0;
          if (hasInProgress && rec) {
            totalElapsed = rec.elapsed || 0;
          } else {
            for (const seg of segments) totalElapsed += seg.elapsed || 0;
          }
          setRecoverableElapsed(totalElapsed);
        }
      } catch {}
    };
    checkRecovery();
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

  const startNativePulse = useCallback(() => {
    if (nativePulsTimerRef.current) clearInterval(nativePulsTimerRef.current);
    nativePulsPhaseRef.current = 0;
    nativePulsTimerRef.current = setInterval(() => {
      nativePulsPhaseRef.current += 0.12;
      const level = 0.25 + 0.25 * Math.sin(nativePulsPhaseRef.current);
      setAudioLevel(level);
    }, 80);
  }, []);

  const stopNativePulse = useCallback(() => {
    if (nativePulsTimerRef.current) {
      clearInterval(nativePulsTimerRef.current);
      nativePulsTimerRef.current = null;
    }
    setAudioLevel(0);
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

  const segmentElapsedStartRef = useRef<number>(0);

  const saveCurrentAsSegment = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    try {
      const segmentDuration = elapsedRef.current - segmentElapsedStartRef.current;
      await saveSegment(
        [...chunksRef.current],
        mimeTypeRef.current,
        Math.max(0, segmentDuration)
      );
      segmentElapsedStartRef.current = elapsedRef.current;
      const count = await getSegmentCount();
      setSegmentCount(count);
      onSegmentSavedRef.current?.(count);
      chunksRef.current = [];
      await deleteInProgressRecording().catch(() => {});
    } catch (e) {
      console.warn("Failed to save segment:", e);
    }
  }, []);

  const attemptAutoRestart = useCallback(async () => {
    if (isAutoRestartingRef.current) return;
    isAutoRestartingRef.current = true;

    try {
      await saveCurrentAsSegment();

      const supportedMime = getSupportedMimeType();
      if (supportedMime === null) {
        isAutoRestartingRef.current = false;
        return false;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        isAutoRestartingRef.current = false;
        return false;
      }

      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, makeRecorderOptions(supportedMime));
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      mimeTypeRef.current = recorder.mimeType || supportedMime || "audio/mp4";

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        console.error("MediaRecorder error after auto-restart — saving segment");
        reportError("MediaRecorder onerror fired after auto-restart", "MediaRecorder:onerror:autorestart");
        stopAutoSave();
        cleanupAudioContext();
        attemptAutoRestart().then((restarted) => {
          if (!restarted) {
            flushToIndexedDB();
            setState("idle");
          }
        }).catch(() => {
          flushToIndexedDB();
          setState("idle");
        });
      };

      recorder.start(RECORDER_TIMESLICE_MS);
      setState("recording");
      setAutoRestarted(true);
      startAudioLevelMonitoring(stream);
      startAutoSave();

      isAutoRestartingRef.current = false;
      return true;
    } catch (e) {
      console.error("Auto-restart failed:", e);
      isAutoRestartingRef.current = false;
      return false;
    }
  }, [saveCurrentAsSegment, stopAutoSave, cleanupAudioContext, startAudioLevelMonitoring, startAutoSave]);

  const startRecording = useCallback(async (): Promise<MediaStream> => {
    setError(null);
    setErrorType(null);
    setAutoRestarted(false);

    if (IS_NATIVE) {
      let permissionDenied = false;
      try {
        const permResult = await VoiceRecorder.requestAudioRecordingPermission() as VoiceRecorderPermissionResult;
        if (permResult && permResult.value === false) {
          permissionDenied = true;
          const msg = "Microphone permission was denied. Please allow it in your device Settings.";
          setError(msg);
          setErrorType("permission_denied");
          reportError(msg, "startRecording:native:permission_denied");
          throw new Error(msg);
        }
        await VoiceRecorder.startRecording();
        nativeRecordingRef.current = true;
        elapsedRef.current = 0;
        await deleteInProgressRecording().catch(() => {});
        await clearSegments().catch(() => {});
        setHasRecoverableRecording(false);
        setSegmentCount(0);
        setState("recording");
        startNativePulse();
        return new MediaStream();
      } catch (err: unknown) {
        if (permissionDenied) throw err;
        const msg = err instanceof Error ? err.message : "Native recording failed to start.";
        setError(msg);
        setErrorType("unknown");
        reportError(msg, "startRecording:native");
        throw new Error(msg);
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Your browser does not support microphone access. This can happen when using the home screen app on older iPhones. Please open the app in Safari or Chrome instead, or upload an audio file.";
      setError(msg);
      setErrorType("no_mediadevices");
      reportError(msg, "startRecording:no_mediadevices");
      throw new Error(msg);
    }

    const supportedMime = getSupportedMimeType();
    if (supportedMime === null) {
      const msg = "Your browser does not support audio recording. Please use the file upload option instead, or try a different browser.";
      setError(msg);
      setErrorType("unsupported");
      reportError(msg, "startRecording:unsupported_mime");
      throw new Error(msg);
    }

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

    const recorder = new MediaRecorder(stream, makeRecorderOptions(supportedMime));
    mimeTypeRef.current = recorder.mimeType || supportedMime || "audio/mp4";

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    elapsedRef.current = 0;
    segmentElapsedStartRef.current = 0;
    setSegmentCount(0);

    await deleteInProgressRecording().catch(() => {});
    await clearSegments().catch(() => {});
    setHasRecoverableRecording(false);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onerror = () => {
      console.error("MediaRecorder error — attempting auto-restart");
      reportError("MediaRecorder onerror fired during recording", "MediaRecorder:onerror");
      stopAutoSave();
      cleanupAudioContext();
      attemptAutoRestart().then((restarted) => {
        if (!restarted) {
          flushToIndexedDB();
          setState("idle");
        }
      });
    };

    recorder.start(RECORDER_TIMESLICE_MS);
    setState("recording");

    startAudioLevelMonitoring(stream);
    startAutoSave();

    return stream;
  }, [flushToIndexedDB, startAutoSave, stopAutoSave, startAudioLevelMonitoring, cleanupAudioContext, attemptAutoRestart, startNativePulse]);

  const pauseRecording = useCallback((): void => {
    if (IS_NATIVE && nativeRecordingRef.current) {
      if (typeof VoiceRecorder.pauseRecording === "function") {
        VoiceRecorder.pauseRecording().then(() => {
          setState("paused");
          stopNativePulse();
        }).catch((e: unknown) => {
          console.warn("Native pauseRecording failed:", e instanceof Error ? e.message : e);
        });
      } else {
        console.warn("VoiceRecorder.pauseRecording is not available on this platform.");
      }
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      setState("paused");
      stopAudioLevelMonitoring();
      flushToIndexedDB();
    }
  }, [stopAudioLevelMonitoring, flushToIndexedDB, stopNativePulse]);

  const resumeRecording = useCallback((): void => {
    if (IS_NATIVE && nativeRecordingRef.current) {
      if (typeof VoiceRecorder.resumeRecording === "function") {
        VoiceRecorder.resumeRecording().then(() => {
          setState("recording");
          startNativePulse();
        }).catch((e: unknown) => {
          console.warn("Native resumeRecording failed:", e instanceof Error ? e.message : e);
        });
      } else {
        console.warn("VoiceRecorder.resumeRecording is not available on this platform.");
      }
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      setState("recording");
      if (streamRef.current) {
        startAudioLevelMonitoring(streamRef.current);
      }
    }
  }, [startAudioLevelMonitoring, startNativePulse]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    if (IS_NATIVE && nativeRecordingRef.current) {
      stopNativePulse();
      try {
        const result = await VoiceRecorder.stopRecording() as VoiceRecorderResult;
        const { recordDataBase64: base64, mimeType } = result.value;
        nativeRecordingRef.current = false;
        setState("stopped");

        if (!base64) return new Blob();
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        mimeTypeRef.current = mimeType;
        return new Blob([bytes], { type: mimeType });
      } catch (err: unknown) {
        nativeRecordingRef.current = false;
        setState("stopped");
        const msg = err instanceof Error ? err.message : "Native stopRecording failed";
        reportError(msg, "stopRecording:native");
        return new Blob();
      }
    }

    const recorder = mediaRecorderRef.current;

    stopAutoSave();
    cleanupAudioContext();

    if (!recorder || (recorder.state !== "recording" && recorder.state !== "paused")) {
      const segments = await getSegments();
      if (segments.length > 0) {
        const { blob } = await combineSegmentsWithCurrentChunks([], mimeTypeRef.current);
        setState("stopped");
        return blob;
      }
      setState("stopped");
      return new Blob();
    }

    return new Promise(async (resolve) => {
      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setState("stopped");

        const segments = await getSegments();
        if (segments.length > 0) {
          const { blob } = await combineSegmentsWithCurrentChunks(chunksRef.current, mimeTypeRef.current);
          await flushToIndexedDB().catch(() => {});
          resolve(blob);
        } else {
          const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
          await flushToIndexedDB().catch(() => {});
          resolve(blob);
        }
      };

      recorder.stop();
    });
  }, [stopAutoSave, cleanupAudioContext, flushToIndexedDB, stopNativePulse]);

  const startContinueRecording = useCallback(async (): Promise<{ stream: MediaStream; totalElapsed: number }> => {
    setError(null);
    setErrorType(null);
    setAutoRestarted(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Your browser does not support microphone access. This can happen when using the home screen app on older iPhones. Please open the app in Safari or Chrome instead, or upload an audio file.";
      setError(msg);
      setErrorType("no_mediadevices");
      reportError(msg, "startContinueRecording:no_mediadevices");
      throw new Error(msg);
    }

    const supportedMime = getSupportedMimeType();
    if (supportedMime === null) {
      const msg = "Your browser does not support audio recording. Please use the file upload option instead, or try a different browser.";
      setError(msg);
      setErrorType("unsupported");
      reportError(msg, "startContinueRecording:unsupported_mime");
      throw new Error(msg);
    }

    const inProgress = await getInProgressRecording().catch(() => undefined);
    let recoveredElapsed = 0;

    const segments = await getSegments().catch(() => []);
    const segmentsElapsedSum = segments.reduce((sum, s) => sum + (s.elapsed || 0), 0);

    if (inProgress && inProgress.chunks && inProgress.chunks.length > 0) {
      recoveredElapsed = inProgress.elapsed || 0;
      const inProgressDelta = Math.max(0, recoveredElapsed - segmentsElapsedSum);
      const blobs = inProgress.chunks.map(buf => new Blob([buf], { type: inProgress.mimeType }));
      await saveSegment(blobs, inProgress.mimeType, inProgressDelta).catch(() => {});
      await deleteInProgressRecording().catch(() => {});
    } else {
      recoveredElapsed = segmentsElapsedSum;
    }

    const segCount = await getSegmentCount().catch(() => 0);
    setSegmentCount(segCount);

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
      reportError(`getUserMedia failed: ${errDetail}`, `startContinueRecording:${classified.type}`);
      throw new Error(classified.message);
    }

    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, makeRecorderOptions(supportedMime));
    mimeTypeRef.current = recorder.mimeType || supportedMime || "audio/mp4";
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    elapsedRef.current = recoveredElapsed;
    segmentElapsedStartRef.current = recoveredElapsed;
    setHasRecoverableRecording(false);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onerror = () => {
      console.error("MediaRecorder error — attempting auto-restart");
      reportError("MediaRecorder onerror fired during continue recording", "MediaRecorder:onerror:continue");
      stopAutoSave();
      cleanupAudioContext();
      attemptAutoRestart().then((restarted) => {
        if (!restarted) {
          flushToIndexedDB();
          setState("idle");
        }
      });
    };

    recorder.start(RECORDER_TIMESLICE_MS);
    setState("recording");

    startAudioLevelMonitoring(stream);
    startAutoSave();

    return { stream, totalElapsed: recoveredElapsed };
  }, [flushToIndexedDB, startAutoSave, stopAutoSave, startAudioLevelMonitoring, cleanupAudioContext, attemptAutoRestart]);

  const clearRecoveryData = useCallback(async () => {
    await deleteInProgressRecording().catch(() => {});
    await clearSegments().catch(() => {});
    setHasRecoverableRecording(false);
    setSegmentCount(0);
    invalidateRecoveryState();
  }, []);

  const recoverRecording = useCallback(async (): Promise<{ blob: Blob; mimeType: string; elapsed: number } | null> => {
    try {
      const segments = await getSegments();
      const inProgress = await getInProgressRecording();

      const hasSegments = segments.length > 0;
      const hasInProgress = !!(inProgress && inProgress.chunks && inProgress.chunks.length > 0);

      if (!hasSegments && !hasInProgress) {
        setHasRecoverableRecording(false);
        invalidateRecoveryState();
        return null;
      }

      const allBlobs: Blob[] = [];
      let totalElapsed = 0;
      let mimeType = "audio/webm";

      for (const segment of segments) {
        mimeType = segment.mimeType;
        for (const buf of segment.chunks) {
          allBlobs.push(new Blob([buf], { type: segment.mimeType }));
        }
        totalElapsed += segment.elapsed;
      }

      if (hasInProgress) {
        mimeType = inProgress!.mimeType;
        for (const buf of inProgress!.chunks) {
          allBlobs.push(new Blob([buf], { type: inProgress!.mimeType }));
        }
        if (hasSegments) {
          totalElapsed = inProgress!.elapsed || totalElapsed;
        } else {
          totalElapsed = inProgress!.elapsed || 0;
        }
      }

      const blob = new Blob(allBlobs, { type: mimeType });

      await deleteInProgressRecording().catch(() => {});
      await clearSegments().catch(() => {});
      setHasRecoverableRecording(false);
      setSegmentCount(0);
      invalidateRecoveryState();

      return { blob, mimeType, elapsed: totalElapsed };
    } catch {
      setHasRecoverableRecording(false);
      invalidateRecoveryState();
      return null;
    }
  }, []);

  const discardRecovery = useCallback(async () => {
    await deleteInProgressRecording().catch(() => {});
    await clearSegments().catch(() => {});
    setHasRecoverableRecording(false);
    setSegmentCount(0);
    invalidateRecoveryState();
  }, []);

  const setElapsedRef = useCallback((elapsed: number) => {
    elapsedRef.current = elapsed;
  }, []);

  useEffect(() => {
    return () => {
      stopAutoSave();
      cleanupAudioContext();
      stopNativePulse();
    };
  }, [stopAutoSave, cleanupAudioContext, stopNativePulse]);

  const recordingMimeType = mimeTypeRef.current;
  const recordingExtension = getFileExtension(mimeTypeRef.current);

  return {
    state,
    error,
    errorType,
    audioLevel,
    hasRecoverableRecording,
    recoverableElapsed,
    segmentCount,
    autoRestarted,
    startRecording,
    startContinueRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    recoverRecording,
    discardRecovery,
    clearRecoveryData,
    setElapsedRef,
    recordingMimeType,
    recordingExtension,
    onSegmentSavedRef,
  };
}
