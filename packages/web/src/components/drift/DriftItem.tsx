import type { Drift } from "@octotrack/core/schemas";
import { driftTitle, shortDate } from "../../lib/format.ts";
import { DriftAnswer, type DriftMode } from "./DriftAnswer.tsx";
import { StatusBadge } from "../ui/Badge.tsx";
import { Facts } from "../ui/Facts.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Row } from "../ui/Row.tsx";

export type { DriftMode } from "./DriftAnswer.tsx";

export interface DriftItemProps {
  drift: Drift;
  /** An answer to it waits with Undo: neither button can send another. */
  busy?: boolean;
  onAck(ref: string, mode: DriftMode, note: string): void;
}

/** Something out of date, as a row: what to check, on what and since when, what changed, and how to clear it. */
export function DriftItem({ drift, busy = false, onAck }: DriftItemProps) {
  return (
    <Row
      label={drift.ref}
      title={driftTitle(drift.rule, drift.target)}
      facts={
        <Facts>
          <RefLink value={drift.ref} />
          {drift.status === "open" ? "out of date" : <StatusBadge value={drift.status} />}
          <On target={drift.target} />
          {drift.assignee === null ? null : `for ${drift.assignee}`}
          {`since ${shortDate(drift.createdAt)}`}
        </Facts>
      }
      note={<RefText text={drift.message} />}
    >
      <DriftAnswer drift={drift} busy={busy} onAck={onAck} />
    </Row>
  );
}

/** What the drift is about, openable. */
function On({ target }: { target: string }) {
  return (
    <>
      on <RefLink value={target} />
    </>
  );
}
