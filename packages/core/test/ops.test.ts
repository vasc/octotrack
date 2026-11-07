import { beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { contracts as c } from "../src/contracts.ts";
import { parseDecisionLines } from "../src/decision-lines.ts";
import { OctoError } from "../src/errors.ts";
import { scoreDecision } from "../src/queue.ts";
import { type Harness, harness } from "./helpers.ts";

let h: Harness;

beforeEach(() => {
  h = harness();
  h.call(c.projectCreate, { key: "OCT", name: "Octotrack" });
});

describe("an own answer", () => {
  test("reads as the answer, not as a missing option", () => {
    const decision = h.call(c.decisionAsk, {
      title: "Which provider?",
      options: [{ key: "a", label: "A" }],
    });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Neither, use Mollie" });
    const summary = h.call(c.feedList, { query: "event:decision.resolved" }).events[0]?.summary ?? "";
    expect(summary).toContain('"Neither, use Mollie"');
    expect(summary).not.toContain("no listed option");
  });
});

describe("postponing a decision", () => {
  const ask = (title: string, priority: "urgent" | "low" = "low") =>
    h.call(c.decisionAsk, { title, priority });
  const order = () => h.call(c.decisionQueue, {}).map((card) => card.decision.title);

  test("sends it below everything still waiting, however important it is", () => {
    const urgent = ask("Urgent", "urgent");
    ask("Low");
    expect(order()).toEqual(["Urgent", "Low"]);
    const postponed = h.call(c.decisionPostpone, { ref: urgent.ref });
    expect(postponed.postponedAt).not.toBeNull();
    expect(postponed.status).toBe("open");
    expect(order()).toEqual(["Low", "Urgent"]);
  });

  test("the last one postponed goes to the very bottom", () => {
    const first = ask("First");
    const second = ask("Second");
    ask("Third");
    h.call(c.decisionPostpone, { ref: first.ref });
    h.setNow("2026-11-07T12:00:01.000Z");
    h.call(c.decisionPostpone, { ref: second.ref });
    expect(order()).toEqual(["Third", "First", "Second"]);
  });

  test("can be undone", () => {
    const urgent = ask("Urgent", "urgent");
    ask("Low");
    h.call(c.decisionPostpone, { ref: urgent.ref });
    const back = h.call(c.decisionPostpone, { ref: urgent.ref, undo: true });
    expect(back.postponedAt).toBeNull();
    expect(order()).toEqual(["Urgent", "Low"]);
  });

  test("shows in the feed, and opens no drift, since nothing was decided", () => {
    const decision = ask("Later");
    h.call(c.issueCreate, { project: "OCT", title: "Blocked" });
    h.call(c.linkAdd, { from: decision.ref, rel: "blocks", to: "OCT-1" });
    const drift = h.call(c.driftList, {}).length;
    h.call(c.decisionPostpone, { ref: decision.ref });
    expect(h.call(c.feedList, { query: "event:decision.postponed" }).events).toHaveLength(1);
    expect(h.call(c.driftList, {})).toHaveLength(drift);
  });

  test("answering clears it, so a reopened decision ranks normally again", () => {
    const decision = ask("Later");
    h.call(c.decisionPostpone, { ref: decision.ref });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Done" });
    expect(h.call(c.decisionReopen, { ref: decision.ref }).postponedAt).toBeNull();
  });

  test("only an open decision can be postponed", () => {
    const decision = ask("Done already");
    h.call(c.decisionResolve, { ref: decision.ref, note: "Done" });
    expect(() => h.call(c.decisionPostpone, { ref: decision.ref })).toThrow(OctoError);
  });
});

describe("projects and issues", () => {
  test("refs are per project and sequential", () => {
    h.call(c.projectCreate, { key: "API", name: "API" });
    expect(h.call(c.issueCreate, { project: "OCT", title: "a" }).ref).toBe("OCT-1");
    expect(h.call(c.issueCreate, { project: "oct", title: "b" }).ref).toBe("OCT-2");
    expect(h.call(c.issueCreate, { project: "API", title: "c" }).ref).toBe("API-1");
  });

  test.each(["D", "PR", "DR", "toolongkey", "9A"])("rejects project key %s", (key) => {
    expect(() => h.call(c.projectCreate, { key, name: "x" })).toThrow(OctoError);
  });

  test("bulk update changes every ref", () => {
    const refs = ["a", "b", "c"].map((title) => h.call(c.issueCreate, { project: "OCT", title }).ref);
    const updated = h.call(c.issueUpdate, { refs, priority: "high", addLabels: ["x"] });
    expect(updated.map((issue) => issue.priority)).toEqual(["high", "high", "high"]);
    expect(updated[0]?.labels).toEqual(["x"]);
  });

  test("a stale ifVersion is refused so that agents do not clobber each other", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "a" });
    h.call(c.issueUpdate, { refs: [issue.ref], title: "b", ifVersion: issue.version });
    expect(() => h.call(c.issueUpdate, { refs: [issue.ref], title: "c", ifVersion: issue.version })).toThrow(
      "version",
    );
  });

  test("an update that changes nothing emits nothing", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "a" });
    const before = h.tracker.cursor();
    h.call(c.issueUpdate, { refs: [issue.ref], title: "a" });
    expect(h.tracker.cursor()).toBe(before);
  });

  test("claims conflict between agents, and force overrides", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "a" });
    expect(h.call(c.issueClaim, { refs: [issue.ref] })[0]).toMatchObject({
      assignee: "agent-a",
      status: "in_progress",
    });
    expect(() => h.call(c.issueClaim, { refs: [issue.ref] }, "agent-b")).toThrow("claimed by agent-a");
    expect(h.call(c.issueClaim, { refs: [issue.ref], force: true }, "agent-b")[0]?.assignee).toBe("agent-b");
    expect(() => h.call(c.issueRelease, { refs: [issue.ref] }, "agent-a")).toThrow("claimed by agent-b");
    expect(h.call(c.issueRelease, { refs: [issue.ref] }, "agent-b")[0]).toMatchObject({
      assignee: null,
      status: "todo",
    });
  });

  test("closedAt follows status in both directions", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "a" });
    expect(h.call(c.issueUpdate, { refs: [issue.ref], status: "done" })[0]?.closedAt).not.toBeNull();
    expect(h.call(c.issueUpdate, { refs: [issue.ref], status: "cancelled" })[0]?.closedAt).not.toBeNull();
    expect(h.call(c.issueUpdate, { refs: [issue.ref], status: "todo" })[0]?.closedAt).toBeNull();
  });

  test("blocking cycles are refused", () => {
    const a = h.call(c.issueCreate, { project: "OCT", title: "a" });
    const b = h.call(c.issueCreate, { project: "OCT", title: "b", blockedBy: [a.ref] });
    const d = h.call(c.issueCreate, { project: "OCT", title: "d", blockedBy: [b.ref] });
    expect(() => h.call(c.linkAdd, { from: d.ref, rel: "blocks", to: a.ref })).toThrow("cycle");
    expect(() => h.call(c.linkAdd, { from: a.ref, rel: "blocks", to: a.ref })).toThrow("itself");
  });

  test("the query language filters lists, including computed blocked and ready", () => {
    const decision = h.call(c.decisionAsk, { title: "Q" });
    const blocked = h.call(c.issueCreate, { project: "OCT", title: "waiting" });
    h.call(c.linkAdd, { from: decision.ref, rel: "blocks", to: blocked.ref });
    const ready = h.call(c.issueCreate, { project: "OCT", title: "free" });
    expect(h.call(c.issueList, { query: "ready:true" }).map((card) => card.issue.ref)).toEqual([ready.ref]);
    expect(h.call(c.issueList, { query: "blocked:true" }).map((card) => card.issue.ref)).toEqual([
      blocked.ref,
    ]);
    h.call(c.decisionResolve, { ref: decision.ref, note: "yes" });
    expect(h.call(c.issueList, { query: "blocked:true" })).toEqual([]);
    expect(h.call(c.entityFind, { query: `linked:${decision.ref}` }).map((item) => item.ref)).toEqual([
      blocked.ref,
    ]);
  });
});

