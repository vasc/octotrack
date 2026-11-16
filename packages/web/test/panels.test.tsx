import { describe, test } from "bun:test";
import { render } from "@testing-library/react";
import { DriftItem } from "../src/components/drift/DriftItem.tsx";
import { EntityCrumbs } from "../src/components/entity/EntityCrumbs.tsx";
import { drift } from "../src/design/fixtures.ts";

describe("DriftItem", () => {
  test("its title says what to check, and its note says it is required and what to write", () => {
    const view = render(
      <DriftItem drift={drift({ rule: "decision-project-sync", target: "INFRA" })} onAck={() => {}} />,
    );
    view.getByText("Check INFRA still describes reality");
    view.getByLabelText(/Note · required: what changed, or why nothing had to/);
  });
});

describe("EntityCrumbs", () => {
  test("says what kind of item it is in words, with its repo", () => {
    const view = render(
      <EntityCrumbs
        summary={{
          kind: "pr",
          ref: "PR-1",
          title: "Feat: Draft prs",
          status: "open",
          project: "STACK",
          priority: null,
          assignee: null,
          version: 1,
          updatedAt: "",
        }}
      />,
    );
    view.getByText("Pull request");
    view.getByText("STACK");
    view.getByText("PR-1");
  });
});
