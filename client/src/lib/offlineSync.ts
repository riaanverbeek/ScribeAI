import {
  getOfflineRecordings,
  updateOfflineRecordingStatus,
  deleteOfflineRecording,
  type OfflineRecording,
} from "./offlineDb";

let isSyncing = false;
let syncListeners: Array<() => void> = [];

export function addSyncListener(fn: () => void) {
  syncListeners.push(fn);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== fn);
  };
}

function notifyListeners() {
  syncListeners.forEach((fn) => fn());
}

async function uploadSingleRecording(rec: OfflineRecording): Promise<void> {
  await updateOfflineRecordingStatus(rec.id, "syncing");
  notifyListeners();

  const meetingRes = await fetch("/api/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      title: rec.title,
      date: rec.createdAt,
      outputLanguage: rec.outputLanguage || "en",
      ...(rec.clientId ? { clientId: rec.clientId } : {}),
    }),
  });

  if (!meetingRes.ok) {
    throw new Error("Failed to create session");
  }

  const meeting = await meetingRes.json();

  const contextPayload: Record<string, unknown> = {};
  if (rec.templateId) contextPayload.templateId = rec.templateId;
  if (rec.contextText.trim()) contextPayload.contextText = rec.contextText.trim();
  if (rec.includePreviousContext) contextPayload.includePreviousContext = true;
  if (rec.isInternal) contextPayload.isInternal = true;

  if (Object.keys(contextPayload).length > 0) {
    await fetch(`/api/meetings/${meeting.id}/context`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(contextPayload),
    });
  }

  if (rec.contextFile && rec.contextFileName) {
    const ctxFormData = new FormData();
    ctxFormData.append("file", rec.contextFile, rec.contextFileName);
    await fetch(`/api/meetings/${meeting.id}/context-file`, {
      method: "POST",
      credentials: "include",
      body: ctxFormData,
    });
  }

  if (rec.policyIds && rec.policyIds.length > 0) {
    await fetch(`/api/meetings/${meeting.id}/policies`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ policyIds: rec.policyIds }),
    });
  }

  const audioFile = new File([rec.audioBlob], rec.audioFileName, {
    type: rec.audioMimeType,
  });

  const urlRes = await fetch(`/api/meetings/${meeting.id}/audio/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    body: audioFile,
    headers: { "Content-Type": rec.audioMimeType || "application/octet-stream" },
  });
  if (!putRes.ok) throw new Error("Failed to upload audio to storage");

  const confirmRes = await fetch(`/api/meetings/${meeting.id}/audio/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ objectPath, fileName: rec.audioFileName }),
  });
  if (!confirmRes.ok) throw new Error("Failed to confirm audio upload");

  await fetch(`/api/meetings/${meeting.id}/process`, {
    method: "POST",
    credentials: "include",
  });

  await deleteOfflineRecording(rec.id);
  notifyListeners();
}

export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const recordings = await getOfflineRecordings();
    const toSync = recordings.filter(
      (r) => r.status === "pending" || r.status === "failed"
    );

    for (const rec of toSync) {
      try {
        await uploadSingleRecording(rec);
        synced++;
      } catch (err: any) {
        await updateOfflineRecordingStatus(
          rec.id,
          "failed",
          err?.message || "Upload failed"
        );
        failed++;
      }
    }
  } finally {
    isSyncing = false;
    notifyListeners();
  }

  return { synced, failed };
}

export async function retrySingle(id: string): Promise<boolean> {
  if (!navigator.onLine) return false;

  const recordings = await getOfflineRecordings();
  const rec = recordings.find((r) => r.id === id);
  if (!rec) return false;

  try {
    await uploadSingleRecording(rec);
    return true;
  } catch (err: any) {
    await updateOfflineRecordingStatus(id, "failed", err?.message || "Retry failed");
    notifyListeners();
    return false;
  }
}

export function startAutoSync() {
  const handleOnline = () => {
    syncAllPending();
  };

  window.addEventListener("online", handleOnline);

  if (navigator.onLine) {
    syncAllPending();
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
