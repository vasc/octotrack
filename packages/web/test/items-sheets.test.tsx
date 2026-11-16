import { describe, expect, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { AnswerStatus } from "../src/components/home/AnswerStatus.tsx";
import { CheckoutForm } from "../src/components/home/CheckoutForm.tsx";
import { KeyHelp } from "../src/components/home/KeyHelp.tsx";
import { StepIn } from "../src/components/home/StepIn.tsx";
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
    const view = render(<NewLineSheet repos={[]} onAdd={noop} onCancel={noop} />);
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
