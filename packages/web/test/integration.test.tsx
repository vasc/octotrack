import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, type RenderResult, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.tsx";
import { navigate, setParams } from "../src/lib/router.ts";
import {
  contracts as c,
  FakeEventSource,
  renderApp,
  startTestServer,
  fakePush,
  type TestServer,
  iconsIn,
  proposalMove,
  whole,
  wholeMatching,
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

/**
 * Choices wait a few seconds with Undo. This lets the newest one's time run out at once, as the server's tick would
 * after five seconds, and refreshes the page as the change notice that follows would.
 */
async function answerNow(view: { client: QueryClient }) {
  const developer = { actor: "dev", channel: "dashboard" } as const;
  const waiting = () =>
    server.tracker.call(c.choiceList, {}, developer).filter((choice) => choice.state === "pending");
  await waitFor(() => expect(waiting().length).toBeGreaterThan(0));
  const newest = waiting().at(-1);
  if (newest === undefined) throw new Error("No choice is waiting");
  server.tracker.call(c.choiceNow, { id: newest.id }, developer);
  await act(() => view.client.invalidateQueries());
}

/**
 * A sheet once what it shows has loaded. A sheet that loads draws its loading state as a sheet of its own, which the
 * loaded one replaces, so the dialog is looked up again once loading is over.
 */
async function loadedSheet(view: Pick<RenderResult, "getByRole">, name: string) {
  return within(
    await waitFor(() => {
      const sheet = view.getByRole("dialog", { name });
      if (within(sheet).queryByText(/^Loading/) !== null) throw new Error("Still loading");
      return sheet;
    }),
  );
}

/** Whether the keys act on this element's item: the item the page's focus is on is marked current. */
function focusOf(element: Element): string {
  return element.closest("[data-focus-ref]")?.getAttribute("aria-current") === "true" ? "true" : "false";
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

describe("questions on home", () => {
  beforeEach(() => navigate("/"));

  test("the Undo bar stays usable above an open sheet: it is drawn outside the page the sheet makes inert", async () => {
    seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    const undo = await view.findByRole("button", { name: "Undo" });
    act(() => setParams({ new: "1" }));
    await view.findByRole("dialog", { name: "New line" });
    expect(view.container.contains(undo)).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(server.calls).toContain("choice.undo"));
  });

  test("answering in place takes one press, waits with Undo, then records it and flows to drift", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    await answerNow(view);
    await gone(() => view.queryByRole("heading", { name: "Which queue?" }));
    expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]).toMatchObject({
      status: "decided",
      chosenOption: "redis",
      channel: "dashboard",
      decidedBy: "dev",
    });
    expect(server.act(c.driftList, {}).map((drift) => drift.rule)).toEqual(["decision-project-sync"]);
    // The answer went through the Undo window and was applied as the developer, through the dashboard.
    expect(server.calls).toContain("choice.make");
  });

  test("a refused answer says why in the Undo bar, and the question stays open", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    // The agent changed the options after the page loaded, so the choice on screen no longer exists.
    server.act(c.decisionUpdate, { ref: decision.ref, options: [{ key: "kafka", label: "Kafka" }] });
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    await answerNow(view);
    const alert = await view.findByRole("alert");
    expect(alert.textContent).toContain("no option “redis”");
    expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.status).toBe("open");
  });

  test("a question someone else just answered is refused rather than overwritten", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    server.act(c.decisionResolve, { ref: decision.ref, option: "sqs" }, "agent-b");
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    await answerNow(view);
    await gone(() => view.queryByRole("heading", { name: "Which queue?" }));
    expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.chosenOption).toBe("sqs");
  });

  test("a number key answers the open question with that option", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.keyDown(window, { key: "2" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.chosenOption).toBe("redis"),
    );
  });

  test("with the key list open, a number key answers nothing behind it, and Esc closes the list", async () => {
    seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.keyDown(window, { key: "?" });
    await view.findByRole("dialog", { name: "Keys" });
    // As a keyboard does: at what has focus, the list's Close button.
    fireEvent.keyDown(document.activeElement ?? window, { key: "2" });
    fireEvent.keyDown(document.activeElement ?? window, { key: "j" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(view.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(server.tracker.call(c.choiceList, {}, { actor: "dev", channel: "dashboard" })).toEqual([]);
    fireEvent.keyDown(window, { key: "Escape" });
    await gone(() => view.queryByRole("dialog", { name: "Keys" }));
    fireEvent.keyDown(window, { key: "2" });
    await view.findByRole("button", { name: "Undo" });
  });

  test("with the key list open, / goes nowhere; with a panel open, r records nothing behind it", async () => {
    const decision = seedDecision();
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.keyDown(window, { key: "?" });
    await view.findByRole("dialog", { name: "Keys" });
    fireEvent.keyDown(document.activeElement ?? window, { key: "/" });
    expect(window.location.pathname).toBe("/");
    fireEvent.keyDown(window, { key: "Escape" });
    await gone(() => view.queryByRole("dialog", { name: "Keys" }));
    act(() => navigate(`/?ref=${decision.ref}`));
    await view.findByRole("complementary", { name: decision.ref });
    fireEvent.keyDown(window, { key: "r" });
    expect(view.queryByRole("dialog", { name: "Record answers" })).toBeNull();
  });

  test("one question is open at a time, and j and k move between them", async () => {
    seedDecision({ title: "First", priority: "urgent" });
    seedDecision({ title: "Second", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "First" });
    view.getByRole("button", { name: "Open D-2" });
    expect(view.queryByRole("heading", { name: "Second" }) === null).toBe(true);
    fireEvent.keyDown(window, { key: "j" });
    await view.findByRole("heading", { name: "Second" });
    fireEvent.keyDown(window, { key: "k" });
    await view.findByRole("heading", { name: "First" });
  });

  test("a re-rank cannot swap the open question, so a key press cannot land on another", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    const first = seedDecision({ title: "The one being read", priority: "medium" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "The one being read" });
    const urgent = seedDecision({ title: "Arrived while reading", priority: "urgent" });
    await view.findByRole("button", { name: `Open ${urgent.ref}` });
    view.getByRole("heading", { name: "The one being read" });
    fireEvent.keyDown(window, { key: "1" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${first.ref}` })[0]?.status).toBe("decided"),
    );
    expect(server.act(c.decisionList, { query: `ref:${urgent.ref}` })[0]?.status).toBe("open");
  });

  test("an answer half typed in your own words survives moving between questions", async () => {
    seedDecision({ title: "First", priority: "urgent" });
    seedDecision({ title: "Second", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "First" });
    fireEvent.click(view.getByRole("button", { name: "In my own words" }));
    fireEvent.change(view.getByLabelText("Your answer, in your own words"), {
      target: { value: "Half typed" },
    });
    fireEvent.keyDown(window, { key: "j" });
    await view.findByRole("heading", { name: "Second" });
    fireEvent.keyDown(window, { key: "k" });
    await view.findByRole("heading", { name: "First" });
    expect(view.getByLabelText("Your answer, in your own words").textContent).toBe("Half typed");
  });

  test("with a question open in the panel, the keys answer that one and not the queue's", async () => {
    const top = seedDecision({ title: "Top of the queue", priority: "urgent" });
    const other = seedDecision({ title: "Being inspected", priority: "low" });
    navigate(`/decisions?ref=${other.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: other.ref }));
    await panel.findByRole("button", { name: /SQS/ });
    fireEvent.keyDown(window, { key: "1" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${other.ref}` })[0]?.status).toBe("decided"),
    );
    expect(server.act(c.decisionList, { query: `ref:${top.ref}` })[0]?.status).toBe("open");
  });

  test("an answer in your own words", async () => {
    const decision = seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Which queue?" });
    fireEvent.click(view.getByRole("button", { name: "In my own words" }));
    const send = view.getByRole("button", { name: "Send" });
    expect(send.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Your answer, in your own words"), {
      target: { value: "Neither, use Kafka" },
    });
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]).toMatchObject({
        status: "decided",
        chosenOption: null,
        resolutionNote: "Neither, use Kafka",
      }),
    );
  });

  test("Later moves on to the next question and leaves the one put off last, still open", async () => {
    const first = seedDecision({ title: "Not ready", priority: "urgent" });
    seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });
    fireEvent.click(view.getByRole("button", { name: "Later" }));
    await view.findByRole("heading", { name: "Next in line" });
    await answerNow(view);
    await waitFor(() =>
      expect(server.act(c.decisionQueue, {}).map((card) => card.decision.title)).toEqual([
        "Next in line",
        "Not ready",
      ]),
    );
    expect(server.act(c.decisionList, { query: `ref:${first.ref}` })[0]?.status).toBe("open");
  });

  test("the l key puts off the question the keys are armed for", async () => {
    seedDecision({ title: "Not ready", priority: "urgent" });
    seedDecision({ title: "Next in line", priority: "low" });
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Not ready" });
    fireEvent.keyDown(window, { key: "l" });
    await answerNow(view);
    await waitFor(() => expect(server.act(c.decisionQueue, {})[0]?.decision.title).toBe("Next in line"));
  });

  test("a question put off can be brought back", async () => {
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
});

describe("the log", () => {
  test("a search that matches only far back in a long log finds it instead of claiming nothing matches", async () => {
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
    await within(await view.findByRole("main")).findByText(/Project OCT created/);
    expect(view.queryByRole("region", { name: "Nothing matches this search" })).toBeNull();
  });

  test("a search that matches nothing says it searched the whole log, and how to widen it", async () => {
    navigate("/log?q=actor%3Anobody");
    const view = renderApp(<App />);
    const none = within(await view.findByRole("region", { name: "Nothing matches this search" }));
    none.getByText("Searched the whole log. Try fewer words, or a longer since:.");
  });

  test("an older page that fails to load says why, and keeps what was already shown", async () => {
    server.tracker.batch(
      {
        ops: Array.from({ length: 80 }, (_, index) => ({
          op: "update.post",
          input: { body: `Noise ${index}`, project: "OCT" },
        })),
      },
      { actor: "agent-a", channel: "cli" },
    );
    navigate("/log?q=actor%3Aagent-a");
    const view = renderApp(<App />);
    const feed = within(await view.findByRole("main"));
    await feed.findByText(/Noise 79/);
    const fetchNow = globalThis.fetch;
    Object.assign(globalThis, {
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).includes("feed.list")) throw new TypeError("Failed to fetch");
        return fetchNow(input, init);
      },
    });
    try {
      fireEvent.click(view.getByRole("button", { name: "Older" }));
      await view.findByText(/The tracker did not answer\./);
      feed.getByText(/Noise 79/);
      // Try again stands in place of Older.
      feed.getByRole("button", { name: "Try again" });
      expect(feed.queryByRole("button", { name: "Older" })).toBeNull();
    } finally {
      Object.assign(globalThis, { fetch: fetchNow });
    }
  });

  test("a search goes through the whole log, and stays in the URL", async () => {
    server.act(c.issueCreate, { project: "OCT", title: "A task" });
    seedDecision();
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Log" });
    fireEvent.change(view.getByLabelText("Search the log"), { target: { value: "kind:issue" } });
    const feed = within(await view.findByRole("main"));
    await feed.findByText(/created: A task/);
    expect(feed.queryByText(/needs a decision/)).toBeNull();
    expect(window.location.search).toBe("?q=kind%3Aissue");
  });

  test("a half-typed search shows the error", async () => {
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Log" });
    fireEvent.change(view.getByLabelText("Search the log"), { target: { value: "nope:" } });
    await view.findByText(/no value|Unknown field/);
  });

  test("clicking the actor on a row adds it to the search", async () => {
    server.act(c.issueCreate, { project: "OCT", title: "By a spaced name" }, "my.agent");
    server.act(c.issueCreate, { project: "OCT", title: "By another" }, "other");
    navigate("/log?q=kind%3Aissue");
    const view = renderApp(<App />);
    await view.findByText(/created: By a spaced name/);
    fireEvent.click(view.getAllByRole("button", { name: "my.agent" })[0] ?? document.body);
    await gone(() => view.queryByText(/created: By another/));
    view.getByText(/created: By a spaced name/);
    expect(view.getByLabelText("Search the log").getAttribute("value") ?? "").toContain("actor:my.agent");
  });

  test("PR sync problems show at the top of the log, then go away once it works again", async () => {
    server = startTestServer({ live: true });
    server.tracker.call(
      c.projectCreate,
      { key: "APP", name: "App", repo: "acme/app" },
      { actor: "dev", channel: "dashboard" },
    );
    // Only the server's own sync reports what GitHub says.
    const github = { actor: "github", channel: "cli", system: true } as const;
    server.tracker.call(
      c.prSync,
      { prs: [], failures: [{ repo: "acme/app", error: "gh is not logged in" }] },
      github,
    );
    const view = renderApp(<App />);
    await view.findByText("Pull request status is stale for acme/app");
    view.getByText(
      wholeMatching(/gh is not logged in\. Run gh auth login; it picks up again within two minutes\./),
    );
    server.tracker.call(c.prSync, { prs: [], repos: ["acme/app"] }, github);
    await gone(() => view.queryByText("Pull request status is stale for acme/app"));
  });
});

describe("live updates, with nothing but the server's own notifications", () => {
  function setVisibility(state: "visible" | "hidden"): void {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
  }
  function seedLine() {
    server.tracker.call(
      c.lineAdd,
      { title: "Enclosure", doneWhen: "Done.", repos: ["OCT"], where: "working" },
      { actor: "dev", channel: "dashboard" },
    );
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    server.act(c.lineTake, { ref: "L-1" }, "octo.1");
  }
  const options = [{ key: "a", label: "Yes", description: "Go ahead." }];

  test("a question an agent asks, a pull request it opens and its checks reach the page without a reload", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    seedLine();
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("article", { name: "Enclosure" });
    const issue = server.act(c.issueCreate, { project: "OCT", title: "Base", line: "L-1" }, "octo.1");
    server.act(c.decisionAsk, { title: "Asked by an agent", context: "Context.", options }, "octo.1");
    await view.findByRole("heading", { name: "Asked by an agent" });
    await view.findByRole("link", { name: "1 to answer" });
    server.act(
      c.prUpsert,
      {
        repo: "a/b",
        number: 1,
        title: "PR from an agent",
        state: "open",
        checks: "failing",
        issues: [issue.ref],
      },
      "octo.1",
    );
    fireEvent.click(view.getByRole("button", { name: "Enclosure" }));
    const panel = within(await view.findByRole("complementary", { name: "L-1" }));
    const prs = within(await panel.findByRole("region", { name: "Pull requests" }));
    await prs.findByText(/checks failing/);
    server.act(
      c.prUpsert,
      { repo: "a/b", number: 1, title: "PR from an agent", state: "open", checks: "passing" },
      "octo.1",
    );
    const fact = await panel.findByText(whole("#1 open · "));
    expect(iconsIn(fact)).toEqual(["check"]);
  });

  test("changes that leave nothing in the log still reach the page", async () => {
    server = startTestServer({ live: true });
    server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
    server.act(c.agentRegister, { repo: "OCT" }, "octo.2");
    navigate("/agents");
    const view = renderApp(<App />);
    const main = within(view.getByRole("main"));
    await main.findByText("octo.2");
    server.tracker.call(c.agentStop, { name: "octo.2" }, { actor: "dev", channel: "dashboard" });
    await main.findByText(/^stopped /);
  });

  test("a change landing between the first load and the stream connecting is not lost", async () => {
    seedLine();
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("article", { name: "Enclosure" });
    server.act(c.decisionAsk, { title: "Slipped through the gap", context: "C.", options }, "octo.1");
    expect(view.queryByRole("heading", { name: "Slipped through the gap" }) === null).toBe(true);
    const source = FakeEventSource.instances[0];
    if (source === undefined) throw new Error("No event source");
    act(() => source.emit("hello"));
    await view.findByRole("heading", { name: "Slipped through the gap" });
  });

  test("a lost connection says what is shown and that answers wait, until it is back; Try now reconnects", async () => {
    seedLine();
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("article", { name: "Enclosure" });
    const source = FakeEventSource.instances[0];
    if (source === undefined) throw new Error("No event source");
    act(() => source.emit("hello"));
    expect(view.queryByText(/Not live/)).toBeNull();
    act(() => source.emit("error"));
    await view.findByText(
      wholeMatching(
        /^Not live\. Showing what was true at \d\d:\d\d; reconnecting\. Answers you give wait until it is back\.$/,
      ),
    );
    fireEvent.click(view.getByRole("button", { name: "Try now" }));
    expect(source.closed).toBe(true);
    const again = FakeEventSource.instances.at(-1);
    if (again === undefined || again === source) throw new Error("No new event source");
    act(() => again.emit("hello"));
    await gone(() => view.queryByText(/Not live/));
  });

  test("a hidden tab gives up its connection and catches up when it comes back", async () => {
    seedLine();
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("article", { name: "Enclosure" });
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => setVisibility("hidden"));
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    server.act(c.decisionAsk, { title: "Asked while hidden", context: "C.", options }, "octo.1");
    act(() => setVisibility("visible"));
    const reopened = FakeEventSource.instances[1];
    if (reopened === undefined) throw new Error("It did not reconnect");
    act(() => reopened.emit("hello"));
    await view.findByRole("heading", { name: "Asked while hidden" });
    setVisibility("visible");
  });

  test("a push from the stream brings in new work without reloading", async () => {
    seedLine();
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("article", { name: "Enclosure" });
    const source = FakeEventSource.instances[0];
    if (source === undefined) throw new Error("No event source");
    act(() => source.emit("hello"));
    server.act(c.decisionAsk, { title: "Pushed from an agent", context: "C.", options }, "octo.1");
    act(() => source.emit("change"));
    await view.findByRole("heading", { name: "Pushed from an agent" });
  });

  test("closing the page closes the stream", async () => {
    const view = renderApp(<App />);
    await view.findByRole("navigation", { name: "Main" });
    view.unmount();
    expect(FakeEventSource.instances.every((source) => source.closed)).toBe(true);
  });
});

describe("pull requests", () => {
  test("an issue opened in place shows its pull requests and what they implement", async () => {
    const issue = server.act(c.issueCreate, { project: "OCT", title: "Thing" });
    server.act(c.prUpsert, { repo: "a/b", number: 1, title: "Open one", state: "open", issues: [issue.ref] });
    server.act(c.prUpsert, { repo: "a/b", number: 2, title: "Merged one", state: "merged" });
    navigate(`/?ref=${issue.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: issue.ref }));
    await panel.findByText(/Open one/);
    expect(panel.queryByText(/Merged one/)).toBeNull();
  });
});

