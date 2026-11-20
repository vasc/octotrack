import { describe, expect, mock, test } from "bun:test";
import type { ForYou, LineHome } from "@octotrack/core/schemas";
import { fireEvent, render, within } from "@testing-library/react";
import { FirstRun } from "../src/components/home/FirstRun.tsx";
import { LineHandle } from "../src/components/home/LineHandle.tsx";
import { LineMeta } from "../src/components/home/LineMeta.tsx";
import { NotAnswering } from "../src/components/home/NotAnswering.tsx";
import { ProposalCard } from "../src/components/home/ProposalCard.tsx";
import { ProposalGroups } from "../src/components/home/ProposalGroups.tsx";
import { QuietRow } from "../src/components/home/QuietRow.tsx";
import { UpNextRow } from "../src/components/home/UpNextRow.tsx";
import { WorkingLine } from "../src/components/home/WorkingLine.tsx";
import { decision, decisionCard, issue, line, lineHome } from "../src/design/fixtures.ts";
import { iconsIn, whole } from "./harness.tsx";

function details(overrides: Partial<LineHome> = {}): LineHome {
  return lineHome(overrides);
}

const task = (place: string | null): ForYou => ({ kind: "task", task: issue({ place }), frees: null });
const question: ForYou = { kind: "question", card: decisionCard() };

describe("FirstRun", () => {
  test("says nothing is placed yet, breaks the proposals down by placement, and names the count it accepts", () => {
    const proposals = [
      line({ ref: "L-1", state: "proposed", recommendation: "start" }),
      line({ ref: "L-2", state: "proposed", recommendation: "up_next" }),
      line({ ref: "L-3", state: "proposed", recommendation: "up_next" }),
      line({ ref: "L-4", state: "proposed", recommendation: "table" }),
      line({ ref: "L-5", state: "proposed", recommendation: null }),
    ];
    const onAccept = mock((_refs: string[]) => {});
    const view = render(<FirstRun proposals={proposals} onAccept={onAccept} onNewLine={() => {}} />);
    view.getByRole("heading", { name: "Nothing is placed yet" });
    view.getByText(
      "Your agents proposed 5 lines. 4 carry a recommendation: 1 to start, 2 for up next and 1 to table. 1 has none.",
    );
    fireEvent.click(view.getByRole("button", { name: "Accept 4 recommendations" }));
    expect(onAccept).toHaveBeenCalledWith(["L-1", "L-2", "L-3", "L-4"]);
  });

  test("with nothing proposed, says how lines arrive, with the guide and New line", () => {
    const onNewLine = mock(() => {});
    const view = render(<FirstRun proposals={[]} onAccept={() => {}} onNewLine={onNewLine} />);
    view.getByRole("heading", { name: "No lines yet" });
    view.getByText(/point an agent at the guide/);
    view.getByText("octo guide");
    fireEvent.click(view.getByRole("button", { name: "New line" }));
    expect(onNewLine).toHaveBeenCalledTimes(1);
  });
});

describe("LineMeta", () => {
  test("names the owner bare, with how it is", () => {
    const view = render(
      <LineMeta
        crew={{ owner: { name: "ttube", state: "running" }, helpers: [], scoper: null, search: null }}
      />,
    );
    view.getByText("ttube, running");
  });
});

describe("WorkingLine", () => {
  test("shows its headline as its owner wrote it, with no count of changes since", () => {
    const view = render(
      <WorkingLine
        line={line({ headline: "Docker disk capped at 60 GB." })}
        details={details({ sinceSummary: 3 })}
      />,
    );
    view.getByText("Docker disk capped at 60 GB.");
    expect(view.queryByText(/changes since/)).toBeNull();
  });
});

describe("WorkingLine, what waits there", () => {
  test("says how much waits on you, leading to For you at the first of it, and Step in, leading to it", () => {
    const view = render(
      <WorkingLine
        line={line({ ref: "L-2", title: "Sendspin enclosure" })}
        details={details({
          stepIn: true,
          forYou: [
            { kind: "question", card: decisionCard({ decision: decision({ ref: "D-4" }) }) },
            task(null),
          ],
        })}
      />,
    );
    expect(view.getByRole("link", { name: "2 for you" }).getAttribute("href")).toBe("/?item=D-4");
    expect(view.getByRole("link", { name: "Step in" }).getAttribute("href")).toBe(
      "/for-you/to-step-in?item=stepin%3AL-2",
    );
  });

  test("names what waits by kind when it is all one kind, and says nothing when nothing does", () => {
    const questions = render(
      <WorkingLine line={line()} details={details({ forYou: [question, question] })} />,
    );
    questions.getByRole("link", { name: "2 questions" });
    questions.unmount();
    const tasks = render(<WorkingLine line={line()} details={details({ forYou: [task("home")] })} />);
    tasks.getByRole("link", { name: "1 task for you" });
    tasks.unmount();
    expect(render(<WorkingLine line={line()} details={details()} />).queryByRole("link")).toBeNull();
  });
});

