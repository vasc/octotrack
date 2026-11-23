import type { LineView } from "../../hooks/useLineView.ts";
import { LineStepIn } from "../home/LineStepIn.tsx";
import { StartSheet } from "../home/StartSheet.tsx";
import { LineActions } from "./LineActions.tsx";

/**
 * A line's moves: Step in, its reason and the action that fits, when nobody can take it; else its moves by its state,
 * Start going through the Start sheet for a line that waited, since it may hold questions and tasks.
 */
export function LineMoves({ view }: { view: LineView }) {
  const { line, h, details, stepIn } = view;
  if (stepIn !== null && details !== undefined && details.stepInKind !== null)
    return <LineStepIn line={line} reason={stepIn} kind={details.stepInKind} focused={false} h={h} />;
  if (view.starting)
    return (
      <StartSheet
        line={line}
        onDoneWhen={h.doneWhen}
        onStart={(ref) => {
          h.start(ref);
          view.setStarting(false);
        }}
        onCancel={() => view.setStarting(false)}
      />
    );
  return (
    <LineActions
      line={line}
      owner={view.owner}
      onChoose={(choice) =>
        choice === "start" && (line.state === "up_next" || line.state === "tabled")
          ? view.setStarting(true)
          : view.choices.choose(choice)
      }
      onTable={view.choices.table}
      foldTargets={view.order.filter((other) => other.ref !== line.ref)}
      onFold={(into) => h.fold(line.ref, into)}
      held={view.held}
    />
  );
}
