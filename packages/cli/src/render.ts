import type {
  Decision,
  DecisionCard,
  Drift,
  EntityDetail,
  EntitySummary,
  FeedEvent,
  Idea,
  Issue,
  IssueCard,
  Link,
  Milestone,
  NextWork,
  PrCard,
  ProjectCard,
  PullRequest,
  Roadmap,
  StatusUpdate,
  View,
  Watch,
  WatchResult,
} from "@octotrack/core";

const useColor = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

function paint(code: number, text: string): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}
export const dim = (text: string) => paint(2, text);
export const bold = (text: string) => paint(1, text);
export const red = (text: string) => paint(31, text);
export const green = (text: string) => paint(32, text);
export const yellow = (text: string) => paint(33, text);
export const cyan = (text: string) => paint(36, text);

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function visibleLength(text: string): number {
  return text.replace(ANSI, "").length;
}

export function table(rows: readonly (readonly string[])[]): string {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, visibleLength(cell));
    });
  }
  return rows
    .map((row) =>
      row
        .map((cell, index) =>
          index === row.length - 1 ? cell : cell + " ".repeat((widths[index] ?? 0) - visibleLength(cell)),
        )
        .join("  "),
    )
    .join("\n");
}

function statusColor(status: string): string {
  switch (status) {
    case "done":
    case "decided":
    case "merged":
    case "passing":
    case "approved":
    case "verified":
    case "updated":
      return green(status);
    case "failing":
    case "blocked":
    case "changes_requested":
    case "open":
      return yellow(status);
    default:
      return status;
  }
}

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function orNothing(lines: readonly string[], what: string): string {
  return lines.length === 0 ? dim(`No ${what}.`) : lines.join("\n");
}

export function renderIssues(cards: readonly IssueCard[]): string {
  if (cards.length === 0) return dim("No issues.");
  return table(
    cards.map((card) => [
      bold(card.issue.ref),
      statusColor(card.issue.status),
      card.issue.priority,
      card.issue.assignee === null ? dim("-") : `@${card.issue.assignee}`,
      card.issue.title +
        (card.blockedBy.length > 0 ? yellow(` [blocked by ${card.blockedBy.join(", ")}]`) : "") +
        (card.openDrift > 0 ? red(` [${card.openDrift} drift]`) : ""),
    ]),
  );
}

export function renderIssueLines(issues: readonly Issue[]): string {
  return table(issues.map((issue) => [bold(issue.ref), statusColor(issue.status), issue.title]));
}

export function renderProjects(cards: readonly ProjectCard[]): string {
  if (cards.length === 0) return dim("No projects.");
  return table(
    cards.map(({ project, stats }) => [
      bold(project.ref),
      statusColor(project.status),
      `${stats.issuesClosed}/${stats.issuesTotal} done`,
      `${stats.openDecisions} decisions`,
      `${stats.openPrs} PRs`,
      `${stats.openDrift} drift`,
      project.name,
    ]),
  );
}

export function renderDecisionBlock(decision: Decision): string {
  const lines = [
    `${bold(decision.ref)} ${statusColor(decision.status)}  ${decision.kind}  ${decision.priority}  ${dim(`asked by ${decision.requestedBy}`)}`,
    bold(decision.title),
  ];
  if (decision.context !== "") lines.push("", decision.context);
  if (decision.options.length > 0) {
    lines.push("");
    for (const option of decision.options) {
      const markers = [
        option.key === decision.recommendation ? cyan("recommended") : null,
        option.key === decision.chosenOption ? green("chosen") : null,
      ].filter((item) => item !== null);
      const description = option.description === "" ? "" : dim(` - ${option.description}`);
      lines.push(
        `  ${bold(option.key)}  ${option.label}${description}${markers.length > 0 ? `  ${markers.join(" ")}` : ""}`,
      );
    }
  }
  if (decision.status === "decided") {
    const parts = [
      `Decided by ${decision.decidedBy ?? "?"}`,
      decision.decidedAt === null ? null : when(decision.decidedAt),
      `via ${decision.channel ?? "?"}`,
    ].filter((item) => item !== null);
    lines.push("", green(parts.join(", ")));
    if (decision.resolutionNote !== null) lines.push(decision.resolutionNote);
    if (decision.sourceUrl !== null) lines.push(dim(decision.sourceUrl));
    if (decision.reportStatus !== null) {
      lines.push(
        "",
        `${decision.reportStatus === "done" ? "Carried out" : "Partly carried out"}: ${decision.reportNote ?? ""}`,
      );
    }
    if (decision.wakeError !== null) lines.push(dim(`Wake failed: ${decision.wakeError}`));
  }
  return lines.join("\n");
}