describe("decisions", () => {
  const options = [
    { key: "a", label: "Option A" },
    { key: "b", label: "Option B" },
  ];

  test("resolving records who, how and when", () => {
    const decision = h.call(c.decisionAsk, { title: "Q", options, recommendation: "a" });
    const resolved = h.call(c.decisionResolve, { ref: decision.ref, option: "b", note: "cheaper" }, "vasco");
    expect(resolved).toMatchObject({
      status: "decided",
      chosenOption: "b",
      resolutionNote: "cheaper",
      decidedBy: "vasco",
      channel: "cli",
      requestedBy: "agent-a",
    });
  });

  test("bad options and empty answers are refused", () => {
    const decision = h.call(c.decisionAsk, { title: "Q", options });
    expect(() => h.call(c.decisionResolve, { ref: decision.ref, option: "z" })).toThrow('no option "z"');
    expect(() => h.call(c.decisionResolve, { ref: decision.ref })).toThrow("Say what was decided");
  });

  test("a decision without options takes the bare answer as its note", () => {
    const decision = h.call(c.decisionAsk, { title: "Ship it?" });
    expect(h.call(c.decisionResolve, { ref: decision.ref, option: "yes" })).toMatchObject({
      chosenOption: null,
      resolutionNote: "yes",
    });
  });

  test("a decided decision is protected, identical repeats are harmless", () => {
    const decision = h.call(c.decisionAsk, { title: "Q", options });
    h.call(c.decisionResolve, { ref: decision.ref, option: "a" });
    const before = h.tracker.cursor();
    h.call(c.decisionResolve, { ref: decision.ref, option: "a" });
    expect(h.tracker.cursor()).toBe(before);
    expect(() => h.call(c.decisionResolve, { ref: decision.ref, option: "b" })).toThrow("already decided");
  });

  test("out-of-band outcomes can be logged in bulk from lines, partial failures reported", () => {
    const first = h.call(c.decisionAsk, { title: "One", options });
    const second = h.call(c.decisionAsk, { title: "Two", options });
    const third = h.call(c.decisionAsk, { title: "Three", options });
    const { results } = h.call(c.decisionResolveBatch, {
      text: `# from the planning call
${first.ref} a Went with A
${second.ref} nope
${third.ref} - Neither, doing something else`,
    });
    expect(results.map((result) => result.ok)).toEqual([true, false, true]);
    expect(results[1]?.error).toContain('no option "nope"');
    expect(results[0]?.decision).toMatchObject({
      channel: "out_of_band",
      chosenOption: "a",
      resolutionNote: "Went with A",
    });
    expect(results[2]?.decision).toMatchObject({
      chosenOption: null,
      resolutionNote: "Neither, doing something else",
    });
    expect(h.call(c.decisionList, { query: "status:open" }).map((item) => item.ref)).toEqual([second.ref]);
  });

  test("a decision made elsewhere can be logged retroactively", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const decision = h.call(c.decisionRecord, {
      title: "Use SQLite",
      chosen: "SQLite for now",
      project: "OCT",
      kind: "architecture",
      decidedAt: "2026-11-01T09:00:00.000Z",
      sourceUrl: "https://example.com/notes",
      affects: [issue.ref],
    });
    expect(decision).toMatchObject({
      status: "decided",
      channel: "out_of_band",
      decidedAt: "2026-11-01T09:00:00.000Z",
      sourceUrl: "https://example.com/notes",
    });
    expect(
      h
        .call(c.driftList, {})
        .map((drift) => drift.target)
        .sort(),
    ).toEqual([issue.ref, "OCT"].sort());
  });

  test("supersede links both decisions and reopen clears the outcome", () => {
    const old = h.call(c.decisionAsk, { title: "Old", options });
    const replacement = h.call(c.decisionAsk, { title: "New", options });
    h.call(c.decisionResolve, { ref: old.ref, option: "a" });
    expect(h.call(c.decisionSupersede, { ref: old.ref, by: replacement.ref })).toMatchObject({
      status: "superseded",
      supersededBy: replacement.ref,
    });
    expect(h.call(c.decisionReopen, { ref: old.ref })).toMatchObject({
      status: "open",
      chosenOption: null,
      supersededBy: null,
    });
  });

  test("the queue ranks waiting agents, blocked work and priority, and explains itself", () => {
    expect(
      scoreDecision({ priority: "low", waiters: 2, blockedOpen: 0, ageHours: 0, overdue: false }).score,
    ).toBeGreaterThan(
      scoreDecision({ priority: "medium", waiters: 0, blockedOpen: 0, ageHours: 0, overdue: false }).score,
    );
    const low = h.call(c.decisionAsk, { title: "Low", priority: "low" });
    const urgent = h.call(c.decisionAsk, { title: "Urgent", priority: "urgent" });
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    h.call(c.linkAdd, { from: low.ref, rel: "blocks", to: issue.ref });
    const [top, bottom] = h.call(c.decisionQueue, {});
    expect(top?.decision.ref).toBe(urgent.ref);
    expect(top?.reasons).toContain("urgent priority");
    expect(bottom?.reasons).toContain("blocks 1 open item");
    expect(bottom?.blocks.map((item) => item.ref)).toEqual([issue.ref]);
  });

  test("line parsing rejects what it cannot read", () => {
    expect(parseDecisionLines("\n# note\nd-1 a hello world\n")).toEqual([
      { ref: "D-1", option: "a", note: "hello world" },
    ]);
    expect(() => parseDecisionLines("nonsense")).toThrow("Line 1");
  });
});

