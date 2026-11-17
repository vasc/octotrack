import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import { migrate } from "../src/db/migrations.ts";
import { OctoError } from "../src/errors.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const MINUTE = 60_000;
const SITUATION = "The board fits two ways; the lid closes only one of them.";
const OPTIONS = [
  { key: "a", label: "Flat", description: "Lay it flat: the lid closes, 4 mm taller." },
  { key: "b", label: "Upright", description: "Stand it up: thinner, but the lid needs a cut-out." },
];

/**
 * Who may write what, as the audit probed it: an owner on a working line in PANEL, and an agent from another repo, on
 * no line, trying to write to that line from outside.
 */
function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const driver = memoryDriver();
  const tracker = new Tracker(driver, () => now);
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const github: Caller = { actor: "github", channel: "cli", system: true };
  const agent = (name: string, extra: Partial<Caller> = {}): Caller => ({
    actor: name,
    channel: "cli",
    ...extra,
  });
  function as<I extends z.ZodType, O extends z.ZodType>(
    caller: Caller,
    contract: Contract<I, O>,
    input: z.input<I>,
  ) {
    return tracker.call(contract, input, caller);
  }
  function refused(run: () => unknown): OctoError {
    try {
      run();
    } catch (error) {
      if (error instanceof OctoError) return error;
      throw error;
    }
    throw new Error("expected a refusal");
  }
  as(dev, c.projectCreate, { key: "PANEL", name: "Panel", repo: "vasc/homepanel" });
  as(dev, c.projectCreate, { key: "OTHER", name: "Other", repo: "vasc/other" });
  const line = as(dev, c.lineAdd, {
    title: "Enclosure",
    doneWhen: "Done.",
    repos: ["PANEL"],
    where: "working",
  }).ref;
  const owner = agent("panel");
  as(owner, c.agentRegister, { wake: "screen:panel", repo: "PANEL" });
  as(owner, c.lineTake, { ref: line });
  const outsider = agent("outsider");
  as(outsider, c.agentRegister, { repo: "OTHER" });
  const issue = as(dev, c.issueCreate, { project: "PANEL", title: "Base", line }).ref;
  const events = (query: string) => as(dev, c.feedList, { query }).events;
  const notices = (caller: Caller) => tracker.execute(c.agentList.name, {}, caller).notices;
  return {
    tracker,
    driver,
    dev,
    github,
    agent,
    as,
    refused,
    line,
    owner,
    outsider,
    issue,
    events,
    notices,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * MINUTE).toISOString();
    },
    ask() {
      return as(owner, c.decisionAsk, { title: "Which way?", context: SITUATION, options: OPTIONS }).ref;
    },
  };
}

describe("an agent claims, progresses and finishes issues only on the line it is on", () => {
  test("issue update cannot take or finish another line's issue", () => {
    const w = world();
    const refusal = w.refused(() =>
      w.as(w.outsider, c.issueUpdate, { refs: [w.issue], assignee: "outsider", status: "done" }),
    );
    expect(refusal.code).toBe("forbidden");
    expect(refusal.message).toContain("which you are not on");
    expect(
      w.refused(() => w.as(w.outsider, c.issueUpdate, { refs: [w.issue], status: "in_progress" })).code,
    ).toBe("forbidden");
    w.as(w.owner, c.issueClaim, { refs: [w.issue] });
    expect(w.refused(() => w.as(w.outsider, c.issueUpdate, { refs: [w.issue], assignee: null })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.owner, c.issueUpdate, { refs: [w.issue], status: "done" })[0]?.status).toBe("done");
  });

  test("nor move an issue onto a line it is not on and claim it there", () => {
    const w = world();
    const loose = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Loose" }).ref;
    expect(
      w.refused(() => w.as(w.outsider, c.issueUpdate, { refs: [loose], line: w.line, assignee: "outsider" }))
        .code,
    ).toBe("forbidden");
  });

  test("nor file an issue on that line already claimed or in progress", () => {
    const w = world();
    expect(
      w.refused(() =>
        w.as(w.outsider, c.issueCreate, {
          project: "PANEL",
          title: "Mine",
          line: w.line,
          assignee: "outsider",
        }),
      ).code,
    ).toBe("forbidden");
    expect(
      w.refused(() =>
        w.as(w.outsider, c.issueCreate, {
          project: "PANEL",
          title: "Mine",
          line: w.line,
          status: "in_progress",
        }),
      ).code,
    ).toBe("forbidden");
    expect(
      w.as(w.owner, c.issueCreate, { project: "PANEL", title: "Mine", line: w.line, assignee: "panel" })
        .assignee,
    ).toBe("panel");
  });
});

