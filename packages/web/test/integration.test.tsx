import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.tsx";
import { navigate } from "../src/lib/router.ts";
import {
  contracts as c,
  FakeEventSource,
  renderApp,
  startTestServer,
  fakePush,
  type TestServer,
  whole,
} from "./harness.tsx";

let server: TestServer;

/**
 * Waits for an element to go away. Not expect(...).toBeNull() inside waitFor: when that fails, formatting a whole DOM
 * node into the message takes so long that it starves the event loop and the wait times out for the wrong reason.
 */
async function gone(query: () => Element | null): Promise<void> {
  await waitFor(() => {
    if (query() !== null) throw new Error("Still on screen");
  });
}

/** Answers wait a few seconds with Undo; Now applies the newest one at once, as a person in a hurry would. */
async function answerNow(view: {
  findAllByRole: (role: string, options: { name: string }) => Promise<HTMLElement[]>;
}) {
  const buttons = await view.findAllByRole("button", { name: "Now" });
  fireEvent.click(buttons.at(0) ?? document.body);
}

function seedDecision(extra: Record<string, unknown> = {}) {
  return server.act(c.decisionAsk, {
    title: "Which queue?",
    project: "OCT",
    priority: "high",
    options: [
      { key: "sqs", label: "SQS" },
      { key: "redis", label: "Redis" },
    ],
    recommendation: "redis",
    ...extra,
  });
}

beforeEach(() => {
  server = startTestServer();
  server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
  // Most of these are about the log; home has its own tests below.
  navigate("/log");
});

