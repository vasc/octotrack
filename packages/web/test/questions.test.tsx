import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { AnsweredDecision } from "../src/components/decisions/AnsweredDecision.tsx";
import { DecisionMeta } from "../src/components/decisions/DecisionMeta.tsx";
import { HeldDecision } from "../src/components/decisions/HeldDecision.tsx";
import { ForYouRow } from "../src/components/home/ForYouRow.tsx";
import { decision, decisionCard } from "../src/design/fixtures.ts";
import { whole } from "./harness.tsx";

const noop = () => {};
const NOW = Date.parse("2026-11-16T12:00:00Z");

describe("a question put off", () => {
  test("reads Later, its ref and when it was put off, with Bring back", () => {
    const onBringBack = mock((_ref: string) => {});
    const card = decisionCard({
      decision: decision({ ref: "D-65", postponedAt: new Date(Date.now() - 3_600_000).toISOString() }),
    });
    const view = render(
      <ForYouRow
        item={{ kind: "question", card }}
        label="D-65"
        focused={false}
        onOpen={noop}
        onBringBack={onBringBack}
      />,
    );
    view.getByText(whole("Later · D-65 · put off 1h ago"));
    fireEvent.click(view.getByRole("button", { name: "Bring back D-65" }));
    expect(onBringBack).toHaveBeenCalledWith("D-65");
  });

  test("a question row shows its recommendation alone, not its why", () => {
    const card = decisionCard({
      decision: decision({
        ref: "D-7",
        options: [{ key: "a", label: "Keep the cap", description: "" }],
        recommendation: "a",
        recommendationWhy: "it is cheaper",
      }),
    });
    const view = render(
      <ForYouRow item={{ kind: "question", card }} label="D-7" focused={false} onOpen={noop} />,
    );
    view.getByText(whole("Recommended: Keep the cap"));
    expect(view.queryByText(/cheaper/)).toBeNull();
  });
});

describe("DecisionMeta", () => {
  test("leads with the state word: held, with who asked and when", () => {
    const view = render(
      <DecisionMeta
        decision={decision({ ref: "D-65", requestedBy: "travel-agent", createdAt: "2026-11-07T12:00:00Z" })}
        state="Held"
        now={NOW}
      />,
    );
    view.getByText("Held");
    view.getByText("asked by travel-agent");
    expect(view.queryByText("architecture")).toBeNull();
  });

  test("answered: who answered, on which channel, and the day", () => {
    const view = render(
      <DecisionMeta
        decision={decision({
          ref: "D-20",
          status: "decided",
          decidedBy: "dev",
          channel: "dashboard",
          decidedAt: "2026-11-07T12:00:00Z",
        })}
        state="Answered"
        now={NOW}
      />,
    );
    view.getByText("Answered");
    view.getByText("by you on the dashboard");
    view.getByText("7 Nov");
  });
});

describe("HeldDecision", () => {
  test("says what it is held until, the line's state and what to do, with Open and Withdraw", () => {
    const onWithdraw = mock(() => {});
    const view = render(
      <HeldDecision
        decision={decision({ ref: "D-65", heldAt: "2026-11-07T12:00:00Z" })}
        waitsFor={[]}
        line={{ ref: "L-24", title: "Team offsite", state: "proposed" }}
        onWithdraw={onWithdraw}
      />,
    );
    view.getByText(whole("Held until L-24 Team offsite starts. It is proposed; start it to answer this."));
    view.getByRole("button", { name: "Open L-24" });
    fireEvent.click(view.getByRole("button", { name: "Withdraw" }));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
    expect(view.queryByText(/Why:/)).toBeNull();
  });

  test("held behind a task, says what it waits for", () => {
    const view = render(
      <HeldDecision
        decision={decision({ ref: "D-65" })}
        waitsFor={["PANEL-4"]}
        line={null}
        onWithdraw={noop}
      />,
    );
    view.getByText(whole("Held until PANEL-4 is done: its outcome may settle this."));
  });
});

describe("AnsweredDecision", () => {
  test("says the answer and what became of it, with Change answer", () => {
    const onChange = mock(() => {});
    const view = render(
      <AnsweredDecision
        decision={decision({
          ref: "D-20",
          status: "decided",
          options: [{ key: "a", label: "Uninstall it", description: "" }],
          chosenOption: "a",
          pickedUpBy: "funnel-session",
          pickedUpAt: "2026-11-08T12:00:00Z",
        })}
        onChange={onChange}
      />,
    );
    view.getByText("Answer");
    view.getByText("Uninstall it");
    view.getByText("Then");
    view.getByText("Picked up by funnel-session; not reported as carried out yet");
    fireEvent.click(view.getByRole("button", { name: "Change answer" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("an answer in the developer's own words is the answer", () => {
    const view = render(
      <AnsweredDecision
        decision={decision({ status: "decided", options: [], chosenOption: null, resolutionNote: "Tiles" })}
        onChange={noop}
      />,
    );
    view.getByText("Tiles");
    view.getByText("Not picked up yet");
  });
});