export function renderInbox(decisions: readonly Decision[]): string {
  if (decisions.length === 0) return dim("Nothing waiting for you.");
  const blocks = decisions.map((decision) => renderDecisionBlock(decision)).join("\n\n");
  return `${blocks}\n\n${dim('Acknowledge with octo decision pickup <REF>, then octo decision report <REF> "what you did".')}`;
}

export function renderDecisions(decisions: readonly Decision[]): string {
  if (decisions.length === 0) return dim("No decisions.");
  return table(
    decisions.map((decision) => [
      bold(decision.ref),
      statusColor(decision.status),
      decision.kind,
      decision.priority,
      decision.title,
    ]),
  );
}

export function renderQueue(cards: readonly DecisionCard[]): string {
  if (cards.length === 0) return dim("Nothing needs a decision.");
  return cards
    .map((card) => {
      const options = card.decision.options
        .map((option) => (option.key === card.decision.recommendation ? cyan(option.key) : option.key))
        .join("/");
      const reasons = card.reasons.length === 0 ? "" : yellow(` ${card.reasons.join(", ")}`);
      return `${bold(card.decision.ref)} ${card.decision.title}${options === "" ? "" : dim(` [${options}]`)}${reasons}`;
    })
    .join("\n");
}

function prLine(card: PrCard): string[] {
  const { pr } = card;
  return [
    bold(pr.ref),
    `${pr.repo}#${pr.number}`,
    statusColor(pr.state),
    `checks:${statusColor(pr.checks)}`,
    `review:${statusColor(pr.review)}`,
    pr.title + (card.attention.length > 0 ? yellow(` [${card.attention.join(", ")}]`) : ""),
  ];
}

export function renderPrs(cards: readonly PrCard[]): string {
  return cards.length === 0 ? dim("No pull requests.") : table(cards.map(prLine));
}

export function renderPr(pr: PullRequest): string {
  return `${bold(pr.ref)} ${pr.repo}#${pr.number} ${statusColor(pr.state)}: ${pr.title}`;
}

export function renderIdeas(ideas: readonly Idea[]): string {
  if (ideas.length === 0) return dim("No ideas.");
  return table(ideas.map((idea) => [bold(idea.ref), statusColor(idea.status), idea.horizon, idea.title]));
}

export function renderMilestones(milestones: readonly Milestone[]): string {
  if (milestones.length === 0) return dim("No milestones.");
  return table(
    milestones.map((milestone) => [
      bold(milestone.ref),
      milestone.project,
      statusColor(milestone.status),
      milestone.targetDate?.slice(0, 10) ?? "-",
      milestone.title,
    ]),
  );
}

export function renderLinks(links: readonly Link[]): string {
  if (links.length === 0) return dim("No links.");
  return table(links.map((link) => [link.fromRef, dim(link.rel), link.toRef]));
}

export function renderDriftList(drifts: readonly Drift[]): string {
  if (drifts.length === 0) return green("No drift. Everything is consistent.");
  return drifts
    .map((drift) => {
      const closed =
        drift.status === "open"
          ? ""
          : ` ${statusColor(drift.status)}${drift.note === null ? "" : `: ${drift.note}`}`;
      return `${bold(drift.ref)} ${dim(drift.rule)}${closed}\n  ${drift.message}\n  ${dim(drift.suggestion)}`;
    })
    .join("\n");
}

export function renderDriftNotice(drifts: readonly Drift[]): string {
  if (drifts.length === 0) return "";
  const lines = drifts.map((drift) => `  ${bold(drift.ref)} ${drift.message}\n  ${dim(drift.suggestion)}`);
  return `${yellow(`This change opened ${drifts.length} drift:`)}\n${lines.join("\n")}`;
}

export function renderEvents(events: readonly FeedEvent[]): string {
  if (events.length === 0) return dim("No events.");
  return events.map(renderEvent).join("\n");
}

export function renderEvent(event: FeedEvent): string {
  return `${dim(when(event.ts))} ${cyan(event.actor)} ${event.summary}`;
}

export function renderSummaries(items: readonly EntitySummary[]): string {
  if (items.length === 0) return dim("Nothing found.");
  return table(items.map((item) => [bold(item.ref), dim(item.kind), statusColor(item.status), item.title]));
}

export function renderViews(views: readonly View[]): string {
  return table(
    views.map((view) => [
      bold(view.name),
      view.builtin ? dim("builtin") : "saved",
      view.query || dim("(all)"),
    ]),
  );
}

