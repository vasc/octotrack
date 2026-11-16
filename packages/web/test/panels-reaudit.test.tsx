import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { notFoundTitle, RefNotFound } from "../src/components/entity/RefNotFound.tsx";
import { PrPanel } from "../src/components/entity/PrPanel.tsx";
import { StaleNote } from "../src/components/ui/Loaded.tsx";
import { pr } from "../src/design/fixtures.ts";
import { ageWords } from "../src/lib/format.ts";
import { whole } from "./harness.tsx";

describe("RefNotFound", () => {
  test("a line ref never made says so, and that ended lines still open, with a search of the log", () => {
    const view = render(<RefNotFound refName="L-312" />);
    view.getByText(
      "No line was ever made with that ref; check it for a typo. Lines that were done, dropped or folded still open at their ref.",
    );
    const search = view.getByRole("link", { name: "Search the log for L-312" });
    expect(search.getAttribute("href")).toBe(`/log?q=${encodeURIComponent("ref:L-312")}`);
  });

  test("names other kinds by their word", () => {
    expect(notFoundTitle("L-312")).toBe("No line L-312");
    expect(notFoundTitle("D-9")).toBe("No question D-9");
    expect(notFoundTitle("PANEL-4")).toBe("No item PANEL-4");
  });
});

describe("StaleNote", () => {
  test("says what could not refresh and when it is from, with Try again", () => {
    const onRetry = mock(() => {});
    const at = new Date(2026, 10, 16, 14, 20).getTime();
    const view = render(<StaleNote at={at} what="the plan" onRetry={onRetry} />);
    view.getByText(whole("Could not refresh the plan; as of 14:20."));
    fireEvent.click(view.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("PrPanel", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");

  test("says its age in words, and when it was synced", () => {
    const view = render(
      <PrPanel pr={pr({ createdAt: "2026-11-07T12:00:00Z", syncedAt: "2026-11-16T11:58:00Z" })} now={now} />,
    );
    view.getByText(/· 9 days$/);
    view.getByText("2 min ago");
  });

  test("when sync has stopped for its repo, Synced says so in place", () => {
    const at = new Date(2026, 10, 16, 14, 20).toISOString();
    const view = render(<PrPanel pr={pr()} now={now} stale={{ since: at, reason: "gh is not logged in" }} />);
    view.getByText("stale since 14:20: gh is not logged in");
  });
});

describe("ageWords", () => {
  test("says an age in words", () => {
    const now = Date.parse("2026-11-16T12:00:00Z");
    expect(ageWords("2026-11-16T11:58:00Z", now)).toBe("2 min");
    expect(ageWords("2026-11-16T09:00:00Z", now)).toBe("3 hours");
    expect(ageWords("2026-11-15T12:00:00Z", now)).toBe("1 day");
    expect(ageWords("2026-11-16T11:59:50Z", now)).toBe("just now");
  });
});
