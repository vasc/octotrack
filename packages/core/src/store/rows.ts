import { z } from "zod";
import {
  Agent,
  Decision,
  DecisionOption,
  Drift,
  EventAttrs,
  FeedEvent,
  FieldChange,
  Idea,
  Issue,
  Link,
  Milestone,
  Project,
  PullRequest,
  StatusUpdate,
  SyncFailure,
  View,
  WatchSpec,
} from "../schemas.ts";

function jsonColumn<S extends z.ZodType>(schema: S) {
  return z
    .string()
    .transform((text): unknown => JSON.parse(text))
    .pipe(schema);
}

const boolColumn = z.number().transform((value) => value === 1);
const StringList = z.array(z.string());

export const ProjectRow = Project;
export const MilestoneRow = Milestone;
export const PrRow = PullRequest;
export const StatusUpdateRow = StatusUpdate;
export const LinkRow = Link;
export const AgentRow = Agent;

export const IssueRow = Issue.extend({ labels: jsonColumn(StringList) });
export const IdeaRow = Idea.extend({ labels: jsonColumn(StringList) });
export const DecisionRow = Decision.extend({ options: jsonColumn(z.array(DecisionOption)) });
export const EventRow = FeedEvent.extend({
  related: jsonColumn(StringList),
  attrs: jsonColumn(EventAttrs),
  changes: jsonColumn(z.record(z.string(), FieldChange)),
});
export const DriftRow = Drift.extend({ edge: boolColumn, viaLink: boolColumn });
export const ViewRow = View.extend({ builtin: boolColumn });

/** The raw row; `waiting` is derived from `lastSeenAt` when the row is read. */
export const WatchRow = z.object({
  ref: z.string(),
  name: z.string().nullable(),
  agent: z.string(),
  spec: jsonColumn(WatchSpec),
  cursor: z.number().int(),
  follow: boolColumn,
  ephemeral: boolColumn,
  status: z.enum(["active", "fired", "cancelled", "expired"]),
  refs: jsonColumn(StringList),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  firedAt: z.string().nullable(),
  /** What the watch saw when it fired, so that a later `watch check` can still report it. */
  result: z.string().nullable(),
});
export type WatchRow = z.output<typeof WatchRow>;

export const SyncFailureRow = SyncFailure;
export const CountRow = z.object({ n: z.number().int() });
export const ValueRow = z.object({ value: z.number().int() });
export const RefRow = z.object({ ref: z.string() });