describe("a question on a line is refined only by its asker or the agents on its line, while it is open", () => {
  test("an agent from outside cannot rewrite it", () => {
    const w = world();
    const asked = w.ask();
    const refusal = w.refused(() =>
      w.as(w.outsider, c.decisionUpdate, {
        ref: asked,
        options: [{ key: "a", label: "Delete prod", description: "" }],
      }),
    );
    expect(refusal.code).toBe("forbidden");
    expect(w.as(w.dev, c.entityShow, { ref: asked }).summary.title).toBe("Which way?");
  });

  test("the asker's change must still stand alone", () => {
    const w = world();
    const asked = w.ask();
    expect(w.refused(() => w.as(w.owner, c.decisionUpdate, { ref: asked, context: "" })).code).toBe(
      "invalid_input",
    );
    expect(
      w.refused(() =>
        w.as(w.owner, c.decisionUpdate, {
          ref: asked,
          options: [{ key: "a", label: "Go", description: "" }],
        }),
      ).code,
    ).toBe("invalid_input");
    expect(w.as(w.owner, c.decisionUpdate, { ref: asked, title: "Which way up?" }).title).toBe(
      "Which way up?",
    );
  });

  test("nothing is written to it once its line is tabled", () => {
    const w = world();
    const asked = w.ask();
    w.as(w.dev, c.lineTable, { ref: w.line, reason: "Waiting on the board" });
    w.later(16);
    expect(w.refused(() => w.as(w.owner, c.decisionUpdate, { ref: asked, title: "Changed" })).code).toBe(
      "forbidden",
    );
  });

  test("an answered question, or one whose answer waits with Undo, is not rewritten under it", () => {
    const w = world();
    const waiting = w.ask();
    w.as(w.dev, c.choiceMake, {
      op: c.decisionResolve.name,
      input: { ref: waiting, option: "a" },
      summary: "Flat",
    });
    expect(
      w.refused(() => w.as(w.owner, c.decisionUpdate, { ref: waiting, options: [...OPTIONS].reverse() }))
        .code,
    ).toBe("conflict");
    const answered = w.ask();
    w.as(w.dev, c.decisionResolve, { ref: answered, option: "b" });
    expect(w.refused(() => w.as(w.owner, c.decisionUpdate, { ref: answered, title: "Changed" })).code).toBe(
      "conflict",
    );
  });
});

describe("the developer's and the server's names are not agents' names", () => {
  test("an agent cannot call itself dev or octotrack", () => {
    const w = world();
    for (const name of ["dev", "octotrack"]) {
      const refusal = w.refused(() => w.tracker.execute(c.lineTake.name, { ref: w.line }, w.agent(name)));
      expect(refusal.code).toBe("invalid_input");
    }
    expect(w.as(w.dev, c.agentList, {}).map((agent) => agent.name)).not.toContain("dev");
  });

  test("a new name is letters, digits, dots, dashes and underscores, from a letter or digit, at most 64", () => {
    const w = world();
    for (const name of [
      "*",
      "-rf",
      "--all",
      "tab\there",
      "trailing ",
      "my agent",
      ".hidden",
      "a;b",
      "x".repeat(65),
    ]) {
      expect(w.refused(() => w.as(w.agent(name), c.agentRegister, { repo: "PANEL" })).code).toBe(
        "invalid_input",
      );
    }
    for (const name of [
      "meals",
      "octotrack.3",
      "panel_2",
      "a-b.c",
      "9lives",
      "agénte-日本",
      "x".repeat(64),
    ]) {
      expect(w.as(w.agent(name), c.agentRegister, { repo: "PANEL" }).name).toBe(name);
    }
  });

  test("an agent registered before the rule keeps working", () => {
    const w = world();
    w.driver.run("INSERT INTO agents (name, firstSeenAt, lastSeenAt, repo) VALUES (?, ?, ?, ?)", [
      "old agent",
      "2026-11-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
      "PANEL",
    ]);
    expect(w.as(w.agent("old agent"), c.agentRegister, {}).name).toBe("old agent");
  });

  test("rows an early release made for the server's own callers are not agents, and are not listed", () => {
    // Early releases recorded every caller as seen, the server's included, so a live database has rows for them.
    const driver = memoryDriver();
    migrate(driver, 24);
    for (const name of ["octotrack", "github", "panel"]) {
      driver.run("INSERT INTO agents (name, firstSeenAt, lastSeenAt) VALUES (?, ?, ?)", [
        name,
        "2026-11-14T08:59:00.000Z",
        "2026-11-14T08:59:00.000Z",
      ]);
    }
    const tracker = new Tracker(driver, () => "2026-11-14T09:00:00.000Z");
    const roster = tracker.call(c.agentList, {}, { actor: "dev", channel: "dashboard" });
    expect(roster.map((agent) => [agent.name, agent.state])).toEqual([["panel", "running"]]);
    // Kept, never deleted: they are data like any other, only not agents.
    expect(driver.all("SELECT name FROM agents ORDER BY name").map((row) => JSON.stringify(row))).toEqual([
      JSON.stringify({ name: "github" }),
      JSON.stringify({ name: "octotrack" }),
      JSON.stringify({ name: "panel" }),
    ]);
  });
});

