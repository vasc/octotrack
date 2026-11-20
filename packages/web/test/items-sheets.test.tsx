import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { AnswerStatus } from "../src/components/home/AnswerStatus.tsx";
import { CheckoutForm } from "../src/components/home/CheckoutForm.tsx";
import { HeldQuestion } from "../src/components/home/HeldQuestion.tsx";
import { DoneWhenChanged } from "../src/components/home/DoneWhenChanged.tsx";
import { KeyHelp } from "../src/components/home/KeyHelp.tsx";
import { StepIn } from "../src/components/home/StepIn.tsx";
import { StartSheetView } from "../src/components/home/StartSheetView.tsx";
import { NewLineSheet } from "../src/components/lines/NewLineSheet.tsx";
import { decision, issue, line } from "../src/design/fixtures.ts";
import { whole } from "./harness.tsx";
import { TaskCard } from "../src/components/home/TaskCard.tsx";

const noop = () => {};

describe("StepIn", () => {
  test("I'll own it and Table it follow the kind's own action, in that order", () => {
    const view = render(
      <StepIn line={line()} reason="No start command." onRetry={noop} onOwn={noop} onTable={noop} />,
    );
    const names = view.getAllByRole("button").map((button) => button.textContent);
    expect(names).toEqual(["Try now", "I'll own it", "Table it"]);
  });
});

describe("AnswerStatus", () => {
  test("offers Change, and says how long ago it was picked up", () => {
    const view = render(
      <AnswerStatus
        answer={{
          ref: "D-20",
          title: "Uninstall it?",
          answer: "Uninstall it",
          status: "picked_up",
          by: "funnel",
          at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
          note: null,
          unwoken: null,
        }}
      />,
    );
    expect(view.getByRole("button", { name: "Change answer D-20" }).textContent).toBe("Change");
    view.getByText(/picked up by funnel, 9d ago/);
  });
});

