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
  Line,
  LineClaim,
  Link,
  Milestone,
  Notice,
  Project,
  PlanStep,
  PullRequest,
  StatusUpdate,
  SyncFailure,
  View,
  WakeEnd,
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
/** An agent with what is recorded of its latest wake: its process while it runs, and when and how it ended. */
export const WakeRow = Agent.extend({
  wakePid: z.number().int().nullable(),
  wakeEndedAt: z.string().nullable(),
  wakeEnd: WakeEnd.nullable(),
});
export type WakeRow = z.infer<typeof WakeRow>;

/** A line as stored; its repos live in their own table and are joined in when it is read. */
export const LineRow = Line.omit({ repos: true });
/** A plan step as stored: its address is worked out from the tree. */
export const PlanStepRow = PlanStep.omit({ address: true }).extend({ ord: z.number().int() });
export type PlanStepRow = z.infer<typeof PlanStepRow>;

/** A plan branch as stored: by ids, its address and state worked out from the tree. */
export const PlanBranchRow = z.object({
  id: z.number().int(),
  line: z.string(),
  fromStep: z.number().int(),
  holdsUp: z.number().int().nullable(),
  position: z.number().int(),
  title: z.string(),
  became: z.string().nullable(),
});
export type PlanBranchRow = z.infer<typeof PlanBranchRow>;
export const LineRepoRow = z.object({ line: z.string(), repo: z.string() });
export const ClaimRow = LineClaim;
export const NoticeRow = Notice.extend({ wakes: z.number().transform((value) => value !== 0) });
export const IssueRow = Issue.extend({ labels: jsonColumn(StringList), fields: jsonColumn(StringList) });
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
