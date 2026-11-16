import { contracts } from "@octotrack/core/contracts";
import type { Drift } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { DriftItem } from "../drift/DriftItem.tsx";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * What is out of date about the item open in the panel, each with how to answer it. An answer waits with Undo like
 * every other choice, and a refusal (such as Updated when nothing changed) says why in the Undo bar.
 */
export function OpenDrift({ drift }: { drift: readonly Drift[] }) {
  const choices = useChoices();
  const open = drift.filter((item) => item.status === "open");
  if (open.length === 0) return null;
  return (
    <Section title="Out of date" count={open.length}>
      <List>
        {open.map((item) => (
          <DriftItem
            key={item.ref}
            drift={item}
            busy={choices.waiting(item.ref)}
            onAck={(ref, mode, note) =>
              choices.make(
                contracts.driftAck.name,
                { refs: [ref], mode, note },
                mode === "updated"
                  ? `Marking ${ref} updated: ${note}`
                  : `Marking ${ref} as needing no update: ${note}`,
              )
            }
          />
        ))}
      </List>
    </Section>
  );
}