describe("batch", () => {
  test("atomic batches share results through aliases", () => {
    const result = h.tracker.batch(
      {
        ops: [
          { op: "issue.create", as: "first", input: { project: "OCT", title: "First" } },
          {
            op: "issue.create",
            as: "second",
            input: { project: "OCT", title: "Second", blockedBy: ["$first.ref"] },
          },
          { op: "decision.ask", input: { title: "Q", blocks: ["$first.ref", "$second.ref"] } },
        ],
      },
      h.as,
    );
    expect(result.ok).toBe(true);
    expect(
      h
        .call(c.linkList, { ref: "OCT-1" })
        .map((link) => `${link.fromRef}>${link.toRef}`)
        .sort(),
    ).toEqual(["D-1>OCT-1", "OCT-1>OCT-2"]);
  });

  test("a failure rolls back the whole batch", () => {
    const before = h.tracker.cursor();
    const result = h.tracker.batch(
      {
        ops: [
          { op: "issue.create", input: { project: "OCT", title: "Lost" } },
          { op: "issue.create", input: { project: "NOPE", title: "Fails" } },
        ],
      },
      h.as,
    );
    expect(result.ok).toBe(false);
    expect(result.results.map((item) => item.error?.code)).toEqual(["rolled_back", "not_found"]);
    expect(h.tracker.cursor()).toBe(before);
    expect(h.call(c.issueList, {})).toEqual([]);
  });

  test("non atomic batches keep what succeeded", () => {
    const result = h.tracker.batch(
      {
        atomic: false,
        ops: [
          { op: "issue.create", input: { project: "OCT", title: "Kept" } },
          { op: "nope.nope", input: {} },
          { op: "issue.create", input: { project: "OCT", title: "Also kept" } },
        ],
      },
      h.as,
    );
    expect(result.results.map((item) => item.ok)).toEqual([true, false, true]);
    expect(h.call(c.issueList, {})).toHaveLength(2);
  });

  test("drift from a batch is reported once, at the end", () => {
    const decision = h.call(c.decisionAsk, { title: "Q", project: "OCT" });
    const result = h.tracker.batch(
      { ops: [{ op: "decision.resolve", input: { ref: decision.ref, note: "yes" } }] },
      h.as,
    );
    expect(result.driftOpened.map((drift) => drift.rule)).toEqual(["decision-project-sync"]);
  });
});

