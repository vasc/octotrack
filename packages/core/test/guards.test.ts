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
