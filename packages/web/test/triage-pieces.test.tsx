import { describe, expect, mock, test } from "bun:test";
import type { HomeView } from "@octotrack/core/schemas";
import { fireEvent, render, within } from "@testing-library/react";
import { LineFacts } from "../src/components/entity/LineFacts.tsx";
import { LineStanding } from "../src/components/entity/LineStanding.tsx";
import { ForYouCard } from "../src/components/foryou/ForYouCard.tsx";
import { ForYouEmpty } from "../src/components/foryou/ForYouEmpty.tsx";
import { ForYouListRow } from "../src/components/foryou/ForYouListRow.tsx";
import { ForYouRail } from "../src/components/foryou/ForYouRail.tsx";
import { ProposalItem } from "../src/components/foryou/ProposalItem.tsx";
import { LineForYouHere } from "../src/components/lines/LineForYouHere.tsx";
import { Card } from "../src/components/ui/Card.tsx";
import { Cleared } from "../src/components/ui/Cleared.tsx";
import { DetailPage } from "../src/components/ui/DetailPage.tsx";
import { FilterRail } from "../src/components/ui/FilterRail.tsx";
import { NextList } from "../src/components/ui/NextList.tsx";
import { PeekLink } from "../src/components/ui/PeekLink.tsx";
import { Queue } from "../src/components/ui/Queue.tsx";
import { Segments } from "../src/components/ui/Segments.tsx";
import { Triage } from "../src/components/ui/Triage.tsx";
import { Waits } from "../src/components/ui/Waits.tsx";
import type { Entry } from "../src/lib/forYou.ts";
import { decision, decisionCard, issue, line, lineHome } from "../src/design/fixtures.ts";

const noop = () => {};

describe("Triage", () => {
  test("holds the rail beside the list, and folded while a peek is open it says so", () => {
    const open = render(
      <Triage rail={<nav aria-label="Views" />}>
        <p>list</p>
      </Triage>,
    );
    const page = open.getByText("list").closest("[data-folded], .ui-triage");
    expect(page?.getAttribute("data-folded")).toBeNull();
    open.getByRole("navigation", { name: "Views" });
    open.unmount();
    const folded = render(
      <Triage rail={<nav aria-label="Views" />} folded>
        <p>list</p>
      </Triage>,
    );
    expect(folded.getByText("list").closest("[data-folded]")?.getAttribute("data-folded")).toBe("true");
  });
});

describe("Card and Queue", () => {
  test("the list is a region named by its view, saying where you are, with the open card among its rows", () => {
    const view = render(
      <Queue title="To accept" subtitle="22 of 64 open">
        <Card label="Open now">
          <h2>Wall mount</h2>
        </Card>
      </Queue>,
    );
    const list = within(view.getByRole("region", { name: "To accept" }));
    list.getByRole("heading", { name: "To accept", level: 1 });
    list.getByText("22 of 64 open");
    const card = list.getByRole("region", { name: "Open now" });
    // It can take focus, so Tab starts in it.
    expect(card.getAttribute("tabindex")).toBe("-1");
  });
});

describe("FilterRail and ForYouRail", () => {
  test("each view is a link with its count, the one you are in marked, urgent's count warm above zero", () => {
    const onGo = mock((_href: string) => {});
    const view = render(
      <FilterRail
        label="Waiting on you"
        current="toDo"
        onGo={onGo}
        views={[
          { key: "urgent", label: "Urgent", count: 1, href: "/for-you/urgent", urgent: true },
          { key: "toDo", label: "To do", count: 4, href: "/for-you/to-do" },
        ]}
      />,
    );
    const rail = within(view.getByRole("navigation", { name: "Waiting on you" }));
    expect(rail.getByRole("link", { name: "To do, 4" }).getAttribute("aria-current")).toBe("page");
    const urgent = rail.getByRole("link", { name: "Urgent, 1" });
    expect(urgent.querySelector("[data-tone='warn']")?.textContent).toBe("1");
    fireEvent.click(urgent);
    expect(onGo).toHaveBeenCalledWith("/for-you/urgent");
  });

  test("For you's rail lists every view at its own address, in order", () => {
    const view = render(
      <ForYouRail
        counts={{ all: 3, urgent: 0, toAnswer: 2, toDo: 1, toAccept: 0, toStepIn: 0 }}
        filter="all"
      />,
    );
    const rail = within(view.getByRole("navigation", { name: "Waiting on you" }));
    expect(rail.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/for-you/urgent",
      "/for-you/to-answer",
      "/for-you/to-do",
      "/for-you/to-accept",
      "/for-you/to-step-in",
    ]);
  });
});

