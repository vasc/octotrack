import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { AnswerStatus } from "../src/components/home/AnswerStatus.tsx";
import { CheckoutForm } from "../src/components/home/CheckoutForm.tsx";
import { KeyHelp } from "../src/components/home/KeyHelp.tsx";
import { StepIn } from "../src/components/home/StepIn.tsx";
import { StartSheetView } from "../src/components/home/StartSheetView.tsx";
import { NewLineSheet } from "../src/components/lines/NewLineSheet.tsx";
import { line } from "../src/design/fixtures.ts";

const noop = () => {};

describe("StepIn", () => {
  test("I'll own it and Table it follow the kind's own action, in that order", () => {
    const view = render(
      <StepIn line={line()} reason="No start command." onRetry={noop} onOwn={noop} onTable={noop} />,
    );
    const names = view.getAllByRole("button").map((button) => button.textContent);
    expect(names).toEqual(["Try now", "I'll own it", "Table it"]);
  });
});

describe("AnswerStatus", () => {
  test("offers Change, and says how long ago it was picked up", () => {
    const view = render(
      <AnswerStatus
        answer={{
          ref: "D-20",
          title: "Uninstall it?",
          answer: "Uninstall it",
          status: "picked_up",
          by: "funnel",
          at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
          note: null,
          unwoken: null,
        }}
      />,
    );
    expect(view.getByRole("button", { name: "Change answer D-20" }).textContent).toBe("Change");
    view.getByText(/picked up by funnel, 9d ago/);
  });
});

describe("CheckoutForm", () => {
  test("Set waits for a full path, and the field says so", () => {
    const view = render(<CheckoutForm repo="hydra" onSet={noop} onCancel={noop} />);
    view.getByText("A full path, starting with /");
    expect(view.getByRole("button", { name: "Set" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Checkout of hydra"), { target: { value: "/src/hydra" } });
    expect(view.getByRole("button", { name: "Set" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("NewLineSheet", () => {
  test("Table asks first, so it says so", () => {
    const view = render(
      <NewLineSheet
        repos={[]}
        onAdd={noop}
        onCancel={noop}
        draft={{ title: "", doneWhen: "" }}
        onDraft={noop}
      />,
    );
    view.getByRole("button", { name: "Table…" });
  });
});

describe("KeyHelp", () => {
  test("groups the keys into moving and acting, and closes with Close", () => {
    const view = render(<KeyHelp onClose={noop} />);
    const sheet = within(view.getByRole("dialog", { name: "Keys" }));
    sheet.getByText("Moving");
    sheet.getByText("Acting");
    sheet.getByText("answer in your words");
    sheet.getByText("tell the owner");
    sheet.getByText("search the log");
    sheet.getByRole("button", { name: "Close" });
  });
});

describe("NewLineSheet, as drawn", () => {
  const repos = ["HASS", "INFRA", "MEDIA", "PANEL", "TRIP", "OCT"];
  const props = { repos, onAdd: noop, onCancel: noop, draft: { title: "", doneWhen: "" }, onDraft: noop };

  test("repos are chips, four then the rest a press away, with None: it's mine", () => {
    const view = render(<NewLineSheet {...props} />);
    view.getByRole("checkbox", { name: "PANEL" });
    expect(view.queryByRole("checkbox", { name: "TRIP" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "+ 2 more" }));
    view.getByRole("checkbox", { name: "TRIP" });
    view.getByRole("checkbox", { name: "None: it's mine" });
  });

  test("says what is still missing while it cannot be added, and that it saves as typed", () => {
    const view = render(<NewLineSheet {...props} draft={{ title: "Backups", doneWhen: "" }} />);
    view.getByText("Still needs: done when, and a repo or None.");
    view.getByText("Saved as you type");
    expect(view.getByLabelText("What it is").getAttribute("placeholder")).toBe(
      "Back up the Home Assistant host nightly",
    );
  });

  test("what is typed goes to its draft", () => {
    const onDraft = mock((_draft: { title: string; doneWhen: string }) => {});
    const view = render(<NewLineSheet {...props} onDraft={onDraft} />);
    fireEvent.change(view.getByLabelText("What it is"), { target: { value: "Backups" } });
    expect(onDraft).toHaveBeenCalledWith({ title: "Backups", doneWhen: "" });
  });
});

describe("StartSheetView, as drawn", () => {
  test("says how many waited, and Start stays on while what waited loads", () => {
    const view = render(
      <StartSheetView
        line={line({ title: "Labyrinth level editor" })}
        held={[
          { ref: "D-4", kind: "question", title: "Which engine?", line: "L-1", current: true, since: "" },
          { ref: "PANEL-9", kind: "task", title: "Measure the studs", line: "L-1", current: true, since: "" },
        ]}
        questions={[]}
        onDoneWhen={noop}
        onAnswer={noop}
        onStart={noop}
        onCancel={noop}
        status={<p>loading</p>}
      />,
    );
    expect(view.getByRole("button", { name: "Start" }).hasAttribute("disabled")).toBe(false);
    view.unmount();
    const loaded = render(
      <StartSheetView
        line={line({ title: "Labyrinth level editor" })}
        held={[
          { ref: "D-4", kind: "question", title: "Which engine?", line: "L-1", current: true, since: "" },
          { ref: "PANEL-9", kind: "task", title: "Measure the studs", line: "L-1", current: true, since: "" },
        ]}
        questions={[]}
        onDoneWhen={noop}
        onAnswer={noop}
        onStart={noop}
        onCancel={noop}
      />,
    );
    loaded.getByText("1 question and 1 task waited for it.");
    // A held question no longer open to answer here still shows, by its title.
    loaded.getByText("Which engine?");
  });
});
