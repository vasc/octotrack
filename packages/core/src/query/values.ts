/**
 * The values each closed field can take. A typo here must be an error, not an empty result: `status:opne` matching
 * nothing would make `--until-none` fire at once, which looks exactly like success, and `--on` hang forever.
 *
 * Kept as plain lists, not derived from the zod enums, so that the browser can validate a query without pulling them
 * in through here. A test holds the two together.
 */
export const QUERY_VALUES: Readonly<Record<string, readonly string[]>> = {
  kind: ["project", "issue", "decision", "pr", "milestone", "idea", "update", "drift"],
  status: [
    "planned",
    "active",
    "paused",
    "done",
    "archived",
    "backlog",
    "todo",
    "in_progress",
    "in_review",
    "blocked",
    "cancelled",
    "open",
    "decided",
    "withdrawn",
    "superseded",
    "draft",
    "merged",
    "closed",
    "captured",
    "exploring",
    "promoted",
    "rejected",
    "info",
    "progress",
    "warning",
    "blocker",
    "updated",
    "verified",
    "auto_resolved",
  ],
  priority: ["urgent", "high", "medium", "low", "none"],
  type: ["technical", "architecture", "product", "approval"],
  channel: ["dashboard", "cli", "out_of_band"],
  checks: ["none", "pending", "passing", "failing"],
  review: ["none", "requested", "approved", "changes_requested"],
  state: ["open", "draft", "merged", "closed"],
  level: ["info", "progress", "warning", "blocker", "done"],
  horizon: ["now", "next", "later", "none"],
  blocked: ["true", "false"],
  ready: ["true", "false"],
};
