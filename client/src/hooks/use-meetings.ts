import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateMeetingRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { reportError } from "@/lib/logError";
import { z } from "zod";

// ============================================
// Types
// ============================================
// Using types inferred from the API contract in shared/routes
type Meeting = z.infer<typeof api.meetings.list.responses[200]>[number];
type MeetingDetail = z.infer<typeof api.meetings.get.responses[200]>;

// ============================================
// Hooks
// ============================================

export function useMeetings() {
  return useQuery({
    queryKey: [api.meetings.list.path],
    queryFn: async () => {
      const res = await fetch(api.meetings.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return api.meetings.list.responses[200].parse(await res.json());
    },
  });
}

export function useMeeting(id: number | null) {
  return useQuery({
    queryKey: [api.meetings.get.path, id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("No ID provided");
      const url = buildUrl(api.meetings.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch session details");
      return api.meetings.get.responses[200].parse(await res.json());
    },
    // Poll for status updates if processing
    refetchInterval: (query) => {
      const data = query.state.data as MeetingDetail | undefined;
      return data?.status === 'processing' || data?.status === 'uploading' ? 2000 : false;
    }
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateMeetingRequest) => {
      const validated = api.meetings.create.input.parse(data);
      const res = await fetch(api.meetings.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.meetings.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create session");
      }
      return api.meetings.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUploadAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File | Blob }) => {
      const fileName = (file as File).name || "audio.wav";
      const contentType = (file as File).type || "application/octet-stream";

      const fileSize = file.size || 0;
      if (fileSize < 100) {
        const msg = `Audio blob is empty or too small (${fileSize} bytes) for meeting ${id}`;
        console.error(`[upload] ${msg}`);
        reportError(msg, "useUploadAudio");
        throw new Error("The recording appears to be empty or corrupted. Please try recording again.");
      }

      const MAX_RETRIES = 3;
      let lastError: Error | null = null;
      let objectPath = "";

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[upload] Attempt ${attempt}/${MAX_RETRIES} for meeting ${id} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

          const urlRes = await fetch(`/api/meetings/${id}/audio/request-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (!urlRes.ok) {
            const errText = await urlRes.text().catch(() => "");
            const msg = `request-url failed: ${urlRes.status} ${errText}`;
            console.error(`[upload] ${msg}`);
            reportError(msg, "useUploadAudio");
            throw new Error("Failed to get upload URL");
          }
          const urlData = await urlRes.json();
          objectPath = urlData.objectPath;

          const putRes = await fetch(urlData.uploadURL, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": contentType },
          });
          if (!putRes.ok) {
            const errText = await putRes.text().catch(() => "");
            const msg = `GCS PUT failed: ${putRes.status} ${errText}`;
            console.error(`[upload] ${msg}`);
            reportError(msg, "useUploadAudio");
            throw new Error(`Failed to upload audio to storage (${putRes.status})`);
          }

          lastError = null;
          break;
        } catch (err: any) {
          lastError = err;
          if (err?.message?.includes("empty or corrupted")) throw err;
          console.warn(`[upload] Attempt ${attempt} failed: ${err?.message}`);
          if (attempt < MAX_RETRIES) {
            const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
            console.log(`[upload] Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }

      if (lastError) {
        const msg = `Upload failed after ${MAX_RETRIES} attempts: ${lastError.message}`;
        console.error(`[upload] ${msg}`);
        reportError(msg, "useUploadAudio");
        throw new Error("Audio upload failed after multiple attempts. Please check your connection and try again.");
      }

      const confirmRes = await fetch(`/api/meetings/${id}/audio/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ objectPath, fileName }),
      });
      if (!confirmRes.ok) {
        const errText = await confirmRes.text().catch(() => "");
        const msg = `Confirm failed: ${confirmRes.status} ${errText}`;
        console.error(`[upload] ${msg}`);
        reportError(msg, "useUploadAudio");
        throw new Error("Failed to confirm audio upload");
      }
      return confirmRes.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.meetings.get.path, id] });
      toast({
        title: "Upload Complete",
        description: "Audio uploaded successfully. Processing can now begin.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useProcessMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.meetings.process.path, { id });
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to start processing");
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.meetings.get.path, id] });
      toast({
        title: "Processing Started",
        description: "AI analysis is running in the background.",
      });
    },
    onError: (error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateMeetingClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ meetingId, clientId }: { meetingId: number; clientId: number | null }) => {
      const url = buildUrl(api.meetings.updateClient.path, { id: meetingId });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update client");
      }
      return res.json();
    },
    onSuccess: (_, { meetingId }) => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.get.path, meetingId] });
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path] });
      toast({
        title: "Client Updated",
        description: "Session has been linked to the selected client.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.meetings.delete.path, { id });
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete session");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path] });
      toast({
        title: "Deleted",
        description: "Session removed successfully.",
      });
    },
  });
}
