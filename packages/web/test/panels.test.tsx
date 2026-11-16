import { describe, test } from "bun:test";
import { render } from "@testing-library/react";
import { DriftItem } from "../src/components/drift/DriftItem.tsx";
import { EntityCrumbs } from "../src/components/entity/EntityCrumbs.tsx";
import { drift, pr } from "../src/design/fixtures.ts";
import { PrPanel } from "../src/components/entity/PrPanel.tsx";

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

describe("PrPanel", () => {
  test("says its state, where it lives, who opened it and its size in one row of facts, then a conflict first among them", () => {
    const view = render(
      <PrPanel
        pr={pr({
          repo: "vasc/stack",
          number: 4,
          author: "vasc",
          additions: 33,
          deletions: 2,
          mergeable: "conflicting",
          headRef: "feat/draft-prs",
          baseRef: "main",
          checks: "none",
          review: "none",
        })}
        now={Date.parse("2026-11-16T12:00:00Z")}
      />,
    );
    view.getByText("Open");
    view.getByRole("link", { name: /vasc\/stack#4/ });
    view.getByText("+33 −2");
    view.getByText("Merge");
    view.getByText(/conflicts with main; feat\/draft-prs needs a rebase/);
    view.getByText("none run");
    view.getByText("none asked");
  });
});
