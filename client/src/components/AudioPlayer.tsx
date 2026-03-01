import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";
import WaveSurfer from "wavesurfer.js";

interface AudioPlayerProps {
  url: string;
}

export function AudioPlayer({ url }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformReady, setWaveformReady] = useState(false);
  const [waveformFailed, setWaveformFailed] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const resolvedUrl = url.startsWith("http") || url.startsWith("/") ? url : `/${url}`;

  useEffect(() => {
    if (!containerRef.current || !audioRef.current) return;

    try {
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
        media: audioRef.current,
      });

      wavesurfer.current.on("ready", () => {
        setWaveformReady(true);
      });
      wavesurfer.current.on("error", () => {
        setWaveformFailed(true);
      });
    } catch {
      setWaveformFailed(true);
    }

    return () => {
      wavesurfer.current?.destroy();
    };
  }, [resolvedUrl]);

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setAudioReady(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border p-4 shadow-sm">
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="metadata"
        onLoadedMetadata={handleAudioLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setAudioReady(false)}
        data-testid="audio-element"
      />

      {!waveformFailed && (
        <div ref={containerRef} className="w-full mb-4" />
      )}

      {waveformFailed && (
        <audio
          controls
          src={resolvedUrl}
          preload="metadata"
          className="w-full mb-4"
          data-testid="audio-fallback-player"
        />
      )}

      {!waveformFailed && !audioReady && !waveformReady && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading audio...
        </div>
      )}

      {!waveformFailed && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              disabled={!audioReady}
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
      )}
    </div>
  );
}
