import { navigate } from "../src/lib/router.ts";
import { HeldDecision } from "../src/components/decisions/HeldDecision.tsx";
import { OutcomeFields } from "../src/components/home/OutcomeFields.tsx";
import { LineBox } from "../src/components/ui/LineBox.tsx";
import { Loaded } from "../src/components/ui/Loaded.tsx";
import { TaskFrees } from "../src/components/entity/TaskFrees.tsx";
import type { TaskOutcome } from "../src/lib/tasks.ts";
import { describe, expect, mock, test } from "bun:test";
import { useState } from "react";
import { fireEvent, render, within } from "@testing-library/react";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { BatchPanelView } from "../src/components/decisions/BatchPanelView.tsx";
import { DecisionCardView } from "../src/components/decisions/DecisionCardView.tsx";
import { DriftItem } from "../src/components/drift/DriftItem.tsx";
import { AgentRosterRow } from "../src/components/agents/AgentRosterRow.tsx";
import { LinePanelHead } from "../src/components/entity/LinePanelHead.tsx";
import { OwnerBox } from "../src/components/entity/OwnerBox.tsx";
import { PlanList } from "../src/components/entity/PlanList.tsx";
import { SummaryBox } from "../src/components/entity/SummaryBox.tsx";
import { FirstRun } from "../src/components/home/FirstRun.tsx";
import { FoldedSection } from "../src/components/home/FoldedSection.tsx";
import { ForYouRow } from "../src/components/home/ForYouRow.tsx";
import { HomeSection } from "../src/components/home/HomeSection.tsx";
import { LineMeta } from "../src/components/home/LineMeta.tsx";
import { SpreadThin } from "../src/components/home/SpreadThin.tsx";
import { StartSheetView } from "../src/components/home/StartSheetView.tsx";
import { LineProposalCard } from "../src/components/home/LineProposalCard.tsx";
import { ProposalCard } from "../src/components/home/ProposalCard.tsx";
import { PushToggle } from "../src/components/home/PushToggle.tsx";
import { QuietRow } from "../src/components/home/QuietRow.tsx";
import { LineHandle } from "../src/components/home/LineHandle.tsx";
import { StepIn } from "../src/components/home/StepIn.tsx";
import { TaskCard } from "../src/components/home/TaskCard.tsx";
import { UpNextRow } from "../src/components/home/UpNextRow.tsx";
import { WorkingLine } from "../src/components/home/WorkingLine.tsx";
import { eventTone, FeedItem } from "../src/components/feed/FeedItem.tsx";
import { FeedList } from "../src/components/feed/FeedList.tsx";
import { UnseenLog } from "../src/components/feed/UnseenLog.tsx";
import { AnswerStatus } from "../src/components/home/AnswerStatus.tsx";
import { ForYouItem } from "../src/components/home/ForYouItem.tsx";
import { HOME_KEYS, KeyHelp } from "../src/components/home/KeyHelp.tsx";
import { NothingNeedsYou } from "../src/components/home/NothingNeedsYou.tsx";
import { AtSection } from "../src/components/home/AtSection.tsx";
import { foldedText } from "../src/components/home/FoldedItems.tsx";
import { SinceSummary } from "../src/components/entity/SinceSummary.tsx";
import { FilterBar } from "../src/components/feed/FilterBar.tsx";
import { LineActions } from "../src/components/entity/LineActions.tsx";
import { OwnWorkBox } from "../src/components/entity/OwnWorkBox.tsx";
import { TellBox } from "../src/components/entity/TellBox.tsx";
import { type NewLine, NewLineCard } from "../src/components/lines/NewLineCard.tsx";
import { TableForm } from "../src/components/lines/TableForm.tsx";
import { TopBar } from "../src/components/layout/TopBar.tsx";
import { UndoBar } from "../src/components/layout/UndoBar.tsx";
import { SyncFailures } from "../src/components/prs/SyncFailures.tsx";
import { Markdown } from "../src/components/ui/Markdown.tsx";
import { RefText } from "../src/components/ui/RefText.tsx";
import { TextBox } from "../src/components/ui/TextBox.tsx";
import { EmptyState, ErrorState, LoadingState } from "../src/components/ui/states.tsx";
import { ActivityList } from "../src/components/entity/ActivityList.tsx";
import { HistoryList } from "../src/components/entity/HistoryList.tsx";
import { KeyValues } from "../src/components/entity/KeyValues.tsx";
import { LinkList } from "../src/components/entity/LinkList.tsx";
import { PullRequestBox } from "../src/components/entity/PullRequestBox.tsx";
import { AtPlaceItems } from "../src/components/home/AtPlaceItems.tsx";
import { AtUpNext } from "../src/components/home/AtUpNext.tsx";
import { CheckoutForm } from "../src/components/home/CheckoutForm.tsx";
import { FocusTarget } from "../src/components/home/FocusTarget.tsx";
import { FoldPicker } from "../src/components/home/FoldPicker.tsx";
import { LineForYou } from "../src/components/home/LineForYou.tsx";
import { LineStepIn } from "../src/components/home/LineStepIn.tsx";
import { MoreForYou } from "../src/components/home/MoreForYou.tsx";
import { NotKept } from "../src/components/ui/NotKept.tsx";
import type { HomeActions } from "../src/hooks/useHome.ts";
import { refOf } from "../src/lib/focus.ts";
import type {
  AgentView,
  EntitySummary,
  ForYou,
  HomeView,
  Issue,
  LineCrew,
  LineHome,
  StepInKind,
  Link,
} from "@octotrack/core/schemas";
import type { Tone } from "../src/lib/format.ts";
import {
  decision,
  decisionCard,
  decisionForm,
  drift,
  event,
  issue,
  line,
  pendingChoice,
  pr,
} from "../src/design/fixtures.ts";
import { contracts, whole } from "./harness.tsx";

const form = decisionForm;

