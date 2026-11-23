import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { LineActions } from "../src/components/entity/LineActions.tsx";
import { LinePanelHead } from "../src/components/entity/LinePanelHead.tsx";
import { LineStanding } from "../src/components/entity/LineStanding.tsx";
import { OwnerBox } from "../src/components/entity/OwnerBox.tsx";
import { PanelForYou } from "../src/components/entity/PanelForYou.tsx";
import { OwnWorkBox } from "../src/components/entity/OwnWorkBox.tsx";
import { type PlanActions, PlanList } from "../src/components/entity/PlanList.tsx";
import { BranchEditSheet } from "../src/components/lines/BranchEditSheet.tsx";
import { PromoteSheet } from "../src/components/lines/PromoteSheet.tsx";
import { SinceSummary } from "../src/components/entity/SinceSummary.tsx";
import { SummaryBox } from "../src/components/entity/SummaryBox.tsx";
import { TellBox } from "../src/components/entity/TellBox.tsx";
import { Panel } from "../src/components/ui/Panel.tsx";
import { event, line, planBranch, planStep } from "../src/design/fixtures.ts";
import type { PlanStep } from "@octotrack/core/schemas";
import { homeActions, iconsIn, whole } from "./harness.tsx";

const NOW = Date.parse("2026-11-16T12:00:00Z");

describe("the line's head", () => {
  test("its crumbs are its state, ref and repos, with no place in an order", () => {
    const view = render(
      <LinePanelHead line={line({ ref: "L-3", state: "up_next" })} repos={["acme/hydra"]} now={NOW} />,
    );
    view.getByText("Up next");
    view.getByText("L-3");
    view.getByText("acme/hydra");
    expect(view.queryByText(/of \d+/)).toBeNull();
  });

  test("a line the developer owns says it is theirs", () => {
    const view = render(<LinePanelHead line={line({ ownedBy: "dev" })} repos={[]} now={NOW} />);
    view.getByText("yours");
  });

  test("a line with nothing to say under its title draws nothing there, not an empty block", () => {
    const view = render(
      <LineStanding line={line({ doneWhen: "The worker runs on ECS." })} withDoneWhen={false} />,
    );
    expect(view.container.innerHTML).toBe("");
  });

  test("Done when is a label over its sentence", () => {
    const view = render(
      <LinePanelHead line={line({ doneWhen: "The worker runs on ECS." })} repos={[]} now={NOW} />,
    );
    const label = view.getByText("Done when");
    expect(label.textContent).toBe("Done when");
    view.getByText("The worker runs on ECS.");
  });

  test("a proposal says who proposed it and when, and what they recommend and why, above its moves", () => {
    const view = render(
      <LinePanelHead
        line={line({
          state: "proposed",
          proposedBy: "video-agent",
          createdAt: "2026-11-14T12:00:00Z",
          recommendation: "start",
          recommendationWhy: "YouTube has refused the home worker since 14 Nov.",
        })}
        repos={["VIDEO"]}
        now={NOW}
      />,
    );
    view.getByText(whole("Proposed by video-agent, 2d ago"));
    view.getByText("Recommended: start it.");
    view.getByText(/YouTube has refused the home worker/);
  });

  test("a tabled line says why it waits, when to look again and what it holds, at the top", () => {
    const view = render(
      <LinePanelHead
        line={line({
          state: "tabled",
          tabledReason: "the play-test of v1.3 first",
          lookAgainAt: "2026-12-01",
        })}
        repos={[]}
        held={{ questions: 1, tasks: 2 }}
        now={NOW}
      />,
    );
    view.getByText("Waits for");
    view.getByText("the play-test of v1.3 first");
    view.getByText("Look again");
    view.getByText("Held");
    view.getByText("1 question, 2 tasks, released when it starts");
  });

  test("a done line says so in its peek, whose moves are on its page", () => {
    const view = render(<LinePanelHead line={line({ state: "done" })} repos={[]} now={NOW} />);
    view.getByText("Done");
    expect(view.queryByRole("button", { name: "Start" })).toBeNull();
  });
});

