import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { Field } from "../src/components/ui/Field.tsx";
import { Link } from "../src/components/ui/Link.tsx";
import { List } from "../src/components/ui/List.tsx";
import MarkdownView from "../src/components/ui/MarkdownView.tsx";
import { Note } from "../src/components/ui/Note.tsx";
import { Pairs } from "../src/components/ui/Pairs.tsx";
import { SearchField } from "../src/components/ui/SearchField.tsx";

const noop = () => {};

describe("Field", () => {
  test("invalid marks the box and says why under it, read with the box", () => {
    const view = render(
      <Field label="Checkout" value="hydra" onChange={noop} invalid note="A full path, starting with /" />,
    );
    const box = view.getByLabelText("Checkout");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    const why = view.getByText("A full path, starting with /");
    expect(box.getAttribute("aria-describedby")).toBe(why.id);
    expect(why.getAttribute("data-invalid")).toBe("true");
  });

  test("a valid box with a note is described by it and is not invalid", () => {
    const view = render(<Field label="Words" value="" onChange={noop} note="Saved as you type" />);
    const box = view.getByLabelText("Words");
    expect(box.getAttribute("aria-invalid")).toBeNull();
    expect(box.getAttribute("aria-describedby")).toBe(view.getByText("Saved as you type").id);
  });

  test("disabled cannot be typed in", () => {
    const view = render(<Field label="Words" value="" onChange={noop} disabled />);
    expect(view.getByLabelText("Words").hasAttribute("disabled")).toBe(true);
  });
});

describe("empty containers draw nothing", () => {
  test("a List with no rows", () => {
    const { container } = render(<List>{[]}</List>);
    expect(container.innerHTML).toBe("");
  });

  test("Pairs whose values are all empty", () => {
    const { container } = render(
      <Pairs
        pairs={[
          ["Checks", null],
          ["Reviews", ""],
        ]}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("Link", () => {
  test("says where it goes: → stays in the app, ↗ leaves it, neither read out", () => {
    const view = render(
      <p>
        <Link href="/log?q=L-3" onGo={noop}>
          This line in the log
        </Link>{" "}
        <Link href="https://github.com/vasc/stack/pull/4" external>
          vasc/stack#4
        </Link>
      </p>,
    );
    const inside = view.getByRole("link", { name: "This line in the log" });
    expect(inside.textContent).toBe("This line in the log →");
    const outside = view.getByRole("link", { name: "vasc/stack#4" });
    expect(outside.textContent).toBe("vasc/stack#4 ↗");
  });

  test("a link in written text carries ↗ and is a link of the house's look", () => {
    const view = render(<MarkdownView text="See [the docs](https://example.com)." inline />);
    const link = view.getByRole("link", { name: "the docs" });
    expect(link.textContent).toBe("the docs ↗");
    expect(link.className).toBe("ui-link");
  });
});

describe("Note", () => {
  test("an error carries the tracker's hint as the line under it", () => {
    const view = render(
      <Note error hint="Run octo line show L-3 to see its state.">
        It changed meanwhile.
      </Note>,
    );
    const note = view.getByRole("alert");
    expect(note.textContent).toBe("It changed meanwhile.Run octo line show L-3 to see its state.");
    view.getByText("Run octo line show L-3 to see its state.");
  });
});

describe("SearchField", () => {
  test("the highlighted completion is the box's active descendant", () => {
    const view = render(
      <SearchField
        label="Filter"
        value="li"
        onChange={noop}
        completions={[
          { term: "line:", hint: "a line" },
          { term: "kind:", hint: "a kind" },
        ]}
        onTake={noop}
      />,
    );
    const box = view.getByRole("combobox", { name: "Filter" });
    fireEvent.focus(box);
    const first = view.getByRole("option", { name: /line:/ });
    expect(box.getAttribute("aria-activedescendant")).toBe(first.id);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toBe(view.getByRole("option", { name: /kind:/ }).id);
  });
});
