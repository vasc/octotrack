import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import { contracts as c } from "../src/contracts.ts";
import { OctoError } from "../src/errors.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";
import { memoryDriver } from "./helpers.ts";

const START = "2026-11-14T09:00:00.000Z";
const MINUTE = 60_000;
const DAY = 24 * 60;
const SITUATION = "The base is printed for the 26 mm board; the 30 mm one needs a new model.";
const OPTIONS = [
  { key: "a", label: "26 mm", description: "Print as it is." },
  { key: "b", label: "30 mm", description: "Remodel first, a day's work." },
];

function world() {
  let now = START;
  const tracker = new Tracker(memoryDriver(), () => now, {
    remoteOf: (checkout) => (checkout.startsWith("/src/panel") ? "vasc/homepanel" : null),
  });
  const dev: Caller = { actor: "dev", channel: "dashboard" };
  const agent = (name: string): Caller => ({ actor: name, channel: "cli", checkout: `/src/panel-${name}` });
  function as<I extends z.ZodType, O extends z.ZodType>(
    caller: Caller,
    contract: Contract<I, O>,
    input: z.input<I>,
  ) {
    return tracker.call(contract, input, caller);
  }
  const notices = (caller: Caller) => tracker.execute(c.agentList.name, {}, caller).notices;
  function refusal(run: () => unknown): OctoError {
    try {
      run();
    } catch (error) {
      if (error instanceof OctoError) return error;
      throw error;
    }
    throw new Error("expected a refusal");
  }
  as(dev, c.projectCreate, { key: "PANEL", name: "Home panel", repo: "vasc/homepanel" });
  as(dev, c.placeAdd, { name: "the bench" });
  as(dev, c.placeAdd, { name: "the Mac" });
  const line = as(dev, c.lineAdd, {
    title: "Sendspin enclosure",
    doneWhen: "It holds the board.",
    repos: ["PANEL"],
    where: "working",
  });
  as(dev, c.issueCreate, { project: "PANEL", title: "Model the base", line: line.ref });
  const owner = agent("panel");
  as(owner, c.agentRegister, { wake: "claude:panel" });
  as(owner, c.lineTake, { ref: line.ref });
  as(owner, c.issueClaim, { refs: ["PANEL-1"] });
  notices(owner);
  return {
    tracker,
    dev,
    agent,
    as,
    notices,
    refusal,
    line: line.ref,
    owner,
    later(minutes: number) {
      now = new Date(Date.parse(now) + minutes * MINUTE).toISOString();
    },
  };
}

describe("tasks: what only the developer can do", () => {
  test("a task has a place from the developer's list, an outcome to report, and frees the issue its filer holds", () => {
    const w = world();
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the grip",
      place: "the bench",
      outcome: "The five numbers the model assumes, in mm.",
    });
    expect([task.assignee, task.place, task.line]).toEqual(["dev", "the bench", w.line]);
    expect(
      w.as(w.dev, c.entityShow, { ref: task.ref }).links.map((link) => [link.fromRef, link.rel, link.toRef]),
    ).toContainEqual([task.ref, "blocks", "PANEL-1"]);
    expect(
      w.refusal(() => w.as(w.owner, c.taskFile, { title: "x", place: "the garage", outcome: "y" })).hint,
    ).toContain("the bench");
  });

  test("Done sends the outcome to whoever holds the freed issue; Can't do it sends why and closes it as not done", () => {
    const w = world();
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the grip",
      place: "the bench",
      outcome: "Numbers.",
    });
    w.as(w.dev, c.taskDone, { ref: task.ref, result: "41, 38, 12, 6, 3" });
    const heard = w.notices(w.owner);
    expect(heard.map((notice) => notice.kind)).toEqual(["task_done"]);
    expect(heard[0]?.body).toContain("41, 38, 12, 6, 3");
    const other = w.as(w.owner, c.taskFile, {
      title: "Test-fit",
      place: "the bench",
      outcome: "Fits or not.",
    });
    w.as(w.dev, c.taskCant, { ref: other.ref, why: "The printer is broken." });
    expect(w.notices(w.owner).map((notice) => notice.kind)).toEqual(["task_cant"]);
    expect(w.as(w.dev, c.issueList, { query: `ref:${other.ref}` })[0]?.issue.status).toBe("cancelled");
  });

  test("places are the developer's own list", () => {
    const w = world();
    expect(w.as(w.dev, c.placeList, {}).map((place) => place.name)).toEqual(["the bench", "the Mac"]);
    expect(w.refusal(() => w.as(w.owner, c.placeAdd, { name: "the garage" })).code).toBe("forbidden");
    w.as(w.dev, c.placeRemove, { name: "the Mac" });
    expect(w.as(w.dev, c.placeList, {}).map((place) => place.name)).toEqual(["the bench"]);
  });

  test("a question a task would settle waits behind it, and comes back if the task does not settle it", () => {
    const w = world();
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the grip",
      place: "the bench",
      outcome: "Numbers.",
    });
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
      waitsFor: task.ref,
    });
    expect(w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.ref)).toEqual([]);
    w.as(w.dev, c.taskDone, { ref: task.ref, result: "41 mm" });
    expect(w.as(w.dev, c.decisionQueue, {}).map((card) => card.decision.ref)).toEqual([asked.ref]);
  });
});

