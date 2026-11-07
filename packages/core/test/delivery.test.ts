import { beforeEach, describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import { type Harness, harness } from "./helpers.ts";

const ASKER = "mediarr";
const DEVELOPER = "dev";
const ADDRESS = "claude:ca1743eb-4524-4f04-9737-3980f49747b4";

let h: Harness;

function ask(extra: { wake?: string } = {}) {
  return h.call(c.decisionAsk, { title: "Which queue?", ...extra }, ASKER);
}

function answer(ref: string) {
  return h.call(c.decisionResolve, { ref, note: "Use Kafka" }, DEVELOPER);
}

const inbox = (actor = ASKER) => h.call(c.decisionInbox, {}, actor).map((decision) => decision.ref);

beforeEach(() => {
  h = harness();
});

describe("the inbox", () => {
  test("holds answers the agent that asked has not picked up", () => {
    const { ref } = ask();
    expect(inbox()).toEqual([]);
    answer(ref);
    expect(inbox()).toEqual([ref]);
  });

  test("is per agent, so one agent does not see another's answers", () => {
    answer(ask().ref);
    expect(inbox("someone-else")).toEqual([]);
  });

  test("can list what every agent has not picked up, for the dashboard", () => {
    const { ref } = ask();
    answer(ref);
    expect(h.call(c.decisionInbox, { all: true }, DEVELOPER).map((item) => item.ref)).toEqual([ref]);
  });

  test("leaves out a decision the agent answered itself, since there is nothing to deliver", () => {
    const { ref } = ask();
    h.call(c.decisionResolve, { ref, note: "Decided it myself" }, ASKER);
    expect(inbox()).toEqual([]);
  });

  test("leaves out a decision logged after the fact", () => {
    h.call(c.decisionRecord, { title: "Use SQLite", chosen: "SQLite" }, ASKER);
    expect(inbox()).toEqual([]);
  });

  test("picking up removes it and records who did", () => {
    const { ref } = ask();
    answer(ref);
    const picked = h.call(c.decisionPickup, { ref }, ASKER);
    expect(picked.pickedUpBy).toBe(ASKER);
    expect(picked.pickedUpAt).not.toBeNull();
    expect(inbox()).toEqual([]);
    expect(h.call(c.feedList, { query: "event:decision.picked_up" }).events).toHaveLength(1);
  });

  test("an open decision has nothing to pick up", () => {
    expect(() => h.call(c.decisionPickup, { ref: ask().ref }, ASKER)).toThrow(OctoError);
  });

  test("a changed answer is delivered again", () => {
    const { ref } = ask();
    answer(ref);
    h.call(c.decisionPickup, { ref }, ASKER);
    h.call(c.decisionResolve, { ref, note: "Actually, RabbitMQ", force: true }, DEVELOPER);
    expect(inbox()).toEqual([ref]);
  });

  test("reopening takes it back out of the inbox", () => {
    const { ref } = ask();
    answer(ref);
    h.call(c.decisionReopen, { ref }, DEVELOPER);
    expect(inbox()).toEqual([]);
  });
});

describe("reporting back", () => {
  test("records what happened, and counts as picking it up", () => {
    const { ref } = ask();
    answer(ref);
    const reported = h.call(c.decisionReport, { ref, status: "partial", note: "Host file remains" }, ASKER);
    expect(reported).toMatchObject({ reportStatus: "partial", reportNote: "Host file remains" });
    expect(reported.pickedUpBy).toBe(ASKER);
    expect(inbox()).toEqual([]);
    expect(h.call(c.feedList, { query: "event:decision.reported" }).events[0]?.summary).toContain(
      "Host file remains",
    );
  });

  test("a partial report can be followed by a finished one", () => {
    const { ref } = ask();
    answer(ref);
    h.call(c.decisionReport, { ref, status: "partial", note: "Half" }, ASKER);
    expect(h.call(c.decisionReport, { ref, status: "done", note: "All" }, ASKER).reportStatus).toBe("done");
  });

  test("an open decision has nothing to report on", () => {
    expect(() => h.call(c.decisionReport, { ref: ask().ref, status: "done", note: "x" }, ASKER)).toThrow(
      OctoError,
    );
  });

  test("a changed answer clears the old report", () => {
    const { ref } = ask();
    answer(ref);
    h.call(c.decisionReport, { ref, status: "done", note: "Did it" }, ASKER);
    const changed = h.call(c.decisionResolve, { ref, note: "Other way", force: true }, DEVELOPER);
    expect(changed).toMatchObject({ reportStatus: null, reportNote: null, pickedUpAt: null });
  });
});

describe("asking to be woken", () => {
  const wakes = () => h.call(c.decisionWakes, {}, "server").map((decision) => decision.ref);

  test("is not the default: nothing is woken unless the session asked", () => {
    answer(ask().ref);
    expect(wakes()).toEqual([]);
  });

  test("a session that asked is due a wake once answered, and not before", () => {
    const { ref } = ask({ wake: ADDRESS });
    expect(wakes()).toEqual([]);
    answer(ref);
    expect(wakes()).toEqual([ref]);
  });

  test("a session can opt in later", () => {
    const { ref } = ask();
    h.call(c.decisionWake, { ref, address: ADDRESS }, ASKER);
    answer(ref);
    expect(wakes()).toEqual([ref]);
  });

  test("a session can change its mind", () => {
    const { ref } = ask({ wake: ADDRESS });
    h.call(c.decisionWake, { ref, address: null }, ASKER);
    answer(ref);
    expect(wakes()).toEqual([]);
  });

  test("is one attempt: a wake is never sent twice", () => {
    const { ref } = ask({ wake: ADDRESS });
    answer(ref);
    h.call(c.decisionWoken, { ref }, "server");
    expect(wakes()).toEqual([]);
  });

  test("a failed wake is recorded, and the answer stays in the inbox", () => {
    const { ref } = ask({ wake: ADDRESS });
    answer(ref);
    h.call(c.decisionWoken, { ref, error: "No wake adapter named claude" }, "server");
    expect(wakes()).toEqual([]);
    expect(inbox()).toEqual([ref]);
    expect(h.call(c.decisionList, { query: `ref:${ref}` }, "server")[0]?.wakeError).toBe(
      "No wake adapter named claude",
    );
  });

  test("a session that already picked it up is not woken", () => {
    const { ref } = ask({ wake: ADDRESS });
    answer(ref);
    h.call(c.decisionPickup, { ref }, ASKER);
    expect(wakes()).toEqual([]);
  });

  test("a changed answer wakes the session again", () => {
    const { ref } = ask({ wake: ADDRESS });
    answer(ref);
    h.call(c.decisionWoken, { ref }, "server");
    h.call(c.decisionResolve, { ref, note: "Other way", force: true }, DEVELOPER);
    expect(wakes()).toEqual([ref]);
  });

  test.each([
    "claude",
    "claude:",
    "claude:--dangerously-skip-permissions",
    "claude:abc;rm -rf /",
    "claude:$(whoami)",
    "Claude:abc",
    ":abc",
    "../bin/sh:abc",
  ])("refuses the address %s, which could reach a command line", (wake) => {
    expect(() => ask({ wake })).toThrow();
  });

  test("a request cannot bring its own command", () => {
    const { ref } = ask();
    expect(() =>
      h.tracker.execute("decision.wake", { ref, address: ADDRESS, command: ["sh"] }, h.as),
    ).toThrow();
  });
});
