import { ForYouEmpty } from "../components/foryou/ForYouEmpty.tsx";
import { ForYouRail } from "../components/foryou/ForYouRail.tsx";
import { ProposalItem } from "../components/foryou/ProposalItem.tsx";
import { Card } from "../components/ui/Card.tsx";
import { NextList } from "../components/ui/NextList.tsx";
import { PeekLink } from "../components/ui/PeekLink.tsx";
import { Progress } from "../components/ui/Progress.tsx";
import { DesignSection, Example } from "./Example.tsx";
import { line } from "./fixtures.ts";

const NOOP = () => {};
const COUNTS = { all: 11, urgent: 1, toAnswer: 3, toDo: 4, toAccept: 2, toStepIn: 2 };

/** For you: the rail, the open card with where you are, Next, and the states with nothing left. */
export function ForYouGallery() {
  const broken = line({
    ref: "L-7",
    title: "Restore the garden feed",
    state: "proposed",
    urgentReason: "broken",
    proposedBy: "garden-sensor",
    repos: ["PANEL"],
    doneWhen: "Readings arrive again.",
    recommendation: "start",
    recommendationWhy: "The done sensor line's service stopped answering.",
  });
  return (
    <DesignSection title="For you">
      <Example label="The rail, in To answer">
        <ForYouRail counts={COUNTS} filter="toAnswer" />
      </Example>
      <Example label="Where you are: a view, and Urgent">
        <Progress name="To answer" at={1} of={3} />
        <Progress name="Urgent" at={1} of={1} urgent />
      </Example>
      <Example label="The open card: an urgent proposal">
        <Card label="Open now" top={<Progress name="Urgent" at={1} of={1} urgent />}>
          <ProposalItem
            line={broken}
            foldTargets={[line({ ref: "L-2", title: "Sendspin enclosure" })]}
            lastUpNext="Try it on the phone"
            origin={null}
            busy={false}
            onStart={NOOP}
            onQueue={NOOP}
            onTable={NOOP}
            onFold={NOOP}
            onReject={NOOP}
            onDrop={NOOP}
          />
        </Card>
      </Example>
      <Example label="A line to peek at, closed and open">
        <PeekLink href="/lines/L-2" onPeek={NOOP}>
          Sendspin enclosure
        </PeekLink>{" "}
        <PeekLink href="/lines/L-2" open onPeek={NOOP}>
          Sendspin enclosure
        </PeekLink>
      </Example>
      <Example label="Next">
        <NextList
          label="Next"
          onOpen={NOOP}
          items={[
            {
              key: "D-5",
              where: "Sendspin enclosure · D-5",
              title: "Should the lid snap on or screw down?",
              note: "Recommended: Snap fit",
              href: "#",
            },
            { key: "D-6", where: "Wall mount · D-6", title: "Wall plug side: left or right?", href: "#" },
          ]}
          after="Then 4 to do, 2 to accept and 2 to step in."
        />
      </Example>
      <Example label="Nothing waits on you">
        <ForYouEmpty
          filter="all"
          working={1}
          nextAsk={{ title: "One plan, one meal", step: "step 2" }}
          then={null}
        />
      </Example>
      <Example label="A view with nothing in it">
        <ForYouEmpty
          filter="toAnswer"
          working={1}
          nextAsk={null}
          then={{ filter: "toDo", label: "To do", count: 4 }}
        />
      </Example>
    </DesignSection>
  );
}
