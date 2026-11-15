import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { type HotkeyMap, KeysHeldProvider, useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLiveUpdates } from "../../hooks/useLiveUpdates.ts";
import { usePanelFocus } from "../../hooks/usePanelFocus.ts";
import { useSeen } from "../../hooks/useSeen.ts";
import { useTopBar } from "../../hooks/useTopBar.ts";
import { backEntity, navigate, useRoute } from "../../lib/router.ts";
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
  const live = useLiveUpdates();
  useSeen();
  const [keysOpen, setKeysOpen] = useState(false);
  const openKeys = useCallback(() => setKeysOpen(true), []);
  const closeKeys = useCallback(() => setKeysOpen(false), []);
  const entity = params.get("ref");
  // The picker is the browser's to focus; g p reaches it through its element.
  const atPicker = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  usePanelFocus(panel, entity);
  const { at, setAt } = bar;
  const keys = useMemo((): HotkeyMap => {
    // Esc closes what is on top: the key list, then a panel (back to the one it was opened from, if any), then the
    // place the developer said they are at.
    const closeTop = keysOpen
      ? closeKeys
      : entity !== null
        ? backEntity
        : at !== null
          ? () => setAt(null)
          : null;
    // With the key list open, only what closes it acts: a stray key behind it costs nothing (D14).
    if (keysOpen) return { "?": closeKeys, ...(closeTop === null ? {} : { Escape: closeTop }) };
    return {
      "?": openKeys,
      "g p": () => atPicker.current?.focus(),
      ...(path === "/log" ? {} : { "/": () => navigate("/log?find=1") }),
      ...(closeTop === null ? {} : { Escape: closeTop }),
    };
  }, [entity, keysOpen, openKeys, closeKeys, at, setAt, path]);
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
        atRef={atPicker}
      />
      <KeysHeldProvider value={keysOpen}>
        <main className="main">
          {/* What is shown no longer updates by itself: said quietly, as patterns.md asks of anything stale. */}
          {live === "offline" ? (
            <p className="muted" role="status">
              Not live: reconnecting. What is shown may be out of date.
            </p>
          ) : null}
          {keysOpen ? <KeyHelp onClose={closeKeys} /> : null}
          {bar.error === null ? null : <ErrorState error={bar.error} />}
          {isPending ? null : error !== null && data === undefined ? <ErrorState error={error} /> : children}
          <PendingChoices />
        </main>
        {entity === null ? null : (
          <aside className="panel" aria-label={entity} ref={panel} tabIndex={-1}>
            <EntityPanel key={entity} entityRef={entity} />
          </aside>
        )}
      </KeysHeldProvider>
    </div>
  );
}
