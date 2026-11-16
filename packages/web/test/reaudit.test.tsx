import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { BatchPanelView } from "../src/components/decisions/BatchPanelView.tsx";
import { AtPlaceItems } from "../src/components/home/AtPlaceItems.tsx";
import { FirstRun } from "../src/components/home/FirstRun.tsx";
import { ForYouRow } from "../src/components/home/ForYouRow.tsx";
import { LineProposalCard } from "../src/components/home/LineProposalCard.tsx";
import { OwnerBox } from "../src/components/entity/OwnerBox.tsx";
import { UndoBar } from "../src/components/layout/UndoBar.tsx";
import { Waiting } from "../src/components/ui/Waiting.tsx";
import { decision, decisionCard, line, pendingChoice } from "../src/design/fixtures.ts";
import { glyphOf } from "../src/lib/format.ts";
import { whole } from "./harness.tsx";

const noop = () => {};

describe("glyphs follow Status", () => {
  test("urgent, blocked and stuck are ▲; running and in progress ◐; refused ✗; cancelled –", () => {
    expect(["urgent", "blocked", "blocker", "stuck"].map(glyphOf)).toEqual(["▲", "▲", "▲", "▲"]);
    expect(["running", "progress", "in_progress"].map(glyphOf)).toEqual(["◐", "◐", "◐"]);
    expect(glyphOf("refused")).toBe("✗");
    expect(glyphOf("cancelled")).toBe("–");
  });
});

describe("an urgent row", () => {
  test("names its reason and the line it is on, by number and title", () => {
    const card = decisionCard({ decision: decision({ ref: "D-75", urgentReason: "broken", line: "L-3" }) });
    const view = render(
      <ForYouRow
        item={{ kind: "question", card }}
        label="D-75"
        focused={false}
        onOpen={noop}
        on={{ number: 1, title: "The home worker fetches new videos again" }}
      />,
    );
    view.getByText(whole("Something broken · on 1 · The home worker fetches new videos again · D-75"));
  });

  test("on no line, names its reason and ref", () => {
    const card = decisionCard({
      decision: decision({ ref: "D-75", urgentReason: "costs_money", line: null }),
    });
    const view = render(
      <ForYouRow item={{ kind: "question", card }} label="D-75" focused={false} onOpen={noop} />,
    );
    view.getByText(whole("Costs money · D-75"));
  });
});

describe("the Undo bar", () => {
  test("an Undo that came too late is said plainly, not as a choice that did not happen", () => {
    const view = render(
      <UndoBar
        pending={[]}
        refused={[{ id: 1, summary: "Too late to undo", reason: "it already took effect.", failed: false }]}
        now={0}
        lines={{}}
        onUndo={noop}
      />,
    );
    view.getByText(whole("Too late to undo: it already took effect."));
    expect(view.queryByText(/Did not happen/)).toBeNull();
  });

  test("a choice that failed when applied says to look again", () => {
    const view = render(
      <UndoBar
        pending={[
          pendingChoice({
            id: 4,
            summary: "Moving L-24 to up next",
            state: "failed",
            error: "It changed meanwhile.",
          }),
        ]}
        now={0}
        lines={{}}
        onUndo={noop}
      />,
    );
    expect(view.getByRole("alert").textContent).toBe(
      "Did not happen: Moving L-24 to up next. It changed meanwhile. Look again.",
    );
  });

  test("a Stop says the line it leaves looks for another owner", () => {
    const view = render(
      <UndoBar
        pending={[
          pendingChoice({
            id: 5,
            summary: "Stopping ttube",
            line: "L-1",
            dueAt: new Date(3000).toISOString(),
          }),
        ]}
        now={0}
        lines={{ "L-1": { title: "home worker", waitsOnYou: false } }}
        onUndo={noop}
      />,
    );
    view.getByText(/The home worker line looks for another owner\./);
  });
});

describe("Waiting", () => {
  test("is not a live region of its own, and its seconds are not read out", () => {
    const view = render(
      <Waiting
        what="Sending to roadtrip"
        dueAt={new Date(4000).toISOString()}
        now={0}
        onUndo={noop}
        undoLabel="Undo"
      />,
    );
    expect(view.queryByRole("status")).toBeNull();
    expect(view.getByText("in 4 s").getAttribute("aria-hidden")).toBe("true");
  });
});

describe("FirstRun", () => {
  test("says the folds wait for the developer to pick the line", () => {
    const view = render(
      <FirstRun
        proposals={[
          line({ ref: "L-1", state: "proposed", recommendation: "start" }),
          line({ ref: "L-2", state: "proposed", recommendation: "fold" }),
        ]}
        onAccept={noop}
        onNewLine={noop}
      />,
    );
    view.getByText(/The 1 to fold waits for you to pick the line it goes into\./);
  });
});

describe("AtPlaceItems", () => {
  test("with nothing to draw, draws no empty box", () => {
    const { container } = render(
      <AtPlaceItems forYou={[]} at="home" focus={null} task={() => null} item={() => null} onFocus={noop} />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("OwnerBox", () => {
  test("with the step-in in the head, does not offer I'll own it a second time", () => {
    const view = render(
      <OwnerBox
        line={line({ state: "working" })}
        crew={undefined}
        repoNames={[]}
        onStop={noop}
        onOwn={noop}
        ownInHead
      />,
    );
    view.getByText("no owner");
    expect(view.queryByRole("button", { name: "I'll own it" })).toBeNull();
  });
});

describe("LineProposalCard", () => {
  test("what it still needs is kept when the box is closed and opened again", () => {
    const view = render(
      <LineProposalCard
        proposal={{ kind: "done", line: "L-1", text: "It works.", by: "chores", doneWhen: "It works." }}
        title="Mount"
        onAccept={noop}
        onDecline={mock((_why: string) => {})}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Not yet" }));
    fireEvent.change(view.getByLabelText("What it still needs"), { target: { value: "The lid rattles" } });
    fireEvent.click(view.getByRole("button", { name: "Back" }));
    fireEvent.click(view.getByRole("button", { name: "Not yet" }));
    expect(within(view.container).getByLabelText("What it still needs")).toHaveProperty(
      "value",
      "The lid rattles",
    );
  });
});

describe("Record answers", () => {
  test("a record that failed is said, and Record stays usable to try again", () => {
    const view = render(
      <BatchPanelView
        text="D-3 a"
        parsed={[{ ref: "D-3", option: "a", note: null }]}
        parseError={null}
        recordError="The tracker did not answer."
        results={null}
        submitting={false}
        onChange={noop}
        onSubmit={noop}
        onClose={noop}
      />,
    );
    view.getByText("The tracker did not answer.");
    expect(view.getByRole("button", { name: /^Record/ }).hasAttribute("disabled")).toBe(false);
  });

  test("rows not kept on the tracker say so", () => {
    const view = render(
      <BatchPanelView
        text="D-3 a"
        parsed={[]}
        parseError={null}
        results={null}
        submitting={false}
        notSaved
        onChange={noop}
        onSubmit={noop}
        onClose={noop}
      />,
    );
    view.getByText(/^Not saved:/);
  });
});
