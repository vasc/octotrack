import { useMemo } from "react";
import type { ReactNode } from "react";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLiveUpdates } from "../../hooks/useLiveUpdates.ts";
import { closeEntity, useRoute } from "../../lib/router.ts";
import { EntityPanel } from "../entity/EntityPanel.tsx";
import { ErrorState } from "../ui/states.tsx";
import { RailOverview } from "./RailOverview.tsx";
import { SidebarView } from "./SidebarView.tsx";

export function AppShell({ children }: { children: ReactNode }) {
  const { path, params } = useRoute();
  const { data, error, isPending } = useBootstrap();
  const live = useLiveUpdates();
  const entity = params.get("ref");
  const keys = useMemo((): HotkeyMap => (entity === null ? {} : { Escape: closeEntity }), [entity]);
  useHotkeys(keys);
  return (
    <div className="shell">
      <SidebarView path={path} live={live} counts={data?.counts ?? null} projects={data?.projects ?? []} />
      <main className="main">
        {isPending ? null : error !== null && data === undefined ? <ErrorState error={error} /> : children}
      </main>
      <aside className="rail" data-open={entity !== null} aria-label={entity === null ? "Overview" : entity}>
        {isPending ? null : entity === null ? (
          <RailOverview />
        ) : (
          <EntityPanel key={entity} entityRef={entity} />
        )}
      </aside>
    </div>
  );
}
