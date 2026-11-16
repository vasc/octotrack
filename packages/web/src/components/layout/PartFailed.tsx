import { Button } from "../ui/Button.tsx";
import { Notice } from "../ui/Notice.tsx";

/**
 * A part of the page that broke: that it is a bug and not the data, that drafts are safe, and the error to report,
 * with Reload.
 */
export function PartFailed({ error, onReload }: { error: Error; onReload(): void }) {
  return (
    <Notice
      title="This part of the page failed"
      tone="bad"
      command={`${error.name}: ${error.message}`}
      action={<Button onClick={onReload}>Reload</Button>}
    >
      A bug in the dashboard, not your data. Your drafts are kept on the tracker. Reloading usually clears it;
      if not, the error below is what to report.
    </Notice>
  );
}