describe("the feed", () => {
  test("puts decisions in front, with the feed under them, from one bootstrap", async () => {
    seedDecision();
    server.act(c.issueCreate, { project: "OCT", title: "A task" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    await view.findByText(/created: A task/);
    within(view.getByRole("feed")).getByText(/needs a decision/);
  });

  test("deciding in place removes the card, records it, and flows to the feed and to drift", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });

    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    fireEvent.change(view.getByLabelText(`Note for ${decision.ref}`), {
      target: { value: "Already deployed" },
    });
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
    await answerNow(view);

    await gone(() => view.queryByRole("heading", { name: "Which queue?" }));

    const stored = server.act(c.decisionList, { query: `ref:${decision.ref}` })[0];
    expect(stored).toMatchObject({
      status: "decided",
      chosenOption: "redis",
      resolutionNote: "Already deployed",
      channel: "dashboard",
      decidedBy: "dev",
    });
    await within(view.getByRole("feed")).findByText(/decided: "Redis"/);
    expect(server.act(c.driftList, {}).map((drift) => drift.rule)).toEqual(["decision-project-sync"]);
    // The answer went through the Undo window and was applied as the developer, through the dashboard.
    expect(server.calls).toContain("choice.make");
  });

  test("a decision made elsewhere can be marked so while deciding in place", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.click(view.getByRole("button", { name: /SQS/ }));
    fireEvent.click(view.getByRole("checkbox", { name: "decided elsewhere" }));
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.channel).toBe("out_of_band"),
    );
  });

  test("a refused decision keeps the card on screen and says why", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    // The agent changed the options after the page loaded, so the choice on screen no longer exists.
    server.act(c.decisionUpdate, { ref: decision.ref, options: [{ key: "kafka", label: "Kafka" }] });
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
    await answerNow(view);
    const alert = await view.findByRole("alert");
    expect(alert.textContent).toContain('no option "redis"');
    view.getByRole("heading", { name: "Which queue?" });
    expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.status).toBe("open");
  });

  test("a decision someone else just made is refused rather than overwritten", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    server.act(c.decisionResolve, { ref: decision.ref, option: "sqs" }, "agent-b");
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
    await gone(() => view.queryByRole("heading", { name: "Which queue?" }));
    expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.chosenOption).toBe("sqs");
  });

  test("number keys pick an option on the top card and Enter decides", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.keyDown(window, { key: "2" });
    await waitFor(() =>
      expect(view.getByRole("button", { name: /Redis/ }).getAttribute("aria-pressed")).toBe("true"),
    );
    fireEvent.keyDown(window, { key: "Enter" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.chosenOption).toBe("redis"),
    );
  });

  test("one decision is open at a time so that the feed stays in view, and j and k move between them", async () => {
    seedDecision({ title: "First", priority: "urgent" });
    seedDecision({ title: "Second", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "First" });
    view.getByRole("button", { name: "Second" });
    expect(view.queryByRole("heading", { name: "Second" }) === null).toBe(true);

    fireEvent.keyDown(window, { key: "j" });
    await view.findByRole("heading", { name: "Second" });
    view.getByRole("button", { name: "First" });

    fireEvent.keyDown(window, { key: "k" });
    await view.findByRole("heading", { name: "First" });

    fireEvent.click(view.getByRole("button", { name: "Second" }));
    await view.findByRole("heading", { name: "Second" });
  });

  test("a re-rank cannot swap the open card, so a keypress cannot land on the wrong decision", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const first = seedDecision({ title: "The one being read", priority: "medium" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "The one being read" });
    fireEvent.change(view.getByLabelText(`Note for ${first.ref}`), { target: { value: "Half typed" } });

    const urgent = seedDecision({ title: "Arrived while reading", priority: "urgent" });
    await view.findByRole("button", { name: "Arrived while reading" });

    view.getByRole("heading", { name: "The one being read" });
    expect(view.getByLabelText(`Note for ${first.ref}`).getAttribute("value")).toBe("Half typed");

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "Enter" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${first.ref}` })[0]?.status).toBe("decided"),
    );
    expect(server.act(c.decisionList, { query: `ref:${urgent.ref}` })[0]?.status).toBe("open");
  });

  test("moving between decisions keeps a half-typed answer", async () => {
    const first = seedDecision({ title: "First", priority: "urgent" });
    seedDecision({ title: "Second", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "First" });
    fireEvent.change(view.getByLabelText(`Note for ${first.ref}`), { target: { value: "Half typed" } });
    fireEvent.keyDown(window, { key: "j" });
    await view.findByRole("heading", { name: "Second" });
    fireEvent.keyDown(window, { key: "k" });
    await view.findByRole("heading", { name: "First" });
    expect(view.getByLabelText(`Note for ${first.ref}`).getAttribute("value")).toBe("Half typed");
  });

  test("a filter that matches only far back in a long log finds it instead of claiming nothing matches", async () => {
    server.tracker.batch(
      {
        ops: Array.from({ length: 5100 }, (_, index) => ({
          op: "update.post",
          input: { body: `Noise ${index}`, project: "OCT" },
        })),
      },
      { actor: "agent-a", channel: "cli" },
    );
    navigate("/log?q=event%3Aproject.created");
    const view = renderApp(<App />);
    await within(await view.findByRole("feed")).findByText(/Project OCT created/);
    expect(view.queryByText("Nothing matches this filter.") === null).toBe(true);
  });

  test("with the inspector open on a decision, the keys answer that decision and not the queue's", async () => {
    const top = seedDecision({ title: "Top of the queue", priority: "urgent" });
    const other = seedDecision({ title: "Being inspected", priority: "low" });
    navigate(`/log?ref=${other.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: other.ref }));
    await panel.findByRole("button", { name: /SQS/ });
    fireEvent.keyDown(window, { key: "1" });
    await waitFor(() =>
      expect(panel.getByRole("button", { name: /SQS/ }).getAttribute("aria-pressed")).toBe("true"),
    );
    fireEvent.keyDown(window, { key: "Enter" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${other.ref}` })[0]?.status).toBe("decided"),
    );
    expect(server.act(c.decisionList, { query: `ref:${top.ref}` })[0]?.status).toBe("open");
  });

  test("when the open decision goes away, the keys do nothing until you say which one you mean", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const first = seedDecision({ title: "Was open", priority: "urgent" });
    const second = seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Was open" });

    server.act(c.decisionWithdraw, { ref: first.ref });
    await view.findByRole("heading", { name: "Next in line" });
    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "Enter" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.act(c.decisionList, { query: `ref:${second.ref}` })[0]?.status).toBe("open");
    await view.findByText(/Press j to answer this one/);

    fireEvent.keyDown(window, { key: "j" });
    await gone(() => view.queryByText(/Press j to answer this one/));
    fireEvent.keyDown(window, { key: "1" });
    await waitFor(() =>
      expect(view.getByRole("button", { name: /SQS/ }).getAttribute("aria-pressed")).toBe("true"),
    );
    fireEvent.keyDown(window, { key: "Enter" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${second.ref}` })[0]?.status).toBe("decided"),
    );
  });

  test("on a phone, tapping answers the next card without the keyboard's extra step", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const first = seedDecision({ title: "Was open", priority: "urgent" });
    const second = seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Was open" });

    server.act(c.decisionWithdraw, { ref: first.ref });
    await view.findByRole("heading", { name: "Next in line" });
    expect(view.getByText(/Press j to answer this one/).classList.contains("keyboard-hint")).toBe(true);

    fireEvent.click(view.getByRole("button", { name: /SQS/ }));
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${second.ref}` })[0]?.status).toBe("decided"),
    );
  });

  test("when no offered option applies, you can answer in your own words", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    const decide = view.getByRole("button", { name: "Decide" });

    fireEvent.click(view.getByRole("button", { name: /Something else/ }));
    expect(decide.hasAttribute("disabled")).toBe(true);
    const note = view.getByLabelText(`Note for ${decision.ref}`);
    expect(note.getAttribute("placeholder")).toBe("Your answer");
    expect(document.activeElement).toBe(note);
    fireEvent.change(note, { target: { value: "Neither, use Kafka" } });
    fireEvent.click(decide);
    await answerNow(view);

    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]).toMatchObject({
        status: "decided",
        chosenOption: null,
        resolutionNote: "Neither, use Kafka",
      }),
    );
  });

  test("choosing an option after Something else answers with that option", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });

    fireEvent.click(view.getByRole("button", { name: /Something else/ }));
    fireEvent.click(view.getByRole("button", { name: /SQS/ }));
    expect(view.getByRole("button", { name: /Something else/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.chosenOption).toBe("sqs"),
    );
  });

  test("Later moves on to the next decision and leaves the one put off last, still open", async () => {
    const first = seedDecision({ title: "Not ready", priority: "urgent" });
    seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });

    fireEvent.click(view.getByRole("button", { name: "Later" }));
    await view.findByRole("heading", { name: "Next in line" });
    await answerNow(view);
    await view.findAllByText("later");
    expect(server.act(c.decisionQueue, {}).map((card) => card.decision.title)).toEqual([
      "Next in line",
      "Not ready",
    ]);
    expect(server.act(c.decisionList, { query: `ref:${first.ref}` })[0]?.status).toBe("open");
  });

  test("the p key puts off the card the keys are armed for", async () => {
    seedDecision({ title: "Not ready", priority: "urgent" });
    seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });
    fireEvent.keyDown(window, { key: "p" });
    await answerNow(view);
    await waitFor(() => expect(server.act(c.decisionQueue, {})[0]?.decision.title).toBe("Next in line"));
  });

  test("a postponed decision can be brought back", async () => {
    const decision = seedDecision({ title: "Not ready" });
    server.act(c.decisionPostpone, { ref: decision.ref });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });
    fireEvent.click(view.getByRole("button", { name: "Bring back" }));
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.postponedAt).toBeNull(),
    );
  });

  test("the decisions page shows answers nobody has picked up, until the agent does", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const decision = seedDecision({ title: "Answered already" });
    server.tracker.call(
      c.decisionResolve,
      { ref: decision.ref, option: "sqs" },
      { actor: "dev", channel: "dashboard" },
    );
    navigate("/decisions");
    const view = renderApp(<App />);
    const section = await view.findByRole("heading", { name: /Answered, not picked up/ });
    expect(section).not.toBeNull();
    server.act(c.decisionPickup, { ref: decision.ref });
    await gone(() => view.queryByRole("heading", { name: /Answered, not picked up/ }));
    await view.findAllByText("picked up");
  });

  test("a long queue does not push the feed off the screen", async () => {
    for (const index of [1, 2, 3, 4, 5, 6, 7, 8, 9]) seedDecision({ title: `Question ${index}` });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Question 1" });

    const queue = view.getByRole("heading", { name: "Question 1" }).closest(".queue");
    expect(queue?.querySelectorAll(".queue-more")).toHaveLength(5);
    fireEvent.click(view.getByRole("button", { name: "3 more decisions" }));
    await view.findByRole("heading", { name: "Decisions" });
  });

  test("the decisions page lists every decision in the queue", async () => {
    for (const index of [1, 2, 3, 4, 5, 6, 7, 8, 9]) seedDecision({ title: `Question ${index}` });
    navigate("/decisions");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Question 1" });

    const queue = view.getByRole("heading", { name: "Question 1" }).closest(".queue");
    expect(queue?.querySelectorAll(".queue-more")).toHaveLength(8);
    expect(view.queryByRole("button", { name: /more decisions/ })).toBeNull();
  });

  test("the open card stays first, so that a re-rank cannot move the field being typed in", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const first = seedDecision({ title: "Being typed in", priority: "medium" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Being typed in" });
    const note = view.getByLabelText(`Note for ${first.ref}`);
    const queue = note.closest(".queue");
    const openFirst = () => queue?.firstElementChild?.contains(note) === true;
    expect(openFirst()).toBe(true);

    seedDecision({ title: "Outranks it", priority: "urgent" });
    await view.findByRole("button", { name: "Outranks it" });
    expect(openFirst()).toBe(true);
  });

  test("a chip for a name with a space still filters on that name", async () => {
    server.act(c.issueCreate, { project: "OCT", title: "By a spaced name" }, "my agent");
    server.act(c.issueCreate, { project: "OCT", title: "By another" }, "other");
    const view = renderApp(<App />);
    await view.findByText(/created: By a spaced name/);
    fireEvent.click(view.getAllByRole("button", { name: "my agent" })[0] ?? document.body);
    await gone(() => view.queryByText(/created: By another/));
    view.getByText(/created: By a spaced name/);
    expect(view.queryByText(/not a|Unknown/) === null).toBe(true);
  });

  test("the filter narrows both the queue and the feed, and stays in the URL", async () => {
    seedDecision();
    server.act(c.issueCreate, { project: "OCT", title: "A task" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.change(view.getByLabelText("Filter"), { target: { value: "kind:issue" } });
    await gone(() => view.queryByRole("heading", { name: "Which queue?" }));
    await gone(() => within(view.getByRole("feed")).queryByText(/needs a decision/));
    within(view.getByRole("feed")).getByText(/created: A task/);
    expect(window.location.search).toBe("?q=kind%3Aissue");
  });

  test("a half-typed filter shows the error and keeps the last results on screen", async () => {
    server.act(c.issueCreate, { project: "OCT", title: "A task" });
    const view = renderApp(<App />);
    await view.findByText(/created: A task/);
    fireEvent.change(view.getByLabelText("Filter"), { target: { value: "nope:" } });
    await view.findByText(/no value|Unknown field/);
    view.getByText(/created: A task/);
  });

  test("clicking a chip adds it to the filter", async () => {
    server.act(c.issueCreate, { project: "OCT", title: "Mine" }, "agent-a");
    server.act(c.issueCreate, { project: "OCT", title: "Theirs" }, "agent-b");
    const view = renderApp(<App />);
    await view.findByText(/created: Mine/);
    fireEvent.click(view.getAllByRole("button", { name: "agent-b" })[0] ?? document.body);
    await gone(() => view.queryByText(/created: Mine/));
    view.getByText(/created: Theirs/);
    expect(view.getByLabelText("Filter").getAttribute("value") ?? "").toContain("actor:agent-b");
  });

  test("views switch what is shown", async () => {
    seedDecision({ kind: "architecture" });
    server.act(c.issueCreate, { project: "OCT", title: "A task" });
    const view = renderApp(<App />);
    await view.findByText(/created: A task/);
    fireEvent.click(view.getByRole("button", { name: "Architecture" }));
    await gone(() => view.queryByText(/created: A task/));
    within(view.getByRole("feed")).getByText(/needs a decision/);
  });

  test("a push from the stream brings in new work without reloading", async () => {
    const view = renderApp(<App />);
    await view.findByText(/Project OCT created/);
    const source = FakeEventSource.instances[0];
    if (source === undefined) throw new Error("No event source");
    act(() => source.emit("hello"));
    await view.findByText("live");

    seedDecision({ title: "Pushed from an agent" });
    act(() => source.emit("change"));
    await view.findByRole("heading", { name: "Pushed from an agent" });
  });

  test("shows how to start when the tracker is empty", async () => {
    server = startTestServer();
    const view = renderApp(<App />);
    await view.findByText(/Point your agents at the guide/);
  });
});

describe("live updates, with nothing but the server's own notifications", () => {
  function setVisibility(state: "visible" | "hidden"): void {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  test("a change made by an agent reaches every part of the page without a reload", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const view = renderApp(<App />);
    await view.findByText(/Project OCT created/);
    const rail = within(view.getByRole("complementary", { name: "Overview" }));

    server.act(c.decisionAsk, { title: "Asked by an agent", project: "OCT" });
    await view.findByRole("heading", { name: "Asked by an agent" });
    await within(view.getByRole("link", { name: /Decisions/ })).findByText("1");

    server.act(c.prUpsert, {
      repo: "a/b",
      number: 1,
      title: "PR from an agent",
      state: "open",
      checks: "failing",
    });
    await rail.findByText("PR from an agent");
    await rail.findByRole("img", { name: "Checks failing" });

    server.act(c.prUpsert, {
      repo: "a/b",
      number: 1,
      title: "PR from an agent",
      state: "open",
      checks: "passing",
    });
    await rail.findByRole("img", { name: "Checks passing" });
    expect(rail.queryByRole("img", { name: "Checks failing" }) === null).toBe(true);

    server.act(c.updatePost, { body: "Status from an agent", project: "OCT" });
    await within(view.getByRole("feed")).findByText("Status from an agent");

    server.act(c.viewSave, { name: "Saved by an agent", query: "kind:pr" });
    await view.findByRole("button", { name: "Saved by an agent" });
  });

  test("changes that leave nothing in the feed still reach the page", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const decision = server.act(c.decisionAsk, { title: "Waited on", project: "OCT" });
    navigate("/agents");
    const view = renderApp(<App />);
    const main = within(view.getByRole("main"));
    await main.findByText("No agent is hanging on anything.");

    server.act(c.agentNote, { note: "Note from an agent" });
    await main.findByText("Note from an agent");

    const query = `ref:${decision.ref} status:decided`;
    const watch = server.act(c.watchCreate, {
      name: "later",
      spec: { require: "any", clauses: [{ type: "state", query, mode: "exists" }] },
    });
    await main.findByText("Registered, not polling");
    server.act(c.watchCheck, { refs: [watch.ref] });
    await gone(() => main.queryByText("No agent is hanging on anything."));
  });

  test("a change landing between the first load and the stream connecting is not lost", async () => {
    const view = renderApp(<App />);
    await view.findByText(/Project OCT created/);
    seedDecision({ title: "Slipped through the gap" });
    expect(view.queryByRole("heading", { name: "Slipped through the gap" }) === null).toBe(true);
    const source = FakeEventSource.instances[0];
    if (source === undefined) throw new Error("No event source");
    act(() => source.emit("hello"));
    await view.findByRole("heading", { name: "Slipped through the gap" });
  });

  test("a hidden tab gives up its connection and catches up when it comes back", async () => {
    const view = renderApp(<App />);
    await view.findByText(/Project OCT created/);
    expect(FakeEventSource.instances).toHaveLength(1);

    act(() => setVisibility("hidden"));
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    seedDecision({ title: "Asked while hidden" });

    act(() => setVisibility("visible"));
    const reopened = FakeEventSource.instances[1];
    if (reopened === undefined) throw new Error("It did not reconnect");
    act(() => reopened.emit("hello"));
    await view.findByRole("heading", { name: "Asked while hidden" });
    setVisibility("visible");
  });

  test("closing the page closes the stream", async () => {
    const view = renderApp(<App />);
    await view.findByText(/Project OCT created/);
    view.unmount();
    expect(FakeEventSource.instances.every((source) => source.closed)).toBe(true);
  });
});

describe("PR sync problems", () => {
  test("are shown beside the PRs, then go away once it works again", async () => {
    server = startTestServer({ live: true });
    server.tracker.call(
      c.projectCreate,
      { key: "APP", name: "App", repo: "acme/app" },
      { actor: "dev", channel: "dashboard" },
    );
    server.act(c.prSync, { prs: [], failures: [{ repo: "acme/app", error: "gh is not logged in" }] });
    const view = renderApp(<App />);
    await view.findByText(/PR status is stale for acme\/app: gh is not logged in/);
    server.act(c.prSync, { prs: [], repos: ["acme/app"] });
    await gone(() => view.queryByText(/PR status is stale/));
  });
});

describe("PR status", () => {
  test("is visible next to the feed, problems first", async () => {
    server.act(c.prUpsert, { repo: "a/b", number: 1, title: "Fine one", state: "open", checks: "passing" });
    server.act(c.prUpsert, { repo: "a/b", number: 2, title: "Broken one", state: "open", checks: "failing" });
    const view = renderApp(<App />);
    const rail = within(await view.findByRole("complementary", { name: "Overview" }));
    await rail.findByText("Broken one");
    const titles = rail.getAllByRole("button").map((button) => button.textContent);
    expect(titles.indexOf("Broken one")).toBeLessThan(titles.indexOf("Fine one"));
    rail.getByRole("img", { name: "Checks failing" });
  });

  test("the page filters and shows what is linked", async () => {
    const issue = server.act(c.issueCreate, { project: "OCT", title: "Thing" });
    server.act(c.prUpsert, { repo: "a/b", number: 1, title: "Open one", state: "open", issues: [issue.ref] });
    server.act(c.prUpsert, { repo: "a/b", number: 2, title: "Merged one", state: "merged" });
    navigate("/prs");
    const view = renderApp(<App />);
    const main = within(view.getByRole("main"));
    await main.findByText("Open one");
    main.getByText("Merged one");
    main.getByRole("button", { name: issue.ref });
    fireEvent.change(main.getByLabelText("Filter"), { target: { value: "state:merged" } });
    await gone(() => main.queryByText("Open one"));
  });
});

describe("decisions out of band", () => {
  test("the batch panel records many, and keeps the lines that failed", async () => {
    const first = seedDecision({ title: "First" });
    const second = seedDecision({ title: "Second" });
    navigate("/decisions");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "First" });

    const box = view.getByLabelText("Log decisions made elsewhere");
    fireEvent.change(box, { target: { value: `${first.ref} sqs On the call\n${second.ref} nope` } });
    fireEvent.click(view.getByRole("button", { name: "Record 2" }));

    await within(await view.findByRole("list", { name: "Results" })).findByText("recorded");
    view.getByText(/no option "nope"/);
    expect(server.act(c.decisionList, { query: `ref:${first.ref}` })[0]).toMatchObject({
      status: "decided",
      channel: "out_of_band",
      chosenOption: "sqs",
      resolutionNote: "On the call",
    });
    await waitFor(() => {
      if ((box.textContent ?? "").includes(first.ref)) throw new Error("The recorded line is still there");
    });
  });

  test("the decision log shows outcomes and filters to architecture", async () => {
    server.act(c.decisionRecord, { title: "Chose SQLite", chosen: "SQLite", kind: "architecture" });
    server.act(c.decisionRecord, { title: "Chose pricing", chosen: "Flat", kind: "product" });
    navigate("/decisions");
    const view = renderApp(<App />);
    await view.findByRole("button", { name: "Chose SQLite" });
    view.getByRole("button", { name: "Chose pricing" });
    fireEvent.click(view.getByRole("button", { name: "Architecture" }));
    await gone(() => view.queryByRole("button", { name: "Chose pricing" }));
  });
});

describe("the inspector", () => {
  test("opens from any ref, shows connections and history, closes with Escape", async () => {
    const issue = server.act(c.issueCreate, {
      project: "OCT",
      title: "Thing to look at",
      body: "Details here",
    });
    seedDecision({ blocks: [issue.ref] });
    const view = renderApp(<App />);
    fireEvent.click((await view.findAllByRole("button", { name: issue.ref }))[0] ?? document.body);

    const panel = within(await view.findByRole("complementary", { name: issue.ref }));
    await panel.findByRole("heading", { name: "Thing to look at" });
    panel.getByText("Details here");
    panel.getByText("blocked by");
    expect(panel.getAllByRole("button", { name: "D-1" }).length).toBeGreaterThan(0);
    panel.getByRole("heading", { name: "History" });

    fireEvent.keyDown(window, { key: "Escape" });
    await view.findByRole("complementary", { name: "Overview" });
  });

  test("can decide, change status and post an update", async () => {
    const decision = seedDecision();
    navigate(`/?ref=${decision.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: decision.ref }));
    await panel.findByRole("button", { name: /SQS/ });
    fireEvent.click(panel.getByRole("button", { name: /SQS/ }));
    fireEvent.click(panel.getByRole("button", { name: "Decide" }));
    await answerNow(view);
    await panel.findByText("Decided by");
    panel.getByRole("button", { name: "Change answer…" });

    fireEvent.change(panel.getByLabelText(`Post an update on ${decision.ref}`), {
      target: { value: "Noted" },
    });
    fireEvent.click(panel.getByRole("button", { name: "Post" }));
    await panel.findAllByText("Noted");
    expect(server.act(c.updateList, {})[0]).toMatchObject({
      body: "Noted",
      target: decision.ref,
      actor: "dev",
    });
  });

  test("says when a ref does not exist", async () => {
    navigate("/?ref=OCT-404");
    const view = renderApp(<App />);
    await view.findByRole("alert");
    view.getByText(/Nothing found for OCT-404/);
  });
});

