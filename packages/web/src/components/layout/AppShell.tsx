import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLiveUpdates } from "../../hooks/useLiveUpdates.ts";
import { useSeen } from "../../hooks/useSeen.ts";
import { useTopBar } from "../../hooks/useTopBar.ts";
import { closeEntity, navigate, useRoute } from "../../lib/router.ts";
import { EntityPanel } from "../entity/EntityPanel.tsx";
import { KeyHelp } from "../home/KeyHelp.tsx";
import { ErrorState } from "../ui/states.tsx";
import { PendingChoices } from "./PendingChoices.tsx";
import { TopBar } from "./TopBar.tsx";

/**
 * Every page: the bar, the page, and whatever ref is open, as a panel over the right of the page so the list keeps its
 * place behind it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { path, params } = useRoute();
  const { data, error, isPending } = useBootstrap();
  const bar = useTopBar();
  useLiveUpdates();
  useSeen();
  const [keysOpen, setKeysOpen] = useState(false);
  const openKeys = useCallback(() => setKeysOpen(true), []);
  const closeKeys = useCallback(() => setKeysOpen(false), []);
  const entity = params.get("ref");
  const keys = useMemo(
    (): HotkeyMap => ({
      "?": openKeys,
      ...(keysOpen ? { Escape: closeKeys } : entity === null ? {} : { Escape: closeEntity }),
    }),
    [entity, keysOpen, openKeys, closeKeys],
  );
  useHotkeys(keys);
  return (
    <div className="shell">
      <TopBar
        path={path}
        counts={bar.counts}
        places={bar.places}
        at={bar.at}
        onAt={bar.setAt}
        onNewLine={() => navigate("/?new=1")}
        onKeys={openKeys}
      />
      <main className="main">
        {keysOpen ? <KeyHelp onClose={closeKeys} /> : null}
        {isPending ? null : error !== null && data === undefined ? <ErrorState error={error} /> : children}
        <PendingChoices />
      </main>
      {entity === null ? null : (
        <aside className="panel" aria-label={entity}>
          <EntityPanel key={entity} entityRef={entity} />
        </aside>
      )}
    </div>
  );
}
