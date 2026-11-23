import { useRetryEvery } from "../../hooks/useRetryEvery.ts";
import { Button } from "../ui/Button.tsx";
import { Notice } from "../ui/Notice.tsx";

/** How often the page asks again by itself. */
const EVERY_MS = 30_000;

/**
 * Lines on first load with the tracker not answering: what happened, where, what starts it again, that the page asks
 * again every 30 seconds by itself, and Try now.
 */
export function NotAnswering({ host, onRetry }: { host: string; onRetry(): void }) {
  useRetryEvery(EVERY_MS, onRetry);
  return (
    <Notice
      tone="bad"
      title="The tracker is not answering"
      command="octo server status"
      action={<Button onClick={onRetry}>Try now</Button>}
    >
      Nothing answered at {host}. Any octo command starts it again; this page tries again every 30 seconds.
    </Notice>
  );
}
