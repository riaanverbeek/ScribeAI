const DB_NAME = "scribeai-offline";
const DB_VERSION = 3;
const STORE_NAME = "pending-recordings";
const IN_PROGRESS_STORE = "in-progress-recording";
const SEGMENTS_STORE = "recording-segments";

export interface OfflineRecording {
  id: string;
  title: string;
  audioBlob: Blob;
  audioFileName: string;
  audioMimeType: string;
  clientId: number | null;
  templateId: number | null;
  contextText: string;
  contextFile: Blob | null;
  contextFileName: string | null;
  includePreviousContext: boolean;
  outputLanguage: string;
  isInternal: boolean;
  policyIds: number[];
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  errorMessage?: string;
}

export interface InProgressRecording {
  id: string;
  chunks: ArrayBuffer[];
  mimeType: string;
  elapsed: number;
  updatedAt: string;
}

export interface RecordingSegment {
  id: string;
  chunks: ArrayBuffer[];
  mimeType: string;
  elapsed: number;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IN_PROGRESS_STORE)) {
        db.createObjectStore(IN_PROGRESS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SEGMENTS_STORE)) {
        db.createObjectStore(SEGMENTS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineRecording(recording: OfflineRecording): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineRecordings(): Promise<OfflineRecording[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineRecording(id: string): Promise<OfflineRecording | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateOfflineRecordingStatus(
  id: string,
  status: OfflineRecording["status"],
  errorMessage?: string
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (rec) {
        rec.status = status;
        if (errorMessage !== undefined) rec.errorMessage = errorMessage;
        store.put(rec);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteOfflineRecording(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const recordings = await getOfflineRecordings();
  return recordings.filter(r => r.status === "pending" || r.status === "failed").length;
}

const IN_PROGRESS_KEY = "current";

export async function saveInProgressChunks(
  chunks: Blob[],
  mimeType: string,
  elapsed: number
): Promise<void> {
  const buffers = await Promise.all(chunks.map(c => c.arrayBuffer()));
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IN_PROGRESS_STORE, "readwrite");
    tx.objectStore(IN_PROGRESS_STORE).put({
      id: IN_PROGRESS_KEY,
      chunks: buffers,
      mimeType,
      elapsed,
      updatedAt: new Date().toISOString(),
    } as InProgressRecording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getInProgressRecording(): Promise<InProgressRecording | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IN_PROGRESS_STORE, "readonly");
    const request = tx.objectStore(IN_PROGRESS_STORE).get(IN_PROGRESS_KEY);
    request.onsuccess = () => resolve(request.result || undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteInProgressRecording(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IN_PROGRESS_STORE, "readwrite");
    tx.objectStore(IN_PROGRESS_STORE).delete(IN_PROGRESS_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSegment(
  chunks: Blob[],
  mimeType: string,
  elapsed: number
): Promise<void> {
  const buffers = await Promise.all(chunks.map(c => c.arrayBuffer()));
  const segment: RecordingSegment = {
    id: `segment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chunks: buffers,
    mimeType,
    elapsed,
    savedAt: new Date().toISOString(),
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEGMENTS_STORE, "readwrite");
    tx.objectStore(SEGMENTS_STORE).put(segment);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSegments(): Promise<RecordingSegment[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEGMENTS_STORE, "readonly");
    const request = tx.objectStore(SEGMENTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getSegmentCount(): Promise<number> {
  const segments = await getSegments();
  return segments.length;
}

export async function clearSegments(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEGMENTS_STORE, "readwrite");
    tx.objectStore(SEGMENTS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function combineSegmentsWithCurrentChunks(
  currentChunks: Blob[],
  currentMimeType: string
): Promise<{ blob: Blob; mimeType: string; totalElapsed: number }> {
  const segments = await getSegments();
  const allBlobs: Blob[] = [];
  let totalElapsed = 0;
  const mimeType = segments.length > 0 ? segments[0].mimeType : currentMimeType;

  for (const segment of segments) {
    for (const buf of segment.chunks) {
      allBlobs.push(new Blob([buf], { type: segment.mimeType }));
    }
    totalElapsed += segment.elapsed;
  }

  for (const chunk of currentChunks) {
    allBlobs.push(chunk);
  }

  const combinedBlob = new Blob(allBlobs, { type: mimeType });
  return { blob: combinedBlob, mimeType, totalElapsed };
}
