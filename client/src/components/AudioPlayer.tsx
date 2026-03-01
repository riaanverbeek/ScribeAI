import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, AlertCircle, Loader2 } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  const resolvedUrl = url.startsWith("http") || url.startsWith("/") ? url : `/${url}`;

  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);
    setError(null);

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
      url: resolvedUrl,
      fetchParams: {
        credentials: "include",
      },
    });

    wavesurfer.current.on("play", () => setIsPlaying(true));
    wavesurfer.current.on("pause", () => setIsPlaying(false));
    wavesurfer.current.on("ready", (d) => {
      setDuration(d);
      setIsLoading(false);
    });
    wavesurfer.current.on("timeupdate", (t) => setCurrentTime(t));
    wavesurfer.current.on("error", (err) => {
      console.error("WaveSurfer error:", err);
      setError(typeof err === "string" ? err : "Failed to load audio");
      setIsLoading(false);
    });

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [resolvedUrl]);

  const togglePlay = () => {
    wavesurfer.current?.playPause();
  };

  const toggleMute = () => {
    if (wavesurfer.current) {
      wavesurfer.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-4 shadow-sm">
        <div className="flex items-center gap-3 text-amber-600 mb-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Waveform unavailable — use the player below</p>
        </div>
        <audio
          controls
          src={resolvedUrl}
          className="w-full"
          data-testid="audio-fallback-player"
        >
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-4 shadow-sm">
      <div ref={containerRef} className="w-full mb-4" />
      
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading audio...
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 disabled:opacity-50"
            data-testid="button-audio-play"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          
          <div className="font-mono text-sm text-slate-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <button
          onClick={toggleMute}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-muted text-slate-500 transition-colors"
          data-testid="button-audio-mute"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