describe("drift", () => {
  test("can be cleared from the page, and a false claim is refused with the reason", async () => {
    const decision = seedDecision();
    server.act(c.decisionResolve, { ref: decision.ref, option: "sqs" });
    navigate("/drift");
    const view = renderApp(<App />);
    const main = within(view.getByRole("main"));
    const note = await main.findByLabelText("Note for DR-1");

    fireEvent.change(note, { target: { value: "It is done" } });
    fireEvent.click(main.getByRole("button", { name: "Updated" }));
    await main.findByText(/has not changed/);

    fireEvent.click(main.getByRole("button", { name: "Nothing to update" }));
    await main.findByText("Nothing is out of date.");
    expect(server.act(c.driftList, { query: "status:verified" })[0]?.note).toBe("It is done");
  });
});

describe("the design specimen", () => {
  test("shows real components in both themes, needs no data, and can focus on one theme", async () => {
    navigate("/design");
    const view = renderApp(<App />);
    await view.findAllByRole("heading", { name: "Which queue?" });
    expect(document.querySelectorAll('[data-theme="light"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-theme="dark"]')).toHaveLength(1);
    expect(server.calls).toEqual([]);

    fireEvent.click(view.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(document.querySelectorAll('[data-theme="light"]')).toHaveLength(0));
    expect(document.querySelectorAll('[data-theme="dark"]')).toHaveLength(1);
  });
});

