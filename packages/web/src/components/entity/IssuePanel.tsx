import { contracts } from "@octotrack/core/contracts";
import type { EntityDetail, Issue } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { useStepTitle } from "../../hooks/useStepTitle.ts";
import { issueLinks } from "../../lib/links.ts";
import { backEntity, openEntity } from "../../lib/router.ts";
import { isTask } from "../../lib/tasks.ts";
import { TaskClosed } from "../home/TaskClosed.tsx";
import { TaskItem } from "../home/TaskItem.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { ErrorState } from "../ui/states.tsx";
import { ActivityList } from "./ActivityList.tsx";
import { PullRequestBox } from "./PullRequestBox.tsx";
import { OpenDrift } from "./OpenDrift.tsx";
import { TaskFrees } from "./TaskFrees.tsx";
import { TellBox } from "./TellBox.tsx";

/**
 * A task or an issue opened in place, as E-Issue draws it. A task: what it is, what to send back, and what it frees.
 * An issue: what it is, its pull requests with their checks, what happened lately, and Tell whoever holds it.
 */
export function IssuePanel({ issue, detail }: { issue: Issue; detail: EntityDetail }) {
  const h = useHome();
  const choices = useChoices();
  const prs = useOpQuery(contracts.prList, { query: `linked:${issue.ref} kind:pr` });
  const tell = useDraft(`tell:${issue.ref}`);
  const line = issue.line === null ? null : h.lineOf(issue.line);
  const task = isTask(issue);
  const open = issue.status !== "done" && issue.status !== "cancelled";
  const { frees, waitsOn } = issueLinks(issue.ref, detail.links);
  const freed = detail.linked.filter((item) => frees.includes(item.ref));
  const step = useStepTitle(issue.line, issue.step);
  return (
    <section className="line-panel" aria-label={`${task ? "Task" : "Issue"} ${issue.ref}`}>
      <div className="panel-crumbs">
        <nav aria-label="Where this is">
          {line === null ? null : (
            <>
              <button type="button" className="panel-link line-link" onClick={() => openEntity(line.ref)}>
                {line.title}
              </button>
              {issue.step === null ? null : <> · step {issue.step}</>} ·{" "}
            </>
          )}
          <span className="mono">{issue.ref}</span>
        </nav>
        <button type="button" className="btn" aria-label="Close" onClick={backEntity}>
          Esc
        </button>
      </div>
      {task ? (
        open ? (
          <TaskItem
            task={issue}
            {...(step === null ? {} : { holdsUp: step })}
            onDone={h.taskDone}
            onCant={h.taskCant}
          />
        ) : (
          <TaskClosed task={issue} />
        )
      ) : (
        <>
          <div className="question-strip">
            <span className="item-kind">Issue</span>
            <span>{issue.status.replace("_", " ")}</span>
            {issue.assignee === null ? <span>nobody holds it</span> : <span>held by {issue.assignee}</span>}
            <span className="mono">{h.repoName(issue.project)}</span>
            <RefList label="waiting on" refs={waitsOn} />
            <RefList label="holds up" refs={frees} />
          </div>
          <h1 className="panel-title">{issue.title}</h1>
          {issue.body === "" ? null : (
            <div className="summary-text">
              <Markdown text={issue.body} />
            </div>
          )}
        </>
      )}
      {task ? (
        <TaskFrees freed={freed} />
      ) : (
        <>
          <PullRequestBox
            prs={(prs.data ?? []).map((card) => card.pr)}
            holder={issue.assignee}
            loading={prs.isPending}
            error={prs.error}
          />
          <ActivityList events={detail.history} />
          {issue.line === null ? null : (
            <TellBox
              line={issue.line}
              to={issue.assignee === null ? null : `${issue.assignee}, who holds ${issue.ref}`}
              words={tell.value}
              sending={choices.waiting(`tell:${issue.ref}`)}
              onWords={tell.change}
              onSend={(words) =>
                void tell
                  .flush()
                  .then(() =>
                    choices.make(
                      contracts.lineTell.name,
                      { line: issue.line ?? "", body: words, issue: issue.ref },
                      words === ""
                        ? `Nudging whoever holds ${issue.ref}`
                        : `Telling whoever holds ${issue.ref}: ${words}`,
                      `tell:${issue.ref}`,
                    ),
                  )
              }
            />
          )}
        </>
      )}
      <OpenDrift drift={detail.drift} />
      <NotKept error={tell.error} />
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
    </section>
  );
}

function RefList({ label, refs }: { label: string; refs: readonly string[] }) {
  if (refs.length === 0) return null;
  return (
    <span>
      {label}{" "}
      {refs.map((ref) => (
        <RefLink key={ref} value={ref} />
      ))}
    </span>
  );
}
