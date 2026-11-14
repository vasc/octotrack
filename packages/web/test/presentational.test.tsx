import { describe, expect, mock, test } from "bun:test";
import { useState } from "react";
import { fireEvent, render, within } from "@testing-library/react";
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
import { NothingNeedsYou } from "../src/components/home/NothingNeedsYou.tsx";
import { AtSection } from "../src/components/home/AtSection.tsx";
import { foldedText } from "../src/components/home/FoldedItems.tsx";
import { SinceSummary } from "../src/components/entity/SinceSummary.tsx";
import { FilterBar } from "../src/components/feed/FilterBar.tsx";
import { IssueRow } from "../src/components/issues/IssueRow.tsx";
import { LineActions } from "../src/components/entity/LineActions.tsx";
import { OwnWorkBox } from "../src/components/entity/OwnWorkBox.tsx";
import { TellBox } from "../src/components/entity/TellBox.tsx";
import { type NewLine, NewLineCard } from "../src/components/lines/NewLineCard.tsx";
import { TableForm } from "../src/components/lines/TableForm.tsx";
import { TopBar } from "../src/components/layout/TopBar.tsx";
import { UndoBar } from "../src/components/layout/UndoBar.tsx";
import { ProjectCardView } from "../src/components/projects/ProjectCardView.tsx";
import { PrGlyphs } from "../src/components/prs/PrGlyphs.tsx";
import { PrRow } from "../src/components/prs/PrRow.tsx";
import { PrStrip } from "../src/components/prs/PrStrip.tsx";
import { SyncFailures } from "../src/components/prs/SyncFailures.tsx";
import { ListCapNote } from "../src/components/ui/ListCapNote.tsx";
import { Progress } from "../src/components/ui/Progress.tsx";
import { Markdown } from "../src/components/ui/Markdown.tsx";
import { RefText } from "../src/components/ui/RefText.tsx";
import { TextBox } from "../src/components/ui/TextBox.tsx";
import { EmptyState, ErrorState, LoadingState } from "../src/components/ui/states.tsx";
import type { AgentView, LineCrew, LineHome, LineStart } from "@octotrack/core/schemas";
import type { Tone } from "../src/lib/format.ts";
import { stepInReason } from "../src/lib/lines.ts";
import {
  decision,
  decisionCard,
  decisionForm,
  drift,
  event,
  issue,
  issueCard,
  line,
  pendingChoice,
  pr,
  prCard,
} from "../src/design/fixtures.ts";
import { whole } from "./harness.tsx";

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

describe("PrGlyphs and PrRow", () => {
  test.each([
    ["passing", "approved"],
    ["failing", "changes_requested"],
    ["pending", "requested"],
    ["none", "none"],
  ] as const)("status %s, review %s can be read without relying on colour", (checks, review) => {
    const view = render(<PrGlyphs checks={checks} review={review} />);
    view.getByRole("img", { name: new RegExp(`Checks ${checks}`) });
    view.getByRole("img", { name: new RegExp(`Review ${review.replace("_", " ")}`) });
  });

  test("failing checks are toned as bad", () => {
    const view = render(<PrGlyphs checks="failing" review="none" />);
    expect(view.getByRole("img", { name: "Checks failing" }).getAttribute("data-tone")).toBe("bad");
  });

  test("a row shows title, link to GitHub, attention, and details when wide", () => {
    const view = render(<PrRow wide card={prCard({ attention: ["checks failing"], issues: ["OCT-4"] })} />);
    view.getByRole("button", { name: "Add retry" });
    expect(view.getByRole("link", { name: "acme/app#12" }).getAttribute("href")).toBe(
      "https://github.com/acme/app/pull/12",
    );
    view.getByText("checks failing");
    view.getByRole("button", { name: "OCT-4" });
    view.getByText("+10 -2");
  });

  test("a finished PR shows its state instead of glyphs", () => {
    const view = render(<PrRow card={prCard({ pr: pr({ state: "merged" }) })} />);
    view.getByText("merged");
    expect(view.queryByRole("img")).toBeNull();
  });

  test("a draft says so", () => {
    render(<PrRow card={prCard({ pr: pr({ state: "draft" }) })} />).getByText("draft");
  });
});

