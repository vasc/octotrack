import type { Issue } from "@octotrack/core/schemas";
import { useState } from "react";
import { filledCount, type TaskOutcome, taskOutcome } from "../../lib/tasks.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Field } from "../ui/Field.tsx";
import { Item, Kind } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { OutcomeFields } from "./OutcomeFields.tsx";

export interface TaskCardProps {
  task: Issue;
  /** What is typed so far, kept as a draft by the caller: the outcome, or the note beside named outcomes. */
  words: string;
  onWords(words: string): void;
  /** Each named outcome typed so far, kept in the same draft. */
  values: Readonly<Record<string, string>>;
  onValue(name: string, value: string): void;
  /** Why it cannot be done, kept apart from what was found, so neither is sent as the other. */
  why: string;
  onWhy(why: string): void;
  /** A reply typed so far, kept as a draft by the caller. */
  reply: string;
  onReplyWords(words: string): void;
  onDone(outcome: TaskOutcome): void;
  onCant(why: string): void;
  /** Words back to the agent waiting on it; the task stays open. */
  onReply(words: string): void;
  /** Its Done or Can't do it is waiting with Undo: neither is sent again. */
  sending?: boolean;
  /** The plan step it holds up, by title, where that is known. */
  holdsUp?: string;
  /** The issue its outcome frees, by ref and title, where that is known. */
  frees?: { ref: string; title: string } | null;
}

/**
 * A task opened: where, what it is, and what to send back, as a form saved as it is typed: one box, or a box for each
 * named outcome and a note, with how many are filled, or with nothing asked back an optional note. 1 · Done sends it;
 * 2 · Can't do it asks why and closes it as not done; 3 · Reply sends the agent words and leaves it open. A task of the
 * developer's own has nothing to send anyone: Done is enough.
 */
export function TaskCard({
  task,
  words,
  onWords,
  values,
  onValue,
  why,
  onWhy,
  reply,
  onReplyWords,
  onDone,
  onCant,
  onReply,
  sending = false,
  holdsUp,
  frees = null,
}: TaskCardProps) {
  const [mode, setMode] = useState<"cant" | "reply" | null>(null);
  const cant = mode === "cant";
  const replying = mode === "reply";
  // Filed by the developer for themself: nobody waits on it, so there is nothing to send and no one to reply to.
  const own = task.createdBy === "dev";
  const asked = task.outcome !== null && task.outcome !== "";
  const named = task.fields.length > 0;
  const outcome = taskOutcome(task, values, words);
  const ready = outcome !== null && !sending;
  const form = (
    <form
      aria-label={cant ? "Say why it cannot be done" : replying ? "Reply" : "Report the outcome"}
      onSubmit={(event) => {
        event.preventDefault();
        if (replying) {
          if (reply.trim() !== "" && !sending) onReply(reply.trim());
          return;
        }
        if (cant) {
          if (why.trim() !== "" && !sending) onCant(why.trim());
          return;
        }
        // The words stay a draft until the task closes, which deletes it: an Undo must not lose them.
        if (outcome !== null && !sending) onDone(outcome);
      }}
    >
      <Stack>
        {replying ? (
          <Field
            label={`Reply to ${task.createdBy}`}
            value={reply}
            onChange={onReplyWords}
            multiline
            autoFocus
          />
        ) : own && !cant ? null : named && !cant ? (
          <>
            {task.outcome === null ? null : <Markdown text={task.outcome} />}
            <OutcomeFields
              fields={task.fields}
              values={values}
              onValue={onValue}
              note={words}
              onNote={onWords}
            />
          </>
        ) : (
          <Field
            label={
              cant
                ? `Why ${task.ref} cannot be done`
                : asked
                  ? (task.outcome ?? "")
                  : "Anything to say · optional"
            }
            placeholder={cant ? "Why not" : undefined}
            value={cant ? why : words}
            onChange={cant ? onWhy : onWords}
            multiline
          />
        )}
        {replying ? (
          <Actions>
            <Button
              type="submit"
              variant="primary"
              disabled={reply.trim() === ""}
              busy={sending ? "Sending…" : undefined}
            >
              Send
            </Button>
            <Button onClick={() => setMode(null)}>Back</Button>
          </Actions>
        ) : cant ? (
          <Actions>
            <Button
              type="submit"
              variant="primary"
              disabled={why.trim() === ""}
              busy={sending ? "Closing…" : undefined}
            >
              Close it
            </Button>
            <Button onClick={() => setMode(null)}>Back</Button>
          </Actions>
        ) : (
          <Actions>
            <Button
              type="submit"
              variant="primary"
              choice={1}
              disabled={!ready}
              busy={sending ? "Sending…" : undefined}
            >
              Done
            </Button>
            <Button choice={2} onClick={() => setMode("cant")}>
              {own ? "Can't" : "Can't do it"}
            </Button>
            {own ? null : (
              <Button choice={3} onClick={() => setMode("reply")}>
                Reply
              </Button>
            )}
            {own ? null : (
              <Note>
                {named
                  ? `${filledCount(task, values)} of ${task.fields.length} filled · saved as you type`
                  : "Saved as you type"}
              </Note>
            )}
          </Actions>
        )}
      </Stack>
    </form>
  );
  return (
    <Item
      label={task.title}
      kind={
        <Facts>
          <Kind>{own ? "Your task" : "Task for you"}</Kind>
          <RefLink value={task.ref} />
          {task.place === null ? null : `at ${task.place}`}
          {holdsUp === undefined ? null : `holds up ${holdsUp}`}
          {task.createdBy === "dev" ? null : `filed by ${task.createdBy}`}
        </Facts>
      }
      title={task.title}
      answer={form}
      {...(cant
        ? { answerLabel: "Why not" }
        : replying
          ? { answerLabel: "Your reply" }
          : asked || named
            ? { answerLabel: "What to send back" }
            : {})}
    >
      {task.body === "" ? null : <Markdown text={task.body} />}
      {frees === null ? null : (
        <Note>
          Frees <RefLink value={frees.ref} /> {frees.title}
        </Note>
      )}
    </Item>
  );
}