describe("decisions out of band", () => {
  test("Record answers, behind r on home, records many and keeps the rows that failed", async () => {
    const first = seedDecision({ title: "First" });
    const second = seedDecision({ title: "Second" });
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "First" });
    fireEvent.keyDown(window, { key: "r" });
    const sheet = within(await view.findByRole("dialog", { name: "Record answers" }));
    const box = sheet.getByLabelText(/^One per row/);
    fireEvent.change(box, { target: { value: `${first.ref} sqs On the call\n${second.ref} nope` } });
    // Cmd and Enter records from the box, which keeps the cursor all along.
    act(() => box.focus());
    fireEvent.keyDown(box, { key: "Enter", metaKey: true });

    const recorded = await within(await sheet.findByRole("group", { name: "Results" })).findByText(
      "recorded",
    );
    expect(iconsIn(recorded)).toEqual(["check"]);
    view.getByText(/no option “nope”/);
    expect(server.act(c.decisionList, { query: `ref:${first.ref}` })[0]).toMatchObject({
      status: "decided",
      channel: "out_of_band",
      chosenOption: "sqs",
      resolutionNote: "On the call",
    });
    // The recorded row is gone, even under the cursor; the one that failed stays, to fix and send again.
    await waitFor(() => expect(box).toHaveProperty("value", `${second.ref} nope`));
    expect(document.activeElement).toBe(box);
  });

  test("Record answers takes the cursor, keeps what is typed as a draft, and closes on Esc", async () => {
    const first = seedDecision({ title: "First" });
    navigate("/");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "First" });
    fireEvent.keyDown(window, { key: "r" });
    const box = within(await view.findByRole("dialog", { name: "Record answers" })).getByLabelText(
      /^One per row/,
    );
    expect(document.activeElement).toBe(box);
    fireEvent.change(box, { target: { value: `${first.ref} sqs On the call` } });
    fireEvent.keyDown(box, { key: "Escape" });
    await gone(() => view.queryByRole("dialog", { name: "Record answers" }));
    await waitFor(() =>
      expect(
        server.tracker.call(c.draftGet, { key: "record-answers" }, { actor: "dev", channel: "dashboard" })
          .text,
      ).toBe(`${first.ref} sqs On the call`),
    );
    fireEvent.keyDown(window, { key: "r" });
    expect(
      within(await view.findByRole("dialog", { name: "Record answers" })).getByLabelText(/^One per row/),
    ).toHaveProperty("value", `${first.ref} sqs On the call`);
  });

  test("the Log finds the architecture decisions recorded, and only those", async () => {
    server.act(c.decisionRecord, { title: "Chose SQLite", chosen: "SQLite", kind: "architecture" });
    server.act(c.decisionRecord, { title: "Chose pricing", chosen: "Flat", kind: "product" });
    navigate("/log?q=type%3Aarchitecture");
    const view = renderApp(<App />);
    const feed = within(await view.findByRole("main"));
    await feed.findByText(/Chose SQLite/);
    expect(feed.queryByText(/Chose pricing/)).toBeNull();
  });
});

describe("the inspector", () => {
  test("opens from any ref, shows what it waits on and what happened, closes with Escape", async () => {
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
    panel.getByText(/waiting on/);
    expect(panel.getAllByRole("button", { name: "D-1" }).length).toBeGreaterThan(0);
    panel.getByRole("heading", { name: /^Activity/ });

    fireEvent.keyDown(window, { key: "Escape" });
    await gone(() => view.queryByRole("complementary", { name: issue.ref }));
  });

  test("a question opened in place answers with one press, then says who answered", async () => {
    const decision = seedDecision();
    navigate(`/?ref=${decision.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: decision.ref }));
    fireEvent.click(await panel.findByRole("button", { name: /SQS/ }));
    await answerNow(view);
    await panel.findByText("Answer");
    panel.getByText("Then");
    panel.getByRole("button", { name: "Change answer" });
    expect(server.act(c.decisionList, { query: `ref:${decision.ref}` })[0]?.chosenOption).toBe("sqs");
  });

  test("a question opened in the panel takes one answer by key while it waits, not two", async () => {
    const decision = seedDecision();
    navigate(`/?ref=${decision.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: decision.ref }));
    await panel.findByRole("button", { name: /SQS/ });
    fireEvent.keyDown(window, { key: "1" });
    await view.findByRole("button", { name: "Undo" });
    fireEvent.keyDown(window, { key: "2" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.calls.filter((name) => name === "choice.make")).toHaveLength(1);
  });

  test("a note posted from the panel waits with Undo, then shows under Updates", async () => {
    const decision = seedDecision();
    navigate(`/?ref=${decision.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: decision.ref }));
    // With none yet, it says so in a sentence rather than counting none.
    await panel.findByText("No updates yet.");
    expect(panel.queryByRole("heading", { name: "Updates 0" })).toBeNull();
    fireEvent.change(await panel.findByLabelText(`Post an update on ${decision.ref}`), {
      target: { value: "Asked the vendor" },
    });
    fireEvent.click(panel.getByRole("button", { name: "Post" }));
    await view.findByText(/Posting a note on D-1: Asked the vendor/);
    await panel.findByRole("button", { name: "Posting…" });
    await answerNow(view);
    await panel.findByText("Asked the vendor");
  });

  test("an open panel keeps what it showed when a refresh fails, and says so", async () => {
    const issue = server.act(c.issueCreate, {
      project: "OCT",
      title: "Thing to look at",
      body: "Details here",
    });
    navigate(`/?ref=${issue.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: issue.ref }));
    await panel.findByRole("heading", { name: "Thing to look at" });
    const fetchNow = globalThis.fetch;
    Object.assign(globalThis, {
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).includes("entity.show")) throw new Error("Server restarting");
        return fetchNow(input, init);
      },
    });
    try {
      await act(() => view.client.refetchQueries({ queryKey: [c.entityShow.name] }));
      await panel.findByText(/^Could not refresh .+; as of \d\d:\d\d\.$/);
      panel.getByRole("heading", { name: "Thing to look at" });
    } finally {
      Object.assign(globalThis, { fetch: fetchNow });
    }
  });

  test("says when a ref does not exist, why it may be gone, and offers a search of the log", async () => {
    navigate("/?ref=L-312");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "No line L-312" });
    view.getByText(/No line was ever made with that ref/);
    view.getByRole("link", { name: "Search the log for L-312" });
    expect(view.queryByRole("alert")).toBeNull();
  });
});

