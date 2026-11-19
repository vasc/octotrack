import { LineActions } from "../components/entity/LineActions.tsx";
import { LinePanelHead } from "../components/entity/LinePanelHead.tsx";
import { OwnerBox } from "../components/entity/OwnerBox.tsx";
import { PlanList } from "../components/entity/PlanList.tsx";
import { SummaryBox } from "../components/entity/SummaryBox.tsx";
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
import { LineHandle } from "../components/home/LineHandle.tsx";
import { Fold } from "../components/ui/Fold.tsx";
import { List } from "../components/ui/List.tsx";
import { Markdown } from "../components/ui/Markdown.tsx";
import { TextBox } from "../components/ui/TextBox.tsx";
import { DesignSection, Example, SheetExample } from "./Example.tsx";
import { decision, decisionCard, issue, line, pendingChoice, planBranch, planStep } from "./fixtures.ts";

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
  title: "Measure the board and its holes",
  assignee: "dev",
  place: "the bench",
  outcome: "In mm, with your calipers on the real parts.",
  fields: ["Length", "Holes"],
});

/** Lines of work: home's sections, a line in the inspector, and what waits on the developer. */
export function LinesGallery() {
  return (
    <DesignSection title="Lines of work">
      <Example label="What waits on you">
        <TopBar
          appearance={{ palette: "paper", mode: "system" }}
          onPalette={() => {}}
          onMode={() => {}}
          path="/"
          counts={[
            { key: "toAnswer", label: "to answer", count: 4 },
            { key: "toDo", label: "to do", count: 3 },
            { key: "toAccept", label: "to accept", count: 1 },
            { key: "toStepIn", label: "to step in", count: 1 },
          ]}
          places={["the bench", "the Mac"]}
          at={null}
          onAt={NOOP}
          onNewLine={NOOP}
          onKeys={NOOP}
        />
      </Example>
      <Example label="A working line, waiting on you">
        <List>
          <WorkingLine
            handle={
              <LineHandle
                title="Sendspin enclosure"
                number={2}
                canMoveUp
                canMoveDown
                canQueue
                onMove={NOOP}
              />
            }
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
              step: { position: 3, of: 4, title: "settle board and opening", waitsOn: [], stalledOn: [] },
              branchesOpen: 0,
              branchOf: null,
              forYou: [{ kind: "question", card: QUESTION }],
              stepIn: false,
              stepInReason: null,
              stepInKind: null,
              waitingOnYou: false,
              held: { questions: 0, tasks: 0 },
              reconfirming: 0,
              sinceSummary: 0,
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
              prs: [],
            }}
          >
            <List>
              <ForYouRow
                item={{ kind: "question", card: QUESTION }}
                label="Question D-34"
                focused={false}
                onOpen={NOOP}
              />
            </List>
          </WorkingLine>
        </List>
      </Example>
      <Example label="A task, one row, and opened">
        <List>
          <ForYouRow
            item={{ kind: "task", task: TASK, frees: { ref: "OCT-41", title: "the real wake test" } }}
            label="Task OCT-7"
            focused={false}
            onOpen={NOOP}
          />
        </List>
        <TaskCard
          task={TASK}
          words=""
          onWords={NOOP}
          values={{ Length: "26.0", Holes: "20.3" }}
          onValue={NOOP}
          why=""
          onWhy={NOOP}
          onDone={NOOP}
          onCant={NOOP}
          reply=""
          onReplyWords={NOOP}
          onReply={NOOP}
        />
      </Example>
      <Example label="Spread thin">
        <SpreadThin working={8} noOwner={2} waiting={3} />
      </Example>
      <SheetExample label="Start a line that waited">
        {(close) => (
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
            onOwn={() => {}}
            onStart={close}
            onCancel={close}
          />
        )}
      </SheetExample>
      <Example label="Telling a line, and a line of your own">
        <TellBox line="L-1" to="panel-widgets" words="" onWords={NOOP} onSend={NOOP} />
        <OwnWorkBox
          line="L-7"
          words=""
          onWords={NOOP}
          onTask={NOOP}
          onNote={NOOP}
          repos={["PANEL"]}
          allRepos={["PANEL"]}
          onHand={NOOP}
        />
      </Example>
      <Example label="A case for done, one row, and opened">
        <List>
          <ForYouRow
            item={{
              kind: "done",
              line: "L-1",
              text: "Printed, fitted and in use.",
              by: "panel",
              doneWhen: "a printed case holds the board",
            }}
            label="Proposed as done: L-1"
            focused={false}
            onOpen={NOOP}
          />
        </List>
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
        <List>
          <WorkingLine
            handle={<LineHandle title="South Tyrol trip" number={5} canMoveUp canMoveDown onMove={NOOP} />}
            line={line({ title: "South Tyrol trip" })}
            crew={{ owner: null, helpers: [], scoper: null, search: { step: 3, since: "" } }}
          >
            <StepIn
              line={line({ title: "South Tyrol trip" })}
              reason="trips.2, started for it, exited at once: the agent command is not logged in. Octotrack tries again by itself, less often each time."
              onRetry={NOOP}
              onOwn={NOOP}
              onTable={NOOP}
            />
          </WorkingLine>
        </List>
      </Example>
      <Example label="Up next">
        <List>
          <UpNextRow
            handle={<LineHandle title="Wall mount" number={6} canMoveUp canMoveDown={false} onMove={NOOP} />}
            line={line({
              state: "up_next",
              title: "Wall mount",
              doneWhen: "the panel hangs flush on the hallway wall.",
            })}
            details={{
              start: null,
              step: null,
              branchesOpen: 0,
              branchOf: null,
              forYou: [],
              stepIn: false,
              stepInReason: null,
              stepInKind: null,
              waitingOnYou: false,
              held: { questions: 0, tasks: 1 },
              reconfirming: 0,
              sinceSummary: 0,
              scopedSteps: 0,
              answers: [],
              prs: [],
            }}
            onStart={NOOP}
          />
        </List>
      </Example>
      <Example label="A proposal, with the agent's case">
        <List>
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
        </List>
      </Example>
      <Example label="Tabled, folded">
        <Fold title="Tabled" count={1} summary="Podcast cleanup">
          <List>
            <QuietRow
              line={line({
                title: "Podcast cleanup",
                state: "tabled",
                tabledReason: "The disk is not tight",
              })}
            />
          </List>
        </Fold>
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
      <Example label="A line opened: head, moves, summary">
        <LinePanelHead line={line({ ref: "L-7" })} repos={["PANEL"]} />
        <LineActions line={line()} owner="panel-widgets" onChoose={NOOP} onTable={NOOP} />
        <SummaryBox
          line={line({
            headline: "Printed; the short board fits. One answer and one measurement from the final print.",
            summary:
              "The base is printed and the **26 mm board** fits it. **Next:** measure, then print the final base.",
            summaryAt: "2026-11-14T09:40:00.000Z",
          })}
        />
      </Example>
      <Example label="A line's plan as a tree: a branch holding up step 3, and one that became a line">
        <PlanList
          steps={[
            planStep({ position: 1, title: "Model the base", status: "done" }),
            planStep({ position: 2, title: "Print and test-fit", status: "doing" }),
            planStep({
              id: 21,
              branch: 100,
              position: 1,
              address: "2a.1",
              title: "Pick a board",
              status: "done",
            }),
            planStep({
              id: 22,
              branch: 100,
              position: 2,
              address: "2a.2",
              title: "Order it and wait for delivery",
            }),
            planStep({ position: 3, title: "Final print" }),
            planStep({ position: 4, title: "Hang it in the hallway" }),
          ]}
          branches={[
            planBranch({
              id: 100,
              fromStep: 2,
              address: "2a",
              title: "Order the USB-C breakout",
              holdsUp: "3",
            }),
            planBranch({
              id: 101,
              fromStep: 3,
              address: "3a",
              title: "Wall bracket",
              holdsUp: "4",
              became: { ref: "L-12", title: "Wall bracket", state: "up_next" },
            }),
          ]}
          work={[]}
          actions={{
            onStatus: NOOP,
            onHoldsUp: NOOP,
            onEdit: NOOP,
            onPromote: NOOP,
            onRemove: NOOP,
          }}
        />
      </Example>
      <Example label="A line's plan, and its owner">
        <PlanList
          steps={[
            planStep({ position: 1, title: "Model the base for both boards", status: "done" }),
            planStep({ position: 2, title: "Settle board and opening", status: "doing" }),
            planStep({ position: 3, title: "Final print and photograph" }),
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
          repoNames={["PANEL"]}
          onStop={NOOP}
          onOwn={NOOP}
        />
      </Example>
    </DesignSection>
  );
}
