import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
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

  const resolvedUrl = url.startsWith("http") || url.startsWith("/") ? url : `/${url}`;

  useEffect(() => {
    if (!containerRef.current) return;

    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#cbd5e1", // slate-300
      progressColor: "#f59e0b", // amber-500
      cursorColor: "#0f172a", // slate-900
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 64,
      normalize: true,
      url: resolvedUrl,
    });

    wavesurfer.current.on("play", () => setIsPlaying(true));
    wavesurfer.current.on("pause", () => setIsPlaying(false));
    wavesurfer.current.on("ready", (d) => setDuration(d));
    wavesurfer.current.on("timeupdate", (t) => setCurrentTime(t));

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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div ref={containerRef} className="w-full mb-4" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
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
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
