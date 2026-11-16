import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { LineActions } from "../src/components/entity/LineActions.tsx";
import { LinePanelHead } from "../src/components/entity/LinePanelHead.tsx";
import { OwnerBox } from "../src/components/entity/OwnerBox.tsx";
import { OwnWorkBox } from "../src/components/entity/OwnWorkBox.tsx";
import { PlanList } from "../src/components/entity/PlanList.tsx";
import { SinceSummary } from "../src/components/entity/SinceSummary.tsx";
import { SummaryBox } from "../src/components/entity/SummaryBox.tsx";
import { TellBox } from "../src/components/entity/TellBox.tsx";
import { Panel } from "../src/components/ui/Panel.tsx";
import { event, line } from "../src/design/fixtures.ts";
import { whole } from "./harness.tsx";

const NOW = Date.parse("2026-11-16T12:00:00Z");

describe("the line's head", () => {
  test("its crumbs are its state, ref and repos, with no place in an order", () => {
    const view = render(
      <LinePanelHead line={line({ ref: "L-3", state: "up_next" })} repos={["LimbicAI/hydra"]} now={NOW} />,
    );
    view.getByText("Up next");
    view.getByText("L-3");
    view.getByText("LimbicAI/hydra");
    expect(view.queryByText(/of \d+/)).toBeNull();
  });

  test("a line the developer owns says it is theirs", () => {
    const view = render(<LinePanelHead line={line({ ownedBy: "dev" })} repos={[]} now={NOW} />);
    view.getByText("yours");
  });

  test("Done when is a label over its sentence", () => {
    const view = render(
      <LinePanelHead line={line({ doneWhen: "Kore runs on ECS." })} repos={[]} now={NOW} />,
    );
    const label = view.getByText("Done when");
    expect(label.textContent).toBe("Done when");
    view.getByText("Kore runs on ECS.");
  });

  test("a proposal says who proposed it and when, and what they recommend and why, above its moves", () => {
    const view = render(
      <LinePanelHead
        line={line({
          state: "proposed",
          proposedBy: "ttube",
          createdAt: "2026-11-14T12:00:00Z",
          recommendation: "start",
          recommendationWhy: "YouTube has refused the home worker since 14 Nov.",
        })}
        repos={["TTUBE"]}
        now={NOW}
      />,
    );
    view.getByText(whole("Proposed by ttube, 2d ago"));
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

  test("a done line says so, read only", () => {
    const view = render(<LinePanelHead line={line({ state: "done" })} repos={[]} now={NOW} />);
    view.getByText("Done");
    view.getByText("Plan, summary and history stay below, as they were when it closed.");
  });
});

describe("the panel", () => {
  test("Close shuts it, and opened from another panel Back is its own button", () => {
    const onClose = mock(() => {});
    const onBack = mock(() => {});
    const view = render(<Panel title="L-1" onClose={onClose} back={{ label: "L-57", onBack }} />);
    fireEvent.click(view.getByRole("button", { name: "‹ Back to L-57" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.getByRole("button", { name: "Close" }).textContent).toBe("Close");
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

  test("an issue reads its ref and state in words, its pull requests by number with their checks", () => {
    const pr = (number: number, state: "open" | "merged", checks: "failing" | "passing") => ({
      ref: `PR-${number}`,
      repo: "LimbicAI/kore",
      number,
      state,
      checks,
    });
    const view = render(
      <PlanList
        steps={[{ position: 1, title: "Build the image", status: "doing", line: "L-1" }]}
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
    view.getByText(whole("#418 open · ✗ checks failing"));
    view.getByText("in progress");
    view.getByText("3 pull requests merged ✓");
    expect(view.queryByText(/kore#/)).toBeNull();
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
        repoNames={["LimbicAI/hydra"]}
        onStop={() => {}}
        onOwn={() => {}}
      />,
    );
    view.getByText("None until it starts. An idle agent in LimbicAI/hydra may scope it meanwhile.");
  });
});

describe("TellBox", () => {
  test("its box says an empty message is a nudge", () => {
    const view = render(<TellBox line="L-1" to="kore-ecs" words="" onWords={() => {}} onSend={() => {}} />);
    expect(view.getByLabelText("Tell kore-ecs").getAttribute("placeholder")).toBe("Leave it empty to nudge");
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
        repos={["HASS"]}
        allRepos={["HASS", "PANEL"]}
        onHand={onHand}
      />,
    );
    const add = view.getByRole("region", { name: "Add a task or a note" });
    fireEvent.click(within(add).getByRole("button", { name: "Hand to an agent" }));
    expect(onHand).toHaveBeenCalledWith([]);
  });
});

describe("the panel on a phone", () => {
  test("its way back names the page under it, in place of Close", () => {
    const onClose = mock(() => {});
    const view = render(<Panel title="L-1" onClose={onClose} under="Log" />);
    fireEvent.click(view.getByRole("button", { name: "‹ Log" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("More is ⋯ on a phone, still named More", () => {
    const view = render(
      <LineActions line={line({ state: "working" })} onChoose={() => {}} onTable={() => {}} />,
    );
    const more = view.getByRole("button", { name: /^More/ });
    expect(more.querySelector("[data-icon='more']")).not.toBeNull();
    expect(more.textContent).toContain("More");
  });
});