describe("the panel", () => {
  test("Close shuts it, and opened from another peek the way back names that one", () => {
    const onClose = mock(() => {});
    const onBack = mock(() => {});
    const view = render(
      <Panel title="L-1" onClose={onClose} back={{ label: "Speaker enclosure", onBack }} />,
    );
    const back = view.getByRole("button", { name: "Back to Speaker enclosure" });
    expect(back.textContent).toBe("Speaker enclosure");
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    // Close is the cross alone, named for a screen reader.
    const close = view.getByRole("button", { name: "Close" });
    expect(iconsIn(close)).toEqual(["cross"]);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a peek with a page of its own offers it, as a link that Cmd opens in a new tab", () => {
    const onGo = mock((_href: string) => {});
    const view = render(
      <Panel title="Speaker enclosure" onClose={() => {}} page={{ href: "/lines/L-2", onGo }} />,
    );
    const page = view.getByRole("link", { name: "Open the full page" });
    expect(page.getAttribute("href")).toBe("/lines/L-2");
    fireEvent.click(page);
    expect(onGo).toHaveBeenCalledWith("/lines/L-2");
  });
});

describe("a working line's moves", () => {
  test("Done comes first, then Move to up next, Table and More", () => {
    const view = render(
      <LineActions line={line({ state: "working" })} onChoose={() => {}} onTable={() => {}} />,
    );
    const names = view.getAllByRole("button").map((button) => button.textContent);
    expect(names.slice(0, 3)).toEqual(["Done", "Move to up next", "Table"]);
  });
});

describe("SummaryBox", () => {
  test("says how old the summary is, the headline in bold, then the rest", () => {
    const view = render(
      <SummaryBox
        line={line({
          headline: "Production UK runs on ECS.",
          summary: "Steps 1–3 merged.",
          summaryAt: "2026-11-16T10:00:00Z",
        })}
        now={NOW}
      />,
    );
    view.getByText("2h ago");
    expect(view.getByText("Production UK runs on ECS.").closest("strong")).not.toBeNull();
    view.getByText("Steps 1–3 merged.");
  });

  test("with none yet, says who writes one", () => {
    const view = render(<SummaryBox line={line({ state: "up_next" })} now={NOW} />);
    view.getByText("No summary yet. Its owner writes one once the line starts.");
  });
});

