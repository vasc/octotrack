import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const OPTIONS = [{ key: "a", label: "Yes", description: "Go ahead." }];

function world() {
  const tracker = new Tracker(memoryDriver(), () => "2026-11-14T09:00:00.000Z");
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const server: Caller = { actor: "octotrack", channel: "cli", system: true };
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
  const line = as(dev, c.lineAdd, {
    title: "Enclosure",
    doneWhen: "Done.",
    repos: ["PANEL"],
    where: "working",
  });
  as(agent("panel"), c.agentRegister, { wake: "claude:panel", repo: "PANEL" });
  as(agent("panel"), c.lineTake, { ref: line.ref });
  return { tracker, dev, server, agent, as, refused, line };
}

describe("only the server records wakes", () => {
  test("an agent cannot make another agent gone by saying its wake failed", () => {
    const w = world();
    expect(w.refused(() => w.as(w.agent("mallory"), c.agentWoken, { name: "panel", error: "x" })).code).toBe(
      "forbidden",
    );
    expect(w.refused(() => w.as(w.dev, c.agentWoken, { name: "panel" })).code).toBe("forbidden");
    w.as(w.server, c.agentWoken, { name: "panel" });
  });

  test("nor say a question's session was woken", () => {
    const w = world();
    const asked = w.as(w.agent("legacy"), c.decisionAsk, { title: "Q", wake: "claude:legacy" });
    expect(w.refused(() => w.as(w.agent("mallory"), c.decisionWoken, { ref: asked.ref })).code).toBe(
      "forbidden",
    );
  });
});

describe("answering a question on a line is the developer's", () => {
  test("an agent is refused, and relays the developer's words with --said, which the log quotes", () => {
    const w = world();
    const asked = w.as(w.agent("panel"), c.decisionAsk, {
      title: "Which?",
      context: "Context.",
      options: OPTIONS,
    });
    const refusal = w.refused(() =>
      w.as(w.agent("panel"), c.decisionResolve, { ref: asked.ref, option: "a" }),
    );
    expect(refusal.code).toBe("forbidden");
    expect(refusal.hint).toContain("--said");
    expect(w.refused(() => w.as(w.agent("panel"), c.decisionPostpone, { ref: asked.ref })).code).toBe(
      "forbidden",
    );
    expect(w.refused(() => w.as(w.agent("panel"), c.decisionReopen, { ref: asked.ref })).code).toBe(
      "forbidden",
    );
    w.as(w.agent("panel", { said: "yes, go ahead" }), c.decisionResolve, { ref: asked.ref, option: "a" });
    const event = w.as(w.dev, c.feedList, { query: `ref:${asked.ref} event:decision.resolved` }).events[0];
    expect(event?.attrs.said).toBe("yes, go ahead");
  });

  test("an agent off the line cannot withdraw its questions; the asker and the developer can", () => {
    const w = world();
    const asked = w.as(w.agent("panel"), c.decisionAsk, {
      title: "Which?",
      context: "Context.",
      options: OPTIONS,
    });
    expect(w.refused(() => w.as(w.agent("mallory"), c.decisionWithdraw, { ref: asked.ref })).code).toBe(
      "forbidden",
    );
    expect(w.as(w.agent("panel"), c.decisionWithdraw, { ref: asked.ref }).status).toBe("withdrawn");
  });

  test("a question from before lines keeps the older rules", () => {
    const w = world();
    const asked = w.as(w.agent("legacy"), c.decisionAsk, { title: "Old style" });
    expect(
      w.as(w.agent("legacy"), c.decisionResolve, { ref: asked.ref, note: "Done elsewhere" }).status,
    ).toBe("decided");
  });

  test("a question naming an issue on a line belongs to that line, even from an agent on no line", () => {
    const w = world();
    const issue = w.as(w.dev, c.issueCreate, { project: "PANEL", title: "Base", line: w.line.ref });
    const asked = w.as(w.agent("visitor"), c.decisionAsk, {
      title: "Which?",
      context: "Context.",
      options: OPTIONS,
      issue: issue.ref,
    });
    expect(asked.line).toBe(w.line.ref);
    expect(
      w.refused(() => w.as(w.agent("visitor"), c.decisionAsk, { title: "Bare", issue: issue.ref })).code,
    ).toBe("invalid_input");
  });
});

describe("the developer's choices and drafts are the developer's", () => {
  test("an agent can neither undo a waiting choice nor read a draft, even quoting the developer", () => {
    const w = world();
    const choice = w.as(w.dev, c.choiceMake, { op: "agent.stop", input: { name: "panel" }, summary: "Stop" });
    for (const caller of [w.agent("panel"), w.agent("panel", { said: "undo it" })]) {
      expect(w.refused(() => w.as(caller, c.choiceUndo, { id: choice.id })).code).toBe("forbidden");
      expect(w.refused(() => w.as(caller, c.choiceNow, { id: choice.id })).code).toBe("forbidden");
      expect(w.refused(() => w.as(caller, c.choiceList, {})).code).toBe("forbidden");
      expect(w.refused(() => w.as(caller, c.draftGet, { key: "x" })).code).toBe("forbidden");
      expect(w.refused(() => w.as(caller, c.draftSave, { key: "x", text: "y" })).code).toBe("forbidden");
    }
  });

  test("only the developer turns on notifications, and only to an https push service", () => {
    const w = world();
    const subscription = { endpoint: "https://push.example/a", keys: { p256dh: "k", auth: "a" } };
    expect(
      w.refused(() => w.as(w.agent("panel", { said: "turn it on" }), c.pushSubscribe, subscription)).code,
    ).toBe("forbidden");
    expect(
      w.refused(() => w.as(w.dev, c.pushSubscribe, { ...subscription, endpoint: "http://127.0.0.1:9/steal" }))
        .code,
    ).toBe("invalid_input");
    w.as(w.dev, c.pushSubscribe, subscription);
  });
});

describe("what an agent may say about itself and its repos", () => {
  test("a wake address cannot pass for an option or a command", () => {
    const w = world();
    expect(w.refused(() => w.as(w.agent("other"), c.agentRegister, { wake: "--help:x" })).code).toBe(
      "invalid_input",
    );
    expect(w.refused(() => w.as(w.agent("other"), c.agentRegister, { wake: "claude:a b; rm" })).code).toBe(
      "invalid_input",
    );
  });

  test("an agent names its repo once, and only the developer changes a repo's GitHub name, which must be owner/name", () => {
    const w = world();
    w.as(w.dev, c.projectCreate, { key: "OCT", name: "Octotrack" });
    expect(w.refused(() => w.as(w.agent("panel"), c.agentRegister, { repo: "OCT" })).code).toBe("forbidden");
    expect(w.as(w.agent("panel"), c.agentRegister, { repo: "PANEL" }).repo).toBe("PANEL");
    expect(
      w.refused(() => w.as(w.agent("panel"), c.projectUpdate, { ref: "OCT", repo: "evil/repo" })).code,
    ).toBe("forbidden");
    expect(w.refused(() => w.as(w.dev, c.projectUpdate, { ref: "OCT", repo: "not a slug" })).code).toBe(
      "invalid_input",
    );
    expect(w.as(w.dev, c.projectUpdate, { ref: "OCT", repo: "vasc/octotrack" }).repo).toBe("vasc/octotrack");
  });
});
