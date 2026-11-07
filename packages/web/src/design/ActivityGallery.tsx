import { DriftItem } from "../components/drift/DriftItem.tsx";
import { FeedList } from "../components/feed/FeedList.tsx";
import { FilterBar } from "../components/feed/FilterBar.tsx";
import { ViewTabs } from "../components/feed/ViewTabs.tsx";
import { IdeaRow } from "../components/ideas/IdeaRow.tsx";
import { IssueRow } from "../components/issues/IssueRow.tsx";
import { RoadmapLaneView } from "../components/roadmap/RoadmapLaneView.tsx";
import { DesignSection, Example } from "./Example.tsx";
import { drift, event, issue, issueCard } from "./fixtures.ts";

const NOOP = () => {};
const VIEW = { query: "", position: 0, builtin: true, createdAt: "" };

/** The feed and the rows around it: the quiet part, which the decisions stand out against. */
export function ActivityGallery() {
  return (
    <>
      <DesignSection title="Filter and views">
        <FilterBar value="kind:decision status:open" error={null} suggestions={[]} onChange={NOOP} />
        <FilterBar
          value="status:opne"
          error='"opne" is not a value of status'
          suggestions={[]}
          onChange={NOOP}
        />
        <ViewTabs
          active="Feed"
          onSelect={NOOP}
          views={[
            { ...VIEW, name: "Feed" },
            { ...VIEW, name: "Decisions" },
            { ...VIEW, name: "Drift" },
          ]}
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
            resolvedBy: "claude-a",
          })}
          onAck={NOOP}
        />
      </DesignSection>
      <DesignSection title="Rows">
        <div className="rows">
          <IssueRow
            onStatus={NOOP}
            card={issueCard({
              issue: issue({ priority: "urgent", assignee: "claude-a", labels: ["backend"] }),
              blockedBy: ["D-3"],
              prs: ["PR-7"],
              openDrift: 1,
            })}
          />
          <IssueRow
            onStatus={NOOP}
            card={issueCard({ issue: issue({ ref: "OCT-2", status: "done", title: "Finished" }) })}
          />
          <IdeaRow
            onHorizon={NOOP}
            onPromote={NOOP}
            onReject={NOOP}
            idea={{
              ref: "I-1",
              project: "OCT",
              title: "Apple Pay at checkout",
              body: "",
              status: "captured",
              horizon: "next",
              labels: [],
              promotedTo: null,
              version: 1,
              createdAt: "",
              updatedAt: "",
              createdBy: "x",
            }}
          />
        </div>
      </DesignSection>
      <DesignSection title="Roadmap lane">
        <Example label="One of three">
          <RoadmapLaneView
            lane={{
              horizon: "now",
              items: [
                {
                  ref: "M-1",
                  kind: "milestone",
                  title: "Checkout beta",
                  project: "OCT",
                  status: "active",
                  horizon: "now",
                  targetDate: "2026-12-05",
                  done: 1,
                  total: 4,
                  blockedBy: [],
                  openDecisions: ["D-3"],
                },
              ],
            }}
          />
        </Example>
      </DesignSection>
    </>
  );
}
