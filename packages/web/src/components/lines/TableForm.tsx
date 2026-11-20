import { useState } from "react";
import { dayDate } from "../../lib/format.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";
import { Segments } from "../ui/Segments.tsx";
import { Sheet } from "../ui/Sheet.tsx";

type LookAgain = "week" | "month" | "date" | "none";

/** A day, as the tracker takes it: 2026-12-20, in the viewer's own calendar. */
function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The day to look again, by the choice made: a week or a month from now, the day picked, or none. */
function lookAgainDay(choice: LookAgain, picked: string, now: number): string | null {
  const from = new Date(now);
  switch (choice) {
    case "week":
      return isoDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7));
    case "month":
      return isoDay(new Date(from.getFullYear(), from.getMonth() + 1, from.getDate()));
    case "date":
      return picked === "" ? null : picked;
    case "none":
      return null;
  }
}

/**
 * What tabling does, in two sentences: who winds down and what the line holds until it starts again; then that its
 * plan and history stay, and when it comes back.
 */
function happens(
  held: { questions: number; tasks: number } | undefined,
  owner: string | null,
  day: string | null,
  now: number,
): string {
  const parts = [
    held === undefined || held.questions === 0
      ? null
      : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held === undefined || held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  const holds = parts.length === 0 ? "" : `${parts.join(" and ")} until it starts again`;
  const who =
    owner === null
      ? `No agent is on it, so nothing winds down${holds === "" ? "" : `; it holds ${holds}`}.`
      : `${owner} winds down${holds === "" ? "" : `, and it holds ${holds}`}.`;
  const stays =
    day === null
      ? "Its plan and history stay."
      : `Its plan and history stay; on ${dayDate(day, now)} it comes back to you to start or table again.`;
  return `${who} ${stays}`;
}

/**
 * Tabling a line, in a sheet of its own: why it waits, if there is a why to say; when to look at it again, a week or a
 * month on, a day picked, or none; and what happens, said before it is done.
 */
export function TableForm({
  title,
  held,
  owner = null,
  now = Date.now(),
  onTable,
  onCancel,
}: {
  title: string;
  /** What the line holds that waits with it. */
  held?: { questions: number; tasks: number };
  /** Who winds down: its owner, when it has one. */
  owner?: string | null;
  /** The time now, in milliseconds, which a week or a month on counts from. */
  now?: number;
  onTable(reason: string | null, lookAgainAt: string | null): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState("");
  const [lookAgain, setLookAgain] = useState<LookAgain>("none");
  const [picked, setPicked] = useState("");
  const day = lookAgainDay(lookAgain, picked, now);
  const table = () => onTable(reason.trim() === "" ? null : reason.trim(), day);
  return (
    <Sheet
      title={`Table ${title}`}
      subtitle="Set it aside, out of Working on, until you look again."
      onClose={onCancel}
      actions={
        <Actions>
          <Button variant="primary" onClick={table}>
            Table it
          </Button>
          <Note>You can undo it for a few seconds.</Note>
        </Actions>
      }
    >
      <Field label="Why" value={reason} onChange={setReason} onSubmit={table} multiline autoFocus />
      <Segments
        label="Look again"
        chosen={lookAgain}
        onChoose={(key) => setLookAgain(key === "week" || key === "month" || key === "date" ? key : "none")}
        choices={[
          { key: "week", label: "In a week" },
          { key: "month", label: "In a month" },
          { key: "date", label: "On a date" },
          { key: "none", label: "No date" },
        ]}
      />
      {lookAgain === "date" ? (
        <Field label="Look again on" type="date" value={picked} onChange={setPicked} />
      ) : null}
      <Section title="What happens">
        <Note>{happens(held, owner, day, now)}</Note>
      </Section>
    </Sheet>
  );
}