describe("other pages", () => {
  test("issues are grouped by status and status changes reach the server", async () => {
    const issue = server.act(c.issueCreate, { project: "OCT", title: "Thing" });
    server.act(c.issueCreate, { project: "OCT", title: "Other", status: "blocked" });
    navigate("/issues");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: /todo · 1/ });
    view.getByRole("heading", { name: /blocked · 1/ });
    fireEvent.change(view.getByLabelText(`Status of ${issue.ref}`), { target: { value: "in_progress" } });
    await view.findByRole("heading", { name: /in progress · 1/ });
    expect(server.act(c.issueList, { query: `ref:${issue.ref}` })[0]?.issue.status).toBe("in_progress");
  });

  test("projects link through to their own page, scoped to them", async () => {
    server.act(c.projectCreate, { key: "API", name: "Public API" });
    server.act(c.issueCreate, { project: "OCT", title: "Tracker task" });
    server.act(c.issueCreate, { project: "API", title: "Api task" });
    server.tracker.call(
      c.lineAdd,
      { title: "GA", doneWhen: "Live.", repos: ["API"], where: "working" },
      { actor: "dev", channel: "dashboard" },
    );
    navigate("/projects");
    const view = renderApp(<App />);
    const main = within(view.getByRole("main"));
    fireEvent.click(await main.findByText("Public API"));
    await main.findByRole("heading", { name: "API Public API" });
    await main.findByRole("button", { name: "Api task" });
    await main.findByText("GA");
    expect(main.queryByRole("button", { name: "Tracker task" })).toBeNull();
  });

  test("an unknown project says so", async () => {
    navigate("/projects/NOPE");
    const view = renderApp(<App />);
    await view.findByText(/No project named NOPE/);
  });

  test("agents tells a registered watch apart from one being hung on", async () => {
    const decision = seedDecision();
    server.act(c.watchCreate, {
      spec: {
        require: "any",
        clauses: [{ type: "state", query: `ref:${decision.ref} status:decided`, mode: "exists" }],
      },
    });
    server.act(c.agentNote, { note: "Writing the queue" });
    navigate("/agents");
    const view = renderApp(<App />);
    const main = within(view.getByRole("main"));
    await main.findByText("No agent is hanging on anything.");
    main.getByText(`ref:${decision.ref} status:decided`);
    main.getByText("Writing the queue");
  });

  test("an unknown path says so", async () => {
    navigate("/nowhere");
    const view = renderApp(<App />);
    await view.findByText(/Nothing lives at/);
  });
});