describe("what records the developer's own attention is theirs in person; the rest is logged when relayed", () => {
  test("seen, the app opened and I'm at cannot be relayed", () => {
    const w = world();
    w.as(w.dev, c.placeAdd, { name: "the bench" });
    const relay = w.agent("panel", { said: "I looked at everything" });
    for (const run of [
      () => w.as(relay, c.seen, {}),
      () => w.as(relay, c.pushSeen, {}),
      () => w.as(relay, c.at, { place: "the bench" }),
    ]) {
      expect(w.refused(run).code).toBe("forbidden");
    }
  });

  test("a place added or removed on the developer's words is in the log, quoting them", () => {
    const w = world();
    w.as(w.agent("panel", { said: "add the shed" }), c.placeAdd, { name: "the shed" });
    w.as(w.agent("panel", { said: "the shed is gone" }), c.placeRemove, { name: "the shed" });
    const logged = w.events("event:place.*");
    expect(logged.map((event) => [event.type, event.actor, event.attrs.said])).toEqual([
      ["place.removed", "panel", "the shed is gone"],
      ["place.added", "panel", "add the shed"],
    ]);
  });
});

describe("pull requests on lines that are not being worked on", () => {
  test("an agent's report for an issue on a tabled or up-next line is refused and counted", () => {
    const w = world();
    w.as(w.dev, c.lineTable, { ref: w.line, reason: "Waiting on the board" });
    w.later(16);
    const refusal = w.refused(() =>
      w.as(w.owner, c.prUpsert, {
        repo: "vasc/homepanel",
        number: 1,
        title: `Fixes ${w.issue}`,
        state: "open",
      }),
    );
    expect(refusal.code).toBe("forbidden");
    const queued = w.as(w.dev, c.lineAdd, {
      title: "Next",
      doneWhen: "Done.",
      repos: ["PANEL"],
      where: "up_next",
    });
    const next = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Later", line: queued.ref }).ref;
    expect(
      w.refused(() =>
        w.as(w.owner, c.prUpsert, {
          repo: "vasc/homepanel",
          number: 2,
          title: "Work",
          issues: [next],
          state: "open",
        }),
      ).code,
    ).toBe("forbidden");
    expect(w.events("event:write.refused").map((event) => [event.line, event.attrs.counted])).toEqual([
      [queued.ref, "yes"],
      [w.line, "yes"],
    ]);
  });

  test("pull request events name the line of the issue they implement", () => {
    const w = world();
    w.as(w.owner, c.prUpsert, {
      repo: "vasc/homepanel",
      number: 1,
      title: `Fixes ${w.issue}`,
      state: "open",
    });
    expect(w.events("event:pr.opened")[0]?.line).toBe(w.line);
  });

  test("one opened or pushed after the wind-down is shown on its line, once per pull request", () => {
    const w = world();
    w.as(w.dev, c.lineTable, { ref: w.line, reason: "Waiting on the board" });
    w.later(16);
    const pr = (headSha: string) => ({
      repo: "vasc/homepanel",
      number: 7,
      title: `Fixes ${w.issue}`,
      state: "open" as const,
      headSha,
    });
    w.as(w.github, c.prSync, { prs: [pr("aaa")] });
    w.as(w.github, c.prSync, { prs: [pr("bbb")] });
    const late = w.events("event:pr.after_wind_down");
    expect(late.map((event) => [event.line, event.actor])).toEqual([[w.line, "github"]]);
    expect(w.as(w.dev, c.feedList, { unseen: true }).events.map((event) => event.type)).toContain(
      "pr.after_wind_down",
    );
  });

  test("a push on a line the developer owns is presumed theirs", () => {
    const w = world();
    w.as(w.dev, c.lineOwn, { ref: w.line });
    w.later(16);
    w.as(w.github, c.prSync, {
      prs: [{ repo: "vasc/homepanel", number: 7, title: `Fixes ${w.issue}`, state: "open", headSha: "a" }],
    });
    expect(w.events("event:pr.after_wind_down")).toEqual([]);
  });

  test("pull requests already open at the deadline are held and listed once", () => {
    const w = world();
    const opened = w.as(w.owner, c.prUpsert, {
      repo: "vasc/homepanel",
      number: 3,
      title: `Fixes ${w.issue}`,
      state: "open",
    });
    w.as(w.dev, c.lineTable, { ref: w.line, reason: "Waiting on the board" });
    w.later(16);
    w.as(w.dev, c.lineList, {});
    w.later(16);
    w.as(w.dev, c.lineList, {});
    const held = w.events("event:line.prs_held");
    expect(held.map((event) => [event.line, event.related])).toEqual([[w.line, [opened.ref]]]);
  });
});

describe("Not a line returns old work for good", () => {
  test("the returned issues are not asked about again", () => {
    const w = world();
    const old = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "From before" }).ref;
    const proposer = w.agent("scout");
    w.as(proposer, c.agentRegister, { repo: "PANEL" });
    const proposal = w.as(proposer, c.linePropose, {
      title: "Old things",
      doneWhen: "Sorted.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "They belong together.",
    });
    w.as(proposer, c.issueUpdate, { refs: [old], line: proposal.ref });
    const drift = () => w.as(w.dev, c.driftList, { query: "rule:unplaced-work" }).map((item) => item.message);
    expect(drift()).toEqual([]);
    w.as(w.dev, c.lineReject, { ref: proposal.ref });
    expect(drift()).toEqual([]);
    const fresh = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "New and loose" }).ref;
    expect(drift()).toEqual([`1 open issue in PANEL is on no line`]);
    expect(w.as(w.dev, c.driftList, { query: "rule:unplaced-work" })[0]?.fingerprint).toBe(fresh);
  });
});

