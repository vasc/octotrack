import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { DriftAnswer } from "../src/components/drift/DriftAnswer.tsx";
import { EntityBody } from "../src/components/entity/EntityBody.tsx";
import { LinkList } from "../src/components/entity/LinkList.tsx";
import { drift, idea, line, project } from "../src/design/fixtures.ts";

describe("EntityBody", () => {
  test("a repo says its GitHub name, its checkout here, and its lines with their state", () => {
    const view = render(
      <EntityBody
        entity={project()}
        links={[]}
        lines={[
          line({ ref: "L-56", title: "Wall mount", state: "working", repos: ["PANEL"] }),
          line({ ref: "L-9", title: "Elsewhere", state: "working", repos: ["OCT"] }),
        ]}
      />,
    );
    view.getByText("GitHub");
    view.getByText("acme/homepanel");
    view.getByText("Checkout");
    view.getByText("none on this machine");
    const lines = within(view.getByRole("region", { name: /^Lines/ }));
    lines.getByText("Wall mount");
    lines.getByText("working");
    expect(lines.queryByText("Elsewhere")).toBeNull();
    expect(view.queryByText("Horizon")).toBeNull();
  });

  test("an old idea says what it became", () => {
    const view = render(
      <EntityBody
        entity={idea()}
        links={[]}
        lines={[line({ ref: "L-6", title: "test devices via TestFlight", fromRef: "I-7" })]}
      />,
    );
    view.getByText("Became");
    view.getByRole("button", { name: "L-6" });
    view.getByText(/test devices via TestFlight/);
  });

  test("an old idea that became nothing shows its old fields, labelled from before lines", () => {
    const view = render(<EntityBody entity={idea({ horizon: "later" })} links={[]} lines={[]} />);
    view.getByText("From before lines");
    view.getByText("later");
  });
});

describe("DriftAnswer", () => {
  test("its note is required, and both answers wait for words", () => {
    const onAck = mock((_ref: string, _mode: string, _note: string) => {});
    const view = render(<DriftAnswer drift={drift({ edge: true })} onAck={onAck} />);
    const updated = view.getByRole("button", { name: "Updated" });
    expect(updated.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Note · required: what changed, or why nothing had to"), {
      target: { value: "Rewrote it" },
    });
    fireEvent.click(view.getByRole("button", { name: "Updated" }));
    expect(onAck).toHaveBeenCalledWith("DR-1", "updated", "Rewrote it");
  });
});

describe("LinkList", () => {
  test("a connection to something gone says it no longer exists", () => {
    const view = render(
      <LinkList
        entityRef="OCT-1"
        links={[{ fromRef: "OCT-1", rel: "blocks", toRef: "OCT-9", createdAt: "", createdBy: "dev" }]}
        linked={[]}
      />,
    );
    view.getByText("no longer exists");
  });
});
