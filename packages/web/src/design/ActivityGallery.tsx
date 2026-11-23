import { DriftItem } from "../components/drift/DriftItem.tsx";
import { FeedList } from "../components/feed/FeedList.tsx";
import { FilterBar } from "../components/feed/FilterBar.tsx";
import { DesignSection } from "./Example.tsx";
import { drift, event } from "./fixtures.ts";

const NOOP = () => {};

/** The search and the log it finds: the quiet part, which the lines stand out against. */
export function ActivityGallery() {
  return (
    <>
      <DesignSection title="Search">
        <FilterBar value="kind:decision status:open" error={null} suggestions={[]} onChange={NOOP} />
        <FilterBar
          value="status:opne"
          error='"opne" is not a value of status'
          suggestions={[]}
          onChange={NOOP}
        />
      </DesignSection>
      <DesignSection title="Feed">
        <FeedList
          onFilter={NOOP}
          events={[
            event({
              seq: 6,
              type: "decision.requested",
              kind: "decision",
              ref: "D-3",
              summary: "D-3 needs a decision: Which queue?",
            }),
            event({
              seq: 5,
              type: "decision.resolved",
              kind: "decision",
              ref: "D-2",
              summary: 'D-2 decided: "Redis" on "Which cache?"',
            }),
            event({
              seq: 4,
              type: "pr.checks_changed",
              kind: "pr",
              ref: "PR-7",
              attrs: { checks: "failing" },
              summary: "PR-7 checks failing: Add retry",
            }),
            event({
              seq: 3,
              type: "status.posted",
              kind: "update",
              ref: "U-4",
              attrs: { level: "blocker" },
              summary: "Stuck until the provider is chosen.",
            }),
            event({
              seq: 2,
              type: "status.posted",
              kind: "update",
              ref: "U-3",
              attrs: { level: "progress" },
              summary: "Retry works, adding tests.",
            }),
            event({ seq: 1, summary: "OCT-1 created: Add retry" }),
          ]}
        />
      </DesignSection>
      <DesignSection title="Drift">
        <DriftItem drift={drift()} onAck={NOOP} />
        <DriftItem
          drift={drift({
            ref: "DR-2",
            edge: false,
            rule: "pr-checks-failing",
            message: "PR-1 has failing checks",
          })}
          onAck={NOOP}
        />
        <DriftItem
          drift={drift({
            ref: "DR-3",
            status: "verified",
            note: "Kept open on purpose",
            resolvedBy: "agent-a",
          })}
          onAck={NOOP}
        />
      </DesignSection>
    </>
  );
}
