import { beforeEach, describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { parseQuery, QUERY_VALUES } from "../src/query/index.ts";
import {
  DecisionKind,
  DecisionStatus,
  Horizon,
  IdeaStatus,
  IssueStatus,
  MilestoneStatus,
  PrChecks,
  PrReview,
  PrState,
  Priority,
  ProjectStatus,
  UpdateLevel,
  DriftStatus,
  EntityKind,
  Channel,
} from "../src/schemas.ts";
import { type Harness, harness } from "./helpers.ts";

let h: Harness;

beforeEach(() => {
  h = harness();
  h.call(c.projectCreate, { key: "OCT", name: "Octotrack" });
});

function openRules(): string[] {
  return h.call(c.driftList, {}).map((drift) => drift.rule);
}

describe("a typo in a query is an error, never a false result", () => {
  test.each([
    "status:opne",
    "kind:decison",
    "priority:huge",
    "checks:red",
    "ready:maybe",
    "-status:opne",
    "since:soon",
  ])("%s is refused", (query) => {
    expect(() => parseQuery(query)).toThrow();
  });

  test.each([
    "status:open",
    "status:op*",
    "kind:dec*",
    "priority:none",
    "status:in_progress",
    "since:2h",
    "to:anything",
  ])("%s is fine", (query) => {
    expect(() => parseQuery(query)).not.toThrow();
  });

  test("the lists of known values cannot fall behind the schemas", () => {
    const statuses = [
      ...ProjectStatus.options,
      ...IssueStatus.options,
      ...DecisionStatus.options,
      ...PrState.options,
      ...IdeaStatus.options,
      ...MilestoneStatus.options,
      ...DriftStatus.options,
      ...UpdateLevel.options,
    ];
    expect([...new Set(QUERY_VALUES.status)].sort()).toEqual([...new Set(statuses)].sort());
    expect([...(QUERY_VALUES.kind ?? [])].sort()).toEqual([...EntityKind.options].sort());
    expect([...(QUERY_VALUES.priority ?? [])].sort()).toEqual([...Priority.options].sort());
    expect([...(QUERY_VALUES.type ?? [])].sort()).toEqual([...DecisionKind.options].sort());
    expect([...(QUERY_VALUES.channel ?? [])].sort()).toEqual([...Channel.options].sort());
    expect([...(QUERY_VALUES.checks ?? [])].sort()).toEqual([...PrChecks.options].sort());
    expect([...(QUERY_VALUES.review ?? [])].sort()).toEqual([...PrReview.options].sort());
    expect([...(QUERY_VALUES.state ?? [])].sort()).toEqual([...PrState.options].sort());
    expect([...(QUERY_VALUES.level ?? [])].sort()).toEqual([...UpdateLevel.options].sort());
    expect([...(QUERY_VALUES.horizon ?? [])].sort()).toEqual([...Horizon.options].sort());
  });

  test("a watch on a project that does not exist is refused instead of firing at once", () => {
    expect(() =>
      h.call(c.watchCreate, {
        spec: {
          require: "any",
          clauses: [{ type: "state", query: "project:NOPE status:open", mode: "none" }],
        },
      }),
    ).toThrow("NOPE");
  });

  test("a kind glob finds the same things in find as in the feed", () => {
    h.call(c.decisionAsk, { title: "Q" });
    expect(h.call(c.entityFind, { query: "kind:dec*" }).map((item) => item.ref)).toEqual(["D-1"]);
  });

  test("words that only look like refs still work as text", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Handle UTF-8 names" });
    expect(h.call(c.entityFind, { query: "UTF-8" }).map((item) => item.ref)).toEqual([issue.ref]);
    expect(() =>
      h.call(c.watchCreate, {
        spec: { require: "any", clauses: [{ type: "event", query: "UTF-8", count: 1 }] },
      }),
    ).not.toThrow();
    expect(() =>
      h.call(c.watchCreate, {
        spec: { require: "any", clauses: [{ type: "event", query: "ref:UTF-8", count: 1 }] },
      }),
    ).toThrow("UTF-8");
  });

  test("a URL is text, and text with a colon gets a helpful message", () => {
    expect(() => parseQuery("http://example.com/a")).not.toThrow();
    expect(() => parseQuery("note: fix")).toThrow("quotes");
  });
});

