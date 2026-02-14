import { useState, useCallback } from "react";

export type ViewMode = "tile" | "list";

export function useViewMode(storageKey: string, defaultMode: ViewMode = "tile"): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "tile" || stored === "list") return stored;
    } catch {}
    return defaultMode;
  });

  const setMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(storageKey, newMode);
    } catch {}
  }, [storageKey]);

  return [mode, setMode];
}