describe("feed", () => {
  test("is newest first, filterable and paginates", () => {
    for (const title of ["one", "two", "three", "four"]) h.call(c.issueCreate, { project: "OCT", title });
    h.call(c.updatePost, { body: "Half way there", project: "OCT", level: "progress" });

    const page = h.call(c.feedList, { query: "kind:issue", limit: 2 });
    expect(page.events.map((event) => event.summary)).toEqual([
      "OCT-4 created: four",
      "OCT-3 created: three",
    ]);
    expect(page.nextBefore).not.toBeNull();
    const older = h.call(c.feedList, { query: "kind:issue", limit: 2, before: page.nextBefore ?? 0 });
    expect(older.events.map((event) => event.ref)).toEqual(["OCT-2", "OCT-1"]);

    expect(h.call(c.feedList, { query: "level:progress" }).events[0]?.summary).toBe("Half way there");
    expect(h.call(c.feedList, { query: "project:API" }).events).toEqual([]);
  });

  test("events keep the attributes they had at the time", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "a" });
    h.call(c.issueUpdate, { refs: [issue.ref], status: "in_progress" });
    h.call(c.issueUpdate, { refs: [issue.ref], status: "done" });
    const events = h.call(c.feedList, { query: `${issue.ref} changed:status to:in_progress` }).events;
    expect(events).toHaveLength(1);
    expect(events[0]?.attrs.status).toBe("in_progress");
    expect(h.call(c.feedList, { query: `from:in_progress to:done` }).events).toHaveLength(1);
  });

  test("saved views work as filters and builtin ones exist", () => {
    h.call(c.decisionAsk, { title: "Q", kind: "architecture" });
    h.call(c.issueCreate, { project: "OCT", title: "a" });
    expect(h.call(c.feedList, { view: "Architecture" }).events.map((event) => event.ref)).toEqual(["D-1"]);
    h.call(c.viewSave, { name: "Mine", query: "kind:issue" });
    expect(h.call(c.feedList, { view: "mine" }).events.map((event) => event.ref)).toEqual(["OCT-1"]);
    h.call(c.viewRemove, { name: "Mine" });
    expect(() => h.call(c.feedList, { view: "Mine" })).toThrow("No saved view");
  });
});

