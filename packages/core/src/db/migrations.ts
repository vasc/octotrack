import { z } from "zod";
import type { SqlDriver } from "./driver.ts";

const MIGRATIONS: readonly string[] = [
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
];

const UserVersion = z.object({ user_version: z.number().int() });

export function migrate(driver: SqlDriver): void {
  const [row] = driver.all("PRAGMA user_version");
  const current = UserVersion.parse(row).user_version;
  MIGRATIONS.forEach((sql, index) => {
    const version = index + 1;
    if (version <= current) return;
    driver.transaction(() => {
      driver.exec(sql);
      driver.exec(`PRAGMA user_version = ${version}`);
    });
  });
}
