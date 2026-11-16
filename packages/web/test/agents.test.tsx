import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { AgentRoster } from "../src/components/agents/AgentRoster.tsx";
import { AgentRosterRow } from "../src/components/agents/AgentRosterRow.tsx";
import { agentView } from "../src/design/fixtures.ts";

const noop = () => {};

describe("AgentRosterRow", () => {
  test.each([
    ["running", "●"],
    ["asleep", "◐"],
    ["quiet", "○"],
    ["stopped", "■"],
    ["gone", "✕"],
  ] as const)("a %s agent carries its glyph as well as its words", (state, glyph) => {
    const view = render(
      <AgentRosterRow agent={agentView({ state })} onStop={noop} onLift={noop} onRelease={noop} />,
    );
    view.getByText(glyph);
  });
});

describe("AgentRoster", () => {
  test("running, stopped and gone agents always show; quiet ones fold after the first few", () => {
    const agents = [
      agentView({ name: "builder", state: "running" }),
      ...["a", "b", "c", "d", "e"].map((name) => agentView({ name, state: "quiet", line: null })),
      agentView({ name: "halted", state: "stopped" }),
    ];
    const view = render(
      <AgentRoster agents={agents} row={(agent) => <p key={agent.name}>{agent.name}</p>} />,
    );
    view.getByText("builder");
    view.getByText("halted");
    view.getByText("c");
    expect(view.queryByText("d")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "2 more quiet: d, e" }));
    view.getByText("e");
  });
});

describe("an agent's action while its choice waits", () => {
  test("says it is on its way and cannot be pressed again", () => {
    const view = render(
      <AgentRosterRow
        agent={agentView({ state: "running" })}
        busy
        onStop={noop}
        onLift={noop}
        onRelease={noop}
      />,
    );
    const stop = view.getByRole("button", { name: "Stop panel" });
    expect(stop.textContent).toBe("Stopping…");
    expect(stop.hasAttribute("disabled")).toBe(true);
    expect(stop.getAttribute("aria-busy")).toBe("true");
  });
});