describe("ideas and roadmap", () => {
  test("ideas promote to issues and milestones, keeping the trail", () => {
    const idea = h.call(c.ideaCapture, { title: "Dark launch", project: "OCT", labels: ["growth"] });
    const { created, idea: promoted } = h.call(c.ideaPromote, { ref: idea.ref });
    expect(created).toBe("OCT-1");
    expect(promoted).toMatchObject({ status: "promoted", promotedTo: "OCT-1" });
    expect(h.call(c.linkList, { ref: created }).map((link) => link.rel)).toEqual(["promoted_to"]);
    expect(() => h.call(c.ideaPromote, { ref: idea.ref })).toThrow("already promoted");

    const big = h.call(c.ideaCapture, { title: "Big bet" });
    expect(() => h.call(c.ideaPromote, { ref: big.ref })).toThrow("no project");
    expect(h.call(c.ideaPromote, { ref: big.ref, project: "OCT", as: "milestone" }).created).toBe("M-1");
  });

  test("the roadmap places things by horizon, status and date, and renders markdown", () => {
    const active = h.call(c.milestoneCreate, {
      project: "OCT",
      title: "v1",
      status: "active",
      targetDate: "2026-12-01",
    });
    h.call(c.milestoneCreate, { project: "OCT", title: "v2", targetDate: "2026-11-20" });
    h.call(c.milestoneCreate, { project: "OCT", title: "v3", targetDate: "2028-01-01" });
    h.call(c.ideaCapture, { title: "Soon idea", horizon: "next", project: "OCT" });
    h.call(c.ideaCapture, { title: "Unplaced idea", project: "OCT" });
    const issue = h.call(c.issueCreate, { project: "OCT", title: "a", milestone: active.ref });
    h.call(c.issueCreate, { project: "OCT", title: "b", milestone: active.ref, status: "done" });
    const decision = h.call(c.decisionAsk, { title: "Q", blocks: [issue.ref] });

    const roadmap = h.call(c.roadmapGenerate, {});
    const titles = (lane: string) =>
      roadmap.lanes.find((item) => item.horizon === lane)?.items.map((item) => item.title);
    expect(titles("now")).toEqual(["v1"]);
    expect(titles("next")).toEqual(["v2", "Soon idea"]);
    expect(titles("later")).toEqual(["v3"]);
    const v1 = roadmap.lanes[0]?.items[0];
    expect(v1).toMatchObject({ done: 1, total: 2, openDecisions: [decision.ref] });
    expect(roadmap.markdown).toContain(
      `- **${active.ref}** v1 (1/2 done; target 2026-12-01; waiting on ${decision.ref})`,
    );
    expect(h.call(c.roadmapGenerate, { project: "OCT" }).project).toBe("OCT");
  });
});

