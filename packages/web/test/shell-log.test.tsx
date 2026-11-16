import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { refusals } from "../src/lib/refused.ts";
import { UndoBar } from "../src/components/layout/UndoBar.tsx";
import { SyncFailures } from "../src/components/prs/SyncFailures.tsx";
import { Page } from "../src/components/ui/Page.tsx";
import { pendingChoice } from "../src/design/fixtures.ts";
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
        refused={[{ id: 7, summary: "Starting Wall mount", reason: "The tracker did not answer." }]}
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
