import { PrGlyphs } from "../components/prs/PrGlyphs.tsx";
import { PrRow } from "../components/prs/PrRow.tsx";
import { PrStrip } from "../components/prs/PrStrip.tsx";
import { SyncFailures } from "../components/prs/SyncFailures.tsx";
import { Badge, StatusBadge } from "../components/ui/Badge.tsx";
import { Progress } from "../components/ui/Progress.tsx";
import { RefText } from "../components/ui/RefText.tsx";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/states.tsx";
import { DesignSection, Example } from "./Example.tsx";
import { pr, prCard } from "./fixtures.ts";

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
        <Example label="Progress">
          <Progress done={3} total={8} />
        </Example>
      </DesignSection>
      <DesignSection title="Pull requests">
        <div className="design-row">
          <PrGlyphs checks="passing" review="approved" />
          <PrGlyphs checks="failing" review="changes_requested" />
          <PrGlyphs checks="pending" review="requested" />
          <PrGlyphs checks="none" review="none" />
        </div>
        <div className="rows">
          <PrRow
            card={prCard({
              pr: pr({ checks: "failing", review: "requested" }),
              attention: ["checks failing", "needs review"],
            })}
          />
          <PrRow card={prCard({ pr: pr({ review: "approved" }), attention: ["ready to merge"] })} />
          <PrRow card={prCard({ pr: pr({ state: "draft", checks: "pending" }) })} />
          <PrRow card={prCard({ pr: pr({ state: "merged" }) })} />
        </div>
        <Example label="Replaces the rail on narrow screens">
          <PrStrip
            cards={[prCard({ attention: ["checks failing"] }), prCard({ attention: ["ready to merge"] })]}
          />
        </Example>
        <SyncFailures failures={[{ repo: "acme/app", error: "gh is not logged in", updatedAt: "" }]} />
      </DesignSection>
      <DesignSection title="Loading, empty and error">
        <LoadingState label="Loading the feed" />
        <EmptyState command="octo guide">Nothing here yet.</EmptyState>
        <ErrorState error={new Error("D-3 was already decided by claude-a")} />
      </DesignSection>
    </>
  );
}
