import type { ReactNode } from "react";
import type { LineView } from "../../hooks/useLineView.ts";
import { Loaded } from "../ui/Loaded.tsx";

/**
 * Until Lines has loaded once, who owns a line and what it needs from the developer are not known: what to say in
 * their place, loading or failed with Try again. Nothing once Lines is here.
 */
export function homeStatus(view: LineView, what: string): ReactNode | undefined {
  const { h, home } = view;
  return home === undefined ? (
    <Loaded loaded={false} error={h.home.error} what={what} onRetry={() => void h.home.refetch()}>
      {null}
    </Loaded>
  ) : undefined;
}
