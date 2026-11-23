import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.tsx";
import { navigate } from "../src/lib/router.ts";
import { contracts as c, renderApp, startTestServer, type TestServer, whole } from "./harness.tsx";

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

describe("a line's plan, as drawn on triage/T-Line", () => {
  test("done when heads the plan, each step's mark is its status menu, and the step now is the one marked", async () => {
    seedLine();
    server.tracker.call(c.planStep, { line: "L-1", step: "1", status: "done" }, asDeveloper);
    navigate("/lines/L-1");
    const view = renderApp(<App />);
    const region = await view.findByRole("region", { name: "Plan" });
    const plan = within(region);
    await plan.findByText("Restructure the plan");
    // Done when is said once, beside the plan's title, not as a label of its own over the plan.
    plan.getByText(whole("Done when: The plan scrolls as one list."));
    expect(view.queryByText("Done when")).toBeNull();
    // The step's status is its round mark: no words such as "To do" at the end of every row.
    const mark = plan.getByRole("button", { name: "Step 2, Restructure the plan: to do" });
    expect(mark.textContent).toBe("");
    expect(plan.queryByText("To do")).toBeNull();
    expect(
      plan.getByRole("article", { name: "Step 2, Restructure the plan" }).getAttribute("aria-current"),
    ).toBe("step");
    expect(plan.getByRole("article", { name: "Step 1, Mock it up" }).getAttribute("aria-current")).toBeNull();
    // The steps sit on the plan's own sheet, with no box of their own inside it.
    expect(region.querySelector(".ui-list:not([data-bare])")).toBeNull();

    fireEvent.click(mark);
    fireEvent.click(plan.getByRole("menuitemradio", { name: "Done" }));
    await waitFor(() =>
      expect(
        server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).steps.map((step) => step.status),
      ).toEqual(["done", "done", "todo"]),
    );
  });

  test("Edit the plan changes its steps, one per line, and a step whose words stay keeps its status", async () => {
    seedLine();
    server.tracker.call(c.planStep, { line: "L-1", step: "1", status: "done" }, asDeveloper);
    navigate("/lines/L-1");
    const view = renderApp(<App />);
    const plan = within(await view.findByRole("region", { name: "Plan" }));
    fireEvent.click(await plan.findByRole("button", { name: "Edit the plan" }));
    const sheet = within(await view.findByRole("dialog", { name: "Edit the plan" }));
    const box = sheet.getByLabelText("Its steps, one per line");
    expect(box instanceof HTMLTextAreaElement ? box.value : null).toBe(
      "Mock it up\nRestructure the plan\nPolish",
    );
    fireEvent.change(box, {
      target: { value: "Mock it up\nRestructure the plan\nTry it on the phone\nPolish" },
    });
    fireEvent.click(sheet.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        server.tracker
          .call(c.lineShow, { ref: "L-1" }, asDeveloper)
          .steps.map((step) => `${step.title}: ${step.status}`),
      ).toEqual([
        "Mock it up: done",
        "Restructure the plan: todo",
        "Try it on the phone: todo",
        "Polish: todo",
      ]),
    );
    await plan.findByText("Try it on the phone");
  });

  test("Edit the plan is refused, and says so, when an agent rewrote the plan while it was open; Save waits for a step", async () => {
    seedLine();
    navigate("/lines/L-1");
    const view = renderApp(<App />);
    const plan = within(await view.findByRole("region", { name: "Plan" }));
    fireEvent.click(await plan.findByRole("button", { name: "Edit the plan" }));
    const sheet = within(await view.findByRole("dialog", { name: "Edit the plan" }));
    const box = sheet.getByLabelText("Its steps, one per line");
    fireEvent.change(box, { target: { value: "  \n" } });
    expect(sheet.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
    // The agent rewrites the plan meanwhile.
    server.act(c.planSet, { line: "L-1", steps: ["Mock it up", "Ship it"] }, "meals.1");
    fireEvent.change(box, { target: { value: "Mock it up\nPolish" } });
    fireEvent.click(sheet.getByRole("button", { name: "Save" }));
    await plan.findByText(/Plan not changed: L-1's plan changed while it was being rewritten/);
    expect(
      server.tracker.call(c.lineShow, { ref: "L-1" }, asDeveloper).steps.map((step) => step.title),
    ).toEqual(["Mock it up", "Ship it"]);
  });

  test("a branch hangs from its step on an elbow, still a group of its own with its More", async () => {
    seedLine();
    server.tracker.call(
      c.planBranch,
      { line: "L-1", from: "2", holdsUp: "3", title: "Try it on the phone", steps: ["Mock it on the phone"] },
      asDeveloper,
    );
    navigate("/lines/L-1");
    const view = renderApp(<App />);
    const region = await view.findByRole("region", { name: "Plan" });
    const branch = within(
      await within(region).findByRole("group", { name: "Branch 2a, Try it on the phone" }),
    );
    branch.getByText(/holds up step 3/);
    branch.getByRole("button", { name: "More: branch 2a, Try it on the phone" });
    branch.getByRole("button", { name: "Step 2a.1, Mock it on the phone: to do" });
    expect(region.querySelector(".ui-rail")).toBeNull();
  });
});

