import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { refusals } from "../src/lib/refused.ts";
import { UndoBar } from "../src/components/layout/UndoBar.tsx";
import { SyncFailures } from "../src/components/prs/SyncFailures.tsx";
import { Page } from "../src/components/ui/Page.tsx";
import { event, line, pendingChoice } from "../src/design/fixtures.ts";
import { LogRow } from "../src/components/feed/LogRow.tsx";
import { LineLog } from "../src/components/feed/LineLog.tsx";
import { LooseSection } from "../src/components/feed/LooseSection.tsx";
import { FeedItem } from "../src/components/feed/FeedItem.tsx";
import { rosterSummary, timeLabel } from "../src/lib/format.ts";
import { whole } from "./harness.tsx";

describe("UndoBar", () => {
  test("counts down short, then says it is taking effect once the time is up", () => {
    const dueAt = "2026-11-16T12:00:04Z";
    const counting = render(
      <UndoBar
        now={Date.parse("2026-11-16T12:00:00Z")}
        lines={{}}
        pending={[pendingChoice({ summary: "Starting Wall mount", dueAt })]}
        onUndo={() => {}}
      />,
    );
    counting.getByText("in 4 s");
    counting.unmount();
    const due = render(
      <UndoBar
        now={Date.parse("2026-11-16T12:00:06Z")}
        lines={{}}
        pending={[pendingChoice({ summary: "Starting Wall mount", dueAt })]}
        onUndo={() => {}}
      />,
    );
    due.getByText("Taking effect…");
  });
});

describe("Page", () => {
  test("says under its title what it shows", () => {
    const view = render(
      <Page title="Agents" subtitle="1 running · 24 quiet">
        <p>rows</p>
      </Page>,
    );
    view.getByRole("heading", { name: "Agents" });
    view.getByText(whole("1 running · 24 quiet"));
  });
});

describe("rosterSummary", () => {
  test("counts agents by state, in the roster's order, leaving out states nobody is in", () => {
    expect(rosterSummary(["running", "quiet", "quiet", "stopped"])).toBe("1 running · 2 quiet · 1 stopped");
    expect(rosterSummary([])).toBe("");
  });
});

describe("timeLabel", () => {
  test("an earlier day this week shows the day and the time", () => {
    const now = new Date(2026, 10, 16, 12, 0).getTime();
    expect(timeLabel(new Date(2026, 10, 15, 20, 59).toISOString(), now)).toBe("Sun 20:59");
  });
});

describe("SyncFailures", () => {
  test("names each repo whose pull request status is stale, says why, and that it recovers by itself", () => {
    const view = render(
      <SyncFailures
        failures={[{ repo: "vasc/stack", error: "gh: not logged in\nrun gh auth login", updatedAt: "" }]}
      />,
    );
    view.getByText("Pull request status is stale for vasc/stack");
    view.getByText("gh: not logged in. It picks up again by itself once that is fixed.");
  });
});

describe("refused requests", () => {
  test("a choice the tracker never took is said in the Undo bar, until dismissed", () => {
    const onDismiss = mock((_id: number) => {});
    const view = render(
      <UndoBar
        now={0}
        lines={{}}
        pending={[]}
        refused={[
          { id: 7, summary: "Starting Wall mount", reason: "The tracker did not answer.", failed: true },
        ]}
        onUndo={() => {}}
        onDismiss={onDismiss}
      />,
    );
    view.getByText(whole("Did not happen: Starting Wall mount. The tracker did not answer."));
    fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith(7);
  });

  test("the store keeps each refusal until it is dismissed", () => {
    const store = refusals();
    const first = store.add("Starting Wall mount", "The tracker did not answer.");
    store.add("Tabling Mount", "The tracker did not answer.");
    expect(store.list().map((item) => item.summary)).toEqual(["Starting Wall mount", "Tabling Mount"]);
    store.dismiss(first);
    expect(store.list().map((item) => item.summary)).toEqual(["Tabling Mount"]);
  });
});

describe("the Log's rows", () => {
  test("a change leads with its time, then the sentence, then who", () => {
    const view = render(
      <LogRow event={event({ summary: "D-34 no longer affects PANEL-5", actor: "homepanel" })} />,
    );
    view.getByText("homepanel");
  });

  test("a line's group has no number, says its ref and how it stands", () => {
    const view = render(<LineLog line={line({ ref: "L-56", state: "proposed" })} events={[event()]} />);
    view.getByText("L-56");
    view.getByText("proposed");
    // The group's own head has no lead; its changes keep their times.
    expect(view.container.querySelector(".ui-row-head")?.querySelector(":scope > .ui-row-lead")).toBeNull();
  });

  test("a group of what is on no line says what it holds", () => {
    const view = render(<LooseSection title="On no line" events={[event()]} />);
    view.getByText("changes to things that belong to no line");
  });

  test("routine changes can be shown", () => {
    const routine = event({ seq: 9, type: "drift.resolved", summary: "DR-2 verified" });
    const view = render(<LineLog line={line()} events={[event({ seq: 1 }), routine]} />);
    expect(view.queryByText(/DR-2 verified/)).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Show" }));
    view.getByText(/verified/);
  });

  test("a search result says who and when by the clock, and no repo", () => {
    const at = new Date(2026, 10, 16, 20, 58).toISOString();
    const view = render(
      <FeedItem
        event={event({ summary: "D-75 took over", actor: "ttube", project: "TTUBE", ts: at })}
        onFilter={() => {}}
        now={new Date(2026, 10, 16, 22, 0).getTime()}
      />,
    );
    view.getByText("20:58");
    view.getByRole("button", { name: "ttube" });
    expect(view.queryByRole("button", { name: "TTUBE" })).toBeNull();
  });
});
