import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.tsx";
import { navigate } from "../src/lib/router.ts";
import { contracts as c, FakeEventSource, renderApp, startTestServer, type TestServer } from "./harness.tsx";

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
    expect(server.calls).toContain("decision.resolve");
  });

  test("a decision made elsewhere can be marked so while deciding in place", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.click(view.getByRole("button", { name: /SQS/ }));
    fireEvent.click(view.getByRole("checkbox", { name: "decided elsewhere" }));
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
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
    navigate("/?q=event%3Aproject.created");
    const view = renderApp(<App />);
    await within(await view.findByRole("feed")).findByText(/Project OCT created/);
    expect(view.queryByText("Nothing matches this filter.") === null).toBe(true);
  });

  test("with the inspector open on a decision, the keys answer that decision and not the queue's", async () => {
    const top = seedDecision({ title: "Top of the queue", priority: "urgent" });
    const other = seedDecision({ title: "Being inspected", priority: "low" });
    navigate(`/?ref=${other.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: other.ref }));
    await panel.findByRole("button", { name: /SQS/ });
    fireEvent.keyDown(window, { key: "1" });
    await waitFor(() =>
      expect(panel.getByRole("button", { name: /SQS/ }).getAttribute("aria-pressed")).toBe("true"),
    );
    fireEvent.keyDown(window, { key: "Enter" });
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
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.chosenOption).toBe("sqs"),
    );
  });

  test("postponing moves on to the next decision and leaves the postponed one last, still open", async () => {
    const first = seedDecision({ title: "Not ready", priority: "urgent" });
    seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });

    fireEvent.click(view.getByRole("button", { name: "Postpone" }));
    await view.findByRole("heading", { name: "Next in line" });
    await view.findAllByText("postponed");
    expect(server.act(c.decisionQueue, {}).map((card) => card.decision.title)).toEqual([
      "Next in line",
      "Not ready",
    ]);
    expect(server.act(c.decisionList, { query: `ref:${first.ref}` })[0]?.status).toBe("open");
  });

  test("the p key postpones the card the keys are armed for", async () => {
    seedDecision({ title: "Not ready", priority: "urgent" });
    seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });
    fireEvent.keyDown(window, { key: "p" });
    await waitFor(() => expect(server.act(c.decisionQueue, {})[0]?.decision.title).toBe("Next in line"));
  });

  test("a postponed decision can be brought back", async () => {
    const decision = seedDecision({ title: "Not ready" });
    server.act(c.decisionPostpone, { ref: decision.ref });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });
    fireEvent.click(view.getByRole("button", { name: "Bring back" }));
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.postponedAt).toBeNull(),
    );
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
    server.act(c.projectCreate, { key: "APP", name: "App", repo: "acme/app" });
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
    await panel.findByText("Decided by");
    panel.getByRole("button", { name: "Reopen" });

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
    server.act(c.milestoneCreate, { project: "API", title: "GA", status: "active" });
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

  test("the roadmap lays out horizons and can focus on a project", async () => {
    server.act(c.projectCreate, { key: "API", name: "Public API" });
    server.act(c.milestoneCreate, { project: "OCT", title: "Tracker beta", status: "active" });
    server.act(c.milestoneCreate, { project: "API", title: "API beta", status: "active" });
    server.act(c.ideaCapture, { title: "Later thing", horizon: "later", project: "OCT" });
    navigate("/roadmap");
    const view = renderApp(<App />);
    await view.findByText("Tracker beta");
    view.getByText("API beta");
    view.getByText("Later thing");
    fireEvent.change(view.getByLabelText("Project"), { target: { value: "API" } });
    await gone(() => view.queryByText("Tracker beta"));
  });

  test("ideas can be captured, placed and promoted", async () => {
    navigate("/ideas");
    const view = renderApp(<App />);
    await view.findByText("No ideas here.");
    fireEvent.change(view.getByLabelText("New idea"), { target: { value: "From the dashboard" } });
    fireEvent.click(view.getByRole("button", { name: "Capture" }));
    await view.findByRole("button", { name: "From the dashboard" });

    const projectIdea = server.act(c.ideaCapture, { title: "Promotable", project: "OCT" });
    const source = FakeEventSource.instances[0];
    if (source === undefined) throw new Error("No event source");
    act(() => source.emit("change"));
    const row = await view.findByRole("button", { name: "Promotable" });
    const promote = within(row.closest(".row") ?? document.body).getByRole("button", { name: "Promote" });
    fireEvent.click(promote);
    await waitFor(() => expect(server.act(c.issueList, {})[0]?.issue.title).toBe("Promotable"));
    expect(server.act(c.ideaList, { query: `ref:${projectIdea.ref}` })[0]?.status).toBe("promoted");
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
