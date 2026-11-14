import type { SqlDriver } from "../../src/db/driver.ts";
import { migrate } from "../../src/db/migrations.ts";

const T = "2026-11-01T09:00:00.000Z";

/**
 * A database as it was at schema version 4, shaped like the developer's real one: repos with and without a GitHub
 * repo, a done milestone, blocked issues that are really tasks, open and answered decisions (one with a wake address),
 * captured and promoted ideas, updates on a project and on an issue, links, a PR, events, agents, a custom view and a
 * watch whose query names a project. Raw SQL on purpose: it must stay what version 4 was, whatever later code does.
 */
export function buildVersion4(driver: SqlDriver): void {
  migrate(driver, 4);
  const run = (sql: string, params: readonly (string | number | null)[] = []) => driver.run(sql, params);
  const project = (ref: string, name: string, status: string, repo: string | null) =>
    run(
      `INSERT INTO projects (ref, name, description, status, repo, horizon, targetDate, version, createdAt, updatedAt, createdBy)
       VALUES (?, ?, ?, ?, ?, 'now', NULL, 1, ?, ?, 'agent-a')`,
      [ref, name, `${name}, as code`, status, repo, T, T],
    );
  project("PANEL", "Home panel", "active", "vasc/homepanel");
  project("OCT", "Octotrack", "active", null);
  project("MEDIA", "Mediarr", "paused", "vasc/mediarr");
  project("LIFE", "Life admin", "active", null);

  run(
    `INSERT INTO milestones (ref, project, title, description, status, horizon, targetDate, version, createdAt, updatedAt, createdBy)
     VALUES ('M-1', 'PANEL', 'First print', '', 'done', 'now', NULL, 1, ?, ?, 'panel-widgets')`,
    [T, T],
  );

  const issue = (
    ref: string,
    projectRef: string,
    title: string,
    status: string,
    assignee: string | null,
    milestone: string | null,
  ) =>
    run(
      `INSERT INTO issues (ref, project, title, body, status, priority, assignee, labels, milestone, version, createdAt, updatedAt, closedAt, createdBy)
       VALUES (?, ?, ?, ?, ?, 'medium', ?, '[]', ?, 1, ?, ?, ?, 'panel-widgets')`,
      [
        ref,
        projectRef,
        title,
        `## ${title}\n\nBody in **markdown**.`,
        status,
        assignee,
        milestone,
        T,
        T,
        status === "done" ? T : null,
      ],
    );
  issue("PANEL-5", "PANEL", "Test-print the current parts", "todo", null, "M-1");
  issue("PANEL-6", "PANEL", "Measure the five numbers the model assumes", "blocked", null, null);
  issue("PANEL-7", "PANEL", "Model the base", "done", null, "M-1");
  issue("OCT-41", "OCT", "Wake a desktop session with its answer", "in_review", "octotrack-builder", null);
  issue("MEDIA-2", "MEDIA", "Clean the podcast folder", "in_progress", "mediarr", null);

  run(
    `INSERT INTO decisions (ref, project, kind, title, context, options, recommendation, status, priority, requestedBy, version, createdAt, updatedAt, wakeAddress)
     VALUES ('D-34', 'PANEL', 'product', 'Which board goes in?', 'The printed base fits the 26 mm board.',
       '[{"key":"a","label":"26 mm","description":"Print as it is."},{"key":"b","label":"30 mm","description":"Rebuild the model first."}]', 'a', 'open', 'medium', 'panel-widgets', 1, ?, ?, 'claude:panel-session')`,
    [T, T],
  );
  run(
    `INSERT INTO decisions (ref, project, kind, title, context, options, recommendation, status, priority, requestedBy, chosenOption, decidedBy, decidedAt, channel, version, createdAt, updatedAt, pickedUpAt, pickedUpBy)
     VALUES ('D-12', 'OCT', 'technical', 'Inbox per agent?', '', '[]', NULL, 'decided', 'high', 'octotrack-builder', NULL, 'dev', ?, 'dashboard', 2, ?, ?, ?, 'octotrack-builder')`,
    [T, T, T, T],
  );
  run(
    `INSERT INTO decisions (ref, project, kind, title, context, options, recommendation, status, priority, requestedBy, chosenOption, decidedBy, decidedAt, channel, version, createdAt, updatedAt)
     VALUES ('D-13', 'MEDIA', 'technical', 'Delete duplicates?', 'Proven duplicates only.', '[]', NULL, 'decided', 'low', 'mediarr', NULL, 'dev', ?, 'dashboard', 2, ?, ?)`,
    [T, T, T],
  );

  const idea = (
    ref: string,
    projectRef: string | null,
    title: string,
    status: string,
    promotedTo: string | null,
  ) =>
    run(
      `INSERT INTO ideas (ref, project, title, body, status, horizon, labels, promotedTo, version, createdAt, updatedAt, createdBy)
       VALUES (?, ?, ?, '', ?, 'later', '[]', ?, 1, ?, ?, 'agent-a')`,
      [ref, projectRef, title, status, promotedTo, T, T],
    );
  idea("I-1", "PANEL", "Wall mount", "captured", null);
  idea("I-2", null, "A weekly digest", "captured", null);
  idea("I-3", "OCT", "Multi-commit PR groups", "promoted", "OCT-41");

  run(
    `INSERT INTO updates (ref, target, project, level, body, actor, version, createdAt, updatedAt)
     VALUES ('U-1', 'PANEL', 'PANEL', 'info', 'Printed; the short board fits.', 'panel-widgets', 1, ?, ?)`,
    [T, T],
  );
  run(
    `INSERT INTO updates (ref, target, project, level, body, actor, version, createdAt, updatedAt)
     VALUES ('U-2', 'OCT-41', 'OCT', 'info', 'All four checks pass.', 'octotrack-builder', 1, ?, ?)`,
    [T, T],
  );

  run(
    `INSERT INTO links (fromRef, rel, toRef, createdAt, createdBy) VALUES ('PANEL-6', 'blocks', 'PANEL-5', ?, 'panel-widgets')`,
    [T],
  );
  run(
    `INSERT INTO links (fromRef, rel, toRef, createdAt, createdBy) VALUES ('D-34', 'blocks', 'PANEL-5', ?, 'panel-widgets')`,
    [T],
  );

  run(
    `INSERT INTO prs (ref, repo, number, project, title, body, url, state, checks, review, mergeable, headRef, baseRef, headSha, author, additions, deletions, version, createdAt, updatedAt, syncedAt)
     VALUES ('PR-1', 'vasc/homepanel', 14, 'PANEL', 'Base with both openings', 'Fixes PANEL-5', 'https://github.com/vasc/homepanel/pull/14',
       'open', 'passing', 'none', 'clean', 'panel-5', 'main', 'abc123', 'vasc', 212, 40, 1, ?, ?, ?)`,
    [T, T, T],
  );
  run(
    `INSERT INTO links (fromRef, rel, toRef, createdAt, createdBy) VALUES ('PR-1', 'implements', 'PANEL-5', ?, 'github')`,
    [T],
  );

  const event = (type: string, kind: string, ref: string, projectRef: string, summary: string) =>
    run(
      `INSERT INTO events (ts, actor, type, kind, ref, project, summary, related, attrs, changes)
       VALUES (?, 'panel-widgets', ?, ?, ?, ?, ?, '[]', '{}', '{}')`,
      [T, type, kind, ref, projectRef, summary],
    );
  event("project.created", "project", "PANEL", "PANEL", "Project PANEL created: Home panel");
  event("issue.created", "issue", "PANEL-6", "PANEL", "PANEL-6 created");
  event("decision.requested", "decision", "D-34", "PANEL", "D-34 asked: Which board goes in?");

  run(`INSERT INTO agents (name, note, firstSeenAt, lastSeenAt) VALUES ('panel-widgets', NULL, ?, ?)`, [
    T,
    T,
  ]);
  run(`INSERT INTO agents (name, note, firstSeenAt, lastSeenAt) VALUES ('dev', NULL, ?, ?)`, [T, T]);
  run(
    `INSERT INTO views (name, query, position, builtin, createdAt) VALUES ('panel', 'project:PANEL', 10, 0, ?)`,
    [T],
  );
  run(
    `INSERT INTO watches (ref, name, agent, spec, cursor, follow, ephemeral, status, refs, createdAt, lastSeenAt)
     VALUES ('W-1', 'panel-answers', 'panel-widgets',
       '{"clauses":[{"type":"event","query":"project:PANEL kind:decision","count":1}],"require":"any"}', 0, 0, 0, 'active', '[]', ?, ?)`,
    [T, T],
  );

  const counter = (name: string, value: number) =>
    run("INSERT INTO counters (name, value) VALUES (?, ?)", [name, value]);
  counter("decision", 34);
  counter("issue:PANEL", 7);
  counter("issue:OCT", 41);
  counter("issue:MEDIA", 2);
  counter("milestone", 1);
  counter("idea", 3);
  counter("update", 2);
  counter("pr", 1);
}
