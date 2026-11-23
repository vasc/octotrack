import type { LineView } from "../../hooks/useLineView.ts";
import { NotKept } from "../ui/NotKept.tsx";
import { OwnWorkBox } from "./OwnWorkBox.tsx";
import { TellBox } from "./TellBox.tsx";

/** What the developer says to a line: on one they own, a task or a note; on a working one, Tell its owner. */
export function LineTell({ view }: { view: LineView }) {
  const { line, own, tell, choices, h, choicesWaiting } = view;
  return (
    <>
      {!view.live ? null : line.ownedBy !== null ? (
        <OwnWorkBox
          line={line.ref}
          words={own.value}
          onWords={own.change}
          onTask={(title) => void own.flush().then(() => choices.addTask(title))}
          onNote={(body) => void own.flush().then(() => choices.addNote(body))}
          repos={line.repos}
          allRepos={h.repos}
          onHand={choices.hand}
          sending={choicesWaiting(`own:${line.ref}`)}
        />
      ) : line.state === "working" ? (
        <TellBox
          line={line.ref}
          to={view.owner}
          words={tell.value}
          onWords={tell.change}
          focus={view.telling}
          sending={choicesWaiting(`tell:${line.ref}`)}
          onSend={(words) => void tell.flush().then(() => choices.tell(words))}
        />
      ) : null}
      <NotKept unsaved={(tell.error ?? own.error) !== null} />
    </>
  );
}
