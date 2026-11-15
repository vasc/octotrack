import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { Sheet } from "../ui/Sheet.tsx";

export interface NewLine {
  title: string;
  doneWhen: string;
  repos: string[];
  where: "up_next" | "working" | "tabled";
  reason?: string;
  lookAgainAt?: string;
}

/**
 * A new line, in a sheet of its own: what it is, when it is done, and its repos, or that it is the developer's own. It
 * goes to up next, starts, or is tabled with a reason and, if wanted, a day to look at it again.
 */
export function NewLineSheet({
  repos,
  onAdd,
  onCancel,
}: {
  repos: readonly string[];
  onAdd(line: NewLine): void;
  onCancel(): void;
}) {
  const [title, setTitle] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [mine, setMine] = useState(false);
  const [tabling, setTabling] = useState(false);
  const [reason, setReason] = useState("");
  const [lookAgain, setLookAgain] = useState("");
  const ready = title.trim() !== "" && doneWhen.trim() !== "" && (mine || picked.length > 0);
  const base = { title: title.trim(), doneWhen: doneWhen.trim(), repos: mine ? [] : [...picked] };
  const toggle = (repo: string) =>
    setPicked(picked.includes(repo) ? picked.filter((other) => other !== repo) : [...picked, repo]);
  const actions = tabling ? (
    <Actions>
      <Button
        variant="primary"
        disabled={reason.trim() === ""}
        onClick={() =>
          onAdd({
            ...base,
            where: "tabled",
            reason: reason.trim(),
            ...(lookAgain === "" ? {} : { lookAgainAt: lookAgain }),
          })
        }
      >
        Table it
      </Button>
      <Button variant="quiet" onClick={() => setTabling(false)}>
        Back
      </Button>
    </Actions>
  ) : (
    <Actions>
      <Button variant="primary" disabled={!ready} onClick={() => onAdd({ ...base, where: "up_next" })}>
        Add to up next
      </Button>
      <Button disabled={!ready} onClick={() => onAdd({ ...base, where: "working" })}>
        Start
      </Button>
      <Button disabled={!ready} onClick={() => setTabling(true)}>
        Table
      </Button>
    </Actions>
  );
  return (
    <Sheet title="New line" onClose={onCancel} actions={actions}>
      {tabling ? (
        <>
          <Field label="Why it waits" value={reason} onChange={setReason} autoFocus />
          <Field label="Look again on" type="date" value={lookAgain} onChange={setLookAgain} />
        </>
      ) : (
        <>
          <Field label="What it is" value={title} onChange={setTitle} autoFocus />
          <Field label="Done when" value={doneWhen} onChange={setDoneWhen} multiline />
          <List label="Repos">
            {repos.map((repo) => (
              <Row
                key={repo}
                title={repo}
                checked={!mine && picked.includes(repo)}
                onToggle={() => {
                  setMine(false);
                  toggle(repo);
                }}
              />
            ))}
            <Row title="None: it's mine" checked={mine} onToggle={() => setMine(!mine)} />
          </List>
        </>
      )}
    </Sheet>
  );
}