describe("agents write only to the line they are on", () => {
  test("links: an agent from outside can neither add nor remove them", () => {
    const w = world();
    w.as(w.dev, c.placeAdd, { name: "the bench" });
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the board",
      place: "the bench",
      outcome: "Its width in mm",
      frees: w.issue,
    });
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which way?",
      context: SITUATION,
      options: OPTIONS,
      waitsFor: task.ref,
    });
    const refusal = w.refused(() =>
      w.as(w.outsider, c.linkRemove, { from: task.ref, rel: "blocks", to: asked.ref }),
    );
    expect(refusal.code).toBe("forbidden");
    expect(w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.ref)).toEqual([]);
    expect(
      w.refused(() => w.as(w.outsider, c.linkAdd, { from: w.issue, rel: "relates", to: asked.ref })).code,
    ).toBe("forbidden");
    expect(w.as(w.owner, c.linkAdd, { from: w.issue, rel: "relates", to: asked.ref }).toRef).toBe(asked.ref);
  });

  test("drift: an agent from outside can neither take nor clear a line's drift", () => {
    const w = world();
    w.as(w.dev, c.issueUpdate, { refs: [w.issue], status: "in_review" });
    const [drift] = w.as(w.dev, c.driftList, { query: "rule:in-review-without-pr" });
    if (drift === undefined) throw new Error("expected drift");
    expect(w.refused(() => w.as(w.outsider, c.driftClaim, { refs: [drift.ref] })).code).toBe("forbidden");
    expect(
      w.refused(() => w.as(w.outsider, c.driftAck, { refs: [drift.ref], mode: "verified", note: "fine" }))
        .code,
    ).toBe("forbidden");
    expect(
      w.refused(() => w.as(w.outsider, c.driftAck, { target: w.issue, mode: "verified", note: "fine" })).code,
    ).toBe("forbidden");
    expect(w.as(w.owner, c.driftClaim, { refs: [drift.ref] })[0]?.claimedBy).toBe("panel");
  });

  test("notes: an agent from outside cannot post on a line's issue", () => {
    const w = world();
    expect(w.refused(() => w.as(w.outsider, c.updatePost, { body: "Mine now", target: w.issue })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.owner, c.updatePost, { body: "Base modelled", target: w.issue }).target).toBe(w.issue);
  });

  test("held work: an agent from outside cannot re-confirm a line's question", () => {
    const w = world();
    const asked = w.ask();
    expect(w.refused(() => w.as(w.outsider, c.heldConfirm, { refs: [asked] })).code).toBe("forbidden");
  });

  test("answers: an agent from outside cannot pick one up or say it was carried out", () => {
    const w = world();
    const asked = w.ask();
    w.as(w.dev, c.decisionResolve, { ref: asked, option: "a" });
    expect(w.refused(() => w.as(w.outsider, c.decisionPickup, { ref: asked })).code).toBe("forbidden");
    expect(
      w.refused(() => w.as(w.outsider, c.decisionReport, { ref: asked, status: "done", note: "Did it" }))
        .code,
    ).toBe("forbidden");
    expect(
      w.as(w.owner, c.decisionReport, { ref: asked, status: "done", note: "Laid flat" }).reportStatus,
    ).toBe("done");
  });
});

describe("recording a decision already settled on a line", () => {
  test("an agent records what the developer told it; their words, when passed, are quoted in the log", () => {
    const w = world();
    expect(w.as(w.owner, c.decisionRecord, { title: "Use Y", chosen: "Y" }).status).toBe("decided");
    const recorded = w.as(w.agent("panel", { said: "we use X" }), c.decisionRecord, {
      title: "Use X",
      chosen: "X",
    });
    expect(recorded.line).toBe(w.line);
    expect(w.events(`ref:${recorded.ref} event:decision.resolved`)[0]?.attrs.said).toBe("we use X");
  });

  test("it can be on a line: the one named, or the line of the issue named", () => {
    const w = world();
    expect(w.as(w.dev, c.decisionRecord, { title: "Flat", chosen: "Flat", line: w.line }).line).toBe(w.line);
    expect(w.as(w.dev, c.decisionRecord, { title: "Base", chosen: "PLA", issue: w.issue }).line).toBe(w.line);
  });
});

describe("a proposal folded or dropped is told so", () => {
  test("its proposer hears what really became of it", () => {
    const w = world();
    const scout = w.agent("scout");
    w.as(scout, c.agentRegister, { repo: "PANEL" });
    const propose = (title: string) =>
      w.as(scout, c.linePropose, {
        title,
        doneWhen: "Done.",
        repos: ["PANEL"],
        recommendation: "up_next",
        why: "It is work.",
      }).ref;
    const folded = propose("Lid");
    const dropped = propose("Stand");
    const rejected = propose("Nothing");
    w.as(w.dev, c.lineFold, { ref: folded, into: w.line });
    w.as(w.dev, c.lineDrop, { ref: dropped });
    w.as(w.dev, c.lineReject, { ref: rejected });
    const said = w.notices(scout).map((notice) => notice.body);
    expect(said[0]).toContain(`folded it into ${w.line}`);
    expect(said[1]).toContain("dropped it");
    expect(said[2]).toContain("said it is not a line");
  });
});

