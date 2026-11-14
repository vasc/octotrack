import { describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

function world() {
  let now = "2026-11-14T09:00:00.000Z";
  const tracker = new Tracker(memoryDriver(), () => now);
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const line = tracker.call(c.lineAdd, { title: "Wall mount", doneWhen: "It hangs.", where: "up_next" }, dev);
  const state = () => tracker.call(c.lineShow, { ref: line.ref }, dev).line.state;
  return {
    tracker,
    dev,
    line,
    state,
    later(ms: number) {
      now = new Date(Date.parse(now) + ms).toISOString();
    },
  };
}

describe("every choice waits a few seconds with Undo", () => {
  test("a choice takes effect only once its time is up, applied by the tracker itself", () => {
    const w = world();
    const choice = w.tracker.call(
      c.choiceMake,
      { op: "line.start", input: { ref: w.line.ref }, summary: "Started Wall mount", delayMs: 5000 },
      w.dev,
    );
    expect(choice.state).toBe("pending");
    expect(w.state()).toBe("up_next");
    w.later(5001);
    w.tracker.applyDueChoices();
    expect(w.state()).toBe("working");
    expect(w.tracker.call(c.choiceList, {}, w.dev)).toEqual([]);
  });

  test("Undo before the time is up means it never happened", () => {
    const w = world();
    const choice = w.tracker.call(
      c.choiceMake,
      { op: "line.start", input: { ref: w.line.ref }, summary: "Started Wall mount" },
      w.dev,
    );
    expect(w.tracker.call(c.choiceUndo, { id: choice.id }, w.dev).state).toBe("undone");
    w.later(60_000);
    w.tracker.applyDueChoices();
    expect(w.state()).toBe("up_next");
  });

  test("Now applies it at once, and one that fails says why", () => {
    const w = world();
    const choice = w.tracker.call(
      c.choiceMake,
      { op: "line.start", input: { ref: w.line.ref }, summary: "Started Wall mount" },
      w.dev,
    );
    expect(w.tracker.call(c.choiceNow, { id: choice.id }, w.dev).state).toBe("applied");
    expect(w.state()).toBe("working");
    const doomed = w.tracker.call(
      c.choiceMake,
      { op: "line.reject", input: { ref: w.line.ref }, summary: "Not a line" },
      w.dev,
    );
    const failed = w.tracker.call(c.choiceNow, { id: doomed.id }, w.dev);
    expect(failed.state).toBe("failed");
    expect(failed.error).toContain("cannot be rejected");
  });

  test("the draft a choice was typed in is kept through Undo and deleted once it takes effect", () => {
    const w = world();
    const draft = (key: string) => w.tracker.call(c.draftGet, { key }, w.dev).text;
    w.tracker.call(c.draftSave, { key: "tell:L-1", text: "Black, please." }, w.dev);
    const undone = w.tracker.call(
      c.choiceMake,
      { op: "line.start", input: { ref: w.line.ref }, summary: "Started", draft: "tell:L-1" },
      w.dev,
    );
    w.tracker.call(c.choiceUndo, { id: undone.id }, w.dev);
    expect(draft("tell:L-1")).toBe("Black, please.");
    const applied = w.tracker.call(
      c.choiceMake,
      { op: "line.start", input: { ref: w.line.ref }, summary: "Started", draft: "tell:L-1" },
      w.dev,
    );
    w.tracker.call(c.choiceNow, { id: applied.id }, w.dev);
    expect(draft("tell:L-1")).toBeNull();
  });

  test("a choice that fails keeps its draft, so the words can be sent again", () => {
    const w = world();
    w.tracker.call(c.draftSave, { key: "own:L-1", text: "Bought the board" }, w.dev);
    const doomed = w.tracker.call(
      c.choiceMake,
      { op: "line.reject", input: { ref: w.line.ref }, summary: "Not a line", draft: "own:L-1" },
      w.dev,
    );
    expect(w.tracker.call(c.choiceNow, { id: doomed.id }, w.dev).state).toBe("failed");
    expect(w.tracker.call(c.draftGet, { key: "own:L-1" }, w.dev).text).toBe("Bought the board");
  });

  test("only the developer's own operations can wait, and only the developer makes them", () => {
    const w = world();
    const refusal = (run: () => unknown) => {
      try {
        run();
      } catch (error) {
        if (error instanceof OctoError) return error.code;
      }
      return null;
    };
    expect(
      refusal(() => w.tracker.call(c.choiceMake, { op: "line.list", input: {}, summary: "x" }, w.dev)),
    ).toBe("invalid_input");
    expect(
      refusal(() =>
        w.tracker.call(
          c.choiceMake,
          { op: "line.start", input: { ref: w.line.ref }, summary: "x" },
          { actor: "agent-a", channel: "cli" },
        ),
      ),
    ).toBe("forbidden");
  });
});

describe("drafts", () => {
  test("are kept as they are typed, read back anywhere, and cleared when empty", () => {
    const w = world();
    w.tracker.call(c.draftSave, { key: "task:OCT-7", text: "41, 38" }, w.dev);
    expect(w.tracker.call(c.draftGet, { key: "task:OCT-7" }, w.dev).text).toBe("41, 38");
    w.tracker.call(c.draftSave, { key: "task:OCT-7", text: "" }, w.dev);
    expect(w.tracker.call(c.draftGet, { key: "task:OCT-7" }, w.dev).text).toBeNull();
  });
});

describe("a choice that failed", () => {
  test("stays listed with why until it is dismissed", () => {
    const w = world();
    const doomed = w.tracker.call(
      c.choiceMake,
      { op: "line.reject", input: { ref: w.line.ref }, summary: "Not a line" },
      w.dev,
    );
    w.later(6000);
    w.tracker.applyDueChoices();
    const listed = w.tracker.call(c.choiceList, {}, w.dev);
    expect(listed.map((choice) => [choice.id, choice.state])).toEqual([[doomed.id, "failed"]]);
    expect(listed[0]?.error).toContain("cannot be rejected");
    w.tracker.call(c.choiceUndo, { id: doomed.id }, w.dev);
    expect(w.tracker.call(c.choiceList, {}, w.dev)).toEqual([]);
  });
});

describe("what a waiting choice is about", () => {
  test("names its ref, or the line a Try now is for, so home can hold that item still", () => {
    const w = world();
    const start = w.tracker.call(
      c.choiceMake,
      { op: "line.start", input: { ref: w.line.ref }, summary: "Starting" },
      w.dev,
    );
    const retry = w.tracker.call(
      c.choiceMake,
      { op: "runner.retry", input: { line: w.line.ref, same: true }, summary: "Trying again" },
      w.dev,
    );
    const tell = w.tracker.call(
      c.choiceMake,
      { op: "line.tell", input: { line: w.line.ref, body: "Hi" }, summary: "Telling" },
      w.dev,
    );
    expect([start.ref, retry.ref, tell.ref]).toEqual([w.line.ref, w.line.ref, null]);
  });
});

describe("drafts follow the developer between devices", () => {
  test("a draft save sends a notice naming only its key, and refreshes nothing else", () => {
    const w = world();
    const drafts: string[] = [];
    let changes = 0;
    w.tracker.onDraft((key) => drafts.push(key));
    w.tracker.subscribe(() => {
      changes += 1;
    });
    w.tracker.call(c.draftSave, { key: "tell:L-1", text: "Black" }, w.dev);
    expect(drafts).toEqual(["tell:L-1"]);
    expect(changes).toBe(0);
  });
});
