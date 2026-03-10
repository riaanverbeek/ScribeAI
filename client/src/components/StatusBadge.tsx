import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, AlertCircle, UploadCloud } from "lucide-react";

type Status = "uploading" | "processing" | "completed" | "failed" | "retry_pending";

export function StatusBadge({ status: rawStatus }: { status: Status }) {
  const status = rawStatus === "retry_pending" ? "processing" : rawStatus;
  const styles = {
    uploading: "bg-blue-50 text-blue-700 border-blue-200",
    processing: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };

  const icons = {
    uploading: UploadCloud,
    processing: Loader2,
    completed: CheckCircle,
    failed: AlertCircle,
  };

  const Icon = icons[status];

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
      styles[status]
    )}>
      <Icon className={cn("w-3.5 h-3.5", status === "processing" && "animate-spin")} />
      <span className="capitalize">{status}</span>
    </div>
  );
}
