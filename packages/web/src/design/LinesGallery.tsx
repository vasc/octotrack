import { LineActions } from "../components/entity/LineActions.tsx";
import { LinePanel } from "../components/entity/LinePanel.tsx";
import { FoldedSection } from "../components/home/FoldedSection.tsx";
import { ForYouRow } from "../components/home/ForYouRow.tsx";
import { HomeCounts } from "../components/home/HomeCounts.tsx";
import { ProposalCard } from "../components/home/ProposalCard.tsx";
import { QuietRow } from "../components/home/QuietRow.tsx";
import { StepIn } from "../components/home/StepIn.tsx";
import { TaskCard } from "../components/home/TaskCard.tsx";
import { UpNextRow } from "../components/home/UpNextRow.tsx";
import { WorkingLine } from "../components/home/WorkingLine.tsx";
import { UndoBar } from "../components/layout/UndoBar.tsx";
import { AddLineForm } from "../components/lines/AddLineForm.tsx";
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
        <HomeCounts counts={{ toAnswer: 4, toDo: 3, toAccept: 1, toStepIn: 1, urgent: 0 }} />
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
        <UndoBar pending={[pendingChoice()]} onUndo={NOOP} onNow={NOOP} />
      </Example>
      <Example label="Adding a line">
        <AddLineForm repos={["PANEL", "GARDEN"]} onAdd={NOOP} />
      </Example>
      <Example label="A line in the inspector, with what you can do">
        <LinePanel line={line({ doneProposal: "Printed, fitted, in use." })} />
        <LineActions
          line={line({ doneProposal: "Printed, fitted, in use." })}
          onChoose={NOOP}
          onTable={NOOP}
          onDoneWhen={NOOP}
        />
      </Example>
    </DesignSection>
  );
}
