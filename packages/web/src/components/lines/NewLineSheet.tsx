import { type ReactNode, useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Chips } from "../ui/Chips.tsx";
import { Note } from "../ui/Note.tsx";
import { Sheet } from "../ui/Sheet.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { Segments } from "../ui/Segments.tsx";

export interface NewLine {
  title: string;
  doneWhen: string;
  repos: string[];
  where: "up_next" | "working";
}

/** What New line keeps as it is typed, so closing it loses nothing. */
export interface NewLineDraft {
  title: string;
  doneWhen: string;
}

/** What still stops a line from being added, as the line under the actions says it. */
function missing(title: string, doneWhen: string, repoChosen: boolean): string | null {
  const parts = [
    title.trim() === "" ? "a title" : null,
    doneWhen.trim() === "" ? "done when" : null,
    repoChosen ? null : "a repo or None",
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  const last = parts.at(-1) ?? "";
  return `Still needs: ${parts.length === 1 ? last : `${parts.slice(0, -1).join(", ")}, and ${last}`}.`;
}

/** A place in an order, in words: 1st, 2nd, 3rd, 4th, 11th, 21st. */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const unit = n % 10;
  return `${n}${unit === 1 ? "st" : unit === 2 ? "nd" : unit === 3 ? "rd" : "th"}`;
}

/**
 * A new line, in a sheet of its own: its title, when it is done, and the repos it works in, or that it needs no code
 * and is the developer's own, kept as a draft as it is typed. It goes up next, taking its turn after the lines there,
 * or straight to Working on; while it cannot be added, the words beside Add line say what is missing.
 */
export function NewLineSheet({
  repos,
  repoNames = {},
  upNext = 0,
  draft,
  onDraft,
  onAdd,
  onCancel,
  reposStatus,
  notSaved = false,
}: {
  repos: readonly string[];
  /** Each repo's name by its key: a chip leads with the name, its key after it, small. */
  repoNames?: Readonly<Record<string, string>>;
  /** How many lines are up next already, so Up next can say which turn it takes. */
  upNext?: number;
  /** The repos are loading or failed: said in the Repos list, with "None, it needs no code" still usable. */
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
  const [where, setWhere] = useState<NewLine["where"]>("up_next");
  const ready = title.trim() !== "" && doneWhen.trim() !== "" && (mine || picked.length > 0);
  const toggle = (repo: string) =>
    setPicked(picked.includes(repo) ? picked.filter((other) => other !== repo) : [...picked, repo]);
  return (
    <Sheet
      title="New line"
      subtitle="A thread of work, and how you will know it is done."
      onClose={onCancel}
      actions={
        <Actions>
          <Button
            variant="primary"
            disabled={!ready}
            onClick={() =>
              onAdd({ title: title.trim(), doneWhen: doneWhen.trim(), repos: mine ? [] : [...picked], where })
            }
          >
            Add line
          </Button>
          {ready ? null : <Note>{missing(title, doneWhen, mine || picked.length > 0)}</Note>}
          {notSaved ? <NotKept unsaved /> : <Note>Kept as a draft if you close it.</Note>}
        </Actions>
      }
    >
      <Field
        label="Title"
        placeholder="Back up the database host nightly"
        value={title}
        onChange={setTitle}
        autoFocus
      />
      <Field label="Done when" value={doneWhen} onChange={setDoneWhen} multiline />
      <Chips
        label="Repos it works in"
        chips={[
          ...repos.map((repo) => ({
            key: repo,
            label: repoNames[repo] ?? repo,
            ...(repoNames[repo] === undefined || repoNames[repo] === repo ? {} : { note: repo }),
            checked: !mine && picked.includes(repo),
            onToggle: () => {
              setMine(false);
              toggle(repo);
            },
          })),
          {
            key: "mine",
            label: "None, it needs no code",
            checked: mine,
            onToggle: () => setMine(!mine),
            apart: true,
          },
        ]}
      />
      {reposStatus}
      <Segments
        label="Where it goes"
        chosen={where}
        onChoose={(key) => setWhere(key === "working" ? "working" : "up_next")}
        choices={[
          {
            key: "up_next",
            label: "Up next",
            description: `Waits its turn, ${ordinal(upNext + 1)} in your order`,
          },
          { key: "working", label: "Working on", description: "An agent is found for it now" },
        ]}
      />
    </Sheet>
  );
}
