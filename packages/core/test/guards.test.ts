import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
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
  as(owner, c.agentRegister, { wake: "claude:panel", repo: "PANEL" });
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

  test("a new name is letters, digits, dots, dashes, underscores and inner spaces, from a letter or digit, at most 64", () => {
    const w = world();
    for (const name of ["*", "-rf", "--all", "tab\there", "trailing ", ".hidden", "a;b", "x".repeat(65)]) {
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
      "my agent",
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