describe("lines of work", () => {
  const asDeveloper = { actor: "dev", channel: "dashboard" } as const;
  const asServer = { actor: "octotrack", channel: "cli", system: true } as const;

  function seedLines() {
    server.tracker.call(
      c.lineAdd,
      {
        title: "Sendspin enclosure",
        doneWhen: "A printed case holds the board.",
        repos: ["OCT"],
        where: "working",
      },
      asDeveloper,
    );
    server.tracker.call(
      c.lineAdd,
      { title: "Weekly digest", doneWhen: "Sent on Mondays.", where: "working" },
      asDeveloper,
    );
    return server.act(
      c.linePropose,
      {
        title: "Wall mount",
        doneWhen: "It hangs flush.",
        recommendation: "up_next",
        why: "The base is final.",
      },
      "panel-agent",
    );
  }

  test("the Lines page shows each section in the developer's order, with what an agent recommends", async () => {
    seedLines();
    navigate("/lines");
    const view = renderApp(<App />);
    const working = within(await view.findByRole("region", { name: "Working on" }));
    const titles = working
      .getAllByRole("button", { name: /^(Sendspin enclosure|Weekly digest)$/ })
      .map((b) => b.textContent);
    expect(titles).toEqual(["Sendspin enclosure", "Weekly digest"]);
    const proposed = within(view.getByRole("region", { name: "Proposed" }));
    proposed.getByText("Wall mount");
    proposed.getByText(whole("panel-agent says up next: The base is final."));
  });

  test("the developer places a proposal, reorders, tables with a reason and adds a line", async () => {
    const proposal = seedLines();
    navigate("/lines");
    const view = renderApp(<App />);
    const proposed = within(await view.findByRole("region", { name: "Proposed" }));
    fireEvent.click(proposed.getByRole("button", { name: "Up next Wall mount" }));
    // Every choice waits a few seconds with Undo; Now skips the wait.
    within(await view.findByRole("status", { name: "" })).getByText("Wall mount is up next");
    fireEvent.click(await view.findByRole("button", { name: "Now" }));
    const upNext = within(await view.findByRole("region", { name: "Up next" }));
    await upNext.findByText("Wall mount");
    expect(server.tracker.call(c.lineShow, { ref: proposal.ref }, asDeveloper).line.state).toBe("up_next");

    fireEvent.click(view.getByRole("button", { name: "Reorder" }));
    const working = within(view.getByRole("region", { name: "Working on" }));
    fireEvent.click(working.getByRole("button", { name: "Move Weekly digest up" }));
    await waitFor(() => {
      const order = within(view.getByRole("region", { name: "Working on" }))
        .getAllByRole("button", { name: /^(Sendspin enclosure|Weekly digest)$/ })
        .map((b) => b.textContent);
      expect(order).toEqual(["Weekly digest", "Sendspin enclosure"]);
    });

    // A working line is tabled from its panel, which opens in place.
    fireEvent.click(working.getByRole("button", { name: "Sendspin enclosure" }));
    const panel = within(await view.findByRole("complementary", { name: "L-1" }));
    fireEvent.click(await panel.findByRole("button", { name: "Table…" }));
    fireEvent.change(panel.getByLabelText("Why table Sendspin enclosure"), {
      target: { value: "Waiting on the board" },
    });
    fireEvent.click(panel.getByRole("button", { name: "Table it" }));
    fireEvent.click(await view.findByRole("button", { name: "Now" }));
    const tabled = within(await view.findByRole("region", { name: "Tabled" }));
    fireEvent.click(tabled.getByRole("button", { name: "Show" }));
    await tabled.findByText("Waiting on the board");

    fireEvent.click(view.getByRole("button", { name: "New line…" }));
    fireEvent.change(view.getByLabelText("New line"), { target: { value: "Garden sensor" } });
    fireEvent.change(view.getByLabelText("Done when"), { target: { value: "Readings arrive hourly." } });
    fireEvent.click(await view.findByRole("checkbox", { name: "OCT" }));
    fireEvent.click(view.getByRole("button", { name: "Add line" }));
    await within(view.getByRole("region", { name: "Up next" })).findByText("Garden sensor");
    const added = server.tracker
      .call(c.homeShow, {}, asDeveloper)
      .upNext.find((candidate) => candidate.title === "Garden sensor");
    expect(added?.repos).toEqual(["OCT"]);
  });

  test("each line says who owns it, from what agents did", async () => {
    seedLines();
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    navigate("/lines");
    const view = renderApp(<App />);
    const working = within(await view.findByRole("region", { name: "Working on" }));
    await working.findByText("owner octo.1, running");
  });

  test("what waits on the developer opens in place on its line: the first fully, the rest one row away", async () => {
    seedLines();
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
    const options = [
      { key: "a", label: "26 mm", description: "Print as it is." },
      { key: "b", label: "30 mm", description: "Remodel first." },
    ];
    server.act(c.decisionAsk, { title: "Which board?", context: "The base is printed.", options }, "octo.1");
    const task = server.act(
      c.taskFile,
      { title: "Measure the grip", place: "the bench", outcome: "Five numbers" },
      "octo.1",
    );
    navigate("/lines");
    const view = renderApp(<App />);
    const line = within(await view.findByRole("article", { name: "Sendspin enclosure" }));
    await line.findByRole("article", { name: "Which board?" });
    line.getByText("waiting on you");
    fireEvent.click(line.getByRole("button", { name: "+1 more for you" }));
    fireEvent.click(line.getByRole("button", { name: `Open ${task.ref}` }));
    const opened = within(await line.findByRole("article", { name: "Measure the grip" }));
    fireEvent.click(opened.getByRole("button", { name: "Done…" }));
    fireEvent.change(opened.getByLabelText(`What ${task.ref} found`), { target: { value: "41, 38, 12" } });
    fireEvent.click(opened.getByRole("button", { name: "Send" }));
    fireEvent.click(await view.findByRole("button", { name: "Now" }));
    await waitFor(() =>
      expect(
        server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.status,
      ).toBe("done"),
    );
    await gone(() => line.queryByRole("button", { name: `Open ${task.ref}` }));
  });

  describe("choices from home and the line panel", () => {
    function withTask() {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      return server.act(
        c.taskFile,
        { title: "Measure the grip", place: "the bench", outcome: "Five numbers" },
        "octo.1",
      );
    }

    test("Can't do it closes a task with why, and the line's agent hears it", async () => {
      const task = withTask();
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the grip" }));
      fireEvent.click(opened.getByRole("button", { name: "Can't do it…" }));
      fireEvent.change(opened.getByLabelText(`Why ${task.ref} cannot be done`), {
        target: { value: "The calipers are lost" },
      });
      fireEvent.click(opened.getByRole("button", { name: "Close it" }));
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.status,
        ).toBe("cancelled"),
      );
      const heard = server.tracker.execute(c.agentList.name, {}, { actor: "octo.1", channel: "cli" }).notices;
      expect(heard.map((notice) => notice.body).join(" ")).toContain("The calipers are lost");
    });

    test("undoing a task's Done keeps what was typed", async () => {
      const task = withTask();
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the grip" }));
      fireEvent.click(opened.getByRole("button", { name: "Done…" }));
      fireEvent.change(opened.getByLabelText(`What ${task.ref} found`), { target: { value: "41, 38, 12" } });
      fireEvent.click(opened.getByRole("button", { name: "Send" }));
      fireEvent.click(await view.findByRole("button", { name: "Undo" }));
      await gone(() => view.queryByRole("button", { name: "Undo" }));
      fireEvent.click(opened.getByRole("button", { name: "Done…" }));
      expect(opened.getByLabelText(`What ${task.ref} found`).textContent).toBe("41, 38, 12");
    });

    test("a choice that fails when it takes effect says why in the Undo bar, until dismissed", async () => {
      const proposal = seedLines();
      navigate("/");
      const view = renderApp(<App />);
      const proposed = within(await view.findByRole("region", { name: "Proposed" }));
      fireEvent.click(proposed.getByRole("button", { name: "Start Wall mount" }));
      await view.findByRole("button", { name: "Undo" });
      // Meanwhile, from elsewhere, the proposal is turned down, so starting it can no longer work.
      server.tracker.call(c.lineReject, { ref: proposal.ref }, asDeveloper);
      await answerNow(view);
      const alert = await view.findByRole("alert");
      expect(alert.textContent).toContain("Could not: Started Wall mount");
      fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
      await gone(() => view.queryByRole("alert"));
    });

    test("Fold into… folds a proposal into the line chosen, by button", async () => {
      const proposal = seedLines();
      navigate("/");
      const view = renderApp(<App />);
      const proposed = within(await view.findByRole("region", { name: "Proposed" }));
      fireEvent.click(proposed.getByRole("button", { name: "Fold Wall mount" }));
      fireEvent.click(proposed.getByRole("button", { name: "Fold Wall mount into Sendspin enclosure" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: proposal.ref }, asDeveloper).line.state).toBe(
          "dropped",
        ),
      );
    });

    test("the line panel's choices take effect after Undo's window, and tabling asks why", async () => {
      seedLines();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.click(await panel.findByRole("button", { name: "Table…" }));
      fireEvent.change(panel.getByLabelText("Why table Sendspin enclosure"), {
        target: { value: "Waiting on boards" },
      });
      fireEvent.click(panel.getByRole("button", { name: "Table it" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.tabledReason).toBe(
          "Waiting on boards",
        ),
      );
      fireEvent.click(await panel.findByRole("button", { name: "Drop" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.state).toBe("dropped"),
      );
    });
  });

  test("a choice waits with Undo, and Undo or the u key means it never happened", async () => {
    const proposal = seedLines();
    navigate("/lines");
    const view = renderApp(<App />);
    const proposed = within(await view.findByRole("region", { name: "Proposed" }));
    fireEvent.click(proposed.getByRole("button", { name: "Start Wall mount" }));
    fireEvent.click(await view.findByRole("button", { name: "Undo" }));
    await gone(() => view.queryByRole("button", { name: "Undo" }));
    fireEvent.click(proposed.getByRole("button", { name: "Not a line: Wall mount" }));
    await view.findByRole("button", { name: "Undo" });
    fireEvent.keyDown(window, { key: "u" });
    await gone(() => view.queryByRole("button", { name: "Undo" }));
    server.tracker.applyDueChoices();
    expect(server.tracker.call(c.lineShow, { ref: proposal.ref }, asDeveloper).line.state).toBe("proposed");
  });

  test("j and k move focus through what waits, opening each in place", async () => {
    seedLines();
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    const options = [
      { key: "a", label: "26 mm", description: "Print as it is." },
      { key: "b", label: "30 mm", description: "Remodel first." },
    ];
    server.act(c.decisionAsk, { title: "Which board?", context: "The base is printed.", options }, "octo.1");
    server.act(c.decisionAsk, { title: "Which plug?", context: "The case is open.", options }, "octo.1");
    navigate("/lines");
    const view = renderApp(<App />);
    await view.findByRole("article", { name: "Which board?" });
    fireEvent.keyDown(window, { key: "j" });
    await view.findByRole("article", { name: "Which plug?" });
    await gone(() => view.queryByRole("article", { name: "Which board?" }));
    fireEvent.keyDown(window, { key: "k" });
    await view.findByRole("article", { name: "Which board?" });
  });

  describe("home's header and sections", () => {
    const options = [{ key: "a", label: "Yes", description: "Go ahead." }];

    test("each count opens the first such item in focus order", async () => {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      server.act(c.decisionAsk, { title: "Which board?", context: "Context.", options }, "octo.1");
      server.act(c.taskFile, { title: "Weigh it", place: "the bench", outcome: "Grams" }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.click(view.getByRole("button", { name: "1 to do" }));
      await view.findByRole("article", { name: "Weigh it" });
      fireEvent.click(view.getByRole("button", { name: "1 to accept" }));
      await waitFor(() =>
        expect(view.getByRole("article", { name: "Wall mount" }).getAttribute("data-selected")).toBe("true"),
      );
    });

    test("past six working lines, the header says what spreading thin costs", async () => {
      for (const index of [1, 2, 3, 4, 5, 6, 7]) {
        server.tracker.call(
          c.lineAdd,
          { title: `Line ${index}`, doneWhen: "Done.", repos: ["OCT"], where: "working" },
          asDeveloper,
        );
      }
      navigate("/");
      const view = renderApp(<App />);
      await view.findByText(/7 lines are being worked on: 7 have no owner/);
    });

    test("Reorder moves a line to the top in one press", async () => {
      seedLines();
      navigate("/");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("button", { name: "Reorder" }));
      fireEvent.click(await view.findByRole("button", { name: "Move Weekly digest to the top" }));
      await waitFor(() =>
        expect(server.tracker.call(c.homeShow, {}, asDeveloper).working.map((line) => line.title)[0]).toBe(
          "Weekly digest",
        ),
      );
    });

    test("an urgent proposal says so, first, with Start first", async () => {
      seedLines();
      server.act(
        c.linePropose,
        {
          title: "Restore the feed",
          doneWhen: "It loads.",
          repos: ["OCT"],
          recommendation: "start",
          why: "It broke.",
          urgent: "broken",
        },
        "panel-agent",
      );
      navigate("/");
      const view = renderApp(<App />);
      const proposed = within(await view.findByRole("region", { name: "Proposed" }));
      const cards = proposed.getAllByRole("article");
      expect(cards[0]?.getAttribute("aria-label")).toBe("Restore the feed");
      within(cards[0] ?? document.body).getByText("Urgent: something is broken");
      expect(within(cards[0] ?? document.body).getAllByRole("button")[1]?.textContent).toBe("Start");
    });

    test("at the cap, Step in offers Start one anyway", async () => {
      server.tracker.call(c.runnerReport, { configured: true, cap: 0, dryRun: false }, asServer);
      server.tracker.call(
        c.lineAdd,
        { title: "Capped", doneWhen: "Done.", repos: ["OCT"], where: "working" },
        asDeveloper,
      );
      server.later(1);
      navigate("/");
      const view = renderApp(<App />);
      const note = within(await view.findByRole("note", { name: "Step in on Capped" }));
      fireEvent.click(note.getByRole("button", { name: "Start one anyway" }));
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.startAnyway).not.toBeNull(),
      );
    });

    test("a clone that failed offers Set its checkout…", async () => {
      server.tracker.call(c.runnerReport, { configured: true, cap: 1, dryRun: false }, asServer);
      server.tracker.call(
        c.lineAdd,
        { title: "No clone", doneWhen: "Done.", repos: ["OCT"], where: "working" },
        asDeveloper,
      );
      server.later(1);
      for (const _ of [1, 2]) {
        const started = server.tracker.call(c.runnerStart, { line: "L-1", repo: "OCT" }, asServer);
        server.tracker.call(
          c.runnerExited,
          {
            name: started.name,
            code: 1,
            output: "OCT has no GitHub repo to clone, and no checkout is set for it",
          },
          asServer,
        );
        server.tracker.call(c.runnerRetry, { line: "L-1" }, asDeveloper);
      }
      navigate("/");
      const view = renderApp(<App />);
      const note = within(await view.findByRole("note", { name: "Step in on No clone" }));
      fireEvent.click(note.getByRole("button", { name: "Set its checkout…" }));
      fireEvent.change(note.getByLabelText("Checkout of OCT"), { target: { value: "/code/octotrack" } });
      fireEvent.click(note.getByRole("button", { name: "Set" }));
      await waitFor(() =>
        expect(server.tracker.call(c.entityShow, { ref: "OCT" }, asDeveloper).entity).toMatchObject({
          checkout: "/code/octotrack",
        }),
      );
    });

    test("I'm at a place opens every task for it, each with its choices, until left", async () => {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      server.act(c.taskFile, { title: "Weigh it", place: "the bench", outcome: "Grams" }, "octo.1");
      server.act(c.taskFile, { title: "Measure it", place: "the bench", outcome: "mm" }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("button", { name: "I'm at…" }));
      fireEvent.click(await view.findByRole("button", { name: "the bench" }));
      const at = within(await view.findByRole("region", { name: "At the bench" }));
      await at.findByRole("article", { name: "Weigh it" });
      expect(at.getAllByRole("button", { name: "Done…" })).toHaveLength(2);
      fireEvent.click(at.getByRole("button", { name: "Leave" }));
      await gone(() => view.queryByRole("region", { name: "At the bench" }));
    });

    test("Start on an up-next line first shows what it holds, then starts it", async () => {
      seedLines();
      const queued = server.tracker.call(
        c.lineAdd,
        { title: "Mount", doneWhen: "It hangs.", repos: ["OCT"], where: "up_next" },
        asDeveloper,
      );
      server.act(c.agentRegister, { repo: "OCT" }, "octo.2");
      server.act(c.lineTake, { ref: queued.ref }, "octo.2");
      server.act(c.decisionAsk, { title: "Which wall?", context: "Context.", options }, "octo.2");
      navigate("/");
      const view = renderApp(<App />);
      const upNext = within(await view.findByRole("region", { name: "Up next" }));
      fireEvent.click(upNext.getByRole("button", { name: "Start Mount" }));
      const sheet = within(await view.findByRole("dialog", { name: "Start Mount" }));
      await sheet.findByText("Which wall?");
      fireEvent.click(sheet.getByRole("button", { name: "Start now" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: queued.ref }, asDeveloper).line.state).toBe("working"),
      );
    });
  });

  describe("the line panel", () => {
    function owned() {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    }

    test("Tell sends the developer's words to the line's owner, and the box says who that is", async () => {
      owned();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.change(await panel.findByLabelText("Tell octo.1"), {
        target: { value: "Print it in black" },
      });
      fireEvent.click(panel.getByRole("button", { name: "Send" }));
      await answerNow(view);
      await waitFor(() => {
        const heard = server.tracker.execute(
          c.agentList.name,
          {},
          { actor: "octo.1", channel: "cli" },
        ).notices;
        expect(heard.map((notice) => notice.body).join(" ")).toContain("Print it in black");
      });
    });

    test("Stop is offered on the line's owner", async () => {
      owned();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.click(await panel.findByRole("button", { name: "Stop octo.1" }));
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.agentList, {}, asDeveloper).find((agent) => agent.name === "octo.1")?.state,
        ).toBe("stopped"),
      );
    });

    test("tabling asks why and, if wanted, when to look again", async () => {
      seedLines();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.click(await panel.findByRole("button", { name: "Table…" }));
      fireEvent.change(panel.getByLabelText("Why table Sendspin enclosure"), {
        target: { value: "After the move" },
      });
      fireEvent.change(panel.getByLabelText("Look again on"), { target: { value: "2027-02-01" } });
      fireEvent.click(panel.getByRole("button", { name: "Table it" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.lookAgainAt).toBe(
          "2027-02-01",
        ),
      );
    });

    test("on a line of the developer's own, one box adds a task or a note", async () => {
      const mine = server.tracker.call(
        c.lineAdd,
        { title: "Tax archive", doneWhen: "Filed.", where: "working" },
        asDeveloper,
      );
      navigate(`/?ref=${mine.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: mine.ref }));
      const box = await panel.findByLabelText(`Add to ${mine.ref}`);
      fireEvent.change(box, { target: { value: "Scan the receipts" } });
      fireEvent.click(panel.getByRole("button", { name: "Add as a task" }));
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.homeShow, {}, asDeveloper).lines[mine.ref]?.forYou.map((item) => item.kind),
        ).toEqual(["task"]),
      );
    });

    test("opening a line marks it seen", async () => {
      seedLines();
      navigate("/?ref=L-1");
      renderApp(<App />);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.seenAt).not.toBeNull(),
      );
    });
  });

  describe("a question's own choices", () => {
    const options = [{ key: "a", label: "Yes", description: "Go ahead." }];
    function asked(extra: Record<string, unknown> = {}) {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      return server.act(
        c.decisionAsk,
        { title: "Order now?", context: "Stock.", options, ...extra },
        "octo.1",
      );
    }

    test("Not urgent sends an urgent question back to its line, and its agent hears it", async () => {
      const question = asked({ urgent: "costs_money" });
      navigate("/");
      const view = renderApp(<App />);
      const card = within(await view.findByRole("article", { name: "Order now?" }));
      fireEvent.click(card.getByRole("button", { name: "Not urgent" }));
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.decisionList, { query: `ref:${question.ref}` }, asDeveloper)[0]?.notUrgentAt,
        ).not.toBeNull(),
      );
    });

    test("Later waits with Undo like any choice", async () => {
      const question = asked();
      navigate("/");
      const view = renderApp(<App />);
      const card = within(await view.findByRole("article", { name: "Order now?" }));
      fireEvent.click(card.getByRole("button", { name: "Later" }));
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.decisionList, { query: `ref:${question.ref}` }, asDeveloper)[0]?.postponedAt,
        ).not.toBeNull(),
      );
    });

    test("Change answer… reopens an answered question, from its panel", async () => {
      const question = asked();
      server.tracker.call(c.decisionResolve, { ref: question.ref, option: "a" }, asDeveloper);
      navigate(`/?ref=${question.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: question.ref }));
      fireEvent.click(await panel.findByRole("button", { name: "Change answer…" }));
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.decisionList, { query: `ref:${question.ref}` }, asDeveloper)[0]?.status,
        ).toBe("open"),
      );
    });
  });

  describe("an agent's proposals about a working line", () => {
    function proposed() {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.act(c.lineProposeDone, { ref: "L-1", why: "Printed and fitted." }, "octo.1");
    }

    test("a case for done is the line's first item, and It is done ends the line", async () => {
      proposed();
      navigate("/");
      const view = renderApp(<App />);
      const card = within(await view.findByRole("article", { name: "Sendspin enclosure is done?" }));
      fireEvent.click(card.getByRole("button", { name: "It is done" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.state).toBe("done"),
      );
    });

    test("Not yet sends what is missing to the line's owner", async () => {
      proposed();
      navigate("/");
      const view = renderApp(<App />);
      const card = within(await view.findByRole("article", { name: "Sendspin enclosure is done?" }));
      fireEvent.click(card.getByRole("button", { name: "Not yet…" }));
      fireEvent.change(card.getByLabelText("What L-1 still needs"), { target: { value: "The lid rattles" } });
      fireEvent.click(card.getByRole("button", { name: "Not yet" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.doneProposal).toBeNull(),
      );
      const heard = server.tracker.execute(c.agentList.name, {}, { actor: "octo.1", channel: "cli" }).notices;
      expect(heard.map((notice) => notice.body).join(" ")).toContain("The lid rattles");
    });
  });

  describe("Step in", () => {
    function unowned() {
      return server.tracker.call(
        c.lineAdd,
        { title: "Nobody's line", doneWhen: "Done.", repos: ["OCT"], where: "working" },
        asDeveloper,
      );
    }

    test("asks the developer about a line no agent took, and I'll own it makes it theirs", async () => {
      const line = unowned();
      server.later(1);
      navigate("/");
      const view = renderApp(<App />);
      const note = within(await view.findByRole("note", { name: "Step in on Nobody's line" }));
      fireEvent.click(note.getByRole("button", { name: "I'll own it" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: line.ref }, asDeveloper).line.ownedBy).toBe("dev"),
      );
    });

    test("Table it… tables the line with the reason given", async () => {
      const line = unowned();
      server.later(1);
      navigate("/");
      const view = renderApp(<App />);
      const note = within(await view.findByRole("note", { name: "Step in on Nobody's line" }));
      fireEvent.click(note.getByRole("button", { name: "Table it…" }));
      fireEvent.change(note.getByRole("textbox"), { target: { value: "Not this month" } });
      fireEvent.click(note.getByRole("button", { name: /^Table/ }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: line.ref }, asDeveloper).line.tabledReason).toBe(
          "Not this month",
        ),
      );
    });

    test("is not asked while all of a line's work waits on the developer", async () => {
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      const line = unowned();
      server.tracker.call(
        c.taskFile,
        { line: line.ref, title: "Measure", place: "the bench", outcome: "Numbers" },
        asDeveloper,
      );
      server.later(1);
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Measure" });
      expect(view.queryByRole("note", { name: "Step in on Nobody's line" })).toBeNull();
    });
  });

  describe("focus on home", () => {
    const options = [
      { key: "a", label: "26 mm", description: "Print as it is." },
      { key: "b", label: "30 mm", description: "Remodel first." },
    ];
    function onLine() {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    }
    const selected = (
      view: { getByRole: (role: string, options: { name: string }) => HTMLElement },
      name: string,
    ) => view.getByRole("article", { name }).getAttribute("data-selected");

    test("a question arriving, even an urgent one, does not move it", async () => {
      server = startTestServer({ live: true });
      server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
      onLine();
      server.act(
        c.decisionAsk,
        { title: "Which board?", context: "The base is printed.", options },
        "octo.1",
      );
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      server.act(
        c.decisionAsk,
        { title: "Order now?", context: "Stock runs out.", options, urgent: "time_boxed" },
        "octo.1",
      );
      await view.findByRole("article", { name: "Order now?" });
      expect(selected(view, "Which board?")).toBe("true");
      expect(selected(view, "Order now?")).toBe("false");
    });

    test("a second key press while an answer waits with Undo sends no second answer", async () => {
      onLine();
      server.act(
        c.decisionAsk,
        { title: "Which board?", context: "The base is printed.", options },
        "octo.1",
      );
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "Enter" });
      await view.findByRole("button", { name: "Undo" });
      fireEvent.keyDown(window, { key: "2" });
      fireEvent.keyDown(window, { key: "Enter" });
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(server.calls.filter((name) => name === "choice.make")).toHaveLength(1);
    });

    test("when the question with focus is answered, focus moves to the next one on its line", async () => {
      onLine();
      const board = server.act(
        c.decisionAsk,
        { title: "Which board?", context: "The base is printed.", options },
        "octo.1",
      );
      server.act(c.decisionAsk, { title: "Which plug?", context: "The case is open.", options }, "octo.1");
      server.act(
        c.decisionAsk,
        { title: "Order now?", context: "Stock runs out.", options, urgent: "time_boxed" },
        "octo.1",
      );
      navigate("/");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("button", { name: `Open ${board.ref}` }));
      await waitFor(() => expect(selected(view, "Which board?")).toBe("true"));
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "Enter" });
      await answerNow(view);
      await view.findByRole("article", { name: "Which plug?" });
      await waitFor(() => expect(selected(view, "Which plug?")).toBe("true"));
      expect(selected(view, "Order now?")).toBe("false");
    });
  });

  test("a half-written update is kept on the server, and is there when the panel opens again", async () => {
    seedLines();
    navigate("/?ref=L-1");
    const first = renderApp(<App />);
    const panel = within(await first.findByRole("complementary", { name: "L-1" }));
    fireEvent.change(await panel.findByLabelText("Post an update on L-1"), {
      target: { value: "Half of a thought" },
    });
    await waitFor(() =>
      expect(server.tracker.call(c.draftGet, { key: "update:L-1" }, asDeveloper).text).toBe(
        "Half of a thought",
      ),
    );
    first.unmount();
    const again = renderApp(<App />);
    const reopened = within(await again.findByRole("complementary", { name: "L-1" }));
    await waitFor(() =>
      expect(reopened.getByLabelText("Post an update on L-1")).toHaveProperty("value", "Half of a thought"),
    );
  });

  test("home is the list of lines, at the root, with the log one link away", async () => {
    seedLines();
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("region", { name: "Working on" });
    fireEvent.click(view.getByRole("link", { name: "Log" }));
    await view.findByRole("heading", { name: "Log" });
  });

  test("first run places proposals where their agents recommend, in one choice", async () => {
    server.act(
      c.linePropose,
      { title: "Wall mount", doneWhen: "It hangs.", recommendation: "up_next", why: "The base is final." },
      "panel-agent",
    );
    navigate("/");
    const view = renderApp(<App />);
    fireEvent.click(await view.findByRole("button", { name: "Accept 1 recommended placements" }));
    fireEvent.click(await view.findByRole("button", { name: "Now" }));
    await within(await view.findByRole("region", { name: "Up next" })).findByText("Wall mount");
  });

  test("the agents roster stops an agent, with Undo, and lifts the stop", async () => {
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    navigate("/agents");
    const view = renderApp(<App />);
    fireEvent.click(await view.findByRole("button", { name: "Stop octo.1" }));
    fireEvent.click(await view.findByRole("button", { name: "Now" }));
    fireEvent.click(await view.findByRole("button", { name: "Lift octo.1" }));
    await view.findByRole("button", { name: "Stop octo.1" });
  });

  test("the agents roster releases a quiet agent's line, with Undo", async () => {
    server.tracker.call(
      c.lineAdd,
      { title: "Quiet line", doneWhen: "Done.", repos: ["OCT"], where: "working" },
      asDeveloper,
    );
    server.act(c.agentRegister, { repo: "OCT" }, "octo.9");
    server.act(c.lineTake, { ref: "L-1" }, "octo.9");
    server.later(3 * 60);
    navigate("/agents");
    const view = renderApp(<App />);
    fireEvent.click(await view.findByRole("button", { name: "Release octo.9 from L-1" }));
    fireEvent.click(await view.findByRole("button", { name: "Now" }));
    await waitFor(() => expect(server.tracker.call(c.agentList, {}, asDeveloper)[0]?.line).toBeNull());
  });

  test("on a phone, lines past the second fold to one row saying how much waits, and open from it", async () => {
    const realMatchMedia = window.matchMedia;
    Object.assign(window, {
      matchMedia: (media: string) => ({
        matches: true,
        media,
        addEventListener() {},
        removeEventListener() {},
      }),
    });
    try {
      const options = [{ key: "a", label: "Yes", description: "Go ahead." }];
      for (const [index, title] of ["First", "Second", "Third"].entries()) {
        server.tracker.call(
          c.lineAdd,
          { title, doneWhen: "Done.", repos: ["OCT"], where: "working" },
          asDeveloper,
        );
        const agent = `octo.${index + 1}`;
        server.act(c.agentRegister, { repo: "OCT" }, agent);
        server.act(c.lineTake, { ref: `L-${index + 1}` }, agent);
        server.act(c.decisionAsk, { title: `${title} question`, context: "Context.", options }, agent);
      }
      navigate("/");
      const view = renderApp(<App />);
      const third = within(await view.findByRole("article", { name: "Third" }));
      within(view.getByRole("article", { name: "Second" })).getByRole("button", { name: "Open D-2" });
      fireEvent.click(third.getByRole("button", { name: "1 waiting on you" }));
      await third.findByRole("article", { name: "Third question" });
    } finally {
      Object.assign(window, { matchMedia: realMatchMedia });
    }
  });

  test("a tapped notification opens its question focused, and opening the app is noted for the next buzz", async () => {
    seedLines();
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    const options = [{ key: "a", label: "Yes", description: "Go ahead." }];
    server.act(c.decisionAsk, { title: "First?", context: "Context.", options }, "octo.1");
    const second = server.act(c.decisionAsk, { title: "Second?", context: "Context.", options }, "octo.1");
    navigate(`/?focus=${second.ref}`);
    const view = renderApp(<App />);
    await view.findByRole("article", { name: "Second?" });
    await waitFor(() => expect(server.calls).toContain("push.seen"));
  });

  test("a line opens in the inspector with what finishes it", async () => {
    seedLines();
    navigate("/?ref=L-1");
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: "L-1" }));
    await panel.findByText("A printed case holds the board.");
    panel.getByText("Working on");
  });
});

