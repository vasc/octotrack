import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { UndoBar } from "../src/components/layout/UndoBar.tsx";
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