describe("outcome fields", () => {
  function measured(w: ReturnType<typeof world>) {
    return w.as(w.owner, c.taskFile, {
      title: "Measure the five numbers",
      place: "the bench",
      outcome: "What the model assumes, in mm.",
      fields: ["Length", "Holes"],
    });
  }

  test("a task names what to send back, and Done sends every one, with a note, to whoever holds what it frees", () => {
    const w = world();
    const task = measured(w);
    expect(task.fields).toEqual(["Length", "Holes"]);
    const done = w.as(w.dev, c.taskDone, {
      ref: task.ref,
      values: { Length: "41 mm", Holes: "38 mm" },
      result: "The flange was warped.",
    });
    expect(done.status).toBe("done");
    expect(done.result).toBe("- Length: 41 mm\n- Holes: 38 mm\n\nThe flange was warped.");
    const heard = w
      .notices(w.owner)
      .map((notice) => notice.body)
      .join(" ");
    expect(heard).toContain("Length: 41 mm; Holes: 38 mm; The flange was warped.");
  });

  test("Done says which named outcomes are missing, and refuses a name the task does not have", () => {
    const w = world();
    const task = measured(w);
    const missing = w.refusal(() => w.as(w.dev, c.taskDone, { ref: task.ref, values: { Length: "41 mm" } }));
    expect([missing.code, missing.message]).toEqual(["invalid_input", `${task.ref} still needs: Holes`]);
    const unknown = w.refusal(() =>
      w.as(w.dev, c.taskDone, { ref: task.ref, values: { Length: "41", Holes: "38", Width: "9" } }),
    );
    expect([unknown.code, unknown.message]).toEqual(["invalid_input", `${task.ref} asks for no Width`]);
  });

  test("a task's names are distinct, and one with none needs words to be done", () => {
    const w = world();
    expect(
      w.refusal(() =>
        w.as(w.owner, c.taskFile, {
          title: "Weigh it",
          place: "the bench",
          outcome: "Grams",
          fields: ["G", "g"],
        }),
      ).code,
    ).toBe("invalid_input");
    const plain = w.as(w.owner, c.taskFile, { title: "Weigh it", place: "the bench", outcome: "Grams" });
    expect(plain.fields).toEqual([]);
    expect(w.refusal(() => w.as(w.dev, c.taskDone, { ref: plain.ref })).code).toBe("invalid_input");
    expect(w.as(w.dev, c.taskDone, { ref: plain.ref, result: "212 g" }).result).toBe("212 g");
  });

  test("a name is one line, with no = or :, so it is answered from the CLI and read as one row", () => {
    const w = world();
    for (const name of ["Length\n- Holes: 99", "A=B", "Holes: 38"]) {
      const refusal = w.refusal(() =>
        w.as(w.owner, c.taskFile, { title: "Measure", place: "the bench", outcome: "mm", fields: [name] }),
      );
      expect(refusal.code).toBe("invalid_input");
      expect(refusal.message).toContain("one line");
    }
  });

  test("a value is one line, so the list sends each name once; the note is said on one line", () => {
    const w = world();
    const task = measured(w);
    const refusal = w.refusal(() =>
      w.as(w.dev, c.taskDone, { ref: task.ref, values: { Length: "41\n- Holes: 99", Holes: "38" } }),
    );
    expect([refusal.code, refusal.message]).toEqual([
      "invalid_input",
      `${task.ref}'s Length must be one line`,
    ]);
    const done = w.as(w.dev, c.taskDone, {
      ref: task.ref,
      values: { Length: "41", Holes: "38" },
      result: "Warped.\nSanded it flat.",
    });
    expect(done.result).toBe("- Length: 41\n- Holes: 38\n\nWarped.\nSanded it flat.");
    const said = w.notices(w.owner).map((notice) => notice.body);
    expect(said.some((body) => body.includes("Length: 41; Holes: 38; Warped. Sanded it flat."))).toBe(true);
    expect(said.every((body) => !body.includes("\n"))).toBe(true);
    const plain = w.as(w.owner, c.taskFile, { title: "Weigh it", place: "the bench", outcome: "Grams" });
    w.as(w.dev, c.taskDone, { ref: plain.ref, result: "212 g,\nwith the lid" });
    expect(w.as(w.dev, c.feedList, { query: `ref:${plain.ref} event:task.done` }).events[0]?.summary).toBe(
      `${plain.ref} done: 212 g, with the lid`,
    );
  });

  test("Done matches the names whatever their case, as filing does", () => {
    const w = world();
    const task = measured(w);
    expect(w.as(w.dev, c.taskDone, { ref: task.ref, values: { length: "41", HOLES: "38" } }).result).toBe(
      "- Length: 41\n- Holes: 38",
    );
    const twice = measured(w);
    expect(
      w.refusal(() =>
        w.as(w.dev, c.taskDone, { ref: twice.ref, values: { length: "41", Length: "42", Holes: "38" } }),
      ).message,
    ).toBe(`${twice.ref}'s Length is given twice`);
  });

  test("the developer's own task is done without words", () => {
    const w = world();
    const mine = w.as(w.dev, c.lineAdd, { title: "Tax", doneWhen: "Filed.", repos: [], where: "working" });
    const task = w.as(w.dev, c.taskAdd, { line: mine.ref, title: "Scan the receipts" });
    expect(w.as(w.dev, c.taskDone, { ref: task.ref }).result).toBe("Done");
  });
});