describe("re-confirmed work is in the log", () => {
  test("held confirm records what was re-confirmed", () => {
    const w = world();
    const asked = w.ask();
    w.as(w.dev, c.lineQueue, { ref: w.line });
    w.later(16);
    const scoper = w.agent("scoper");
    w.as(scoper, c.agentRegister, { repo: "PANEL" });
    w.as(scoper, c.lineTake, { ref: w.line });
    w.as(scoper, c.heldConfirm, { refs: [asked] });
    expect(w.events("event:held.confirmed").map((event) => [event.ref, event.line])).toEqual([
      [asked, w.line],
    ]);
  });
});

describe("a wake says how many things wait", () => {
  test("one thing waits", () => {
    const w = world();
    const asked = w.ask();
    w.later(20);
    w.as(w.dev, c.decisionResolve, { ref: asked, option: "a" });
    expect(w.as(w.dev, c.agentWakes, {})[0]?.message).toContain("1 thing waits for you");
  });
});

describe("work on a line makes its summary fall due", () => {
  const due = (w: ReturnType<typeof world>) =>
    w.as(w.dev, c.driftList, { query: "rule:summary-due status:open" }).map((drift) => drift.target);

  test("a question asked there", () => {
    const w = world();
    w.ask();
    w.later(61);
    w.tracker.sweep();
    expect(due(w)).toEqual([w.line]);
  });

  test("a plan step marked done, and a branch added (audit of D15, 8)", () => {
    const w = world();
    w.as(w.owner, c.planSet, { line: w.line, steps: ["Base", "Lid"] });
    const summarize = () =>
      w.as(w.owner, c.lineSummarize, { ref: w.line, headline: "Under way.", summary: "Base first." });
    summarize();
    w.later(1);
    w.as(w.owner, c.planStep, { line: w.line, step: "1", status: "done" });
    w.later(61);
    w.tracker.sweep();
    expect(due(w)).toEqual([w.line]);
    summarize();
    w.tracker.sweep();
    expect(due(w)).toEqual([]);
    w.later(1);
    w.as(w.owner, c.planBranch, { line: w.line, from: "2", title: "Hinge", steps: ["Print it"] });
    w.later(61);
    w.tracker.sweep();
    expect(due(w)).toEqual([w.line]);
  });

  test("a pull request merged there", () => {
    const w = world();
    w.as(w.github, c.prSync, {
      prs: [{ repo: "vasc/homepanel", number: 4, title: `Fixes ${w.issue}`, state: "merged" }],
    });
    w.later(61);
    w.tracker.sweep();
    expect(due(w)).toEqual([w.line]);
  });
});

describe("agents write only to the line they are on, scoping included (third audit, N4)", () => {
  test("plan set: an agent from outside cannot replace a line's plan", () => {
    const w = world();
    expect(w.refused(() => w.as(w.outsider, c.planSet, { line: w.line, steps: ["Mine"] })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.owner, c.planSet, { line: w.line, steps: ["Base", "Lid"] })).toHaveLength(2);
  });

  test("task file: an agent from outside cannot file a task for the developer on a line", () => {
    const w = world();
    w.as(w.dev, c.placeAdd, { name: "the bench" });
    const task = { title: "Measure", place: "the bench", outcome: "Width in mm" };
    expect(w.refused(() => w.as(w.outsider, c.taskFile, { ...task, line: w.line })).code).toBe("forbidden");
    expect(
      w.refused(() => w.as(w.outsider, c.taskFile, { ...task, line: w.line, frees: w.issue })).code,
    ).toBe("forbidden");
    expect(w.as(w.owner, c.taskFile, task).line).toBe(w.line);
  });

  test("issue update: an agent from outside can neither take an issue off a line nor rewrite it", () => {
    const w = world();
    expect(w.refused(() => w.as(w.outsider, c.issueUpdate, { refs: [w.issue], line: null })).code).toBe(
      "forbidden",
    );
    expect(
      w.refused(() =>
        w.as(w.outsider, c.issueUpdate, { refs: [w.issue], title: "Hijacked", status: "blocked" }),
      ).code,
    ).toBe("forbidden");
    const loose = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Loose" }).ref;
    expect(w.refused(() => w.as(w.outsider, c.issueUpdate, { refs: [loose], line: w.line })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.owner, c.issueUpdate, { refs: [w.issue], title: "Base, flat" })[0]?.title).toBe(
      "Base, flat",
    );
  });

  test("issue create: an agent from outside cannot file an issue on a line, nor one that blocks its work", () => {
    const w = world();
    expect(
      w.refused(() => w.as(w.outsider, c.issueCreate, { project: "PANEL", title: "Mine", line: w.line }))
        .code,
    ).toBe("forbidden");
    expect(
      w.refused(() =>
        w.as(w.outsider, c.issueCreate, { project: "OTHER", title: "Blocker", blocks: [w.issue] }),
      ).code,
    ).toBe("forbidden");
    expect(w.as(w.owner, c.issueCreate, { project: "PANEL", title: "Lid", line: w.line }).line).toBe(w.line);
  });

  test("question ask: an agent from outside cannot put a question in a line's queue", () => {
    const w = world();
    const question = { title: "Which way?", context: SITUATION, options: OPTIONS };
    expect(w.refused(() => w.as(w.outsider, c.decisionAsk, { ...question, line: w.line })).code).toBe(
      "forbidden",
    );
    expect(w.refused(() => w.as(w.outsider, c.decisionAsk, { ...question, issue: w.issue })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.dev, c.decisionQueue, {})).toEqual([]);
    expect(w.as(w.owner, c.decisionAsk, question).line).toBe(w.line);
  });
});