describe("a line's peek, as drawn on triage/T-Peek-Line", () => {
  test("a line that ended still moves from its page: Start, Up next and Table are there", async () => {
    seedLine();
    server.tracker.call(c.lineDone, { ref: "L-1" }, asDeveloper);
    navigate("/lines/L-1");
    const view = renderApp(<App />);
    await view.findByRole("button", { name: "Start" });
    view.getByRole("button", { name: "Up next" });
    view.getByRole("button", { name: "Table" });
  });

  test("is the line in short: its head, what finishes it, what else is for you, and Tell at its foot", async () => {
    seedLine();
    navigate("/?item=D-1&ref=L-1");
    const view = renderApp(<App />);
    const peek = within(await view.findByRole("complementary", { name: "L-1" }));
    await peek.findByRole("heading", { name: "One plan, one meal" });
    peek.getByRole("link", { name: /Open the full page/ });
    // Who is on it, in a sentence under the title.
    await peek.findByText(/meals\.1 is working/);
    // What finishes it, in a box of its own under that.
    const doneWhen = peek.getByRole("region", { name: "Done when" });
    within(doneWhen).getByText("The plan scrolls as one list.");
    // The task is what else is for you here, beside the question open on For you.
    const also = within(await peek.findByRole("region", { name: "Also for you here" }));
    also.getByText("Try the mockup on the phone");
    await peek.findByRole("textbox", { name: "Tell meals.1" });
    // Its plan and its moves are on its own page, one press away.
    expect(peek.queryByRole("region", { name: "Plan" })).toBeNull();
    expect(peek.queryByRole("button", { name: "Table" })).toBeNull();
    expect(peek.queryByRole("region", { name: "Owner" })).toBeNull();
  });
});

describe("a line's page while parts of it cannot load", () => {
  const failing = (op: string) => {
    const fetchNow = globalThis.fetch;
    Object.assign(globalThis, {
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).endsWith(`/api/ops/${op}`)) throw new TypeError("Failed to fetch");
        return fetchNow(input, init);
      },
    });
    return () => Object.assign(globalThis, { fetch: fetchNow });
  };

  test("what finishes it stays on the page when its plan cannot load", async () => {
    seedLine();
    const restore = failing("line.show");
    try {
      navigate("/lines/L-1");
      const view = renderApp(<App />);
      await view.findByText(/Could not load the plan/);
      view.getByText("The plan scrolls as one list.");
    } finally {
      restore();
    }
  });

  test("the owner's box says Lines could not load, never that the line has no owner", async () => {
    seedLine();
    const restore = failing("home.show");
    try {
      navigate("/lines/L-1");
      const view = renderApp(<App />);
      const owner = within(await view.findByRole("region", { name: "Owner" }));
      await owner.findByText(/Could not load the owner/);
      expect(owner.queryByText("no owner")).toBeNull();
      expect(owner.queryByRole("button", { name: "I'll own it" })).toBeNull();
    } finally {
      restore();
    }
  });
});
