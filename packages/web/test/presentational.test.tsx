import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { BatchPanelView } from "../src/components/decisions/BatchPanelView.tsx";
import { DecisionCardView } from "../src/components/decisions/DecisionCardView.tsx";
import { DriftItem } from "../src/components/drift/DriftItem.tsx";
import { LinePanel } from "../src/components/entity/LinePanel.tsx";
import { FoldedSection } from "../src/components/home/FoldedSection.tsx";
import { ForYouRow } from "../src/components/home/ForYouRow.tsx";
import { HomeCounts } from "../src/components/home/HomeCounts.tsx";
import { HomeSection } from "../src/components/home/HomeSection.tsx";
import { LineMeta } from "../src/components/home/LineMeta.tsx";
import { ProposalCard } from "../src/components/home/ProposalCard.tsx";
import { QuietRow } from "../src/components/home/QuietRow.tsx";
import { ReorderButtons } from "../src/components/home/ReorderButtons.tsx";
import { StepIn } from "../src/components/home/StepIn.tsx";
import { TaskCard } from "../src/components/home/TaskCard.tsx";
import { UpNextRow } from "../src/components/home/UpNextRow.tsx";
import { WorkingLine } from "../src/components/home/WorkingLine.tsx";
import { eventTone, FeedItem } from "../src/components/feed/FeedItem.tsx";
import { FeedList } from "../src/components/feed/FeedList.tsx";
import { FilterBar } from "../src/components/feed/FilterBar.tsx";
import { IdeaRow } from "../src/components/ideas/IdeaRow.tsx";
import { IssueRow } from "../src/components/issues/IssueRow.tsx";
import { AddLineForm } from "../src/components/lines/AddLineForm.tsx";
import { SidebarView } from "../src/components/layout/SidebarView.tsx";
import { ProjectCardView } from "../src/components/projects/ProjectCardView.tsx";
import { PrGlyphs } from "../src/components/prs/PrGlyphs.tsx";
import { PrRow } from "../src/components/prs/PrRow.tsx";
import { PrStrip } from "../src/components/prs/PrStrip.tsx";
import { RoadmapLaneView } from "../src/components/roadmap/RoadmapLaneView.tsx";
import { SyncFailures } from "../src/components/prs/SyncFailures.tsx";
import { ListCapNote } from "../src/components/ui/ListCapNote.tsx";
import { Progress } from "../src/components/ui/Progress.tsx";
import { RefText } from "../src/components/ui/RefText.tsx";
import { EmptyState, ErrorState, LoadingState } from "../src/components/ui/states.tsx";
import type { LineHome } from "@octotrack/core/schemas";
import type { Tone } from "../src/lib/format.ts";
import {
  decision,
  decisionCard,
  decisionForm,
  drift,
  event,
  issue,
  issueCard,
  line,
  pr,
  prCard,
} from "../src/design/fixtures.ts";

const form = decisionForm;