describe("UpNextRow", () => {
  test("says what it holds per kind and how far scoping got, without its done when", () => {
    const view = render(
      <UpNextRow
        line={line({ state: "up_next", doneWhen: "It works." })}
        details={details({ held: { questions: 1, tasks: 0 }, scopedSteps: 2 })}
        onStart={() => {}}
      />,
    );
    view.getByText("2 steps scoped");
    view.getByText("1 question held");
    expect(view.queryByText(/It works\./)).toBeNull();
  });

  test("a line made from a plan branch says whose branch it is and what waits for it, as a working line does", () => {
    const branchOf = { line: "L-1", address: "2a", holdsUp: "3" };
    const next = render(
      <UpNextRow line={line({ state: "up_next" })} details={details({ branchOf })} onStart={() => {}} />,
    );
    next.getByText("branch of L-1, holds up its step 3");
    next.unmount();
    const working = render(
      <WorkingLine
        line={line()}
        details={details({ branchOf: { ...branchOf, holdsUp: null }, branchesOpen: 2 })}
      />,
    );
    working.getByText("branch of L-1");
    working.getByText("2 branches open");
    working.unmount();
    // What the step waits on, warm when it is a tabled line nothing will finish until it starts.
    const stalled = render(
      <WorkingLine
        line={line()}
        details={details({
          step: { position: 3, of: 4, title: "Hang it", waitsOn: ["2a", "L-12"], stalledOn: ["L-12"] },
        })}
      />,
    );
    const waits = stalled.getByText("waits on 2a and L-12, tabled");
    expect(waits.closest("[data-tone='stuck']")).not.toBeNull();
  });

  test("a proposal or a tabled line made from a plan branch says so too", () => {
    const proposal = render(
      <ProposalCard
        line={line({ state: "proposed", proposedBy: "panel", recommendation: "up_next" })}
        origin="branch of L-1, holds up its step 3"
        foldTargets={[]}
        onStart={() => {}}
        onQueue={() => {}}
        onTable={() => {}}
        onFold={() => {}}
        onReject={() => {}}
        onDrop={() => {}}
      />,
    );
    proposal.getByText("branch of L-1, holds up its step 3");
    proposal.unmount();
    render(
      <QuietRow line={line({ state: "tabled", tabledReason: "Later" })} origin="branch of L-1" />,
    ).getByText("branch of L-1");
  });
});

describe("ProposalCard", () => {
  const proposal = line({
    ref: "L-20",
    title: "Play-test v1.3.0 in Minecraft",
    state: "proposed",
    proposedBy: "mobs",
    recommendation: "start",
    recommendationWhy: "the release is built and waits only on a play-test.",
    repos: ["MOBS"],
  });
  const handlers = {
    onStart: () => {},
    onQueue: () => {},
    onTable: () => {},
    onFold: () => {},
    onReject: () => {},
    onDrop: () => {},
  };

  test("says its ref, repo and proposer, what is recommended and why, without its done when", () => {
    const view = render(<ProposalCard line={proposal} foldTargets={[]} repoKeys={["MOBS"]} {...handlers} />);
    view.getByText("L-20");
    view.getByText("MOBS");
    view.getByText("proposed by mobs");
    view.getByText(whole("Recommends Start: the release is built and waits only on a play-test."));
    expect(view.queryByText(/Done when/)).toBeNull();
  });

  test("the recommended move is the one button, and the rest are under Other", () => {
    const onQueue = mock((_ref: string) => {});
    const view = render(
      <ProposalCard line={proposal} foldTargets={[]} repoKeys={["MOBS"]} {...handlers} onQueue={onQueue} />,
    );
    view.getByRole("button", { name: "Start Play-test v1.3.0 in Minecraft" });
    expect(view.queryByRole("button", { name: "Up next Play-test v1.3.0 in Minecraft" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Other/ }));
    fireEvent.click(view.getByRole("menuitem", { name: "Up next" }));
    expect(onQueue).toHaveBeenCalledWith("L-20");
  });
});

describe("LineHandle", () => {
  test("is a grip beside the line's number, one button that moves it", () => {
    const view = render(<LineHandle title="Mount" number={2} canMoveUp canMoveDown onMove={() => {}} />);
    const handle = view.getByRole("button", { name: "Move Mount" });
    within(handle).getByText("2");
    expect(handle.querySelector("svg")).not.toBeNull();
  });
});