describe("watches find a PR by its GitHub name", () => {
  test("in both state and event clauses", () => {
    h.call(c.prUpsert, { repo: "Acme/App", number: 7, title: "x", state: "open" });
    const state = h.call(c.watchCreate, {
      spec: {
        require: "any",
        clauses: [{ type: "state", query: "ref:Acme/App#7 state:merged", mode: "exists" }],
      },
    });
    const event = h.call(c.watchCreate, {
      spec: { require: "any", clauses: [{ type: "event", query: "ref:Acme/App#7 to:merged", count: 1 }] },
    });
    expect(state.refs).toEqual(["PR-1"]);
    h.call(c.prUpsert, { repo: "Acme/App", number: 7, title: "x", state: "merged" });
    const [stateResult, eventResult] = h.call(c.watchCheck, { refs: [state.ref, event.ref] });
    expect(stateResult?.fired).toBe(true);
    expect(eventResult?.fired).toBe(true);
  });

  test("to:merged matches a PR first seen once it had merged", () => {
    const watch = h.call(c.watchCreate, {
      spec: { require: "any", clauses: [{ type: "event", query: "kind:pr to:merged", count: 1 }] },
    });
    h.call(c.prUpsert, { repo: "a/b", number: 1, title: "x", state: "merged" });
    expect(h.call(c.watchCheck, { refs: [watch.ref] })[0]?.fired).toBe(true);
  });
});

describe("watches lose nothing in a large burst", () => {
  function burst(size: number): void {
    h.tracker.batch(
      {
        ops: Array.from({ length: size }, (_, index) => ({
          op: "issue.create",
          input: { project: "OCT", title: `Issue ${index}` },
        })),
      },
      h.as,
    );
  }

  test("a follower gets every event across several responses", () => {
    const watch = h.call(c.watchCreate, {
      follow: true,
      spec: { require: "any", clauses: [{ type: "event", query: "event:issue.created", count: 1 }] },
    });
    burst(250);
    const seen: number[] = [];
    for (let round = 0; round < 5; round += 1) {
      const [result] = h.call(c.watchCheck, { refs: [watch.ref] });
      seen.push(...(result?.clauses[0]?.events.map((event) => event.seq) ?? []));
    }
    expect(seen).toHaveLength(250);
    expect(new Set(seen).size).toBe(250);
  });

  test("a count above one response's size can still be reached", () => {
    const watch = h.call(c.watchCreate, {
      spec: { require: "any", clauses: [{ type: "event", query: "event:issue.created", count: 201 }] },
    });
    burst(250);
    expect(h.call(c.watchCheck, { refs: [watch.ref] })[0]?.fired).toBe(true);
  });
});