describe("the developer's own operations, relayed, take effect", () => {
  test("a task added to the developer's own line on their words is added", () => {
    const w = world();
    const mine = w.as(w.dev, c.lineAdd, {
      title: "Mine",
      doneWhen: "Done.",
      repos: [],
      where: "working",
    }).ref;
    const relayed = w.agent("panel", { said: "add measuring the shelf to my line" });
    expect(w.as(relayed, c.taskAdd, { line: mine, title: "Measure the shelf" }).line).toBe(mine);
    expect(w.as(relayed, c.noteAdd, { line: mine, body: "Shelf is oak." }).line).toBe(mine);
  });
});

describe("pull request sync is the server's, or the developer's (third audit, N3)", () => {
  test("an agent can neither write pull requests through sync nor say how sync went", () => {
    const w = world();
    const pr = {
      repo: "vasc/homepanel",
      number: 40,
      title: "Mine",
      state: "open",
      body: `Fixes ${w.issue}`,
    } as const;
    for (const caller of [w.outsider, w.owner]) {
      expect(w.refused(() => w.as(caller, c.prSync, { prs: [pr] })).code).toBe("forbidden");
      expect(
        w.refused(() =>
          w.as(caller, c.prSync, { prs: [], failures: [{ repo: "vasc/homepanel", error: "fake" }] }),
        ).code,
      ).toBe("forbidden");
    }
    expect(w.as(w.dev, c.prList, {})).toEqual([]);
    expect(w.as(w.github, c.prSync, { prs: [pr] }).synced).toBe(1);
    expect(w.as(w.dev, c.prSync, { prs: [], repos: ["vasc/homepanel"] }).synced).toBe(0);
  });
});

describe("where an asker is woken is the asker's own (third audit, N13)", () => {
  test("nobody can change, or silence, where a question's answer wakes its asker", () => {
    const w = world();
    const asker = w.agent("loose");
    w.as(asker, c.agentRegister, { wake: "screen:loose", repo: "OTHER" });
    const asked = w.as(asker, c.decisionAsk, { title: "Which queue?" }).ref;
    for (const address of ["screen:mallory", null]) {
      expect(() => w.tracker.execute("decision.wake", { ref: asked, address }, w.outsider)).toThrow();
    }
    w.as(w.dev, c.decisionResolve, { ref: asked, note: "Kafka" });
    const due = w.as(w.github, c.decisionWakes, {});
    expect(due.map((decision) => [decision.ref, decision.wakeAddress])).toEqual([[asked, "screen:loose"]]);
  });
});