describe("held work on lines not being worked on", () => {
  test("is current for 7 days after it was asked or re-confirmed, and the next scoper re-confirms the rest", () => {
    const w = world();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    w.as(w.dev, c.lineQueue, { ref: w.line });
    let held = w.as(w.dev, c.heldList, { line: w.line });
    expect(held.map((item) => [item.ref, item.current])).toEqual([[asked.ref, true]]);
    w.later(8 * DAY);
    held = w.as(w.dev, c.heldList, { line: w.line });
    expect(held.map((item) => [item.ref, item.current])).toEqual([[asked.ref, false]]);

    const scoper = w.agent("garden");
    w.as(scoper, c.agentRegister, { repo: "PANEL" });
    const taken = w.tracker.execute(c.lineTake.name, { ref: w.line }, scoper);
    expect(taken.notices.map((notice) => notice.body).join(" ")).toContain(
      `re-confirm or withdraw: ${asked.ref}`,
    );
    w.as(scoper, c.heldConfirm, { refs: [asked.ref] });
    expect(w.as(w.dev, c.heldList, { line: w.line })[0]?.current).toBe(true);
  });
});

describe("re-confirming, on home", () => {
  test("counts held work older than 7 days on an up-next or working line until an agent re-confirms it", () => {
    const w = world();
    const reconfirming = () => w.as(w.dev, c.homeShow, {}).lines[w.line]?.reconfirming;
    w.as(w.owner, c.decisionAsk, { title: "Which board?", context: SITUATION, options: OPTIONS });
    w.as(w.dev, c.lineQueue, { ref: w.line });
    expect(reconfirming()).toBe(0);
    w.later(8 * DAY);
    w.as(w.owner, c.decisionAsk, { title: "Which plug?", context: SITUATION, options: OPTIONS });
    expect(reconfirming()).toBe(1);

    w.as(w.dev, c.lineStart, { ref: w.line });
    expect(reconfirming()).toBe(1);
    const owner = w.agent("garden");
    w.as(owner, c.agentRegister, { repo: "PANEL" });
    w.tracker.execute(c.lineTake.name, { ref: w.line }, owner);
    const stale = w.as(w.dev, c.heldList, { line: w.line }).filter((item) => !item.current);
    w.as(owner, c.heldConfirm, { refs: stale.map((item) => item.ref) });
    expect(reconfirming()).toBe(0);
  });

  test("a tabled line's held work is not being re-confirmed: nobody may work on it", () => {
    const w = world();
    w.as(w.owner, c.decisionAsk, { title: "Which board?", context: SITUATION, options: OPTIONS });
    w.as(w.dev, c.lineTable, { ref: w.line, reason: "Not now" });
    w.later(8 * DAY);
    expect(w.as(w.dev, c.homeShow, {}).lines[w.line]?.reconfirming).toBe(0);
  });
});

