import { contracts } from "@octotrack/core/contracts";
import type { EntityDetail, Issue } from "@octotrack/core/schemas";
import { Fragment } from "react";
import { useChoices } from "../../hooks/useChoices.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useIssueTell } from "../../hooks/useIssueTell.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { usePlanStep } from "../../hooks/usePlanStep.ts";
import { humanize } from "../../lib/format.ts";
import { issueLinks } from "../../lib/links.ts";
import { backEntity, openEntity } from "../../lib/router.ts";
import { howClosed, isTask } from "../../lib/tasks.ts";
import { TaskClosed } from "../home/TaskClosed.tsx";
import { TaskItem } from "../home/TaskItem.tsx";
import { Facts } from "../ui/Facts.tsx";
import { StaleNote } from "../ui/Loaded.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { Code } from "../ui/Note.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { Panel } from "../ui/Panel.tsx";
import { RefLink, TextLink } from "../ui/RefLink.tsx";
import { ErrorState } from "../ui/states.tsx";
import { EventList } from "./EventList.tsx";
import { OpenDrift } from "./OpenDrift.tsx";
import { PullRequestBox } from "./PullRequestBox.tsx";
import { TaskFrees } from "./TaskFrees.tsx";
import { TellBox } from "./TellBox.tsx";

/**
 * A task or an issue opened in place, as E-Issue draws it. A task: what it is, what to send back, and what it frees.
 * An issue: what it is, its pull requests with their checks, what happened lately, and Tell whoever holds it.
 */
export function IssuePanel({
  issue,
  detail,
  stale = null,
}: {
  issue: Issue;
  detail: EntityDetail;
  /** Why the panel could not refresh, once it had loaded: what it shows may be out of date. */
  stale?: Error | null;
}) {
  const h = useHome();
  const choices = useChoices();
  const prs = useOpQuery(contracts.prList, { query: `linked:${issue.ref} kind:pr` });
  const tell = useIssueTell(issue);
  const line = issue.line === null ? null : h.lineOf(issue.line);
  const task = isTask(issue);
  const open = issue.status !== "done" && issue.status !== "cancelled";
  const { frees, waitsOn } = issueLinks(issue.ref, detail.links);
  const step = usePlanStep(issue.line, issue.step);
  // A Tell about an issue reaches whoever holds it, else the line's owner, as the server delivers it.
  const owner = issue.line === null ? null : (h.home.data?.crews[issue.line]?.owner?.name ?? null);
  const tellTo =
    issue.assignee !== null
      ? `${issue.assignee}, who holds ${issue.ref}`
      : owner === null
        ? null
        : `${owner}, who owns ${issue.line ?? ""}`;
  const freed = detail.linked.filter((item) => frees.includes(item.ref));
  return (
    <Panel
      crumbs={
        <nav aria-label="Where this is">
          <Facts>
            {line === null ? null : <TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
            {issue.step === null ? null : `step ${issue.step}${step === null ? "" : ` of ${step.of}`}`}
            <Code>{issue.ref}</Code>
          </Facts>
        </nav>
      }
      {...(task ? {} : { title: issue.title })}
      onClose={backEntity}
    >
      {stale === null ? null : <StaleNote error={stale} />}
      {task ? (
        open ? (
          <TaskItem task={issue} onDone={h.taskDone} onCant={h.taskCant} />
        ) : (
          <TaskClosed task={issue} closed={howClosed(detail.history)} />
        )
      ) : (
        <Stack>
          <Facts>
            Issue
            {humanize(issue.status)}
            {issue.assignee === null ? "nobody holds it" : `held by ${issue.assignee}`}
            <Code>{h.repoName(issue.project)}</Code>
            {waitsOn.length === 0 ? null : <RefList label="waiting on" refs={waitsOn} />}
            {frees.length === 0 ? null : <RefList label="holds up" refs={frees} />}
          </Facts>
          {issue.body === "" ? null : <Markdown text={issue.body} />}
        </Stack>
      )}
      {task ? (
        <TaskFrees freed={freed} />
      ) : (
        <>
          <PullRequestBox
            prs={(prs.data ?? []).map((card) => card.pr)}
            loading={prs.isPending}
            error={prs.error}
          />
          <EventList title="Activity" events={detail.history} />
          {issue.line === null ? null : (
            <TellBox
              line={issue.line}
              to={tellTo}
              words={tell.draft.value}
              sending={tell.sending}
              onWords={tell.draft.change}
              onSend={tell.send}
            />
          )}
        </>
      )}
      <OpenDrift drift={detail.drift} />
      <NotKept error={tell.draft.error} />
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
    </Panel>
  );
}

/** Refs after a few words, such as what an issue waits on. */
function RefList({ label, refs }: { label: string; refs: readonly string[] }) {
  return (
    <>
      {label}
      {refs.map((ref) => (
        <Fragment key={ref}>
          {" "}
          <RefLink value={ref} />
        </Fragment>
      ))}
    </>
  );
}
