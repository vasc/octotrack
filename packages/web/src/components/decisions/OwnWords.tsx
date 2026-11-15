import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { TextBox } from "../ui/TextBox.tsx";

/** An answer in the developer's own words: a box that takes the cursor, Send, which says Sending while it waits, and Cancel. */
export function OwnWords({ refName, form }: { refName: string; form: DecisionForm }) {
  const words = form.ownWords ?? "";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.sendOwn();
      }}
    >
      <Stack>
        <TextBox
          label={`Your answer to ${refName}`}
          placeholder="In your own words"
          value={words}
          onChange={form.setOwn}
          onSubmit={form.sendOwn}
          autoFocus
        />
        <Actions>
          <Button type="submit" variant="primary" disabled={words.trim() === "" || form.sending}>
            {form.sending ? "Sending" : "Send"}
          </Button>
          <Button variant="quiet" onClick={form.closeOwn}>
            Cancel
          </Button>
        </Actions>
      </Stack>
    </form>
  );
}