describe("DecisionCardView", () => {
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

describe("IdeaRow", () => {
  const idea = {
    ref: "I-1",
    project: "OCT",
    title: "Big idea",
    body: "",
    status: "captured" as const,
    horizon: "none" as const,
    labels: [],
    promotedTo: null,
    version: 1,
    createdAt: "",
    updatedAt: "",
    createdBy: "x",
  };
  const handlers = { onHorizon: () => {}, onPromote: () => {}, onReject: () => {} };

  test("a live idea can be placed, promoted or rejected", () => {
    const onHorizon = mock(() => {});
    const onPromote = mock(() => {});
    const view = render(<IdeaRow idea={idea} {...handlers} onHorizon={onHorizon} onPromote={onPromote} />);
    fireEvent.change(view.getByLabelText("Roadmap horizon of I-1"), { target: { value: "next" } });
    expect(onHorizon).toHaveBeenCalledWith("I-1", "next");
    fireEvent.click(view.getByRole("button", { name: "Promote" }));
    expect(onPromote).toHaveBeenCalledWith("I-1");
  });

  test("promotion needs a project", () => {
    const view = render(<IdeaRow idea={{ ...idea, project: null }} {...handlers} />);
    expect(view.getByRole("button", { name: "Promote" }).hasAttribute("disabled")).toBe(true);
  });

  test("a promoted idea links to what it became and has no actions", () => {
    const view = render(
      <IdeaRow idea={{ ...idea, status: "promoted", promotedTo: "OCT-9" }} {...handlers} />,
    );
    view.getByRole("button", { name: "OCT-9" });
    expect(view.queryByRole("button", { name: "Promote" })).toBeNull();
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
    expect(view.getByRole("link", { name: "Ideas" })).toBeTruthy();
    view.getByText("live");
  });
});

describe("ProjectCardView and roadmap", () => {
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

  test("a roadmap lane shows items, progress and what they wait on", () => {
    const view = render(
      <RoadmapLaneView
        lane={{
          horizon: "now",
          items: [
            {
              ref: "M-1",
              kind: "milestone",
              title: "Beta",
              project: "OCT",
              status: "active",
              horizon: "now",
              targetDate: "2026-12-01",
              done: 1,
              total: 2,
              blockedBy: [],
              openDecisions: ["D-3"],
            },
          ],
        }}
      />,
    );
    view.getByRole("heading", { name: "Now" });
    view.getByText("Beta");
    view.getByText("1/2 done");
    view.getByText("2026-12-01");
    view.getByRole("button", { name: "D-3" });
  });

  test("an empty lane says so", () => {
    render(<RoadmapLaneView lane={{ horizon: "later", items: [] }} />).getByText("Nothing here.");
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

describe("lines of work", () => {
  const card = (overrides: Parameters<typeof decision>[0] = {}) =>
    decisionCard({ decision: decision(overrides) });
  const details = (overrides: Partial<LineHome> = {}): LineHome => ({
    step: null,
    forYou: [],
    held: { questions: 0, tasks: 0 },
    scopedSteps: 0,
    ...overrides,
  });

  test("HomeCounts names what waits, leaves out what does not, and marks urgent", () => {
    const view = render(
      <HomeCounts counts={{ toAnswer: 4, toDo: 0, toAccept: 1, toStepIn: 0, urgent: 1 }} />,
    );
    expect(view.getByLabelText("Waiting on you").textContent).toBe("1 urgent4 to answer1 to accept");
    expect(view.getByText("1 urgent").getAttribute("data-urgent")).toBe("true");
    view.unmount();
    render(<HomeCounts counts={{ toAnswer: 0, toDo: 0, toAccept: 0, toStepIn: 0, urgent: 0 }} />).getByText(
      "Nothing waits on you.",
    );
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
    const empty = render(
      <LineMeta crew={{ owner: null, helpers: [], scoper: null, search: { step: 3, since: "" } }} />,
    );
    empty.getByText("no owner: step in");
    empty.unmount();
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
    question.getByText("Recommended SQS: It is managed.");
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
    const view = render(
      <TaskCard
        task={issue({ title: "Measure the grip", place: "the bench", outcome: "Five numbers" })}
        onDone={onDone}
        onCant={onCant}
      />,
    );
    view.getByText("Report: Five numbers");
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
    const view = render(<StepIn line={line()} onOwn={onOwn} onTable={onTable} />);
    fireEvent.click(view.getByRole("button", { name: "I'll own it" }));
    expect(onOwn).toHaveBeenCalledWith("L-1");
    fireEvent.click(view.getByRole("button", { name: "Table it…" }));
    fireEvent.change(view.getByLabelText("Why table Sendspin enclosure"), { target: { value: "Later" } });
    fireEvent.click(view.getByRole("button", { name: "Table it" }));
    expect(onTable).toHaveBeenCalledWith("L-1", "Later");
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
    view.getByText("Done when it hangs flush.");
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
    view.getByText("panel-widgets says up next: The base is final.");
    fireEvent.click(view.getByRole("button", { name: "Up next Wall mount" }));
    expect(handlers.onQueue).toHaveBeenCalledWith("L-3");
    fireEvent.click(view.getByRole("button", { name: "Not a line: Wall mount" }));
    expect(handlers.onReject).toHaveBeenCalledWith("L-3");
    fireEvent.click(view.getByRole("button", { name: "Fold Wall mount" }));
    fireEvent.change(view.getByLabelText("Fold Wall mount into"), { target: { value: "L-1" } });
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
    expect(back.getByRole("button", { name: "Not a line: Sendspin enclosure" }).textContent).toBe("Drop");
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

  test("AddLineForm needs a title and a done-when sentence", () => {
    const onAdd = mock(() => {});
    const view = render(<AddLineForm onAdd={onAdd} />);
    const add = view.getByRole("button", { name: "Add line" });
    fireEvent.change(view.getByLabelText("New line"), { target: { value: "Garden sensor" } });
    expect(add.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Done when"), { target: { value: "Readings arrive hourly." } });
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith({ title: "Garden sensor", doneWhen: "Readings arrive hourly." });
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