describe("ProposalGroups", () => {
  const proposals = [
    ...Array.from({ length: 6 }, (_, index) =>
      line({
        ref: `L-${index + 1}`,
        title: `Start me ${index + 1}`,
        state: "proposed",
        recommendation: "start",
      }),
    ),
    line({
      ref: "L-20",
      title: "Put the Telegram CLI on a safe footing",
      state: "proposed",
      recommendation: "up_next",
    }),
    line({ ref: "L-21", title: "Another for up next", state: "proposed", recommendation: "up_next" }),
    line({ ref: "L-30", title: "From before lines", state: "proposed", recommendation: null }),
  ];

  test("groups proposals by what their agents recommend, the first open with a few, the rest folded with a sample", () => {
    const view = render(
      <ProposalGroups
        proposals={proposals}
        card={(proposal) => <p key={proposal.ref}>{proposal.title}</p>}
      />,
    );
    const start = view.getByRole("region", { name: /Recommended to start/ });
    within(start).getByText("6");
    within(start).getByText("Start me 4");
    expect(within(start).queryByText("Start me 5")).toBeNull();
    fireEvent.click(within(start).getByRole("button", { name: "Show 2 more" }));
    within(start).getByText("Start me 6");
    const upNext = view.getByRole("region", { name: /Recommended for up next/ });
    within(upNext).getByText("Includes Put the Telegram CLI on a safe footing, and 1 more.");
    expect(within(upNext).queryByText("Another for up next")).toBeNull();
    fireEvent.click(within(upNext).getByRole("button", { name: "Show Recommended for up next" }));
    within(upNext).getByText("Another for up next");
    view.getByRole("region", { name: /No recommendation/ });
    expect(view.queryByRole("region", { name: /Recommended to table/ })).toBeNull();
  });
});

describe("a move that failed", () => {
  test("is said under the line that moved", () => {
    const view = render(<WorkingLine line={line()} notMoved />);
    view.getByText("Not moved. The tracker did not answer; it is back where it was.");
  });
});

describe("NotAnswering", () => {
  test("says the tracker is not answering, where, what starts it, and Try now", () => {
    const onRetry = mock(() => {});
    const view = render(<NotAnswering host="127.0.0.1:4747" onRetry={onRetry} />);
    view.getByRole("heading", { name: "The tracker is not answering" });
    view.getByText(
      /Nothing answered at 127\.0\.0\.1:4747\. Any octo command starts it again; this page tries again every 30 seconds\./,
    );
    view.getByText("octo server status");
    fireEvent.click(view.getByRole("button", { name: "Try now" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("LineMeta, with nothing waiting on you", () => {
  test("says agents are on it when the line has an owner", () => {
    const view = render(
      <LineMeta
        crew={{ owner: { name: "chores", state: "running" }, helpers: [], scoper: null, search: null }}
        details={details()}
      />,
    );
    view.getByText("agents on it");
  });
});

describe("QuietRow", () => {
  test("a done line with neither reason nor date has no note, and says it is done and when", () => {
    const view = render(
      <QuietRow
        line={line({
          state: "done",
          tabledReason: null,
          lookAgainAt: null,
          updatedAt: "2026-11-01T10:00:00Z",
        })}
      />,
    );
    expect(view.container.querySelector(".ui-row-note")).toBeNull();
    expect(iconsIn(view.getByText(/^done /))).toEqual(["check"]);
  });

  test("a tabled line with no reason says so", () => {
    render(<QuietRow line={line({ state: "tabled", tabledReason: null, lookAgainAt: null })} />).getByText(
      "No reason given",
    );
  });

  test("a tabled line says why it waits and when to look again", () => {
    const view = render(
      <QuietRow line={line({ state: "tabled", tabledReason: "the play-test first", lookAgainAt: null })} />,
    );
    view.getByText("the play-test first");
  });
});

describe("first run's groups", () => {
  test("a folded group says what it means where a sample would say less", () => {
    const view = render(
      <ProposalGroups
        proposals={[
          line({ ref: "L-1", title: "Start me", state: "proposed", recommendation: "start" }),
          line({ ref: "L-2", title: "Part of another", state: "proposed", recommendation: "fold" }),
          line({ ref: "L-3", title: "Old idea", state: "proposed", recommendation: null, fromRef: "I-7" }),
        ]}
        card={(proposal) => <p key={proposal.ref}>{proposal.title}</p>}
      />,
    );
    view.getByText("One line its agent found is part of another line's work.");
    view.getByText("Old milestones and ideas from before lines existed.");
  });

  test("under a group, a proposal's case is only its why", () => {
    const view = render(
      <ProposalCard
        line={line({
          state: "proposed",
          recommendation: "start",
          recommendationWhy: "the release is built.",
        })}
        foldTargets={[]}
        grouped
        onStart={() => {}}
        onQueue={() => {}}
        onTable={() => {}}
        onFold={() => {}}
        onReject={() => {}}
        onDrop={() => {}}
      />,
    );
    view.getByText("the release is built.");
    expect(view.queryByText(/Recommends/)).toBeNull();
  });
});
