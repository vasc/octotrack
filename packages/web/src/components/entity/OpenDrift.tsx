import type { Drift } from "@octotrack/core/schemas";
import { useDriftAck } from "../../hooks/useDriftAck.ts";
import { DriftItem } from "../drift/DriftItem.tsx";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * What is out of date about the item open in the panel, each with how to answer it. An answer waits with Undo like
 * every other choice, and a refusal (such as Updated when nothing changed) says why in the Undo bar.
 */
export function OpenDrift({ drift }: { drift: readonly Drift[] }) {
  const drifted = useDriftAck();
  const open = drift.filter((item) => item.status === "open");
  if (open.length === 0) return null;
  return (
    <Section title="Out of date" count={open.length}>
      <List>
        {open.map((item) => (
          <DriftItem key={item.ref} drift={item} busy={drifted.busy(item.ref)} onAck={drifted.ack} />
        ))}
      </List>
    </Section>
  );
}
