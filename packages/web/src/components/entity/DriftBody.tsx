import type { Drift } from "@octotrack/core/schemas";
import { useDriftAck } from "../../hooks/useDriftAck.ts";
import { DriftAnswer } from "../drift/DriftAnswer.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { RefText } from "../ui/RefText.tsx";

/** Something out of date opened by its own ref: what changed, then how to clear it, answered here. */
export function DriftBody({ drift }: { drift: Drift }) {
  const drifted = useDriftAck();
  return (
    <Stack>
      <RefText text={drift.message} />
      <DriftAnswer drift={drift} busy={drifted.busy(drift.ref)} onAck={drifted.ack} />
    </Stack>
  );
}
