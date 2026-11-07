import { contracts } from "@octotrack/core/contracts";
import { Fragment, useMemo, useState } from "react";
import { useBootstrapSnapshot } from "../../hooks/useBootstrap.ts";
import { type HotkeyMap, useHotkeys } from "../../hooks/useHotkeys.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { navigate, useRoute } from "../../lib/router.ts";
import { Section } from "../ui/Section.tsx";
import { DecisionCardItem } from "./DecisionCardItem.tsx";
import { QueueRest } from "./QueueRest.tsx";

/** Closed decisions listed beside the feed. More than this pushes the feed off the screen, above all on a phone. */
const REST_LIMIT = 5;

export interface QueueSectionProps {
  query: string;
  /** With no filter applied, the first load can come straight from bootstrap. */
  isDefault: boolean;
  linkToAll?: boolean;
}

/**
 * The decisions most worth the developer's attention right now, one open at a time. A keypress here can unblock an agent
 * on an answer, so it must land where it was aimed:
 *
 * - The open card stays open and stays first, whatever the ranking does, so that a re-rank cannot swap it or move the
 *   field being typed in.
 * - The keys are armed for one specific card. If it goes away, the next one opens but the keys do nothing until `j`.
 * - With the inspector open, the keys belong to whatever is inspected, and this stands down.
 */
export function QueueSection({ query, isDefault, linkToAll = true }: QueueSectionProps) {
  const bootstrap = useBootstrapSnapshot();
  const { params } = useRoute();
  const inspecting = params.get("ref") !== null;
  const queue = useOpQuery(
    contracts.decisionQueue,
    query === "" ? {} : { query },
    isDefault && bootstrap !== undefined ? { initialData: bootstrap.queue } : {},
  );
  const cards = queue.data ?? [];
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [armedRef, setArmedRef] = useState<string | null>(null);

  const firstRef = cards[0]?.decision.ref ?? null;
  const stillThere = cards.some((card) => card.decision.ref === openRef);
  const currentRef = stillThere ? openRef : firstRef;
  if (currentRef !== null && currentRef !== openRef) {
    setOpenRef(currentRef);
    // Arming on first sight only. A card opened because another went away was not chosen by anyone.
    if (openRef === null) setArmedRef(currentRef);
  }
  const armed = currentRef !== null && armedRef === currentRef && !inspecting;

  const refs = cards.map((card) => card.decision.ref).join(" ");
  const open = (ref: string) => {
    setOpenRef(ref);
    setArmedRef(ref);
  };
  const keys = useMemo((): HotkeyMap => {
    if (inspecting) return {};
    const list = refs === "" ? [] : refs.split(" ");
    const move = (step: number) => () => {
      if (currentRef === null) return;
      if (armedRef !== currentRef) {
        setArmedRef(currentRef);
        return;
      }
      const next = list[Math.min(Math.max(list.indexOf(currentRef) + step, 0), list.length - 1)];
      if (next !== undefined) {
        setOpenRef(next);
        setArmedRef(next);
      }
    };
    return { j: move(1), k: move(-1) };
  }, [refs, currentRef, armedRef, inspecting]);
  useHotkeys(keys);

  if (cards.length === 0) return null;
  const openCard = cards.filter((card) => card.decision.ref === currentRef);
  const others = cards.filter((card) => card.decision.ref !== currentRef);
  // The page that links here shows them all, so only a page with somewhere to send you can shorten the list.
  const listed = new Set((linkToAll ? others.slice(0, REST_LIMIT) : others).map((card) => card.decision.ref));
  const unlisted = others.length - listed.size;
  return (
    <Section
      title="Needs you"
      note={String(cards.length)}
      {...(linkToAll ? { linkTo: "/decisions", linkLabel: "All decisions" } : {})}
    >
      {armed || inspecting ? null : <p className="muted keyboard-hint">Press j to answer this one.</p>}
      <div className="queue">
        {[...openCard, ...others].map((card) => {
          const isOpen = card.decision.ref === currentRef;
          return (
            <Fragment key={card.decision.ref}>
              {listed.has(card.decision.ref) ? <QueueRest card={card} onOpen={open} /> : null}
              {/* Stays mounted while closed, so that moving away does not throw out a half-typed answer. */}
              <div hidden={!isOpen}>
                <DecisionCardItem card={card} active={isOpen && armed} />
              </div>
            </Fragment>
          );
        })}
        {unlisted === 0 ? null : (
          <button type="button" className="chip" onClick={() => navigate("/decisions")}>
            {unlisted} more {unlisted === 1 ? "decision" : "decisions"}
          </button>
        )}
      </div>
    </Section>
  );
}