describe("drift", () => {
  test("is cleared from the panel of what it is about, and a false claim is refused with the reason", async () => {
    const decision = seedDecision();
    server.act(c.decisionResolve, { ref: decision.ref, option: "sqs" });
    navigate(`/?ref=${decision.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: decision.ref }));
    const note = await panel.findByLabelText(/Note · required/);

    fireEvent.change(note, { target: { value: "It is done" } });
    fireEvent.click(panel.getByRole("button", { name: "Updated" }));
    await answerNow(view);
    // Refused, as any choice is: the Undo bar says why, and the drift stays.
    await view.findByText(/has not changed/);
    panel.getByLabelText(/Note · required/);

    fireEvent.click(panel.getByRole("button", { name: "Nothing to update" }));
    await answerNow(view);
    await gone(() => panel.queryByLabelText(/Note · required/));
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
  test("agents shows each agent's line and its own note on what it is doing", async () => {
    server.act(c.agentRegister, { repo: "OCT" });
    server.act(c.agentNote, { note: "Writing the queue" });
    navigate("/agents");
    const view = renderApp(<App />);
    const roster = within(view.getByRole("main"));
    await roster.findByText("Writing the queue");
    roster.getByText("idle: nothing to take or scope in its repo");
  });

  test("with no agent yet, Agents says how one appears and the command that names it", async () => {
    // The shared setup acts as an agent; this tracker has heard from none.
    server = startTestServer();
    navigate("/agents");
    const view = renderApp(<App />);
    const empty = within(await view.findByRole("region", { name: "No agent has checked in yet" }));
    empty.getByText("An agent appears here the first time it runs an octo command with its name.");
    empty.getByText("export OCTO_AGENT=feature-x");
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

  test("with nothing being worked on, Working on says so and draws no empty sheet", async () => {
    server.tracker.call(
      c.lineAdd,
      { title: "Wall mount", doneWhen: "It hangs.", where: "up_next" },
      asDeveloper,
    );
    navigate("/lines");
    const view = renderApp(<App />);
    const working = await view.findByRole("region", { name: "Working on" });
    await within(working).findByText("Nothing is being worked on");
    expect(within(working).queryByRole("article")).toBeNull();
  });

  test("with nothing placed yet, home leaves out the empty sections above the proposals", async () => {
    server.act(
      c.linePropose,
      { title: "Wall mount", doneWhen: "It hangs.", recommendation: "up_next", why: "The base is final." },
      "panel-agent",
    );
    navigate("/lines");
    const view = renderApp(<App />);
    await view.findByRole("region", { name: "Nothing is placed yet" });
    await view.findByRole("region", { name: /Recommended for up next/ });
    expect(view.queryByRole("region", { name: "Working on" })).toBeNull();
    expect(view.queryByRole("region", { name: "Up next" })).toBeNull();
  });

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
    proposed.getByRole("button", { name: "Wall mount" });
    proposed.getByText("proposed by panel-agent");
    proposed.getByText(whole("Recommends Up next: The base is final."));
  });

  test("the developer places a proposal, reorders, tables with a reason and adds a line", async () => {
    const proposal = seedLines();
    navigate("/lines");
    const view = renderApp(<App />);
    const proposed = within(await view.findByRole("region", { name: "Proposed" }));
    proposalMove(proposed, "Up next", "Wall mount");
    // Every choice waits a few seconds with Undo; Now skips the wait.
    await within(await view.findByRole("status", { name: "" })).findByText(
      wholeMatching(/^Moving Wall mount to up next in \d s$/),
    );
    await answerNow(view);
    const upNext = within(await view.findByRole("region", { name: "Up next" }));
    await upNext.findByText("Wall mount");
    expect(server.tracker.call(c.lineShow, { ref: proposal.ref }, asDeveloper).line.state).toBe("up_next");

    const working = within(view.getByRole("region", { name: "Working on" }));
    fireEvent.click(working.getByRole("button", { name: "Move Weekly digest" }));
    fireEvent.click(working.getByRole("menuitem", { name: "Up" }));
    await waitFor(() => {
      const order = within(view.getByRole("region", { name: "Working on" }))
        .getAllByRole("button", { name: /^(Sendspin enclosure|Weekly digest)$/ })
        .map((b) => b.textContent);
      expect(order).toEqual(["Weekly digest", "Sendspin enclosure"]);
    });

    // A working line is tabled from its panel, which opens in place.
    fireEvent.click(working.getByRole("button", { name: "Sendspin enclosure" }));
    const panel = within(await view.findByRole("complementary", { name: "L-1" }));
    fireEvent.click(await panel.findByRole("button", { name: "Table" }));
    const tabling = within(await view.findByRole("dialog", { name: "Table Sendspin enclosure" }));
    fireEvent.change(tabling.getByLabelText("Why it waits · optional"), {
      target: { value: "Waiting on the board" },
    });
    fireEvent.click(tabling.getByRole("button", { name: "Table it" }));
    await answerNow(view);
    const tabled = within(await view.findByRole("region", { name: "Tabled" }));
    fireEvent.click(tabled.getByRole("button", { name: /^Tabled/ }));
    await tabled.findByText(/Waiting on the board/);

    fireEvent.click(view.getByRole("button", { name: "New line" }));
    const card = within(await view.findByRole("dialog", { name: "New line" }));
    fireEvent.change(card.getByLabelText("What it is"), { target: { value: "Garden sensor" } });
    fireEvent.change(card.getByLabelText("Done when"), { target: { value: "Readings arrive hourly." } });
    // Nothing is added until it has a repo, or is the developer's own.
    expect(card.getByRole("button", { name: "Add to up next" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(
      await within(card.getByRole("group", { name: "Repos" })).findByRole("checkbox", { name: "OCT" }),
    );
    fireEvent.click(card.getByRole("button", { name: "Add to up next" }));
    await gone(() => view.queryByRole("dialog", { name: "New line" }));
    await answerNow(view);
    await within(view.getByRole("region", { name: "Up next" })).findByRole("button", {
      name: "Garden sensor",
    });
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
    await working.findByText(/octo\.1, running/);
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
    line.getByText(/waiting on you/);
    fireEvent.click(line.getByRole("button", { name: "1 more for you: a task at the bench" }));
    fireEvent.click(line.getByRole("button", { name: `Open ${task.ref}` }));
    const opened = within(await line.findByRole("article", { name: "Measure the grip" }));
    fireEvent.change(opened.getByLabelText("Five numbers"), { target: { value: "41, 38, 12" } });
    fireEvent.click(opened.getByRole("button", { name: "Done" }));
    await answerNow(view);
    await waitFor(() =>
      expect(
        server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.status,
      ).toBe("done"),
    );
    await gone(() => line.queryByRole("button", { name: `Open ${task.ref}` }));
  });

  test("a task with only a title is replied to, and stays open; then done with no words", async () => {
    seedLines();
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    const task = server.act(c.taskFile, { title: "Log in to Tailscale" }, "octo.1");
    navigate("/lines");
    const view = renderApp(<App />);
    const line = within(await view.findByRole("article", { name: "Sendspin enclosure" }));
    const opened = within(await line.findByRole("article", { name: "Log in to Tailscale" }));
    fireEvent.click(opened.getByRole("button", { name: "Reply" }));
    fireEvent.change(opened.getByLabelText("Reply to octo.1"), { target: { value: "Which account?" } });
    fireEvent.click(opened.getByRole("button", { name: "Send" }));
    // Sent, the box closes; the reply waits out its Undo, and Done is not held up by it.
    await waitFor(() => expect(opened.queryByLabelText("Reply to octo.1")).toBeNull());
    await opened.findByText(/Replying: Which account\?/);
    expect(opened.getByRole("button", { name: "Done" }).getAttribute("aria-busy")).toBeNull();
    await answerNow(view);
    await opened.findByText(/You replied: Which account\?/);
    await waitFor(() =>
      expect(
        server.tracker
          .execute(c.agentList.name, {}, { actor: "octo.1", channel: "cli" })
          .notices.map((n) => n.body),
      ).toContainEqual(expect.stringContaining("Which account?")),
    );
    expect(server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.status).toBe(
      "todo",
    );
    fireEvent.click(opened.getByRole("button", { name: "Done" }));
    await answerNow(view);
    await waitFor(() =>
      expect(
        server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.status,
      ).toBe("done"),
    );
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
      fireEvent.click(opened.getByRole("button", { name: "Can't do it" }));
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

    test("a task with named outcomes takes a box for each, and Done sends them all to its line", async () => {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      const task = server.act(
        c.taskFile,
        { title: "Measure the board", place: "the bench", outcome: "In mm", fields: ["Length", "Holes"] },
        "octo.1",
      );
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the board" }));
      fireEvent.change(opened.getByLabelText("Length"), { target: { value: "41" } });
      fireEvent.change(opened.getByLabelText("Holes"), { target: { value: "38" } });
      opened.getByText(/2 of 2 filled/);
      fireEvent.click(opened.getByRole("button", { name: "Done" }));
      await view.findByText(/Sending "Length 41, Holes 38" to Sendspin enclosure/);
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.result,
        ).toBe("- Length: 41\n- Holes: 38"),
      );
    });

    test("undoing a task's Done keeps what was typed", async () => {
      withTask();
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the grip" }));
      fireEvent.change(opened.getByLabelText("Five numbers"), { target: { value: "41, 38, 12" } });
      fireEvent.click(opened.getByRole("button", { name: "Done" }));
      fireEvent.click(await view.findByRole("button", { name: "Undo" }));
      await gone(() => view.queryByRole("button", { name: "Undo" }));
      expect(opened.getByLabelText("Five numbers")).toHaveProperty("value", "41, 38, 12");
    });

    test("the Undo bar's live region is there before the first choice, so that one is announced too", async () => {
      seedLines();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("region", { name: "Working on" });
      const live = view
        .getAllByRole("status")
        .find((element) => element.getAttribute("aria-live") === "polite");
      expect(live?.textContent).toBe("");
      proposalMove(view, "Start", "Wall mount");
      await within(live ?? document.body).findByText(wholeMatching(/^Starting Wall mount in \d s$/));
    });

    test("a choice that fails when it takes effect says why in the Undo bar, until dismissed", async () => {
      const asked = seedDecision();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("heading", { name: "Which queue?" });
      fireEvent.click(view.getByRole("button", { name: /Redis/ }));
      await view.findByRole("button", { name: "Undo" });
      // Meanwhile, from elsewhere, the question loses the option picked, so the answer can no longer be given.
      server.tracker.call(
        c.decisionUpdate,
        { ref: asked.ref, options: [{ key: "sqs", label: "SQS" }] },
        asDeveloper,
      );
      await answerNow(view);
      const alert = await view.findByRole("alert");
      expect(alert.textContent).toContain("Did not happen");
      fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
      await gone(() => view.queryByRole("alert"));
    });

    test("Fold into folds a proposal into the line chosen, by button", async () => {
      const proposal = seedLines();
      navigate("/");
      const view = renderApp(<App />);
      const proposed = within(await view.findByRole("region", { name: "Proposed" }));
      proposalMove(proposed, "Fold", "Wall mount");
      const sheet = within(await view.findByRole("dialog", { name: "Fold Wall mount into…" }));
      fireEvent.click(sheet.getByRole("button", { name: "Sendspin enclosure" }));
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
      fireEvent.click(await panel.findByRole("button", { name: "Table" }));
      const tabling = within(await view.findByRole("dialog", { name: "Table Sendspin enclosure" }));
      fireEvent.change(tabling.getByLabelText("Why it waits · optional"), {
        target: { value: "Waiting on boards" },
      });
      fireEvent.click(tabling.getByRole("button", { name: "Table it" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.tabledReason).toBe(
          "Waiting on boards",
        ),
      );
      fireEvent.click(
        await panel.findByRole("button", { name: "More: drop this line, fold it into another" }),
      );
      fireEvent.click(panel.getByRole("menuitem", { name: "Drop" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.state).toBe("dropped"),
      );
    });

    test("a press outside the line panel closes it; one inside it, or on the Undo bar, does not", async () => {
      seedLines();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = await view.findByRole("complementary", { name: "L-1" });
      const press = (target: Element) => {
        fireEvent.pointerDown(target);
        fireEvent.click(target);
      };
      const open = () => expect(view.queryByRole("complementary", { name: "L-1" })).not.toBeNull();
      press(within(panel).getByRole("heading", { name: "Sendspin enclosure" }));
      open();
      // The panel itself, below its content: on a phone it is the whole screen.
      press(panel);
      open();
      // A finger scrolling the page beside it ends in no click, and leaves it open.
      fireEvent.pointerDown(document.body);
      open();
      // Text selected from inside it out to the page beside it is no press outside it.
      fireEvent.pointerDown(within(panel).getByRole("heading", { name: "Sendspin enclosure" }));
      fireEvent.click(document.body);
      open();
      // Something it shows over the page, such as the Undo bar, is part of it.
      fireEvent.click(view.getByRole("button", { name: "Done" }));
      const undo = await view.findByRole("button", { name: "Undo" });
      press(undo);
      open();
      press(document.body);
      await gone(() => view.queryByRole("complementary", { name: "L-1" }));
    });

    test("a plan step is marked done from the line panel, and the next one becomes now", async () => {
      seedLines();
      server.tracker.call(
        c.planSet,
        { line: "L-1", steps: ["Model the base", "Print and test-fit"] },
        asDeveloper,
      );
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      await panel.findByText("step 1 of 2");
      fireEvent.click(await panel.findByRole("button", { name: "Step 1, Model the base: to do" }));
      fireEvent.click(panel.getByRole("menuitemradio", { name: "Done" }));
      await waitFor(() =>
        expect(
          server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).steps.map((step) => step.status),
        ).toEqual(["done", "todo"]),
      );
      await panel.findByText("step 2 of 2");
      await panel.findByRole("button", { name: "Step 1, Model the base: done" });
    });

    test("a branch is shown under its step, set to hold nothing up, and made its own line with Undo's window", async () => {
      seedLines();
      server.tracker.call(c.planSet, { line: "L-1", steps: ["Model", "Print", "Hang it"] }, asDeveloper);
      server.tracker.call(
        c.planBranch,
        { line: "L-1", from: "2", holdsUp: "3", title: "Breakout", steps: ["Pick a board", "Order it"] },
        asDeveloper,
      );
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      await panel.findByText("step 1 of 3 · 1 branch open");
      const rail = within(await panel.findByRole("group", { name: "Branch 2a, Breakout" }));
      rail.getByText("holds up step 3");

      fireEvent.click(rail.getByRole("button", { name: "More: branch 2a, Breakout" }));
      fireEvent.click(panel.getByRole("menuitemradio", { name: "Nothing" }));
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).branches[0]?.holdsUp).toBeNull(),
      );
      await panel.findByText("holds nothing up");

      fireEvent.click(panel.getByRole("button", { name: "More: branch 2a, Breakout" }));
      fireEvent.click(panel.getByRole("menuitem", { name: "Make it its own line…" }));
      const sheet = within(await view.findByRole("dialog", { name: "Make 2a its own line" }));
      fireEvent.change(sheet.getByLabelText("Done when"), { target: { value: "A board is soldered in." } });
      fireEvent.click(sheet.getByRole("button", { name: "Make it a line, up next" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).branches[0]?.became?.title).toBe(
          "Breakout",
        ),
      );
      await panel.findByText(/its own line now: L-\d+/);
    });

    test("a step that waits is marked done all the same; a branch is renamed through its sheet", async () => {
      seedLines();
      server.tracker.call(c.planSet, { line: "L-1", steps: ["Model", "Print", "Hang it"] }, asDeveloper);
      server.tracker.call(
        c.planBranch,
        { line: "L-1", from: "2", holdsUp: "3", title: "Breakout", steps: ["Pick a board"] },
        asDeveloper,
      );
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.click(await panel.findByRole("button", { name: "Step 3, Hang it: to do" }));
      fireEvent.click(panel.getByRole("menuitemradio", { name: "Done" }));
      await waitFor(() =>
        expect(
          server.tracker
            .call(c.lineShow, { ref: "L-1" }, asDeveloper)
            .steps.find((step) => step.address === "3")?.status,
        ).toBe("done"),
      );

      fireEvent.click(panel.getByRole("button", { name: "More: branch 2a, Breakout" }));
      fireEvent.click(panel.getByRole("menuitem", { name: "Rename or change its steps…" }));
      const sheet = within(await view.findByRole("dialog", { name: "Change branch 2a" }));
      fireEvent.change(sheet.getByLabelText("Title"), { target: { value: "USB-C breakout" } });
      fireEvent.change(sheet.getByLabelText("Its steps, one per line"), {
        target: { value: "Pick a board\nOrder it" },
      });
      fireEvent.click(sheet.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(
          server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).steps.map((step) => step.address),
        ).toEqual(["1", "2", "2a.1", "2a.2", "3"]),
      );
      await panel.findByRole("group", { name: "Branch 2a, USB-C breakout" });
    });

    test("a removal waiting in Undo's window removes the branch it was asked for, though its address moved", async () => {
      seedLines();
      server.tracker.call(c.planSet, { line: "L-1", steps: ["Model", "Print"] }, asDeveloper);
      for (const title of ["First", "Second"]) {
        server.tracker.call(c.planBranch, { line: "L-1", from: "2", title, steps: ["x"] }, asDeveloper);
      }
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.click(await panel.findByRole("button", { name: "More: branch 2b, Second" }));
      fireEvent.click(panel.getByRole("menuitem", { name: "Remove the branch" }));
      await view.findByText(/Removing branch 2b, Second/);
      // Meanwhile First goes, so Second is 2a now.
      server.tracker.call(c.planBranchRemove, { line: "L-1", branch: "2a" }, asDeveloper);
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).branches).toEqual([]),
      );
    });
  });

  test("a choice waits with Undo, and Undo or the u key means it never happened", async () => {
    const proposal = seedLines();
    navigate("/lines");
    const view = renderApp(<App />);
    const proposed = within(await view.findByRole("region", { name: "Proposed" }));
    proposalMove(proposed, "Start", "Wall mount");
    fireEvent.click(await view.findByRole("button", { name: "Undo" }));
    await gone(() => view.queryByRole("button", { name: "Undo" }));
    proposalMove(proposed, "Not a line:", "Wall mount");
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

  describe("the log, by what was seen", () => {
    test("Not seen shows only what changed on a line since it was looked at, and Mark all seen clears it", async () => {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.seen, {}, asDeveloper);
      server.later(1);
      server.act(c.planSet, { line: "L-1", steps: ["Model", "Print"] }, "octo.1");
      navigate("/log");
      const view = renderApp(<App />);
      const feed = within(await view.findByRole("main"));
      const line = within(await feed.findByRole("article", { name: "Sendspin enclosure" }));
      await line.findByText("1 unseen");
      line.getByText(/plan/i);
      // A line with nothing unseen is left out.
      expect(feed.queryByRole("article", { name: "Weekly digest" })).toBeNull();
      // A plain button: it acts on the whole page, so it is not a word that steps back.
      expect(view.getByRole("button", { name: "Mark all seen" }).getAttribute("data-variant")).toBe("plain");
      fireEvent.click(view.getByRole("button", { name: "Mark all seen" }));
      // It waits with Undo, like every choice.
      await view.findByText(/Marking everything seen/);
      line.getByText("1 unseen");
      await answerNow(view);
      await feed.findByRole("heading", { name: "Nothing new" });
    });
  });

  test("Not seen shows a new proposal too, not only working lines", async () => {
    seedLines();
    server.tracker.call(c.seen, {}, asDeveloper);
    server.later(1);
    server.act(
      c.linePropose,
      {
        title: "Garden sensor",
        doneWhen: "Readings arrive.",
        recommendation: "up_next",
        why: "The bed is planted.",
      },
      "panel-agent",
    );
    navigate("/log");
    const view = renderApp(<App />);
    const feed = within(await view.findByRole("main"));
    const proposal = within(await feed.findByRole("article", { name: "Garden sensor" }));
    await proposal.findByText("1 unseen");
  });

  describe("keys on home", () => {
    const options = [{ key: "a", label: "Yes", description: "Go ahead." }];
    function onLine() {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.act(c.decisionAsk, { title: "Which board?", context: "Context.", options }, "octo.1");
    }
    const selected = (element: HTMLElement) => focusOf(element);

    test("g then u goes to the urgent question, and undoes nothing", async () => {
      onLine();
      const board = server.act(
        c.decisionAsk,
        { title: "Which plug?", context: "Context.", options },
        "octo.1",
      );
      server.act(
        c.decisionAsk,
        { title: "Order now?", context: "Stock.", options, urgent: "costs_money" },
        "octo.1",
      );
      navigate(`/?focus=${board.ref}`);
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which plug?" });
      fireEvent.keyDown(window, { key: "g" });
      fireEvent.keyDown(window, { key: "u" });
      await waitFor(() => expect(focusOf(view.getByRole("article", { name: "Order now?" }))).toBe("true"));
    });

    test("Shift J steps to the next line, even one with nothing for the developer", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "J", shiftKey: true });
      await waitFor(() => expect(focusOf(view.getByRole("article", { name: "Weekly digest" }))).toBe("true"));
    });

    test("? opens the list of keys and Esc closes it, before anything else", async () => {
      onLine();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      await view.findByRole("complementary", { name: "L-1" });
      fireEvent.keyDown(window, { key: "?" });
      await view.findByRole("dialog", { name: "Keys" });
      fireEvent.keyDown(window, { key: "Escape" });
      await gone(() => view.queryByRole("dialog", { name: "Keys" }));
      // The key list went first; the panel is still open for the next Esc.
      view.getByRole("complementary", { name: "L-1" });
    });

    test("only the focused item is marked, by its border and the j and k hint beside it, never a word", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      const question = await view.findByRole("article", { name: "Which board?" });
      expect(question.closest("[aria-current='true']")).not.toBeNull();
      expect(document.querySelectorAll("[data-focus-ref][aria-current='true']")).toHaveLength(1);
      expect(view.queryByText("Focused")).toBeNull();
    });

    test("a proposal's number keys do nothing more while its choice waits", async () => {
      seedLines();
      navigate("/");
      const view = renderApp(<App />);
      const card = await view.findByRole("article", { name: "Wall mount" });
      fireEvent.focus(card);
      await waitFor(() => expect(focusOf(card)).toBe("true"));
      // 1 presses the recommended move, the one button.
      fireEvent.keyDown(window, { key: "1" });
      await view.findByRole("button", { name: "Undo" });
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "2" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(server.calls.filter((name) => name === "choice.make")).toHaveLength(1);
    });

    test("o or Enter opens the focused item's line, and t opens it at Tell, with the cursor in the box", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "o" });
      await view.findByRole("complementary", { name: "L-1" });
      fireEvent.keyDown(window, { key: "Escape" });
      await gone(() => view.queryByRole("complementary", { name: "L-1" }));
      fireEvent.keyDown(window, { key: "Enter" });
      await view.findByRole("complementary", { name: "L-1" });
      fireEvent.keyDown(window, { key: "Escape" });
      await gone(() => view.queryByRole("complementary", { name: "L-1" }));
      fireEvent.keyDown(window, { key: "t" });
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      const box = await panel.findByLabelText("Tell octo.1");
      expect(document.activeElement).toBe(box);
    });

    test("w opens the focused question's own words, with the cursor in the box", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "w" });
      const box = await view.findByLabelText("Your answer, in your own words");
      expect(document.activeElement).toBe(box);
    });

    test("g p goes to where I'm at, and Esc leaves the place", async () => {
      onLine();
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "g" });
      fireEvent.keyDown(window, { key: "p" });
      const picker = view.getByRole("button", { name: "I'm at: All places" });
      expect(document.activeElement).toBe(picker);
      fireEvent.click(picker);
      fireEvent.click(view.getByRole("menuitemradio", { name: "the bench" }));
      await view.findByRole("article", { name: "At the bench" });
      (document.activeElement instanceof HTMLElement ? document.activeElement : picker).blur();
      fireEvent.keyDown(window, { key: "Escape" });
      await gone(() => view.queryByRole("article", { name: "At the bench" }));
    });

    test("/ goes to the log's search from any page", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "/" });
      await view.findByRole("heading", { name: "Log" });
      await waitFor(() => expect(document.activeElement).toBe(view.getByLabelText("Search the log")));
    });

    test("alt and the arrows move the focused item's line", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "ArrowDown", altKey: true });
      await waitFor(() =>
        expect(server.tracker.call(c.homeShow, {}, asDeveloper).working.map((line) => line.ref)).toEqual([
          "L-2",
          "L-1",
        ]),
      );
    });

    test("number keys pick a focused task's choices in the order drawn", async () => {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      const task = server.act(
        c.taskFile,
        { title: "Weigh it", place: "the bench", outcome: "Grams" },
        "octo.1",
      );
      navigate("/");
      const view = renderApp(<App />);
      const card = await view.findByRole("article", { name: "Weigh it" });
      expect(selected(card)).toBe("true");
      fireEvent.keyDown(window, { key: "2" });
      await view.findByLabelText(`Why ${task.ref} cannot be done`);
    });

    test("? lists every key, and r opens Record answers", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "?" });
      const help = within(await view.findByRole("dialog", { name: "Keys" }));
      help.getByText(whole("g u"));
      fireEvent.click(help.getByRole("button", { name: "Close" }));
      await gone(() => view.queryByRole("dialog", { name: "Keys" }));
      fireEvent.keyDown(window, { key: "r" });
      await view.findByRole("dialog", { name: "Record answers" });
    });
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
      fireEvent.click(view.getByRole("link", { name: "1 to do" }));
      await view.findByRole("article", { name: "Weigh it" });
      fireEvent.click(view.getByRole("link", { name: "1 to accept" }));
      await waitFor(() => expect(focusOf(view.getByRole("article", { name: "Wall mount" }))).toBe("true"));
    });

    test("a count clicked again goes back to its item, after focus moved away", async () => {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      server.act(c.decisionAsk, { title: "Which board?", context: "Context.", options }, "octo.1");
      server.act(c.taskFile, { title: "Weigh it", place: "the bench", outcome: "Grams" }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.click(view.getByRole("link", { name: "1 to do" }));
      await view.findByRole("article", { name: "Weigh it" });
      fireEvent.keyDown(window, { key: "k" });
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.click(view.getByRole("link", { name: "1 to do" }));
      await view.findByRole("article", { name: "Weigh it" });
    });

    test("each press of a count goes on to the next such item, from the one in focus, and round again", async () => {
      seedLines();
      server.act(
        c.linePropose,
        { title: "Garden feed", doneWhen: "It loads.", recommendation: "up_next", why: "It broke." },
        "panel-agent",
      );
      navigate("/");
      const view = renderApp(<App />);
      const count = await view.findByRole("link", { name: "2 to accept" });
      const focusedOn = (name: string) =>
        waitFor(() => expect(focusOf(view.getByRole("article", { name }))).toBe("true"));
      // Focus starts on the first proposal, so a count that went to the first such item would do nothing at all.
      await focusedOn("Wall mount");
      // From the one in focus, a press moves on, on a phone where there are no keys to move with, and round again.
      fireEvent.click(count);
      await focusedOn("Garden feed");
      fireEvent.click(view.getByRole("link", { name: "2 to accept" }));
      await focusedOn("Wall mount");
    });

    test("a count pressed on another page goes to the first item it counts", async () => {
      seedLines();
      server.act(
        c.linePropose,
        { title: "Garden feed", doneWhen: "It loads.", recommendation: "up_next", why: "It broke." },
        "panel-agent",
      );
      navigate("/log");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("link", { name: "2 to accept" }));
      await waitFor(() => expect(focusOf(view.getByRole("article", { name: "Wall mount" }))).toBe("true"));
      expect(window.location.search).toBe("");
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
      const working = within(await view.findByRole("region", { name: "Working on" }));
      working.getByText("7 with no owner");
    });

    test("a line's handle moves it to the top", async () => {
      seedLines();
      navigate("/");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("button", { name: "Move Weekly digest" }));
      fireEvent.click(view.getByRole("menuitem", { name: "Move to top" }));
      await waitFor(() =>
        expect(server.tracker.call(c.homeShow, {}, asDeveloper).working.map((line) => line.title)[0]).toBe(
          "Weekly digest",
        ),
      );
    });

    test("a line shows its open pull requests, the ones its agent says are ready to merge first, here and in its panel", async () => {
      seedLines();
      const base = server.act(c.issueCreate, { project: "OCT", title: "Base", line: "L-1" }, "octo.1");
      for (const [number, title] of [
        [14, "Print the base"],
        [15, "Print the lid"],
      ] as const) {
        server.act(
          c.prUpsert,
          { repo: "acme/panel", number, title, state: "open", issues: [base.ref] },
          "octo.1",
        );
      }
      server.act(c.prReadyToMerge, { ref: "acme/panel#15", why: "Printed and fits." }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      const line = within(await view.findByRole("article", { name: "Sendspin enclosure" }));
      const named = () => line.getAllByRole("article").map((row) => row.getAttribute("aria-label"));
      await waitFor(() =>
        expect(named()).toEqual(["Ready to merge: Print the lid", "Pull request: Print the base"]),
      );
      line.getByText("Printed and fits.");
      navigate("/?ref=L-1");
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      const prs = within(await panel.findByRole("region", { name: "Pull requests" }));
      expect(prs.getAllByRole("article").map((row) => row.getAttribute("aria-label"))).toEqual([
        "Ready to merge: Print the lid",
        "Pull request: Print the base",
      ]);
    });

    test("a drag lands after a line from its lower half, and does nothing over itself, another section, after Esc, or for a second finger", async () => {
      seedLines();
      server.tracker.call(
        c.lineAdd,
        { title: "Shopping list", doneWhen: "Shared.", where: "up_next" },
        asDeveloper,
      );
      navigate("/");
      const view = renderApp(<App />);
      const working = within(await view.findByRole("region", { name: "Working on" }));
      const sendspin = working.getByRole("article", { name: "Sendspin enclosure" });
      const digest = working.getByRole("article", { name: "Weekly digest" });
      const shopping = await view.findByRole("article", { name: "Shopping list" });
      let under: Element = sendspin;
      const point = spyOn(document, "elementFromPoint").mockImplementation(() => under);
      const box = spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() =>
        DOMRect.fromRect({ y: 100, height: 40 }),
      );
      const order = () => server.tracker.call(c.homeShow, {}, asDeveloper).working.map((line) => line.title);
      const grip = () => working.getByRole("button", { name: "Move Sendspin enclosure" });
      const drag = (
        to: Element,
        y: number,
        end: () => void = () => fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: y }),
      ) => {
        under = to;
        fireEvent.pointerDown(grip(), { pointerId: 1, clientX: 10, clientY: 300, button: 0 });
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: y });
        end();
        // A browser sends the click to what the press and the lift share, here the line's own head.
        const head = to.querySelector(".ui-row-head");
        if (head !== null) fireEvent.click(head);
      };
      // Over itself: nothing moves, and the click that ends the drag opens nothing.
      drag(sendspin, 110);
      expect(view.queryByRole("complementary", { name: "L-1" })).toBeNull();
      // Over a line in another section: nothing moves.
      drag(shopping, 110);
      // Esc while dragging: nothing moves.
      drag(digest, 130, () => {
        fireEvent.keyDown(document.body, { key: "Escape" });
        fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 130 });
      });
      // A second finger lifting elsewhere neither ends the drag nor drops it.
      under = digest;
      fireEvent.pointerDown(grip(), { pointerId: 1, clientX: 10, clientY: 300, button: 0 });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 130 });
      fireEvent.pointerUp(window, { pointerId: 2, clientX: 10, clientY: 130 });
      expect(digest.getAttribute("data-drop-edge")).toBe("after");
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(order()).toEqual(["Sendspin enclosure", "Weekly digest"]);
      // The first finger lifting, in the lower half of Weekly digest, lands it after.
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 130 });
      point.mockRestore();
      box.mockRestore();
      await waitFor(() => expect(order()).toEqual(["Weekly digest", "Sendspin enclosure"]));
      expect(view.queryByRole("complementary", { name: "L-1" })).toBeNull();
      // The handle still opens its moves from the keyboard afterwards.
      fireEvent.click(working.getByRole("button", { name: "Move Sendspin enclosure" }));
      view.getByRole("menu", { name: "Move Sendspin enclosure" });
    });

    test("a press anywhere on a line that is not one of its controls opens it", async () => {
      seedLines();
      navigate("/");
      const view = renderApp(<App />);
      const working = within(await view.findByRole("region", { name: "Working on" }));
      // Its handle is a control: pressed, it opens its moves, not the line.
      fireEvent.click(working.getByRole("button", { name: "Move Sendspin enclosure" }));
      expect(view.queryByRole("complementary", { name: "L-1" })).toBeNull();
      fireEvent.keyDown(window, { key: "Escape" });
      const line = working.getByRole("article", { name: "Sendspin enclosure" });
      const facts = line.querySelector(".ui-row-facts");
      if (facts === null) throw new Error("The line shows no facts");
      fireEvent.click(facts);
      await view.findByRole("complementary", { name: "L-1" });
    });

    test("a line is dragged by its handle before another, or sent to up next from its menu", async () => {
      seedLines();
      navigate("/");
      const view = renderApp(<App />);
      const working = within(await view.findByRole("region", { name: "Working on" }));
      // Dragged with a pointer, as a mouse, a finger or a pen does. The test page has no layout, so what lies under the
      // pointer, and where that row sits, are given here: the top half of Sendspin enclosure, so it lands before it.
      const target = working.getByRole("article", { name: "Sendspin enclosure" });
      const under = spyOn(document, "elementFromPoint").mockReturnValue(target);
      const box = spyOn(target, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ y: 100, height: 40 }),
      );
      const grip = working.getByRole("button", { name: "Move Weekly digest" });
      fireEvent.pointerDown(grip, { pointerId: 1, clientX: 10, clientY: 200, button: 0 });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 10, clientY: 110 });
      await working
        .findByRole("article", { name: "Sendspin enclosure" })
        .then((row) => expect(row.getAttribute("data-drop-edge")).toBe("before"));
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 110 });
      // The click that ends a drag opens no menu.
      fireEvent.click(grip);
      expect(view.queryByRole("menu")).toBeNull();
      under.mockRestore();
      box.mockRestore();
      await waitFor(() =>
        expect(server.tracker.call(c.homeShow, {}, asDeveloper).working.map((line) => line.title)).toEqual([
          "Weekly digest",
          "Sendspin enclosure",
        ]),
      );
      fireEvent.click(view.getByRole("button", { name: "Move Weekly digest" }));
      fireEvent.click(view.getByRole("menuitem", { name: "To up next" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.homeShow, {}, asDeveloper).upNext.map((line) => line.title)).toContain(
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
      const urgent = within(cards[0] ?? document.body);
      urgent.getByText(whole("Something broken"));
      // Start is its first choice, and filled, as recommended.
      const start = urgent.getByRole("button", { name: "Start Restore the feed" });
      expect(start.getAttribute("data-choice")).toBe("1");
      expect(start.getAttribute("data-variant")).toBe("primary");
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
      const note = within(await view.findByRole("group", { name: "Step in on Capped" }));
      fireEvent.click(note.getByRole("button", { name: "Start one anyway" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.startAnyway).not.toBeNull(),
      );
    });

    test("a clone that failed offers Set its checkout", async () => {
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
            // As the runner reports a start it could find no usable checkout for.
            cause: "checkout",
          },
          asServer,
        );
        server.tracker.call(c.runnerRetry, { line: "L-1" }, asDeveloper);
      }
      navigate("/");
      const view = renderApp(<App />);
      const note = within(await view.findByRole("group", { name: "Step in on No clone" }));
      fireEvent.click(note.getByRole("button", { name: "Set its checkout" }));
      fireEvent.change(note.getByLabelText("Checkout of OCT"), { target: { value: "/code/octotrack" } });
      fireEvent.click(note.getByRole("button", { name: "Set" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.entityShow, { ref: "OCT" }, asDeveloper).entity).toMatchObject({
          checkout: "/code/octotrack",
        }),
      );
    });

    test("I'm at a place opens every task for it on its line, folds the rest, and adds up-next tasks, until left", async () => {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      server.tracker.call(c.placeAdd, { name: "the Mac" }, asDeveloper);
      server.act(c.taskFile, { title: "Weigh it", place: "the bench", outcome: "Grams" }, "octo.1");
      server.act(c.taskFile, { title: "Measure it", place: "the bench", outcome: "mm" }, "octo.1");
      server.act(c.taskFile, { title: "Photograph it", place: "the Mac", outcome: "A photo" }, "octo.1");
      server.act(c.decisionAsk, { title: "Which board?", context: "Context.", options }, "octo.1");
      const queued = server.tracker.call(
        c.lineAdd,
        { title: "Mount", doneWhen: "It hangs.", repos: ["OCT"], where: "up_next" },
        asDeveloper,
      );
      server.act(c.agentRegister, { repo: "OCT" }, "octo.2");
      server.act(c.lineTake, { ref: queued.ref }, "octo.2");
      server.act(
        c.taskFile,
        { line: queued.ref, title: "Check the wall", place: "the bench", outcome: "Studs" },
        "octo.2",
      );
      navigate("/");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("button", { name: "I'm at: All places" }));
      fireEvent.click(view.getByRole("menuitemradio", { name: "the bench" }));
      const at = within(await view.findByRole("article", { name: "At the bench" }));
      at.getByText(/^ends by itself in \d+h$/);
      const line = within(view.getByRole("article", { name: "Sendspin enclosure" }));
      await line.findByRole("article", { name: "Weigh it" });
      line.getByRole("article", { name: "Measure it" });
      line.getByRole("button", { name: "Also on this line: 1 question · 1 task at the Mac" });
      expect(line.getAllByRole("button", { name: "Done" })).toHaveLength(2);
      const upNext = within(view.getByRole("region", { name: "Here, from up next" }));
      upNext.getByRole("article", { name: "Check the wall" });
      fireEvent.click(at.getByRole("button", { name: "Leave" }));
      await gone(() => view.queryByRole("article", { name: "At the bench" }));
    });

    test("Start from a waiting line's panel opens its Start sheet, where a number key answers a held question", async () => {
      seedLines();
      const queued = server.tracker.call(
        c.lineAdd,
        { title: "Mount", doneWhen: "It hangs.", repos: ["OCT"], where: "up_next" },
        asDeveloper,
      );
      server.act(c.agentRegister, { repo: "OCT" }, "octo.2");
      server.act(c.lineTake, { ref: queued.ref }, "octo.2");
      const asked = server.act(
        c.decisionAsk,
        { title: "Which wall?", context: "Context.", options },
        "octo.2",
      );
      navigate(`/?ref=${queued.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: queued.ref }));
      fireEvent.click(await panel.findByRole("button", { name: "Start" }));
      // The Start sheet is drawn over the whole page, outside the panel that opened it.
      const sheet = await loadedSheet(view, "Start Mount");
      sheet.getByRole("button", { name: "Yes" });
      fireEvent.keyDown(window, { key: "1" });
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.decisionList, { query: `ref:${asked.ref}` }, asDeveloper)[0]?.status,
        ).toBe("decided"),
      );
      expect(server.tracker.call(c.lineShow, { ref: queued.ref }, asDeveloper).line.state).toBe("up_next");
    });

    test("the Start sheet takes one key press per choice while it waits", async () => {
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
      const sheet = await loadedSheet(view, "Start Mount");
      sheet.getByRole("button", { name: "Yes" });
      fireEvent.keyDown(window, { key: "1" });
      await view.findByRole("button", { name: "Undo" });
      fireEvent.keyDown(window, { key: "1" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(server.calls.filter((name) => name === "choice.make")).toHaveLength(1);
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
      // One sheet from the moment it opens: loading what it holds fills it, never swaps it for another, so the cursor
      // and anything holding it stay put.
      const opened = view.getByRole("dialog", { name: "Start Mount" });
      const sheet = await loadedSheet(view, "Start Mount");
      expect(view.getByRole("dialog", { name: "Start Mount" })).toBe(opened);
      sheet.getByRole("heading", { name: "Which wall?" });
      fireEvent.click(sheet.getByRole("button", { name: "Start" }));
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
      panel.getByLabelText("Tell octo.1");
      fireEvent.click(panel.getByRole("button", { name: "Tell" }));
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

    test("a question in the panel opens on its own from its ref, and Esc goes back to the line", async () => {
      owned();
      const options = [{ key: "a", label: "Yes", description: "Go ahead." }];
      const asked = server.act(
        c.decisionAsk,
        { title: "Which board?", context: "Context.", options },
        "octo.1",
      );
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.click(await panel.findByRole("button", { name: asked.ref }));
      await view.findByRole("complementary", { name: asked.ref });
      fireEvent.keyDown(window, { key: "Escape" });
      await view.findByRole("complementary", { name: "L-1" });
      fireEvent.keyDown(window, { key: "Escape" });
      await gone(() => view.queryByRole("complementary", { name: "L-1" }));
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
      fireEvent.click(await panel.findByRole("button", { name: "Table" }));
      const tabling = within(await view.findByRole("dialog", { name: "Table Sendspin enclosure" }));
      fireEvent.change(tabling.getByLabelText("Why it waits · optional"), {
        target: { value: "After the move" },
      });
      fireEvent.change(tabling.getByLabelText("Look again on · optional"), {
        target: { value: "2027-02-01" },
      });
      fireEvent.click(tabling.getByRole("button", { name: "Table it" }));
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

    test("a task of the developer's own is done with one press, worded by its title", async () => {
      const mine = server.tracker.call(
        c.lineAdd,
        { title: "Tax archive", doneWhen: "Filed.", where: "working" },
        asDeveloper,
      );
      const task = server.tracker.call(
        c.taskAdd,
        { line: mine.ref, title: "Scan the receipts" },
        asDeveloper,
      );
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Scan the receipts" }));
      fireEvent.click(opened.getByRole("button", { name: "Done" }));
      await view.findByText(/Marking "Scan the receipts" done/);
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.status,
        ).toBe("done"),
      );
    });

    test("handing a line of the developer's own to the agents asks for its repos when it names none", async () => {
      const mine = server.tracker.call(
        c.lineAdd,
        { title: "Tax archive", doneWhen: "Filed.", where: "working" },
        asDeveloper,
      );
      navigate(`/?ref=${mine.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: mine.ref }));
      fireEvent.click(await panel.findByRole("button", { name: "Hand to an agent" }));
      fireEvent.click(await panel.findByRole("checkbox", { name: "OCT" }));
      fireEvent.click(panel.getByRole("button", { name: "Hand over" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: mine.ref }, asDeveloper).line).toMatchObject({
          ownedBy: null,
          repos: ["OCT"],
        }),
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

    test("Change answer reopens an answered question, from its panel", async () => {
      const question = asked();
      server.tracker.call(c.decisionResolve, { ref: question.ref, option: "a" }, asDeveloper);
      navigate(`/?ref=${question.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: question.ref }));
      fireEvent.click(await panel.findByRole("button", { name: "Change answer" }));
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

    test("a case for done is the line's first item, and Done ends the line", async () => {
      proposed();
      navigate("/");
      const view = renderApp(<App />);
      const card = within(await view.findByRole("article", { name: "Sendspin enclosure is done?" }));
      fireEvent.click(card.getByRole("button", { name: "Done" }));
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
      fireEvent.click(card.getByRole("button", { name: "Not yet" }));
      fireEvent.change(card.getByLabelText("What it still needs"), { target: { value: "The lid rattles" } });
      fireEvent.click(card.getByRole("button", { name: "Send" }));
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
      const stepIn = within(await view.findByRole("group", { name: "Step in on Nobody's line" }));
      fireEvent.click(stepIn.getByRole("button", { name: "I'll own it" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: line.ref }, asDeveloper).line.ownedBy).toBe("dev"),
      );
    });

    test("Table it tables the line with the reason given", async () => {
      const line = unowned();
      server.later(1);
      navigate("/");
      const view = renderApp(<App />);
      const stepIn = within(await view.findByRole("group", { name: "Step in on Nobody's line" }));
      fireEvent.click(stepIn.getByRole("button", { name: "Table it" }));
      const tabling = within(await view.findByRole("dialog", { name: "Table Nobody's line" }));
      fireEvent.change(tabling.getByLabelText("Why it waits · optional"), {
        target: { value: "Not this month" },
      });
      fireEvent.click(tabling.getByRole("button", { name: "Table it" }));
      await answerNow(view);
      await waitFor(() =>
        expect(server.tracker.call(c.lineShow, { ref: line.ref }, asDeveloper).line.tabledReason).toBe(
          "Not this month",
        ),
      );
    });

    test("number keys act on Step in only while it has focus, and once while its choice waits", async () => {
      const line = unowned();
      server.later(1);
      navigate("/");
      const view = renderApp(<App />);
      const stepIn = await view.findByRole("group", { name: "Step in on Nobody's line" });
      fireEvent.focus(stepIn);
      await waitFor(() => expect(focusOf(stepIn)).toBe("true"));
      const own =
        within(stepIn).getByRole("button", { name: "I'll own it" }).getAttribute("data-choice") ?? "";
      fireEvent.keyDown(window, { key: own });
      await view.findByRole("button", { name: "Undo" });
      fireEvent.keyDown(window, { key: own });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(server.calls.filter((name) => name === "choice.make")).toHaveLength(1);
      fireEvent.click(view.getByRole("button", { name: "Undo" }));
      await gone(() => view.queryByRole("button", { name: "Undo" }));
      // On the line itself, reached with Shift J, the numbers do nothing.
      fireEvent.keyDown(window, { key: "K", shiftKey: true });
      await waitFor(() => expect(focusOf(view.getByRole("article", { name: "Nobody's line" }))).toBe("true"));
      fireEvent.keyDown(window, { key: own });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(server.calls.filter((name) => name === "choice.make")).toHaveLength(1);
      expect(server.tracker.call(c.lineShow, { ref: line.ref }, asDeveloper).line.ownedBy).toBeNull();
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
      expect(view.queryByRole("group", { name: "Step in on Nobody's line" })).toBeNull();
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
    ) => focusOf(view.getByRole("article", { name }));

    test("focus is the browser's own: j puts it on the item, and clicking into another item moves it there", async () => {
      onLine();
      server.act(c.decisionAsk, { title: "Which board?", context: "Printed.", options }, "octo.1");
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "j" });
      const plug = await view.findByRole("article", { name: "Which plug?" });
      await waitFor(() => expect(document.activeElement?.contains(plug)).toBe(true));
      fireEvent.focus(view.getByRole("button", { name: "Open D-1" }));
      await waitFor(() => expect(selected(view, "Which board?")).toBe("true"));
    });

    test("one press opens what it lands on: nothing moves while the press is held", async () => {
      onLine();
      // Urgent, so it is open at the top, and Which plug? is its line's own row below it.
      server.act(
        c.decisionAsk,
        { title: "Which board?", context: "Printed.", options, urgent: "time_boxed" },
        "octo.1",
      );
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      const plug = await view.findByRole("button", { name: "Open D-2" });
      // A press takes the browser's focus as it goes down; Which board? stays open until the press ends, or the page
      // would move under the pointer and the press would land on something else.
      fireEvent.pointerDown(plug, { pointerId: 1, button: 0 });
      fireEvent.focus(plug);
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(view.queryByRole("button", { name: "Open D-1" })).toBeNull();
      fireEvent.pointerUp(plug, { pointerId: 1, button: 0 });
      fireEvent.click(plug);
      await waitFor(() => expect(selected(view, "Which plug?")).toBe("true"));
      view.getByRole("button", { name: "Open D-1" });
    });

    test("a tap opens what it lands on too, though a touch screen sends its focus and click after the finger lifts", async () => {
      onLine();
      server.act(
        c.decisionAsk,
        { title: "Which board?", context: "Printed.", options, urgent: "time_boxed" },
        "octo.1",
      );
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      const plug = await view.findByRole("button", { name: "Open D-2" });
      fireEvent.pointerDown(plug, { pointerId: 1, button: 0, pointerType: "touch" });
      fireEvent.pointerUp(plug, { pointerId: 1, button: 0, pointerType: "touch" });
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      fireEvent.focus(plug);
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(view.queryByRole("button", { name: "Open D-1" })).toBeNull();
      fireEvent.click(plug);
      await waitFor(() => expect(selected(view, "Which plug?")).toBe("true"));
    });

    test("a right press, which ends in no click, leaves Tab moving focus as before", async () => {
      onLine();
      server.act(
        c.decisionAsk,
        { title: "Which board?", context: "Printed.", options, urgent: "time_boxed" },
        "octo.1",
      );
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      const plug = await view.findByRole("button", { name: "Open D-2" });
      fireEvent.pointerDown(plug, { pointerId: 1, button: 2 });
      fireEvent.keyDown(document.body, { key: "Tab" });
      fireEvent.focus(plug);
      await waitFor(() => expect(selected(view, "Which plug?")).toBe("true"));
    });

    test("what was pressed stays where it was on the page when the item open above it folds", async () => {
      onLine();
      // Urgent, so it is open at the top, and Which plug? is its line's own row below it.
      server.act(
        c.decisionAsk,
        { title: "Which board?", context: "Printed.", options, urgent: "time_boxed" },
        "octo.1",
      );
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      const plug = await view.findByRole("button", { name: "Open D-2" });
      // The test page has no layout: Which plug? sits 160 pixels higher once Which board? folds to a row above it.
      const box = spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement,
      ) {
        const folded = document.querySelector('[aria-label="Open D-1"]') !== null;
        const top = this.getAttribute("data-focus-ref") === "D-2" ? (folded ? 300 : 460) : 0;
        return DOMRect.fromRect({ y: top, height: 40 });
      });
      const scroll = spyOn(window, "scrollBy").mockImplementation(() => {});
      // The browser's focus follows to the item opened, without scrolling it into view as focus otherwise does.
      const focused: unknown[] = [];
      const focus = spyOn(HTMLElement.prototype, "focus").mockImplementation((options) => {
        focused.push(options);
      });
      plug.focus();
      fireEvent.pointerDown(plug, { pointerId: 1, button: 0 });
      fireEvent.focus(plug);
      fireEvent.pointerUp(plug, { pointerId: 1, button: 0 });
      fireEvent.click(plug);
      await waitFor(() => expect(selected(view, "Which plug?")).toBe("true"));
      expect(scroll).toHaveBeenCalledWith(0, -160);
      await waitFor(() => expect(focused.length).toBeGreaterThan(1));
      expect(focused.slice(1)).toEqual(focused.slice(1).map(() => ({ preventScroll: true })));
      box.mockRestore();
      scroll.mockRestore();
      focus.mockRestore();
    });

    test("after a choice takes its item away, the browser's focus follows home's to the next item", async () => {
      onLine();
      server.act(c.decisionAsk, { title: "Which board?", context: "Printed.", options }, "octo.1");
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "j" });
      fireEvent.keyDown(window, { key: "k" });
      const board = await view.findByRole("article", { name: "Which board?" });
      await waitFor(() => expect(document.activeElement?.contains(board)).toBe(true));
      fireEvent.keyDown(document.activeElement ?? window, { key: "1" });
      await answerNow(view);
      const plug = await view.findByRole("article", { name: "Which plug?" });
      await waitFor(() =>
        expect(plug.closest("[data-focus-ref]")?.contains(document.activeElement)).toBe(true),
      );
    });

    test("o opens a line's panel with the browser's focus in it, and Esc brings focus back to the line", async () => {
      onLine();
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("region", { name: "Working on" });
      // Home's focus starts on the proposal below the lines; K walks back to one.
      fireEvent.keyDown(window, { key: "K", shiftKey: true });
      // Whichever line K reached holds the browser's focus.
      await waitFor(() => expect(document.activeElement?.getAttribute("data-focus-ref")).toMatch(/^line:/));
      const line = document.activeElement;
      const ref = line?.getAttribute("data-focus-ref")?.slice("line:".length) ?? "";
      fireEvent.keyDown(document.activeElement ?? window, { key: "o" });
      const aside = await view.findByRole("complementary", { name: ref });
      await waitFor(() => expect(aside.contains(document.activeElement)).toBe(true));
      fireEvent.keyDown(document.activeElement ?? window, { key: "Escape" });
      await gone(() => view.queryByRole("complementary", { name: ref }));
      await waitFor(() => expect(document.activeElement).toBe(line));
    });

    test("from a line itself, j goes to the next thing for you after it, and k to the one before", async () => {
      onLine();
      server.act(c.decisionAsk, { title: "Which board?", context: "Printed.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "J", shiftKey: true });
      await waitFor(() => expect(selected(view, "Weekly digest")).toBe("true"));
      fireEvent.keyDown(window, { key: "j" });
      await waitFor(() => expect(selected(view, "Wall mount")).toBe("true"));
      fireEvent.keyDown(window, { key: "K", shiftKey: true });
      await waitFor(() => expect(selected(view, "Weekly digest")).toBe("true"));
      fireEvent.keyDown(window, { key: "k" });
      await view.findByRole("article", { name: "Which board?" });
      expect(selected(view, "Which board?")).toBe("true");
    });

    test("after Later, focus goes to the line's next item, not after the question put off", async () => {
      onLine();
      server.act(c.decisionAsk, { title: "Which board?", context: "Printed.", options }, "octo.1");
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      fireEvent.keyDown(window, { key: "l" });
      await view.findByRole("article", { name: "Which plug?" });
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.decisionList, { query: "ref:D-1" }, asDeveloper)[0]?.postponedAt,
        ).not.toBeNull(),
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(selected(view, "Which plug?")).toBe("true");
    });

    test("when the focused item goes away, focus moves on without taking the cursor from a box being typed in", async () => {
      server = startTestServer({ live: true });
      server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
      onLine();
      const first = server.act(
        c.decisionAsk,
        { title: "Which board?", context: "Printed.", options },
        "octo.1",
      );
      server.act(c.decisionAsk, { title: "Which plug?", context: "Side.", options }, "octo.1");
      navigate("/?new=1");
      const view = renderApp(<App />);
      await view.findByRole("article", { name: "Which board?" });
      // Focus moved by a key once, as it would be in use.
      fireEvent.keyDown(window, { key: "k" });
      const box = view.getByLabelText("What it is");
      box.focus();
      server.act(c.decisionWithdraw, { ref: first.ref }, "octo.1");
      await view.findByRole("article", { name: "Which plug?" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.activeElement).toBe(box);
    });

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
      // The urgent question arrives as a row, in the warm tone, and focus stays on what was being read.
      const row = await view.findByRole("button", { name: "Open D-2" });
      expect(within(row).getByText("Time-boxed").getAttribute("data-tone")).toBe("stuck");
      expect(selected(view, "Which board?")).toBe("true");
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
      await answerNow(view);
      await view.findByRole("article", { name: "Which plug?" });
      await waitFor(() => expect(selected(view, "Which plug?")).toBe("true"));
      expect(view.queryByRole("article", { name: "Order now?" })).toBeNull();
    });
  });

  describe("drafts", () => {
    function owned() {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    }

    test("a half-written Tell is kept on the server, and is there when the panel opens again", async () => {
      owned();
      navigate("/?ref=L-1");
      const first = renderApp(<App />);
      const panel = within(await first.findByRole("complementary", { name: "L-1" }));
      fireEvent.change(await panel.findByLabelText("Tell octo.1"), {
        target: { value: "Half of a thought" },
      });
      await waitFor(() =>
        expect(server.tracker.call(c.draftGet, { key: "tell:L-1" }, asDeveloper).text).toBe(
          "Half of a thought",
        ),
      );
      first.unmount();
      const again = renderApp(<App />);
      const reopened = within(await again.findByRole("complementary", { name: "L-1" }));
      await waitFor(() =>
        expect(reopened.getByLabelText("Tell octo.1")).toHaveProperty("value", "Half of a thought"),
      );
    });

    test("words waiting to be sent are not sent twice, by button or by Cmd+Enter", async () => {
      owned();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      const box = await panel.findByLabelText("Tell octo.1");
      fireEvent.change(box, { target: { value: "Print it in black" } });
      fireEvent.keyDown(box, { key: "Enter", metaKey: true });
      await view.findByRole("button", { name: "Undo" });
      fireEvent.keyDown(box, { key: "Enter", metaKey: true });
      expect(panel.getByRole("button", { name: "Sending…" }).hasAttribute("disabled")).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(server.calls.filter((name) => name === "choice.make")).toHaveLength(1);
    });

    test("Undo keeps a Tell's words in the box; once it takes effect, the box empties", async () => {
      owned();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      fireEvent.change(await panel.findByLabelText("Tell octo.1"), {
        target: { value: "Print it in black" },
      });
      fireEvent.click(panel.getByRole("button", { name: "Tell" }));
      fireEvent.click(await view.findByRole("button", { name: "Undo" }));
      await gone(() => view.queryByRole("button", { name: "Undo" }));
      expect(panel.getByLabelText("Tell octo.1")).toHaveProperty("value", "Print it in black");
      fireEvent.click(panel.getByRole("button", { name: "Tell" }));
      await answerNow(view);
      await waitFor(() => expect(panel.getByLabelText("Tell octo.1")).toHaveProperty("value", ""));
      expect(server.tracker.call(c.draftGet, { key: "tell:L-1" }, asDeveloper).text).toBeNull();
    });

    test("a Tell sent with Cmd+Enter from a box that keeps focus empties it, so a second Cmd+Enter sends nothing", async () => {
      owned();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      const box = await panel.findByLabelText("Tell octo.1");
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "Print it in black" } });
      fireEvent.keyDown(box, { key: "Enter", metaKey: true });
      await answerNow(view);
      await waitFor(() => expect(box).toHaveProperty("value", ""));
      expect(panel.getByRole("button", { name: "Nudge" })).toBeDefined();
    });

    test("a save that lands while newer words wait for theirs does not put older words back in the box", async () => {
      owned();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      const box = await panel.findByLabelText("Tell octo.1");
      // Draft saves answer slowly here, as over a slow link.
      const fetchNow = globalThis.fetch;
      Object.assign(globalThis, {
        fetch: async (input: string | URL | Request, init?: RequestInit) => {
          if (String(input).includes("draft.save")) await new Promise((resolve) => setTimeout(resolve, 400));
          return fetchNow(input, init);
        },
      });
      try {
        // The waits are inside act: the saves that land during them update the page.
        fireEvent.change(box, { target: { value: "Print it" } });
        await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
        fireEvent.change(box, { target: { value: "Print it in black" } });
        await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
        expect(box).toHaveProperty("value", "Print it in black");
        // The last save is let land here, so it reaches no later test.
        await waitFor(
          () =>
            expect(server.tracker.call(c.draftGet, { key: "tell:L-1" }, asDeveloper).text).toBe(
              "Print it in black",
            ),
          { timeout: 2000 },
        );
      } finally {
        Object.assign(globalThis, { fetch: fetchNow });
      }
    });

    function measuring() {
      owned();
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      return server.act(
        c.taskFile,
        { title: "Measure the board", place: "the bench", outcome: "In mm", fields: ["Length", "Holes"] },
        "octo.1",
      );
    }
    const kept = (ref: string) => server.tracker.call(c.draftGet, { key: `task:${ref}` }, asDeveloper).text;

    test("a task's named outcomes and note are one draft, which closing the task deletes", async () => {
      const task = measuring();
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the board" }));
      fireEvent.change(opened.getByLabelText("Length"), { target: { value: "41" } });
      fireEvent.change(opened.getByLabelText("Note"), {
        target: { value: "Warped" },
      });
      await waitFor(() =>
        expect(JSON.parse(kept(task.ref) ?? "null")).toEqual({ values: { Length: "41" }, note: "Warped" }),
      );
      fireEvent.change(opened.getByLabelText("Holes"), { target: { value: "38" } });
      fireEvent.click(opened.getByRole("button", { name: "Done" }));
      await answerNow(view);
      // Gone from the server: no draft at all.
      await waitFor(() => expect(kept(task.ref) ?? "gone").toBe("gone"));
    });

    test("Undo keeps a task's named outcomes in their boxes", async () => {
      measuring();
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the board" }));
      fireEvent.change(opened.getByLabelText("Length"), { target: { value: "41" } });
      fireEvent.change(opened.getByLabelText("Holes"), { target: { value: "38" } });
      fireEvent.click(opened.getByRole("button", { name: "Done" }));
      fireEvent.click(await view.findByRole("button", { name: "Undo" }));
      await gone(() => view.queryByRole("button", { name: "Undo" }));
      expect(opened.getByLabelText("Length")).toHaveProperty("value", "41");
      expect(opened.getByLabelText("Holes")).toHaveProperty("value", "38");
    });

    test("an outcome typed before the task's draft has loaded joins it, never replacing what was kept", async () => {
      const task = measuring();
      const kept = JSON.stringify({ values: { Length: "41" }, note: "" });
      server.tracker.call(c.draftSave, { key: `task:${task.ref}`, text: kept }, asDeveloper);
      // The draft is held back until the developer has typed, as a slow answer would.
      let release = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const fetchNow = globalThis.fetch;
      Object.assign(globalThis, {
        fetch: async (input: string | URL | Request, init?: RequestInit) => {
          if (String(input).includes("draft.get") && String(init?.body ?? "").includes(`task:${task.ref}`)) {
            await held;
          }
          return fetchNow(input, init);
        },
      });
      try {
        navigate("/");
        const view = renderApp(<App />);
        const opened = within(await view.findByRole("article", { name: "Measure the board" }));
        fireEvent.change(opened.getByLabelText("Holes"), { target: { value: "38" } });
        release();
        await waitFor(() => expect(opened.getByLabelText("Length")).toHaveProperty("value", "41"));
        await waitFor(() =>
          expect(
            JSON.parse(
              server.tracker.call(c.draftGet, { key: `task:${task.ref}` }, asDeveloper)?.text ?? "{}",
            ),
          ).toEqual({ values: { Length: "41", Holes: "38" }, note: "" }),
        );
      } finally {
        Object.assign(globalThis, { fetch: fetchNow });
      }
    });

    test("a draft written as plain words, before named outcomes, is read as the note", async () => {
      const task = measuring();
      server.tracker.call(c.draftSave, { key: `task:${task.ref}`, text: "41 by 38, roughly" }, asDeveloper);
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the board" }));
      await waitFor(() => expect(opened.getByLabelText("Note")).toHaveProperty("value", "41 by 38, roughly"));
      opened.getByText(/0 of 2 filled/);
    });

    test("named outcomes typed on another device reach boxes without focus", async () => {
      server = startTestServer({ live: true });
      server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
      const task = measuring();
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the board" }));
      const text = JSON.stringify({ values: { Length: "41", Holes: "38" }, note: "" });
      server.tracker.call(c.draftSave, { key: `task:${task.ref}`, text }, asDeveloper);
      await waitFor(() => expect(opened.getByLabelText("Holes")).toHaveProperty("value", "38"));
      opened.getByText(/2 of 2 filled/);
    });

    test("words typed on another device appear in a box that does not have focus, and never in one that does", async () => {
      server = startTestServer({ live: true });
      server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
      owned();
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      const box = await panel.findByLabelText("Tell octo.1");
      server.tracker.call(c.draftSave, { key: "tell:L-1", text: "From the phone" }, asDeveloper);
      await waitFor(() => expect(box).toHaveProperty("value", "From the phone"));
      fireEvent.focus(box);
      server.tracker.call(c.draftSave, { key: "tell:L-1", text: "From the phone, again" }, asDeveloper);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(box).toHaveProperty("value", "From the phone");
      fireEvent.blur(box);
      await waitFor(() => expect(box).toHaveProperty("value", "From the phone, again"));
    });
  });

  test("with nothing waiting on the developer, home says so first, calmly", async () => {
    server.tracker.call(
      c.lineAdd,
      { title: "Enclosure", doneWhen: "Done.", repos: ["OCT"], where: "working" },
      asDeveloper,
    );
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    server.act(c.lineTake, { ref: "L-1" }, "octo.1");
    server.act(c.planSet, { line: "L-1", steps: ["Model the opening", "Print"] }, "octo.1");
    navigate("/");
    const view = renderApp(<App />);
    const calm = within(await view.findByRole("region", { name: "Nothing needs you" }));
    calm.getByText("1 agent working");
    calm.getByText(/the next ask likely comes from Enclosure, step 1/);
    // It comes first, before any line.
    const working = view.getByRole("region", { name: "Working on" });
    expect(
      view.getByRole("region", { name: "Nothing needs you" }).compareDocumentPosition(working) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
    fireEvent.click(await view.findByRole("button", { name: "Accept 1 recommendation" }));
    await answerNow(view);
    await within(await view.findByRole("region", { name: "Up next" })).findByText("Wall mount");
  });

  test("the agents roster stops an agent, with Undo, and lifts the stop", async () => {
    server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
    navigate("/agents");
    const view = renderApp(<App />);
    fireEvent.click(await view.findByRole("button", { name: "Stop octo.1" }));
    await answerNow(view);
    fireEvent.click(await view.findByRole("button", { name: "Lift octo.1" }));
    await answerNow(view);
    await view.findByRole("button", { name: "Stop octo.1" });
  });

  test("a Stop on a line's owner can become pausing the line instead", async () => {
    server.tracker.call(
      c.lineAdd,
      { title: "Busy line", doneWhen: "Done.", repos: ["OCT"], where: "working" },
      asDeveloper,
    );
    server.act(c.agentRegister, { repo: "OCT" }, "octo.3");
    server.act(c.lineTake, { ref: "L-1" }, "octo.3");
    navigate("/agents");
    const view = renderApp(<App />);
    fireEvent.click(await view.findByRole("button", { name: "Stop octo.3" }));
    fireEvent.click(await view.findByRole("button", { name: "Pause the line instead" }));
    await view.findByText(wholeMatching(/^Pausing Busy line: up next in \d s$/));
    await answerNow(view);
    await waitFor(() =>
      expect(server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).line.state).toBe("up_next"),
    );
    expect(server.tracker.call(c.agentList, {}, asDeveloper)[0]?.state).not.toBe("stopped");
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
    await answerNow(view);
    await waitFor(() => expect(server.tracker.call(c.agentList, {}, asDeveloper)[0]?.line).toBeNull());
  });

  test("on a phone, lines past the second fold to one row naming what waits first, and open from it", async () => {
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
      third.getByText("Third question");
      fireEvent.click(third.getByRole("button", { name: "Open D-3" }));
      await third.findByRole("article", { name: "Third question" });
    } finally {
      Object.assign(window, { matchMedia: realMatchMedia });
    }
  });

  test("on a phone, questions on no line fold to one row like the other sections; urgent ones never do", async () => {
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
      seedLines();
      const options = [{ key: "a", label: "Yes", description: "Go ahead." }];
      server.act(c.decisionAsk, { title: "An old question", context: "Context.", options }, "octo.9");
      server.act(c.decisionAsk, { title: "Another old one", context: "Context.", options }, "octo.9");
      navigate("/");
      const view = renderApp(<App />);
      const tile = within(await view.findByRole("region", { name: "On no line" }));
      expect(tile.getByRole("button", { name: /^On no line 2/ }).getAttribute("aria-expanded")).toBe("false");
      expect(tile.queryByRole("button", { name: "Open D-1" })).toBeNull();
      fireEvent.click(tile.getByRole("button", { name: /^On no line 2/ }));
      tile.getByRole("button", { name: "Open D-1" });
    } finally {
      Object.assign(window, { matchMedia: realMatchMedia });
    }
  });

  test("on a phone, an empty Up next still says so, and a proposal fold names what it holds", async () => {
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
      seedLines();
      navigate("/");
      const view = renderApp(<App />);
      const upNext = within(await view.findByRole("region", { name: "Up next" }));
      upNext.getByText("Nothing is up next");
      const proposed = within(view.getByRole("region", { name: "Proposed" }));
      proposed.getByRole("button", { name: /^Proposed 1 Wall mount/ });
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

  describe("a task or an issue opened by its ref", () => {
    function withIssue() {
      seedLines();
      server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
      server.act(c.lineTake, { ref: "L-1" }, "octo.1");
      server.tracker.call(c.placeAdd, { name: "the bench" }, asDeveloper);
      server.act(c.planSet, { line: "L-1", steps: ["Settle the board"] }, "octo.1");
      const issue = server.act(
        c.issueCreate,
        { project: "OCT", title: "Fit the board", body: "The **short** board", line: "L-1", step: 1 },
        "octo.1",
      );
      server.act(c.issueClaim, { refs: [issue.ref] }, "octo.1");
      const task = server.act(
        c.taskFile,
        { title: "Measure the grip", place: "the bench", outcome: "Five numbers", frees: issue.ref },
        "octo.1",
      );
      return { issue, task };
    }

    test("a task says what it frees, and Done reports to whoever holds that", async () => {
      const { issue, task } = withIssue();
      navigate(`/?ref=${task.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: task.ref }));
      const section = panel;
      section.getByRole("button", { name: "Sendspin enclosure" });
      const frees = within(section.getByRole("region", { name: "What it frees" }));
      frees.getByRole("button", { name: issue.ref });
      // Who holds the freed issue is not drawn.
      expect(frees.queryByText("held by octo.1")).toBeNull();
      // Its facts are separate pieces: the step it holds up, and who filed it.
      await section.findByText("holds up step 1, Settle the board");
      section.getByText("filed by octo.1");
      section.getByRole("button", { name: "Can't do it" });
      fireEvent.change(section.getByLabelText("Five numbers"), { target: { value: "41, 38, 12" } });
      fireEvent.click(section.getByRole("button", { name: "Done" }));
      await answerNow(view);
      await waitFor(() =>
        expect(
          server.tracker.call(c.issueList, { query: `ref:${task.ref}` }, asDeveloper)[0]?.issue.status,
        ).toBe("done"),
      );
      const heard = server.tracker.execute(c.agentList.name, {}, { actor: "octo.1", channel: "cli" }).notices;
      expect(heard.map((notice) => notice.body).join(" ")).toContain("41, 38, 12");
    });

    test("a question held behind a task opens with what it waits for and its situation, not its options", async () => {
      const { task } = withIssue();
      const asked = server.act(
        c.decisionAsk,
        {
          title: "Which board?",
          context: "The base fits either board.",
          options: [
            { key: "short", label: "The short board", description: "Fits as printed" },
            { key: "long", label: "The long board", description: "Needs a reprint" },
          ],
          recommendation: "short",
          why: "It fits already.",
          waitsFor: task.ref,
        },
        "octo.1",
      );
      navigate(`/?ref=${asked.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: asked.ref }));
      await panel.findByText(whole(`Held until ${task.ref} is done: its outcome may settle this.`));
      panel.getByText("The base fits either board.");
      // It cannot be answered here, so its options are not drawn.
      expect(panel.queryByText("The short board")).toBeNull();
      panel.getByRole("button", { name: "Withdraw" });
    });

    test("an issue's drift shows on it, and answering it waits with Undo", async () => {
      const { issue } = withIssue();
      server.act(c.issueUpdate, { refs: [issue.ref], status: "in_review" }, "octo.1");
      server.tracker.sweep();
      const drift = server.act(c.driftList, { query: "status:open rule:in-review-without-pr" })[0];
      if (drift === undefined) throw new Error("No drift was raised");
      navigate(`/?ref=${issue.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: issue.ref }));
      const out = within(await panel.findByRole("region", { name: "Out of date" }));
      const item = within(out.getByRole("article", { name: drift.ref }));
      fireEvent.change(item.getByLabelText(/Note · required/), {
        target: { value: "The PR is on its way" },
      });
      fireEvent.click(item.getByRole("button", { name: "Nothing to update" }));
      await view.findByRole("button", { name: "Undo" });
      await answerNow(view);
      await waitFor(() =>
        expect(server.act(c.driftList, { query: "status:verified" }).map((item) => item.ref)).toContain(
          drift.ref,
        ),
      );
    });

    test("a task opened on home says what it frees and the step it holds up, as in its panel", async () => {
      const { issue } = withIssue();
      navigate("/");
      const view = renderApp(<App />);
      const opened = within(await view.findByRole("article", { name: "Measure the grip" }));
      await opened.findByText("holds up step 1, Settle the board");
      opened.getByText(whole(`Frees ${issue.ref} Fit the board`));
    });

    test("a Tell about an issue nobody holds names the line's owner, whom it reaches", async () => {
      withIssue();
      const loose = server.act(
        c.issueCreate,
        { project: "OCT", title: "Nobody's yet", line: "L-1" },
        "octo.1",
      );
      navigate(`/?ref=${loose.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: loose.ref }));
      await panel.findByLabelText("Tell octo.1, who owns L-1");
    });

    test("a closed task says how it closed and what was sent, and offers nothing to send again", async () => {
      const { task } = withIssue();
      server.tracker.call(c.taskDone, { ref: task.ref, result: "41, 38 and 12 mm" }, asDeveloper);
      navigate(`/?ref=${task.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: task.ref }));
      const closed = within(await panel.findByRole("article", { name: task.title }));
      closed.getByText("Done");
      closed.getByText("41, 38 and 12 mm");
      expect(panel.queryByRole("button", { name: "Done" })).toBeNull();
      expect(panel.queryByRole("button", { name: "Can't do it" })).toBeNull();
    });

    test("a task that could not be done says why", async () => {
      const { task } = withIssue();
      server.tracker.call(c.taskCant, { ref: task.ref, why: "The calipers are lost" }, asDeveloper);
      navigate(`/?ref=${task.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: task.ref }));
      const closed = within(await panel.findByRole("article", { name: task.title }));
      closed.getByText("Could not be done: The calipers are lost");
    });

    test("an issue shows its line and step, who holds it, its pull requests' checks, and Tell reaches its holder", async () => {
      const { issue, task } = withIssue();
      server.act(
        c.prUpsert,
        {
          repo: "a/b",
          number: 7,
          title: "Shorter board",
          state: "open",
          checks: "failing",
          issues: [issue.ref],
        },
        "octo.1",
      );
      navigate(`/?ref=${issue.ref}`);
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: issue.ref }));
      const section = panel;
      // The crumb: its line by ref and title, then a forward chevron and its own ref.
      await within(section.getByRole("navigation", { name: "Where this is" })).findByRole("button", {
        name: "Sendspin enclosure",
      });
      section.getByRole("heading", { name: "Fit the board" });
      section.getByText("held by octo.1");
      expect(section.getAllByRole("button", { name: task.ref }).length).toBeGreaterThan(0);
      await section.findByText(/Shorter board/);
      expect(iconsIn(section.getByText("checks failing"))).toEqual(["cross"]);

      fireEvent.change(section.getByLabelText(`Tell octo.1, who holds ${issue.ref}`), {
        target: { value: "Try the 40 mm one" },
      });
      fireEvent.click(section.getByRole("button", { name: "Tell" }));
      await answerNow(view);
      await waitFor(() => {
        const heard = server.tracker.execute(
          c.agentList.name,
          {},
          { actor: "octo.1", channel: "cli" },
        ).notices;
        expect(heard.map((notice) => notice.body).join(" ")).toContain("Try the 40 mm one");
      });
    });
  });

  test("an issue on a line not being worked on still says which line it is on", async () => {
    seedLines();
    const issue = server.tracker.call(
      c.issueCreate,
      { project: "OCT", title: "Pick the screws", line: "L-3" },
      asDeveloper,
    );
    navigate(`/?ref=${issue.ref}`);
    const view = renderApp(<App />);
    const panel = within(await view.findByRole("complementary", { name: issue.ref }));
    await within(panel.getByRole("navigation", { name: "Where this is" })).findByRole("button", {
      name: "Wall mount",
    });
  });

  test("a line that could not be marked seen says so in its panel", async () => {
    seedLines();
    const fetchNow = globalThis.fetch;
    Object.assign(globalThis, {
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).endsWith("/api/ops/seen")) throw new TypeError("Failed to fetch");
        return fetchNow(input, init);
      },
    });
    try {
      navigate("/?ref=L-1");
      const view = renderApp(<App />);
      const panel = within(await view.findByRole("complementary", { name: "L-1" }));
      await panel.findByText("Could not mark L-1 seen. The tracker did not answer.");
    } finally {
      Object.assign(globalThis, { fetch: fetchNow });
    }
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