describe("PlanList", () => {
  const work = (ref: string) => ({
    ref,
    title: `Work ${ref}`,
    status: "todo" as const,
    step: null,
    assignee: null,
    prs: [],
  });

  test("not scoped: says so and how much work is already on it, under Not on a step yet", () => {
    const view = render(<PlanList steps={[]} work={[work("KECS-1"), work("KECS-2")]} />);
    view.getByText(whole("not scoped yet · 2 issues already on it"));
    view.getByText("Not on a step yet");
  });

  test("with nothing at all, says who writes the plan, as the line stands", () => {
    render(<PlanList steps={[]} work={[]} state="up_next" />).getByText(
      "No plan yet. Its owner writes one once it starts.",
    );
    render(<PlanList steps={[]} work={[]} state="working" />).getByText("No plan yet. Its owner writes one.");
    render(<PlanList steps={[]} work={[]} state="done" />).getByText("No plan was written.");
  });

  test("an issue reads its ref and state in words, its pull requests by number with their checks; on a phone merged ones fold", () => {
    const pr = (number: number, state: "open" | "merged", checks: "failing" | "passing") => ({
      ref: `PR-${number}`,
      repo: "acme/worker",
      number,
      state,
      checks,
    });
    const view = render(
      <PlanList
        foldMerged
        steps={[planStep({ position: 1, title: "Build the image", status: "doing" })]}
        work={[
          { ...work("KECS-1"), step: 1, prs: [pr(418, "open", "failing")] },
          {
            ...work("KECS-2"),
            step: 1,
            status: "in_progress" as const,
            prs: [pr(401, "merged", "passing"), pr(402, "merged", "passing"), pr(403, "merged", "passing")],
          },
        ]}
      />,
    );
    // Facts are drawn with a dot between them; each is its own piece.
    view.getByText("to do");
    const failing = view.getByText(whole("#418 open · checks failing"));
    expect(iconsIn(failing)).toEqual(["cross"]);
    view.getByText("in progress");
    expect(iconsIn(view.getByText("3 pull requests merged").parentElement ?? view.container)).toContain(
      "check",
    );
    expect(view.queryByText(/worker#/)).toBeNull();
  });

  const noActions = (): PlanActions => ({
    onStatus: mock(() => {}),
    onHoldsUp: mock(() => {}),
    onEdit: mock(() => {}),
    onPromote: mock(() => {}),
    onRemove: mock(() => {}),
  });

  test("each step's status is set from a menu on it, the status in force ticked, on any line", () => {
    const onStatus = mock((_step: PlanStep, _status: "todo" | "doing" | "done") => {});
    const steps = [
      planStep({ position: 1, title: "Model", status: "done" }),
      planStep({ position: 2, title: "Print" }),
      planStep({ position: 3, title: "Photograph", status: "doing" }),
    ];
    const view = render(<PlanList steps={steps} work={[]} actions={{ ...noActions(), onStatus }} />);
    // The step under way is the line's current one, even with an earlier one still to do.
    view.getByText("step 3 of 3");
    view.getByRole("button", { name: "Step 1, Model: done" });
    view.getByRole("button", { name: "Step 3, Photograph: under way" });
    fireEvent.click(view.getByRole("button", { name: "Step 2, Print: to do" }));
    const menu = within(view.getByRole("menu", { name: "Step 2's status" }));
    expect(menu.getByRole("menuitemradio", { name: "To do" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Done" }));
    // By the step itself, so its id goes with it: addresses shift as steps come and go.
    expect(onStatus).toHaveBeenCalledWith(steps[1], "done");
    view.unmount();

    const busy = render(
      <PlanList
        steps={steps}
        work={[]}
        actions={{ ...noActions(), busy: "2", failed: { at: "1", message: "the tracker did not answer" } }}
      />,
    );
    const pending = busy.getByRole("button", { name: "Step 2, Print: to do" });
    expect(pending.hasAttribute("disabled")).toBe(true);
    // The mark says it is on its way; it has no words to give way to "Changing…".
    expect(pending.getAttribute("aria-busy")).toBe("true");
    const refused = busy.getByText("Not changed: the tracker did not answer");
    // Said from the mark's start, so it runs into the plan rather than off its left edge.
    expect(refused.closest(".ui-menu")?.getAttribute("data-align")).toBe("start");
    busy.unmount();

    // A line that ended keeps its menus: it can be reopened, and its plan with it.
    const ended = render(<PlanList steps={steps} work={[]} state="done" actions={noActions()} />);
    ended.getByRole("button", { name: "Step 1, Model: done" });
  });

  /** Model, Print, Hang it; off Print, branch 2a holds up step 3 with two steps and an issue, and 2b became L-12. */
  const tree = () => {
    const steps = [
      planStep({ position: 1, title: "Model", status: "done" }),
      planStep({ position: 2, title: "Print", status: "doing" }),
      planStep({ id: 21, branch: 100, position: 1, address: "2a.1", title: "Pick a board", status: "done" }),
      planStep({ id: 22, branch: 100, position: 2, address: "2a.2", title: "Order it" }),
      planStep({ position: 3, title: "Hang it" }),
    ];
    const branches = [
      planBranch({ id: 100, fromStep: 2, address: "2a", title: "Breakout", holdsUp: "3" }),
      planBranch({
        id: 101,
        fromStep: 2,
        position: 2,
        address: "2b",
        title: "Wall bracket",
        holdsUp: "3",
        became: { ref: "L-12", title: "Wall bracket", state: "tabled" },
      }),
    ];
    return { steps, branches, work: [{ ...work("PANEL-9"), step: 22 }] };
  };

  test("a branch hangs on a rail under the step it forks from, with its own steps, now and issues", () => {
    const { steps, branches, work: items } = tree();
    const view = render(<PlanList steps={steps} branches={branches} work={items} actions={noActions()} />);
    view.getByText("step 2 of 3 · 2 branches open");
    const rail = within(view.getByRole("group", { name: "Branch 2a, Breakout" }));
    rail.getByText("holds up step 3");
    rail.getByText("1 of 2 done");
    rail.getByRole("button", { name: "Step 2a.2, Order it: to do" });
    rail.getByText("PANEL-9");
    // It hangs on an elbow from its step, in the step's own words, not a row of its own.
    expect(rail.getByText("Breakout").closest(".ui-step-branch")).not.toBeNull();
    // The branch's own now: its first step not done.
    expect(rail.getAllByText("now")).toHaveLength(1);
    // Step 3 waits on 2a, and on L-12, which is tabled and says so, in the warm tone every wait reads in.
    const hang = view.getByText("Hang it").closest(".ui-step") ?? view.container;
    expect(iconsIn(hang)).toContain("joins");
    view.getByText("waits on 2a and L-12, tabled");
  });

  test("a branch that became a line links to it, with a More that only changes its hold or removes it", () => {
    const { steps, branches, work: items } = tree();
    const actions = noActions();
    const view = render(<PlanList steps={steps} branches={branches} work={items} actions={actions} />);
    const became = within(view.getByRole("group", { name: "Branch 2b, Wall bracket" }));
    became.getByText(whole("became L-12, tabled"));
    became.getByRole("button", { name: "L-12" });
    fireEvent.click(became.getByRole("button", { name: "More: branch 2b, Wall bracket" }));
    const menu = within(view.getByRole("menu", { name: "Branch 2b" }));
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Nothing" }));
    expect(actions.onHoldsUp).toHaveBeenCalledWith(branches[1], null);
    fireEvent.click(became.getByRole("button", { name: "More: branch 2b, Wall bracket" }));
    expect(view.queryByRole("menuitem", { name: "Make it its own line…" })).toBeNull();
    expect(view.queryByRole("menuitem", { name: "Rename or change its steps…" })).toBeNull();
    fireEvent.click(view.getByRole("menuitem", { name: "Remove the branch" }));
    expect(actions.onRemove).toHaveBeenCalledWith(branches[1]);
  });

  test("a branch whose line was dropped reads ended, not what it held", () => {
    const { steps, work: items } = tree();
    const dropped = planBranch({
      id: 101,
      fromStep: 2,
      position: 2,
      address: "2b",
      title: "Wall bracket",
      holdsUp: "3",
      became: { ref: "L-12", title: "Wall bracket", state: "dropped" },
      state: "ended",
    });
    const view = render(<PlanList steps={steps} branches={[dropped]} work={items} actions={noActions()} />);
    const rail = within(view.getByRole("group", { name: "Branch 2b, Wall bracket" }));
    rail.getByText("ended");
    expect(rail.queryByText(/holds up/)).toBeNull();
  });

  test("a branch's More: what it holds up ticked, then change it, make it a line, or remove it", () => {
    const { steps, branches, work: items } = tree();
    const actions = noActions();
    const view = render(<PlanList steps={steps} branches={branches} work={items} actions={actions} />);
    fireEvent.click(view.getByRole("button", { name: "More: branch 2a, Breakout" }));
    const menu = within(view.getByRole("menu", { name: "Branch 2a" }));
    expect(menu.getByRole("menuitemradio", { name: "Step 3, Hang it" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Nothing" }));
    expect(actions.onHoldsUp).toHaveBeenCalledWith(branches[0], null);
    for (const [name, handler] of [
      ["Rename or change its steps…", actions.onEdit],
      ["Make it its own line…", actions.onPromote],
      ["Remove the branch", actions.onRemove],
    ] as const) {
      fireEvent.click(view.getByRole("button", { name: "More: branch 2a, Breakout" }));
      fireEvent.click(view.getByRole("menuitem", { name }));
      expect(handler).toHaveBeenCalledTimes(1);
    }
  });

  test("the sheets: making a branch a line asks what finishes it; changing it takes its steps one per line", () => {
    const [breakout] = tree().branches;
    if (breakout === undefined) throw new Error("the tree has branch 2a");
    const onPromote = mock(() => {});
    const promote = render(
      <PromoteSheet branch={breakout} issues={1} onPromote={onPromote} onCancel={() => {}} />,
    );
    // Opened by Return on its menu item, the same Return must land in no box: the one-line title takes the focus.
    expect(document.activeElement).toBe(promote.getByLabelText("Title"));
    promote.getByText(
      "Its steps and 1 issue move to the new line. Here it stays as a row that opens it, still holding up step 3 until that line is done.",
    );
    const make = promote.getByRole("button", { name: "Make it a line, up next" });
    expect(make.hasAttribute("disabled")).toBe(true);
    fireEvent.change(promote.getByLabelText("Done when"), { target: { value: "A board is soldered in." } });
    fireEvent.click(make);
    expect(onPromote).toHaveBeenCalledWith({
      title: "Breakout",
      doneWhen: "A board is soldered in.",
      where: "up_next",
    });
    promote.unmount();

    const onSave = mock(() => {});
    const { steps } = tree();
    const edit = render(
      <BranchEditSheet
        branch={breakout}
        steps={steps.filter((step) => step.branch === 100)}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    const box = edit.getByLabelText("Its steps, one per line");
    expect(box).toHaveProperty("value", "Pick a board\nOrder it");
    fireEvent.change(box, { target: { value: "Pick a board\n\nOrder it\nTest it" } });
    fireEvent.click(edit.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("Breakout", ["Pick a board", "Order it", "Test it"]);
  });

  test("a closed line with no summary says none was written", () => {
    render(<SummaryBox line={line({ state: "dropped" })} />).getByText("No summary was written.");
  });
});

describe("SinceSummary", () => {
  test("with no summary it is What happened, and the ones already seen open on a press", () => {
    const events = [
      event({ seq: 2, ts: "2026-11-16T11:00:00Z", summary: "Newer" }),
      event({ seq: 1, ts: "2026-11-15T11:00:00Z", summary: "Seen already" }),
    ];
    const view = render(
      <SinceSummary line="L-1" events={events} summaryAt={null} seenAt="2026-11-16T00:00:00Z" more={false} />,
    );
    view.getByRole("region", { name: /What happened/ });
    expect(view.queryByText(/Seen already/)).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Show the 1 you have seen" }));
    view.getByText(/Seen already/);
  });

  test("with nothing unseen, says so in one sentence", () => {
    const events = [event({ seq: 1, ts: "2026-11-15T11:00:00Z" })];
    const view = render(
      <SinceSummary line="L-1" events={events} summaryAt={null} seenAt="2026-11-16T00:00:00Z" more={false} />,
    );
    view.getByText(/Nothing you have not seen\./);
  });
});

describe("OwnerBox", () => {
  test("an up-next line says it has no owner until it starts, and who may scope it meanwhile", () => {
    const view = render(
      <OwnerBox
        line={line({ state: "up_next", repos: ["HYDRA"] })}
        crew={undefined}
        repoNames={["acme/hydra"]}
        onStop={() => {}}
        onOwn={() => {}}
      />,
    );
    view.getByText("None until it starts. An idle agent in acme/hydra may scope it meanwhile.");
  });
});

describe("TellBox", () => {
  test("its box says an empty message is a nudge", () => {
    const view = render(
      <TellBox line="L-1" to="worker-agent" words="" onWords={() => {}} onSend={() => {}} />,
    );
    expect(view.getByLabelText("Tell worker-agent").getAttribute("placeholder")).toBe(
      "Leave it empty to nudge",
    );
    view.getByRole("button", { name: "Nudge" });
  });
});

describe("OwnWorkBox", () => {
  test("on a line the developer owns, Hand to an agent sits beside the add buttons", () => {
    const onHand = mock((_repos: string[]) => {});
    const view = render(
      <OwnWorkBox
        line="L-33"
        words=""
        onWords={() => {}}
        onTask={() => {}}
        onNote={() => {}}
        repos={["HOME"]}
        allRepos={["HOME", "PANEL"]}
        onHand={onHand}
      />,
    );
    const add = view.getByRole("region", { name: "Add a task or a note" });
    fireEvent.click(within(add).getByRole("button", { name: "Hand to an agent" }));
    expect(onHand).toHaveBeenCalledWith([]);
  });
});

describe("the panel on a phone", () => {
  test("a peek has one head on every width: its own page and the cross that closes it", () => {
    const onClose = mock(() => {});
    const view = render(
      <Panel title="L-1" onClose={onClose} page={{ href: "/lines/L-1", onGo: () => {} }} />,
    );
    expect(view.getAllByRole("link", { name: "Open the full page" })).toHaveLength(1);
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("More is the three-dot icon on a phone, still named More", () => {
    const view = render(
      <LineActions line={line({ state: "working" })} onChoose={() => {}} onTable={() => {}} />,
    );
    const more = view.getByRole("button", { name: /^More/ });
    expect(more.querySelector("[data-icon='more']")).not.toBeNull();
    expect(more.textContent).toContain("More");
  });
});

describe("while Lines loads", () => {
  test("Owner says it is loading, never that the line has no owner", () => {
    const view = render(
      <OwnerBox
        line={line({ state: "working" })}
        crew={undefined}
        repoNames={[]}
        onStop={() => {}}
        onOwn={() => {}}
        status={<p>Loading the owner…</p>}
      />,
    );
    within(view.getByRole("region", { name: "Owner" })).getByText("Loading the owner…");
    expect(view.queryByText("no owner")).toBeNull();
    expect(view.queryByRole("button", { name: "I'll own it" })).toBeNull();
  });

  test("For you is still drawn, saying it is loading, instead of being left out", () => {
    const view = render(
      <PanelForYou title="L-1" items={[]} h={homeActions()} status={<p>Loading what needs you…</p>} />,
    );
    within(view.getByRole("region", { name: /For you/ })).getByText("Loading what needs you…");
  });
});