describe("CheckoutForm", () => {
  test("Set waits for a full path, and the field says so", () => {
    const view = render(<CheckoutForm repo="hydra" onSet={noop} onCancel={noop} />);
    view.getByText("A full path, starting with /");
    expect(view.getByRole("button", { name: "Set" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Checkout of hydra"), { target: { value: "/src/hydra" } });
    expect(view.getByRole("button", { name: "Set" }).hasAttribute("disabled")).toBe(false);
  });

  test("a path that does not start with / marks the box, and only once something is typed", () => {
    const view = render(<CheckoutForm repo="hydra" onSet={noop} onCancel={noop} />);
    const box = view.getByLabelText("Checkout of hydra");
    expect(box.getAttribute("aria-invalid")).toBeNull();
    fireEvent.change(box, { target: { value: "src/hydra" } });
    expect(box.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("NewLineSheet", () => {
  test("Up next says which place in the order the line takes, and Working on that an agent is found now", () => {
    const view = render(
      <NewLineSheet
        repos={[]}
        upNext={6}
        onAdd={noop}
        onCancel={noop}
        draft={{ title: "", doneWhen: "" }}
        onDraft={noop}
      />,
    );
    view.getByRole("radio", { name: "Up next Waits its turn, 7th in your order" });
    view.getByRole("radio", { name: "Working on An agent is found for it now" });
  });
});

describe("KeyHelp", () => {
  test("lists the keys page by page, For you's, Lines', then everywhere's, and closes with Close", () => {
    const view = render(<KeyHelp onClose={noop} />);
    const sheet = within(view.getByRole("dialog", { name: "Keys" }));
    expect(sheet.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Keys",
      "On For you",
      "On Lines",
      "Anywhere",
    ]);
    sheet.getByText("answer in your own words");
    sheet.getByText("later: to the bottom");
    sheet.getByText("move it in your order");
    sheet.getByText("search the log");
    sheet.getByRole("button", { name: "Close" });
    // I'm at and stepping between lines with Shift are gone with the old Lines.
    expect(sheet.queryByText("I'm at")).toBeNull();
  });
});

describe("NewLineSheet, as drawn", () => {
  const repos = ["HASS", "INFRA", "MEDIA", "PANEL", "TRIP", "OCT"];
  const props = { repos, onAdd: noop, onCancel: noop, draft: { title: "", doneWhen: "" }, onDraft: noop };

  test("repos are chips, four then the rest a press away, with None, it needs no code", () => {
    const view = render(<NewLineSheet {...props} />);
    view.getByRole("checkbox", { name: "PANEL" });
    expect(view.queryByRole("checkbox", { name: "TRIP" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "+ 2 more" }));
    view.getByRole("checkbox", { name: "TRIP" });
    view.getByRole("checkbox", { name: "None, it needs no code" });
  });

  test("says what is still missing while it cannot be added, and that it saves as typed", () => {
    const view = render(<NewLineSheet {...props} draft={{ title: "Backups", doneWhen: "" }} />);
    view.getByText("Still needs: done when, and a repo or None.");
    view.getByText("Kept as a draft if you close it.");
    expect(view.getByLabelText("Title").getAttribute("placeholder")).toBe(
      "Back up the Home Assistant host nightly",
    );
  });

  test("what is typed goes to its draft", () => {
    const onDraft = mock((_draft: { title: string; doneWhen: string }) => {});
    const view = render(<NewLineSheet {...props} onDraft={onDraft} />);
    fireEvent.change(view.getByLabelText("Title"), { target: { value: "Backups" } });
    expect(onDraft).toHaveBeenCalledWith({ title: "Backups", doneWhen: "" });
  });
});

describe("DoneWhenChanged, as drawn", () => {
  test("says who changed it while it waited, Was and Proposed side by side, why, and Accept first", () => {
    const onAnswer = mock((_accept: boolean) => {});
    const view = render(
      <DoneWhenChanged
        was="The Mac mini has enough free disk."
        proposal="After a deploy the data volume has at least 40 GB free."
        why="enough could not be checked."
        by="chores"
        numbers={["1", "2"]}
        onAnswer={onAnswer}
      />,
    );
    view.getByText(whole("Done when changed · by chores, while it waited"));
    expect(view.getByText("Was").textContent).toBe("Was");
    view.getByText("The Mac mini has enough free disk.");
    expect(view.getByText("Proposed").textContent).toBe("Proposed");
    view.getByText("After a deploy the data volume has at least 40 GB free.");
    view.getByText(whole("Why: enough could not be checked."));
    const accept = view.getByRole("button", { name: "Accept" });
    expect(accept.getAttribute("data-variant")).toBe("primary");
    fireEvent.click(view.getByRole("button", { name: "Keep current" }));
    expect(onAnswer).toHaveBeenCalledWith(false);
  });

  test("with no proposer named, says only that it changed", () => {
    const view = render(
      <DoneWhenChanged was="a" proposal="b" why={null} by={null} numbers={["1", "2"]} onAnswer={noop} />,
    );
    view.getByText(whole("Done when changed"));
    expect(view.queryByText(/Why:/)).toBeNull();
  });
});

describe("StartSheetView, as drawn", () => {
  test("says how many waited, and Start stays on while what waited loads", () => {
    const view = render(
      <StartSheetView
        line={line({ title: "Labyrinth level editor" })}
        held={[
          { ref: "D-4", kind: "question", title: "Which engine?", line: "L-1", current: true, since: "" },
          { ref: "PANEL-9", kind: "task", title: "Measure the studs", line: "L-1", current: true, since: "" },
        ]}
        questions={[]}
        onDoneWhen={noop}
        onAnswer={noop}
        onOwn={noop}
        onStart={noop}
        onCancel={noop}
        status={<p>loading</p>}
      />,
    );
    expect(view.getByRole("button", { name: "Start" }).hasAttribute("disabled")).toBe(false);
    view.unmount();
    const loaded = render(
      <StartSheetView
        line={line({ title: "Labyrinth level editor" })}
        held={[
          { ref: "D-4", kind: "question", title: "Which engine?", line: "L-1", current: true, since: "" },
          { ref: "PANEL-9", kind: "task", title: "Measure the studs", line: "L-1", current: true, since: "" },
        ]}
        questions={[]}
        onDoneWhen={noop}
        onAnswer={noop}
        onOwn={noop}
        onStart={noop}
        onCancel={noop}
      />,
    );
    // A held question answered meanwhile no longer counts; it is listed as answered.
    loaded.getByText("1 task waited for it.");
    loaded.getByRole("group", { name: "Answered meanwhile" });
    // A held question no longer open to answer here still shows, by its title.
    loaded.getByText("Which engine?");
  });
});

describe("TaskCard, as drawn", () => {
  const props = {
    words: "",
    onWords: noop,
    values: {},
    onValue: noop,
    why: "",
    onWhy: noop,
    reply: "",
    onReplyWords: noop,
    onDone: noop,
    onCant: noop,
    onReply: noop,
  };

  test("what to send back sits under a heading, and what it frees opens", () => {
    const view = render(
      <TaskCard
        {...props}
        task={issue({ ref: "PANEL-6", outcome: "In mm", fields: ["Length"], createdBy: "panel-widgets" })}
        frees={{ ref: "PANEL-4", title: "Print the wall mount" }}
      />,
    );
    view.getByText("What to send back");
    view.getByRole("button", { name: "PANEL-4" });
  });

  test("Can't do it asks why, with Close it and Back", () => {
    const view = render(<TaskCard {...props} task={issue({ ref: "PANEL-6", outcome: "In mm" })} />);
    fireEvent.click(view.getByRole("button", { name: "Can't do it" }));
    view.getByLabelText("Why PANEL-6 cannot be done");
    view.getByRole("button", { name: "Close it" });
    view.getByRole("button", { name: "Back" });
  });

  test("a task with nothing asked back, such as logging in, is done with no words, or replied to", () => {
    const onDone = mock((_outcome: { result?: string }) => {});
    const onReply = mock((_words: string) => {});
    const view = render(
      <TaskCard
        {...props}
        onDone={onDone}
        onReply={onReply}
        reply="Which account?"
        task={issue({ ref: "PANEL-9", title: "Log in to Tailscale", outcome: "", createdBy: "panel" })}
      />,
    );
    view.getByText("Task for you");
    view.getByText("filed by panel");
    view.getByLabelText("Anything to say · optional");
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith({});
    fireEvent.click(view.getByRole("button", { name: "Reply" }));
    view.getByLabelText("Reply to panel");
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    expect(onReply).toHaveBeenCalledWith("Which account?");
    // Sent, the box closes and the task is back to Done, Can't do it and Reply.
    expect(view.queryByLabelText("Reply to panel")).toBeNull();
    view.getByRole("button", { name: "Done" });
  });

  test("a task the developer filed that asks for an outcome still shows its box, so Done can be pressed", () => {
    const onDone = mock((_outcome: { result?: string }) => {});
    const view = render(
      <TaskCard
        {...props}
        words="41 mm"
        onDone={onDone}
        task={issue({ ref: "PANEL-1", outcome: "In mm", createdBy: "dev" })}
      />,
    );
    view.getByText("Your task");
    view.getByLabelText("In mm");
    fireEvent.click(view.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith({ result: "41 mm" });
  });

  test("a task of the developer's own is theirs: Done and Can't", () => {
    const view = render(
      <TaskCard {...props} task={issue({ ref: "LIFE-1", outcome: "", createdBy: "dev" })} />,
    );
    view.getByText("Your task");
    view.getByRole("button", { name: "Done" });
    view.getByRole("button", { name: "Can't" });
  });
});

describe("HeldQuestion", () => {
  test("with no options, its own-words box is open, and Send answers in those words", () => {
    const onOwn = mock((_ref: string, _words: string) => {});
    const view = render(
      <HeldQuestion
        question={decision({ ref: "D-42", title: "What should the walls be?", options: [] })}
        firstChoice={1}
        onAnswer={noop}
        onOwn={onOwn}
      />,
    );
    const send = view.getByRole("button", { name: "Send" });
    expect(send.hasAttribute("disabled")).toBe(true);
    fireEvent.change(view.getByLabelText("Your answer"), { target: { value: "Tiles" } });
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    expect(onOwn).toHaveBeenCalledWith("D-42", "Tiles");
  });
});

describe("NewLineSheet, its repos and its draft", () => {
  const props = { repos: [], onAdd: noop, onCancel: noop, draft: { title: "", doneWhen: "" }, onDraft: noop };

  test("while the repos load, says so, and None stays usable", () => {
    const view = render(<NewLineSheet {...props} reposStatus={<p>Loading the repos…</p>} />);
    view.getByText("Loading the repos…");
    view.getByRole("checkbox", { name: "None, it needs no code" });
  });

  test("words not kept on the tracker say so", () => {
    render(<NewLineSheet {...props} notSaved />).getByText(/^Not saved:/);
  });
});
