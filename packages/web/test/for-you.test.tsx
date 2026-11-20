import { beforeEach, describe, expect, test } from "bun:test";
import type { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, type RenderResult, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.tsx";
import { navigate } from "../src/lib/router.ts";
import { contracts as c, renderApp, startTestServer, type TestServer } from "./harness.tsx";

let server: TestServer;
const asDeveloper = { actor: "dev", channel: "dashboard" } as const;
const options = [
  { key: "a", label: "Yes", description: "Go ahead." },
  { key: "b", label: "No", description: "Leave it." },
];

/** Lets the newest choice's Undo time run out at once, then refreshes the page as the change notice would. */
async function answerNow(view: { client: QueryClient }) {
  const waiting = () =>
    server.tracker.call(c.choiceList, {}, asDeveloper).filter((choice) => choice.state === "pending");
  await waitFor(() => expect(waiting().length).toBeGreaterThan(0));
  const newest = waiting().at(-1);
  if (newest === undefined) throw new Error("No choice is waiting");
  server.tracker.call(c.choiceNow, { id: newest.id }, asDeveloper);
  await act(() => view.client.invalidateQueries());
}

/** Two working lines, an agent on each, as agents would leave questions and tasks on them. */
function twoLines() {
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
    { title: "Weekly digest", doneWhen: "Sent on Mondays.", repos: ["DIG"], where: "working" },
    asDeveloper,
  );
  server.act(c.agentRegister, { repo: "OCT" }, "octo.1");
  server.act(c.lineTake, { ref: "L-1" }, "octo.1");
  server.act(c.agentRegister, { repo: "DIG" }, "digest.1");
  server.act(c.lineTake, { ref: "L-2" }, "digest.1");
}

const ask = (title: string, agent: string) =>
  server.act(
    c.decisionAsk,
    { title, context: "Context.", options, recommendation: "a", why: "It is quicker." },
    agent,
  );

/**
 * Waits for an element to go away. Not expect(...).toBeNull() inside waitFor: when that fails, formatting a whole DOM
 * node into the message takes so long that it starves the event loop and the wait times out for the wrong reason.
 */
async function gone(query: () => Element | null): Promise<void> {
  await waitFor(() => {
    if (query() !== null) throw new Error("Still on screen");
  });
}

/** The card open in the middle of the page. */
const card = (view: Pick<RenderResult, "getByRole">) => view.getByRole("region", { name: "Open now" });

/** Waits for the card to hold this item: looked up afresh each time, since each item opens on a card of its own. */
const opened = (view: Pick<RenderResult, "getByRole">, name: string) =>
  waitFor(() => within(card(view)).getByRole("heading", { name }));

/** The rail's views, by name. */
const rail = (view: Pick<RenderResult, "getByRole">) =>
  within(view.getByRole("navigation", { name: "Waiting on you" }));

beforeEach(() => {
  server = startTestServer();
  server.act(c.projectCreate, { key: "OCT", name: "Octotrack" });
  server.act(c.projectCreate, { key: "DIG", name: "Digest" });
  navigate("/");
});