describe("summaries stay true", () => {
  test("fall due an hour after significant work, as drift for the owner, and clear when rewritten", () => {
    const w = world();
    w.as(w.owner, c.issueUpdate, { refs: ["PANEL-1"], status: "done" });
    const due = () => w.as(w.dev, c.driftList, { query: "rule:summary-due status:open" });
    expect(due()).toEqual([]);
    w.later(61);
    w.tracker.sweep();
    expect(due().map((drift) => [drift.target, drift.assignee])).toEqual([[w.line, "panel"]]);
    expect(
      w.refusal(() => w.as(w.agent("helper"), c.lineSummarize, { ref: w.line, headline: "x", summary: "y" }))
        .code,
    ).toBe("forbidden");
    w.as(w.owner, c.lineSummarize, {
      ref: w.line,
      headline: "The base is modelled; the board choice is next.",
      summary: "## Where it stands\n\nThe base is modelled to 26 mm.",
    });
    w.tracker.sweep();
    expect(due()).toEqual([]);
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.headline).toBe(
      "The base is modelled; the board choice is next.",
    );
  });
});

describe("changes since the summary, on home", () => {
  test("counts what happened on a line after its summary, and nothing for a line never summarized", () => {
    const w = world();
    const since = () => w.as(w.dev, c.homeShow, {}).lines[w.line]?.sinceSummary;
    w.as(w.owner, c.issueUpdate, { refs: ["PANEL-1"], title: "Model the base" });
    expect(since()).toBe(0);
    w.later(1);
    w.as(w.owner, c.lineSummarize, { ref: w.line, headline: "The base is modelled.", summary: "Modelled." });
    expect(since()).toBe(0);
    w.later(1);
    w.as(w.owner, c.issueUpdate, { refs: ["PANEL-1"], status: "done" });
    w.as(w.owner, c.decisionAsk, { title: "Which board?", context: SITUATION, options: OPTIONS });
    expect(since()).toBe(2);
  });
});

describe("done when and done are the developer's to accept", () => {
  test("an owner proposes a new done when, and the developer accepts or keeps the old one", () => {
    const w = world();
    w.as(w.owner, c.lineDoneWhen, { ref: w.line, doneWhen: "It holds the board and the USB-C plug." });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneWhen).toBe("It holds the board.");
    w.as(w.dev, c.lineDoneWhenAnswer, { ref: w.line, accept: true });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneWhen).toBe(
      "It holds the board and the USB-C plug.",
    );
    expect(w.notices(w.owner).map((notice) => [notice.kind, notice.wakes])).toEqual([["done_when", false]]);
  });

  test("on an up-next line a scoper's done when waits, with why, for the Start sheet; on its own proposal it is written", () => {
    const w = world();
    const queued = w.as(w.dev, c.lineAdd, {
      title: "Firmware without casts",
      doneWhen: "It builds with the no-casts rule on.",
      repos: ["PANEL"],
      where: "up_next",
    });
    const scoper = { actor: "scoper", channel: "cli" } as const;
    w.as(scoper, c.agentRegister, { repo: "PANEL" });
    w.as(scoper, c.lineTake, { ref: queued.ref });
    w.as(scoper, c.lineDoneWhen, {
      ref: queued.ref,
      doneWhen: "It builds with the rule on, and CI fails on a new cast.",
      why: "Without CI, casts creep back.",
    });
    const line = w.as(w.dev, c.lineShow, { ref: queued.ref }).line;
    expect(line.doneWhen).toBe("It builds with the no-casts rule on.");
    expect([line.doneWhenProposal, line.doneWhenWhy]).toEqual([
      "It builds with the rule on, and CI fails on a new cast.",
      "Without CI, casts creep back.",
    ]);
    const proposed = w.as(scoper, c.linePropose, {
      title: "Cast audit",
      doneWhen: "Listed.",
      repos: ["PANEL"],
      recommendation: "up_next",
      why: "Casts keep coming back.",
    });
    w.as(scoper, c.lineDoneWhen, { ref: proposed.ref, doneWhen: "Listed, with each one's fix." });
    expect(w.as(w.dev, c.lineShow, { ref: proposed.ref }).line.doneWhen).toBe("Listed, with each one's fix.");
  });

  test("an owner proposes done; the developer finishes the line or says not yet", () => {
    const w = world();
    w.as(w.owner, c.lineProposeDone, { ref: w.line, why: "Printed, fitted, and in use." });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneProposal).toBe("Printed, fitted, and in use.");
    w.as(w.dev, c.lineNotYet, { ref: w.line, why: "The plug does not fit yet." });
    expect(w.as(w.dev, c.lineShow, { ref: w.line }).line.doneProposal).toBeNull();
    const heard = w.notices(w.owner);
    expect(heard.map((notice) => notice.kind)).toEqual(["not_yet"]);
    expect(heard[0]?.body).toContain("The plug does not fit yet.");
  });
});

