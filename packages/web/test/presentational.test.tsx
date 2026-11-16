import { navigate } from "../src/lib/router.ts";
import { HeldDecision } from "../src/components/decisions/HeldDecision.tsx";
import { OutcomeFields } from "../src/components/home/OutcomeFields.tsx";
import { LineBox } from "../src/components/ui/LineBox.tsx";
import { Loaded } from "../src/components/ui/Loaded.tsx";
import { TaskFrees } from "../src/components/entity/TaskFrees.tsx";
import { TaskClosed } from "../src/components/home/TaskClosed.tsx";
import { AppearanceMenu } from "../src/components/layout/AppearanceMenu.tsx";
import type { TaskOutcome } from "../src/lib/tasks.ts";
import { describe, expect, mock, test } from "bun:test";
import { useState } from "react";
import { act, fireEvent, render, renderHook, waitFor, within } from "@testing-library/react";
import { useReloadOnNewBuild } from "../src/hooks/useReloadOnNewBuild.ts";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { BatchPanelView } from "../src/components/decisions/BatchPanelView.tsx";
import { DecisionCardView } from "../src/components/decisions/DecisionCardView.tsx";
import { QuestionStrip } from "../src/components/decisions/QuestionStrip.tsx";
import { DriftItem } from "../src/components/drift/DriftItem.tsx";
import { LinePanelHead } from "../src/components/entity/LinePanelHead.tsx";
import { OwnerBox } from "../src/components/entity/OwnerBox.tsx";
import { PlanList } from "../src/components/entity/PlanList.tsx";
import { SummaryBox } from "../src/components/entity/SummaryBox.tsx";
import { FirstRun } from "../src/components/home/FirstRun.tsx";
import { ForYouRow } from "../src/components/home/ForYouRow.tsx";
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
import { FeedItem } from "../src/components/feed/FeedItem.tsx";
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
import type { Suggestion } from "../src/hooks/useSuggestions.ts";
import { LineActions } from "../src/components/entity/LineActions.tsx";
import { OwnWorkBox } from "../src/components/entity/OwnWorkBox.tsx";
import { TellBox } from "../src/components/entity/TellBox.tsx";
import { TableForm } from "../src/components/lines/TableForm.tsx";
import { TopBar } from "../src/components/layout/TopBar.tsx";
import { PagesMenu } from "../src/components/layout/PagesMenu.tsx";
import { UndoBar } from "../src/components/layout/UndoBar.tsx";
import { SyncFailures } from "../src/components/prs/SyncFailures.tsx";
import { Markdown } from "../src/components/ui/Markdown.tsx";
import { RefText } from "../src/components/ui/RefText.tsx";
import { TextBox } from "../src/components/ui/TextBox.tsx";
import { EmptyState, ErrorState, LoadingState } from "../src/components/ui/states.tsx";
import { EventList } from "../src/components/entity/EventList.tsx";
import { Pairs } from "../src/components/ui/Pairs.tsx";
import { LinkList } from "../src/components/entity/LinkList.tsx";
import { PullRequestBox } from "../src/components/entity/PullRequestBox.tsx";
import { AtPlaceItems } from "../src/components/home/AtPlaceItems.tsx";
import { AtUpNext } from "../src/components/home/AtUpNext.tsx";
import { CheckoutForm } from "../src/components/home/CheckoutForm.tsx";
import { FoldPicker } from "../src/components/home/FoldPicker.tsx";
import { LineForYou } from "../src/components/home/LineForYou.tsx";
import { LineStepIn } from "../src/components/home/LineStepIn.tsx";
import { MoreForYou } from "../src/components/home/MoreForYou.tsx";
import { NotKept } from "../src/components/ui/NotKept.tsx";
import { ApiError } from "../src/api/client.ts";
import type { HomeActions } from "../src/hooks/useHome.ts";
import { refOf } from "../src/lib/focus.ts";
import type {
  EntitySummary,
  ForYou,
  HomeView,
  Issue,
  LineCrew,
  LineHome,
  StepInKind,
  Link,
} from "@octotrack/core/schemas";
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
import { contracts, proposalMove, whole } from "./harness.tsx";

const form = decisionForm;

