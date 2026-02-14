import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/hooks/use-view-mode";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border border-border rounded-lg overflow-visible" data-testid="toggle-view-mode">
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-none rounded-l-lg toggle-elevate ${mode === "tile" ? "toggle-elevated bg-muted" : ""}`}
        onClick={() => onChange("tile")}
        data-testid="button-view-tile"
        aria-label="Tile view"
      >
        <LayoutGrid className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-none rounded-r-lg toggle-elevate ${mode === "list" ? "toggle-elevated bg-muted" : ""}`}
        onClick={() => onChange("list")}
        data-testid="button-view-list"
        aria-label="List view"
      >
        <List className="w-4 h-4" />
      </Button>
    </div>
  );
}
