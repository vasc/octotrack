import { LineActions } from "../components/entity/LineActions.tsx";
import { LinePanelHead } from "../components/entity/LinePanelHead.tsx";
import { OwnerBox } from "../components/entity/OwnerBox.tsx";
import { PlanList } from "../components/entity/PlanList.tsx";
import { SummaryBox } from "../components/entity/SummaryBox.tsx";
import { FoldedSection } from "../components/home/FoldedSection.tsx";
import { ForYouRow } from "../components/home/ForYouRow.tsx";
import { OwnWorkBox } from "../components/entity/OwnWorkBox.tsx";
import { TellBox } from "../components/entity/TellBox.tsx";
import { LineProposalCard } from "../components/home/LineProposalCard.tsx";
import { SpreadThin } from "../components/home/SpreadThin.tsx";
import { StartSheetView } from "../components/home/StartSheetView.tsx";
import { ProposalCard } from "../components/home/ProposalCard.tsx";
import { QuietRow } from "../components/home/QuietRow.tsx";
import { StepIn } from "../components/home/StepIn.tsx";
import { TaskCard } from "../components/home/TaskCard.tsx";
import { UpNextRow } from "../components/home/UpNextRow.tsx";
import { WorkingLine } from "../components/home/WorkingLine.tsx";
import { UndoBar } from "../components/layout/UndoBar.tsx";
import { TopBar } from "../components/layout/TopBar.tsx";
import { NewLineCard } from "../components/lines/NewLineCard.tsx";
import { Markdown } from "../components/ui/Markdown.tsx";
import { TextBox } from "../components/ui/TextBox.tsx";
import { DesignSection, Example } from "./Example.tsx";
import { decision, decisionCard, issue, line, pendingChoice } from "./fixtures.ts";

const NOOP = () => {};
const QUESTION = decisionCard({
  decision: decision({
    ref: "D-34",
    title: "Which board goes in?",
    recommendation: "sqs",
    recommendationWhy: "It is the one already proven in the printed base.",
  }),
});
const TASK = issue({
  ref: "OCT-7",
  title: "Answer one question from the desktop app",
  assignee: "dev",
  place: "the Mac",
  outcome: "Did it wake?",
});

