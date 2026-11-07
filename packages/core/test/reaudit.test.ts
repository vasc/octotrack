import { beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { contracts as c } from "../src/contracts.ts";
import { parseQuery, QUERY_VALUES } from "../src/query/index.ts";
import type { WatchSpec } from "../src/schemas.ts";
import { type Harness, harness } from "./helpers.ts";

let h: Harness;

function state(query: string, mode: "exists" | "none" = "exists"): WatchSpec {
  return { require: "any", clauses: [{ type: "state", query, mode }] };
}

function event(query: string): WatchSpec {
  return { require: "any", clauses: [{ type: "event", query, count: 1 }] };
}

function firedNow(spec: WatchSpec): boolean {
  const watch = h.call(c.watchCreate, { spec });
  return h.call(c.watchCheck, { refs: [watch.ref] })[0]?.fired === true;
}

beforeEach(() => {
  h = harness();
  h.call(c.projectCreate, { key: "OCT", name: "Octotrack" });
});

describe("a bare ref means that item, not any text mentioning it", () => {
  test("a state watch is not fooled by another item's title", () => {
    h.call(c.issueCreate, { project: "OCT", title: "The real one" });
    h.call(c.issueCreate, { project: "OCT", title: "mentions OCT-1", status: "done" });
    expect(firedNow(state("OCT-1 status:done"))).toBe(false);
  });

  test("until-none is not held up by another item's title", () => {
    const first = h.call(c.decisionAsk, { title: "First" });
    h.call(c.decisionAsk, { title: `Follows ${first.ref}` });
    h.call(c.decisionResolve, { ref: first.ref, note: "Yes" });
    expect(firedNow(state(`${first.ref} status:open`, "none"))).toBe(true);
  });

  test("OCT-1 does not match OCT-12", () => {
    for (let index = 0; index < 12; index += 1)
      h.call(c.issueCreate, { project: "OCT", title: `Issue ${index}` });
    const watch = h.call(c.watchCreate, { spec: event("OCT-1 to:done") });
    h.call(c.issueUpdate, { refs: ["OCT-12"], status: "done" });
    expect(h.call(c.watchCheck, { refs: [watch.ref] })[0]?.fired).toBe(false);
    expect(h.call(c.feedList, { query: "OCT-1" }).events.every((item) => item.ref === "OCT-1")).toBe(true);
  });

  test("a word that names nothing is still text, matched as a whole word", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Handle UTF-8 names" });
    h.call(c.issueCreate, { project: "OCT", title: "Handle UTF-80 names" });
    expect(h.call(c.entityFind, { query: "UTF-8" }).map((item) => item.ref)).toEqual([issue.ref]);
  });

  test("a comma list of bare refs means those items", () => {
    const first = h.call(c.decisionAsk, { title: "One" });
    const second = h.call(c.decisionAsk, { title: "Two" });
    const watch = h.call(c.watchCreate, { spec: state(`${first.ref},${second.ref} status:open`, "none") });
    expect(watch.refs.sort()).toEqual([first.ref, second.ref].sort());
    expect(h.call(c.watchCheck, { refs: [watch.ref] })[0]?.fired).toBe(false);
  });
});

describe("until-none refuses anything that could only be a typo", () => {
  beforeEach(() => {
    h.call(c.issueCreate, { project: "OCT", title: "Thing", labels: ["real"], assignee: "agent-a" });
    h.call(c.prUpsert, { repo: "acme/app", number: 1, title: "PR", state: "open" });
  });

  test.each([
    ["D-99 status:open"],
    ["NOPE-1 status:open"],
    ["repo:acm/app state:open"],
    ["milestone:M-99 status:open"],
    ["linked:OCT-999 status:todo"],
    ["target:OCT-999 kind:drift"],
    ["assignee:clude status:todo"],
    ["label:nope status:todo"],
    ["project:NOP* status:open"],
    ["project:NOPE status:open"],
  ])("%s", (query) => {
    expect(() => h.call(c.watchCreate, { spec: state(query, "none") })).toThrow();
  });

  test("what really exists is fine, and so is a glob that matches something", () => {
    for (const query of [
      "repo:acme/app state:open",
      "assignee:agent-a status:done",
      "label:real status:done",
      "ref:OCT-* status:done",
    ]) {
      expect(() => h.call(c.watchCreate, { spec: state(query, "none") })).not.toThrow();
    }
  });

  test.each(["rule:issue-closed-pr-opn", "event:nope.*", "event:decision.resolvd"])(
    "%s is not a known value",
    (query) => {
      expect(() => parseQuery(query)).toThrow();
    },
  );

  test("the lists of rules and events cannot fall behind what the code emits", () => {
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else sources.push(readFileSync(path, "utf8"));
      }
    };
    walk(join(import.meta.dir, "../src"));
    const text = sources.join("\n");
    const events = [
      ...text.matchAll(/type: (?:[a-zA-Z.]+ \? )?"([a-z]+\.[a-z_]+)"/g),
      ...text.matchAll(/\? "([a-z]+\.[a-z_]+)"/g),
      ...text.matchAll(/: "([a-z]+\.[a-z_]+)",?$/gm),
    ]
      .flatMap((match) => match[1] ?? [])
      .filter((name) => /^(project|issue|decision|pr|idea|milestone|link|status|drift)\./.test(name));
    const rules = [...text.matchAll(/rule: "([a-z-]+)"/g)].flatMap((match) => match[1] ?? []);
    expect(events.length).toBeGreaterThan(20);
    expect(rules.length).toBeGreaterThan(10);
    expect([...new Set(events)].filter((name) => !QUERY_VALUES.event?.includes(name))).toEqual([]);
    expect([...new Set(rules)].filter((name) => !QUERY_VALUES.rule?.includes(name))).toEqual([]);
  });
});

