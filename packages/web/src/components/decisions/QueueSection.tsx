import { contracts } from "@octotrack/core/contracts";
import { Fragment, useMemo, useState } from "react";
import { useBootstrapSnapshot } from "../../hooks/useBootstrap.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { Section } from "../ui/Section.tsx";
import { DecisionCardItem } from "./DecisionCardItem.tsx";
import { QueueRest } from "./QueueRest.tsx";

export interface QueueSectionProps {
  query: string;
  /** With no filter applied, the first load can come straight from bootstrap. */
  isDefault: boolean;
  /** Show every card open. The default opens one at a time, so that the feed stays on screen. */
  allCards?: boolean;
}

/** The decisions most worth the developer's attention right now. j and k move between them. */
export function QueueSection({ query, isDefault, allCards = false }: QueueSectionProps) {
  const bootstrap = useBootstrapSnapshot();
  const queue = useOpQuery(
    contracts.decisionQueue,
    query === "" ? {} : { query },
    isDefault && bootstrap !== undefined ? { initialData: bootstrap.queue } : {},
  );
  const cards = queue.data ?? [];
  const [chosenRef, setChosenRef] = useState<string | null>(null);
  // The open card stays open until it is answered. Following the ranking instead would let a live re-rank swap it under
  // the developer's fingers, and a keypress meant for one decision would land on another that an agent is hanging on.
  const active = cards.find((card) => card.decision.ref === chosenRef) ?? cards[0];
  const activeRef = active?.decision.ref ?? null;
  if (activeRef !== chosenRef && activeRef !== null) setChosenRef(activeRef);
  const activeIndex = Math.max(
    0,
    cards.findIndex((card) => card.decision.ref === activeRef),
  );
  const refs = cards.map((card) => card.decision.ref).join(" ");

  const keys = useMemo(() => {
    const list = refs === "" ? [] : refs.split(" ");
    const move = (step: number) => () => {
      const next = list[Math.min(Math.max(activeIndex + step, 0), list.length - 1)];
      if (next !== undefined) setChosenRef(next);
    };
    return { j: move(1), k: move(-1) };
  }, [refs, activeIndex]);
  useHotkeys(keys);

  if (cards.length === 0) return null;
  return (
    <Section
      title="Needs you"
      note={String(cards.length)}
      {...(allCards ? {} : { linkTo: "/decisions", linkLabel: "All decisions" })}
    >
      <div className="queue">
        {cards.map((card) => {
          const open = allCards || card.decision.ref === activeRef;
          return (
            <Fragment key={card.decision.ref}>
              {open ? null : <QueueRest card={card} onOpen={setChosenRef} />}
              {/* Stays mounted while closed, so that moving away does not throw out a half-typed answer. */}
              <div hidden={!open}>
                <DecisionCardItem card={card} active={card.decision.ref === activeRef} />
              </div>
            </Fragment>
          );
        })}
      </div>
    </Section>
  );
}
