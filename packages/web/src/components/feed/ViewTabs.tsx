import type { View } from "@octotrack/core/schemas";

export interface ViewTabsProps {
  views: readonly View[];
  active: string;
  onSelect(name: string): void;
}

export function ViewTabs({ views, active, onSelect }: ViewTabsProps) {
  return (
    <nav className="tabs" aria-label="Saved views">
      {views.map((view) => (
        <button
          type="button"
          key={view.name}
          className="tab"
          aria-pressed={view.name === active}
          title={view.query || "Everything"}
          onClick={() => onSelect(view.name)}
        >
          {view.name}
        </button>
      ))}
    </nav>
  );
}