describe("DecisionCardView", () => {
  test("puts the reason for the recommendation inside the recommended option", () => {
    const view = render(
      <DecisionCardView
        form={form()}
        card={decisionCard({
          decision: decision({ recommendation: "redis", recommendationWhy: "It is already deployed." }),
        })}
      />,
    );
    const redis = view.getByRole("button", { name: /Redis/ });
    within(redis).getByText("Why:");
    within(redis).getByText(/It is already deployed\./);
  });

  test("shows what is needed to decide: question, context, options and the recommendation, not its ranking", () => {
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
    // The strip says who asked; what the question holds up and why it ranks are not drawn.
    expect(view.queryByText("2 agents waiting")).toBeNull();
    // Numbered for its key: the number is drawn by the button itself, so a touch screen can leave it out.
    expect(view.getByRole("button", { name: "SQS" }).getAttribute("data-choice")).toBe("1");
    view.getByText("Managed");
    const redis = view.getByRole("button", { name: /Redis/ });
    within(redis).getByText("Recommended");
    expect(redis.getAttribute("data-recommended")).toBe("true");
    expect(view.getByRole("button", { name: "SQS" }).getAttribute("data-recommended")).toBeNull();
    expect(view.queryByRole("button", { name: "OCT-4" })).toBeNull();
  });

  test("one press on an option answers it", () => {
    const answer = mock((_key: string) => {});
    const view = render(<DecisionCardView form={form({ answer })} card={decisionCard()} />);
    expect(view.queryByText("Focused")).toBeNull();
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
    fireEvent.change(empty.getByLabelText("Your answer, in your own words"), {
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
    view.getByLabelText("Your answer");
    view.getByText("Recommendation: Do it");
  });

  test("shows an error from the server", () => {
    const view = render(<DecisionCardView form={form({ error: "Already decided" })} card={decisionCard()} />);
    expect(view.getByRole("alert").textContent).toBe("Already decided");
  });

  test("the options sit under a Your answer label, which says so when nothing is recommended", () => {
    const view = render(<DecisionCardView form={form()} card={decisionCard()} />);
    view.getByText("Your answer");
    view.unmount();
    const none = render(
      <DecisionCardView
        form={form()}
        card={decisionCard({ decision: decision({ recommendation: null, requestedBy: "roadtrip" }) })}
      />,
    );
    none.getByText(whole("Your answer · roadtrip makes no recommendation"));
  });

  test("offers no Background: the question's ref in its strip opens it on its own", () => {
    const view = render(<DecisionCardView form={form()} card={decisionCard()} />);
    expect(view.queryByRole("button", { name: "Background" })).toBeNull();
    view.getByRole("button", { name: "D-1" });
  });

  test("an answer waiting with Undo is marked in the card, the rest step back, and Undo is right there", () => {
    const undo = mock(() => {});
    const view = render(
      <DecisionCardView
        form={form({
          waiting: { chosen: "redis", to: "New Year trip", dueAt: "2026-11-16T12:00:04Z", undo },
        })}
        card={decisionCard()}
        now={Date.parse("2026-11-16T12:00:00Z")}
      />,
    );
    const redis = view.getByRole("button", { name: /Redis/ });
    expect(redis.getAttribute("aria-pressed")).toBe("true");
    within(redis).getByText("✓");
    expect(view.getByRole("button", { name: "SQS" }).getAttribute("data-stepped")).toBe("true");
    view.getByText(whole("Sending to New Year trip in 4 s"));
    fireEvent.click(view.getByRole("button", { name: "Undo the answer to D-1" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("button", { name: "In my own words" })).toBeNull();
  });

  test("with no options the box for an answer in the developer's own words is already open", () => {
    const view = render(
      <DecisionCardView
        form={form({ ownWords: "" })}
        card={decisionCard({ decision: decision({ options: [], recommendation: null }) })}
      />,
    );
    expect(view.getByLabelText("Your answer").getAttribute("placeholder")).toBe("Write your answer");
    view.getByRole("button", { name: "Send" });
    view.getByRole("button", { name: "Later" });
    expect(view.queryByRole("button", { name: "Back to the options" })).toBeNull();
  });

  test("an answer in the developer's own words is labelled, says it saves as typed, and goes back keeping it", () => {
    const closeOwn = mock(() => {});
    const view = render(
      <DecisionCardView form={form({ ownWords: "Call Jasmin first", closeOwn })} card={decisionCard()} />,
    );
    view.getByLabelText("Your answer, in your own words");
    view.getByText("Saved as you type, on every device");
    fireEvent.click(view.getByRole("button", { name: "Back to the options" }));
    expect(closeOwn).toHaveBeenCalledTimes(1);
  });
});

describe("QuestionStrip, as drawn", () => {
  test("is the kind, the ref, who asked and how long ago, and nothing more", () => {
    const view = render(
      <QuestionStrip
        card={decisionCard({
          reasons: ["2 agents waiting"],
          decision: decision({ requestedBy: "roadtrip", createdAt: "2026-11-14T12:00:00Z" }),
        })}
        line={null}
        now={Date.parse("2026-11-16T12:00:00Z")}
      />,
    );
    view.getByText("asked by roadtrip");
    view.getByText("2d");
    expect(view.queryByText("2 agents waiting")).toBeNull();
  });

  test("a question put off says when", () => {
    const view = render(
      <QuestionStrip
        card={decisionCard({ decision: decision({ postponedAt: "2026-11-16T11:00:00Z" }) })}
        line={null}
        now={Date.parse("2026-11-16T12:00:00Z")}
      />,
    );
    view.getByText("Later");
    view.getByText("put off 1h ago");
  });
});

describe("QuestionStrip", () => {
  test("names the kind, its ref, who asked and how long ago, urgent ones too", () => {
    const view = render(
      <QuestionStrip
        card={decisionCard({
          decision: decision({
            urgentReason: "broken",
            requestedBy: "ttube",
            createdAt: "2026-11-16T09:00:00Z",
          }),
        })}
        line={null}
        now={Date.parse("2026-11-16T12:00:00Z")}
      />,
    );
    view.getByText(/^Urgent/);
    view.getByText("asked by ttube");
    view.getByText("3h");
  });
});

describe("FeedItem", () => {
  test("shows the summary with clickable refs, and the actor adds a filter; the repo is not drawn", () => {
    const onFilter = mock(() => {});
    const view = render(<FeedItem onFilter={onFilter} event={event({ summary: "OCT-1 moved, see D-3" })} />);
    view.getByRole("button", { name: "OCT-1" });
    view.getByRole("button", { name: "D-3" });
    fireEvent.click(view.getByRole("button", { name: "agent-a" }));
    expect(onFilter).toHaveBeenCalledWith("actor:agent-a");
    expect(view.queryByRole("button", { name: "OCT" })).toBeNull();
  });

  test("adds the ref when the summary does not mention it", () => {
    const view = render(<FeedItem onFilter={() => {}} event={event({ ref: "U-4", summary: "Half way" })} />);
    view.getByRole("button", { name: "U-4" });
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
    expect(
      within(view.getByRole("region", { name: "2026-11-05" })).getAllByText(/created: Thing/),
    ).toHaveLength(2);
    view.getByRole("region", { name: "2026-11-04" });
    expect(view.getAllByRole("region")).toHaveLength(2);
  });
});

/** A FilterBar whose words change as it is typed in, as the URL makes them on the Log. */
function TypedFilterBar({ text, suggestions }: { text: string; suggestions: readonly Suggestion[] }) {
  const [value, setValue] = useState(text);
  return <FilterBar value={value} error={null} suggestions={suggestions} onChange={setValue} />;
}

describe("FilterBar", () => {
  const suggestions = [
    { term: "kind:decision", hint: "" },
    { term: "kind:issue", hint: "" },
  ];

  test("shows errors", () => {
    const view = render(
      <FilterBar value="nope:1" error="Unknown field" suggestions={[]} onChange={() => {}} />,
    );
    expect(view.getByRole("alert").textContent).toBe("Unknown field");
  });

  test("offers suggestions only while focused, and completes the last word", () => {
    const onChange = mock(() => {});
    const view = render(
      <FilterBar value="status:open kind:" error={null} suggestions={suggestions} onChange={onChange} />,
    );
    expect(view.queryByText("kind:issue")).toBeNull();
    fireEvent.focus(view.getByLabelText("Filter"));
    fireEvent.click(view.getByText("kind:issue"));
    expect(onChange).toHaveBeenCalledWith("status:open kind:issue ");
  });

  test("a tap on a suggestion in Safari, where the input blurs before the tap arrives, still completes it", () => {
    const onChange = mock(() => {});
    const view = render(
      <FilterBar value="kind:" error={null} suggestions={suggestions} onChange={onChange} />,
    );
    const input = view.getByLabelText("Filter");
    fireEvent.focus(input);
    const issue = view.getByText("kind:issue");
    fireEvent.pointerDown(issue);
    fireEvent.blur(input, { relatedTarget: null });
    fireEvent.click(issue);
    expect(onChange).toHaveBeenCalledWith("kind:issue ");
  });

  test("the suggestions close on a tap elsewhere, on Esc, and when focus moves on", () => {
    const view = render(
      <div>
        <FilterBar value="kind:" error={null} suggestions={suggestions} onChange={() => {}} />
        <button type="button">Elsewhere</button>
      </div>,
    );
    const input = view.getByLabelText("Filter");
    const elsewhere = view.getByRole("button", { name: "Elsewhere" });
    fireEvent.focus(input);
    fireEvent.pointerDown(elsewhere);
    expect(view.queryByText("kind:issue")).toBeNull();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(view.queryByText("kind:issue")).toBeNull();
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: elsewhere });
    expect(view.queryByText("kind:issue")).toBeNull();
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

  test("a suggestion taken shows in the box, which keeps the cursor", async () => {
    const view = render(<TypedFilterBar text="ki" suggestions={suggestions} />);
    const input = view.getByLabelText("Filter");
    act(() => input.focus());
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(view.getByDisplayValue("kind:decision")).toBe(input);
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
    fireEvent.click(view.getByText("status:"));
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
    onClose: () => {},
  };

  test("cannot submit nothing, and counts what it will record", () => {
    const empty = render(<BatchPanelView {...base} />);
    expect(empty.getByRole("button", { name: /Record/ }).hasAttribute("disabled")).toBe(true);
    empty.unmount();
    const ready = render(<BatchPanelView {...base} parsed={[{ ref: "D-1", option: "a", note: null }]} />);
    const button = ready.getByRole("button", { name: "Record 1" });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  test("its box says the format, a row not understood stops Record and says which, results carry ✓ or ✗", () => {
    const view = render(
      <BatchPanelView
        {...base}
        parsed={[{ ref: "D-1", option: "a", note: null }]}
        parseError="Row 3 is not understood: D-75"
        results={[
          { ref: "D-1", ok: true, error: null },
          { ref: "D-2", ok: false, error: "already answered" },
        ]}
      />,
    );
    view.getByLabelText("One per row: the question, the option, a note if you like");
    view.getByRole("alert");
    view.getByText("Fix row 3 first");
    view.getByText("✓ recorded");
    view.getByText("✗ already answered");
  });

  test("says it is recording while it sends", () => {
    const view = render(
      <BatchPanelView {...base} parsed={[{ ref: "D-1", option: "a", note: null }]} submitting />,
    );
    expect(view.getByRole("button", { name: "Recording…" }).hasAttribute("disabled")).toBe(true);
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
    fireEvent.change(view.getByLabelText(/Note · required/), {
      target: { value: "  Kept open on purpose " },
    });
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

  test("while its answer waits with Undo, neither answer can be sent again", () => {
    const view = render(<DriftItem drift={drift({ edge: true })} busy onAck={() => {}} />);
    fireEvent.change(view.getByLabelText(/Note · required/), { target: { value: "Fine" } });
    expect(view.getByRole("button", { name: "Updated" }).hasAttribute("disabled")).toBe(true);
    expect(view.getByRole("button", { name: "Nothing to update" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("TopBar", () => {
  const counts = [
    { key: "toAnswer" as const, label: "to answer", count: 4, to: "D-56" },
    { key: "toAccept" as const, label: "to accept", count: 1, to: "L-6" },
    { key: "toStepIn" as const, label: "to step in", count: 1, to: "stepin:L-9" },
  ];

  test("puts Lines first: the name opens it, and Log and Agents are quieter places beside it", () => {
    const onAt = mock((_place: string | null) => {});
    const onNewLine = mock(() => {});
    const view = render(
      <TopBar
        appearance={{ palette: "paper", mode: "system" }}
        onPalette={() => {}}
        onMode={() => {}}
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
    expect(nav.getByRole("link", { name: "Octotrack" }).getAttribute("href")).toBe("/");
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual(["Octotrack", "Log", "Agents"]);
    expect(nav.getByRole("link", { name: "Log" }).getAttribute("aria-current")).toBe("page");
    expect(nav.getByRole("link", { name: "Octotrack" }).getAttribute("aria-current")).toBeNull();
    expect(view.getByRole("link", { name: "4 to answer" }).getAttribute("href")).toBe("/?focus=D-56");
    expect(view.getByRole("link", { name: "1 to step in" }).getAttribute("href")).toBe(
      "/?focus=stepin%3AL-9",
    );
    expect(view.queryByRole("combobox")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "I'm at: All places" }));
    const menu = within(view.getByRole("menu", { name: "I'm at" }));
    expect(menu.getByRole("menuitemradio", { name: "All places" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(menu.getByRole("menuitemradio", { name: "the Mac" }));
    expect(onAt).toHaveBeenCalledWith("the Mac");
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "New line" }));
    expect(onNewLine).toHaveBeenCalledTimes(1);
  });

  test("on a phone, the pages wait behind one quiet menu instead of a bar of equal tabs", () => {
    const go = mock((_to: string) => {});
    const view = render(
      <PagesMenu
        path="/"
        onGo={go}
        appearance={{ palette: "paper", mode: "system" }}
        onPalette={() => {}}
        onMode={() => {}}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Pages: Lines" }));
    const menu = within(view.getByRole("menu", { name: "Pages" }));
    // The check before the page you are on is drawn for the eye only; the items name themselves.
    expect(menu.getAllByRole("menuitemradio").map((item) => item.textContent?.replace("✓", ""))).toEqual([
      "Lines",
      "Log",
      "Agents",
    ]);
    expect(menu.getByRole("menuitemradio", { name: "Lines" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Agents" }));
    expect(go).toHaveBeenCalledWith("/agents");
    expect(view.queryByRole("menu")).toBeNull();
  });

  test("draws the counts as one group of number and words, with urgent apart in front of it", () => {
    const view = render(
      <TopBar
        appearance={{ palette: "paper", mode: "system" }}
        onPalette={() => {}}
        onMode={() => {}}
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
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/?focus=D-60", "/?focus=D-56", "/?focus=L-6", "/?focus=stepin%3AL-9"]);
    const urgent = within(status).getByRole("link", { name: "1 urgent" });
    expect(urgent.getAttribute("data-urgent")).toBe("true");
    // Its mark is Status's for urgent, ▲, never colour alone.
    within(urgent).getByText("▲");
    // The number is its own piece, in ink, before the quieter words.
    expect(urgent.querySelector("b")?.textContent).toBe("1");
    expect(within(status).getByRole("link", { name: "4 to answer" }).getAttribute("data-urgent")).toBeNull();
  });

  test("never names the page twice: on Lines, the name is the way home and marks the page", () => {
    const view = render(
      <TopBar
        appearance={{ palette: "paper", mode: "system" }}
        onPalette={() => {}}
        onMode={() => {}}
        path="/"
        counts={counts}
        places={[]}
        at={null}
        onAt={() => {}}
        onNewLine={() => {}}
        onKeys={() => {}}
      />,
    );
    const bar = view.getByRole("banner");
    expect((bar.textContent ?? "").split("Lines").length - 1).toBeLessThanOrEqual(1);
    expect(within(bar).getByRole("link", { name: "Octotrack" }).getAttribute("aria-current")).toBe("page");
  });

  test("leaves out I'm at when the developer has no places, and the counts when nothing waits", () => {
    const view = render(
      <TopBar
        appearance={{ palette: "paper", mode: "system" }}
        onPalette={() => {}}
        onMode={() => {}}
        path="/"
        counts={[]}
        places={[]}
        at={null}
        onAt={() => {}}
        onNewLine={() => {}}
        onKeys={() => {}}
      />,
    );
    expect(view.queryByRole("button", { name: /I'm at/ })).toBeNull();
    expect(view.queryByRole("status", { name: "Waiting on you" })).toBeNull();
  });
});

describe("small pieces", () => {
  test("sync failures name the repo and the reason", () => {
    const view = render(<SyncFailures failures={[{ repo: "a/b", error: "Boom", updatedAt: "" }]} />);
    view.getByText("Pull request status is stale for a/b");
    view.getByText(/Boom\. It picks up again by itself/);
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
    article.getByText(/panel, asleep/);
    article.getByText(/waiting on you/);
    article.getByText(/step 3 of 4, settle board and opening/);
    article.getByText("Printed; the short board fits.");
    article.getByText("child");
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
    expect(empty.getByText(/no owner: step in/).getAttribute("data-tone")).toBe("stuck");
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
        label="Question D-1"
        focused={false}
        onOpen={onOpen}
      />,
    );
    question.getByText(whole("Question · D-1"));
    question.getByText(whole("Recommended: SQS · It is managed."));
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
        label="Task OCT-7"
        focused={false}
        onOpen={onOpen}
      />,
    );
    task.getByText(whole("Task · OCT-7 · at the Mac"));
    // What it frees, not what to report, which the task says once opened.
    task.getByText(whole("Frees OCT-41: the real wake test"));
    expect(task.queryByText(/Report:/)).toBeNull();
    task.unmount();
    const unlinked = render(
      <ForYouRow
        item={{ kind: "task", task: issue({ ref: "OCT-8", outcome: "Yes or no" }), frees: null }}
        label="Task OCT-8"
        focused={false}
        onOpen={onOpen}
      />,
    );
    unlinked.getByText(whole("Yes or no"));
  });

  test("TaskCard with named outcomes has a box for each and a note, counts what is filled, and needs them all", () => {
    const onDone = mock(() => {});
    const view = render(<TypingTask onDone={onDone} onCant={() => {}} fields={["Length", "Holes"]} />);
    view.getByText("0 of 2 filled · saved as you type");
    fireEvent.change(view.getByLabelText("Length"), { target: { value: "41 mm" } });
    view.getByText(/1 of 2 filled/);
    expect(view.getByRole("button", { name: "Done" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Holes"), { target: { value: " 38 " } });
    fireEvent.change(view.getByLabelText("Note"), { target: { value: "Warped" } });
    view.getByText(/2 of 2 filled/);
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith({ values: { Length: "41 mm", Holes: "38" }, result: "Warped" });
  });

  test("TaskCard shows what to send back as a form, and Can't do it asks why, in a box of its own", () => {
    const onDone = mock(() => {});
    const onCant = mock(() => {});
    const view = render(<TypingTask onDone={onDone} onCant={onCant} />);
    // The task's own prompt for its outcome labels the box.
    expect(view.getByLabelText("Five numbers")).toHaveProperty("value", "");
    expect(view.getByRole("button", { name: "Done" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Five numbers"), { target: { value: " 41, 38 " } });
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
        reason="the agent command is not logged in"
        onRetry={onRetry}
        onOwn={onOwn}
        onTable={onTable}
      />,
    );
    view.getByText("the agent command is not logged in");
    fireEvent.click(view.getByRole("button", { name: "Try now" }));
    expect(onRetry).toHaveBeenCalledWith("L-1");
    fireEvent.click(view.getByRole("button", { name: "I'll own it" }));
    expect(onOwn).toHaveBeenCalledWith("L-1");
    fireEvent.click(view.getByRole("button", { name: "Table it" }));
    const sheet = within(view.getByRole("dialog", { name: "Table Sendspin enclosure" }));
    fireEvent.change(sheet.getByLabelText("Why it waits"), { target: { value: "Later" } });
    fireEvent.click(sheet.getByRole("button", { name: "Table it" }));
    expect(onTable).toHaveBeenCalledWith("L-1", "Later", null);
    expect(view.queryByRole("dialog")).toBeNull();
  });

  test("UpNextRow says what it holds and how far scoping got, and starts", () => {
    const onStart = mock(() => {});
    const view = render(
      <UpNextRow
        line={line({ state: "up_next", title: "Wall mount", doneWhen: "it hangs flush." })}
        details={details({ held: { questions: 0, tasks: 1 } })}
        onStart={onStart}
      />,
    );
    view.getByText(/1 task held/);
    view.getByText("not scoped");
    // It holds something, so Start opens the Start sheet first.
    expect(view.getByRole("button", { name: "Start Wall mount" }).textContent).toBe("Start");
    expect(view.queryByText(/it hangs flush\./)).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Start Wall mount" }));
    expect(onStart).toHaveBeenCalledWith("L-1");
  });

  test("UpNextRow and LineMeta say how much held work waits to be re-confirmed, and nothing when none does", () => {
    const row = render(
      <UpNextRow
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
        repoKeys={["PANEL"]}
        lastUpNext="Firmware without casts"
        {...handlers}
      />,
    );
    view.getByText("PANEL");
    view.getByText("proposed by panel-widgets");
    view.getByText(whole("Recommends Up next, after Firmware without casts: The base is final."));
    view.getByText("The base is final.");
    // The recommended choice is the one button, filled; the rest are under Other.
    expect(view.getByRole("button", { name: "Up next Wall mount" }).getAttribute("data-variant")).toBe(
      "primary",
    );
    expect(view.queryByRole("button", { name: "Start Wall mount" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Up next Wall mount" }));
    expect(handlers.onQueue).toHaveBeenCalledWith("L-3");
    proposalMove(view, "Not a line:", "Wall mount");
    expect(handlers.onReject).toHaveBeenCalledWith("L-3");
    proposalMove(view, "Fold", "Wall mount");
    // A button per line, never a select that folds as soon as an arrow key moves it.
    expect(view.queryByRole("combobox")).toBeNull();
    fireEvent.click(
      within(view.getByRole("dialog", { name: "Fold Wall mount into…" })).getByRole("button", {
        name: "Sendspin enclosure",
      }),
    );
    expect(handlers.onFold).toHaveBeenCalledWith("L-3", "L-1");
    view.unmount();
    const back = render(
      <ProposalCard
        line={line({ state: "proposed", tabledReason: "The disk is not tight", lookAgainAt: "2027-02-01" })}
        foldTargets={[]}
        {...handlers}
      />,
    );
    back.getByText(whole("Tabled: The disk is not tight · look again on 1 February 2027"));
    fireEvent.click(back.getByRole("button", { name: "Other moves for Sendspin enclosure" }));
    expect(back.queryByRole("menuitem", { name: "Not a line" })).toBeNull();
    fireEvent.click(back.getByRole("menuitem", { name: "Drop" }));
    expect(handlers.onDrop).toHaveBeenCalledWith("L-1");
    expect(handlers.onReject).toHaveBeenCalledTimes(1);
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
    view.getByText("look again on 5 January 2027");
    fireEvent.click(view.getByRole("button", { name: "Start Sendspin enclosure" }));
    expect(onStart).toHaveBeenCalledWith("L-1");
  });
});

describe("a line opened", () => {
  test("LinePanelHead says how the line stands, its ref and repos, and what finishes it", () => {
    const view = render(<LinePanelHead line={line({ ref: "L-7" })} repos={["vasc/homepanel"]} />);
    view.getByText("Working on");
    view.getByText("vasc/homepanel");
    view.getByRole("heading", { name: "Sendspin enclosure" });
    view.getByText("A printed case holds the board and takes the USB-C plug.");
    view.getByRole("button", { name: "Close" });
  });

  test("SummaryBox puts the headline first, says how old it is, and says when there is none", () => {
    const view = render(
      <SummaryBox
        line={line({
          headline: "Printed; it fits.",
          summary: "The base is printed.",
          summaryAt: "2026-11-14T09:40:00Z",
        })}
        now={Date.parse("2026-11-14T10:40:00Z")}
      />,
    );
    view.getByText("Printed; it fits.");
    view.getByText("The base is printed.");
    view.getByText("1h ago");
    view.unmount();
    render(<SummaryBox line={line()} />).getByText("No summary yet. Its owner writes one.");
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
    view.getByRole("heading", { name: "Plan" });
    view.getByText("step 2 of 3");
    for (const [mark, word, step] of [
      ["✓", "done", "Model"],
      ["→", "now", "Print"],
      ["○", "next", "Photograph"],
    ] as const) {
      view.getByText(mark);
      view.getByText(word);
      view.getByText(step);
    }
    view.getByRole("button", { name: "OCT-6" });
    view.getByText("Test-print");
    view.getByText("✗ checks failing");
    view.unmount();
    render(<PlanList steps={[]} work={[]} />).getByText("No plan yet. Its owner writes one.");
  });

  test("OwnerBox names the owner and how it is, or that there is none and why", () => {
    const crew = (state: "asleep" | "running" | "quiet"): LineCrew => ({
      owner: { name: "panel-widgets", state },
      helpers: [],
      scoper: null,
      search: null,
    });
    const props = { line: line(), repoNames: ["OCT"], onStop: () => {}, onOwn: () => {} };
    const asleep = render(<OwnerBox {...props} crew={crew("asleep")} waitingOnYou />);
    asleep.getByText("panel-widgets");
    asleep.getByText("asleep");
    asleep.getByText("waits on you");
    asleep.unmount();
    const helped = render(
      <OwnerBox
        {...props}
        crew={{ ...crew("running"), helpers: [{ name: "helper-a", state: "running" }] }}
        waitingOnYou={false}
      />,
    );
    helped.getByText("running");
    helped.getByText("helping: helper-a");
    expect(helped.queryByText("waits on you")).toBeNull();
    helped.unmount();
    // With no owner: still being looked for, or why none can be found, as Step in says.
    render(<OwnerBox {...props} crew={undefined} />).getByText("no owner");
    render(<OwnerBox {...props} line={line({ ownedBy: "dev" })} crew={undefined} />).getByText("You");
  });

  test("OwnerBox offers Stop on the owner and I'll own it, and nothing on a line of yours", () => {
    const onStop = mock((_name: string) => {});
    const crew: LineCrew = {
      owner: { name: "panel", state: "asleep" },
      helpers: [],
      scoper: null,
      search: null,
    };
    const view = render(
      <OwnerBox line={line()} crew={crew} repoNames={["OCT"]} onStop={onStop} onOwn={() => {}} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Stop panel" }));
    expect(onStop).toHaveBeenCalledWith("panel");
    view.getByRole("button", { name: "I'll own it" });
    view.unmount();
    const mine = render(
      <OwnerBox
        line={line({ ownedBy: "dev", repos: [] })}
        crew={undefined}
        repoNames={[]}
        onStop={onStop}
        onOwn={() => {}}
      />,
    );
    expect(mine.queryByRole("button")).toBeNull();
  });

  test("OwnWorkBox hands a line with no repo over only once one is picked", () => {
    const onHand = mock((_repos: string[]) => {});
    const mine = render(
      <OwnWorkBox
        line="L-2"
        words=""
        onWords={() => {}}
        onTask={() => {}}
        onNote={() => {}}
        repos={[]}
        allRepos={["OCT"]}
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

  test("says each waiting choice and when it takes effect, newest first, with Undo", () => {
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
    view.getByText(whole('Sending "26 mm" to Sendspin enclosure in 8 s'));
    view.getByText(whole("Starting Wall mount in 1 s"));
    // Newest first.
    expect(view.getByRole("status").textContent?.indexOf("26 mm")).toBeLessThan(
      view.getByRole("status").textContent?.indexOf("Starting Wall mount") ?? 0,
    );
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
    waits.getByText(whole("Stopping panel-widgets in 8 s. Sendspin enclosure waits on you."));
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
    ).getByText(whole("Stopping panel-widgets in 8 s. Sendspin enclosure looks for another owner."));
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
    expect(view.getByRole("alert").textContent).toBe("Did not happen: Starting Wall mount. It is done.");
    fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
    expect(onUndo).toHaveBeenCalledWith(4);
  });
});

describe("agents and first run", () => {
  test("FirstRun accepts every recommended placement it can, says when there is none to accept, and how to start", () => {
    const onAccept = mock((_refs: string[]) => {});
    const view = render(
      <FirstRun
        proposals={[
          line({ ref: "L-1", state: "proposed", recommendation: "up_next" }),
          line({ ref: "L-2", state: "proposed", recommendation: "fold" }),
          line({ ref: "L-3", state: "proposed", recommendation: "start" }),
        ]}
        onAccept={onAccept}
        onNewLine={() => {}}
      />,
    );
    const first = within(view.getByRole("region", { name: "Nothing is placed yet" }));
    // A fold needs a line to fold into, so it is not a placement to accept at once.
    first.getByText(/3 carry a recommendation: 1 to start, 1 for up next and 1 to fold\./);
    fireEvent.click(first.getByRole("button", { name: "Accept 2 recommendations" }));
    expect(onAccept).toHaveBeenCalledWith(["L-1", "L-3"]);
    view.unmount();
    const old = render(
      <FirstRun
        proposals={[line({ ref: "L-1", state: "proposed", recommendation: null })]}
        onAccept={onAccept}
        onNewLine={() => {}}
      />,
    );
    old.getByText(/None carries a recommendation\. 1 has none\./);
    expect(old.queryByRole("button")).toBeNull();
    old.unmount();
    const none = render(<FirstRun proposals={[]} onAccept={onAccept} onNewLine={() => {}} />);
    none.getByText("No lines yet");
    none.getByText("octo guide");
  });
});

describe("PushToggle, failing", () => {
  test("announces why buzzing could not be turned on", () => {
    const view = render(
      <PushToggle state="off" error="Permission denied" onTurnOn={() => {}} onTurnOff={() => {}} />,
    );
    expect(view.getByRole("alert").textContent).toBe("Permission denied");
  });
});

describe("PushToggle", () => {
  const props = { error: null, onTurnOn: () => {}, onTurnOff: () => {} };

  test("offers to buzz this device until it does, and Stop turns it off again", () => {
    const onTurnOn = mock(() => {});
    const onTurnOff = mock(() => {});
    const off = render(<PushToggle {...props} state="off" onTurnOn={onTurnOn} />);
    fireEvent.click(off.getByRole("button", { name: "Buzz this device" }));
    expect(onTurnOn).toHaveBeenCalledTimes(1);
    off.unmount();
    render(<PushToggle {...props} state="turning-on" />).getByText("Turning on…");
    const on = render(<PushToggle {...props} state="on" onTurnOff={onTurnOff} />);
    on.getByText(/Buzzing this device/);
    fireEvent.click(on.getByRole("button", { name: "Stop" }));
    expect(onTurnOff).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      "blocked",
      "Notifications are blocked for this site. Allow them in the browser's site settings, then press again.",
    ],
    ["dismissed", "You dismissed the browser's question; press again to be asked once more."],
    ["unsupported", "This browser cannot buzz. On iPhone, add Octotrack to the home screen first."],
    ["no-key", "This tracker does not send notifications: it has no push key."],
  ] as const)("when %s, says why and what to do", (state, words) => {
    render(<PushToggle {...props} state={state} />).getByText(words);
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
    fireEvent.change(view.getByLabelText("Why it waits"), { target: { value: "  After the move  " } });
    fireEvent.click(table);
    expect(onTable).toHaveBeenCalledWith("After the move", null);
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("TableForm says what tabling does to what the line holds and to its agents, and asks when to look again", () => {
    const view = render(
      <TableForm
        title="Podcast cleanup"
        held={{ questions: 2, tasks: 0 }}
        owner="mediarr"
        onTable={() => {}}
        onCancel={() => {}}
      />,
    );
    const sheet = within(view.getByRole("dialog", { name: "Table Podcast cleanup" }));
    sheet.getByRole("heading", { name: "Table Podcast cleanup" });
    expect(document.activeElement).toBe(sheet.getByLabelText("Why it waits"));
    sheet.getByText("Tabling holds 2 questions until it starts again; mediarr winds down.");
    expect(sheet.getByLabelText("Look again on · optional").getAttribute("type")).toBe("date");
  });

  test("LineActions offers the moves each state allows, the rare ones under More, Done at once", () => {
    const onChoose = mock((_choice: string) => {});
    const props = { onChoose, onTable: () => {} };
    const names = (view: ReturnType<typeof render>) =>
      view.getAllByRole("button").map((button) => button.textContent);
    const working = render(<LineActions line={line()} owner="panel" {...props} />);
    // More says so in words, and its full name is for a screen reader.
    expect(names(working)).toEqual(["Done", "Move to up next", "Table", "More"]);
    // Done waits with Undo like every choice, so it asks nothing first.
    fireEvent.click(working.getByRole("button", { name: "Done" }));
    expect(onChoose).toHaveBeenCalledWith("done");
    expect(working.queryByText("Done is final.")).toBeNull();
    fireEvent.click(working.getByRole("button", { name: "More: drop this line, fold it into another" }));
    // Nothing to fold into: Fold into is not offered at all.
    expect(working.queryByRole("menuitem", { name: "Fold into another" })).toBeNull();
    fireEvent.click(working.getByRole("menuitem", { name: "Drop" }));
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
    fireEvent.click(folding.getByRole("menuitem", { name: "Fold into another" }));
    fireEvent.click(
      within(folding.getByRole("dialog", { name: "Fold Sendspin enclosure into…" })).getByRole("button", {
        name: "Mount",
      }),
    );
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
    fireEvent.click(
      within(proposed.getByRole("dialog", { name: "Fold Sendspin enclosure into…" })).getByRole("button", {
        name: "Mount",
      }),
    );
    expect(onFold).toHaveBeenCalledWith("L-2");
    proposed.unmount();
    const done = render(<LineActions line={line({ state: "done" })} {...props} />);
    expect(done.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("LineProposalCard", () => {
  test("a case for done is titled by its line, labels its done when and its case, then Done or Not yet…", () => {
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
    const item = within(view.getByRole("article", { name: "Answer delivery is done?" }));
    item.getByText(whole("Proposed as done · by octotrack-builder"));
    item.getByRole("heading", { name: "Answer delivery" });
    item.getByText("Done when");
    item.getByText("an answer reaches whoever owns its line");
    item.getByText("Its case");
    item.getByText("The owner was woken from the inbox and reported it carried out.");
    fireEvent.click(view.getByRole("button", { name: "Not yet…" }));
    fireEvent.change(view.getByLabelText("What it still needs"), { target: { value: "One real wake" } });
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    expect(onDecline).toHaveBeenCalledWith("One real wake");
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  test("a changed done when puts the old and the new side by side, with why; Keep current keeps the old at once", () => {
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
    const item = within(view.getByRole("article", { name: "New done when for Firmware without casts" }));
    item.getByText(whole("Done when changed · by firmware"));
    item.getByRole("heading", { name: "Firmware without casts" });
    item.getByText("Was");
    item.getByText("the panel firmware builds with the no-casts rule on");
    item.getByText("Proposed");
    item.getByText("…on, and CI fails on a new cast");
    item.getByText(/without CI, casts creep back\./);
    expect(view.getByRole("button", { name: "Accept" }).getAttribute("data-choice")).toBe("1");
    fireEvent.click(view.getByRole("button", { name: "Keep current" }));
    expect(onDecline).toHaveBeenCalledWith("");
  });
});

describe("a question's own choices", () => {
  test("an urgent question says so, why, and which line it stands apart from", () => {
    const view = render(
      <DecisionCardView
        form={decisionForm()}
        card={decisionCard({ decision: decision({ ref: "D-60", urgentReason: "broken" }) })}
        line={{ ref: "L-5", number: 3, title: "Quiet household trial" }}
      />,
    );
    const strip = view.getByRole("article").textContent ?? "";
    expect(strip).not.toContain("Focused");
    expect(strip).toContain("Urgent · something broken");
    expect(strip).toContain("3 · Quiet household trial");
    expect(strip).toContain("D-60");
  });

  test("ForYouRow says an urgent question is urgent, with its reason", () => {
    const view = render(
      <ForYouRow
        item={{
          kind: "question",
          card: decisionCard({ decision: decision({ ref: "D-60", urgentReason: "time_boxed" }) }),
        }}
        label="Question D-60"
        focused={false}
        onOpen={() => {}}
      />,
    );
    const row = view.getByRole("button", { name: "Open D-60" });
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
    owner.getByLabelText("Tell octo.1");
    fireEvent.click(owner.getByRole("button", { name: "Tell" }));
    expect(onSend).toHaveBeenCalledWith("Black");
  });

  test("OwnWorkBox adds what is typed as a task or a note, and nothing when empty", () => {
    const onTask = mock((_title: string) => {});
    const onNote = mock((_body: string) => {});
    const hand = { repos: ["OCT"], allRepos: ["OCT"], onHand: () => {} };
    const empty = render(
      <OwnWorkBox line="L-2" words="" onWords={() => {}} onTask={onTask} onNote={onNote} {...hand} />,
    );
    expect(empty.getByRole("button", { name: "Add as a task" }).hasAttribute("disabled")).toBe(true);
    empty.unmount();
    const typed = render(
      <OwnWorkBox
        line="L-2"
        words="Scan receipts"
        onWords={() => {}}
        onTask={onTask}
        onNote={onNote}
        {...hand}
      />,
    );
    fireEvent.click(typed.getByRole("button", { name: "Add as a note" }));
    expect(onNote).toHaveBeenCalledWith("Scan receipts");
  });

  test("TableForm sends a look-again date when one is given", () => {
    const onTable = mock((_reason: string, _lookAgainAt: string | null) => {});
    const view = render(<TableForm title="Trip" onTable={onTable} onCancel={() => {}} />);
    fireEvent.change(view.getByLabelText("Why it waits"), { target: { value: "Winter" } });
    fireEvent.change(view.getByLabelText("Look again on · optional"), { target: { value: "2027-03-01" } });
    fireEvent.click(view.getByRole("button", { name: "Table it" }));
    expect(onTable).toHaveBeenCalledWith("Winter", "2027-03-01");
  });
});

describe("I'm at a place", () => {
  test("AtSection says where, when it ends by itself, with Leave", () => {
    const onLeave = mock(() => {});
    const now = Date.parse("2026-11-14T09:00:00.000Z");
    const view = render(
      <AtSection
        at={{ place: "the bench", until: "2026-11-14T13:00:00.000Z", tasks: [] }}
        now={now}
        onLeave={onLeave}
      />,
    );
    const place = within(view.getByRole("article", { name: "At the bench" }));
    place.getByText("At the bench");
    place.getByText("ends by itself in 4h");
    fireEvent.click(place.getByRole("button", { name: "Leave" }));
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
    const sheet = view.getByRole("dialog", { name: "Keys" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(sheet, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("ForYouRow is one row until it has focus, then the item itself", () => {
    const item = {
      kind: "question" as const,
      card: decisionCard({ decision: decision({ ref: "D-7", title: "Which?" }) }),
    };
    const row = render(
      <ForYouRow item={item} label="Question D-7, Which?" focused={false} onOpen={() => {}} />,
    );
    row.getByRole("button", { name: "Open D-7" });
    row.unmount();
    const open = render(
      <QueryClientProvider client={new QueryClient()}>
        <ForYouRow item={item} label="Question D-7, Which?" focused onOpen={() => {}}>
          <ForYouItem
            item={item}
            title="Enclosure"
            armed
            onTaskDone={() => {}}
            onTaskCant={() => {}}
            onLineDone={() => {}}
            onNotYet={() => {}}
            onDoneWhen={() => {}}
          />
        </ForYouRow>
      </QueryClientProvider>,
    );
    expect(open.queryByRole("button", { name: "Open D-7" })).toBeNull();
    within(open.getByRole("group", { name: "Question D-7, Which?" })).getByRole("article", {
      name: "Which?",
    });
  });
});

describe("NothingNeedsYou", () => {
  test("is the calm state: says nothing needs you, who is working, and where the next ask likely comes from", () => {
    const view = render(
      <NothingNeedsYou working={3} next={{ title: "Sendspin enclosure", step: "model the opening" }} />,
    );
    const calm = within(view.getByRole("region", { name: "Nothing needs you" }));
    calm.getByText("Nothing needs you");
    calm.getByText("3 agents working");
    calm.getByText(/the next ask likely comes from Sendspin enclosure, model the opening/);
  });

  test("says so plainly when no agent is working and no line has a next step", () => {
    const view = render(<NothingNeedsYou working={0} next={null} />);
    view.getByText("no agents working");
    expect(view.queryByText(/next ask/)).toBeNull();
  });
});

describe("home's smaller pieces", () => {
  test("SpreadThin says nothing up to six working lines, then what spreading thin costs, in the header", () => {
    expect(render(<SpreadThin working={6} noOwner={3} waiting={2} />).container.textContent).toBe("");
    const view = render(<SpreadThin working={9} noOwner={3} waiting={2} />);
    view.getByText("3 with no owner");
    view.getByText("2 waiting on you");
    expect(view.getByText("3 with no owner").getAttribute("data-tone")).toBe("stuck");
    expect(view.getByText("2 waiting on you").getAttribute("data-tone")).toBeNull();
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
    // The old done when and the sharpened one side by side, with why.
    view.getByText("it builds with the no-casts rule on");
    view.getByText("…on, and CI fails on a new cast");
    view.getByText(whole("Why: without CI, casts creep back."));
    const numbers = view.getAllByRole("button").flatMap((button) => {
      const number = button.getAttribute("data-choice");
      return number === null ? [] : [[number, button.getAttribute("aria-label") ?? button.textContent]];
    });
    expect(numbers).toEqual([
      ["1", "Accept"],
      ["2", "Keep current"],
      ["3", "Checked conversions, recommended"],
      ["4", "Typed helpers"],
    ]);
    const recommended = view.getByRole("button", { name: "Checked conversions, recommended" });
    within(recommended).getByText("Recommended");
    within(recommended).getByText(/a bad value should fail loudly\./);
    expect(view.getByRole("button", { name: "Typed helpers" }).getAttribute("data-recommended")).toBeNull();
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

  test("StepIn's way forward is the filled main action, never a red button that urges", () => {
    const view = render(
      <StepIn
        line={line()}
        reason="No start command."
        onRetry={() => {}}
        onOwn={() => {}}
        onTable={() => {}}
      />,
    );
    const tryNow = view.getByRole("button", { name: "Try now" });
    expect(tryNow.getAttribute("data-variant")).toBe("primary");
    expect(tryNow.getAttribute("data-tone")).toBeNull();
    expect(view.getByRole("button", { name: "Table it" }).getAttribute("data-variant")).toBe("plain");
  });
});

describe("LineHandle", () => {
  test("is the one way to reorder: drag it, or open it for Top, Up, Down and To up next", () => {
    const onMove = mock((_direction: string) => {});
    const drag = { onDragStart: mock(() => {}), onDragEnd: mock(() => {}) };
    const view = render(
      <LineHandle title="One" number={1} canMoveUp canMoveDown canQueue drag={drag} onMove={onMove} />,
    );
    const handle = view.getByRole("button", { name: "Move One" });
    // The handle is the line's number in the order.
    expect(handle.textContent).toBe("1");
    expect(handle.getAttribute("draggable")).toBe("true");
    const carried: string[] = [];
    fireEvent.dragStart(handle, {
      dataTransfer: { setData: (_type: string, data: string) => carried.push(data) },
    });
    expect(drag.onDragStart).toHaveBeenCalledTimes(1);
    expect(carried).toEqual(["One"]);
    fireEvent.dragEnd(handle);
    expect(drag.onDragEnd).toHaveBeenCalledTimes(1);
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
    const view = render(
      <LineHandle title="One" number={1} canMoveUp canMoveDown canQueue onMove={() => {}} />,
    );
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
    const view = render(
      <LineHandle title="One" number={1} canMoveUp={false} canMoveDown onMove={() => {}} />,
    );
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

  test("AnswerStatus says the question, the answer, and what became of it, as E-States writes it", () => {
    // The question's ref, the answer given as the title, and what became of it under it.
    const sentence = (item: LineHome["answers"][number]) => {
      const view = render(<AnswerStatus answer={item} />);
      view.getByRole("button", { name: "D-34" });
      view.getByText("26 mm");
      const status = view.getByText(
        /^(not picked up|picked up|✓ carried out|.* could not be woken)/,
      ).textContent;
      view.unmount();
      return status;
    };
    expect(sentence(answer({}))).toBe("not picked up yet");
    expect(
      sentence(
        answer({
          status: "picked_up",
          by: "panel-widgets",
          at: new Date(Date.now() - 4 * 60_000).toISOString(),
        }),
      ),
    ).toBe("picked up by panel-widgets, 4m ago");
    expect(sentence(answer({ status: "carried_out", note: "model set to the short board" }))).toBe(
      "✓ carried out: model set to the short board",
    );
    expect(sentence(answer({ status: "wake_failed", unwoken: "panel-widgets" }))).toBe(
      "panel-widgets could not be woken; finding an owner",
    );
  });

  test("AnswerStatus offers Change answer, which opens the question", () => {
    const view = render(<AnswerStatus answer={answer({ status: "carried_out" })} />);
    view.getByRole("button", { name: "Change answer D-34" });
  });

  test("WorkingLine shows each answer given lately", () => {
    const view = render(
      <WorkingLine
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
    expect(
      view
        .getAllByRole("button", { name: /^Change answer / })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Change answer D-34", "Change answer D-2"]);
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

  test("a proposal or a finished line with nothing new is left out; a working line says nothing new", () => {
    const view = render(
      <UnseenLog
        events={[]}
        lines={[
          line({ ref: "L-1", title: "Enclosure", state: "working" }),
          line({ ref: "L-3", title: "Wall mount", state: "proposed" }),
          line({ ref: "L-4", title: "Seerr", state: "done" }),
        ]}
        includeWaiting={false}
        onShowWaiting={() => {}}
      />,
    );
    within(view.getByRole("article", { name: "Enclosure" })).getByText(/nothing new/);
    expect(view.queryByRole("article", { name: "Wall mount" })).toBeNull();
    expect(view.queryByRole("article", { name: "Seerr" })).toBeNull();
  });

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
    within(view.getByRole("region", { name: "Rule breaks" })).getByText(/opened on L-2 after it was tabled/);
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
    within(view.getByRole("region", { name: "Rule breaks" })).getByText(/panel was refused a write/);
    const groups = view.getAllByRole("article");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["Enclosure"]);
    within(groups[0] ?? document.body).getByText("Also routine: 2 check changes, 1 re-confirmation.");
    within(groups[0] ?? document.body).getByText(/created: Base/);
    within(groups[0] ?? document.body).getByText("1 unseen");
    expect(view.queryByText("Plan set")).toBeNull();
    view.getByRole("button", { name: "Include them" });
    view.getByText("Up next and tabled lines are left out.");
  });

  test("with nothing to show, says nothing is new", () => {
    const view = render(<UnseenLog events={[]} lines={[]} includeWaiting={false} onShowWaiting={() => {}} />);
    view.getByText("Nothing new");
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
    view.getByRole("button", { name: "Show the 1 you have seen" });
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
    notMoved: null,
    places: [],
    retry: mock(() => {}),
    anyway: mock(() => {}),
    setCheckout: mock(() => {}),
    at: mock(() => {}),
    repos: [],
    repoName: (key: string) => key,
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
  by: "agent-a",
  doneWhen: "A printed case holds the board.",
};

describe("PullRequestBox", () => {
  test("says it is loading, or why it could not load, instead of None yet", () => {
    const loading = render(<PullRequestBox prs={[]} loading />);
    loading.getByRole("status");
    expect(loading.queryByText("None yet.")).toBeNull();
    loading.unmount();
    const failed = render(
      <PullRequestBox
        prs={[]}
        error={new ApiError({ code: "sync_failed", message: "gh is down", hint: null })}
      />,
    );
    failed.getByRole("alert");
    failed.getByText(/gh is down/);
    expect(failed.queryByText("None yet.")).toBeNull();
  });

  test("shows each pull request in one row: its number, state and checks, without size or age", () => {
    const view = render(
      <PullRequestBox
        prs={[
          pr(),
          pr({ ref: "PR-2", number: 13, title: "Drop the cache", checks: "failing", state: "merged" }),
        ]}
      />,
    );
    const box = within(view.getByRole("region", { name: "Pull requests" }));
    within(box.getByRole("heading", { name: /^Pull requests/ })).getByText("2");
    expect(box.getByRole("link", { name: "acme/app#12 ↗" }).getAttribute("href")).toBe(
      "https://github.com/acme/app/pull/12",
    );
    box.getByRole("link", { name: "acme/app#13 ↗" });
    box.getByText("Add retry");
    box.getByText("Drop the cache");
    box.getByText("✓ checks pass");
    box.getByText("✗ checks failing");
    expect(box.queryByText("+10 −2")).toBeNull();
    expect(box.queryByText(/^opened /)).toBeNull();
    box.getByText("merged");
  });

  test("says checks pending or absent in words", () => {
    render(<PullRequestBox prs={[pr({ checks: "pending" })]} />).getByText("checks running");
    render(<PullRequestBox prs={[pr({ ref: "PR-3", checks: "none" })]} />).getByText("no checks");
  });

  test("with none yet says so", () => {
    const view = render(<PullRequestBox prs={[]} />);
    view.getByRole("heading", { name: /^Pull requests/ });
    view.getByText("None yet.");
    expect(view.queryByRole("link")).toBeNull();
  });
});

describe("FoldPicker", () => {
  const targets = [line({ ref: "L-1", title: "Sendspin enclosure" }), line({ ref: "L-2", title: "Shelf" })];

  test("is a sheet that finds a line and offers each, numbered, with the find box taking the cursor", () => {
    const view = render(
      <FoldPicker title="Wall mount" targets={targets} onFold={() => {}} onCancel={() => {}} />,
    );
    const sheet = within(view.getByRole("dialog", { name: "Fold Wall mount into…" }));
    const find = sheet.getByLabelText("Find a line");
    expect(document.activeElement).toBe(find);
    expect(sheet.getByRole("button", { name: "Sendspin enclosure" }).getAttribute("data-choice")).toBe("1");
    expect(sheet.getByRole("button", { name: "Shelf" }).getAttribute("data-choice")).toBe("2");
    fireEvent.change(find, { target: { value: "shel" } });
    expect(sheet.queryByRole("button", { name: "Sendspin enclosure" })).toBeNull();
    sheet.getByRole("button", { name: "Cancel" });
  });

  test("folds into the line pressed or numbered, by its ref, and Cancel cancels", () => {
    const onFold = mock((_into: string) => {});
    const onCancel = mock(() => {});
    const view = render(
      <FoldPicker title="Wall mount" targets={targets} onFold={onFold} onCancel={onCancel} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Shelf" }));
    expect(onFold).toHaveBeenCalledWith("L-2");
    view.getByRole("dialog").focus();
    fireEvent.keyDown(window, { key: "1" });
    expect(onFold).toHaveBeenCalledWith("L-1");
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
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
      name: "1 more for you: a task at the Mac",
    });
    say([forYouTask({ ref: "PANEL-3" })]).getByRole("button", { name: "1 more for you: a task" });
    say([forYouQuestion]).getByRole("button", { name: "1 more for you: a question" });
    say([forYouDone]).getByRole("button", { name: "1 more for you: a proposal" });
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
      view.getByRole("button", { name: "4 more for you: 1 question and 2 tasks and 1 proposal" }),
    );
    expect(onShow).toHaveBeenCalledTimes(1);
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
    const section = view.getByRole("region", { name: "Here, from up next" });
    within(section).getByRole("heading", { name: "Here, from up next 2" });
    // Each task's up-next line by its number, then how long it has waited; a line not up next is left out.
    within(section).getByText("4 Shelf · asked 2h ago");
    within(section).getByText("asked 2h ago");
    const drill = within(section).getByRole("article", { name: "Find the drill" });
    const sweep = within(section).getByRole("article", { name: "Sweep the shed" });
    expect(drill.closest("[data-focus-ref]")?.hasAttribute("aria-current")).toBe(false);
    expect(sweep.closest("[data-focus-ref]")?.getAttribute("aria-current")).toBe("true");
  });
});

describe("EventList", () => {
  test("is nothing without events", () => {
    expect(render(<EventList title="Activity" events={[]} />).container.textContent).toBe("");
  });

  test("lists what happened, one row each, in the order given, with who and when", () => {
    const view = render(
      <EventList
        title="Activity"
        events={[
          event({
            seq: 2,
            ts: "2026-01-02T10:00:00.000Z",
            actor: "dev",
            ref: "OCT-2",
            summary: "OCT-2 created: Base",
          }),
          event({ seq: 1, ts: "2026-01-01T10:00:00.000Z", summary: "OCT-1 created: Thing" }),
        ]}
      />,
    );
    const activity = within(view.getByRole("region", { name: "Activity" }));
    within(activity.getByRole("heading", { name: /^Activity/ })).getByText("2");
    activity.getByText(whole("OCT-2 created: Base"));
    activity.getByText(whole("OCT-1 created: Thing"));
    activity.getByText("dev");
    activity.getByText("agent-a");
    expect([...view.container.querySelectorAll("time")].map((time) => time.getAttribute("datetime"))).toEqual(
      ["2026-01-02T10:00:00.000Z", "2026-01-01T10:00:00.000Z"],
    );
    expect(activity.getAllByRole("button").map((button) => button.textContent)).toEqual(["OCT-2", "OCT-1"]);
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
    within(view.getByRole("group", { name: "Step in on Sendspin enclosure" }))
      .getAllByRole("button")
      .map((button) => button.textContent);

  test("is nothing when the server sends no reason to step in", () => {
    expect(render(<LineStepIn {...stepIn({ h: homeActions(), kind: null })} />).container.textContent).toBe(
      "",
    );
  });

  test("says the server's reason, and offers what fits each kind before I'll own it and Table it", () => {
    const cases: readonly (readonly [StepInKind, readonly string[]])[] = [
      ["no_start_command", ["Try now", "I'll own it", "Table it"]],
      ["failing", ["Try now", "I'll own it", "Table it"]],
      ["left", ["Try now", "I'll own it", "Table it"]],
      ["never_took", ["Try now", "I'll own it", "Table it"]],
      ["clone_failed", ["Set its checkout", "I'll own it", "Table it"]],
      ["at_cap", ["Start one anyway", "I'll own it", "Table it"]],
      ["watch_only", ["I'll own it", "Table it"]],
      ["no_repo", ["I'll own it", "Table it"]],
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
    const sheet = within(failing.getByRole("dialog", { name: "Table Sendspin enclosure" }));
    fireEvent.change(sheet.getByLabelText("Why it waits"), { target: { value: "After the move" } });
    fireEvent.click(sheet.getByRole("button", { name: "Table it" }));
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
    expect(view.queryByRole("group")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Step in a start keeps failing" }));
    expect(onFocus).toHaveBeenCalledWith("stepin:L-1");
    view.unmount();
    const focused = render(<LineStepIn {...stepIn({ h, kind: "failing", folded: true, focused: true })} />);
    const group = focused.getByRole("group", { name: "Step in on Sendspin enclosure" });
    expect(group.getAttribute("aria-current")).toBe("true");
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
    fireEvent.click(view.getByRole("button", { name: "2 more for you: 2 tasks" }));
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
      view.getByRole("button", { name: "Also on this line: 1 question · 1 task at the Mac · 1 proposal" }),
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
    fireEvent.click(view.getByRole("button", { name: "Also on this line: 1 task at the Mac · 1 proposal" }));
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
    expect(view.queryByRole("button")).toBeNull();
  });
});

describe("NotKept", () => {
  test("is nothing while drafts are kept", () => {
    expect(render(<NotKept error={null} />).container.textContent).toBe("");
  });

  test("says the draft was not saved, and that it is kept here until the tracker answers", () => {
    const view = render(<NotKept error="the server is not answering" />);
    expect(view.getByRole("alert").textContent).toBe(
      "Not saved: the tracker did not answer. Kept here; saves when it is back.",
    );
  });
});

describe("Pairs", () => {
  test("lists each pair with a value, in order, and leaves out empty ones", () => {
    const view = render(
      <Pairs
        pairs={[
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

describe("HeldDecision", () => {
  test("says a question waits for its line to start, and shows it read only", () => {
    const view = render(
      <HeldDecision
        decision={decision({ line: "L-3", heldAt: "2026-11-01T00:00:00.000Z", recommendationWhy: "Proven." })}
        waitsFor={[]}
      />,
    );
    view.getByText("held until its line starts");
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
    expect(view.getByLabelText("Note").tagName).toBe("TEXTAREA");
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
  test("says only the newest are here, with the way to the rest in the Log", () => {
    const view = render(
      <SinceSummary
        line="L-1"
        events={[event({ seq: 2, line: "L-1", ts: "2026-11-14T10:00:00.000Z", summary: "Plan set" })]}
        summaryAt="2026-11-14T09:00:00.000Z"
        seenAt={null}
        more
      />,
    );
    view.getByText("newest only");
    expect(view.getByRole("link", { name: "This line in the log →" }).getAttribute("href")).toBe(
      `/log?q=${encodeURIComponent("line:L-1")}`,
    );
  });
});

describe("Loaded", () => {
  test("draws outlines while its part loads, naming it for a screen reader, until it has loaded once", () => {
    const loading = render(
      <Loaded loaded={false} error={null} what="the plan" onRetry={() => {}}>
        <p>Plan</p>
      </Loaded>,
    );
    within(loading.getByRole("status")).getByText("Loading the plan…");
    expect(loading.container.querySelectorAll(".ui-outline").length).toBeGreaterThan(0);
    expect(loading.queryByText("Plan")).toBeNull();
    loading.unmount();
    render(
      <Loaded loaded error={null} what="the plan" onRetry={() => {}}>
        <p>Plan</p>
      </Loaded>,
    ).getByText("Plan");
  });

  test("a first load that fails says what failed, with Try again", () => {
    const onRetry = mock(() => {});
    const failed = render(
      <Loaded loaded={false} error={new TypeError("Failed to fetch")} what="the plan" onRetry={onRetry}>
        <p>Plan</p>
      </Loaded>,
    );
    failed.getByText("Could not load the plan.");
    failed.getByText(/The tracker did not answer\./);
    fireEvent.click(failed.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(failed.queryByText("Plan")).toBeNull();
  });

  test("keeps what loaded when a refresh fails, marked with the time it is from", () => {
    const at = new Date(2026, 10, 16, 14, 20).getTime();
    const view = render(
      <Loaded loaded error={new Error("Server restarting")} what="the plan" onRetry={() => {}} at={at}>
        <p>Plan</p>
      </Loaded>,
    );
    view.getByText("Plan");
    view.getByText("As of 14:20; could not refresh.");
    expect(view.queryByText(/Server restarting/)).toBeNull();
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

  test("names what Done frees, opens it, and says who holds it", () => {
    navigate("/");
    const view = render(<TaskFrees freed={[freed()]} />);
    view.getByText("Test-print the current parts");
    view.getByText("held by panel-widgets");
    fireEvent.click(view.getByRole("button", { name: "PANEL-5" }));
    expect(new URLSearchParams(window.location.search).get("ref")).toBe("PANEL-5");
  });

  test("with nobody holding it, says so", () => {
    render(<TaskFrees freed={[freed({ assignee: null })]} />).getByText("nobody holds it");
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

describe("TaskClosed", () => {
  const closedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();

  test("how it ended leads, with who and when, then what was sent back", () => {
    const view = render(
      <TaskClosed
        task={issue({ status: "done", outcome: "In mm", result: "41 mm", closedAt })}
        closed={{ how: "done", by: "dev" }}
      />,
    );
    view.getByText("Done");
    view.getByText("by you, 2h ago");
    view.getByText("41 mm");
  });

  test("a task of the developer's own says Done once", () => {
    const view = render(
      <TaskClosed
        task={issue({ status: "done", outcome: "", result: "Done", closedAt })}
        closed={{ how: "done", by: "dev" }}
      />,
    );
    expect(view.getAllByText(/^Done$/)).toHaveLength(1);
  });

  test("could not be done, with why in the same breath", () => {
    const view = render(
      <TaskClosed
        task={issue({ status: "cancelled", result: "the enclosure is at the office", closedAt })}
        closed={{ how: "cant", by: "dev" }}
      />,
    );
    view.getByText("Could not be done: the enclosure is at the office");
  });

  test("withdrawn by an agent, said as such, never as the developer turning it down", () => {
    const view = render(
      <TaskClosed
        task={issue({ status: "cancelled", result: "Not needed after all", closedAt })}
        closed={{ how: "withdrawn", by: "octo.1" }}
      />,
    );
    view.getByText("Withdrawn by octo.1");
    expect(view.queryByText(/Could not be done/)).toBeNull();
  });
});

describe("AppearanceMenu", () => {
  test("offers the eight themes and the mode, each previewed, the current ones checked", () => {
    const onPalette = mock((_palette: string) => {});
    const onMode = mock((_mode: string) => {});
    const view = render(
      <AppearanceMenu
        appearance={{ palette: "gruvbox", mode: "system" }}
        onPalette={onPalette}
        onMode={onMode}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Appearance: Gruvbox, as the system" }));
    const menu = within(view.getByRole("menu", { name: "Appearance" }));
    // The check before the ones in force is drawn for the eye only; the items name themselves.
    expect(menu.getAllByRole("menuitemradio").map((item) => item.textContent?.replace("✓", ""))).toEqual([
      "Paper",
      "Solarized",
      "Gruvbox",
      "Catppuccin",
      "Rosé Pine",
      "Nord",
      "Everforest",
      "High contrast",
      "As the system",
      "Light",
      "Dark",
    ]);
    expect(menu.getByRole("menuitemradio", { name: "Gruvbox" }).getAttribute("aria-checked")).toBe("true");
    expect(menu.getByRole("menuitemradio", { name: "As the system" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    // Each theme previews itself: its swatch carries the palette.
    expect(
      menu.getByRole("menuitemradio", { name: "Nord" }).querySelector("[data-palette='nord']"),
    ).not.toBeNull();
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Nord" }));
    expect(onPalette).toHaveBeenCalledWith("nord");
    fireEvent.click(view.getByRole("button", { name: "Appearance: Gruvbox, as the system" }));
    fireEvent.click(
      within(view.getByRole("menu", { name: "Appearance" })).getByRole("menuitemradio", { name: "Dark" }),
    );
    expect(onMode).toHaveBeenCalledWith("dark");
  });

  test("a tap on a theme in Safari, which gives a tapped button no focus, still picks it", () => {
    const onPalette = mock((_palette: string) => {});
    const view = render(
      <AppearanceMenu
        appearance={{ palette: "paper", mode: "system" }}
        onPalette={onPalette}
        onMode={() => {}}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Appearance: Paper, as the system" }));
    const menu = within(view.getByRole("menu", { name: "Appearance" }));
    const forest = menu.getByRole("menuitemradio", { name: "Everforest" });
    // Safari: the item that had focus loses it, and nothing receives it, before the tap's click arrives.
    fireEvent.pointerDown(forest);
    fireEvent.blur(menu.getByRole("menuitemradio", { name: "Paper" }), { relatedTarget: null });
    fireEvent.click(forest);
    expect(onPalette).toHaveBeenCalledWith("everforest");
  });

  test("a tap outside the menu, or focus moving out of it, closes it", () => {
    const view = render(
      <div>
        <AppearanceMenu
          appearance={{ palette: "paper", mode: "system" }}
          onPalette={() => {}}
          onMode={() => {}}
        />
        <button type="button">Elsewhere</button>
      </div>,
    );
    const open = () =>
      fireEvent.click(view.getByRole("button", { name: "Appearance: Paper, as the system" }));
    open();
    fireEvent.pointerDown(view.getByRole("button", { name: "Elsewhere" }));
    expect(view.queryByRole("menu", { name: "Appearance" })).toBeNull();
    open();
    fireEvent.blur(view.getByRole("menuitemradio", { name: "Paper" }), {
      relatedTarget: view.getByRole("button", { name: "Elsewhere" }),
    });
    expect(view.queryByRole("menu", { name: "Appearance" })).toBeNull();
  });
});

describe("useReloadOnNewBuild", () => {
  const served = '<script type="module" crossorigin src="/assets/index-NEW.js"></script>';

  test("a tab coming back into view after a deploy loads the new build", async () => {
    const reload = mock(() => {});
    renderHook(() =>
      useReloadOnNewBuild({
        loaded: () => ["/assets/index-OLD.js"],
        fetchPage: async () => served,
        reload,
      }),
    );
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  test("Safari restoring the page from memory checks too", async () => {
    const reload = mock(() => {});
    renderHook(() =>
      useReloadOnNewBuild({
        loaded: () => ["/assets/index-OLD.js"],
        fetchPage: async () => served,
        reload,
      }),
    );
    window.dispatchEvent(new Event("pageshow"));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  test("never reloads under someone typing, nor when the build is the same", async () => {
    const reload = mock(() => {});
    const fetchPage = mock(async () => served);
    const box = document.createElement("textarea");
    document.body.append(box);
    box.focus();
    const typingTab = renderHook(() =>
      useReloadOnNewBuild({ loaded: () => ["/assets/index-OLD.js"], fetchPage, reload }),
    );
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(reload).not.toHaveBeenCalled();
    typingTab.unmount();
    box.remove();
    renderHook(() =>
      useReloadOnNewBuild({
        loaded: () => ["/assets/index-NEW.js"],
        fetchPage: async () => served,
        reload,
      }),
    );
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reload).not.toHaveBeenCalled();
  });
});
