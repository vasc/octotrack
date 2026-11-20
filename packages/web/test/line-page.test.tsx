import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.tsx";
import { navigate } from "../src/lib/router.ts";
import { contracts as c, renderApp, startTestServer, type TestServer } from "./harness.tsx";

let server: TestServer;
const asDeveloper = { actor: "dev", channel: "dashboard" } as const;
const options = [{ key: "a", label: "Yes", description: "Go ahead." }];

/** A working line with an agent on it, a plan of three steps, a question and a task for the developer. */
function seedLine() {
  server.act(c.projectCreate, { key: "MEALS", name: "Meals" });
  server.tracker.call(
    c.lineAdd,
    {
      title: "One plan, one meal",
      doneWhen: "The plan scrolls as one list.",
      repos: ["MEALS"],
      where: "working",
    },
    asDeveloper,
  );
  server.act(c.agentRegister, { repo: "MEALS" }, "meals.1");
  server.act(c.lineTake, { ref: "L-1" }, "meals.1");
  server.act(c.planSet, { line: "L-1", steps: ["Mock it up", "Restructure the plan", "Polish"] }, "meals.1");
  server.act(c.decisionAsk, { title: "Which layout?", context: "Two mockups.", options }, "meals.1");
  server.act(c.taskFile, { title: "Try the mockup on the phone", outcome: "Does it read?" }, "meals.1");
}

beforeEach(() => {
  server = startTestServer();
});

describe("a line's own page", () => {
  test("shows the line whole: where it sits, its title and done when, its plan, and beside it what is for you", async () => {
    seedLine();
    navigate("/lines/L-1");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "One plan, one meal", level: 1 });
    const crumbs = within(view.getByRole("navigation", { name: "Breadcrumb" }));
    expect(crumbs.getByRole("link", { name: "Lines" }).getAttribute("href")).toBe("/lines");
    crumbs.getByText("Working on, 1");
    view.getByText("The plan scrolls as one list.");
    const plan = within(await view.findByRole("region", { name: "Plan" }));
    await plan.findByText("Restructure the plan");
    const forYou = within(view.getByRole("region", { name: "For you here" }));
    const question = forYou.getByRole("link", { name: /Which layout\?/ });
    expect(question.getAttribute("href")).toBe("/?item=D-1");
    forYou.getByRole("link", { name: /Try the mockup on the phone/ });
    expect(
      within(view.getByRole("navigation", { name: "Main" }))
        .getByRole("link", { name: "Lines" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  test("an item for you opens on For you, at that item", async () => {
    seedLine();
    navigate("/lines/L-1");
    const view = renderApp(<App />);
    const forYou = within(await view.findByRole("region", { name: "For you here" }));
    fireEvent.click(await forYou.findByRole("link", { name: /Try the mockup on the phone/ }));
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    await waitFor(() =>
      within(view.getByRole("region", { name: "Open now" })).getByRole("heading", {
        name: "Try the mockup on the phone",
      }),
    );
  });

  test("a line's peek leads to its own page, and the peek closes on the way", async () => {
    seedLine();
    navigate("/?ref=L-1");
    const view = renderApp(<App />);
    const peek = within(await view.findByRole("complementary", { name: "L-1" }));
    fireEvent.click(await peek.findByRole("link", { name: "Open the full page" }));
    await waitFor(() => expect(window.location.pathname).toBe("/lines/L-1"));
    expect(window.location.search).toBe("");
    await view.findByRole("heading", { name: "One plan, one meal", level: 1 });
  });

  test("a ref that is no line leads nowhere", async () => {
    navigate("/lines/L-404");
    const view = renderApp(<App />);
    await view.findByRole("heading", { name: "No line L-404" });
    await view.findByRole("link", { name: "Lines" });
  });
});
