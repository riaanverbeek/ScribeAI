import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Merge, Calendar } from "lucide-react";
import { format } from "date-fns";

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMeetings: { id: number; title: string; date: string | Date; status: string }[];
  onMergeComplete: (targetId: number) => void;
}

export function MergeDialog({ open, onOpenChange, selectedMeetings, onMergeComplete }: MergeDialogProps) {
  const [primaryId, setPrimaryId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedIds = selectedMeetings.map(m => String(m.id));
  const effectivePrimaryId = selectedIds.includes(primaryId) ? primaryId : "";

  useEffect(() => {
    if (!open) setPrimaryId("");
  }, [open]);

  useEffect(() => {
    if (primaryId && !selectedIds.includes(primaryId)) {
      setPrimaryId("");
    }
  }, [selectedIds.join(","), primaryId]);

  const mergeMutation = useMutation({
    mutationFn: async ({ targetId, sourceIds }: { targetId: number; sourceIds: number[] }) => {
      const res = await fetch(`/api/meetings/${targetId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Merge failed" }));
        throw new Error(data.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path] });
      toast({ title: "Sessions Merged", description: "The selected sessions have been merged and reprocessing has started." });
      onOpenChange(false);
      onMergeComplete(data.meetingId);
    },
    onError: (error: Error) => {
      toast({ title: "Merge Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleMerge = () => {
    const targetId = Number(effectivePrimaryId);
    if (!targetId) return;
    const sourceIds = selectedMeetings.filter(m => m.id !== targetId).map(m => m.id);
    if (sourceIds.length === 0) return;
    mergeMutation.mutate({ targetId, sourceIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md" data-testid="dialog-merge">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-primary" />
            Merge Sessions
          </DialogTitle>
          <DialogDescription>
            Select which session should be the primary one. The other sessions will be merged into it and removed.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm font-medium text-foreground">
            {selectedMeetings.length} sessions selected
          </p>

          <RadioGroup value={effectivePrimaryId} onValueChange={setPrimaryId}>
            {selectedMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  primaryId === String(meeting.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={String(meeting.id)} id={`merge-${meeting.id}`} data-testid={`radio-merge-primary-${meeting.id}`} />
                <Label htmlFor={`merge-${meeting.id}`} className="flex-1 cursor-pointer">
                  <p className="text-sm font-medium truncate">{meeting.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(meeting.date), "MMM d, yyyy h:mm a")}
                  </p>
                </Label>
                {primaryId === String(meeting.id) && (
                  <span className="text-xs font-medium text-primary shrink-0">Primary</span>
                )}
              </div>
            ))}
          </RadioGroup>

          {primaryId && (
            <p className="text-xs text-muted-foreground">
              The primary session keeps its title, client, and date. Transcripts and analysis from the other {selectedMeetings.length - 1} session{selectedMeetings.length - 1 !== 1 ? "s" : ""} will be merged in, and the AI will reprocess the combined result.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
            data-testid="button-cancel-merge"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleMerge}
            disabled={!effectivePrimaryId || mergeMutation.isPending}
            data-testid="button-confirm-merge"
          >
            {mergeMutation.isPending ? (
              <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Merging...</>
            ) : (
              <><Merge className="mr-2 w-4 h-4" /> Merge Sessions</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
