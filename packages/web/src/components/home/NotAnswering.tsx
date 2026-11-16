import { Button } from "../ui/Button.tsx";
import { Notice } from "../ui/Notice.tsx";

/** Lines on first load with the tracker not answering: what happened, where, what starts it again, and Try now. */
export function NotAnswering({ host, onRetry }: { host: string; onRetry(): void }) {
  return (
    <Notice
      tone="bad"
      title="The tracker is not answering"
      command="octo server status"
      action={<Button onClick={onRetry}>Try now</Button>}
    >
      Nothing answered at {host}. Any octo command starts it again.
    </Notice>
  );
}
