import { contracts } from "@octotrack/core/contracts";
import type { EntityDetail, Issue } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { backEntity, openEntity } from "../../lib/router.ts";
import { TaskItem } from "../home/TaskItem.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { ErrorState } from "../ui/states.tsx";
import { ActivityList } from "./ActivityList.tsx";
import { PullRequestBox } from "./PullRequestBox.tsx";
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
  const line =
    issue.line === null
      ? null
      : ([...(h.home.data?.working ?? []), ...(h.home.data?.upNext ?? [])].find(
          (candidate) => candidate.ref === issue.line,
        ) ?? null);
  // A task is an issue for the developer with something to report: "dev" is the name the developer acts under.
  const task = issue.assignee === "dev" && issue.outcome !== null;
  const frees = detail.links
    .filter((link) => link.fromRef === issue.ref && link.rel === "blocks")
    .map((link) => link.toRef);
  const waitsOn = detail.links
    .filter((link) => link.toRef === issue.ref && link.rel === "blocks")
    .map((link) => link.fromRef);
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
        <TaskItem task={issue} onDone={h.taskDone} onCant={h.taskCant} />
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
        frees.length === 0 ? null : (
          <section className="panel-section" aria-label="What it frees">
            <h2 className="panel-label">What it frees</h2>
            <p className="panel-prose">
              {frees.join(", ")}. Done goes to the line's inbox for whoever holds{" "}
              {frees.length === 1 ? "it" : "them"}, and wakes them.
            </p>
          </section>
        )
      ) : (
        <>
          <PullRequestBox prs={(prs.data ?? []).map((card) => card.pr)} holder={issue.assignee} />
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