describe("For you", () => {
  test("opening Octotrack shows For you: the rail with its counts, one item open, and what comes next", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    server.act(c.taskFile, { title: "Weigh it", outcome: "Grams" }, "octo.1");
    const view = renderApp(<App />);
    const open = within(await waitFor(() => card(view)));
    await open.findByRole("heading", { name: "Which board?" });
    open.getByText("All · 1 of 3");
    rail(view).getByRole("link", { name: "All, 3" });
    rail(view).getByRole("link", { name: "To answer, 2" });
    rail(view).getByRole("link", { name: "To do, 1" });
    expect(rail(view).getByRole("link", { name: "All, 3" }).getAttribute("aria-current")).toBe("page");
    // Only the open one is drawn in full; the next two wait beside it.
    expect(view.queryByRole("heading", { name: "Which day?" })).toBeNull();
    const next = within(view.getByRole("complementary", { name: "Next" }));
    next.getByRole("link", { name: /Which day\?/ });
    next.getByRole("link", { name: /Weigh it/ });
    // It names its line, which opens in place.
    open.getByRole("link", { name: "Sendspin enclosure" });
  });

  test("the bar has Lines, For you with its total, New line and More, which holds the Log and Agents", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    const view = renderApp(<App />);
    const bar = within(await view.findByRole("banner"));
    await bar.findByRole("link", { name: "For you, 1 waiting" });
    expect(bar.getByRole("link", { name: "For you, 1 waiting" }).getAttribute("aria-current")).toBe("page");
    bar.getByRole("link", { name: "Lines" });
    bar.getByRole("button", { name: "New line" });
    expect(bar.queryByRole("link", { name: "Log" })).toBeNull();
    fireEvent.click(bar.getByRole("button", { name: "More" }));
    const menu = within(view.getByRole("menu"));
    menu.getByRole("menuitem", { name: /^Log/ });
    menu.getByRole("menuitem", { name: /^Agents/ });
    menu.getByRole("menuitem", { name: /^Keyboard shortcuts/ });
    fireEvent.click(menu.getByRole("menuitem", { name: /^Log/ }));
    await waitFor(() => expect(window.location.pathname).toBe("/log"));
  });

  test("a view on the rail holds only what it counts, at its own address", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    server.act(c.taskFile, { title: "Weigh it", outcome: "Grams" }, "octo.1");
    const view = renderApp(<App />);
    fireEvent.click(await waitFor(() => rail(view).getByRole("link", { name: "To do, 1" })));
    await waitFor(() => expect(window.location.pathname).toBe("/for-you/to-do"));
    await opened(view, "Weigh it");
    within(card(view)).getByText("To do · 1 of 1");
    expect(rail(view).getByRole("link", { name: "To do, 1" }).getAttribute("aria-current")).toBe("page");
  });

  test("j and k move through the view, and the address keeps the one open", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.keyDown(window, { key: "j" });
    await opened(view, "Which day?");
    expect(new URLSearchParams(window.location.search).get("item")).toBe("D-2");
    within(card(view)).getByText("All · 2 of 2");
    fireEvent.keyDown(window, { key: "k" });
    await opened(view, "Which board?");
  });

  test("Later sends a question to the bottom of the whole list, and the one after it opens", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    navigate("/for-you/to-answer");
    const view = renderApp(<App />);
    const open = within(await waitFor(() => card(view)));
    await open.findByRole("heading", { name: "Which board?" });
    fireEvent.click(open.getByRole("button", { name: "Later" }));
    await opened(view, "Which day?");
    // Once its Undo has run out, it is last.
    await answerNow(view);
    await within(card(view)).findByText("To answer · 1 of 2");
    // Put off, it still waits on you, last.
    within(view.getByRole("complementary", { name: "Next" })).getByRole("link", { name: /Which board\?/ });
  });

  test("an answer takes its question away and the next one opens where it was", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.keyDown(window, { key: "1" });
    await answerNow(view);
    await opened(view, "Which day?");
    within(card(view)).getByText("All · 1 of 1");
  });

  test("an item from the Next column opens in the middle", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    const view = renderApp(<App />);
    const next = within(await waitFor(() => view.getByRole("complementary", { name: "Next" })));
    fireEvent.click(await next.findByRole("link", { name: /Which day\?/ }));
    await opened(view, "Which day?");
  });

  test("a notification's item opens, whichever view it is in", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    navigate("/?focus=D-2");
    const view = renderApp(<App />);
    await opened(view, "Which day?");
  });

  test("a task, a proposal and a Step in each open with their own moves", async () => {
    server.tracker.call(
      c.lineAdd,
      { title: "South Tyrol trip", doneWhen: "Hotel booked.", repos: ["OCT"], where: "working" },
      asDeveloper,
    );
    server.act(
      c.linePropose,
      {
        title: "Wall mount",
        doneWhen: "It hangs flush.",
        recommendation: "up_next",
        why: "The base is final.",
      },
      "panel-agent",
    );
    // A minute on, no agent has taken it: the developer is asked to step in.
    server.later(1);
    navigate("/for-you/to-step-in");
    const view = renderApp(<App />);
    await waitFor(() => within(card(view)).getByRole("group", { name: "Step in on South Tyrol trip" }));
    within(card(view)).getByRole("button", { name: /I'll own it/ });
    fireEvent.click(rail(view).getByRole("link", { name: "To accept, 1" }));
    await opened(view, "Wall mount");
    within(card(view)).getByRole("button", { name: "Up next, recommended" });
  });

  test("with nothing waiting, it says so, who is at work, and leads to Lines", async () => {
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Nothing waits on you" });
    view.getByRole("link", { name: "Go to Lines" });
    expect(rail(view).getByRole("link", { name: "All, 0" }).getAttribute("aria-current")).toBe("page");
  });

  test("a view with nothing in it says so and offers the next view that holds something", async () => {
    twoLines();
    server.act(c.taskFile, { title: "Weigh it", outcome: "Grams" }, "octo.1");
    navigate("/for-you/to-answer");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Nothing to answer" });
    fireEvent.click(view.getByRole("link", { name: "To do, 1 waiting" }));
    await opened(view, "Weigh it");
  });

  test("the line on the card peeks in place, and a peek opened from it stacks with its way back named", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which case?", "octo.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    const line = within(card(view)).getByRole("link", { name: "Sendspin enclosure" });
    expect(line.getAttribute("href")).toBe("/lines/L-1");
    fireEvent.click(line);
    const peek = within(await view.findByRole("complementary", { name: "L-1" }));
    await peek.findByRole("heading", { name: "Sendspin enclosure", level: 1 });
    // The card stays, open on the same question, its line marked as the one peeked at.
    await opened(view, "Which board?");
    expect(
      within(card(view)).getByRole("link", { name: "Sendspin enclosure" }).getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.click(await peek.findByRole("button", { name: "D-2" }));
    const stacked = await view.findByRole("complementary", { name: "D-2" });
    expect(stacked.getAttribute("data-stacked")).toBe("true");
    fireEvent.click(await within(stacked).findByRole("button", { name: "Back to Sendspin enclosure" }));
    await view.findByRole("complementary", { name: "L-1" });
    fireEvent.keyDown(window, { key: "Escape" });
    await gone(() => view.queryByRole("complementary", { name: "L-1" }));
  });

  test("an address under For you that is no view leads nowhere", async () => {
    navigate("/for-you/everything");
    const view = renderApp(<App />);
    await view.findByText(/Nothing lives at/);
  });

  test("Lines lives at its own address", async () => {
    twoLines();
    navigate("/lines");
    const view = renderApp(<App />);
    await view.findByRole("region", { name: "Working on" });
    expect(
      within(view.getByRole("banner")).getByRole("link", { name: "Lines" }).getAttribute("aria-current"),
    ).toBe("page");
  });
});