describe("watches can still be written for what does not exist yet", () => {
  test("a glob over refs is allowed", () => {
    h.call(c.decisionAsk, { title: "Q" });
    expect(() => h.call(c.watchCreate, { spec: state("ref:D-* status:open", "none") })).not.toThrow();
  });

  test("an event about a project yet to be created is allowed", () => {
    expect(() => h.call(c.watchCreate, { spec: event("event:project.created project:NEW") })).not.toThrow();
  });
});

describe("drift has to be earned, continued", () => {
  function affected() {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const decision = h.call(c.decisionAsk, {
      title: "Q",
      affects: [issue.ref],
      options: [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
    });
    h.call(c.decisionResolve, { ref: decision.ref, option: "a" });
    return { issue, decision };
  }

  test("claiming an issue is not updating it", () => {
    const { issue } = affected();
    h.call(c.issueClaim, { refs: [issue.ref] });
    expect(() => h.call(c.driftAck, { target: issue.ref, mode: "updated", note: "Did it" })).toThrow(
      "has not changed",
    );
  });

  test("an update made for the old outcome does not count for the new one", () => {
    const { issue, decision } = affected();
    h.setNow("2026-11-07T12:01:00.000Z");
    h.call(c.issueUpdate, { refs: [issue.ref], body: "Reflects A" });
    h.setNow("2026-11-07T12:02:00.000Z");
    h.call(c.decisionResolve, { ref: decision.ref, option: "b", force: true });
    expect(() => h.call(c.driftAck, { target: issue.ref, mode: "updated", note: "Done" })).toThrow(
      "has not changed",
    );
    h.setNow("2026-11-07T12:03:00.000Z");
    h.call(c.issueUpdate, { refs: [issue.ref], body: "Reflects B" });
    expect(
      h.call(c.driftAck, { target: issue.ref, mode: "updated", note: "Done" }).acknowledged,
    ).toHaveLength(1);
  });

  test("every suggestion names the one drift, never the whole target", () => {
    const { decision } = affected();
    h.call(c.issueCreate, { project: "OCT", title: "Derived", derivedFrom: [decision.ref] });
    h.call(c.decisionResolve, { ref: decision.ref, option: "b", force: true });
    const drifts = h.call(c.driftList, {});
    expect(drifts.length).toBeGreaterThan(1);
    for (const drift of drifts) {
      expect(drift.suggestion).toContain(`octo drift ack ${drift.ref}`);
      expect(drift.suggestion).not.toContain("--target");
    }
  });

  test("a claim really protects: another agent cannot clear it without forcing", () => {
    const { issue } = affected();
    const [drift] = h.call(c.driftList, { query: `target:${issue.ref}` });
    const ref = drift?.ref ?? "";
    h.call(c.driftClaim, { refs: [ref] }, "agent-a");
    expect(() => h.call(c.driftAck, { refs: [ref], mode: "verified", note: "Mine now" }, "agent-b")).toThrow(
      "agent-a",
    );
    expect(() =>
      h.call(c.driftAck, { target: issue.ref, mode: "verified", note: "All of it" }, "agent-b"),
    ).toThrow("agent-a");
    expect(
      h.call(c.driftAck, { refs: [ref], mode: "verified", note: "Taking over", force: true }, "agent-b")
        .acknowledged,
    ).toHaveLength(1);
  });

  test("a suggested assignee is not a claim, and does not stop others", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing", assignee: "agent-a" });
    const decision = h.call(c.decisionAsk, { title: "Q", affects: [issue.ref] });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    expect(
      h.call(c.driftAck, { target: issue.ref, mode: "verified", note: "Fine" }, "agent-b").acknowledged,
    ).toHaveLength(1);
  });
});