describe("agents", () => {
  test("next tells an agent what to do", () => {
    const decision = h.call(c.decisionAsk, { title: "Q", project: "OCT" });
    const claimed = h.call(c.issueCreate, {
      project: "OCT",
      title: "mine",
      assignee: "agent-a",
      status: "in_progress",
    });
    const others = h.call(c.issueCreate, { project: "OCT", title: "theirs", assignee: "agent-b" });
    const urgent = h.call(c.issueCreate, { project: "OCT", title: "urgent", priority: "urgent" });
    const normal = h.call(c.issueCreate, { project: "OCT", title: "normal" });
    const blocked = h.call(c.issueCreate, { project: "OCT", title: "blocked", blockedBy: [normal.ref] });

    let next = h.call(c.next, {});
    expect(next.awaitingDecisions.map((item) => item.ref)).toEqual([decision.ref]);
    expect(next.claimed.map((card) => card.issue.ref)).toEqual([claimed.ref]);
    expect(next.ready.map((card) => card.issue.ref)).toEqual([urgent.ref, normal.ref]);
    expect(next.ready.map((card) => card.issue.ref)).not.toContain(others.ref);
    expect(next.ready.map((card) => card.issue.ref)).not.toContain(blocked.ref);

    h.call(c.decisionResolve, { ref: decision.ref, note: "yes" }, "vasco");
    next = h.call(c.next, {});
    expect(next.resolvedDecisions.map((item) => item.ref)).toEqual([decision.ref]);
    expect(next.drift.map((item) => item.rule)).toEqual(["decision-project-sync"]);
    expect(next.summary).toContain("1 of your decisions came back");
  });

  test("agents are recorded with their last activity and note", () => {
    h.call(c.agentNote, { note: "Working on the feed" });
    expect(h.call(c.agentList, {}).find((agent) => agent.name === "agent-a")).toMatchObject({
      note: "Working on the feed",
    });
  });
});

describe("entity detail", () => {
  test("shows links, drift, updates and history together, for any spelling of a ref", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const pr = h.call(c.prUpsert, {
      repo: "acme/app",
      number: 12,
      title: "x",
      state: "merged",
      issues: [issue.ref],
    });
    h.call(c.updatePost, { body: "Note", target: issue.ref });

    const detail = h.call(c.entityShow, { ref: issue.ref.toLowerCase() });
    expect(detail.summary.ref).toBe(issue.ref);
    expect(detail.linked.map((item) => item.ref)).toEqual([pr.ref]);
    expect(detail.drift.map((item) => item.rule)).toEqual(["pr-merged-issue-open"]);
    expect(detail.updates.map((item) => item.body)).toEqual(["Note"]);
    expect(detail.history.map((event) => event.type)).toContain("issue.created");
    expect(detail.history.map((event) => event.type)).toContain("status.posted");

    expect(h.call(c.entityShow, { ref: "acme/app#12" }).summary.ref).toBe(pr.ref);
    expect(() => h.call(c.entityShow, { ref: "OCT-99" })).toThrow("Nothing found");
    expect(() => h.call(c.entityShow, { ref: "not a ref" })).toThrow("Nothing found");
  });
});

describe("portability", () => {
  test("core imports nothing tied to a runtime, so that it can run on Cloudflare one day", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else files.push(path);
      }
    };
    walk(join(import.meta.dir, "../src"));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(
        /from "(bun|node):|from "bun"|\bBun\.[a-z]|\bprocess\.[a-z]/,
      );
    }
  });
});
