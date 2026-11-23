import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { LinePanelHead } from "../src/components/entity/LinePanelHead.tsx";
import { ProposalCase } from "../src/components/home/ProposalCase.tsx";
import { ProposalGroups } from "../src/components/home/ProposalGroups.tsx";
import { Options } from "../src/components/ui/Options.tsx";
import { Row } from "../src/components/ui/Row.tsx";
import { line } from "../src/design/fixtures.ts";
import { timeAgo } from "../src/lib/format.ts";
import { whole } from "./harness.tsx";

describe("audit fixes", () => {
  test("each folded group's Show is named for its group", () => {
    const view = render(
      <ProposalGroups
        proposals={[
          line({ ref: "L-1", state: "proposed", recommendation: "start" }),
          line({ ref: "L-2", state: "proposed", recommendation: "up_next" }),
          line({ ref: "L-3", state: "proposed", recommendation: "table" }),
        ]}
        card={(proposal) => <p key={proposal.ref}>{proposal.title}</p>}
      />,
    );
    view.getByRole("button", { name: "Show Recommended for up next" });
    view.getByRole("button", { name: "Show Recommended to table" });
  });

  test("a recommendation with no reason ends with a full stop, not a dangling colon", () => {
    const view = render(<ProposalCase line={line({ state: "proposed", recommendation: "start" })} />);
    view.getByText(whole("Recommends Start."));
  });

  test("a tabled line's look-again date is a date in words", () => {
    const view = render(
      <LinePanelHead
        line={line({ state: "tabled", tabledReason: "Winter", lookAgainAt: "2026-12-01" })}
        repos={[]}
        now={Date.parse("2026-11-16T12:00:00Z")}
      />,
    );
    view.getByText("Tue 1 Dec");
  });

  test("past a month, how long ago is a short date", () => {
    expect(timeAgo("2026-10-01T09:00:00Z", Date.parse("2026-11-16T12:00:00Z"))).toBe("1 Oct");
  });

  test("a row's kind word is set apart in its tone, the facts after it in grey", () => {
    const view = render(<Row kind="Task for you · PANEL-1 · at the bench" title="Measure" />);
    const word = view.getByText("Task for you");
    expect(word.getAttribute("data-tone")).toBe("needs");
  });

  test("an option keeps its description and reason for a screen reader", () => {
    const view = render(
      <Options
        options={[
          { key: "a", label: "Black", description: "Hides the cable.", recommended: true, why: "cable" },
        ]}
        onPick={() => {}}
      />,
    );
    const button = view.getByRole("button", { name: "Black, recommended" });
    expect(button.getAttribute("aria-describedby")).not.toBeNull();
  });
});