describe("a line the developer owns", () => {
  test("winds its agents down, takes no owner, refuses agent writes, and goes back with Hand to an agent", () => {
    const w = world();
    w.as(w.dev, c.lineOwn, { ref: w.line });
    expect(w.notices(w.owner).map((notice) => notice.kind)).toEqual(["wind_down"]);
    w.later(16);
    w.tracker.sweep();
    expect(w.as(w.dev, c.homeShow, {}).crews[w.line]).toBeUndefined();
    expect(w.refusal(() => w.as(w.owner, c.lineTake, { ref: w.line })).message).toContain("the developer's");
    w.as(w.dev, c.lineHand, { ref: w.line });
    // Its last owner wound down rather than left, so it is offered the line first.
    expect(w.as(w.dev, c.homeShow, {}).crews[w.line]?.search?.step).toBe(1);
    expect(w.notices(w.owner).map((notice) => notice.kind)).toContain("owner_offer");
  });
});

describe("folding carries whether questions and tasks are held", () => {
  test("into a working line, current ones reach the developer at once", () => {
    const w = world();
    const waiting = w.as(w.dev, c.lineAdd, {
      title: "Lid",
      doneWhen: "It closes.",
      repos: ["PANEL"],
      where: "up_next",
    });
    const scoper = w.agent("scout");
    w.as(scoper, c.agentRegister, { repo: "PANEL" });
    w.as(scoper, c.lineTake, { ref: waiting.ref });
    const asked = w.as(scoper, c.decisionAsk, {
      title: "Which hinge?",
      context: SITUATION,
      options: OPTIONS,
    });
    const task = w.as(scoper, c.taskFile, {
      title: "Measure the lid",
      place: "the bench",
      outcome: "Its width",
    });
    w.as(w.dev, c.lineFold, { ref: waiting.ref, into: w.line });
    const home = w.as(w.dev, c.homeShow, {});
    expect(
      home.lines[w.line]?.forYou.map((item) =>
        item.kind === "question" ? item.card.decision.ref : item.kind === "task" ? item.task.ref : item.kind,
      ),
    ).toEqual([asked.ref, task.ref]);
    expect([home.counts.toAnswer, home.counts.toDo, home.lines[w.line]?.reconfirming]).toEqual([1, 1, 0]);
  });

  test("into an up-next line, they are held, and any gone stale is re-confirmed before it reaches the developer", () => {
    const w = world();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    const waiting = w.as(w.dev, c.lineAdd, {
      title: "Lid",
      doneWhen: "It closes.",
      repos: ["PANEL"],
      where: "up_next",
    });
    w.as(w.dev, c.lineFold, { ref: w.line, into: waiting.ref });
    expect(w.as(w.dev, c.homeShow, {}).counts.toAnswer).toBe(0);
    w.later(8 * DAY);
    expect(w.as(w.dev, c.homeShow, {}).lines[waiting.ref]?.reconfirming).toBe(1);
    w.as(w.dev, c.lineStart, { ref: waiting.ref });
    const home = w.as(w.dev, c.homeShow, {});
    expect([home.counts.toAnswer, home.lines[waiting.ref]?.reconfirming]).toEqual([0, 1]);
    expect(w.as(w.dev, c.heldList, { line: waiting.ref }).map((item) => [item.ref, item.current])).toEqual([
      [asked.ref, false],
    ]);
  });
});

