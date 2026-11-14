import { z } from "zod";
import type { SqlDriver } from "./driver.ts";

/** One schema version: SQL, or code for steps SQL cannot express, such as rewriting a JSON query. */
export type Migration = string | ((driver: SqlDriver) => void);

const Before = z.object({ ref: z.string(), project: z.string().nullable(), title: z.string() });

/**
 * Ideas still open and milestones not finished become proposed lines marked as coming from before. The developer said
 * how they migrate does not matter as long as agents clean up afterwards; their tables stay, so every old ref resolves.
 */
function proposalsFromBefore(driver: SqlDriver): void {
  const ideas = z
    .array(Before)
    .parse(
      driver.all(
        "SELECT ref, project, title FROM ideas WHERE status IN ('captured', 'exploring', 'planned') ORDER BY CAST(SUBSTR(ref, 3) AS INTEGER)",
      ),
    );
  const milestones = z
    .array(Before)
    .parse(
      driver.all(
        "SELECT ref, project, title FROM milestones WHERE status IN ('planned', 'active') ORDER BY CAST(SUBSTR(ref, 3) AS INTEGER)",
      ),
    );
  const now = new Date().toISOString();
  [...ideas, ...milestones].forEach((item, index) => {
    const ref = `L-${index + 1}`;
    driver.run(
      `INSERT INTO lines (ref, title, doneWhen, state, rank, source, fromRef, version, createdAt, updatedAt, createdBy)
       VALUES (?, ?, '', 'proposed', ?, 'migration', ?, 1, ?, ?, 'octotrack')`,
      [ref, item.title, index + 1, item.ref, now, now],
    );
    if (item.project !== null)
      driver.run("INSERT INTO line_repos (line, repo, position) VALUES (?, ?, 0)", [ref, item.project]);
    if (item.ref.startsWith("M-"))
      driver.run("UPDATE issues SET line = ? WHERE milestone = ?", [ref, item.ref]);
  });
  const made = ideas.length + milestones.length;
  if (made > 0) driver.run("INSERT INTO counters (name, value) VALUES ('line', ?)", [made]);
}