describe("buzzing this device", () => {
  const asDeveloper = { actor: "dev", channel: "dashboard" } as const;
  const existing = { endpoint: "https://push.example/phone", keys: { p256dh: "BKey", auth: "secret" } };

  test("is on only when this browser holds a subscription, which the server is told about", async () => {
    server = startTestServer({ pushKey: "BPublic" });
    const push = fakePush({ permission: "granted", subscribed: existing });
    try {
      navigate("/");
      const view = renderApp(<App />);
      await view.findByText("Buzzing this device for urgent questions and the top two lines");
      await waitFor(() =>
        expect(server.tracker.call(c.pushSubscriptions, {}, { ...asDeveloper, system: true })).toEqual([
          existing,
        ]),
      );
    } finally {
      push.restore();
    }
  });

  test("allowed but not subscribed is off, and turning it on subscribes and tells the server", async () => {
    server = startTestServer({ pushKey: "BPublic" });
    const push = fakePush({ permission: "granted", subscribed: null });
    try {
      navigate("/");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("button", { name: "Buzz this device" }));
      await view.findByText("Buzzing this device for urgent questions and the top two lines");
      expect(server.tracker.call(c.pushSubscriptions, {}, { ...asDeveloper, system: true })).toEqual([
        { endpoint: "https://push.example/new", keys: { p256dh: "BNew", auth: "fresh" } },
      ]);
    } finally {
      push.restore();
    }
  });
});
