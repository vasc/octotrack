import { describe, expect, mock, test } from "bun:test";
import type { ForYou, LineHome } from "@octotrack/core/schemas";
import { fireEvent, render, within } from "@testing-library/react";
import { AtSection } from "../src/components/home/AtSection.tsx";
import { FirstRun } from "../src/components/home/FirstRun.tsx";
import { FoldedItems } from "../src/components/home/FoldedItems.tsx";
import { LineHandle } from "../src/components/home/LineHandle.tsx";
import { LineMeta } from "../src/components/home/LineMeta.tsx";
import { MoreForYou } from "../src/components/home/MoreForYou.tsx";
import { NothingNeedsYou } from "../src/components/home/NothingNeedsYou.tsx";
import { ProposalCard } from "../src/components/home/ProposalCard.tsx";
import { ProposalGroups } from "../src/components/home/ProposalGroups.tsx";
import { UpNextRow } from "../src/components/home/UpNextRow.tsx";
import { WorkingLine } from "../src/components/home/WorkingLine.tsx";
import { decisionCard, issue, line } from "../src/design/fixtures.ts";
import { whole } from "./harness.tsx";

const NOW = Date.parse("2026-11-16T12:00:00Z");

function details(overrides: Partial<LineHome> = {}): LineHome {
  return {
    start: null,
    step: null,
    forYou: [],
    stepIn: false,
    stepInReason: null,
    stepInKind: null,
    waitingOnYou: false,
    held: { questions: 0, tasks: 0 },
    reconfirming: 0,
    sinceSummary: 0,
    scopedSteps: 0,
    answers: [],
    ...overrides,
  };
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

describe("NothingNeedsYou", () => {
  test("says where the next ask likely comes from", () => {
    const view = render(
      <NothingNeedsYou working={2} next={{ title: "Mac mini keeps enough free disk", step: "step 2" }} />,
    );
    view.getByText("Nothing needs you");
    view.getByText(/the next ask likely comes from Mac mini keeps enough free disk, step 2/);
  });
});

describe("AtSection", () => {
  test("says the place ends by itself", () => {
    const view = render(
      <AtSection
        at={{ place: "home", until: "2026-11-16T15:00:00Z", tasks: [] }}
        now={NOW}
        onLeave={() => {}}
      />,
    );
    view.getByText("At home");
    view.getByText(/ends by itself in 3h/);
  });
});

describe("what a line holds, folded", () => {
  test("FoldedItems says it is also on this line", () => {
    const view = render(<FoldedItems items={[question]} onOpen={() => {}} />);
    view.getByText("Also on this line: 1 question");
  });

  test("MoreForYou says what more is for you", () => {
    const view = render(<MoreForYou items={[task("home")]} onShow={() => {}} />);
    view.getByText("1 more for you: a task at home");
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
    fireEvent.click(within(upNext).getByRole("button", { name: "Show" }));
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