describe("PrStrip", () => {
  test("sums up open PRs by what they need, ignoring finished ones", () => {
    const view = render(
      <PrStrip
        cards={[
          prCard({ attention: ["checks failing", "needs review"] }),
          prCard({ pr: pr({ ref: "PR-2", state: "draft" }), attention: ["checks failing"] }),
          prCard({ pr: pr({ ref: "PR-3" }), attention: ["ready to merge"] }),
          prCard({ pr: pr({ ref: "PR-4", state: "merged" }) }),
        ]}
      />,
    );
    view.getByText("3 open PRs");
    view.getByText("2 failing");
    view.getByText("1 need review");
    view.getByText("1 ready to merge");
    expect(view.queryByText(/conflicting/)).toBe(null);
  });

  test("is not there when nothing is open", () => {
    const view = render(<PrStrip cards={[prCard({ pr: pr({ state: "merged" }) })]} />);
    expect(view.container.firstChild).toBe(null);
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

describe("IssueRow", () => {
  test("shows blockers, PRs, labels, drift and assignee, and changes status", () => {
    const onStatus = mock(() => {});
    const view = render(
      <IssueRow
        onStatus={onStatus}
        card={issueCard({
          issue: issue({ labels: ["backend"], assignee: "claude-a", priority: "urgent" }),
          blockedBy: ["D-3"],
          prs: ["PR-2"],
          openDrift: 2,
        })}
      />,
    );
    view.getByRole("button", { name: "D-3" });
    view.getByRole("button", { name: "PR-2" });
    view.getByText("backend");
    view.getByText("2 drift");
    view.getByText("claude-a");
    view.getByText("urgent");
    fireEvent.change(view.getByLabelText("Status of OCT-1"), { target: { value: "done" } });
    expect(onStatus).toHaveBeenCalledWith("OCT-1", "done");
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
    const group = view.getByRole("status", { name: "Waiting on you" });
    expect(
      within(group)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["4 to answer", "1 to accept", "1 to step in"]);
    const urgent = view.getByRole("link", { name: "1 urgent" });
    expect(group.contains(urgent)).toBe(false);
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

describe("ProjectCardView", () => {
  test("a project card shows progress and what needs attention", () => {
    const view = render(
      <ProjectCardView
        card={{
          project: {
            ref: "OCT",
            name: "Octotrack",
            description: "Tracker",
            status: "active",
            repo: null,
            checkout: null,
            horizon: "none",
            targetDate: null,
            version: 1,
            createdAt: "",
            updatedAt: "",
            createdBy: "x",
          },
          stats: {
            issuesTotal: 4,
            issuesClosed: 1,
            issuesActive: 1,
            issuesBlocked: 0,
            openDecisions: 2,
            openPrs: 1,
            openDrift: 3,
          },
        }}
      />,
    );
    view.getByText("1/4 done");
    expect(view.getByText("2 decisions").className).toBe("stat-hot");
    expect(view.getByText("0 blocked").className).toBe("");
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
  });
});

describe("small pieces", () => {
  test("a list at its limit says so", () => {
    render(<ListCapNote shown={200} cap={200} />).getByText(/first 200/);
    expect(render(<ListCapNote shown={199} cap={200} />).container.firstChild).toBe(null);
  });

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

  test("progress handles nothing to do", () => {
    const view = render(<Progress done={0} total={0} />);
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  test("RefText links refs and leaves other words alone", () => {
    const view = render(<RefText text="See D-3 and OCT-12, not UTF8 or x-1" />);
    expect(view.getAllByRole("button").map((button) => button.textContent)).toEqual(["D-3", "OCT-12"]);
  });
});

/** A task card whose words are kept, as its caller keeps them in a draft. */
function TypingTask({ onDone, onCant }: { onDone(result: string): void; onCant(why: string): void }) {
  const [words, setWords] = useState("");
  return (
    <TaskCard
      task={issue({ title: "Measure the grip", place: "the bench", outcome: "Five numbers" })}
      words={words}
      onWords={setWords}
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
    held: { questions: 0, tasks: 0 },
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
    render(
      <ForYouRow
        item={{
          kind: "task",
          task: issue({ ref: "OCT-7", assignee: "dev", place: "the Mac", outcome: "Yes or no" }),
        }}
        onOpen={onOpen}
      />,
    ).getByText("Task · OCT-7 · at the Mac");
  });

  test("TaskCard shows what to send back as a form, and Can't do it asks why", () => {
    const onDone = mock(() => {});
    const onCant = mock(() => {});
    const view = render(<TypingTask onDone={onDone} onCant={onCant} />);
    view.getByText("Five numbers");
    expect(view.getByRole("button", { name: "Done" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("What OCT-1 found"), { target: { value: " 41, 38 " } });
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith("41, 38");
    fireEvent.click(view.getByRole("button", { name: "Can't do it" }));
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
    const view = render(<ProposalCard line={proposal} foldTargets={[line()]} {...handlers} />);
    view.getByText("Recommended: Up next.");
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
    view.getByText('Sending "26 mm" to Sendspin enclosure in 8 seconds');
    view.getByText("Starting Wall mount in 1 second");
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
    ...overrides,
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
      <AgentRosterRow
        agent={agent({ state: "quiet" })}
        onStop={() => {}}
        onLift={() => {}}
        onRelease={onRelease}
      />,
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

describe("why a line needs the developer to step in", () => {
  const runner = { configured: true, cap: 1, dryRun: false };
  const start = (overrides: Partial<LineStart> = {}): LineStart => ({
    name: "panel.2",
    state: "failed",
    output: "Error\nclaude: not logged in",
    attempts: 1,
    at: "",
    nextTryAt: null,
    ...overrides,
  });

  test("says what to do when nothing can start a session, or when the runner only watches", () => {
    expect(stepInReason(line(), { ...runner, configured: false }, null)).toContain("agent-setup.json");
    expect(stepInReason(line(), { ...runner, dryRun: true }, null)).toContain("watching only");
  });

  test("quotes the last words of a start that failed, and says nothing while one is starting", () => {
    expect(stepInReason(line(), runner, start())).toBe(
      "panel.2, started for it, exited at once: claude: not logged in. Octotrack tries again by itself, less often each time.",
    );
    expect(stepInReason(line(), runner, start({ state: "never_took" }))).toBe(
      "panel.2 ran but never took L-1.",
    );
    expect(stepInReason(line(), runner, start({ state: "starting" }))).toBeNull();
    expect(stepInReason(line(), runner, null)).toContain("at most 1");
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
    fireEvent.click(working.getByRole("button", { name: "More: drop this line" }));
    fireEvent.click(working.getByRole("button", { name: "Drop" }));
    expect(onChoose).toHaveBeenCalledWith("drop");
    working.unmount();
    const proposed = render(<LineActions line={line({ state: "proposed" })} {...props} />);
    expect(names(proposed)).toEqual(["Start", "Up next", "Table", "Not a line"]);
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
    nobody.getByLabelText("Tell whoever takes L-1");
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
          held: { questions: 0, tasks: 0 },
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
    at(1, { line: "L-2", type: "write.refused", summary: "panel was refused a write on L-2" }),
  ];

  test("groups line by line in the developer's order, folds checks to one sentence, and leaves waiting lines out but refused writes in", () => {
    const view = render(
      <UnseenLog events={events} lines={[working, queued]} includeWaiting={false} onShowWaiting={() => {}} />,
    );
    // Rule breaks first, whatever is left out; then only the working lines.
    within(view.getByRole("list", { name: "Rule breaks" })).getByText(/panel was refused a write/);
    const groups = view.getAllByRole("region");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["Enclosure"]);
    within(groups[0] ?? document.body).getByText("Also routine: 2 check changes.");
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
      />,
    );
    view.getByText("Plan set");
    view.getByText("Base made");
    view.getByText("1 you have seen");
    expect(view.queryByText("Lid made")).toBeNull();
    expect(view.queryByText("Before the summary")).toBeNull();
  });
});
