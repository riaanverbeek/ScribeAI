import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react";
import WaveSurfer from "wavesurfer.js";

interface AudioPlayerProps {
  url: string;
}

export function AudioPlayer({ url }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [wsError, setWsError] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);

  const resolvedUrl = url.startsWith("http") || url.startsWith("/") ? url : `/${url}`;

  useEffect(() => {
    let cancelled = false;

    async function resolveAudioUrl() {
      try {
        const resp = await fetch(resolvedUrl, {
          credentials: "include",
          headers: { "Accept": "application/json" },
        });
        if (!resp.ok) {
          setResolveError(true);
          setIsLoading(false);
          return;
        }
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await resp.json();
          if (!cancelled && data.url) {
            setAudioSrc(data.url);
          }
        } else {
          if (!cancelled) {
            setAudioSrc(resolvedUrl);
          }
        }
      } catch {
        if (!cancelled) {
          setResolveError(true);
          setIsLoading(false);
        }
      }
    }

    resolveAudioUrl();
    return () => { cancelled = true; };
  }, [resolvedUrl]);

  useEffect(() => {
    if (!containerRef.current || !audioSrc) return;

    setIsLoading(true);
    setWsError(false);

    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#cbd5e1",
      progressColor: "#f59e0b",
      cursorColor: "#0f172a",
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 64,
      normalize: true,
      url: audioSrc,
    });

    wavesurfer.current.on("play", () => setIsPlaying(true));
    wavesurfer.current.on("pause", () => setIsPlaying(false));
    wavesurfer.current.on("ready", (d) => {
      setDuration(d);
      setIsLoading(false);
    });
    wavesurfer.current.on("timeupdate", (t) => setCurrentTime(t));
    wavesurfer.current.on("error", () => {
      setWsError(true);
      setIsLoading(false);
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [audioSrc]);

  const togglePlay = useCallback(() => {
    wavesurfer.current?.playPause();
  }, []);

  const toggleMute = useCallback(() => {
    if (wavesurfer.current) {
      wavesurfer.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (resolveError) {
    return (
      <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-4 shadow-sm">
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Unable to load audio</p>
        </div>
      </div>
    );
  }

  if (!audioSrc) {
    return (
      <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading audio...
        </div>
      </div>
    );
  }

  if (wsError) {
    return (
      <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-4 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 text-amber-600 mb-3 min-w-0">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium truncate">Waveform unavailable — use the player below</p>
        </div>
        <div className="max-w-full overflow-hidden">
          <audio
            controls
            src={audioSrc}
            preload="metadata"
            className="w-full max-w-full"
            data-testid="audio-fallback-player"
          >
            Your browser does not support audio playback.
          </audio>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-4 shadow-sm overflow-hidden">
      <div ref={containerRef} className="w-full mb-4 min-w-0" />
      
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading audio...
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 disabled:opacity-50 shrink-0"
            data-testid="button-audio-play"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          
          <div className="font-mono text-sm text-slate-500 min-w-0 truncate">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <button
          onClick={toggleMute}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-muted text-slate-500 transition-colors shrink-0"
          data-testid="button-audio-mute"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
