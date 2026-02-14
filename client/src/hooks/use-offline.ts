import { useState, useEffect, useCallback } from "react";
import { getOfflineRecordings, type OfflineRecording } from "@/lib/offlineDb";
import { addSyncListener } from "@/lib/offlineSync";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflineRecordings() {
  const [recordings, setRecordings] = useState<OfflineRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const recs = await getOfflineRecordings();
      setRecordings(recs);
    } catch {
      setRecordings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = addSyncListener(refresh);
    return unsub;
  }, [refresh]);

  return { recordings, isLoading, refresh };
}