describe("the agents' questions and tasks on a line the developer owns", () => {
  test("are held for an agent: counted as held, never as to answer, to do or re-confirming", () => {
    const w = world();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    const task = w.as(w.owner, c.taskFile, {
      title: "Measure the grip",
      place: "the bench",
      outcome: "In mm",
    });
    w.as(w.dev, c.lineOwn, { ref: w.line });
    const late = w.as(w.owner, c.decisionAsk, { title: "Which plug?", context: SITUATION, options: OPTIONS });
    const mine = w.as(w.dev, c.taskAdd, { line: w.line, title: "Sand the lid" });
    w.later(8 * DAY);
    const home = w.as(w.dev, c.homeShow, {});
    const line = home.lines[w.line];
    expect(line?.forYou.map((item) => (item.kind === "task" ? item.task.ref : item.kind))).toEqual([
      mine.ref,
    ]);
    expect([line?.held, line?.reconfirming]).toEqual([{ questions: 2, tasks: 1 }, 0]);
    expect([home.counts.toAnswer, home.counts.toDo]).toEqual([0, 1]);
    expect(w.as(w.dev, c.heldList, { line: w.line }).map((item) => item.ref)).toEqual([
      asked.ref,
      late.ref,
      task.ref,
      mine.ref,
    ]);
  });

  test("handed back, current ones reach the developer again; the developer's own tasks were never held", () => {
    const w = world();
    const asked = w.as(w.owner, c.decisionAsk, {
      title: "Which board?",
      context: SITUATION,
      options: OPTIONS,
    });
    w.as(w.dev, c.lineOwn, { ref: w.line });
    const mine = w.as(w.dev, c.taskAdd, { line: w.line, title: "Sand the lid" });
    w.later(DAY);
    w.as(w.dev, c.lineHand, { ref: w.line });
    w.as(w.dev, c.lineOwn, { ref: w.line });
    const owned = w.as(w.dev, c.homeShow, {});
    expect(
      owned.lines[w.line]?.forYou.map((item) => (item.kind === "task" ? item.task.ref : item.kind)),
    ).toEqual([mine.ref]);
    w.as(w.dev, c.lineHand, { ref: w.line });
    const handed = w.as(w.dev, c.homeShow, {});
    expect(
      handed.lines[w.line]?.forYou.map((item) =>
        item.kind === "question" ? item.card.decision.ref : item.kind === "task" ? item.task.ref : item.kind,
      ),
    ).toEqual([asked.ref, mine.ref]);
  });
});

describe("a line waits on the developer", () => {
  test("only for what reaches them: held questions waiting to be re-confirmed wait on an agent", () => {
    const w = world();
    w.as(w.owner, c.decisionAsk, { title: "Which board?", context: SITUATION, options: OPTIONS });
    w.as(w.dev, c.issueUpdate, { refs: ["PANEL-1"], status: "done" });
    expect(w.as(w.dev, c.homeShow, {}).lines[w.line]?.waitingOnYou).toBe(true);
    w.as(w.dev, c.lineQueue, { ref: w.line });
    w.later(8 * DAY);
    w.as(w.dev, c.lineStart, { ref: w.line });
    const line = w.as(w.dev, c.homeShow, {}).lines[w.line];
    expect([line?.reconfirming, line?.waitingOnYou]).toEqual([1, false]);
  });
});

describe("taking a line names what waits to be re-confirmed", () => {
  test("only what is held: an old question that reaches the developer already needs nobody's re-confirmation", () => {
    const w = world();
    w.as(w.owner, c.decisionAsk, { title: "Which board?", context: SITUATION, options: OPTIONS });
    w.later(8 * DAY);
    const helper = w.agent("garden");
    w.as(helper, c.agentRegister, { repo: "PANEL" });
    const taken = w.tracker.execute(c.lineTake.name, { ref: w.line }, helper);
    expect(taken.notices.map((notice) => notice.kind)).not.toContain("held_stale");
  });
});
