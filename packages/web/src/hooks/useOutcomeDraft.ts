import { useEffect, useState } from "react";
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

/** What was typed before the draft arrived, joined over it: each outcome typed wins, and the note if one was typed. */
function joined(kept: Stored, early: Stored): Stored {
  return { values: { ...kept.values, ...early.values }, note: early.note === "" ? kept.note : early.note };
}

/**
 * What is typed into a task, kept on the server as one draft (`task:<ref>`, which the server deletes when the task
 * closes): its named outcomes and its note, so they follow the developer between devices together.
 */
export function useOutcomeDraft(ref: string) {
  const draft = useDraft(`task:${ref}`);
  // Typed before the server's draft arrived: kept here, since saving it then would replace what the server holds.
  const [early, setEarly] = useState<Stored | null>(null);
  const kept = parse(draft.value);
  const stored = early === null ? kept : draft.loaded ? joined(kept, early) : early;
  const store = (next: Stored) => {
    const empty = next.note === "" && Object.values(next.values).every((value) => value === "");
    if (empty) draft.clear();
    else draft.change(JSON.stringify(next));
  };
  const save = (next: Stored) => {
    if (draft.loaded) store(next);
    else setEarly(next);
  };
  // The server's draft is outside React: once it arrives, what was typed before it is joined to it and saved.
  const { loaded, value } = draft;
  useEffect(() => {
    if (!loaded || early === null) return;
    setEarly(null);
    store(joined(parse(value), early));
  });
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
