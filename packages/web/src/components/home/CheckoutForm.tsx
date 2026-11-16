import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Stack } from "../ui/Pairs.tsx";

/** Set its checkout: where this machine already has a repo, an absolute path, after a clone failed. */
export function CheckoutForm({
  repo,
  onSet,
  onCancel,
}: {
  repo: string;
  onSet(path: string): void;
  onCancel(): void;
}) {
  const [path, setPath] = useState("");
  const valid = path.startsWith("/");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSet(path);
      }}
    >
      <Stack>
        <Field
          label={`Checkout of ${repo}`}
          placeholder="/path/to/repo"
          value={path}
          onChange={setPath}
          autoFocus
          note="A full path, starting with /"
          invalid={path !== "" && !valid}
        />
        <Actions>
          <Button type="submit" variant="primary" disabled={!valid}>
            Set
          </Button>
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        </Actions>
      </Stack>
    </form>
  );
}
