import { whole } from "./harness.tsx";
import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { useState } from "react";
import { NewLineSheet } from "../src/components/lines/NewLineSheet.tsx";
import { Actions } from "../src/components/ui/Actions.tsx";
import { Button } from "../src/components/ui/Button.tsx";
import { Field } from "../src/components/ui/Field.tsx";
import { Focusable } from "../src/components/ui/Focusable.tsx";
import { Fold } from "../src/components/ui/Fold.tsx";
import { Section } from "../src/components/ui/Section.tsx";
import { List } from "../src/components/ui/List.tsx";
import { Cell, Table } from "../src/components/ui/Table.tsx";
import { Row } from "../src/components/ui/Row.tsx";
import { Sheet } from "../src/components/ui/Sheet.tsx";
import { useHotkeys } from "../src/hooks/useHotkeys.ts";
import { Options } from "../src/components/ui/Options.tsx";
import { Badge, StatusBadge } from "../src/components/ui/Badge.tsx";
import { Facts } from "../src/components/ui/Facts.tsx";
import { ErrorState } from "../src/components/ui/states.tsx";
import { NotKept } from "../src/components/ui/NotKept.tsx";
import { Toast } from "../src/components/ui/Toast.tsx";
import { ApiError } from "../src/api/client.ts";

describe("Button", () => {
  test("is a button of one of three kinds, and a screen cannot restyle it", () => {
    const onClick = mock(() => {});
    const view = render(
      <Actions>
        <Button variant="primary" onClick={onClick}>
          Add to up next
        </Button>
        <Button>Start</Button>
        <Button variant="quiet">Cancel</Button>
      </Actions>,
    );
    const add = view.getByRole("button", { name: "Add to up next" });
    expect(add.getAttribute("type")).toBe("button");
    expect(add.getAttribute("data-variant")).toBe("primary");
    expect(view.getByRole("button", { name: "Start" }).getAttribute("data-variant")).toBe("plain");
    expect(add.className).toBe("ui-button");
    fireEvent.click(add);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("List and Row", () => {
  test("a row says what it is, its title and a quiet note, and opens on a tap", () => {
    const onOpen = mock(() => {});
    const view = render(
      <List>
        <Row
          kind="Question · D-24"
          title="How should pacing work?"
          note="Recommended: Fast start"
          onOpen={onOpen}
        />
        <Row title="Plain row" />
      </List>,
    );
    const open = view.getByRole("button", { name: /How should pacing work\?/ });
    within(open).getByText(whole("Question · D-24"));
    within(open).getByText("Recommended: Fast start");
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("button", { name: /Plain row/ })).toBeNull();
  });

  test("a row can be one choice of many, checked or not", () => {
    const onToggle = mock(() => {});
    const view = render(
      <List label="Repos">
        <Row title="PANEL" checked onToggle={onToggle} />
        <Row title="OCT" checked={false} onToggle={onToggle} />
      </List>,
    );
    const list = within(view.getByRole("group", { name: "Repos" }));
    expect(list.getByRole("checkbox", { name: "PANEL" })).toHaveProperty("checked", true);
    expect(list.getByRole("checkbox", { name: "OCT" })).toHaveProperty("checked", false);
    fireEvent.click(list.getByRole("checkbox", { name: "OCT" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("Field", () => {
  test("names its box, and grows to more lines when asked", () => {
    const onChange = mock((_value: string) => {});
    const view = render(<Field label="Done when" value="" onChange={onChange} multiline />);
    const box = view.getByLabelText("Done when");
    expect(box.tagName).toBe("TEXTAREA");
    fireEvent.change(box, { target: { value: "It hangs flush" } });
    expect(onChange).toHaveBeenCalledWith("It hangs flush");
  });
});

describe("Field while typed in", () => {
  test("keeps what was typed against a draft arriving, but shows words replaced on purpose", () => {
    const view = render(<Field label="Answers" value={"D-1 a\nD-2 b"} onChange={() => {}} multiline />);
    const box = view.getByLabelText("Answers");
    fireEvent.focus(box);
    // A draft from another device does not change the words under the cursor.
    view.rerender(<Field label="Answers" value="D-9 z" onChange={() => {}} multiline />);
    expect(box).toHaveProperty("value", "D-1 a\nD-2 b");
    // Recording sent the first line and kept the one that failed: that replacement shows, focus or not.
    view.rerender(<Field label="Answers" value="D-2 b" replaced={1} onChange={() => {}} multiline />);
    expect(box).toHaveProperty("value", "D-2 b");
  });
});

describe("Sheet", () => {
  test("is a dialog over the whole page, named by its title, that Cancel and Esc close", () => {
    const onClose = mock(() => {});
    const view = render(
      <Sheet title="New line" onClose={onClose}>
        <p>inside</p>
      </Sheet>,
    );
    const dialog = view.getByRole("dialog", { name: "New line" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Drawn over everything, the page's bar included, so none of its actions seem to apply.
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

/** New line with its draft held here, as the shell holds it on the tracker. */
function DraftedNewLine({ repos, onAdd }: { repos: readonly string[]; onAdd(line: unknown): void }) {
  const [draft, setDraft] = useState({ title: "", doneWhen: "" });
  return <NewLineSheet repos={repos} draft={draft} onDraft={setDraft} onAdd={onAdd} onCancel={() => {}} />;
}

describe("NewLineSheet", () => {
  test("asks what it is, when it is done and its repos, and adds it to up next, starts it or tables it", () => {
    const onAdd = mock((_line: unknown) => {});
    const view = render(<DraftedNewLine repos={["PANEL", "OCT"]} onAdd={onAdd} />);
    const sheet = within(view.getByRole("dialog", { name: "New line" }));
    const add = sheet.getByRole("button", { name: "Add to up next" });
    expect(add.hasAttribute("disabled")).toBe(true);
    fireEvent.change(sheet.getByLabelText("What it is"), { target: { value: "Wall mount" } });
    fireEvent.change(sheet.getByLabelText("Done when"), { target: { value: "It hangs flush" } });
    fireEvent.click(sheet.getByRole("checkbox", { name: "PANEL" }));
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith({
      title: "Wall mount",
      doneWhen: "It hangs flush",
      repos: ["PANEL"],
      where: "up_next",
    });
  });

  test("a line that is the developer's own needs no repo", () => {
    const onAdd = mock((_line: unknown) => {});
    const view = render(<DraftedNewLine repos={["PANEL"]} onAdd={onAdd} />);
    const sheet = within(view.getByRole("dialog", { name: "New line" }));
    fireEvent.change(sheet.getByLabelText("What it is"), { target: { value: "Taxes" } });
    fireEvent.change(sheet.getByLabelText("Done when"), { target: { value: "Filed" } });
    fireEvent.click(sheet.getByRole("checkbox", { name: "None: it's mine" }));
    fireEvent.click(sheet.getByRole("button", { name: "Start" }));
    expect(onAdd).toHaveBeenCalledWith({ title: "Taxes", doneWhen: "Filed", repos: [], where: "working" });
  });
});

describe("Section and Fold", () => {
  test("a section is a region named by its title, with its count", () => {
    const view = render(
      <Section title="Working on" count={2}>
        <p>x</p>
      </Section>,
    );
    within(view.getByRole("region", { name: "Working on" })).getByText("2");
  });

  test("a fold names a few of what it holds and shows its rows only when asked", () => {
    const view = render(
      <Fold title="Tabled" count={2} summary="Podcast cleanup, Bike fit">
        <p>the rows</p>
      </Fold>,
    );
    view.getByText("Podcast cleanup, Bike fit");
    expect(view.queryByText("the rows")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Tabled/ }));
    view.getByText("the rows");
  });

  test("a fold held open while one of its items has focus offers nothing that would hide it", () => {
    const view = render(
      <Fold title="On no line" count={2} held>
        <p>the rows, one opened</p>
      </Fold>,
    );
    view.getByText("the rows, one opened");
    expect(view.getByRole("button", { name: /On no line/ }).hasAttribute("disabled")).toBe(true);
    // It says why it will not fold.
    view.getByText("stays open while you are in it");
  });
});

describe("Focusable", () => {
  test("is where the browser can focus an item, current while the keys act on it", () => {
    const focused = render(
      <Focusable focusRef="D-7" label="Question D-7, Which?" focused>
        <p>Which?</p>
      </Focusable>,
    );
    const wrap = focused.getByRole("group", { name: "Question D-7, Which?" });
    expect(wrap.getAttribute("data-focus-ref")).toBe("D-7");
    expect(wrap.getAttribute("aria-current")).toBe("true");
    expect(wrap.getAttribute("tabindex")).toBe("-1");
    focused.unmount();
    const other = render(
      <Focusable focusRef="D-7" label="Question D-7, Which?" focused={false}>
        <p>Which?</p>
      </Focusable>,
    );
    expect(other.getByRole("group", { name: "Question D-7, Which?" }).hasAttribute("aria-current")).toBe(
      false,
    );
  });
});

describe("Options", () => {
  const options = [
    { key: "a", label: "Raise the cap" },
    { key: "b", label: "Keep the cap in Merano", recommended: true, why: "it keeps the budget" },
    { key: "c", label: "Villa Groff" },
  ];

  test("each option shows its number, and the recommended one says so with its why inside it", () => {
    const view = render(<Options options={options} onPick={() => {}} />);
    const recommended = view.getByRole("button", { name: /Keep the cap in Merano/ });
    within(recommended).getByText("2");
    within(recommended).getByText("Recommended");
    within(recommended).getByText(/it keeps the budget/);
    within(view.getByRole("button", { name: /Raise the cap/ })).getByText("1");
  });

  test("a chosen option shows a tick in place of its number, and the rest step back", () => {
    const view = render(<Options options={options} onPick={() => {}} chosen="b" />);
    const chosen = view.getByRole("button", { name: /Keep the cap in Merano/ });
    within(chosen).getByText("✓");
    expect(within(chosen).queryByText("2")).toBeNull();
    expect(chosen.getAttribute("aria-pressed")).toBe("true");
    expect(view.getByRole("button", { name: /Raise the cap/ }).getAttribute("data-stepped")).toBe("true");
  });
});

describe("Badge", () => {
  test.each([
    ["failing", "✗"],
    ["merged", "✓"],
    ["pending", "▲"],
    ["in_progress", "◐"],
    ["dropped", "–"],
    ["backlog", "○"],
  ])("%s carries the glyph %s as well as its word", (value, glyph) => {
    const view = render(<StatusBadge value={value} />);
    view.getByText(glyph);
  });

  test("no state renders nothing", () => {
    const view = render(<Badge>{""}</Badge>);
    expect(view.container.innerHTML).toBe("");
  });
});

describe("Facts", () => {
  test("an empty fact is left out, so no stray dot is drawn", () => {
    const view = render(<Facts>{["L-3", "", "hydra"]}</Facts>);
    expect(view.container.querySelectorAll(".ui-fact")).toHaveLength(2);
  });
});

describe("ErrorState", () => {
  test("says what failed and offers Try again, with the tracker's own hint under it", () => {
    const onRetry = mock(() => {});
    const error = new ApiError({ code: "nope", message: "No line L-9.", hint: "Check the ref" });
    const view = render(<ErrorState title="Could not load the plan." error={error} onRetry={onRetry} />);
    view.getByText("Could not load the plan.");
    view.getByText(/No line L-9\./);
    view.getByText("Check the ref");
    fireEvent.click(view.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("a network failure reads as the tracker not answering", () => {
    const view = render(<ErrorState error={new TypeError("Failed to fetch")} />);
    view.getByText(/The tracker did not answer\./);
    expect(view.queryByText(/Failed to fetch/)).toBeNull();
  });

  test("raw error text never reaches the page", () => {
    const view = render(<ErrorState error={new SyntaxError("Unexpected token < in JSON at position 0")} />);
    view.getByText(/The tracker sent something this page does not understand\. Reload\./);
    expect(view.queryByText(/Unexpected token/)).toBeNull();
  });
});

describe("NotKept", () => {
  test("says the words are kept here and will save, in place of the raw error", () => {
    const view = render(<NotKept unsaved />);
    view.getByText("Not saved: the tracker did not answer. Kept here; saves when it is back.");
  });
});

describe("Toast", () => {
  test("a choice that did not happen leads with saying so", () => {
    const view = render(
      <Toast failed actions={null}>
        Table L-3
      </Toast>,
    );
    view.getByText(/Did not happen:/);
  });
});

function PageKeys({ onJ }: { onJ(): void }) {
  useHotkeys({ j: onJ });
  return null;
}

function SheetKeys({ onOne }: { onOne(): void }) {
  useHotkeys({ "1": onOne });
  return <p>inside</p>;
}

describe("a sheet holds the keys", () => {
  test("keys behind an open sheet stand down, its own keys act, and it takes the focus", () => {
    const onJ = mock(() => {});
    const onOne = mock(() => {});
    const view = render(
      <>
        <PageKeys onJ={onJ} />
        <Sheet title="New line" onClose={() => {}}>
          <SheetKeys onOne={onOne} />
        </Sheet>
      </>,
    );
    fireEvent.keyDown(window, { key: "j" });
    expect(onJ).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "1" });
    expect(onOne).toHaveBeenCalledTimes(1);
    expect(view.getByRole("dialog", { name: "New line" }).contains(document.activeElement)).toBe(true);
    view.unmount();
    const after = render(<PageKeys onJ={onJ} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onJ).toHaveBeenCalledTimes(1);
    after.unmount();
  });
});

describe("Table", () => {
  test("is one sheet with its column headings over hairline rows, and what follows the rows inside it", () => {
    const view = render(
      <Table label="Agents" columns={["Agent", "Repo", ""]} foot={<p>3 more</p>}>
        <tr>
          <Cell place="lead">panel</Cell>
          <Cell place="fact">PANEL</Cell>
          <Cell place="trailing">Stop</Cell>
        </tr>
      </Table>,
    );
    const table = view.getByRole("table", { name: "Agents" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Agent", "Repo", ""]);
    within(table).getByRole("cell", { name: "panel" });
    view.getByText("3 more");
  });
});