describe("a follower never sees an event twice, or out of order", () => {
  test("across several responses, with clauses of different sizes", () => {
    const watch = h.call(c.watchCreate, {
      follow: true,
      spec: {
        require: "any",
        clauses: [
          { type: "event", query: "event:status.posted", count: 1 },
          { type: "event", query: "event:idea.*", count: 1 },
        ],
      },
    });
    h.tracker.batch(
      {
        ops: [
          ...Array.from({ length: 250 }, (_, index) => ({
            op: "update.post",
            input: { body: `Post ${index}` },
          })),
          ...Array.from({ length: 20 }, (_, index) => ({
            op: "idea.capture",
            input: { title: `Idea ${index}` },
          })),
        ],
      },
      h.as,
    );
    const seen: number[] = [];
    for (let round = 0; round < 6; round += 1) {
      const [result] = h.call(c.watchCheck, { refs: [watch.ref] });
      const events = result?.clauses.flatMap((clause) => clause.events.map((item) => item.seq)) ?? [];
      seen.push(...new Set(events));
    }
    expect(seen).toHaveLength(270);
    expect(new Set(seen).size).toBe(270);
  });
});

describe("what could never be right, continued", () => {
  test.each([
    [
      "issue title",
      () => {
        const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
        h.call(c.issueUpdate, { refs: [issue.ref], title: "   " });
      },
    ],
    ["project name", () => h.call(c.projectCreate, { key: "XX", name: "   " })],
    ["project rename", () => h.call(c.projectUpdate, { ref: "OCT", name: "   " })],
    [
      "decision title",
      () => {
        const decision = h.call(c.decisionAsk, { title: "Q" });
        h.call(c.decisionUpdate, { ref: decision.ref, title: "   " });
      },
    ],
    [
      "idea title",
      () => {
        const idea = h.call(c.ideaCapture, { title: "I" });
        h.call(c.ideaUpdate, { ref: idea.ref, title: "   " });
      },
    ],
    [
      "milestone title",
      () => {
        const milestone = h.call(c.milestoneCreate, { project: "OCT", title: "M" });
        h.call(c.milestoneUpdate, { ref: milestone.ref, title: "   " });
      },
    ],
    ["PR title", () => h.call(c.prUpsert, { repo: "a/b", number: 1, title: "   ", state: "open" })],
  ])("a blank %s", (_label, action) => {
    expect(action).toThrow();
  });

  test.each(["5", "2026-02-31", "March 3 2020", "12/25/2099", "banana"])("the date %s", (date) => {
    expect(() => h.call(c.milestoneCreate, { project: "OCT", title: "M", targetDate: date })).toThrow();
  });

  test.each(["2026-12-01", "2026-12-01T10:00:00.000Z", "2026-12-01T10:00:00+01:00"])(
    "the date %s is fine",
    (date) => {
      expect(h.call(c.milestoneCreate, { project: "OCT", title: "M", targetDate: date }).targetDate).toBe(
        date,
      );
    },
  );

  test.each(["since:5", "since:2026-02-31", "before:12/25/2099"])("the time in %s", (query) => {
    expect(() => parseQuery(query)).toThrow();
  });
});

describe("the query language, smaller things", () => {
  test("a lone dash before a closing parenthesis is text, so a saved view cannot break", () => {
    expect(() => parseQuery("(x -)")).not.toThrow();
    expect(() => h.call(c.feedList, { query: "x -" })).not.toThrow();
    h.call(c.viewSave, { name: "Dash", query: "-" });
    expect(() => h.call(c.feedList, { view: "Dash" })).not.toThrow();
  });

  test("linked: takes a PR's GitHub name", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    h.call(c.prUpsert, { repo: "Acme/App", number: 3, title: "x", state: "open", issues: [issue.ref] });
    expect(h.call(c.entityFind, { query: "linked:Acme/App#3" }).map((item) => item.ref)).toEqual([issue.ref]);
  });
});

describe("sync failures", () => {
  test("a failure for a repo no project uses any more is not shown forever", () => {
    h.call(c.projectUpdate, { ref: "OCT", repo: "acme/app" });
    h.call(c.prSync, { prs: [], failures: [{ repo: "acme/app", error: "Boom" }] });
    expect(h.call(c.dashboardBootstrap, {}).syncFailures).toHaveLength(1);
    h.call(c.projectUpdate, { ref: "OCT", repo: "acme/other" });
    expect(h.call(c.dashboardBootstrap, {}).syncFailures).toEqual([]);
  });

  test("a repo that synced, with a problem on one PR, still shows the problem", () => {
    h.call(c.projectUpdate, { ref: "OCT", repo: "acme/app" });
    h.call(c.prSync, {
      prs: [],
      repos: ["acme/app"],
      failures: [{ repo: "acme/app", error: "acme/app#11: not found" }],
    });
    expect(h.call(c.dashboardBootstrap, {}).syncFailures).toMatchObject([
      { error: "acme/app#11: not found" },
    ]);
  });
});