describe("agents write only to the line they are on, the rest of it (fourth audit)", () => {
  /** The outsider, on a working line of its own in OTHER: on a line, but not this one. */
  function elsewhere(w: ReturnType<typeof world>): string {
    const own = w.as(w.dev, c.lineAdd, {
      title: "Other",
      doneWhen: "Done.",
      repos: ["OTHER"],
      where: "working",
    });
    w.as(w.outsider, c.lineTake, { ref: own.ref });
    return own.ref;
  }

  test("pr upsert: an agent cannot link a pull request to another line's issue, nor rewrite one linked there", () => {
    const w = world();
    elsewhere(w);
    const pr = { repo: "vasc/homepanel", title: "Base", state: "open" } as const;
    expect(w.refused(() => w.as(w.outsider, c.prUpsert, { ...pr, number: 7, issues: [w.issue] })).code).toBe(
      "forbidden",
    );
    expect(
      w.refused(() => w.as(w.outsider, c.prUpsert, { ...pr, number: 8, title: `Fixes ${w.issue}` })).code,
    ).toBe("forbidden");
    expect(w.as(w.dev, c.linkList, { ref: w.issue })).toEqual([]);
    const own = w.as(w.owner, c.prUpsert, { ...pr, number: 9, issues: [w.issue] });
    expect(w.refused(() => w.as(w.outsider, c.prUpsert, { ...pr, number: 9, state: "merged" })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.dev, c.prList, {}).map((card) => [card.pr.ref, card.pr.state])).toEqual([
      [own.ref, "open"],
    ]);
  });

  test("decision record: an agent on no line cannot record a decision that holds up or changes a line's work", () => {
    const w = world();
    const decision = { title: "Use PLA", context: "Printed parts.", chosen: "PLA" };
    expect(
      w.refused(() => w.as(w.outsider, c.decisionRecord, { ...decision, affects: [w.issue] })).code,
    ).toBe("forbidden");
    expect(w.refused(() => w.as(w.outsider, c.decisionRecord, { ...decision, blocks: [w.issue] })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.dev, c.linkList, { ref: w.issue })).toEqual([]);
    expect(w.as(w.dev, c.driftList, { query: "rule:decision-outcome" })).toEqual([]);
    const loose = w.as(w.dev, c.issueCreate, { project: "OTHER", title: "Loose" }).ref;
    const recorded = w.as(w.outsider, c.decisionRecord, { ...decision, affects: [loose] });
    expect(w.as(w.dev, c.linkList, { ref: loose }).map((link) => link.fromRef)).toEqual([recorded.ref]);
  });

  test("watch check: an agent cannot check another agent's watch and take its events", () => {
    const w = world();
    const watch = w.as(w.owner, c.watchCreate, {
      name: "mine",
      spec: { require: "any", clauses: [{ type: "event", query: "kind:issue", count: 1 }] },
      follow: true,
    });
    w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Lid", line: w.line });
    expect(w.refused(() => w.as(w.outsider, c.watchCheck, { refs: [watch.ref] })).code).toBe("forbidden");
    const own = w.as(w.owner, c.watchCheck, { refs: [watch.ref] });
    expect(own[0]?.fired).toBe(true);
    expect(own[0]?.clauses[0]?.events.map((event) => event.type)).toEqual(["issue.created"]);
  });

  test("issue update and claim: an agent cannot finish, reopen or take the developer's task", () => {
    const w = world();
    w.as(w.dev, c.placeAdd, { name: "the bench" });
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure",
      place: "the bench",
      outcome: "Width in mm",
    }).ref;
    for (const change of [
      { status: "done" },
      { status: "cancelled" },
      { assignee: "panel" },
      { assignee: null },
    ] as const) {
      const refusal = w.refused(() => w.as(w.owner, c.issueUpdate, { refs: [task], ...change }));
      expect(refusal.code).toBe("forbidden");
      expect(refusal.hint).toContain("held withdraw");
    }
    expect(w.refused(() => w.as(w.owner, c.issueClaim, { refs: [task], force: true })).code).toBe(
      "forbidden",
    );
    const kept = w.as(w.dev, c.issueList, { query: `ref:${task}` })[0]?.issue;
    expect([kept?.status, kept?.assignee, kept?.result]).toEqual(["todo", "dev", null]);
    expect(w.as(w.owner, c.issueUpdate, { refs: [task], title: "Measure the width" })[0]?.title).toBe(
      "Measure the width",
    );
    expect(
      w.as(w.owner, c.heldWithdraw, { refs: [task], why: "Found it in the datasheet" }).withdrawn,
    ).toEqual([task]);
  });

  test("issue update and claim: an agent cannot reopen or take a task the developer closed (fifth audit, B12)", () => {
    const w = world();
    w.as(w.dev, c.placeAdd, { name: "the bench" });
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure",
      place: "the bench",
      outcome: "Width in mm",
    }).ref;
    w.as(w.dev, c.taskCant, { ref: task, why: "No calipers" });
    for (const change of [{ status: "todo" }, { status: "done" }, { assignee: "panel" }] as const) {
      const refusal = w.refused(() => w.as(w.owner, c.issueUpdate, { refs: [task], ...change }));
      expect(refusal.code).toBe("forbidden");
      expect(refusal.hint).toContain("octo task file");
    }
    expect(w.refused(() => w.as(w.owner, c.issueClaim, { refs: [task], force: true })).code).toBe(
      "forbidden",
    );
    const kept = w.as(w.dev, c.issueList, { query: `ref:${task}` })[0]?.issue;
    expect([kept?.status, kept?.assignee, kept?.result]).toEqual(["cancelled", "dev", "No calipers"]);
    expect(w.as(w.dev, c.homeShow, {}).counts.toDo).toBe(0);
  });

  test("issue release: an agent cannot move another line's unclaimed work back to todo", () => {
    const w = world();
    elsewhere(w);
    w.as(w.dev, c.issueUpdate, { refs: [w.issue], status: "in_progress" });
    expect(w.refused(() => w.as(w.outsider, c.issueRelease, { refs: [w.issue] })).code).toBe("forbidden");
    expect(w.as(w.dev, c.issueList, { query: `ref:${w.issue}` })[0]?.issue.status).toBe("in_progress");
    expect(w.as(w.owner, c.issueRelease, { refs: [w.issue] })[0]?.status).toBe("todo");
  });

  test("done when: the agent that proposed a line cannot propose a new one once it started, from another line", () => {
    const w = world();
    const proposal = w.as(w.owner, c.linePropose, {
      title: "Stand",
      doneWhen: "It stands.",
      repos: ["PANEL"],
      recommendation: "start",
      why: "It is next.",
    }).ref;
    expect(w.as(w.owner, c.lineDoneWhen, { ref: proposal, doneWhen: "It stands up." }).doneWhen).toBe(
      "It stands up.",
    );
    w.as(w.dev, c.lineStart, { ref: proposal });
    const refusal = w.refused(() =>
      w.as(w.owner, c.lineDoneWhen, { ref: proposal, doneWhen: "Hijacked", why: "x" }),
    );
    expect(refusal.code).toBe("forbidden");
    expect(w.as(w.dev, c.lineShow, { ref: proposal }).line.doneWhenProposal).toBeNull();
    expect(
      w.as(w.owner, c.lineDoneWhen, { ref: w.line, doneWhen: "It closes.", why: "Lid" }).doneWhenProposal,
    ).toBe("It closes.");
  });

  test("held confirm: only an open question or an open task is re-confirmed", () => {
    const w = world();
    const asked = w.ask();
    w.as(w.dev, c.decisionResolve, { ref: asked, option: "a" });
    expect(w.refused(() => w.as(w.owner, c.heldConfirm, { refs: [asked] })).code).toBe("conflict");
    expect(w.refused(() => w.as(w.owner, c.heldConfirm, { refs: [w.issue] })).code).toBe("invalid_input");
    expect(w.events("event:held.confirmed")).toEqual([]);
  });

  test("held withdraw: a proposal's proposer withdraws what it asked there, as it re-confirms it", () => {
    const w = world();
    const proposal = w.as(w.outsider, c.linePropose, {
      title: "Stand",
      doneWhen: "It stands.",
      repos: ["OTHER"],
      recommendation: "up_next",
      why: "It is next.",
    }).ref;
    const asked = w.as(w.outsider, c.decisionAsk, {
      title: "Which foot?",
      context: SITUATION,
      options: OPTIONS,
      line: proposal,
    }).ref;
    w.as(w.outsider, c.heldConfirm, { refs: [asked] });
    expect(w.refused(() => w.as(w.owner, c.heldWithdraw, { refs: [asked] })).code).toBe("forbidden");
    expect(w.as(w.outsider, c.heldWithdraw, { refs: [asked], why: "Decided" }).withdrawn).toEqual([asked]);
  });

  test("question withdraw: its asker cannot withdraw it once its line is tabled, unless the developer said so", () => {
    const w = world();
    const asked = w.ask();
    const kept = w.ask();
    w.as(w.dev, c.lineTable, { ref: w.line, reason: "Later" });
    w.later(20);
    const refusal = w.refused(() => w.as(w.owner, c.decisionWithdraw, { ref: asked }));
    expect([refusal.code, refusal.message]).toEqual([
      "forbidden",
      `${w.line} is tabled: nothing is written to it`,
    ]);
    expect(
      w.as(w.agent("panel", { said: "drop that question" }), c.decisionWithdraw, { ref: kept }).status,
    ).toBe("withdrawn");
  });

  test("pull request drift: it is work on the line of the issue the pull request implements", () => {
    const w = world();
    elsewhere(w);
    w.as(w.github, c.prSync, {
      prs: [
        { repo: "vasc/homepanel", number: 4, title: `Fixes ${w.issue}`, state: "open", checks: "failing" },
      ],
    });
    const [drift] = w.as(w.dev, c.driftList, { query: "rule:pr-checks-failing" });
    if (drift === undefined) throw new Error("expected drift");
    expect(drift.assignee).toBe("panel");
    expect(w.refused(() => w.as(w.outsider, c.driftClaim, { refs: [drift.ref] })).code).toBe("forbidden");
    expect(
      w.refused(() => w.as(w.outsider, c.driftAck, { refs: [drift.ref], mode: "verified", note: "fine" }))
        .code,
    ).toBe("forbidden");
    expect(
      w.refused(() => w.as(w.outsider, c.driftAck, { target: drift.target, mode: "verified", note: "fine" }))
        .code,
    ).toBe("forbidden");
    expect(w.refused(() => w.as(w.outsider, c.updatePost, { body: "Mine", target: drift.target })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.owner, c.driftClaim, { refs: [drift.ref] })[0]?.claimedBy).toBe("panel");
    expect(w.as(w.owner, c.updatePost, { body: "Fixing the test", target: drift.target }).target).toBe(
      drift.target,
    );
    expect(w.events(`event:status.posted line:${w.line}`)).toHaveLength(1);
  });

  test("notifications: an agent cannot turn them off, even on the developer's words", () => {
    const w = world();
    const endpoint = "https://push.example/1";
    w.as(w.dev, c.pushSubscribe, { endpoint, keys: { p256dh: "key", auth: "auth" } });
    const relayed = w.agent("panel", { said: "stop buzzing me" });
    expect(w.refused(() => w.as(relayed, c.pushUnsubscribe, { endpoint })).code).toBe("forbidden");
    expect(w.as(w.dev, c.pushUnsubscribe, { endpoint }).endpoint).toBe(endpoint);
  });
});
