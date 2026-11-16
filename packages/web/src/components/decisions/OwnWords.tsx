import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Stack } from "../ui/Pairs.tsx";

/**
 * An answer in the developer's own words: a labelled box, saved as it is typed, then Send and Back to the options,
 * which keeps what was typed. A question with no options opens here, so its way out is Later instead.
 */
export function OwnWords({ form, open = false }: { form: DecisionForm; open?: boolean }) {
  const words = form.ownWords ?? "";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.sendOwn();
      }}
    >
      <Stack>
        <Field
          label={open ? "Your answer" : "Your answer, in your own words"}
          placeholder={open ? "Write your answer" : undefined}
          value={words}
          onChange={form.setOwn}
          onSubmit={form.sendOwn}
          multiline
          autoFocus={!open}
          note="Saved as you type, on every device"
        />
        <Actions>
          <Button type="submit" variant="primary" disabled={words.trim() === "" || form.sending}>
            {form.sending ? "Sending…" : "Send"}
          </Button>
          {open ? (
            <Button onClick={form.postpone}>Later</Button>
          ) : (
            <Button onClick={form.closeOwn}>Back to the options</Button>
          )}
        </Actions>
      </Stack>
    </form>
  );
}