describe("drift has to be earned", () => {
  function closedIssueOpenPr() {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const pr = h.call(c.prUpsert, {
      repo: "a/b",
      number: 1,
      title: "PR",
      state: "open",
      issues: [issue.ref],
    });
    h.call(c.issueUpdate, { refs: [issue.ref], status: "done" });
    return pr;
  }

  test("--updated is refused on drift about state while the state is still wrong", () => {
    const pr = closedIssueOpenPr();
    h.call(c.updatePost, { body: "Nothing really", target: pr.ref });
    const [drift] = h.call(c.driftList, { query: "rule:issue-closed-pr-open" });
    expect(() =>
      h.call(c.driftAck, { refs: [drift?.ref ?? ""], mode: "updated", note: "Merged it" }),
    ).toThrow("still true");
    expect(openRules()).toContain("issue-closed-pr-open");
  });

  test("changing a label does not count as updating", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const decision = h.call(c.decisionAsk, { title: "Q", affects: [issue.ref] });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    h.call(c.issueUpdate, { refs: [issue.ref], addLabels: ["x"] });
    expect(() => h.call(c.driftAck, { target: issue.ref, mode: "updated", note: "Done" })).toThrow(
      "has not changed",
    );
    h.call(c.issueUpdate, { refs: [issue.ref], body: "Now reflects it" });
    expect(
      h.call(c.driftAck, { target: issue.ref, mode: "updated", note: "Done" }).acknowledged,
    ).toHaveLength(1);
  });

  test("an update made together with the decision, in one batch, still counts", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const decision = h.call(c.decisionAsk, { title: "Q", affects: [issue.ref] });
    h.tracker.batch(
      {
        ops: [
          { op: "issue.update", input: { refs: [issue.ref], body: "Reflects it" } },
          { op: "decision.resolve", input: { ref: decision.ref, note: "Yes" } },
        ],
      },
      h.as,
    );
    expect(
      h.call(c.driftAck, { target: issue.ref, mode: "updated", note: "Done" }).acknowledged,
    ).toHaveLength(1);
  });

  test("a blank note is no note", () => {
    closedIssueOpenPr();
    expect(() => h.call(c.driftAck, { target: "PR-1", mode: "verified", note: "   " })).toThrow();
  });

  test("the suggestion names the one drift, so that following it cannot clear others by accident", () => {
    closedIssueOpenPr();
    const [drift] = h.call(c.driftList, { query: "rule:issue-closed-pr-open" });
    expect(drift?.suggestion).toContain(`octo drift ack ${drift?.ref} --verified`);
    expect(drift?.suggestion).not.toContain("--target");
  });

  test("open drift follows an outcome that changes again", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const decision = h.call(c.decisionAsk, {
      title: "Q",
      affects: [issue.ref],
      options: [
        { key: "a", label: "Option A" },
        { key: "b", label: "Option B" },
      ],
    });
    h.call(c.decisionResolve, { ref: decision.ref, option: "a" });
    h.call(c.decisionResolve, { ref: decision.ref, option: "b", force: true });
    const [drift] = h.call(c.driftList, { query: "rule:decision-outcome" });
    expect(drift?.message).toContain("Option B");
    expect(drift?.message).not.toContain("Option A");
  });

  test("reporting progress counts as activity", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing", status: "in_progress" });
    h.setNow("2026-11-09T11:00:00.000Z");
    h.call(c.updatePost, { body: "Still on it", target: issue.ref });
    h.setNow("2026-11-10T12:00:00.000Z");
    h.tracker.sweep();
    expect(openRules()).not.toContain("stale-in-progress");

    h.setNow("2026-11-12T12:00:00.000Z");
    h.tracker.sweep();
    expect(openRules()).toContain("stale-in-progress");

    h.call(c.updatePost, { body: "Back on it", target: issue.ref });
    expect(openRules()).not.toContain("stale-in-progress");
  });

  test("a milestone due today is not overdue yet", () => {
    h.call(c.milestoneCreate, { project: "OCT", title: "Today", targetDate: "2026-11-07" });
    expect(openRules()).not.toContain("milestone-overdue");
    h.setNow("2026-11-08T00:00:01.000Z");
    h.tracker.sweep();
    expect(openRules()).toContain("milestone-overdue");
  });

  test("agents can take drift so that others leave it alone", () => {
    closedIssueOpenPr();
    const [drift] = h.call(c.driftList, { query: "rule:issue-closed-pr-open" });
    const ref = drift?.ref ?? "";
    h.call(c.driftClaim, { refs: [ref] }, "agent-a");
    expect(() => h.call(c.driftClaim, { refs: [ref] }, "agent-b")).toThrow("belongs to agent-a");
    expect(h.call(c.next, {}, "agent-b").drift.map((item) => item.ref)).not.toContain(ref);
    expect(h.call(c.next, {}, "agent-a").drift.map((item) => item.ref)).toContain(ref);
    expect(h.call(c.driftClaim, { refs: [ref], force: true }, "agent-b")[0]?.assignee).toBe("agent-b");
  });
});

describe("input that could never be right is refused", () => {
  test.each([
    ["a blank title", () => h.call(c.issueCreate, { project: "OCT", title: "   " })],
    ["a nonsense due date", () => h.call(c.decisionAsk, { title: "Q", dueAt: "banana" })],
    [
      "a nonsense decision date",
      () => h.call(c.decisionRecord, { title: "Q", chosen: "x", decidedAt: "nope" }),
    ],
    [
      "a nonsense target date",
      () => h.call(c.milestoneCreate, { project: "OCT", title: "M", targetDate: "soon" }),
    ],
  ])("%s", (_label, action) => {
    expect(action).toThrow();
  });
});