/** Lines of work: home's sections, a line in the inspector, and what waits on the developer. */
export function LinesGallery() {
  return (
    <DesignSection title="Lines of work">
      <Example label="What waits on you">
        <TopBar
          path="/"
          counts={[
            { key: "toAnswer", label: "to answer", count: 4, to: "D-56" },
            { key: "toDo", label: "to do", count: 3, to: "OCT-7" },
            { key: "toAccept", label: "to accept", count: 1, to: "L-6" },
            { key: "toStepIn", label: "to step in", count: 1, to: "stepin:L-9" },
          ]}
          places={["the bench", "the Mac"]}
          at={null}
          onAt={NOOP}
          onNewLine={NOOP}
          onKeys={NOOP}
        />
      </Example>
      <Example label="A working line, waiting on you">
        <WorkingLine
          index={2}
          line={line({
            headline: "Printed; the short board fits. One answer and one measurement from the final print.",
          })}
          crew={{
            owner: { name: "panel-widgets", state: "asleep" },
            helpers: [],
            scoper: null,
            search: null,
          }}
          details={{
            start: null,
            step: { position: 3, of: 4, title: "settle board and opening" },
            forYou: [{ kind: "question", card: QUESTION }],
            stepIn: false,
            held: { questions: 0, tasks: 0 },
            scopedSteps: 4,
            answers: [
              {
                ref: "D-40",
                title: "Which plug?",
                answer: "USB-C on the side",
                status: "carried_out",
                by: "panel-widgets",
                at: "2026-11-14T08:40:00.000Z",
                note: "model set to the short board",
                unwoken: null,
              },
            ],
          }}
        >
          <div className="home-items">
            <ForYouRow item={{ kind: "question", card: QUESTION }} onOpen={NOOP} />
          </div>
        </WorkingLine>
      </Example>
      <Example label="A task, one row, and opened">
        <ForYouRow item={{ kind: "task", task: TASK }} onOpen={NOOP} />
        <TaskCard task={TASK} words="" onWords={NOOP} onDone={NOOP} onCant={NOOP} />
      </Example>
      <Example label="Spread thin">
        <SpreadThin working={8} noOwner={2} waiting={3} />
      </Example>
      <Example label="Starting a line that waited">
        <StartSheetView
          line={line({ title: "Wall mount", doneWhenProposal: "It hangs flush with the cable hidden." })}
          held={[
            { ref: "D-41", kind: "question", title: "Which wall?", line: "L-3", current: true, since: "" },
            {
              ref: "PANEL-9",
              kind: "task",
              title: "Measure the stud spacing",
              line: "L-3",
              current: true,
              since: "",
            },
          ]}
          questions={[
            decision({
              ref: "D-41",
              title: "Which wall?",
              context: "The hall has studs at 40 cm; the study is brick.",
              options: [
                { key: "a", label: "The hall", description: "Screws into the studs." },
                { key: "b", label: "The study", description: "Needs plugs." },
              ],
              recommendation: "a",
              recommendationWhy: "the studs hold it without plugs.",
            }),
          ]}
          onDoneWhen={NOOP}
          onAnswer={NOOP}
          onStart={NOOP}
          onCancel={NOOP}
        />
      </Example>
      <Example label="Telling a line, and a line of your own">
        <TellBox line="L-1" to="panel-widgets" words="" onWords={NOOP} onSend={NOOP} />
        <OwnWorkBox line="L-7" words="" onWords={NOOP} onTask={NOOP} onNote={NOOP} />
      </Example>
      <Example label="A case for done, one row, and opened">
        <ForYouRow
          item={{
            kind: "done",
            line: "L-1",
            text: "Printed, fitted and in use.",
            by: "panel",
            doneWhen: "a printed case holds the board",
          }}
          onOpen={NOOP}
        />
        <LineProposalCard
          proposal={{
            kind: "done",
            line: "L-12",
            text: "The owner, asleep in a terminal session, was woken from the line's inbox and reported it carried out.",
            by: "octotrack-builder",
            doneWhen: "an answer reaches whoever owns its line",
          }}
          title="Answer delivery"
          onAccept={NOOP}
          onDecline={NOOP}
        />
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
          onAccept={NOOP}
          onDecline={NOOP}
        />
      </Example>
      <Example label="A line nobody could be found for">
        <WorkingLine
          index={5}
          line={line({ title: "South Tyrol trip" })}
          crew={{ owner: null, helpers: [], scoper: null, search: { step: 3, since: "" } }}
        >
          <StepIn
            line={line({ title: "South Tyrol trip" })}
            reason="trips.2, started for it, exited at once: claude is not logged in. Octotrack tries again by itself, less often each time."
            onRetry={NOOP}
            onOwn={NOOP}
            onTable={NOOP}
          />
        </WorkingLine>
      </Example>
      <Example label="Up next">
        <UpNextRow
          index={6}
          line={line({
            state: "up_next",
            title: "Wall mount",
            doneWhen: "the panel hangs flush on the hallway wall.",
          })}
          details={{
            start: null,
            step: null,
            forYou: [],
            stepIn: false,
            held: { questions: 0, tasks: 1 },
            scopedSteps: 0,
            answers: [],
          }}
          onStart={NOOP}
        />
      </Example>
      <Example label="A proposal, with the agent's case">
        <ProposalCard
          line={line({
            ref: "L-3",
            title: "Widgets redesign",
            state: "proposed",
            proposedBy: "panel-widgets",
            recommendation: "up_next",
            recommendationWhy: "The enclosure's final print moves the screen's mounting points.",
          })}
          foldTargets={[line()]}
          onStart={NOOP}
          onQueue={NOOP}
          onTable={NOOP}
          onFold={NOOP}
          onReject={NOOP}
          onDrop={NOOP}
        />
      </Example>
      <Example label="Tabled, folded">
        <FoldedSection
          title="Tabled"
          lines={[line({ title: "Podcast cleanup", state: "tabled", tabledReason: "The disk is not tight" })]}
        >
          <QuietRow
            line={line({ title: "Podcast cleanup", state: "tabled", tabledReason: "The disk is not tight" })}
          />
        </FoldedSection>
      </Example>
      <Example label="Markdown, as agents write it">
        <Markdown
          text={
            "## Where it stands\n\nThe base is printed for the **26 mm** board.\n\n- measured the grip\n- `octo task file` for the final fit"
          }
        />
      </Example>
      <Example label="A box that grows">
        <TextBox label="A note" value={"A longer note,\nover two lines."} onChange={NOOP} />
      </Example>
      <Example label="Choices waiting, with Undo">
        <UndoBar
          pending={[
            pendingChoice({
              summary: 'Sending "26 mm" to Sendspin enclosure',
              dueAt: "2026-11-14T09:00:08.000Z",
            }),
          ]}
          now={Date.parse("2026-11-14T09:00:00.000Z")}
          lines={{}}
          onUndo={NOOP}
        />
      </Example>
      <Example label="Adding a line">
        <NewLineCard repos={["PANEL", "GARDEN"]} onAdd={NOOP} onCancel={NOOP} />
      </Example>
      <Example label="A line opened: head, moves, summary">
        <LinePanelHead line={line({ ref: "L-7" })} position="Line 2 of 5" repos={["PANEL"]} />
        <LineActions line={line()} owner="panel-widgets" onChoose={NOOP} onTable={NOOP} />
        <SummaryBox
          line={line({
            headline: "Printed; the short board fits. One answer and one measurement from the final print.",
            summary:
              "The base is printed and the **26 mm board** fits it. **Next:** measure, then print the final base.",
            summaryAt: "2026-11-14T09:40:00.000Z",
          })}
          owner="panel-widgets"
        />
      </Example>
      <Example label="A line's plan, and its owner">
        <PlanList
          steps={[
            { line: "L-7", position: 1, title: "Model the base for both boards", status: "done" },
            { line: "L-7", position: 2, title: "Settle board and opening", status: "doing" },
            { line: "L-7", position: 3, title: "Final print and photograph", status: "todo" },
          ]}
          work={[
            {
              ref: "PANEL-6",
              title: "Measure the grip",
              status: "todo",
              step: 2,
              assignee: "dev",
              prs: [{ ref: "PR-4", repo: "vasc/homepanel", number: 14, state: "open", checks: "passing" }],
            },
          ]}
        />
        <OwnerBox
          line={line()}
          crew={{
            owner: { name: "panel-widgets", state: "asleep" },
            helpers: [],
            scoper: null,
            search: null,
          }}
          repos={["PANEL"]}
          onStop={NOOP}
          onOwn={NOOP}
          onHand={NOOP}
        />
      </Example>
    </DesignSection>
  );
}