const MIGRATIONS: readonly Migration[] = [
  `
  CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);

  CREATE TABLE projects (
    ref TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL,
    repo TEXT, horizon TEXT NOT NULL, targetDate TEXT, version INTEGER NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, createdBy TEXT NOT NULL
  );
  CREATE INDEX projects_repo ON projects(repo);

  CREATE TABLE milestones (
    ref TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(ref), title TEXT NOT NULL,
    description TEXT NOT NULL, status TEXT NOT NULL, horizon TEXT NOT NULL, targetDate TEXT,
    version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, createdBy TEXT NOT NULL
  );
  CREATE INDEX milestones_project ON milestones(project);

  CREATE TABLE issues (
    ref TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(ref), title TEXT NOT NULL,
    body TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, assignee TEXT,
    labels TEXT NOT NULL, milestone TEXT REFERENCES milestones(ref), version INTEGER NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, closedAt TEXT, createdBy TEXT NOT NULL
  );
  CREATE INDEX issues_project ON issues(project, status);
  CREATE INDEX issues_status ON issues(status);
  CREATE INDEX issues_milestone ON issues(milestone);
  CREATE INDEX issues_assignee ON issues(assignee);

  CREATE TABLE decisions (
    ref TEXT PRIMARY KEY, project TEXT REFERENCES projects(ref), kind TEXT NOT NULL, title TEXT NOT NULL,
    context TEXT NOT NULL, options TEXT NOT NULL, recommendation TEXT, status TEXT NOT NULL,
    priority TEXT NOT NULL, requestedBy TEXT NOT NULL, dueAt TEXT, chosenOption TEXT, resolutionNote TEXT,
    decidedBy TEXT, decidedAt TEXT, channel TEXT, sourceUrl TEXT, supersededBy TEXT,
    version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE INDEX decisions_status ON decisions(status);
  CREATE INDEX decisions_project ON decisions(project);

  CREATE TABLE prs (
    ref TEXT PRIMARY KEY, repo TEXT NOT NULL, number INTEGER NOT NULL, project TEXT REFERENCES projects(ref),
    title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, state TEXT NOT NULL, checks TEXT NOT NULL,
    review TEXT NOT NULL, mergeable TEXT NOT NULL, headRef TEXT NOT NULL, baseRef TEXT NOT NULL,
    headSha TEXT NOT NULL, author TEXT NOT NULL, additions INTEGER NOT NULL, deletions INTEGER NOT NULL,
    mergedAt TEXT, closedAt TEXT, version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
    syncedAt TEXT,
    UNIQUE (repo, number)
  );
  CREATE INDEX prs_state ON prs(state);
  CREATE INDEX prs_project ON prs(project);

  CREATE TABLE ideas (
    ref TEXT PRIMARY KEY, project TEXT REFERENCES projects(ref), title TEXT NOT NULL, body TEXT NOT NULL,
    status TEXT NOT NULL, horizon TEXT NOT NULL, labels TEXT NOT NULL, promotedTo TEXT,
    version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, createdBy TEXT NOT NULL
  );

  CREATE TABLE updates (
    ref TEXT PRIMARY KEY, target TEXT, project TEXT, level TEXT NOT NULL, body TEXT NOT NULL,
    actor TEXT NOT NULL, version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE INDEX updates_target ON updates(target);

  CREATE TABLE links (
    fromRef TEXT NOT NULL, rel TEXT NOT NULL, toRef TEXT NOT NULL,
    createdAt TEXT NOT NULL, createdBy TEXT NOT NULL,
    PRIMARY KEY (fromRef, rel, toRef)
  );
  CREATE INDEX links_to ON links(toRef, rel);

  CREATE TABLE events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT NOT NULL, type TEXT NOT NULL,
    kind TEXT NOT NULL, ref TEXT NOT NULL, project TEXT, summary TEXT NOT NULL, related TEXT NOT NULL,
    attrs TEXT NOT NULL, changes TEXT NOT NULL
  );
  CREATE INDEX events_ref ON events(ref, seq);

  CREATE TABLE drifts (
    ref TEXT PRIMARY KEY, rule TEXT NOT NULL, dedupeKey TEXT NOT NULL, fingerprint TEXT NOT NULL,
    edge INTEGER NOT NULL, target TEXT NOT NULL, cause TEXT, viaLink INTEGER NOT NULL, project TEXT,
    message TEXT NOT NULL, suggestion TEXT NOT NULL, status TEXT NOT NULL, assignee TEXT,
    resolvedBy TEXT, resolvedAt TEXT, note TEXT,
    version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, position INTEGER NOT NULL
  );
  CREATE INDEX drifts_status ON drifts(status);
  CREATE INDEX drifts_key ON drifts(dedupeKey, position);
  CREATE INDEX drifts_target ON drifts(target, status);

  CREATE TABLE link_tombstones (
    fromRef TEXT NOT NULL, rel TEXT NOT NULL, toRef TEXT NOT NULL,
    PRIMARY KEY (fromRef, rel, toRef)
  );

  CREATE TABLE github_sync (
    repo TEXT PRIMARY KEY, lastOkAt TEXT, error TEXT, updatedAt TEXT NOT NULL
  );

  CREATE TABLE views (
    name TEXT PRIMARY KEY, query TEXT NOT NULL, position INTEGER NOT NULL, builtin INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE agents (
    name TEXT PRIMARY KEY, note TEXT, firstSeenAt TEXT NOT NULL, lastSeenAt TEXT NOT NULL
  );

  CREATE TABLE watches (
    ref TEXT PRIMARY KEY, name TEXT, agent TEXT NOT NULL, spec TEXT NOT NULL, cursor INTEGER NOT NULL,
    follow INTEGER NOT NULL, ephemeral INTEGER NOT NULL, status TEXT NOT NULL, refs TEXT NOT NULL,
    createdAt TEXT NOT NULL, lastSeenAt TEXT NOT NULL, firedAt TEXT, result TEXT
  );
  CREATE UNIQUE INDEX watches_name ON watches(agent, name) WHERE name IS NOT NULL AND status = 'active';
  CREATE INDEX watches_status ON watches(status);
  `,
  `
  ALTER TABLE drifts ADD COLUMN claimedBy TEXT;
  ALTER TABLE drifts ADD COLUMN baselineAt TEXT NOT NULL DEFAULT '';
  UPDATE drifts SET baselineAt = createdAt;
  `,
  `
  ALTER TABLE decisions ADD COLUMN postponedAt TEXT;
  `,
  `
  ALTER TABLE decisions ADD COLUMN wakeAddress TEXT;
  ALTER TABLE decisions ADD COLUMN wokenAt TEXT;
  ALTER TABLE decisions ADD COLUMN wakeError TEXT;
  ALTER TABLE decisions ADD COLUMN pickedUpAt TEXT;
  ALTER TABLE decisions ADD COLUMN pickedUpBy TEXT;
  ALTER TABLE decisions ADD COLUMN reportStatus TEXT;
  ALTER TABLE decisions ADD COLUMN reportNote TEXT;
  ALTER TABLE decisions ADD COLUMN reportedAt TEXT;
  UPDATE decisions SET pickedUpAt = decidedAt, pickedUpBy = requestedBy WHERE status = 'decided';
  `,
  `
  CREATE TABLE lines (
    ref TEXT PRIMARY KEY, title TEXT NOT NULL, doneWhen TEXT NOT NULL, state TEXT NOT NULL, rank REAL NOT NULL,
    headline TEXT, summary TEXT, summaryAt TEXT, tabledReason TEXT, lookAgainAt TEXT,
    proposedBy TEXT, recommendation TEXT, recommendationWhy TEXT, source TEXT NOT NULL, fromRef TEXT,
    version INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, createdBy TEXT NOT NULL
  );
  CREATE INDEX lines_state ON lines(state, rank);

  CREATE TABLE line_repos (
    line TEXT NOT NULL REFERENCES lines(ref), repo TEXT NOT NULL REFERENCES projects(ref), position INTEGER NOT NULL,
    PRIMARY KEY (line, repo)
  );
  CREATE INDEX line_repos_repo ON line_repos(repo);

  CREATE TABLE plan_steps (
    line TEXT NOT NULL REFERENCES lines(ref), position INTEGER NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
    PRIMARY KEY (line, position)
  );

  ALTER TABLE issues ADD COLUMN line TEXT REFERENCES lines(ref);
  ALTER TABLE issues ADD COLUMN step INTEGER;
  CREATE INDEX issues_line ON issues(line);
  ALTER TABLE decisions ADD COLUMN line TEXT REFERENCES lines(ref);
  ALTER TABLE events ADD COLUMN line TEXT;
  `,
  proposalsFromBefore,
  `
  ALTER TABLE agents ADD COLUMN checkout TEXT;
  ALTER TABLE agents ADD COLUMN repo TEXT;
  ALTER TABLE agents ADD COLUMN wakeAddress TEXT;
  ALTER TABLE agents ADD COLUMN startedBy TEXT;
  ALTER TABLE agents ADD COLUMN stoppedAt TEXT;
  ALTER TABLE agents ADD COLUMN stoppedReason TEXT;
  ALTER TABLE agents ADD COLUMN goneAt TEXT;
  CREATE INDEX agents_checkout ON agents(checkout);

  CREATE TABLE line_claims (
    agent TEXT PRIMARY KEY REFERENCES agents(name), line TEXT NOT NULL REFERENCES lines(ref),
    role TEXT NOT NULL, since TEXT NOT NULL
  );
  CREATE INDEX line_claims_line ON line_claims(line);
  CREATE UNIQUE INDEX line_claims_one_owner ON line_claims(line) WHERE role = 'owner';
  CREATE UNIQUE INDEX line_claims_one_scoper ON line_claims(line) WHERE role = 'scoper';

  CREATE TABLE notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT NOT NULL, kind TEXT NOT NULL, line TEXT, body TEXT NOT NULL,
    wakes INTEGER NOT NULL, createdAt TEXT NOT NULL, deliveredAt TEXT
  );
  CREATE INDEX notices_undelivered ON notices(agent, deliveredAt);

  CREATE TABLE owner_searches (
    line TEXT PRIMARY KEY REFERENCES lines(ref), since TEXT NOT NULL, firstOffer TEXT, firstUntil TEXT
  );

  ALTER TABLE lines ADD COLUMN scopedAt TEXT;
  ALTER TABLE lines ADD COLUMN windDownUntil TEXT;
  ALTER TABLE lines ADD COLUMN windDownWrites INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE lines ADD COLUMN lastOwner TEXT;
  ALTER TABLE lines ADD COLUMN lastOwnerEnded TEXT;
  `,
  `
  ALTER TABLE decisions ADD COLUMN issue TEXT;
  ALTER TABLE decisions ADD COLUMN recommendationWhy TEXT;
  ALTER TABLE decisions ADD COLUMN urgentReason TEXT;
  ALTER TABLE decisions ADD COLUMN notUrgentAt TEXT;
  CREATE INDEX decisions_line ON decisions(line);

  CREATE TABLE line_inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT, line TEXT NOT NULL REFERENCES lines(ref), kind TEXT NOT NULL, ref TEXT,
    issue TEXT, body TEXT NOT NULL, createdAt TEXT NOT NULL, deliveredTo TEXT, deliveredAt TEXT
  );
  CREATE INDEX line_inbox_pending ON line_inbox(line, deliveredAt);

  ALTER TABLE agents ADD COLUMN wokenAt TEXT;
  ALTER TABLE agents ADD COLUMN wakeError TEXT;
  `,
  `
  ALTER TABLE issues ADD COLUMN place TEXT;
  ALTER TABLE issues ADD COLUMN outcome TEXT;
  ALTER TABLE issues ADD COLUMN result TEXT;
  ALTER TABLE issues ADD COLUMN confirmedAt TEXT;
  ALTER TABLE decisions ADD COLUMN confirmedAt TEXT;
  ALTER TABLE lines ADD COLUMN ownedBy TEXT;
  ALTER TABLE lines ADD COLUMN doneWhenProposal TEXT;
  ALTER TABLE lines ADD COLUMN doneWhenProposedBy TEXT;
  ALTER TABLE lines ADD COLUMN doneProposal TEXT;
  ALTER TABLE lines ADD COLUMN doneProposedBy TEXT;
  CREATE TABLE places (name TEXT PRIMARY KEY, position INTEGER NOT NULL);
  `,
  `
  CREATE TABLE pending_choices (
    id INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL, input TEXT NOT NULL, actor TEXT NOT NULL,
    channel TEXT NOT NULL, said TEXT, summary TEXT NOT NULL, dueAt TEXT NOT NULL, state TEXT NOT NULL, error TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX pending_choices_due ON pending_choices(state, dueAt);
  CREATE TABLE drafts (key TEXT PRIMARY KEY, text TEXT NOT NULL, updatedAt TEXT NOT NULL);
  `,
];

const UserVersion = z.object({ user_version: z.number().int() });

/** The version a fully migrated database is at. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Brings the database up to `target` (the latest by default), one version per transaction, so a failing step leaves
 * it at the version before. Stopping early lets a test build the database exactly as an older release left it.
 */
export function migrate(
  driver: SqlDriver,
  target = SCHEMA_VERSION,
  migrations: readonly Migration[] = MIGRATIONS,
): void {
  const [row] = driver.all("PRAGMA user_version");
  const current = UserVersion.parse(row).user_version;
  migrations.forEach((step, index) => {
    const version = index + 1;
    if (version <= current || version > target) return;
    driver.transaction(() => {
      if (typeof step === "string") driver.exec(step);
      else step(driver);
      driver.exec(`PRAGMA user_version = ${version}`);
    });
  });
}