describe("appearance", () => {
  test("a theme and a mode picked apply to the whole page and are kept on this device", async () => {
    localStorage.removeItem("octotrack.appearance");
    navigate("/");
    const view = renderApp(<App />);
    fireEvent.click(await view.findByRole("button", { name: "Appearance: Paper, as the system" }));
    fireEvent.click(view.getByRole("menuitemradio", { name: "Nord" }));
    fireEvent.click(view.getByRole("button", { name: "Appearance: Nord, as the system" }));
    fireEvent.click(view.getByRole("menuitemradio", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement.getAttribute("data-palette")).toBe("nord"));
    expect(document.documentElement.getAttribute("data-mode")).toBe("dark");
    expect(JSON.parse(localStorage.getItem("octotrack.appearance") ?? "null")).toEqual({
      palette: "nord",
      mode: "dark",
    });
    localStorage.removeItem("octotrack.appearance");
  });
});

describe("buzzing this device", () => {
  const asDeveloper = { actor: "dev", channel: "dashboard" } as const;
  const existing = { endpoint: "https://push.example/phone", keys: { p256dh: "BKey", auth: "secret" } };

  test("is on only when this browser holds a subscription, which the server is told about", async () => {
    server = startTestServer({ pushKey: "BPublic" });
    const push = fakePush({ permission: "granted", subscribed: existing });
    try {
      navigate("/agents");
      const view = renderApp(<App />);
      await view.findByText(/Buzzing this device/);
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
      navigate("/agents");
      const view = renderApp(<App />);
      fireEvent.click(await view.findByRole("button", { name: "Buzz this device" }));
      await view.findByText(/Buzzing this device/);
      expect(server.tracker.call(c.pushSubscriptions, {}, { ...asDeveloper, system: true })).toEqual([
        { endpoint: "https://push.example/new", keys: { p256dh: "BNew", auth: "fresh" } },
      ]);
    } finally {
      push.restore();
    }
  });
});
