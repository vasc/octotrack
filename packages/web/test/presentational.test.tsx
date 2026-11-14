import { describe, expect, mock, test } from "bun:test";
import { useState } from "react";
import { fireEvent, render, within } from "@testing-library/react";
import { BatchPanelView } from "../src/components/decisions/BatchPanelView.tsx";
import { DecisionCardView } from "../src/components/decisions/DecisionCardView.tsx";
import { DriftItem } from "../src/components/drift/DriftItem.tsx";
import { AgentRosterRow } from "../src/components/agents/AgentRosterRow.tsx";
import { LinePanel } from "../src/components/entity/LinePanel.tsx";
import { FirstRun } from "../src/components/home/FirstRun.tsx";
import { FoldedSection } from "../src/components/home/FoldedSection.tsx";
import { ForYouRow } from "../src/components/home/ForYouRow.tsx";
import { HomeCounts } from "../src/components/home/HomeCounts.tsx";
import { HomeSection } from "../src/components/home/HomeSection.tsx";
import { AtPicker } from "../src/components/home/AtPicker.tsx";
import { LineMeta } from "../src/components/home/LineMeta.tsx";
import { SpreadThin } from "../src/components/home/SpreadThin.tsx";
import { StartSheetView } from "../src/components/home/StartSheetView.tsx";
import { LineProposalCard } from "../src/components/home/LineProposalCard.tsx";
import { ProposalCard } from "../src/components/home/ProposalCard.tsx";
import { PushToggle } from "../src/components/home/PushToggle.tsx";
import { QuietRow } from "../src/components/home/QuietRow.tsx";
import { ReorderButtons } from "../src/components/home/ReorderButtons.tsx";
import { StepIn } from "../src/components/home/StepIn.tsx";
import { TaskCard } from "../src/components/home/TaskCard.tsx";
import { UpNextRow } from "../src/components/home/UpNextRow.tsx";
import { WorkingLine } from "../src/components/home/WorkingLine.tsx";
import { eventTone, FeedItem } from "../src/components/feed/FeedItem.tsx";
import { FeedList } from "../src/components/feed/FeedList.tsx";
import { FilterBar } from "../src/components/feed/FilterBar.tsx";
import { IssueRow } from "../src/components/issues/IssueRow.tsx";
import { LineActions } from "../src/components/entity/LineActions.tsx";
import { OwnWorkBox } from "../src/components/entity/OwnWorkBox.tsx";
import { TellBox } from "../src/components/entity/TellBox.tsx";
import { AddLineForm } from "../src/components/lines/AddLineForm.tsx";
import { TableForm } from "../src/components/lines/TableForm.tsx";
import { SidebarView } from "../src/components/layout/SidebarView.tsx";
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
    view.getByText("SQS");
    view.getByText("Managed");
    const redis = view.getByRole("button", { name: /Redis/ });
    within(redis).getByText("recommended");
    expect(view.queryByRole("button", { name: /SQS.*recommended/ })).toBeNull();
    view.getByRole("button", { name: "OCT-4" });
    expect(view.queryByRole("button", { name: "OCT-5" })).toBeNull();
  });

  test("offers an own answer only when there are options to step outside of", () => {
    const withOptions = render(<DecisionCardView form={form()} card={decisionCard()} />);
    expect(withOptions.queryByRole("button", { name: /Something else/ })).not.toBeNull();
    withOptions.unmount();
    const without = render(
      <DecisionCardView
        form={form()}
        card={decisionCard({ decision: decision({ options: [], recommendation: null }) })}
      />,
    );
    expect(without.queryByRole("button", { name: /Something else/ })).toBeNull();
  });

  test("the button stays disabled until there is something to submit", () => {
    const empty = render(<DecisionCardView form={form()} card={decisionCard()} />);
    expect(empty.getByRole("button", { name: "Decide" }).hasAttribute("disabled")).toBe(true);
    empty.unmount();
    const ready = render(<DecisionCardView form={form({ canSubmit: true })} card={decisionCard()} />);
    expect(ready.getByRole("button", { name: "Decide" }).hasAttribute("disabled")).toBe(false);
  });

  test("calls back on choosing, typing and submitting, and marks what is chosen", () => {
    const choose = mock(() => {});
    const setNote = mock(() => {});
    const submit = mock(() => {});
    const view = render(
      <DecisionCardView
        form={form({ choose, setNote, submit, chosen: "sqs", canSubmit: true })}
        card={decisionCard()}
      />,
    );
    expect(view.getByRole("button", { name: /SQS/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: /Redis/ }));
    expect(choose).toHaveBeenCalledWith("redis");
    fireEvent.change(view.getByLabelText("Note for D-1"), { target: { value: "Because" } });
    expect(setNote).toHaveBeenCalledWith("Because");
    fireEvent.click(view.getByRole("button", { name: "Decide" }));
    expect(submit).toHaveBeenCalled();
  });

  test("without options it asks for an answer, and shows a free-text recommendation", () => {
    const view = render(
      <DecisionCardView
        form={form()}
        card={decisionCard({ decision: decision({ options: [], recommendation: "Do it" }) })}
      />,
    );
    view.getByPlaceholderText("Your answer");
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

describe("SidebarView", () => {
  const counts = {
    openDecisions: 4,
    openDrift: 2,
    openPrs: 3,
    failingPrs: 1,
    activeIssues: 5,
    blockedIssues: 0,
    waitingWatches: 1,
    ideas: 0,
  };

  test("shows where you are and the counts that matter", () => {
    const view = render(<SidebarView path="/decisions" live="live" counts={counts} projects={[]} />);
    const link = view.getByRole("link", { name: /Decisions/ });
    expect(link.getAttribute("aria-current")).toBe("page");
    within(link).getByText("4");
    // Lines first; roadmap and ideas are gone, since lines replaced both.
    expect(
      view
        .getAllByRole("link")
        .map((item) => item.textContent)
        .slice(0, 2),
    ).toEqual(["Lines", "Log"]);
    view.getByRole("link", { name: "Repos" });
    expect(view.queryByRole("link", { name: "Ideas" })).toBeNull();
    view.getByText("live");
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
    ...overrides,
  });

  test("HomeCounts names what waits, leaves out what does not, marks urgent, and each goes to its first item", () => {
    const onPick = mock((_count: string) => {});
    const view = render(
      <HomeCounts counts={{ toAnswer: 4, toDo: 0, toAccept: 1, toStepIn: 0, urgent: 1 }} onPick={onPick} />,
    );
    expect(view.getByLabelText("Waiting on you").textContent).toBe("1 urgent4 to answer1 to accept");
    expect(view.getByText("1 urgent").getAttribute("data-urgent")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "4 to answer" }));
    expect(onPick).toHaveBeenCalledWith("toAnswer");
    view.unmount();
    render(
      <HomeCounts counts={{ toAnswer: 0, toDo: 0, toAccept: 0, toStepIn: 0, urgent: 0 }} onPick={onPick} />,
    ).getByText("Nothing waits on you.");
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
    article.getByText("owner panel, asleep");
    article.getByText("waiting on you");
    article.getByText("step 3 of 4, settle board and opening");
    article.getByText("Printed; the short board fits.");
    article.getByText("child");
  });

  test("LineMeta says when nobody could be found to own a line, and who is scoping it", () => {
    const crew: LineCrew = { owner: null, helpers: [], scoper: null, search: { step: 3, since: "" } };
    const empty = render(<LineMeta crew={crew} details={details({ stepIn: true })} />);
    empty.getByText("no owner: step in");
    empty.unmount();
    // The search ran its course, but a start is on its way or the work waits on the developer: nothing to step in on.
    const waiting = render(<LineMeta crew={crew} details={details({ stepIn: false })} />);
    waiting.getByText("no owner yet");
    expect(waiting.queryByText("no owner: step in")).toBeNull();
    waiting.unmount();
    render(
      <LineMeta
        crew={{ owner: null, helpers: [], scoper: { name: "garden", state: "running" }, search: null }}
      />,
    ).getByText("garden is scoping it");
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

  test("TaskCard asks for words before Done or Can't do it", () => {
    const onDone = mock(() => {});
    const onCant = mock(() => {});
    const view = render(<TypingTask onDone={onDone} onCant={onCant} />);
    view.getByText(whole("Report: Five numbers"));
    fireEvent.click(view.getByRole("button", { name: "Done…" }));
    expect(view.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("What OCT-1 found"), { target: { value: " 41, 38 " } });
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    expect(onDone).toHaveBeenCalledWith("41, 38");
    fireEvent.click(view.getByRole("button", { name: "Can't do it…" }));
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
    fireEvent.click(view.getByRole("button", { name: "Table it…" }));
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
    view.getByText("1 task held");
    view.getByText("not scoped yet");
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
    view.getByText(/panel-widgets says up next/);
    view.getByText("The base is final.");
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
    view.getByText("Podcast cleanup, Bike fit");
    expect(view.queryByText("the rows")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Show" }));
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

  test("ReorderButtons cannot move past either end", () => {
    const view = render(<ReorderButtons title="One" canMoveUp={false} canMoveDown onMove={() => {}} />);
    expect(view.getByRole("button", { name: "Move One up" }).hasAttribute("disabled")).toBe(true);
    expect(view.getByRole("button", { name: "Move One down" }).hasAttribute("disabled")).toBe(false);
  });

  test("HomeSection is a region named by its title", () => {
    render(
      <HomeSection title="Working on" count={2}>
        <p>x</p>
      </HomeSection>,
    ).getByRole("region", { name: "Working on" });
  });

  test("AddLineForm needs a title and a done-when sentence, and says whose the line is by its repos", () => {
    const onAdd = mock(() => {});
    const view = render(<AddLineForm repos={["OCT", "GARDEN"]} onAdd={onAdd} />);
    fireEvent.click(view.getByRole("button", { name: "New line…" }));
    const add = view.getByRole("button", { name: "Add line" });
    fireEvent.change(view.getByLabelText("New line"), { target: { value: "Garden sensor" } });
    expect(add.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Done when"), { target: { value: "Readings arrive hourly." } });
    view.getByText("No repo: the line is yours, and no agent takes it.");
    fireEvent.click(view.getByRole("checkbox", { name: "GARDEN" }));
    expect(view.queryByText("No repo: the line is yours, and no agent takes it.")).toBeNull();
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith({
      title: "Garden sensor",
      doneWhen: "Readings arrive hourly.",
      repos: ["GARDEN"],
    });
  });

  test("LinePanel says where a line stands, what finishes it, and why it waits", () => {
    const view = render(
      <LinePanel
        line={line({ state: "tabled", tabledReason: "The disk is not tight", lookAgainAt: "2027-02-01" })}
      />,
    );
    view.getByText("Tabled");
    view.getByText("The disk is not tight");
    view.getByText("2027-02-01");
    view.getByText("A printed case holds the board and takes the USB-C plug.");
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
  test("lists waiting choices newest first, says u undoes the newest, and offers Undo and Now", () => {
    const onUndo = mock((_id: number) => {});
    const onNow = mock((_id: number) => {});
    const choice = (id: number, summary: string) => pendingChoice({ id, summary });
    const view = render(
      <UndoBar
        pending={[choice(1, "Started Wall mount"), choice(2, "Tabled Trip")]}
        onUndo={onUndo}
        onNow={onNow}
      />,
    );
    const rows = view.getAllByRole("button", { name: "Undo" });
    expect(rows).toHaveLength(2);
    view.getByText("u to undo");
    fireEvent.click(rows[0] ?? document.body);
    expect(onUndo).toHaveBeenCalledWith(2);
    fireEvent.click(view.getAllByRole("button", { name: "Now" })[1] ?? document.body);
    expect(onNow).toHaveBeenCalledWith(1);
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
    const view = render(
      <AgentRosterRow agent={agent()} onStop={onStop} onLift={onLift} onRelease={() => {}} />,
    );
    view.getByText("wakes at claude:abc");
    view.getByText("owner");
    view.getByText("asleep");
    expect(view.queryByRole("button", { name: "Release panel" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Stop panel" }));
    expect(onStop).toHaveBeenCalledWith("panel");
    view.unmount();
    const stopped = render(
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
        onAccept={onAccept}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Accept 2 recommended placements" }));
    expect(onAccept).toHaveBeenCalledWith(["L-1", "L-3"]);
    view.unmount();
    render(<FirstRun proposals={[]} onAccept={onAccept} />).getByText("octo guide");
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
        onUndo={onUndo}
        onNow={() => {}}
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

  test("LineActions offers what each state allows, and own or hand by who owns a working line", () => {
    const onChoose = mock((_choice: string) => {});
    const props = { onChoose, onTable: () => {}, onDoneWhen: () => {} };
    const names = (view: ReturnType<typeof render>) =>
      view.getAllByRole("button").map((button) => button.textContent);
    const working = render(<LineActions line={line()} {...props} />);
    expect(names(working)).toEqual(["Up next", "Done", "Drop", "Table…", "I'll own it"]);
    fireEvent.click(working.getByRole("button", { name: "Done" }));
    expect(onChoose).toHaveBeenCalledWith("done");
    working.unmount();
    const mine = render(<LineActions line={line({ ownedBy: "dev" })} {...props} />);
    fireEvent.click(mine.getByRole("button", { name: "Hand to an agent" }));
    expect(onChoose).toHaveBeenCalledWith("hand");
    mine.unmount();
    const proposed = render(<LineActions line={line({ state: "proposed" })} {...props} />);
    expect(names(proposed)).toEqual(["Start", "Up next", "Not a line", "Table…"]);
    proposed.unmount();
    const done = render(<LineActions line={line({ state: "done" })} {...props} />);
    expect(done.queryAllByRole("button")).toHaveLength(0);
  });

  test("LineActions puts an agent's proposals to the developer: a new done when, and that the line is done", () => {
    const onChoose = mock((_choice: string) => {});
    const onDoneWhen = mock((_accept: boolean) => {});
    const view = render(
      <LineActions
        line={line({
          doneWhenProposal: "It holds the 30 mm board.",
          doneWhenProposedBy: "panel",
          doneProposal: "The final print fits.",
        })}
        onChoose={onChoose}
        onTable={() => {}}
        onDoneWhen={onDoneWhen}
      />,
    );
    view.getByText("It holds the 30 mm board.");
    fireEvent.click(view.getByRole("button", { name: "Keep the one there is" }));
    expect(onDoneWhen).toHaveBeenCalledWith(false);
    view.getByText("The final print fits.");
    fireEvent.click(view.getByRole("button", { name: "Not yet" }));
    expect(onChoose).toHaveBeenCalledWith("not_yet");
  });
});

describe("LineProposalCard", () => {
  test("a case for done: It is done, or Not yet with what is missing", () => {
    const onAccept = mock(() => {});
    const onDecline = mock((_why: string) => {});
    const view = render(
      <LineProposalCard
        kind="done"
        line="L-1"
        title="Enclosure"
        text="Printed and fitted."
        by="panel"
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );
    view.getByText("Proposed done · L-1 · by panel");
    fireEvent.click(view.getByRole("button", { name: "Not yet…" }));
    fireEvent.change(view.getByLabelText("What L-1 still needs"), { target: { value: "The lid rattles" } });
    fireEvent.click(view.getByRole("button", { name: "Not yet" }));
    expect(onDecline).toHaveBeenCalledWith("The lid rattles");
    fireEvent.click(view.getByRole("button", { name: "It is done" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("a new done when: Accept, or keep the one there is at once", () => {
    const onDecline = mock((_why: string) => {});
    const view = render(
      <LineProposalCard
        kind="done_when"
        line="L-1"
        title="Enclosure"
        text="It holds the 30 mm board."
        by={null}
        onAccept={() => {}}
        onDecline={onDecline}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Keep the one there is" }));
    expect(onDecline).toHaveBeenCalledWith("");
  });
});

describe("a question's own choices", () => {
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
    fireEvent.click(owner.getByRole("button", { name: "Send" }));
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

describe("home's smaller pieces", () => {
  test("SpreadThin says nothing up to six working lines, then what it costs", () => {
    expect(render(<SpreadThin working={6} noOwner={3} waiting={2} />).container.textContent).toBe("");
    render(<SpreadThin working={8} noOwner={1} waiting={2} />).getByText(
      /8 lines are being worked on: 1 has no owner, 2 wait on you/,
    );
  });

  test("AtPicker offers each place as a button, and Leave once at one", () => {
    const onAt = mock((_place: string | null) => {});
    const view = render(<AtPicker places={["the bench", "the Mac"]} at={null} onAt={onAt} />);
    fireEvent.click(view.getByRole("button", { name: "I'm at…" }));
    fireEvent.click(view.getByRole("button", { name: "the Mac" }));
    expect(onAt).toHaveBeenCalledWith("the Mac");
    view.unmount();
    const there = render(<AtPicker places={["the bench"]} at="the bench" onAt={onAt} />);
    fireEvent.click(there.getByRole("button", { name: "At the bench" }));
    expect(onAt).toHaveBeenCalledWith(null);
    expect(render(<AtPicker places={[]} at={null} onAt={onAt} />).container.textContent).toBe("");
  });

  test("StartSheetView lists what a line holds and asks about a changed done when before Start now", () => {
    const onStart = mock(() => {});
    const onDoneWhen = mock((_accept: boolean) => {});
    const view = render(
      <StartSheetView
        line={line({ title: "Mount", doneWhenProposal: "It hangs flush." })}
        held={[{ ref: "D-4", kind: "question", title: "Which wall?", line: "L-1", current: true, since: "" }]}
        onDoneWhen={onDoneWhen}
        onStart={onStart}
        onCancel={() => {}}
      />,
    );
    view.getByRole("dialog", { name: "Start Mount" });
    view.getByText("Which wall?");
    fireEvent.click(view.getByRole("button", { name: "Keep current" }));
    expect(onDoneWhen).toHaveBeenCalledWith(false);
    fireEvent.click(view.getByRole("button", { name: "Start now" }));
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
    fireEvent.click(clone.getByRole("button", { name: "Set its checkout…" }));
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

describe("ReorderButtons in full", () => {
  test("a working line can also go to the top or to up next", () => {
    const onMove = mock((_direction: string) => {});
    const view = render(<ReorderButtons title="One" canMoveUp canMoveDown canQueue onMove={onMove} />);
    fireEvent.click(view.getByRole("button", { name: "Move One to the top" }));
    fireEvent.click(view.getByRole("button", { name: "Move One to up next" }));
    expect(onMove.mock.calls).toEqual([["top"], ["up_next"]]);
  });
});
