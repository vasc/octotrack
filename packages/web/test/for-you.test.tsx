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
      title: "Speaker enclosure",
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

/** The items a view lists, top to bottom, the open one among them: each by its title. */
const listed = (view: Pick<RenderResult, "getByRole">, name: string) =>
  within(view.getByRole("region", { name }))
    .getAllByRole("article")
    .map((item) => item.getAttribute("aria-label"));

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
  test("opening Octotrack shows For you: the rail with its counts, and every item listed, the first open in place", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    server.act(c.taskFile, { title: "Weigh it", outcome: "Grams" }, "octo.1");
    const view = renderApp(<App />);
    const open = within(await waitFor(() => card(view)));
    await open.findByRole("heading", { name: "Which board?" });
    view.getByRole("heading", { name: "All", level: 1 });
    view.getByText("1 of 3 open");
    rail(view).getByRole("link", { name: "All, 3" });
    rail(view).getByRole("link", { name: "To answer, 2" });
    rail(view).getByRole("link", { name: "To do, 1" });
    expect(rail(view).getByRole("link", { name: "All, 3" }).getAttribute("aria-current")).toBe("page");
    // Every one is listed, in the order of lines; only the open one is drawn in full.
    expect(listed(view, "All")).toEqual(["Which board?", "Weigh it", "Which day?"]);
    expect(view.queryByRole("heading", { name: "Which day?" })).toBeNull();
    // It names its line, which opens in place.
    open.getByRole("link", { name: "Speaker enclosure" });
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
    view.getByText("1 of 1 open");
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
    // The browser's focus goes with it, so Tab starts in it and a screen reader follows.
    await waitFor(() => expect(document.activeElement).toBe(card(view)));
    view.getByText("2 of 2 open");
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
    await view.findByText("1 of 2 open");
    // Put off, it still waits on you, last.
    expect(listed(view, "To answer")).toEqual(["Which day?", "Which board?"]);
  });

  test("Later on the last item still waiting keeps it open, and Undo of a Later brings it back where it was", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.click(within(card(view)).getByRole("button", { name: "Later" }));
    // Nothing else waits, so it stays open, its Later waiting with Undo.
    fireEvent.click(await view.findByRole("button", { name: "Undo" }));
    await gone(() => view.queryByRole("button", { name: "Undo" }));
    await opened(view, "Which board?");
    expect(server.tracker.call(c.decisionList, {}, asDeveloper)[0]?.postponedAt).toBeNull();
  });

  test("Undo of an answer brings the question back open, where it was", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.keyDown(window, { key: "1" });
    // Answered, it waits with Undo, and the next one opens meanwhile.
    await opened(view, "Which day?");
    fireEvent.click(await view.findByRole("button", { name: "Undo" }));
    await opened(view, "Which board?");
    expect(new URLSearchParams(window.location.search).get("item")).toBe("D-1");
  });

  test("Undo reopens the item it undoes, though another was answered after it", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    ask("Which case?", "octo.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.keyDown(window, { key: "1" });
    await opened(view, "Which case?");
    fireEvent.keyDown(window, { key: "1" });
    await opened(view, "Which day?");
    // Both wait with Undo, the newest first; undoing the older one reopens it, not the one answered after it.
    const undos = await view.findAllByRole("button", { name: "Undo" });
    expect(undos).toHaveLength(2);
    const older = undos[1];
    if (older === undefined) throw new Error("No Undo for the first answer");
    fireEvent.click(older);
    await opened(view, "Which board?");
    expect(
      server.tracker
        .call(c.choiceList, {}, asDeveloper)
        .filter((choice) => choice.state === "pending")
        .map((choice) => choice.ref),
    ).toEqual(["D-3"]);
  });

  test("a Step in's checkout, set from the card, moves on like any choice", async () => {
    const asServer = { actor: "octotrack", channel: "cli", system: true } as const;
    server.tracker.call(c.runnerReport, { configured: true, cap: 1, dryRun: false }, asServer);
    server.tracker.call(
      c.lineAdd,
      { title: "No clone", doneWhen: "Done.", repos: ["OCT"], where: "working" },
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
    server.later(1);
    for (const _ of [1, 2]) {
      const started = server.tracker.call(c.runnerStart, { line: "L-1", repo: "OCT" }, asServer);
      server.tracker.call(
        c.runnerExited,
        { name: started.name, code: 1, output: "OCT has no checkout", cause: "checkout" },
        asServer,
      );
      server.tracker.call(c.runnerRetry, { line: "L-1" }, asDeveloper);
    }
    const view = renderApp(<App />);
    const note = within(await view.findByRole("group", { name: "Step in on No clone" }));
    fireEvent.click(note.getByRole("button", { name: "Set its checkout" }));
    fireEvent.change(note.getByLabelText("Checkout of OCT"), { target: { value: "/code/octotrack" } });
    fireEvent.click(note.getByRole("button", { name: "Set" }));
    await opened(view, "Wall mount");
  });

  test("a proposal back from tabled starts through its Start sheet, and the list moves on", async () => {
    server.tracker.call(
      c.lineAdd,
      {
        title: "Media cleanup",
        doneWhen: "Old episodes gone.",
        repos: ["OCT"],
        where: "tabled",
        reason: "The disk is not tight",
        lookAgainAt: new Date().toISOString().slice(0, 10),
      },
      asDeveloper,
    );
    // Its day to look again has come: the tracker's sweep puts it back under Proposed.
    server.tracker.sweep();
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
    navigate("/for-you/to-accept");
    const view = renderApp(<App />);
    await opened(view, "Media cleanup");
    fireEvent.click(within(card(view)).getByRole("button", { name: "Start it now" }));
    const sheet = within(await view.findByRole("dialog", { name: "Start Media cleanup" }));
    fireEvent.click(await sheet.findByRole("button", { name: "Start" }));
    await opened(view, "Wall mount");
  });

  test("More says how much is unseen in the Log and how many agents are working", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.click(view.getByRole("button", { name: "More" }));
    const menu = within(view.getByRole("menu", { name: "More" }));
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: /^Agents/ }).textContent).toBe("Agents2 working"),
    );
    await waitFor(() =>
      expect(menu.getByRole("menuitem", { name: /^Log/ }).textContent).toMatch(/^Log\d+ unseen$/),
    );
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
    view.getByText("1 of 1 open");
  });

  test("an item in the list opens in place, and the one open before closes to its row", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    ask("Which day?", "digest.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.click(
      within(view.getByRole("region", { name: "All" })).getByRole("button", { name: "Which day?" }),
    );
    await opened(view, "Which day?");
    expect(view.queryByRole("heading", { name: "Which board?" })).toBeNull();
    expect(listed(view, "All")).toEqual(["Which board?", "Which day?"]);
  });

  test("a proposal's row carries its agent's recommended move, so many are placed without opening each", async () => {
    for (const title of ["Wall mount", "Garden feed"]) {
      server.act(
        c.linePropose,
        { title, doneWhen: "It works.", recommendation: "up_next", why: "It is next." },
        "panel-agent",
      );
    }
    navigate("/for-you/to-accept");
    const view = renderApp(<App />);
    await opened(view, "Wall mount");
    fireEvent.click(view.getByRole("button", { name: "Up next Garden feed" }));
    await view.findByText(/^Moving Garden feed to up next/);
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
      { title: "Team offsite", doneWhen: "Hotel booked.", repos: ["OCT"], where: "working" },
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
    await waitFor(() => within(card(view)).getByRole("group", { name: "Step in on Team offsite" }));
    within(card(view)).getByRole("button", { name: /I'll own it/ });
    fireEvent.click(rail(view).getByRole("link", { name: "To accept, 1" }));
    await opened(view, "Wall mount");
    within(card(view)).getByRole("button", { name: "Up next, recommended" });
  });

  test("cleared, it names who is working on what, and what you cleared today, with the way to see it", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.keyDown(window, { key: "1" });
    await answerNow(view);
    await view.findByRole("heading", { name: "Nothing waits on you" });
    await view.findByText(/2 agents are working: octo\.1 on Speaker enclosure, digest\.1 on Weekly digest\./);
    await view.findByText("You cleared today: 1 question answered.");
    expect(view.getByRole("link", { name: "See them" }).getAttribute("href")).toMatch(/^\/log\?q=/);
  });

  test("with nothing waiting, it says so, who is at work, and leads to Lines", async () => {
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "Nothing waits on you" });
    view.getByRole("link", { name: "Go to Lines" });
    expect(rail(view).getByRole("link", { name: "All, 0" }).getAttribute("aria-current")).toBe("page");
  });

  test("a view emptied by the last answer hands on to the next view that holds something", async () => {
    twoLines();
    ask("Which board?", "octo.1");
    server.act(c.taskFile, { title: "Weigh it", outcome: "Grams" }, "octo.1");
    navigate("/for-you/to-answer");
    const view = renderApp(<App />);
    await opened(view, "Which board?");
    fireEvent.keyDown(window, { key: "1" });
    await answerNow(view);
    await waitFor(() => expect(window.location.pathname).toBe("/for-you/to-do"));
    await opened(view, "Weigh it");
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
    const line = within(card(view)).getByRole("link", { name: "Speaker enclosure" });
    expect(line.getAttribute("href")).toBe("/lines/L-1");
    fireEvent.click(line);
    const peek = within(await view.findByRole("complementary", { name: "L-1" }));
    await peek.findByRole("heading", { name: "Speaker enclosure", level: 1 });
    // What else waits on the line is listed, not the one already open on the card.
    const also = within(await peek.findByRole("region", { name: "Also for you here" }));
    also.getByRole("button", { name: "Open D-2" });
    expect(also.queryByRole("button", { name: "Open D-1" })).toBeNull();
    // The page folds its rail away, so the list and the peek are both whole.
    expect(card(view).closest("[data-folded]")?.getAttribute("data-folded")).toBe("true");
    // The card stays, open on the same question, its line marked as the one peeked at.
    await opened(view, "Which board?");
    expect(
      within(card(view)).getByRole("link", { name: "Speaker enclosure" }).getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.click(await peek.findByRole("button", { name: "D-2" }));
    const stacked = await view.findByRole("complementary", { name: "D-2" });
    expect(stacked.getAttribute("data-stacked")).toBe("true");
    fireEvent.click(await within(stacked).findByRole("button", { name: "Back to Speaker enclosure" }));
    await view.findByRole("complementary", { name: "L-1" });
    fireEvent.keyDown(window, { key: "Escape" });
    await gone(() => view.queryByRole("complementary", { name: "L-1" }));
  });

  test("an urgent question's card names its line once", async () => {
    twoLines();
    server.act(
      c.decisionAsk,
      {
        title: "Order now?",
        context: "Stock.",
        options,
        recommendation: "a",
        why: "It sells out.",
        urgent: "costs_money",
      },
      "octo.1",
    );
    const view = renderApp(<App />);
    await opened(view, "Order now?");
    expect(within(card(view)).getAllByText(/Speaker enclosure/)).toHaveLength(1);
  });

  test("an address under For you that is no view leads nowhere, and Go to Lines goes to Lines", async () => {
    navigate("/for-you/everything");
    const view = renderApp(<App />);
    await view.findByText(/Nothing lives at/);
    view.getByText(/For you and Lines, with the Log and Agents in More/);
    fireEvent.click(view.getByRole("button", { name: "Go to Lines" }));
    await waitFor(() => expect(window.location.pathname).toBe("/lines"));
  });

  test("Lines lives at its own address", async () => {
    twoLines();
    navigate("/lines");
    const view = renderApp(<App />);
    await view.findByRole("region", { name: "Working on" });
    expect(
      within(view.getByRole("navigation", { name: "Main" }))
        .getByRole("link", { name: "Lines" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