describe("NextList and LineForYouHere", () => {
  test("a tile per item, each opening it, then the closing sentence", () => {
    const onOpen = mock((_key: string) => {});
    const view = render(
      <NextList
        label="For you here"
        onOpen={onOpen}
        items={[
          {
            key: "D-5",
            where: "Sendspin enclosure · D-5",
            title: "Snap or screws?",
            note: null,
            href: "/?item=D-5",
          },
        ]}
        after="Then 2 to do."
      />,
    );
    const list = within(view.getByRole("region", { name: "For you here" }));
    fireEvent.click(list.getByRole("link", { name: /Snap or screws\?/ }));
    expect(onOpen).toHaveBeenCalledWith("D-5");
    list.getByText("Then 2 to do.");
  });

  test("on a line's page, what waits on that line only, each opening on For you; nothing when nothing does", () => {
    const home: HomeView = {
      runner: { configured: false, cap: 1, dryRun: false },
      at: null,
      urgent: [],
      noLine: [],
      lines: {
        "L-1": lineHome({
          forYou: [
            {
              kind: "task",
              task: issue({ ref: "MEALS-1", title: "Try it on the phone", line: "L-1" }),
              frees: null,
            },
          ],
        }),
        "L-2": lineHome({
          forYou: [
            { kind: "question", card: decisionCard({ decision: decision({ ref: "D-9", line: "L-2" }) }) },
          ],
        }),
      },
      working: [line({ ref: "L-1", title: "One plan" }), line({ ref: "L-2", title: "Other" })],
      upNext: [],
      proposed: [],
      tabled: [],
      doneLately: [],
      crews: {},
    };
    const view = render(<LineForYouHere home={home} line="L-1" />);
    const here = within(view.getByRole("region", { name: "For you here" }));
    expect(here.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/?item=MEALS-1"]);
    view.unmount();
    expect(render(<LineForYouHere home={home} line="L-3" />).container.textContent).toBe("");
  });
});

describe("PeekLink, Waits and Cleared", () => {
  test("a peek link is a real link that peeks on a plain click, marked while its peek is open", () => {
    const onPeek = mock(() => {});
    const view = render(
      <PeekLink href="/lines/L-2" open onPeek={onPeek}>
        Sendspin enclosure
      </PeekLink>,
    );
    const link = view.getByRole("link", { name: "Sendspin enclosure" });
    expect(link.getAttribute("href")).toBe("/lines/L-2");
    expect(link.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(link);
    expect(onPeek).toHaveBeenCalledTimes(1);
    // Cmd leaves it to the browser, to open its page in a new tab.
    fireEvent.click(link, { metaKey: true });
    expect(onPeek).toHaveBeenCalledTimes(1);
  });

  test("a waits pill leads where it says, in its tone, without opening the row it sits on", () => {
    const onGo = mock((_href: string) => {});
    const onRow = mock(() => {});
    const view = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: a row's press, as Row draws it, for the test to watch
      // biome-ignore lint/a11y/useKeyWithClickEvents: the pill under test has its own keys as a link
      <div onClick={onRow}>
        <Waits label="Step in" tone="warn" href="/for-you/to-step-in" onGo={onGo} />
      </div>,
    );
    const pill = view.getByRole("link", { name: "Step in" });
    expect(pill.getAttribute("data-tone")).toBe("warn");
    fireEvent.click(pill);
    expect(onGo).toHaveBeenCalledWith("/for-you/to-step-in");
    expect(onRow).not.toHaveBeenCalled();
  });

  test("cleared says what is true, a few words, and where to go instead", () => {
    const view = render(
      <Cleared title="Nothing waits on you" actions={<a href="/lines">Go to Lines</a>}>
        One agent is working.
      </Cleared>,
    );
    const region = within(view.getByRole("region", { name: "Nothing waits on you" }));
    region.getByRole("heading", { name: "Nothing waits on you", level: 1 });
    region.getByText("One agent is working.");
    region.getByRole("link", { name: "Go to Lines" });
  });
});

describe("DetailPage", () => {
  test("crumbs that lead back, the title with its lead and moves, then what it holds and what goes beside it", () => {
    const onGo = mock((_href: string) => {});
    const view = render(
      <DetailPage
        onGo={onGo}
        crumbs={[{ label: "Lines", href: "/lines" }, { label: "Working on, 1" }]}
        title="One plan, one meal"
        lead="Mockup ready."
        actions={<button type="button">Table</button>}
        aside={<p>beside</p>}
      >
        <p>plan</p>
      </DetailPage>,
    );
    const crumbs = within(view.getByRole("navigation", { name: "Breadcrumb" }));
    fireEvent.click(crumbs.getByRole("link", { name: "Lines" }));
    expect(onGo).toHaveBeenCalledWith("/lines");
    crumbs.getByText("Working on, 1");
    view.getByRole("heading", { name: "One plan, one meal", level: 1 });
    view.getByText("Mockup ready.");
    view.getByRole("button", { name: "Table" });
    view.getByText("plan");
    view.getByText("beside");
  });
});

describe("Segments", () => {
  test("one choice of a few, as radios named by their words, the one chosen checked", () => {
    const onChoose = mock((_key: string) => {});
    const view = render(
      <Segments
        label="Where it goes"
        chosen="up_next"
        onChoose={onChoose}
        choices={[
          { key: "up_next", label: "Up next", description: "Waits its turn" },
          { key: "working", label: "Working on", description: "Starts now" },
        ]}
      />,
    );
    const group = within(view.getByRole("group", { name: "Where it goes" }));
    expect(group.getByRole("radio", { name: "Up next Waits its turn" })).toHaveProperty("checked", true);
    fireEvent.click(group.getByRole("radio", { name: "Working on Starts now" }));
    expect(onChoose).toHaveBeenCalledWith("working");
  });
});

describe("LineFacts and LineStanding", () => {
  test("facts say its state, whose it is, its ref and repos", () => {
    const view = render(
      <LineFacts line={line({ ref: "L-1", state: "working", ownedBy: "dev" })} repos={["MEALS"]} />,
    );
    view.getByText("Working on");
    view.getByText("yours");
    view.getByText("L-1");
    view.getByText("MEALS");
  });

  test("standing says done when, and for a tabled line why it waits", () => {
    const view = render(
      <LineStanding line={line({ state: "tabled", tabledReason: "Spring", doneWhen: "Booked." })} />,
    );
    view.getByText("Booked.");
    view.getByText("Spring");
  });
});

describe("ForYouCard, ForYouListRow and ForYouEmpty", () => {
  const entry: Entry = {
    ref: "D-4",
    line: line({ ref: "L-2", title: "Sendspin enclosure" }),
    item: {
      kind: "question",
      card: decisionCard({ decision: decision({ ref: "D-4", title: "Which filament?" }) }),
    },
    laterAt: null,
  };

  test("the card names its line, which peeks, and where the line stands, over the entry", () => {
    const onPeek = mock((_line: string) => {});
    const view = render(
      <ForYouCard entry={entry} step="step 2 of 4, Print the base" peeking={false} onPeek={onPeek}>
        <p>the entry</p>
      </ForYouCard>,
    );
    const card = within(view.getByRole("region", { name: "Open now" }));
    fireEvent.click(card.getByRole("link", { name: "Sendspin enclosure" }));
    expect(onPeek).toHaveBeenCalledWith("L-2");
    card.getByText("step 2 of 4, Print the base");
    card.getByText("the entry");
  });

  test("a row says its number, what it is and its title, and opens it; a recommended Up next is its button", () => {
    const onOpen = mock((_ref: string) => {});
    const onMove = mock((_ref: string, _move: "start" | "up_next") => {});
    const question = render(
      <ForYouListRow entry={entry} number={4} busy={false} onOpen={onOpen} onMove={onMove} />,
    );
    fireEvent.click(question.getByRole("button", { name: "Which filament?" }));
    expect(onOpen).toHaveBeenCalledWith("D-4");
    question.getByText("Question");
    question.unmount();
    const proposed = line({
      ref: "L-6",
      title: "Widgets redesign",
      state: "proposed",
      recommendation: "up_next",
    });
    const row = render(
      <ForYouListRow
        entry={{ ref: "L-6", line: proposed, item: { kind: "proposal" }, laterAt: null }}
        number={5}
        busy={false}
        onOpen={onOpen}
        onMove={onMove}
      />,
    );
    fireEvent.click(row.getByRole("button", { name: "Up next Widgets redesign" }));
    expect(onMove).toHaveBeenCalledWith("L-6", "up_next");
  });

  test("a proposal recommended to table carries no button: tabling asks why", () => {
    const proposed = line({ ref: "L-7", title: "Old idea", state: "proposed", recommendation: "table" });
    const view = render(
      <ForYouListRow
        entry={{ ref: "L-7", line: proposed, item: { kind: "proposal" }, laterAt: null }}
        number={1}
        busy={false}
        onOpen={noop}
        onMove={noop}
      />,
    );
    expect(view.queryByRole("button", { name: /^Table/ })).toBeNull();
  });

  test("a view with nothing in it offers the next view; everything clear names who works on what", () => {
    const next = render(
      <ForYouEmpty
        filter="toAnswer"
        working={[]}
        nextAsk={null}
        then={{ filter: "toDo", label: "To do", count: 2 }}
      />,
    );
    next.getByRole("heading", { name: "Nothing to answer" });
    expect(next.getByRole("link", { name: "To do, 2 waiting" }).getAttribute("href")).toBe("/for-you/to-do");
    next.unmount();
    const all = render(
      <ForYouEmpty
        filter="all"
        working={[{ agent: "panel-widgets", line: "Sendspin enclosure" }]}
        cleared={{ questions: 3, tasks: 2, lines: 1 }}
        nextAsk={{ title: "One plan, one meal", step: "step 2" }}
        then={null}
      />,
    );
    all.getByText(
      "panel-widgets is working on Sendspin enclosure. The next ask will likely come from One plan, one meal, at step 2.",
    );
    all.getByText(/You cleared today: 3 questions answered, 2 tasks done and 1 line started\./);
  });
});

describe("ProposalItem", () => {
  test("its recommended move comes first, and Fold and Table ask what they need in place", () => {
    const onQueue = mock((_ref: string) => {});
    const view = render(
      <ProposalItem
        line={line({
          ref: "L-6",
          title: "Widgets redesign",
          state: "proposed",
          recommendation: "up_next",
          recommendationWhy: "The print is final.",
        })}
        foldTargets={[line({ ref: "L-2", title: "Sendspin enclosure" })]}
        lastUpNext="Try it on the phone"
        origin={null}
        busy={false}
        onStart={noop}
        onQueue={onQueue}
        onTable={noop}
        onFold={noop}
        onReject={noop}
        onDrop={noop}
      />,
    );
    view.getByText("The print is final.");
    const moves = view.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(moves[0]).toBe("Up next, recommended");
    fireEvent.click(view.getByRole("button", { name: "Up next, recommended" }));
    expect(onQueue).toHaveBeenCalledWith("L-6");
    fireEvent.click(view.getByRole("button", { name: "Fold into a line…" }));
    view.getByRole("button", { name: /Sendspin enclosure/ });
  });
});
