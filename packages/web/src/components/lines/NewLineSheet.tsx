import { type ReactNode, useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Chips } from "../ui/Chips.tsx";
import { Note } from "../ui/Note.tsx";
import { Sheet } from "../ui/Sheet.tsx";
import { NotKept } from "../ui/NotKept.tsx";

export interface NewLine {
  title: string;
  doneWhen: string;
  repos: string[];
  where: "up_next" | "working" | "tabled";
  reason?: string;
  lookAgainAt?: string;
}

/** What New line keeps as it is typed, so closing it loses nothing. */
export interface NewLineDraft {
  title: string;
  doneWhen: string;
}

/** What still stops a line from being added, as the line under the actions says it. */
function missing(title: string, doneWhen: string, repoChosen: boolean): string | null {
  const parts = [
    title.trim() === "" ? "what it is" : null,
    doneWhen.trim() === "" ? "done when" : null,
    repoChosen ? null : "a repo or None",
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  const last = parts.at(-1) ?? "";
  return `Still needs: ${parts.length === 1 ? last : `${parts.slice(0, -1).join(", ")}, and ${last}`}.`;
}

/**
 * A new line, in a sheet of its own: what it is, when it is done, and its repos, or that it is the developer's own,
 * kept as a draft as it is typed. It goes to up next, starts, or is tabled with a reason and, if wanted, a day to look
 * at it again; while it cannot, the words under the actions say what is missing.
 */
export function NewLineSheet({
  repos,
  draft,
  onDraft,
  onAdd,
  onCancel,
  reposStatus,
  notSaved = false,
}: {
  repos: readonly string[];
  /** The repos are loading or failed: said in the Repos list, with "None: it's mine" still usable. */
  reposStatus?: ReactNode;
  /** The words typed are not kept on the tracker yet. */
  notSaved?: boolean;
  draft: NewLineDraft;
  onDraft(draft: NewLineDraft): void;
  onAdd(line: NewLine): void;
  onCancel(): void;
}) {
  const { title, doneWhen } = draft;
  const setTitle = (next: string) => onDraft({ title: next, doneWhen });
  const setDoneWhen = (next: string) => onDraft({ title, doneWhen: next });
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
      {ready ? null : <Note>{missing(title, doneWhen, mine || picked.length > 0)}</Note>}
    </Actions>
  );
  return (
    <Sheet title="New line" onClose={onCancel} actions={actions}>
      {tabling ? (
        <>
          <Field label="Why it waits" value={reason} onChange={setReason} autoFocus />
          <Field label="Look again on · optional" type="date" value={lookAgain} onChange={setLookAgain} />
        </>
      ) : (
        <>
          <Field
            label="What it is"
            placeholder="Back up the Home Assistant host nightly"
            value={title}
            onChange={setTitle}
            autoFocus
          />
          <Field label="Done when" value={doneWhen} onChange={setDoneWhen} multiline />
          <Chips
            label="Repos"
            chips={[
              ...repos.map((repo) => ({
                key: repo,
                label: repo,
                checked: !mine && picked.includes(repo),
                onToggle: () => {
                  setMine(false);
                  toggle(repo);
                },
              })),
              {
                key: "mine",
                label: "None: it's mine",
                checked: mine,
                onToggle: () => setMine(!mine),
                apart: true,
              },
            ]}
          />
          {reposStatus}
          {notSaved ? <NotKept unsaved /> : <Note>Saved as you type, so closing loses nothing.</Note>}
        </>
      )}
    </Sheet>
  );
}