export function renderWatches(watches: readonly Watch[]): string {
  if (watches.length === 0) return dim("No watches.");
  return table(
    watches.map((watch) => [
      bold(watch.ref),
      watch.name ?? "-",
      `@${watch.agent}`,
      watch.waiting ? yellow("waiting") : statusColor(watch.status),
      watch.spec.clauses.map((clause) => clause.query).join(watch.spec.require === "all" ? " AND " : " OR "),
    ]),
  );
}

export function renderWatchResults(results: readonly WatchResult[]): string {
  return results
    .map((result) => {
      const lines = [
        `${bold(result.name ?? result.watch)} ${result.fired ? green("fired") : dim("not yet")}`,
      ];
      for (const clause of result.clauses) {
        if (result.fired && !clause.satisfied) continue;
        for (const event of clause.events) lines.push(`  ${renderEvent(event)}`);
        for (const entity of clause.entities)
          lines.push(`  ${entity.ref} ${statusColor(entity.status)} ${entity.title}`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

export function renderUpdate(update: StatusUpdate): string {
  return `${bold(update.ref)} ${update.level}: ${update.body}`;
}

export function renderUpdates(updates: readonly StatusUpdate[]): string {
  if (updates.length === 0) return dim("No updates.");
  return updates
    .map((update) => `${dim(when(update.createdAt))} ${cyan(update.actor)} [${update.level}] ${update.body}`)
    .join("\n");
}

export function renderNext(next: NextWork): string {
  const sections: string[] = [bold(`Next for ${next.agent}: ${next.summary}`)];
  const add = (title: string, body: string) => sections.push("", bold(title), body);
  if (next.resolvedDecisions.length > 0) {
    add(
      "Your decisions that came back",
      next.resolvedDecisions.map((decision) => renderDecisionBlock(decision)).join("\n\n"),
    );
  }
  if (next.drift.length > 0) add("Drift to clear", renderDriftList(next.drift));
  if (next.prs.length > 0) add("Pull requests needing you", renderPrs(next.prs));
  if (next.claimed.length > 0) add("Claimed by you", renderIssues(next.claimed));
  if (next.awaitingDecisions.length > 0)
    add("Still waiting for a decision", renderDecisions(next.awaitingDecisions));
  if (next.ready.length > 0) add("Ready to pick up", renderIssues(next.ready));
  return sections.join("\n");
}

export function renderRoadmap(roadmap: Roadmap): string {
  return roadmap.markdown;
}

function renderBody(detail: EntityDetail): string {
  const entity = detail.entity;
  if ("options" in entity) return renderDecisionBlock(entity);
  const header = `${bold(detail.summary.ref)} ${dim(detail.summary.kind)} ${statusColor(detail.summary.status)}\n${bold(detail.summary.title)}`;
  const lines = [header];
  if ("number" in entity) {
    lines.push(
      `${entity.repo}#${entity.number}  checks:${statusColor(entity.checks)}  review:${statusColor(entity.review)}  mergeable:${entity.mergeable}`,
      `${entity.headRef} -> ${entity.baseRef}  +${entity.additions} -${entity.deletions}  by ${entity.author}`,
      entity.url,
    );
  }
  if ("assignee" in entity && "labels" in entity && "priority" in entity) {
    lines.push(
      `${entity.priority} priority, ${entity.assignee === null ? "unassigned" : `assigned to ${entity.assignee}`}${
        entity.labels.length > 0 ? `, labels: ${entity.labels.join(", ")}` : ""
      }${entity.milestone === null ? "" : `, milestone ${entity.milestone}`}`,
    );
  }
  if ("rule" in entity) lines.push(dim(entity.rule), entity.suggestion);
  const body =
    "body" in entity && entity.body !== detail.summary.title
      ? entity.body
      : "description" in entity
        ? entity.description
        : "";
  if (body !== "") lines.push("", body);
  return lines.join("\n");
}

export function renderDetail(detail: EntityDetail): string {
  const sections = [renderBody(detail)];
  const add = (title: string, body: string) => sections.push("", bold(title), body);
  if (detail.links.length > 0) add("Links", renderLinks(detail.links));
  const openDrift = detail.drift.filter((drift) => drift.status === "open");
  if (openDrift.length > 0) add("Open drift", renderDriftList(openDrift));
  if (detail.updates.length > 0) add("Updates", renderUpdates(detail.updates));
  add("History", renderEvents(detail.history.slice(0, 15)));
  return sections.join("\n");
}

export { orNothing };
