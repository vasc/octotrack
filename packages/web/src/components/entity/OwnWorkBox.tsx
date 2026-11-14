import { TextBox } from "../ui/TextBox.tsx";

export interface OwnWorkBoxProps {
  line: string;
  words: string;
  onWords(words: string): void;
  onTask(title: string): void;
  onNote(body: string): void;
}

/** On a line the developer owns, one growing box: what is typed becomes a task of theirs, or a note on the line. */
export function OwnWorkBox({ line, words, onWords, onTask, onNote }: OwnWorkBoxProps) {
  const text = words.trim();
  return (
    <section className="panel-section" aria-label="Add a task or a note">
      <h2 className="panel-label">Add a task or a note</h2>
      <div className="composer">
        <TextBox label={`Add to ${line}`} placeholder="A task, or a note" value={words} onChange={onWords} />
        <button type="button" className="btn" disabled={text === ""} onClick={() => onTask(text)}>
          Add as a task
        </button>
        <button type="button" className="btn" disabled={text === ""} onClick={() => onNote(text)}>
          Add as a note
        </button>
      </div>
    </section>
  );
}
