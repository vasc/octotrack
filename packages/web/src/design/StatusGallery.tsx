import { PullRequestBox } from "../components/entity/PullRequestBox.tsx";
import { SyncFailures } from "../components/prs/SyncFailures.tsx";
import { Badge, StatusBadge } from "../components/ui/Badge.tsx";
import { RefText } from "../components/ui/RefText.tsx";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/states.tsx";
import { DesignSection, Example } from "./Example.tsx";
import { pr } from "./fixtures.ts";

const TONES = ["neutral", "good", "bad", "warn", "info", "attention"] as const;
const STATUSES = ["open", "decided", "in_progress", "blocked", "failing", "merged", "changes_requested"];

/** The small vocabulary everything else is written in. */
export function StatusGallery() {
  return (
    <>
      <DesignSection title="Tones and badges">
        <div className="design-row">
          {TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="design-row">
          {STATUSES.map((status) => (
            <StatusBadge key={status} value={status} />
          ))}
        </div>
        <Example label="Refs are clickable anywhere in running text">
          <span>
            <RefText text="D-3 decided, so OCT-12 can move, once PR-7 merges." />
          </span>
        </Example>
      </DesignSection>
      <DesignSection title="Pull requests">
        <PullRequestBox
          prs={[
            pr({ checks: "failing" }),
            pr({ ref: "PR-8", number: 8, checks: "passing", title: "Second" }),
          ]}
        />
        <SyncFailures failures={[{ repo: "acme/app", error: "gh is not logged in", updatedAt: "" }]} />
      </DesignSection>
      <DesignSection title="Loading, empty and error">
        <LoadingState label="Loading the feed" />
        <EmptyState command="octo guide">Nothing here yet.</EmptyState>
        <ErrorState error={new Error("D-3 was already decided by agent-a")} />
      </DesignSection>
    </>
  );
}