describe("DecisionCardView", () => {
  test("puts the reason for the recommendation directly under the options", () => {
    const view = render(
      <DecisionCardView
        form={form()}
        card={decisionCard({
          decision: decision({ recommendation: "redis", recommendationWhy: "It is already deployed." }),
        })}
      />,
    );
    view.getByText(whole("Why 2: It is already deployed."));
  });

  test("shows what is needed to decide: question, context, options, recommendation, reasons, blocked work", () => {
    const view = render(
      <DecisionCardView
        form={form()}
        card={decisionCard({
          reasons: ["2 agents waiting", "high priority"],
          blocks: [
            {
              kind: "issue",
              ref: "OCT-4",
              title: "x",
              status: "todo",
              project: "OCT",
              priority: null,
              assignee: null,
              version: 1,
              updatedAt: "",
            },
            {
              kind: "issue",
              ref: "OCT-5",
              title: "y",
              status: "done",
              project: "OCT",
              priority: null,
              assignee: null,
              version: 1,
              updatedAt: "",
            },
          ],
        })}
      />,
    );
    view.getByRole("heading", { name: "Which queue?" });
    view.getByText("We need at-least-once delivery.");
    view.getByText("2 agents waiting");
    view.getByText("1 · SQS");
    view.getByText("Managed");
    const redis = view.getByRole("button", { name: /Redis/ });
    within(redis).getByText("recommended");
    expect(view.queryByRole("button", { name: /SQS.*recommended/ })).toBeNull();
    view.getByRole("button", { name: "OCT-4" });
    expect(view.queryByRole("button", { name: "OCT-5" })).toBeNull();
  });

  test("one press on an option answers it; the card says when it has focus", () => {
    const answer = mock((_key: string) => {});
    const view = render(<DecisionCardView selected form={form({ answer })} card={decisionCard()} />);
    view.getByText("Focused");
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    expect(answer).toHaveBeenCalledWith("redis");
    expect(view.queryByRole("button", { name: "Decide" })).toBeNull();
  });

  test("In my own words opens a box whose words are the answer", () => {
    const openOwn = mock(() => {});
    const closed = render(<DecisionCardView form={form({ openOwn })} card={decisionCard()} />);
    fireEvent.click(closed.getByRole("button", { name: "In my own words" }));
    expect(openOwn).toHaveBeenCalledTimes(1);
    closed.unmount();
    const setOwn = mock((_text: string) => {});
    const sendOwn = mock(() => {});
    const empty = render(<DecisionCardView form={form({ ownWords: "", setOwn })} card={decisionCard()} />);
    expect(empty.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(empty.getByLabelText("Your answer to D-1"), {
      target: { value: "Redis behind a flag" },
    });
    expect(setOwn).toHaveBeenCalledWith("Redis behind a flag");
    empty.unmount();
    const typed = render(
      <DecisionCardView form={form({ ownWords: "Redis", sendOwn })} card={decisionCard()} />,
    );
    fireEvent.click(typed.getByRole("button", { name: "Send" }));
    expect(sendOwn).toHaveBeenCalledTimes(1);
  });

  test("without options the answer is the developer's own words, and a free-text recommendation shows", () => {
    const view = render(
      <DecisionCardView
        form={form()}
        card={decisionCard({ decision: decision({ options: [], recommendation: "Do it" }) })}
      />,
    );
    view.getByRole("button", { name: "In my own words" });
    view.getByText("Recommendation: Do it");
  });

  test("shows an error from the server", () => {
    const view = render(<DecisionCardView form={form({ error: "Already decided" })} card={decisionCard()} />);
    expect(view.getByRole("alert").textContent).toBe("Already decided");
  });
});

describe("FeedItem", () => {
  test("shows the summary with clickable refs, and chips add filters", () => {
    const onFilter = mock(() => {});
    const view = render(<FeedItem onFilter={onFilter} event={event({ summary: "OCT-1 moved, see D-3" })} />);
    view.getByRole("button", { name: "OCT-1" });
    view.getByRole("button", { name: "D-3" });
    fireEvent.click(view.getByRole("button", { name: "claude-a" }));
    expect(onFilter).toHaveBeenCalledWith("actor:claude-a");
    fireEvent.click(view.getByRole("button", { name: "OCT" }));
    expect(onFilter).toHaveBeenCalledWith("project:OCT");
  });

  test("adds the ref when the summary does not mention it", () => {
    const view = render(<FeedItem onFilter={() => {}} event={event({ ref: "U-4", summary: "Half way" })} />);
    view.getByRole("button", { name: "U-4" });
  });

  const TONE_CASES: readonly (readonly [string, Record<string, string>, Tone])[] = [
    ["decision.requested", {}, "attention"],
    ["decision.resolved", {}, "good"],
    ["pr.merged", {}, "good"],
    ["pr.checks_changed", { checks: "failing" }, "bad"],
    ["pr.checks_changed", { checks: "passing" }, "good"],
    ["status.posted", { level: "blocker" }, "bad"],
    ["status.posted", { level: "progress" }, "info"],
    ["issue.status_changed", { status: "done" }, "good"],
    ["link.added", {}, "neutral"],
  ];
  test.each(TONE_CASES)("%s %j is toned %s", (type, attrs, tone) => {
    expect(eventTone(event({ type, attrs }))).toBe(tone);
  });

  test("the list marks where the day changes", () => {
    const view = render(
      <FeedList
        onFilter={() => {}}
        events={[
          event({ seq: 3, ts: "2026-11-05T10:00:00.000Z" }),
          event({ seq: 2, ts: "2026-11-05T09:00:00.000Z" }),
          event({ seq: 1, ts: "2026-11-04T09:00:00.000Z" }),
        ]}
      />,
    );
    view.getByText("2026-11-05");
    view.getByText("2026-11-04");
    expect(view.getAllByRole("article")).toHaveLength(3);
  });
});

describe("FilterBar", () => {
  const suggestions = [
    { term: "kind:decision", hint: "" },
    { term: "kind:issue", hint: "" },
  ];

  test("shows errors and marks the input invalid", () => {
    const view = render(
      <FilterBar value="nope:1" error="Unknown field" suggestions={[]} onChange={() => {}} />,
    );
    view.getByText("Unknown field");
    expect(view.getByLabelText("Filter").getAttribute("aria-invalid")).toBe("true");
  });

  test("offers suggestions only while focused, and completes the last word", () => {
    const onChange = mock(() => {});
    const view = render(
      <FilterBar value="status:open kind:" error={null} suggestions={suggestions} onChange={onChange} />,
    );
    expect(view.queryByText("kind:issue")).toBeNull();
    fireEvent.focus(view.getByLabelText("Filter"));
    fireEvent.mouseDown(view.getByText("kind:issue"));
    expect(onChange).toHaveBeenCalledWith("status:open kind:issue ");
  });

  test("arrow keys and Tab pick a suggestion", () => {
    const onChange = mock(() => {});
    const view = render(<FilterBar value="ki" error={null} suggestions={suggestions} onChange={onChange} />);
    const input = view.getByLabelText("Filter");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(onChange).toHaveBeenCalledWith("kind:issue ");
  });

  test("a field suggestion stays ready for its value", () => {
    const onChange = mock(() => {});
    const view = render(
      <FilterBar
        value="st"
        error={null}
        suggestions={[{ term: "status:", hint: "Status" }]}
        onChange={onChange}
      />,
    );
    fireEvent.focus(view.getByLabelText("Filter"));
    fireEvent.mouseDown(view.getByText("status:"));
    expect(onChange).toHaveBeenCalledWith("status:");
  });
});

describe("BatchPanelView", () => {
  const base = {
    text: "",
    parsed: [],
    parseError: null,
    results: null,
    submitting: false,
    onChange: () => {},
    onSubmit: () => {},
  };

  test("cannot submit nothing, and counts what it will record", () => {
    const empty = render(<BatchPanelView {...base} />);
    expect(empty.getByRole("button", { name: /Record/ }).hasAttribute("disabled")).toBe(true);
    empty.unmount();
    const ready = render(<BatchPanelView {...base} parsed={[{ ref: "D-1", option: "a", note: null }]} />);
    const button = ready.getByRole("button", { name: "Record 1" });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  test("shows parse errors and per-line results", () => {
    const view = render(
      <BatchPanelView
        {...base}
        parseError="Line 1 is not understood"
        results={[
          { ref: "D-1", ok: true, error: null },
          { ref: "D-2", ok: false, error: "No such option" },
        ]}
      />,
    );
    view.getByRole("alert");
    view.getByText("recorded");
    view.getByText("No such option");
  });
});

describe("DriftItem", () => {
  test("needs a note before it can be cleared, and offers both answers", () => {
    const onAck = mock(() => {});
    const view = render(<DriftItem drift={drift()} onAck={onAck} />);
    const updated = view.getByRole("button", { name: "Updated" });
    const nothing = view.getByRole("button", { name: "Nothing to update" });
    expect(updated.hasAttribute("disabled")).toBe(true);
    expect(nothing.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Note for DR-1"), { target: { value: "  Kept open on purpose " } });
    fireEvent.click(nothing);
    expect(onAck).toHaveBeenCalledWith("DR-1", "verified", "Kept open on purpose");
    fireEvent.click(updated);
    expect(onAck).toHaveBeenCalledWith("DR-1", "updated", "Kept open on purpose");
  });

  test("drift about state only offers saying it is fine, since fixing the state clears it", () => {
    const view = render(
      <DriftItem drift={drift({ edge: false, rule: "pr-checks-failing" })} onAck={() => {}} />,
    );
    expect(view.queryByRole("button", { name: "Updated" }) === null).toBe(true);
    view.getByRole("button", { name: "Nothing to update" });
  });

  test("once cleared it shows the answer instead of a form", () => {
    const view = render(
      <DriftItem
        drift={drift({ status: "verified", note: "Fine as it is", resolvedBy: "agent" })}
        onAck={() => {}}
      />,
    );
    view.getByText("agent: Fine as it is");
    expect(view.queryByRole("textbox")).toBeNull();
  });

  test("shows why a clear was refused", () => {
    const view = render(<DriftItem drift={drift()} error="has not changed" onAck={() => {}} />);
    expect(view.getByRole("alert").textContent).toBe("has not changed");
  });
});

describe("TopBar", () => {
  const counts = [
    { key: "toAnswer" as const, label: "to answer", count: 4, to: "D-56" },
    { key: "toAccept" as const, label: "to accept", count: 1, to: "L-6" },
    { key: "toStepIn" as const, label: "to step in", count: 1, to: "stepin:L-9" },
  ];

  test("names the three pages, marks this one, and links each count to its first item", () => {
    const onAt = mock((_place: string | null) => {});
    const onNewLine = mock(() => {});
    const view = render(
      <TopBar
        path="/log"
        counts={counts}
        places={["the bench", "the Mac"]}
        at={null}
        onAt={onAt}
        onNewLine={onNewLine}
        onKeys={() => {}}
      />,
    );
    const nav = within(view.getByRole("navigation", { name: "Main" }));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual(["Lines", "Log", "Agents"]);
    expect(nav.getByRole("link", { name: "Log" }).getAttribute("aria-current")).toBe("page");
    expect(view.getByRole("link", { name: "4 to answer" }).getAttribute("href")).toBe("/?focus=D-56");
    expect(view.getByRole("link", { name: "1 to step in" }).getAttribute("data-count")).toBe("toStepIn");
    fireEvent.change(view.getByRole("combobox"), { target: { value: "the Mac" } });
    expect(onAt).toHaveBeenCalledWith("the Mac");
    fireEvent.click(view.getByRole("button", { name: "New line" }));
    expect(onNewLine).toHaveBeenCalledTimes(1);
  });

  test("draws the counts as one group of number and words, with urgent apart in front of it", () => {
    const view = render(
      <TopBar
        path="/"
        counts={[{ key: "urgent" as const, label: "urgent", count: 1, to: "D-60" }, ...counts]}
        places={[]}
        at={null}
        onAt={() => {}}
        onNewLine={() => {}}
        onKeys={() => {}}
      />,
    );
    const status = view.getByRole("status", { name: "Waiting on you" });
    expect(
      within(status)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["1 urgent", "4 to answer", "1 to accept", "1 to step in"]);
    const urgent = view.getByRole("link", { name: "1 urgent" });
    expect(status.querySelector(".top-counts")?.contains(urgent)).toBe(false);
    expect(urgent.querySelector(".top-count-n")?.textContent).toBe("1");
  });

  test("leaves out I'm at when the developer has no places, and the counts when nothing waits", () => {
    const view = render(
      <TopBar
        path="/"
        counts={[]}
        places={[]}
        at={null}
        onAt={() => {}}
        onNewLine={() => {}}
        onKeys={() => {}}
      />,
    );
    expect(view.queryByRole("combobox")).toBeNull();
    expect(view.queryByRole("status", { name: "Waiting on you" })).toBeNull();
  });
});

describe("small pieces", () => {
  test("sync failures name the repo and the reason", () => {
    const view = render(<SyncFailures failures={[{ repo: "a/b", error: "Boom", updatedAt: "" }]} />);
    view.getByText(/stale for a\/b: Boom/);
    expect(render(<SyncFailures failures={[]} />).container.firstChild).toBe(null);
  });

  test("states have roles, and an empty state can show a command", () => {
    render(<LoadingState />).getByRole("status");
    render(<ErrorState error={new Error("Boom")} />).getByRole("alert");
    render(<EmptyState command="octo guide">Nothing</EmptyState>).getByText("octo guide");
  });

  test("RefText links refs and leaves other words alone", () => {
    const view = render(<RefText text="See D-3 and OCT-12, not UTF8 or x-1" />);
    expect(view.getAllByRole("button").map((button) => button.textContent)).toEqual(["D-3", "OCT-12"]);
  });
});

/** A task card whose words are kept, as its caller keeps them in a draft. */
function TypingTask({
  onDone,
  onCant,
  fields = [],
}: {
  onDone(outcome: TaskOutcome): void;
  onCant(why: string): void;
  fields?: string[];
}) {
  const [words, setWords] = useState("");
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [why, setWhy] = useState("");
  return (
    <TaskCard
      task={issue({ title: "Measure the grip", place: "the bench", outcome: "Five numbers", fields })}
      words={words}
      onWords={setWords}
      values={values}
      onValue={(name, value) => setValues({ ...values, [name]: value })}
      why={why}
      onWhy={setWhy}
      onDone={onDone}
      onCant={onCant}
    />
  );
}

describe("lines of work", () => {
  const card = (overrides: Parameters<typeof decision>[0] = {}) =>
    decisionCard({ decision: decision(overrides) });
  const details = (overrides: Partial<LineHome> = {}): LineHome => ({
    start: null,
    step: null,
    forYou: [],
    stepIn: false,
    stepInReason: null,
    stepInKind: null,
    waitingOnYou: false,
    held: { questions: 0, tasks: 0 },
    reconfirming: 0,
    sinceSummary: 0,
    scopedSteps: 0,
    answers: [],
    ...overrides,
  });

  test("WorkingLine shows its place, who is on it, whether it waits on you, its step and its headline", () => {
    const view = render(
      <WorkingLine
        index={2}
        line={line({ headline: "Printed; the short board fits." })}
        crew={{ owner: { name: "panel", state: "asleep" }, helpers: [], scoper: null, search: null }}
        details={details({
          step: { position: 3, of: 4, title: "settle board and opening" },
          forYou: [{ kind: "question", card: card() }],
          waitingOnYou: true,
        })}
      >
        <p>child</p>
      </WorkingLine>,
    );
    const article = within(view.getByRole("article", { name: "Sendspin enclosure" }));
    article.getByText("2");
    article.getByText(/owner panel, asleep/);
    article.getByText(/waiting on you/);
    article.getByText(/step 3 of 4, settle board and opening/);
    article.getByText("Printed; the short board fits.");
    article.getByText("child");
  });

  test("WorkingLine says how many changes came after its summary, as a link that opens the line", () => {
    navigate("/");
    const view = render(
      <WorkingLine
        index={1}
        line={line({ headline: "Down to the hotel pick." })}
        details={details({ sinceSummary: 3 })}
      >
        {null}
      </WorkingLine>,
    );
    fireEvent.click(view.getByRole("button", { name: "3 changes since the summary" }));
    expect(new URLSearchParams(window.location.search).get("ref")).toBe("L-1");
    view.unmount();
    const one = render(
      <WorkingLine
        index={1}
        line={line({ headline: "Down to the hotel pick." })}
        details={details({ sinceSummary: 1 })}
      >
        {null}
      </WorkingLine>,
    );
    one.getByRole("button", { name: "1 change since the summary" });
    one.unmount();
    expect(
      render(
        <WorkingLine index={1} line={line({ headline: "Down to the hotel pick." })} details={details()}>
          {null}
        </WorkingLine>,
      ).queryByRole("button", { name: /since the summary/ }),
    ).toBeNull();
  });

  test("LineMeta says waiting on you only when all the line's work waits on you, else agents on it", () => {
    const crew: LineCrew = {
      owner: { name: "builder", state: "running" },
      helpers: [],
      scoper: null,
      search: null,
    };
    const forYou = [{ kind: "question" as const, card: card() }];
    const waits = render(<LineMeta crew={crew} details={details({ forYou, waitingOnYou: true })} />);
    waits.getByText(/waiting on you/);
    waits.unmount();
    const busy = render(<LineMeta crew={crew} details={details({ forYou, waitingOnYou: false })} />);
    busy.getByText(/agents on it/);
    expect(busy.queryByText(/waiting on you/)).toBeNull();
  });

  test("LineMeta on a line the developer owns says what it holds for an agent", () => {
    const view = render(<LineMeta details={details({ held: { questions: 1, tasks: 2 } })} owned />);
    view.getByText("3 held for an agent");
    view.unmount();
    expect(
      render(<LineMeta details={details({ held: { questions: 1, tasks: 0 } })} />).queryByText(/held/),
    ).toBeNull();
  });

  test("LineMeta says when nobody could be found to own a line, and who is scoping it", () => {
    const crew: LineCrew = { owner: null, helpers: [], scoper: null, search: { step: 3, since: "" } };
    const empty = render(<LineMeta crew={crew} details={details({ stepIn: true })} />);
    expect(empty.getByText(/no owner: step in/).getAttribute("data-tone")).toBe("bad");
    empty.unmount();
    // The search ran its course, but a start is on its way or the work waits on the developer: nothing to step in on.
    const waiting = render(<LineMeta crew={crew} details={details({ stepIn: false })} />);
    waiting.getByText(/no owner yet/);
    expect(waiting.queryByText(/no owner: step in/)).toBeNull();
    waiting.unmount();
    render(
      <LineMeta
        crew={{ owner: null, helpers: [], scoper: { name: "garden", state: "running" }, search: null }}
      />,
    ).getByText(/garden is scoping it/);
  });

  test("ForYouRow shows a question's recommendation and why, or a task's place, and opens it", () => {
    const onOpen = mock(() => {});
    const question = render(
      <ForYouRow
        item={{
          kind: "question",
          card: card({ recommendation: "sqs", recommendationWhy: "It is managed." }),
        }}
        onOpen={onOpen}
      />,
    );
    question.getByText("Question · D-1");
    question.getByText(whole("Recommended SQS: It is managed."));
    fireEvent.click(question.getByRole("button", { name: "Open D-1" }));
    expect(onOpen).toHaveBeenCalledWith("D-1");
    question.unmount();
    const task = render(
      <ForYouRow
        item={{
          kind: "task",
          task: issue({ ref: "OCT-7", assignee: "dev", place: "the Mac", outcome: "Yes or no" }),
          frees: { ref: "OCT-41", title: "the real wake test" },
        }}
        onOpen={onOpen}
      />,
    );
    task.getByText("Task · OCT-7 · at the Mac");
    // As E-Home writes it: what it frees, not what to report, which the task says once opened.
    task.getByText(whole("Frees OCT-41: the real wake test."));
    expect(task.queryByText(/Report:/)).toBeNull();
    task.unmount();
    const unlinked = render(
      <ForYouRow
        item={{ kind: "task", task: issue({ ref: "OCT-8", outcome: "Yes or no" }), frees: null }}
        onOpen={onOpen}
      />,
    );
    unlinked.getByText(whole("Report: Yes or no"));
  });

  test("TaskCard with named outcomes has a box for each and a note, counts what is filled, and needs them all", () => {
    const onDone = mock(() => {});
    const view = render(<TypingTask onDone={onDone} onCant={() => {}} fields={["Length", "Holes"]} />);
    view.getByText(/0 of 2 filled/);
    fireEvent.change(view.getByLabelText("Length"), { target: { value: "41 mm" } });
    view.getByText(/1 of 2 filled/);
    expect(view.getByRole("button", { name: "Done" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Holes"), { target: { value: " 38 " } });
    fireEvent.change(view.getByLabelText("Note, if anything surprised you"), { target: { value: "Warped" } });
    view.getByText(/2 of 2 filled/);
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith({ values: { Length: "41 mm", Holes: "38" }, result: "Warped" });
  });

  test("TaskCard shows what to send back as a form, and Can't do it asks why, in a box of its own", () => {
    const onDone = mock(() => {});
    const onCant = mock(() => {});
    const view = render(<TypingTask onDone={onDone} onCant={onCant} />);
    view.getByText("Five numbers");
    expect(view.getByRole("button", { name: "Done" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("What OCT-1 found"), { target: { value: " 41, 38 " } });
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith({ result: "41, 38" });
    fireEvent.click(view.getByRole("button", { name: "Can't do it" }));
    // What was found is not offered as the reason: each has its own box.
    expect(view.getByLabelText("Why OCT-1 cannot be done")).toHaveProperty("value", "");
    fireEvent.change(view.getByLabelText("Why OCT-1 cannot be done"), { target: { value: "No calipers" } });
    fireEvent.click(view.getByRole("button", { name: "Close it" }));
    expect(onCant).toHaveBeenCalledWith("No calipers");
  });

  test("StepIn offers to own the line, or to table it with a reason", () => {
    const onOwn = mock(() => {});
    const onTable = mock(() => {});
    const onRetry = mock((_ref: string) => {});
    const view = render(
      <StepIn
        line={line()}
        reason="claude is not logged in"
        onRetry={onRetry}
        onOwn={onOwn}
        onTable={onTable}
      />,
    );
    view.getByText("claude is not logged in");
    fireEvent.click(view.getByRole("button", { name: "Try now" }));
    expect(onRetry).toHaveBeenCalledWith("L-1");
    fireEvent.click(view.getByRole("button", { name: "I'll own it" }));
    expect(onOwn).toHaveBeenCalledWith("L-1");
    fireEvent.click(view.getByRole("button", { name: "Table it" }));
    fireEvent.change(view.getByLabelText("Why table Sendspin enclosure"), { target: { value: "Later" } });
    fireEvent.click(view.getByRole("button", { name: "Table it" }));
    expect(onTable).toHaveBeenCalledWith("L-1", "Later", null);
  });

  test("UpNextRow says what it holds and how far scoping got, and starts", () => {
    const onStart = mock(() => {});
    const view = render(
      <UpNextRow
        index={6}
        line={line({ state: "up_next", title: "Wall mount", doneWhen: "it hangs flush." })}
        details={details({ held: { questions: 0, tasks: 1 } })}
        onStart={onStart}
      />,
    );
    view.getByText(/1 task held/);
    view.getByText(/not scoped yet/);
    // It holds something, so Start opens the Start sheet first.
    expect(view.getByRole("button", { name: "Start Wall mount" }).textContent).toBe("Start");
    view.getByText(whole("Done when it hangs flush."));
    fireEvent.click(view.getByRole("button", { name: "Start Wall mount" }));
    expect(onStart).toHaveBeenCalledWith("L-1");
  });

  test("UpNextRow and LineMeta say how much held work waits to be re-confirmed, and nothing when none does", () => {
    const row = render(
      <UpNextRow
        index={6}
        line={line({ state: "up_next", title: "Wall mount" })}
        details={details({ held: { questions: 2, tasks: 0 }, reconfirming: 2 })}
        onStart={() => {}}
      />,
    );
    row.getByText(/2 re-confirming/);
    row.unmount();
    const meta = render(<LineMeta details={details({ reconfirming: 1 })} />);
    meta.getByText("1 re-confirming");
    meta.unmount();
    expect(render(<LineMeta details={details()} />).queryByText(/re-confirming/)).toBeNull();
  });

  test("ProposalCard shows the agent's case and every choice a proposal has", () => {
    const handlers = {
      onStart: mock(() => {}),
      onQueue: mock(() => {}),
      onTable: mock(() => {}),
      onFold: mock(() => {}),
      onReject: mock(() => {}),
      onDrop: mock(() => {}),
    };
    const proposal = line({
      ref: "L-3",
      title: "Wall mount",
      state: "proposed",
      proposedBy: "panel-widgets",
      recommendation: "up_next",
      recommendationWhy: "The base is final.",
    });
    const view = render(
      <ProposalCard
        line={proposal}
        foldTargets={[line()]}
        repos={["vasc/homepanel"]}
        firstStep="land the branch"
        lastUpNext="Firmware without casts"
        now={Date.parse(proposal.createdAt) + 2 * 3_600_000}
        {...handlers}
      />,
    );
    view.getByText(/vasc\/homepanel/);
    view.getByText(/first step: land the branch/);
    view.getByText(/2h ago/);
    view.getByText("Recommended: Up next, after Firmware without casts.");
    view.getByText("The base is final.");
    // The recommended choice is the filled one.
    expect(view.getByRole("button", { name: "Up next Wall mount" }).getAttribute("data-primary")).toBe(
      "true",
    );
    fireEvent.click(view.getByRole("button", { name: "Up next Wall mount" }));
    expect(handlers.onQueue).toHaveBeenCalledWith("L-3");
    fireEvent.click(view.getByRole("button", { name: "Not a line: Wall mount" }));
    expect(handlers.onReject).toHaveBeenCalledWith("L-3");
    fireEvent.click(view.getByRole("button", { name: "Fold Wall mount" }));
    // A button per line, never a select that folds as soon as an arrow key moves it.
    expect(view.queryByRole("combobox")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Fold Wall mount into Sendspin enclosure" }));
    expect(handlers.onFold).toHaveBeenCalledWith("L-3", "L-1");
    view.unmount();
    const back = render(
      <ProposalCard
        line={line({ state: "proposed", tabledReason: "The disk is not tight", lookAgainAt: "2027-02-01" })}
        foldTargets={[]}
        {...handlers}
      />,
    );
    back.getByText("Back to look at, as you asked: The disk is not tight (2027-02-01)");
    expect(back.queryByRole("button", { name: "Not a line: Sendspin enclosure" })).toBeNull();
    fireEvent.click(back.getByRole("button", { name: "Drop Sendspin enclosure" }));
    expect(handlers.onDrop).toHaveBeenCalledWith("L-1");
    expect(handlers.onReject).toHaveBeenCalledTimes(1);
  });

  test("FoldedSection names its lines on one row and shows them only when asked", () => {
    const view = render(
      <FoldedSection
        title="Tabled"
        lines={[line({ title: "Podcast cleanup" }), line({ ref: "L-2", title: "Bike fit" })]}
      >
        <p>the rows</p>
      </FoldedSection>,
    );
    view.getByText(/Podcast cleanup, Bike fit/);
    expect(view.queryByText("the rows")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Show/ }));
    view.getByText("the rows");
  });

  test("QuietRow says why a tabled line waits and brings it back", () => {
    const onStart = mock(() => {});
    const view = render(
      <QuietRow
        line={line({ state: "tabled", tabledReason: "Not now", lookAgainAt: "2027-01-05" })}
        onStart={onStart}
      />,
    );
    view.getByText("Not now");
    view.getByText("look again 2027-01-05");
    fireEvent.click(view.getByRole("button", { name: "Start Sendspin enclosure" }));
    expect(onStart).toHaveBeenCalledWith("L-1");
  });

  test("HomeSection is a region named by its title", () => {
    render(
      <HomeSection title="Working on" count={2}>
        <p>x</p>
      </HomeSection>,
    ).getByRole("region", { name: "Working on" });
  });

  test("NewLineCard needs what it is, done when, and its repos or that it is yours, then places it", () => {
    const onAdd = mock((_line: NewLine) => {});
    const view = render(<NewLineCard repos={["OCT", "GARDEN"]} onAdd={onAdd} onCancel={() => {}} />);
    const add = view.getByRole("button", { name: "Add to up next" });
    fireEvent.change(view.getByLabelText("What it is"), { target: { value: "Garden sensor" } });
    fireEvent.change(view.getByLabelText(/Done when/), { target: { value: "Readings arrive hourly." } });
    expect(add.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Add a repo"), { target: { value: "GARDEN" } });
    view.getByRole("button", { name: "Remove GARDEN" });
    fireEvent.click(view.getByRole("button", { name: "Start" }));
    expect(onAdd).toHaveBeenCalledWith({
      title: "Garden sensor",
      doneWhen: "Readings arrive hourly.",
      repos: ["GARDEN"],
      where: "working",
    });
    fireEvent.click(view.getByRole("checkbox", { name: "None: it is mine" }));
    fireEvent.click(add);
    expect(onAdd).toHaveBeenLastCalledWith({
      title: "Garden sensor",
      doneWhen: "Readings arrive hourly.",
      repos: [],
      where: "up_next",
    });
  });
});

describe("a line opened", () => {
  test("LinePanelHead says where the line sits, its ref and repos, and what finishes it", () => {
    const view = render(
      <LinePanelHead line={line({ ref: "L-7" })} position="Line 2 of 5" repos={["vasc/homepanel"]} />,
    );
    view.getByText(/Line 2 of 5/);
    view.getByText("vasc/homepanel");
    view.getByRole("heading", { name: "Sendspin enclosure" });
    view.getByText("A printed case holds the board and takes the USB-C plug.");
    view.getByRole("button", { name: "Close" });
  });

  test("SummaryBox puts the headline first, says it stands alone, and says when there is none", () => {
    const view = render(
      <SummaryBox
        line={line({
          headline: "Printed; it fits.",
          summary: "The base is printed.",
          summaryAt: "2026-11-14T09:40:00Z",
        })}
        owner="panel"
      />,
    );
    view.getByText("Printed; it fits.");
    view.getByText(/home, the log and the phone show only this/);
    view.getByText(/panel keeps it/);
    view.unmount();
    render(<SummaryBox line={line()} owner="panel" />).getByText("none yet; panel writes it");
  });

  test("PlanList marks each step done, now or next, with its issues and their pull requests' checks", () => {
    const view = render(
      <PlanList
        steps={[
          { line: "L-1", position: 1, title: "Model", status: "done" },
          { line: "L-1", position: 2, title: "Print", status: "todo" },
          { line: "L-1", position: 3, title: "Photograph", status: "todo" },
        ]}
        work={[
          {
            ref: "OCT-6",
            title: "Test-print",
            status: "in_progress",
            step: 2,
            assignee: "panel",
            prs: [{ ref: "PR-1", repo: "vasc/homepanel", number: 14, state: "open", checks: "failing" }],
          },
        ]}
      />,
    );
    view.getByRole("heading", { name: "Plan · step 2 of 3" });
    expect(view.getAllByRole("listitem").map((item) => item.getAttribute("data-state"))).toEqual([
      "done",
      "now",
      "next",
    ]);
    view.getByRole("button", { name: "OCT-6" });
    expect(view.getByText(/checks failing/).getAttribute("data-checks")).toBe("failing");
  });

  test("OwnerBox says how its owner keeps the line, in E-Line's words", () => {
    const crew = (state: "asleep" | "running" | "quiet"): LineCrew => ({
      owner: { name: "panel-widgets", state },
      helpers: [],
      scoper: null,
      search: null,
    });
    const props = { line: line(), repos: ["OCT"], onStop: () => {}, onOwn: () => {}, onHand: () => {} };
    const asleep = render(<OwnerBox {...props} crew={crew("asleep")} waitingOnYou />);
    asleep.getByText(
      whole(
        "panel-widgets writes the summary and hears what you tell it. All the line's open work waits on you, and it left a wake address, so it keeps the line while it sleeps and is woken by what you send. Helpers may work under it, never writing the summary; none now.",
      ),
    );
    asleep.unmount();
    render(<OwnerBox {...props} crew={crew("running")} waitingOnYou={false} />).getByText(/is running now/);
    // With no owner: still being looked for, or why none can be found, as Step in says.
    render(<OwnerBox {...props} crew={undefined} />).getByText(
      "No agent owns it yet. Octotrack is looking for one.",
    );
    render(<OwnerBox {...props} crew={undefined} stepIn="It names no repo to work in." />).getByText(
      "No agent owns it yet, and none can be found: It names no repo to work in.",
    );
  });

  test("OwnerBox offers Stop on the owner and I'll own it, or Hand to an agent on a line of yours", () => {
    const onStop = mock((_name: string) => {});
    const onHand = mock((_repos: string[]) => {});
    const crew: LineCrew = {
      owner: { name: "panel", state: "asleep" },
      helpers: [],
      scoper: null,
      search: null,
    };
    const view = render(
      <OwnerBox line={line()} crew={crew} repos={["OCT"]} onStop={onStop} onOwn={() => {}} onHand={onHand} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Stop panel" }));
    expect(onStop).toHaveBeenCalledWith("panel");
    view.getByRole("button", { name: "I'll own it" });
    view.unmount();
    const mine = render(
      <OwnerBox
        line={line({ ownedBy: "dev", repos: [] })}
        crew={undefined}
        repos={["OCT"]}
        onStop={onStop}
        onOwn={() => {}}
        onHand={onHand}
      />,
    );
    fireEvent.click(mine.getByRole("button", { name: "Hand to an agent" }));
    fireEvent.click(mine.getByRole("checkbox", { name: "OCT" }));
    fireEvent.click(mine.getByRole("button", { name: "Hand over" }));
    expect(onHand).toHaveBeenCalledWith(["OCT"]);
  });
});

describe("written text", () => {
  test("Markdown renders what agents write, and never renders HTML in it", async () => {
    const view = render(
      <Markdown
        text={"## Where it stands\n\n- printed\n- **fits**\n\n<img src=x onerror=alert(1)>\n\n`octo lines`"}
      />,
    );
    await view.findByRole("heading", { name: "Where it stands" });
    expect(view.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["printed", "fits"]);
    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.querySelector("code")?.textContent).toBe("octo lines");
  });

  test("TextBox reports what is typed, and sends on Cmd+Enter", () => {
    const onChange = mock((_value: string) => {});
    const onSubmit = mock(() => {});
    const view = render(<TextBox label="Note" value="" onChange={onChange} onSubmit={onSubmit} />);
    const box = view.getByLabelText("Note");
    fireEvent.change(box, { target: { value: "line one\nline two" } });
    expect(onChange).toHaveBeenCalledWith("line one\nline two");
    fireEvent.keyDown(box, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("UndoBar", () => {
  const NOW = Date.parse("2026-11-14T09:00:00.000Z");
  const due = (seconds: number) => new Date(NOW + seconds * 1000).toISOString();

  test("says each waiting choice and when it takes effect, newest first, with Undo, and u for the newest", () => {
    const onUndo = mock((_id: number) => {});
    const view = render(
      <UndoBar
        now={NOW}
        lines={{}}
        pending={[
          pendingChoice({ id: 1, summary: "Starting Wall mount", dueAt: due(1) }),
          pendingChoice({ id: 2, summary: 'Sending "26 mm" to Sendspin enclosure', dueAt: due(8) }),
        ]}
        onUndo={onUndo}
      />,
    );
    view.getByText(whole('Sending "26 mm" to Sendspin enclosure in 8 seconds'));
    view.getByText(whole("Starting Wall mount in 1 second"));
    view.getByText("u to undo");
    expect(view.queryByRole("button", { name: "Now" })).toBeNull();
    fireEvent.click(view.getAllByRole("button", { name: "Undo" })[0] ?? document.body);
    expect(onUndo).toHaveBeenCalledWith(2);
  });

  test("a Stop of a line's owner says what happens to the line, and offers to pause the line instead", () => {
    const onPause = mock((_id: number, _line: string) => {});
    const stop = pendingChoice({
      id: 3,
      op: "agent.stop",
      summary: "Stopping panel-widgets",
      line: "L-7",
      dueAt: due(8),
    });
    const waits = render(
      <UndoBar
        now={NOW}
        lines={{ "L-7": { title: "Sendspin enclosure", waitsOnYou: true } }}
        pending={[stop]}
        onUndo={() => {}}
        onPause={onPause}
      />,
    );
    waits.getByText(
      whole(
        "Stopping panel-widgets in 8 seconds. Sendspin enclosure waits on you, so no new session starts until you answer.",
      ),
    );
    fireEvent.click(waits.getByRole("button", { name: "Pause the line instead" }));
    expect(onPause).toHaveBeenCalledWith(3, "L-7");
    waits.unmount();
    render(
      <UndoBar
        now={NOW}
        lines={{ "L-7": { title: "Sendspin enclosure", waitsOnYou: false } }}
        pending={[stop]}
        onUndo={() => {}}
      />,
    ).getByText(
      whole("Stopping panel-widgets in 8 seconds. Sendspin enclosure then looks for another owner."),
    );
  });

  test("a choice that failed says why until dismissed", () => {
    const onUndo = mock((_id: number) => {});
    const view = render(
      <UndoBar
        now={NOW}
        lines={{}}
        pending={[
          pendingChoice({ id: 4, summary: "Starting Wall mount", state: "failed", error: "It is done." }),
        ]}
        onUndo={onUndo}
      />,
    );
    expect(view.getByRole("alert").textContent).toBe("Starting Wall mount did not happen: It is done.");
    fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
    expect(onUndo).toHaveBeenCalledWith(4);
  });
});

describe("agents and first run", () => {
  const agent = (overrides: Partial<AgentView> = {}): AgentView => ({
    name: "panel",
    note: null,
    firstSeenAt: "2026-11-14T09:00:00.000Z",
    lastSeenAt: "2026-11-14T09:00:00.000Z",
    checkout: "/src/panel",
    repo: "PANEL",
    wakeAddress: "claude:abc",
    startedBy: null,
    stoppedAt: null,
    stoppedReason: null,
    goneAt: null,
    wokenAt: null,
    wakeError: null,
    state: "asleep",
    line: "L-2",
    role: "owner",
    lastLine: null,
    start: null,
    ...overrides,
  });

  test("AgentRosterRow shows a session started for a line that never ran a command, as E-Agents does", () => {
    const now = Date.parse("2026-11-14T12:00:00.000Z");
    const view = render(
      <table>
        <tbody>
          <AgentRosterRow
            agent={agent({
              name: "trips.2",
              line: null,
              role: null,
              wakeAddress: null,
              startedBy: "octotrack",
              state: "gone",
              start: {
                line: "L-9",
                state: "failed",
                attempts: 3,
                since: "2026-11-10T09:00:00.000Z",
                exitCode: 1,
              },
            })}
            lineTitle="South Tyrol trip"
            now={now}
            onStop={() => {}}
            onLift={() => {}}
            onRelease={() => {}}
          />
        </tbody>
      </table>,
    );
    const row = within(view.getByRole("row", { name: "trips.2" }));
    row.getByRole("button", { name: "L-9" });
    row.getByText(/South Tyrol trip/);
    row.getByText(/, started for it/);
    row.getByText("never");
    row.getByText("retried since Tuesday, each exits at once (exit 1)");
  });

  test("AgentRosterRow names the line a gone agent last owned", () => {
    const view = render(
      <table>
        <tbody>
          <AgentRosterRow
            agent={agent({ name: "roadtrip", line: null, role: null, state: "gone", lastLine: "L-9" })}
            lineTitle="South Tyrol trip"
            onStop={() => {}}
            onLift={() => {}}
            onRelease={() => {}}
          />
        </tbody>
      </table>,
    );
    const row = within(view.getByRole("row", { name: "roadtrip" }));
    row.getByRole("button", { name: "L-9" });
    row.getByText(/, last owner/);
  });

  test("AgentRosterRow says where an agent is and how to reach it, and offers Stop or Lift", () => {
    const onStop = mock((_name: string) => {});
    const onLift = mock((_name: string) => {});
    const row = (element: React.ReactNode) =>
      render(
        <table>
          <tbody>{element}</tbody>
        </table>,
      );
    const view = row(
      <AgentRosterRow
        agent={agent()}
        repo="vasc/homepanel"
        onStop={onStop}
        onLift={onLift}
        onRelease={() => {}}
      />,
    );
    view.getByText("vasc/homepanel");
    view.getByText("claude");
    view.getByText(", owner");
    view.getByText("asleep, on its line");
    expect(view.queryByRole("button", { name: "Release panel" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Stop panel" }));
    expect(onStop).toHaveBeenCalledWith("panel");
    view.unmount();
    const stopped = row(
      <AgentRosterRow
        agent={agent({ state: "stopped", stoppedReason: "Wrong repo", line: null, role: null })}
        onStop={onStop}
        onLift={onLift}
        onRelease={() => {}}
      />,
    );
    stopped.getByText("stopped: Wrong repo");
    fireEvent.click(stopped.getByRole("button", { name: "Lift panel" }));
    expect(onLift).toHaveBeenCalledWith("panel");
  });

  test("AgentRosterRow names the line, says when it waits on the developer, and shows the agent's own note", () => {
    const view = render(
      <table>
        <tbody>
          <AgentRosterRow
            agent={agent({ state: "running", note: "Printing the base" })}
            lineTitle="Sendspin enclosure"
            waitsOnYou
            onStop={() => {}}
            onLift={() => {}}
            onRelease={() => {}}
          />
        </tbody>
      </table>,
    );
    view.getByText("Sendspin enclosure");
    view.getByText("running; its line waits on you");
    view.getByText("Printing the base");
  });

  test("AgentRosterRow offers Release on a quiet agent that still holds a line", () => {
    const onRelease = mock((_name: string) => {});
    const view = render(
      <table>
        <tbody>
          <AgentRosterRow
            agent={agent({ state: "quiet" })}
            onStop={() => {}}
            onLift={() => {}}
            onRelease={onRelease}
          />
        </tbody>
      </table>,
    );
    fireEvent.click(view.getByRole("button", { name: "Release panel from L-2" }));
    expect(onRelease).toHaveBeenCalledWith("panel");
  });

  test("FirstRun accepts every recommended placement it can, and says how to start with none", () => {
    const onAccept = mock((_refs: string[]) => {});
    const view = render(
      <FirstRun
        proposals={[
          line({ ref: "L-1", state: "proposed", recommendation: "up_next" }),
          line({ ref: "L-2", state: "proposed", recommendation: "fold" }),
          line({ ref: "L-3", state: "proposed", recommendation: "start" }),
        ]}
        repos={15}
        onAccept={onAccept}
      />,
    );
    view.getByText(/^Your 15 repos have no lines yet\. Agents with each repo propose real lines/);
    fireEvent.click(view.getByRole("button", { name: "Accept recommended placements" }));
    expect(onAccept).toHaveBeenCalledWith(["L-1", "L-3"]);
    view.getByText("with Undo");
    view.unmount();
    render(<FirstRun proposals={[]} repos={0} onAccept={onAccept} />).getByText("octo guide");
  });
});

describe("PushToggle, failing", () => {
  test("announces why buzzing could not be turned on", () => {
    const view = render(<PushToggle state="off" error="Permission denied" onTurnOn={() => {}} />);
    expect(view.getByRole("alert").textContent).toBe("Permission denied");
  });
});

describe("PushToggle", () => {
  test("offers to buzz this device until it does, says when it does or cannot, and hides where there is no push", () => {
    const onTurnOn = mock(() => {});
    const off = render(<PushToggle state="off" error={null} onTurnOn={onTurnOn} />);
    fireEvent.click(off.getByRole("button", { name: "Buzz this device" }));
    expect(onTurnOn).toHaveBeenCalledTimes(1);
    off.unmount();
    render(<PushToggle state="on" error={null} onTurnOn={onTurnOn} />).getByText(
      "Buzzing this device for urgent questions and the top two lines",
    );
    const none = render(<PushToggle state="unsupported" error={null} onTurnOn={onTurnOn} />);
    expect(none.container.textContent).toBe("");
  });
});

describe("UndoBar when a choice failed", () => {
  test("says why, as an alert, and offers only Dismiss", () => {
    const onUndo = mock((_id: number) => {});
    const view = render(
      <UndoBar
        pending={[
          pendingChoice({
            id: 4,
            op: "decision.resolve",
            ref: "D-3",
            summary: "Answered D-3: Redis",
            state: "failed",
            error: 'D-3 has no option "redis"',
          }),
        ]}
        now={0}
        lines={{}}
        onUndo={onUndo}
      />,
    );
    expect(view.getByRole("alert").textContent).toContain('no option "redis"');
    expect(view.queryByRole("button", { name: "Now" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
    expect(onUndo).toHaveBeenCalledWith(4);
  });
});

describe("tabling and a line's own choices", () => {
  test("TableForm will not table without a reason, and sends it trimmed", () => {
    const onTable = mock((_reason: string, _lookAgainAt: string | null) => {});
    const onCancel = mock(() => {});
    const view = render(<TableForm title="Trip" onTable={onTable} onCancel={onCancel} />);
    const table = view.getByRole("button", { name: "Table it" });
    expect(table.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Why table Trip"), { target: { value: "  After the move  " } });
    fireEvent.click(table);
    expect(onTable).toHaveBeenCalledWith("After the move", null);
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("TableForm says what tabling does to what the line holds and to its agents, and when it comes back", () => {
    const view = render(
      <TableForm
        title="Podcast cleanup"
        held={{ questions: 2, tasks: 0 }}
        owner="mediarr"
        onTable={() => {}}
        onCancel={() => {}}
      />,
    );
    view.getByRole("heading", { name: "Table Podcast cleanup" });
    expect(document.activeElement).toBe(view.getByLabelText("Why table Podcast cleanup"));
    view.getByText(
      /^Its 2 questions are held, and so is its drift\. mediarr and any helpers are told to wind down/,
    );
    fireEvent.change(view.getByLabelText("Look again on"), { target: { value: "2027-02-01" } });
    view.getByText(
      /^On 2027-02-01 it comes back under Proposed, counted in "to accept", with your reason beside it/,
    );
  });

  test("LineActions offers the moves each state allows, the rare ones under More, and asks before Done", () => {
    const onChoose = mock((_choice: string) => {});
    const props = { onChoose, onTable: () => {} };
    const names = (view: ReturnType<typeof render>) =>
      view.getAllByRole("button").map((button) => button.textContent);
    const working = render(<LineActions line={line()} owner="panel" {...props} />);
    working.getByText("Working on");
    expect(names(working)).toEqual(["Move to up next", "Table", "Done", "More"]);
    working.getByText(/give panel 15 minutes to wind down/);
    fireEvent.click(working.getByRole("button", { name: "Done" }));
    fireEvent.click(working.getByRole("button", { name: "Done" }));
    expect(onChoose).toHaveBeenCalledWith("done");
    fireEvent.click(working.getByRole("button", { name: "More: drop this line, fold it into another" }));
    fireEvent.click(working.getByRole("button", { name: "Drop" }));
    expect(onChoose).toHaveBeenCalledWith("drop");
    working.unmount();
    const onFoldWorking = mock((_into: string) => {});
    const folding = render(
      <LineActions
        line={line()}
        foldTargets={[line({ ref: "L-2", title: "Mount" })]}
        onFold={onFoldWorking}
        {...props}
      />,
    );
    fireEvent.click(folding.getByRole("button", { name: "More: drop this line, fold it into another" }));
    fireEvent.click(folding.getByRole("button", { name: "Fold into another" }));
    fireEvent.click(folding.getByRole("button", { name: "Fold Sendspin enclosure into Mount" }));
    expect(onFoldWorking).toHaveBeenCalledWith("L-2");
    folding.unmount();
    const onFold = mock((_into: string) => {});
    const proposed = render(
      <LineActions
        line={line({ state: "proposed" })}
        foldTargets={[line({ ref: "L-2", title: "Mount" })]}
        onFold={onFold}
        {...props}
      />,
    );
    expect(names(proposed)).toEqual(["Start", "Up next", "Table", "Fold into", "Not a line"]);
    fireEvent.click(proposed.getByRole("button", { name: "Fold into" }));
    fireEvent.click(proposed.getByRole("button", { name: "Fold Sendspin enclosure into Mount" }));
    expect(onFold).toHaveBeenCalledWith("L-2");
    proposed.unmount();
    const done = render(<LineActions line={line({ state: "done" })} {...props} />);
    expect(done.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("LineProposalCard", () => {
  test("a case for done says which done when it meets and why, then Done or Not yet with what is missing", () => {
    const onAccept = mock(() => {});
    const onDecline = mock((_why: string) => {});
    const view = render(
      <LineProposalCard
        proposal={{
          kind: "done",
          line: "L-12",
          text: "The owner was woken from the inbox and reported it carried out.",
          by: "octotrack-builder",
          doneWhen: "an answer reaches whoever owns its line",
        }}
        title="Answer delivery"
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );
    view.getByText("Proposed as done · octotrack-builder");
    view.getByText(whole('Done when "an answer reaches whoever owns its line": met.'));
    view.getByText("The owner was woken from the inbox and reported it carried out.");
    fireEvent.click(view.getByRole("button", { name: "Not yet" }));
    fireEvent.change(view.getByLabelText("What L-12 still needs"), { target: { value: "One real wake" } });
    fireEvent.click(view.getByRole("button", { name: "Not yet" }));
    expect(onDecline).toHaveBeenCalledWith("One real wake");
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("a changed done when quotes the old and the new, with why; Keep current keeps the old at once", () => {
    const onDecline = mock((_why: string) => {});
    const view = render(
      <LineProposalCard
        proposal={{
          kind: "done_when",
          line: "L-4",
          text: "…on, and CI fails on a new cast",
          by: "firmware",
          was: "the panel firmware builds with the no-casts rule on",
          why: "without CI, casts creep back.",
        }}
        title="Firmware without casts"
        onAccept={() => {}}
        onDecline={onDecline}
      />,
    );
    view.getByText("Done when changed · firmware");
    view.getByText(
      whole(
        '"the panel firmware builds with the no-casts rule on" became "…on, and CI fails on a new cast". Why: without CI, casts creep back.',
      ),
    );
    expect(view.getByRole("button", { name: "Accept" }).getAttribute("data-choice")).toBe("1");
    fireEvent.click(view.getByRole("button", { name: "Keep current" }));
    expect(onDecline).toHaveBeenCalledWith("");
  });
});

describe("a question's own choices", () => {
  test("an urgent question says so, why, and which line it stands apart from, in red", () => {
    const view = render(
      <DecisionCardView
        form={decisionForm()}
        card={decisionCard({ decision: decision({ ref: "D-60", urgentReason: "broken" }) })}
        line={{ ref: "L-5", number: 3, title: "Quiet household trial" }}
        selected
      />,
    );
    const article = view.getByRole("article");
    expect(article.getAttribute("data-urgent")).toBe("true");
    const strip = article.querySelector(".question-strip")?.textContent ?? "";
    expect(strip).toContain("Focused");
    expect(strip).toContain("Urgent");
    expect(strip).toContain("Something broken");
    expect(strip).toContain("3 · Quiet household trial · D-60");
  });

  test("ForYouRow marks an urgent question red, with its reason", () => {
    const view = render(
      <ForYouRow
        item={{
          kind: "question",
          card: decisionCard({ decision: decision({ ref: "D-60", urgentReason: "time_boxed" }) }),
        }}
        onOpen={() => {}}
      />,
    );
    const row = view.getByRole("button", { name: "Open D-60" });
    expect(row.getAttribute("data-urgent")).toBe("true");
    expect(row.textContent).toContain("Urgent · time-boxed · D-60");
  });

  test("Later moves it to the bottom of its line; Not urgent shows only on an urgent question", () => {
    const later = mock(() => {});
    const notUrgent = mock(() => {});
    const plain = render(
      <DecisionCardView form={decisionForm({ postpone: later, notUrgent })} card={decisionCard()} />,
    );
    fireEvent.click(plain.getByRole("button", { name: "Later" }));
    expect(later).toHaveBeenCalledTimes(1);
    expect(plain.queryByRole("button", { name: "Not urgent" })).toBeNull();
    plain.unmount();
    const urgent = render(
      <DecisionCardView
        form={decisionForm({ postpone: later, notUrgent })}
        card={decisionCard({ decision: decision({ urgentReason: "costs_money" }) })}
      />,
    );
    fireEvent.click(urgent.getByRole("button", { name: "Not urgent" }));
    expect(notUrgent).toHaveBeenCalledTimes(1);
  });
});

describe("saying something to a line", () => {
  test("TellBox names who it reaches, and sends nothing typed as a nudge", () => {
    const onSend = mock((_words: string) => {});
    const nobody = render(<TellBox line="L-1" to={null} words="" onWords={() => {}} onSend={onSend} />);
    nobody.getByLabelText("Message to whoever takes L-1");
    fireEvent.click(nobody.getByRole("button", { name: "Nudge" }));
    expect(onSend).toHaveBeenCalledWith("");
    nobody.unmount();
    const owner = render(
      <TellBox line="L-1" to="octo.1" words=" Black " onWords={() => {}} onSend={onSend} />,
    );
    owner.getByRole("heading", { name: "Tell octo.1" });
    fireEvent.click(owner.getByRole("button", { name: "Tell" }));
    expect(onSend).toHaveBeenCalledWith("Black");
  });

  test("OwnWorkBox adds what is typed as a task or a note, and nothing when empty", () => {
    const onTask = mock((_title: string) => {});
    const onNote = mock((_body: string) => {});
    const empty = render(
      <OwnWorkBox line="L-2" words="" onWords={() => {}} onTask={onTask} onNote={onNote} />,
    );
    expect(empty.getByRole("button", { name: "Add as a task" }).hasAttribute("disabled")).toBe(true);
    empty.unmount();
    const typed = render(
      <OwnWorkBox line="L-2" words="Scan receipts" onWords={() => {}} onTask={onTask} onNote={onNote} />,
    );
    fireEvent.click(typed.getByRole("button", { name: "Add as a note" }));
    expect(onNote).toHaveBeenCalledWith("Scan receipts");
  });

  test("TableForm sends a look-again date when one is given", () => {
    const onTable = mock((_reason: string, _lookAgainAt: string | null) => {});
    const view = render(<TableForm title="Trip" onTable={onTable} onCancel={() => {}} />);
    fireEvent.change(view.getByLabelText("Why table Trip"), { target: { value: "Winter" } });
    fireEvent.change(view.getByLabelText("Look again on"), { target: { value: "2027-03-01" } });
    fireEvent.click(view.getByRole("button", { name: "Table it" }));
    expect(onTable).toHaveBeenCalledWith("Winter", "2027-03-01");
  });
});

describe("I'm at a place", () => {
  test("AtSection says everything else is folded and when it ends by itself, with Leave", () => {
    const onLeave = mock(() => {});
    const now = Date.parse("2026-11-14T09:00:00.000Z");
    const view = render(
      <AtSection
        at={{ place: "the bench", until: "2026-11-14T13:00:00.000Z", tasks: [] }}
        now={now}
        onLeave={onLeave}
      />,
    );
    view.getByRole("heading", { name: "At the bench." });
    view.getByText("Everything else is folded. Ends by itself in 4 hours.");
    fireEvent.click(view.getByRole("button", { name: "Leave" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  test("foldedText counts what a folded line holds, tasks by their place", () => {
    const task = (ref: string, place: string | null) => ({
      kind: "task" as const,
      task: issue({ ref, place }),
      frees: null,
    });
    expect(
      foldedText([
        { kind: "question", card: decisionCard() },
        task("PANEL-1", "the Mac"),
        task("PANEL-2", "the Mac"),
        task("PANEL-3", null),
      ]),
    ).toBe("1 question · 2 tasks at the Mac · 1 task");
  });
});

describe("KeyHelp and ForYouItem", () => {
  test("KeyHelp lists every key in the board's words, and closes", () => {
    const onClose = mock(() => {});
    const view = render(<KeyHelp onClose={onClose} />);
    const keys = view.getAllByRole("term").map((term) => term.textContent);
    expect(keys).toEqual(HOME_KEYS.map(([key]) => key));
    expect(keys).toContain("w");
    expect(keys).toContain("g p");
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("ForYouItem is one row until it has focus, then the item itself", () => {
    const item = {
      kind: "question" as const,
      card: decisionCard({ decision: decision({ ref: "D-7", title: "Which?" }) }),
    };
    const props = {
      item,
      title: "Enclosure",
      armed: true,
      onOpen: () => {},
      onTaskDone: () => {},
      onTaskCant: () => {},
      onLineDone: () => {},
      onNotYet: () => {},
      onDoneWhen: () => {},
    };
    const row = render(<ForYouItem {...props} focused={false} />);
    row.getByRole("button", { name: "Open D-7" });
    expect(row.queryByRole("article")).toBeNull();
    row.unmount();
  });
});

describe("NothingNeedsYou", () => {
  test("is the calm state: says nothing needs you, who is working, and where the next ask likely comes from", () => {
    const view = render(
      <NothingNeedsYou working={3} next={{ title: "Sendspin enclosure", step: "model the opening" }} />,
    );
    view.getByRole("heading", { name: "Nothing needs you." });
    view.getByText(
      "Three agents are working. The likely next ask is on Sendspin enclosure, at its step: model the opening.",
    );
  });

  test("says so plainly when no agent is working and no line has a next step", () => {
    const view = render(<NothingNeedsYou working={0} next={null} />);
    view.getByText("No agent is working right now.");
  });
});

describe("home's smaller pieces", () => {
  test("SpreadThin says nothing up to six working lines, then what spreading thin costs, in the header", () => {
    expect(render(<SpreadThin working={6} noOwner={3} waiting={2} />).container.textContent).toBe("");
    const view = render(<SpreadThin working={9} noOwner={3} waiting={2} />);
    view.getByText("3 with no owner");
    view.getByText("2 waiting on you");
    expect(view.getByText("3 with no owner").getAttribute("data-tone")).toBe("bad");
    view.getByLabelText(/^9 lines are being worked on: 3 with no owner, 2 waiting on you/);
  });

  test("StartSheetView settles a changed done when and a held question before Start, numbering every choice", () => {
    const onStart = mock(() => {});
    const onDoneWhen = mock((_accept: boolean) => {});
    const onAnswer = mock((_ref: string, _key: string, _label: string) => {});
    const question = decision({
      ref: "D-4",
      title: "Checked conversions, or typed helpers?",
      context: "Checked conversions are quicker; helpers take a day.",
      options: [
        { key: "a", label: "Checked conversions", description: "Stops at the first bad value." },
        { key: "b", label: "Typed helpers", description: "Short call sites." },
      ],
      recommendation: "a",
      recommendationWhy: "a bad value should fail loudly.",
    });
    const view = render(
      <StartSheetView
        line={line({
          title: "Firmware without casts",
          doneWhen: "it builds with the no-casts rule on",
          doneWhenProposal: "…on, and CI fails on a new cast",
          doneWhenWhy: "without CI, casts creep back.",
        })}
        held={[
          { ref: "D-4", kind: "question", title: question.title, line: "L-1", current: true, since: "" },
          { ref: "PANEL-9", kind: "task", title: "Measure the studs", line: "L-1", current: true, since: "" },
        ]}
        questions={[question]}
        onDoneWhen={onDoneWhen}
        onAnswer={onAnswer}
        onStart={onStart}
        onCancel={() => {}}
      />,
    );
    view.getByRole("dialog", { name: "Start Firmware without casts" });
    view.getByRole("heading", { name: "Start Firmware without casts" });
    view.getByText(
      whole(
        '"it builds with the no-casts rule on" became "…on, and CI fails on a new cast". Why: without CI, casts creep back.',
      ),
    );
    const numbers = view.getAllByRole("button").flatMap((button) => {
      const number = button.getAttribute("data-choice");
      return number === null ? [] : [[number, button.textContent]];
    });
    expect(numbers).toEqual([
      ["1", "Accept"],
      ["2", "Keep current"],
      ["3", "Checked conversions · recommended"],
      ["4", "Typed helpers"],
    ]);
    view.getByText(whole("Why 3: a bad value should fail loudly."));
    view.getByText("Measure the studs");
    fireEvent.click(view.getByRole("button", { name: "Keep current" }));
    expect(onDoneWhen).toHaveBeenCalledWith(false);
    fireEvent.click(view.getByRole("button", { name: "Typed helpers" }));
    expect(onAnswer).toHaveBeenCalledWith("D-4", "b", "Typed helpers");
    fireEvent.click(view.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test("StepIn offers the action that fits: a checkout, Try now, or Start one anyway", () => {
    const onCheckout = mock((_ref: string, _repo: string, _path: string) => {});
    const onAnyway = mock((_ref: string) => {});
    const clone = render(
      <StepIn
        line={line()}
        reason="Cloning failed."
        checkoutRepo="PANEL"
        onCheckout={onCheckout}
        onOwn={() => {}}
        onTable={() => {}}
      />,
    );
    fireEvent.click(clone.getByRole("button", { name: "Set its checkout" }));
    fireEvent.change(clone.getByLabelText("Checkout of PANEL"), { target: { value: "/src/panel" } });
    fireEvent.click(clone.getByRole("button", { name: "Set" }));
    expect(onCheckout).toHaveBeenCalledWith("L-1", "PANEL", "/src/panel");
    clone.unmount();
    const cap = render(
      <StepIn line={line()} reason="At the cap." onAnyway={onAnyway} onOwn={() => {}} onTable={() => {}} />,
    );
    fireEvent.click(cap.getByRole("button", { name: "Start one anyway" }));
    expect(onAnyway).toHaveBeenCalledWith("L-1");
    expect(cap.queryByRole("button", { name: "Try now" })).toBeNull();
  });
});

describe("LineHandle", () => {
  test("is the one way to reorder: drag it, or open it for Top, Up, Down and To up next", () => {
    const onMove = mock((_direction: string) => {});
    const view = render(<LineHandle title="One" canMoveUp canMoveDown canQueue onMove={onMove} />);
    const handle = view.getByRole("button", { name: "Move One" });
    expect(handle.getAttribute("draggable")).toBe("true");
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(handle);
    const menu = within(view.getByRole("menu", { name: "Move One" }));
    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Move to top",
      "Up",
      "Down",
      "To up next",
    ]);
    fireEvent.click(menu.getByRole("menuitem", { name: "To up next" }));
    expect(onMove.mock.calls).toEqual([["up_next"]]);
    expect(view.queryByRole("menu")).toBeNull();
  });

  test("opened, its first item takes the cursor and the arrows move through the items", () => {
    const view = render(<LineHandle title="One" canMoveUp canMoveDown canQueue onMove={() => {}} />);
    fireEvent.click(view.getByRole("button", { name: "Move One" }));
    const menu = view.getByRole("menu");
    expect(document.activeElement?.textContent).toBe("Move to top");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Up");
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement?.textContent).toBe("To up next");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Move One" }));
  });

  test("cannot move past either end, and Escape closes it", () => {
    const view = render(<LineHandle title="One" canMoveUp={false} canMoveDown onMove={() => {}} />);
    fireEvent.click(view.getByRole("button", { name: "Move One" }));
    expect(view.getByRole("menuitem", { name: "Up" }).hasAttribute("disabled")).toBe(true);
    expect(view.queryByRole("menuitem", { name: "To up next" })).toBeNull();
    fireEvent.keyDown(view.getByRole("menu"), { key: "Escape" });
    expect(view.queryByRole("menu")).toBeNull();
  });
});

describe("answers on their line", () => {
  const answer = (overrides: Partial<LineHome["answers"][number]>): LineHome["answers"][number] => ({
    ref: "D-34",
    title: "Which board?",
    answer: "26 mm",
    status: "not_picked_up",
    by: null,
    at: null,
    note: null,
    unwoken: null,
    ...overrides,
  });

  test("AnswerStatus says what became of an answer in one sentence, as E-States writes it", () => {
    const sentence = (item: LineHome["answers"][number]) => {
      const view = render(<AnswerStatus answer={item} />);
      const text = view.container.querySelector(".line-answer-text")?.textContent;
      view.unmount();
      return text;
    };
    expect(sentence(answer({}))).toBe("D-34 answered: 26 mm · not picked up yet");
    expect(
      sentence(
        answer({
          status: "picked_up",
          by: "panel-widgets",
          at: new Date(Date.now() - 4 * 60_000).toISOString(),
        }),
      ),
    ).toBe("D-34 answered: 26 mm · picked up by panel-widgets, 4m");
    expect(sentence(answer({ status: "carried_out", note: "model set to the short board" }))).toBe(
      "D-34 answered: 26 mm · ✓ carried out: model set to the short board",
    );
    expect(sentence(answer({ status: "wake_failed", unwoken: "panel-widgets" }))).toBe(
      "D-34 answered: 26 mm · panel-widgets could not be woken; finding an owner",
    );
  });

  test("AnswerStatus offers Change answer, which opens the question", () => {
    const view = render(<AnswerStatus answer={answer({ status: "carried_out" })} />);
    view.getByRole("button", { name: "Change answer D-34" });
  });

  test("WorkingLine shows each answer given lately", () => {
    const view = render(
      <WorkingLine
        index={1}
        line={line()}
        details={{
          start: null,
          step: null,
          forYou: [],
          stepIn: false,
          stepInReason: null,
          stepInKind: null,
          waitingOnYou: false,
          held: { questions: 0, tasks: 0 },
          reconfirming: 0,
          sinceSummary: 0,
          scopedSteps: 0,
          answers: [answer({}), answer({ ref: "D-2", answer: "USB-C", status: "carried_out" })],
        }}
      />,
    );
    expect(view.container.querySelectorAll(".line-answer")).toHaveLength(2);
  });
});

describe("UnseenLog", () => {
  const working = line({ ref: "L-1", title: "Enclosure", state: "working" });
  const queued = line({ ref: "L-2", title: "Mount", state: "up_next" });
  const at = (seq: number, overrides: Parameters<typeof event>[0]) => event({ seq, ...overrides });
  const events = [
    at(5, { line: "L-2", type: "line.plan_set", summary: "Plan set" }),
    at(4, { line: "L-1", type: "pr.checks_changed", summary: "Checks failing" }),
    at(3, { line: "L-1", type: "pr.checks_changed", summary: "Checks passing" }),
    at(2, { line: "L-1", type: "issue.created", summary: "OCT-3 created: Base" }),
    at(6, { line: "L-1", type: "held.confirmed", summary: "D-4 re-confirmed" }),
    at(1, { line: "L-2", type: "write.refused", summary: "panel was refused a write on L-2" }),
  ];

  test("drops nothing: a proposal, a line just done and a line it does not know each show; late pull requests go to the top", () => {
    const proposed = line({ ref: "L-3", title: "Wall mount", state: "proposed" });
    const done = line({ ref: "L-4", title: "Seerr", state: "done" });
    const view = render(
      <UnseenLog
        events={[
          at(10, { line: "L-3", type: "line.proposed", summary: "L-3 proposed: Wall mount" }),
          at(11, { line: "L-4", type: "line.summarized", summary: "L-4: finished and in use" }),
          at(12, { line: "L-9", type: "issue.created", summary: "OCT-9 created on a line gone from home" }),
          at(13, {
            line: "L-2",
            type: "pr.after_wind_down",
            summary: "PR-4 opened on L-2 after it was tabled",
          }),
        ]}
        lines={[working, queued, proposed, done]}
        includeWaiting={false}
        onShowWaiting={() => {}}
      />,
    );
    within(view.getByRole("list", { name: "Rule breaks" })).getByText(/opened on L-2 after it was tabled/);
    within(view.getByRole("article", { name: "Wall mount" })).getByText(/proposed: Wall mount/);
    within(view.getByRole("article", { name: "Seerr" })).getByText(/finished and in use/);
    within(view.getByRole("article", { name: "Elsewhere" })).getByText(/gone from home/);
  });

  test("changes on no line that are all routine still show, folded to their sentence", () => {
    const view = render(
      <UnseenLog
        events={[at(20, { line: null, type: "drift.resolved", summary: "Drift confirmed on OCT" })]}
        lines={[working]}
        includeWaiting={false}
        onShowWaiting={() => {}}
      />,
    );
    within(view.getByRole("article", { name: "On no line" })).getByText(/1 drift confirmation, all routine/);
  });

  test("groups line by line in the developer's order, folds checks to one sentence, and leaves waiting lines out but refused writes in", () => {
    const view = render(
      <UnseenLog events={events} lines={[working, queued]} includeWaiting={false} onShowWaiting={() => {}} />,
    );
    // Rule breaks first, whatever is left out; then only the working lines.
    within(view.getByRole("list", { name: "Rule breaks" })).getByText(/panel was refused a write/);
    const groups = view.getAllByRole("article");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["Enclosure"]);
    within(groups[0] ?? document.body).getByText("Also routine: 2 check changes, 1 re-confirmation.");
    within(groups[0] ?? document.body).getByText(/created: Base/);
    within(groups[0] ?? document.body).getByText("1 unseen");
    expect(view.queryByText("Plan set")).toBeNull();
    view.getByRole("button", { name: "Show them" });
  });

  test("with waiting lines asked for, shows their changes too", () => {
    const view = render(
      <UnseenLog events={events} lines={[working, queued]} includeWaiting onShowWaiting={() => {}} />,
    );
    view.getByText("Plan set");
  });
});

describe("SinceSummary", () => {
  test("lists what is newer than the summary, one row each, with what was seen folded to one row", () => {
    const events = [
      event({ seq: 4, ts: "2026-11-14T12:00:00.000Z", type: "line.plan_set", summary: "Plan set" }),
      event({ seq: 3, ts: "2026-11-14T11:00:00.000Z", type: "issue.created", summary: "Base made" }),
      event({ seq: 2, ts: "2026-11-14T10:30:00.000Z", type: "issue.created", summary: "Lid made" }),
      event({ seq: 1, ts: "2026-11-14T08:00:00.000Z", type: "issue.created", summary: "Before the summary" }),
    ];
    const view = render(
      <SinceSummary
        line="L-1"
        events={events}
        summaryAt="2026-11-14T09:00:00.000Z"
        seenAt="2026-11-14T10:45:00.000Z"
        more={false}
      />,
    );
    expect(view.queryByText(/only the newest/)).toBeNull();
    view.getByText("Plan set");
    view.getByText("Base made");
    view.getByText("1 you have seen");
    expect(view.queryByText("Lid made")).toBeNull();
    expect(view.queryByText("Before the summary")).toBeNull();
  });
});

/** Every choice home makes, as mocks a test can check; home itself is a query that never ran. */
function homeActions(overrides: Partial<HomeActions> = {}): HomeActions {
  return {
    home: new QueryObserver<HomeView>(new QueryClient(), {
      queryKey: [contracts.homeShow.name, {}],
      enabled: false,
    }).getCurrentResult(),
    lineOf: () => null,
    held: new Set<string>(),
    failure: null,
    places: [],
    retry: mock(() => {}),
    anyway: mock(() => {}),
    setCheckout: mock(() => {}),
    at: mock(() => {}),
    repos: [],
    repoName: (key: string) => key,
    add: mock(() => {}),
    start: mock(() => {}),
    queue: mock(() => {}),
    reject: mock(() => {}),
    drop: mock(() => {}),
    table: mock(() => {}),
    fold: mock(() => {}),
    own: mock(() => {}),
    lineDone: mock(() => {}),
    notYet: mock(() => {}),
    doneWhen: mock(() => {}),
    acceptRecommended: mock(() => {}),
    taskDone: mock(() => {}),
    taskCant: mock(() => {}),
    dropBefore: mock(() => {}),
    reorder: mock(() => {}),
    ...overrides,
  };
}

/** How LineForYou and AtPlaceItems are told to draw an item: a line naming it, so a test can see which were drawn. */
function drawn(forYou: ForYou) {
  return <p key={refOf(forYou)}>Drawn {refOf(forYou)}</p>;
}

const forYouQuestion = {
  kind: "question" as const,
  card: decisionCard({ decision: decision({ ref: "D-7", title: "Which?" }) }),
};
const forYouTask = (overrides: Parameters<typeof issue>[0]) => ({
  kind: "task" as const,
  task: issue(overrides),
  frees: null,
});
const forYouDone = {
  kind: "done" as const,
  line: "L-1",
  text: "The case holds the board.",
  by: "claude-a",
  doneWhen: "A printed case holds the board.",
};

describe("PullRequestBox", () => {
  test("says it is loading, or why it could not load, instead of None yet", () => {
    const loading = render(<PullRequestBox prs={[]} holder={null} loading />);
    loading.getByRole("status");
    expect(loading.queryByText("None yet.")).toBeNull();
    loading.unmount();
    const failed = render(<PullRequestBox prs={[]} holder={null} error={new Error("gh is down")} />);
    failed.getByRole("alert");
    failed.getByText("gh is down");
    expect(failed.queryByText("None yet.")).toBeNull();
  });

  test("shows each pull request with its link, checks, size, opened date and state", () => {
    const view = render(
      <PullRequestBox
        prs={[
          pr(),
          pr({ ref: "PR-2", number: 13, title: "Drop the cache", checks: "failing", state: "merged" }),
        ]}
        holder="claude-a"
      />,
    );
    const box = view.getByRole("region", { name: "Pull request" });
    within(box).getByRole("heading", { name: "Pull requests" });
    expect(within(box).getByRole("link", { name: "acme/app#12" }).getAttribute("href")).toBe(
      "https://github.com/acme/app/pull/12",
    );
    within(box).getByRole("link", { name: "acme/app#13" });
    within(box).getByText("Add retry");
    within(box).getByText("Drop the cache");
    within(box).getByText("✓ checks pass");
    within(box).getByText("✗ checks failing");
    expect(within(box).getAllByText("+10 −2 · opened 2026-11-07")).toHaveLength(2);
    within(box).getByText("merged");
    within(box).getByText(
      "Checks are agents' to fix, never yours. claude-a merges once they pass, and asks first if it wants your eyes.",
    );
  });

  test("with one pull request says so in the singular; checks pending or absent are said in words", () => {
    const view = render(<PullRequestBox prs={[pr({ checks: "pending" })]} holder={null} />);
    view.getByRole("heading", { name: "Pull request" });
    view.getByText("checks running");
    view.getByText(
      whole(
        "Checks are agents' to fix, never yours. Whoever takes the issue merges once they pass, and asks first if it wants your eyes.",
      ),
    );
    render(<PullRequestBox prs={[pr({ ref: "PR-3", checks: "none" })]} holder={null} />).getByText(
      "no checks",
    );
  });

  test("with none yet says so", () => {
    const view = render(<PullRequestBox prs={[]} holder={null} />);
    view.getByRole("heading", { name: "Pull requests" });
    view.getByText("None yet.");
    expect(view.queryByRole("link")).toBeNull();
  });
});

describe("FoldPicker", () => {
  const targets = [line({ ref: "L-1", title: "Sendspin enclosure" }), line({ ref: "L-2", title: "Shelf" })];

  test("offers each open line as a numbered button, the first taking the cursor, with Cancel", () => {
    const view = render(
      <FoldPicker title="Wall mount" targets={targets} onFold={() => {}} onCancel={() => {}} />,
    );
    const group = view.getByRole("group", { name: "Fold Wall mount into" });
    const first = within(group).getByRole("button", { name: "Fold Wall mount into Sendspin enclosure" });
    const second = within(group).getByRole("button", { name: "Fold Wall mount into Shelf" });
    expect(first.textContent).toBe("L-1 Sendspin enclosure");
    expect(first.getAttribute("data-choice")).toBe("1");
    expect(second.getAttribute("data-choice")).toBe("2");
    expect(document.activeElement).toBe(first);
    within(group).getByRole("button", { name: "Cancel" });
  });

  test("folds into the line pressed, by its ref, and Cancel cancels", () => {
    const onFold = mock((_into: string) => {});
    const onCancel = mock(() => {});
    const view = render(
      <FoldPicker title="Wall mount" targets={targets} onFold={onFold} onCancel={onCancel} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Fold Wall mount into Shelf" }));
    expect(onFold).toHaveBeenCalledWith("L-2");
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onFold).toHaveBeenCalledTimes(1);
  });
});

describe("CheckoutForm", () => {
  test("takes the cursor, and sets only an absolute path", () => {
    const onSet = mock((_path: string) => {});
    const view = render(<CheckoutForm repo="PANEL" onSet={onSet} onCancel={() => {}} />);
    const field = view.getByRole("textbox", { name: "Checkout of PANEL" });
    expect(document.activeElement).toBe(field);
    const set = view.getByRole("button", { name: "Set" });
    expect(set.hasAttribute("disabled")).toBe(true);
    fireEvent.change(field, { target: { value: "src/panel" } });
    expect(set.hasAttribute("disabled")).toBe(true);
    fireEvent.submit(field);
    expect(onSet).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "/Users/me/src/panel" } });
    expect(set.hasAttribute("disabled")).toBe(false);
    fireEvent.click(set);
    expect(onSet).toHaveBeenCalledWith("/Users/me/src/panel");
  });

  test("Cancel cancels without setting anything", () => {
    const onSet = mock((_path: string) => {});
    const onCancel = mock(() => {});
    const view = render(<CheckoutForm repo="PANEL" onSet={onSet} onCancel={onCancel} />);
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSet).not.toHaveBeenCalled();
  });
});

describe("MoreForYou", () => {
  test("says what one more item is, a task by its place", () => {
    const say = (items: ForYou[]) => render(<MoreForYou items={items} onShow={() => {}} />);
    say([forYouTask({ ref: "PANEL-2", place: "the Mac" })]).getByRole("button", {
      name: "+1 more for you: a task at the Mac",
    });
    say([forYouTask({ ref: "PANEL-3" })]).getByRole("button", { name: "+1 more for you: a task" });
    say([forYouQuestion]).getByRole("button", { name: "+1 more for you: a question" });
    say([forYouDone]).getByRole("button", { name: "+1 more for you: a proposal" });
  });

  test("counts several by kind, and shows them when pressed", () => {
    const onShow = mock(() => {});
    const view = render(
      <MoreForYou
        items={[
          forYouQuestion,
          forYouTask({ ref: "PANEL-2" }),
          forYouTask({ ref: "PANEL-3", place: "the Mac" }),
          forYouDone,
        ]}
        onShow={onShow}
      />,
    );
    fireEvent.click(
      view.getByRole("button", { name: "+4 more for you: 1 question and 2 tasks and 1 proposal" }),
    );
    expect(onShow).toHaveBeenCalledTimes(1);
  });
});

describe("FocusTarget", () => {
  test("wraps its item where the browser can focus it, outlined and current when it has home's focus", () => {
    const focused = render(
      <FocusTarget focusRef="D-7" label="Question D-7, Which?" focused>
        <p>Which?</p>
      </FocusTarget>,
    );
    // A screen reader names what focus moved to.
    const wrap = focused.getByRole("group", { name: "Question D-7, Which?" });
    within(wrap).getByText("Which?");
    expect(wrap?.getAttribute("data-focus-ref")).toBe("D-7");
    expect(wrap?.getAttribute("data-selected")).toBe("true");
    expect(wrap?.getAttribute("aria-current")).toBe("true");
    expect(wrap?.getAttribute("tabindex")).toBe("-1");
    focused.unmount();
    const other = render(
      <FocusTarget focusRef="D-7" label="Question D-7, Which?" focused={false}>
        <p>Which?</p>
      </FocusTarget>,
    );
    const plain = other.getByText("Which?").parentElement;
    expect(plain?.getAttribute("data-selected")).toBe("false");
    expect(plain?.hasAttribute("aria-current")).toBe(false);
  });
});

describe("AtUpNext", () => {
  const drawTask = (task: Issue) => <article aria-label={task.title}>Task {task.ref}</article>;
  const asked = new Date(Date.now() - 2 * 3_600_000 - 60_000).toISOString();
  const tasks = [
    issue({
      ref: "OCT-5",
      title: "Find the drill",
      line: "L-2",
      place: "the shed",
      outcome: "Where it is",
      createdAt: asked,
    }),
    issue({
      ref: "OCT-6",
      title: "Sweep the shed",
      line: "L-9",
      place: "the shed",
      outcome: "",
      createdAt: asked,
    }),
  ];
  const lines = [line({ ref: "L-1", title: "Wall mount" }), line({ ref: "L-2", title: "Shelf" })];

  test("is nothing without tasks", () => {
    const view = render(<AtUpNext tasks={[]} lines={lines} firstNumber={3} focus={null} task={drawTask} />);
    expect(view.container.textContent).toBe("");
  });

  test("names each task's up-next line by its number, how long it has waited, and opens it", () => {
    const view = render(
      <AtUpNext tasks={tasks} lines={lines} firstNumber={3} focus="OCT-6" task={drawTask} />,
    );
    const section = view.getByRole("region", { name: "While you're here, from lines up next" });
    within(section).getByRole("heading", { name: "While you're here, from lines up next" });
    within(section).getByText("4 Shelf, up next · OCT-5 · asked 2h ago");
    within(section).getByText("OCT-6 · asked 2h ago");
    const drill = within(section).getByRole("article", { name: "Find the drill" });
    const sweep = within(section).getByRole("article", { name: "Sweep the shed" });
    expect(drill.closest("[data-focus-ref]")?.hasAttribute("aria-current")).toBe(false);
    expect(sweep.closest("[data-focus-ref]")?.getAttribute("aria-current")).toBe("true");
  });
});

describe("ActivityList", () => {
  test("is nothing without events", () => {
    expect(render(<ActivityList events={[]} />).container.textContent).toBe("");
  });

  test("lists what happened, one row each, in the order given, with when", () => {
    const view = render(
      <ActivityList
        events={[
          event({ seq: 2, ts: "2026-01-02T10:00:00.000Z", ref: "OCT-2", summary: "OCT-2 created: Base" }),
          event({ seq: 1, ts: "2026-01-01T10:00:00.000Z", summary: "OCT-1 created: Thing" }),
        ]}
      />,
    );
    const activity = view.getByRole("region", { name: "Activity" });
    within(activity).getByRole("heading", { name: "Activity · newest first" });
    within(activity).getByText(whole("2026-01-02 OCT-2 created: Base"));
    within(activity).getByText(whole("2026-01-01 OCT-1 created: Thing"));
    expect(
      within(activity)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["OCT-2", "OCT-1"]);
  });
});

describe("LineStepIn", () => {
  const stepIn = (
    props: Partial<Parameters<typeof LineStepIn>[0]> & { h: HomeActions; kind: StepInKind | null },
  ): Parameters<typeof LineStepIn>[0] => ({
    line: line(),
    reason: props.kind === null ? null : "Why, as the server words it.",
    focused: false,
    folded: false,
    onFocus: () => {},
    ...props,
  });
  const choices = (view: ReturnType<typeof render>) =>
    within(view.getByRole("note", { name: "Step in on Sendspin enclosure" }))
      .getAllByRole("button")
      .map((button) => button.textContent);

  test("is nothing when the server sends no reason to step in", () => {
    expect(render(<LineStepIn {...stepIn({ h: homeActions(), kind: null })} />).container.textContent).toBe(
      "",
    );
  });

  test("says the server's reason, and offers what fits each kind beside Table it and I'll own it", () => {
    const cases: readonly (readonly [StepInKind, readonly string[]])[] = [
      ["no_start_command", ["Try now", "Table it", "I'll own it"]],
      ["failing", ["Try now", "Table it", "I'll own it"]],
      ["left", ["Try now", "Table it", "I'll own it"]],
      ["never_took", ["Try now", "Table it", "I'll own it"]],
      ["clone_failed", ["Set its checkout", "Table it", "I'll own it"]],
      ["at_cap", ["Start one anyway", "Table it", "I'll own it"]],
      ["watch_only", ["Table it", "I'll own it"]],
      ["no_repo", ["Table it", "I'll own it"]],
    ];
    for (const [kind, offered] of cases) {
      const view = render(<LineStepIn {...stepIn({ h: homeActions(), kind })} />);
      view.getByText("Why, as the server words it.");
      // The kind rides along, so a failure says which one offered the wrong choices.
      expect({ kind, offered: choices(view) }).toEqual({ kind, offered: [...offered] });
      view.unmount();
    }
  });

  test("Try now, Start one anyway, I'll own it and Table it go to home's actions", () => {
    const h = homeActions();
    const failing = render(<LineStepIn {...stepIn({ h, kind: "failing" })} />);
    fireEvent.click(failing.getByRole("button", { name: "Try now" }));
    expect(h.retry).toHaveBeenCalledWith("L-1");
    fireEvent.click(failing.getByRole("button", { name: "I'll own it" }));
    expect(h.own).toHaveBeenCalledWith("L-1");
    fireEvent.click(failing.getByRole("button", { name: "Table it" }));
    fireEvent.change(failing.getByLabelText("Why table Sendspin enclosure"), {
      target: { value: "After the move" },
    });
    fireEvent.click(failing.getByRole("button", { name: "Table it" }));
    expect(h.table).toHaveBeenCalledWith("L-1", "After the move", null);
    failing.unmount();
    const busy = render(<LineStepIn {...stepIn({ h, kind: "at_cap" })} />);
    fireEvent.click(busy.getByRole("button", { name: "Start one anyway" }));
    expect(h.anyway).toHaveBeenCalledWith("L-1");
  });

  test("after a failed checkout, Set its checkout sets the line's first repo, and does not retry by itself", () => {
    const h = homeActions();
    const view = render(
      <LineStepIn {...stepIn({ h, kind: "clone_failed", line: line({ repos: ["PANEL", "FIRMWARE"] }) })} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Set its checkout" }));
    fireEvent.change(view.getByRole("textbox", { name: "Checkout of PANEL" }), {
      target: { value: "/Users/me/src/panel" },
    });
    fireEvent.click(view.getByRole("button", { name: "Set" }));
    expect(h.setCheckout).toHaveBeenCalledWith("L-1", "PANEL", "/Users/me/src/panel");
    expect(h.retry).not.toHaveBeenCalled();
  });

  test("folded at a place, is one row saying why in a few words, until it has focus", () => {
    const onFocus = mock((_ref: string) => {});
    const h = homeActions();
    const view = render(<LineStepIn {...stepIn({ h, kind: "failing", folded: true, onFocus })} />);
    expect(view.queryByRole("note")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Step in: a start keeps failing" }));
    expect(onFocus).toHaveBeenCalledWith("stepin:L-1");
    view.unmount();
    const focused = render(<LineStepIn {...stepIn({ h, kind: "failing", folded: true, focused: true })} />);
    const note = focused.getByRole("note", { name: "Step in on Sendspin enclosure" });
    expect(note.getAttribute("aria-current")).toBe("true");
  });
});

describe("LineForYou", () => {
  const items: ForYou[] = [
    forYouQuestion,
    forYouTask({ ref: "PANEL-2", place: "the Mac" }),
    forYouTask({ ref: "PANEL-3", place: "the Mac" }),
  ];
  const props = {
    forYou: items,
    folded: false,
    open: false,
    item: drawn,
    onFocus: () => {},
    onShowMore: () => {},
  };

  test("is nothing when nothing waits on the developer", () => {
    expect(render(<LineForYou {...props} forYou={[]} />).container.textContent).toBe("");
  });

  test("opens the first item and puts the rest one row away, which shows them", () => {
    const onShowMore = mock(() => {});
    const view = render(<LineForYou {...props} onShowMore={onShowMore} />);
    view.getByText("Drawn D-7");
    expect(view.queryByText("Drawn PANEL-2")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "+2 more for you: 2 tasks" }));
    expect(onShowMore).toHaveBeenCalledTimes(1);
  });

  test("with the rest shown, draws every item and no row", () => {
    const view = render(<LineForYou {...props} open />);
    expect(view.getAllByText(/^Drawn /).map((row) => row.textContent)).toEqual([
      "Drawn D-7",
      "Drawn PANEL-2",
      "Drawn PANEL-3",
    ]);
    expect(view.queryByRole("button")).toBeNull();
  });

  test("with one item, has no more row", () => {
    const view = render(<LineForYou {...props} forYou={[forYouQuestion]} />);
    view.getByText("Drawn D-7");
    expect(view.queryByRole("button")).toBeNull();
  });

  test("folded, is one row saying how many, which moves focus to the first", () => {
    const onFocus = mock((_ref: string) => {});
    const view = render(<LineForYou {...props} folded onFocus={onFocus} />);
    expect(view.queryByText(/^Drawn /)).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "3 for you" }));
    expect(onFocus).toHaveBeenCalledWith("D-7");
  });
});

describe("AtPlaceItems", () => {
  const drawTask = (task: Issue) => <article aria-label={task.title}>Task {task.ref}</article>;
  const here = forYouTask({
    ref: "PANEL-1",
    title: "Measure the grip",
    place: "the bench",
    outcome: "Five numbers",
  });
  const items: ForYou[] = [
    forYouQuestion,
    here,
    forYouTask({ ref: "PANEL-2", place: "the Mac" }),
    forYouDone,
  ];

  test("opens the place's tasks and folds everything else into one sentence that opens the first", () => {
    const onFocus = mock((_ref: string) => {});
    const view = render(
      <AtPlaceItems
        forYou={items}
        at="the bench"
        focus={null}
        task={drawTask}
        item={drawn}
        onFocus={onFocus}
      />,
    );
    const task = view.getByRole("article", { name: "Measure the grip" });
    expect(task.closest("[data-focus-ref]")?.getAttribute("data-focus-ref")).toBe("PANEL-1");
    expect(task.closest("[data-focus-ref]")?.hasAttribute("aria-current")).toBe(false);
    expect(view.queryByText(/^Drawn /)).toBeNull();
    fireEvent.click(
      view.getByRole("button", { name: "1 question · 1 task at the Mac · 1 proposal, folded" }),
    );
    expect(onFocus).toHaveBeenCalledWith("D-7");
  });

  test("draws the item with focus through item, and leaves it out of the folded sentence", () => {
    const onFocus = mock((_ref: string) => {});
    const view = render(
      <AtPlaceItems
        forYou={items}
        at="the bench"
        focus="D-7"
        task={drawTask}
        item={drawn}
        onFocus={onFocus}
      />,
    );
    view.getByText("Drawn D-7");
    view.getByRole("article", { name: "Measure the grip" });
    fireEvent.click(view.getByRole("button", { name: "1 task at the Mac · 1 proposal, folded" }));
    expect(onFocus).toHaveBeenCalledWith("PANEL-2");
  });

  test("marks the place's task current when it has focus, with nothing else folded away", () => {
    const view = render(
      <AtPlaceItems
        forYou={[here]}
        at="the bench"
        focus="PANEL-1"
        task={drawTask}
        item={drawn}
        onFocus={() => {}}
      />,
    );
    const task = view.getByRole("article", { name: "Measure the grip" });
    expect(task.closest("[data-focus-ref]")?.getAttribute("aria-current")).toBe("true");
    expect(view.queryByRole("button", { name: /folded/ })).toBeNull();
  });
});

describe("NotKept", () => {
  test("is nothing while drafts are kept", () => {
    expect(render(<NotKept error={null} />).container.textContent).toBe("");
  });

  test("says the draft was not saved, why, and that the words are still here", () => {
    const view = render(<NotKept error="the server is not answering" />);
    expect(view.getByRole("alert").textContent).toBe(
      "Not saved: the server is not answering. What you typed is still here; it is kept as soon as saving works again.",
    );
  });
});

describe("KeyValues", () => {
  test("lists each pair with a value, in order, and leaves out empty ones", () => {
    const view = render(
      <KeyValues
        items={[
          ["Status", "open"],
          ["Owner", null],
          ["Due", ""],
          ["Where", undefined],
          ["Repo", <b key="repo">acme/app</b>],
        ]}
      />,
    );
    expect(view.getAllByRole("term").map((term) => term.textContent)).toEqual(["Status", "Repo"]);
    expect(view.getAllByRole("definition").map((value) => value.textContent)).toEqual(["open", "acme/app"]);
  });
});

describe("LinkList", () => {
  const links: Link[] = [
    { fromRef: "OCT-1", rel: "blocks", toRef: "OCT-2", createdAt: "", createdBy: "dev" },
    { fromRef: "D-3", rel: "derived_from", toRef: "OCT-1", createdAt: "", createdBy: "dev" },
    { fromRef: "OCT-1", rel: "promoted_to", toRef: "OCT-9", createdAt: "", createdBy: "dev" },
  ];
  const linked: EntitySummary[] = [
    {
      kind: "issue",
      ref: "OCT-2",
      title: "Base",
      status: "in_progress",
      project: "OCT",
      priority: null,
      assignee: null,
      version: 1,
      updatedAt: "",
    },
  ];

  test("is nothing without links", () => {
    expect(render(<LinkList entityRef="OCT-1" links={[]} linked={[]} />).container.textContent).toBe("");
  });

  test("says each relation from the item's side, with the other item, its title and status when known", () => {
    const view = render(<LinkList entityRef="OCT-1" links={links} linked={linked} />);
    within(view.getByRole("heading", { name: /^Connections/ })).getByText("3");
    view.getByText("blocks");
    view.getByText("source of");
    view.getByText("promoted to");
    expect(view.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "OCT-2",
      "D-3",
      "OCT-9",
    ]);
    view.getByText("Base");
    view.getByText("in progress");
  });

  test("opens the other item when its ref is pressed", () => {
    const view = render(<LinkList entityRef="OCT-1" links={links} linked={linked} />);
    fireEvent.click(view.getByRole("button", { name: "D-3" }));
    expect(new URLSearchParams(window.location.search).get("ref")).toBe("D-3");
  });
});

describe("HistoryList", () => {
  test("lists each event with who did it and when", () => {
    const view = render(
      <HistoryList
        events={[
          event({
            seq: 2,
            ts: "2026-01-02T10:00:00.000Z",
            actor: "dev",
            ref: "OCT-2",
            summary: "OCT-2 closed",
          }),
          event({ seq: 1, ts: "2026-01-01T10:00:00.000Z" }),
        ]}
      />,
    );
    view.getByRole("heading", { name: "History" });
    view.getByText(whole("OCT-2 closed dev 2026-01-02"));
    view.getByText(whole("OCT-1 created: Thing claude-a 2026-01-01"));
  });

  test("with no events, is only its heading", () => {
    const view = render(<HistoryList events={[]} />);
    view.getByRole("heading", { name: "History" });
    expect(view.queryByRole("button")).toBeNull();
  });
});

describe("HeldDecision", () => {
  test("says a question waits for its line to start, and shows it read only", () => {
    const view = render(
      <HeldDecision
        decision={decision({ line: "L-3", heldAt: "2026-11-01T00:00:00.000Z", recommendationWhy: "Proven." })}
        waitsFor={[]}
      />,
    );
    view.getByText(/Held while L-3 is not being worked on/);
    view.getByText(/Why: Proven./);
    // Nothing to answer with: the only button is its ref.
    expect(view.getAllByRole("button").map((button) => button.textContent)).toEqual(["D-1"]);
  });
});

describe("one-line boxes", () => {
  test("a named outcome is one line, so it cannot add rows to the list sent back", () => {
    const view = render(
      <OutcomeFields
        fields={["Length"]}
        values={{ Length: "41" }}
        onValue={() => {}}
        note=""
        onNote={() => {}}
      />,
    );
    expect(view.getByLabelText("Length").tagName).toBe("INPUT");
    expect(view.getByLabelText("Note, if anything surprised you").tagName).toBe("TEXTAREA");
  });

  test("LineBox keeps what it shows while it has focus, and shows a new value once it has none", () => {
    const onChange = mock((_value: string) => {});
    const view = render(<LineBox label="Length" value="41" onChange={onChange} />);
    const box = view.getByLabelText("Length");
    fireEvent.focus(box);
    view.rerender(<LineBox label="Length" value="from another device" onChange={onChange} />);
    expect(box).toHaveProperty("value", "41");
    fireEvent.change(box, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith("42");
    fireEvent.blur(box);
    view.rerender(<LineBox label="Length" value="43" onChange={onChange} />);
    expect(box).toHaveProperty("value", "43");
  });

  test("TextBox sizes itself when a draft arrives without typing", () => {
    const view = render(<TextBox label="Note" value="" onChange={() => {}} />);
    const box = view.getByLabelText("Note");
    expect(box.style.height).not.toMatch(/px$/);
    view.rerender(<TextBox label="Note" value={"one\ntwo\nthree"} onChange={() => {}} />);
    expect(box.style.height).toMatch(/px$/);
    view.rerender(<TextBox label="Note" value="" onChange={() => {}} />);
    expect(box.style.height).not.toMatch(/px$/);
  });
});

describe("SinceSummary, past one page", () => {
  test("says only the newest are here and the rest are in the Log", () => {
    const view = render(
      <SinceSummary
        line="L-1"
        events={[event({ seq: 2, line: "L-1", ts: "2026-11-14T10:00:00.000Z", summary: "Plan set" })]}
        summaryAt="2026-11-14T09:00:00.000Z"
        seenAt={null}
        more
      />,
    );
    view.getByText(/1\+/);
    view.getByText(/These are only the newest; the rest are in the Log./);
  });
});

describe("Loaded", () => {
  test("says what is loading, then why it failed, and shows its part only once it is there", () => {
    const loading = render(
      <Loaded pending error={null} label="Loading the plan">
        <p>Plan</p>
      </Loaded>,
    );
    loading.getByText("Loading the plan...");
    expect(loading.queryByText("Plan")).toBeNull();
    loading.unmount();
    const failed = render(
      <Loaded pending={false} error={new Error("Boom")} label="Loading the plan">
        <p>Plan</p>
      </Loaded>,
    );
    failed.getByRole("alert");
    failed.unmount();
    render(
      <Loaded pending={false} error={null} label="Loading the plan">
        <p>Plan</p>
      </Loaded>,
    ).getByText("Plan");
  });
});

describe("TaskFrees", () => {
  const freed = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
    kind: "issue",
    ref: "PANEL-5",
    title: "Test-print the current parts",
    status: "in_progress",
    project: "PANEL",
    priority: "medium",
    assignee: "panel-widgets",
    version: 1,
    updatedAt: "",
    ...overrides,
  });

  test("names what Done frees, opens it, and says who it wakes", () => {
    navigate("/");
    const view = render(<TaskFrees freed={[freed()]} />);
    view.getByText("Test-print the current parts");
    view.getByText(
      /Done goes to the line's inbox for whoever holds PANEL-5, now panel-widgets, and wakes it./,
    );
    fireEvent.click(view.getByRole("button", { name: "PANEL-5" }));
    expect(new URLSearchParams(window.location.search).get("ref")).toBe("PANEL-5");
  });

  test("with nobody holding it, says whoever takes it hears", () => {
    render(<TaskFrees freed={[freed({ assignee: null })]} />).getByText(
      /Done goes to the line's inbox for whoever takes PANEL-5, and wakes them./,
    );
  });

  test("is nothing when the task frees nothing", () => {
    expect(render(<TaskFrees freed={[]} />).container.textContent).toBe("");
  });
});

describe("TaskCard's strip", () => {
  test("says who filed the task and what it holds up", () => {
    const view = render(
      <TaskCard
        task={issue({ title: "Measure", place: "the bench", outcome: "mm", createdBy: "panel-widgets" })}
        holdsUp="the final print"
        words=""
        onWords={() => {}}
        values={{}}
        onValue={() => {}}
        why=""
        onWhy={() => {}}
        onDone={() => {}}
        onCant={() => {}}
      />,
    );
    view.getByText(/holds up the final print/);
    view.getByText(/filed by panel-widgets/);
  });
});

describe("useHeldValue, through TextBox", () => {
  test("a box with focus keeps its words when other words arrive, but empties when its draft does, as when sent", () => {
    const view = render(<TextBox label="Note" value="Print it" onChange={() => {}} />);
    const box = view.getByLabelText("Note");
    fireEvent.focus(box);
    view.rerender(<TextBox label="Note" value="From the phone" onChange={() => {}} />);
    expect(box).toHaveProperty("value", "Print it");
    view.rerender(<TextBox label="Note" value="" onChange={() => {}} />);
    expect(box).toHaveProperty("value", "");
    view.rerender(<TextBox label="Note" value="New words" onChange={() => {}} />);
    expect(box).toHaveProperty("value", "");
  });
});
