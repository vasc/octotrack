import { z } from "zod";
import { useDraft } from "./useDraft.ts";

/** A task's draft: each named outcome typed so far, and the note. */
const Stored = z.object({ values: z.record(z.string(), z.string()), note: z.string() });
type Stored = z.infer<typeof Stored>;

const EMPTY: Stored = { values: {}, note: "" };

/** Reads a draft; one written as plain words, before tasks had named outcomes, is the note. */
function parse(text: string): Stored {
  if (text === "") return EMPTY;
  try {
    const parsed = Stored.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : { values: {}, note: text };
  } catch {
    return { values: {}, note: text };
  }
}

/**
 * What is typed into a task, kept on the server as one draft (`task:<ref>`, which the server deletes when the task
 * closes): its named outcomes and its note, so they follow the developer between devices together.
 */
export function useOutcomeDraft(ref: string) {
  const draft = useDraft(`task:${ref}`);
  const stored = parse(draft.value);
  const save = (next: Stored) => {
    const empty = next.note === "" && Object.values(next.values).every((value) => value === "");
    if (empty) draft.clear();
    else draft.change(JSON.stringify(next));
  };
  return {
    values: stored.values,
    note: stored.note,
    error: draft.error,
    flush: draft.flush,
    setValue(name: string, value: string) {
      save({ ...stored, values: { ...stored.values, [name]: value } });
    },
    setNote(note: string) {
      save({ ...stored, note });
    },
  };
}
