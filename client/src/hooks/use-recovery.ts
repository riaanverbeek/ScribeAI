import { useState, useEffect, useCallback } from "react";
import { getInProgressRecording, deleteInProgressRecording } from "@/lib/offlineDb";

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyAll() {
  listeners.forEach((fn) => fn());
}

export function invalidateRecoveryState() {
  notifyAll();
}

export function useHasRecoverableRecording() {
  const [hasRecoverable, setHasRecoverable] = useState(false);

  const check = useCallback(() => {
    getInProgressRecording()
      .then((rec) => setHasRecoverable(!!(rec && rec.chunks && rec.chunks.length > 0)))
      .catch(() => setHasRecoverable(false));
  }, []);

  useEffect(() => {
    check();
    listeners.add(check);
    return () => { listeners.delete(check); };
  }, [check]);

  const discard = useCallback(async () => {
    await deleteInProgressRecording().catch(() => {});
    invalidateRecoveryState();
  }, []);

  return { hasRecoverable, discard, refresh: check };
}