describe("views", () => {
  test("a bad query cannot be saved", () => {
    expect(() => h.call(c.viewSave, { name: "Mine", query: "nope:1" })).toThrow();
  });

  test("builtin views cannot be removed or overwritten, so the dashboard cannot be broken by accident", () => {
    expect(() => h.call(c.viewRemove, { name: "Feed" })).toThrow("built in");
    expect(() => h.call(c.viewRemove, { name: "feed" })).toThrow("built in");
    expect(() => h.call(c.viewSave, { name: "Feed", query: "kind:pr" })).toThrow("built in");
    expect(h.call(c.dashboardBootstrap, {}).views[0]?.name).toBe("Feed");
  });
});

describe("pull requests and links", () => {
  test("a removed link stays removed even though the text still mentions the issue", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const base = { repo: "a/b", number: 1, title: `See ${issue.ref}`, state: "open" as const };
    const pr = h.call(c.prUpsert, base);
    h.call(c.linkRemove, { from: pr.ref, rel: "implements", to: issue.ref });
    h.call(c.prUpsert, { ...base, title: `Still see ${issue.ref}` });
    expect(h.call(c.linkList, { ref: pr.ref })).toEqual([]);

    h.call(c.linkAdd, { from: pr.ref, rel: "implements", to: issue.ref });
    expect(h.call(c.linkList, { ref: pr.ref })).toHaveLength(1);
  });

  test("several projects can share a repo, and a mentioned issue decides where a PR belongs", () => {
    h.call(c.projectCreate, { key: "AAA", name: "First", repo: "mono/repo" });
    h.call(c.projectCreate, { key: "BBB", name: "Second", repo: "mono/repo" });
    const issue = h.call(c.issueCreate, { project: "BBB", title: "Thing" });
    expect(
      h.call(c.prUpsert, { repo: "mono/repo", number: 1, title: `${issue.ref}: x`, state: "open" }).project,
    ).toBe("BBB");
    expect(
      h.call(c.prUpsert, { repo: "mono/repo", number: 2, title: "Unrelated", state: "open" }).project,
    ).toBe("AAA");
  });

  test("sync failures are visible until the repo syncs again", () => {
    h.call(c.prSync, { prs: [], failures: [{ repo: "a/b", error: "Boom" }] });
    expect(h.call(c.dashboardBootstrap, {}).syncFailures).toMatchObject([{ repo: "a/b", error: "Boom" }]);
    h.call(c.prSync, { prs: [], repos: ["a/b"] });
    expect(h.call(c.dashboardBootstrap, {}).syncFailures).toEqual([]);
  });
});

describe("next can focus on one project", () => {
  test("drift, ready issues and claims all follow it", () => {
    h.call(c.projectCreate, { key: "API", name: "API" });
    h.call(c.issueCreate, { project: "OCT", title: "Here" });
    h.call(c.issueCreate, { project: "API", title: "There" });
    h.call(c.issueCreate, { project: "API", title: "Claimed", assignee: "agent-a", status: "in_progress" });
    const decision = h.call(c.decisionAsk, { title: "Q", project: "API" });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });

    const next = h.call(c.next, { project: "OCT" });
    expect(next.ready.map((card) => card.issue.title)).toEqual(["Here"]);
    expect(next.claimed).toEqual([]);
    expect(next.drift).toEqual([]);
    expect(next.resolvedDecisions).toEqual([]);
    expect(h.call(c.next, { project: "API" }).drift.map((item) => item.rule)).toEqual([
      "decision-project-sync",
    ]);
  });
});

describe("the feed past the scan limit", () => {
  test("a rare filter comes back empty with a cursor, not with a false end", () => {
    h.tracker.batch(
      {
        ops: Array.from({ length: 5100 }, (_, index) => ({
          op: "update.post",
          input: { body: `Noise ${index}`, project: "OCT" },
        })),
      },
      h.as,
    );
    const first = h.call(c.feedList, { query: "event:project.created" });
    expect(first.events).toEqual([]);
    expect(first.nextBefore).not.toBeNull();
    const second = h.call(c.feedList, { query: "event:project.created", before: first.nextBefore ?? 0 });
    expect(second.events.map((event) => event.ref)).toEqual(["OCT"]);
    expect(second.nextBefore).toBeNull();
  });
});
