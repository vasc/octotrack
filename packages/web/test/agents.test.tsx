import { describe, expect, mock, test } from "bun:test";
import type { AgentView } from "@octotrack/core/schemas";
import { fireEvent, render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { AgentRoster } from "../src/components/agents/AgentRoster.tsx";
import { AgentRosterRow } from "../src/components/agents/AgentRosterRow.tsx";
import { agentView } from "../src/design/fixtures.ts";
import { whenText } from "../src/lib/format.ts";
import { whole, iconsIn } from "./harness.tsx";

const noop = () => {};
const NOW = Date.parse("2026-11-14T12:00:00.000Z");

/** A row is drawn in the roster's table. */
function inTable(row: ReactNode) {
  return render(
    <table>
      <tbody>{row}</tbody>
    </table>,
  );
}

function row(overrides: Partial<AgentView>, props: { waitsOnYou?: boolean; busy?: boolean } = {}) {
  return inTable(
    <AgentRosterRow
      agent={agentView(overrides)}
      now={NOW}
      onStop={noop}
      onLift={noop}
      onRelease={noop}
      {...props}
    />,
  );
}

describe("AgentRosterRow", () => {
  test.each([
    ["running", "dot"],
    ["asleep", "half"],
    ["quiet", "ring"],
    ["stopped", "square"],
    ["gone", "cross"],
  ] as const)("a %s agent carries its mark as well as its words", (state, mark) => {
    const view = row({ state });
    expect(iconsIn(view.container)).toContain(mark);
  });

  test("its cells are its name, its repo's key, what it is doing now and when it was last seen", () => {
    const view = row({ state: "running", lines: [{ line: "L-59", role: "owner" }] });
    const its = within(view.getByRole("row", { name: "panel" }));
    // Its name heads its row.
    expect(its.getByRole("rowheader").textContent).toBe("panel");
    const cells = its.getAllByRole("cell");
    expect(cells[0]?.textContent).toBe("PANEL");
    // How it is woken is said only while it sleeps.
    within(cells[1] ?? document.body).getByText(whole("running, owner of L-59"));
    expect(cells[2]?.textContent).toBe("3h");
    view.unmount();
    row({ state: "asleep", lines: [{ line: "L-59", role: "owner" }] }).getByText(
      whole("asleep, owner of L-59 · wakes by screen"),
    );
  });

  test("says its role on its line and when that line waits on the developer", () => {
    row(
      { state: "running", lines: [{ line: "L-59", role: "owner" }], wakeAddress: null },
      { waitsOnYou: true },
    ).getByText(whole("running, owner of L-59; its line waits on you"));
  });

  test("an agent on several lines names each, as what, and Release frees it from all of them", () => {
    row({
      state: "running",
      lines: [
        { line: "L-59", role: "owner" },
        { line: "L-61", role: "helper" },
      ],
    }).getByText(whole("running, owner of L-59 and helper of L-61"));
    const view = inTable(
      <AgentRosterRow
        agent={agentView({
          state: "quiet",
          lines: [
            { line: "L-24", role: "owner" },
            { line: "L-30", role: "scoper" },
          ],
          wakeAddress: null,
        })}
        onStop={noop}
        onLift={noop}
        onRelease={noop}
      />,
    );
    view.getByText(whole("quiet, still holding L-24 and L-30"));
    view.getByRole("button", { name: "Release panel from L-24 and L-30" });
  });

  test("a quiet agent still holding a line says so, and offers Release", () => {
    const onRelease = mock((_name: string) => {});
    const view = inTable(
      <AgentRosterRow
        agent={agentView({ state: "quiet", lines: [{ line: "L-24", role: "owner" }], wakeAddress: null })}
        onStop={noop}
        onLift={noop}
        onRelease={onRelease}
      />,
    );
    view.getByText(whole("quiet, still holding L-24"));
    expect(view.queryByRole("button", { name: "Stop panel" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Release panel from L-24" }));
    expect(onRelease).toHaveBeenCalledWith("panel");
  });

  test("a running agent on no line is idle", () => {
    row({ state: "running", lines: [] }).getByText(whole("idle: nothing to take or scope in its repo"));
  });

  test("tells the developer's Stop from Octotrack's, and offers Lift", () => {
    const stoppedAt = new Date(2026, 10, 14, 10, 2).toISOString();
    const onLift = mock((_name: string) => {});
    const mine = inTable(
      <AgentRosterRow
        agent={agentView({
          state: "stopped",
          stoppedAt,
          stoppedReason: "wrong repo",
          lines: [],
        })}
        onStop={noop}
        onLift={onLift}
        onRelease={noop}
      />,
    );
    // Whoever stopped it, the developer or an agent, the log names; the row says it is stopped, when and why.
    mine.getByText(whole(`stopped ${whenText(stoppedAt)}: “wrong repo”`));
    fireEvent.click(mine.getByRole("button", { name: "Lift panel" }));
    expect(onLift).toHaveBeenCalledWith("panel");
    mine.unmount();
  });

  test("a session started for a line that never ran a command is marked with the triangle, with how its start went", () => {
    const view = row({
      name: "trips.2",
      lines: [],
      wakeAddress: null,
      startedBy: "octotrack",
      state: "gone",
      start: { line: "L-46", state: "failed", attempts: 3, since: "2026-11-10T09:00:00.000Z", exitCode: 127 },
    });
    const now = within(view.getByRole("row", { name: "trips.2" }));
    expect(iconsIn(view.getByRole("row", { name: "trips.2" }))).toContain("alert");
    now.getByText(whole("started for L-46; exits at once (exit 127), retried since Tuesday"));
    now.getByText("never");
    row({
      lines: [],
      start: {
        line: "L-46",
        state: "never_took",
        attempts: 1,
        since: "2026-11-14T09:00:00.000Z",
        exitCode: null,
      },
    }).getByText(whole("started for L-46; ran but never took its line"));
  });

  test("a gone agent names the line it last owned, or why its wake failed, and has nothing to press", () => {
    const view = row({ state: "gone", lines: [], lastLine: "L-9" });
    view.getByText(whole("gone, last owner of L-9"));
    expect(view.queryByRole("button", { name: /^(Stop|Lift|Release)/ })).toBeNull();
    view.unmount();
    row({ state: "gone", lines: [], wakeError: "tmux: no session “video-agent”" }).getByText(
      whole("gone: its wake failed (tmux: no session “video-agent”)"),
    );
  });

  test("shows the agent's own note under what it is doing", () => {
    row({ state: "running", note: "Printing the base" }).getByText("Printing the base");
  });

  test("Stop says it is on its way while its choice waits, and cannot be pressed again", () => {
    const stop = row({ state: "running" }, { busy: true }).getByRole("button", { name: "Stopping panel" });
    expect(stop.textContent).toContain("Stopping…");
    expect(stop.hasAttribute("disabled")).toBe(true);
    expect(stop.getAttribute("aria-busy")).toBe("true");
  });
});

describe("AgentRoster", () => {
  const rows = (agent: AgentView) => (
    <tr key={agent.name}>
      <td>{agent.name}</td>
    </tr>
  );

  test("is a table headed Agent, Repo, Now and Last seen", () => {
    const view = render(<AgentRoster agents={[agentView()]} row={rows} />);
    const table = view.getByRole("table", { name: "Agents" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Agent", "Repo", "Now", "Last seen", "Actions"]);
  });

  test("running, stopped and gone agents always show; quiet ones fold after the first few", () => {
    const agents = [
      agentView({ name: "builder", state: "running" }),
      ...["a", "b", "c", "d", "e"].map((name) => agentView({ name, state: "quiet", lines: [] })),
      agentView({ name: "halted", state: "stopped" }),
    ];
    const view = render(<AgentRoster agents={agents} row={rows} />);
    view.getByText("builder");
    view.getByText("halted");
    view.getByText("c");
    expect(view.queryByText("d")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "2 more quiet: d, e" }));
    view.getByText("e");
  });
});
