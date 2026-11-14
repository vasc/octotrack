import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import { TextBox } from "../ui/TextBox.tsx";

/** An answer in the developer's own words: a box that takes the cursor, Send, which says Sending while it waits, and Cancel. */
export function OwnWords({ refName, form }: { refName: string; form: DecisionForm }) {
  const words = form.ownWords ?? "";
  return (
    <form
      className="question-own"
      onSubmit={(event) => {
        event.preventDefault();
        form.sendOwn();
      }}
    >
      <TextBox
        label={`Your answer to ${refName}`}
        placeholder="In your own words"
        value={words}
        onChange={form.setOwn}
        onSubmit={form.sendOwn}
        autoFocus
      />
      <div className="question-actions">
        <button
          type="submit"
          className="btn"
          data-primary="true"
          disabled={words.trim() === "" || form.sending}
        >
          {form.sending ? "Sending" : "Send"}
        </button>
        <button type="button" className="btn" onClick={form.closeOwn}>
          Cancel
        </button>
      </div>
    </form>
  );
}
