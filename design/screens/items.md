# Items

What comes to the developer besides questions: tasks, a line proposed as done, a changed done when, a line to step in
on, and answers already given. Designed on `Items.dc.html` (states A to H: task opened, task can't be done, a task of
your own, task closed, is it done, done when changed, step in of every kind, an answer and what became of it), in the
canvas at https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU. Every item opened has the same three zones as a question:
what it is, what you do, other ways out.

### components/home/ForYouItem.tsx

- Designed in: Items.dc.html, states A, C, E, F; Main.dc.html (a question)
- What it shows: the focused item opened in full: a question (DecisionCardItem), a task (TaskItem), a proposed done or a changed done when (LineProposalCard).
- Changes from today: none of its own; each kind changes as its own section says.
- Loading: never loads on its own: given its item by LineForYouItem or PanelForYou.
- Error: cannot fail on its own; each kind says its own failures in place.
- Empty: never empty: it exists only for an item.

### components/home/TaskItem.tsx

- Designed in: Items.dc.html, states A, B, C
- What it shows: TaskCard with the task's draft kept on the tracker and the step it holds up.
- Changes from today: the draft's state is said: "1 of 2 filled · saved as you type".
- Loading: the draft loads from the tracker; follows the Primitives pattern: the fields stay usable and are not cleared when the draft arrives (today they show empty and typing replaces the stored draft). The "holds up step 3" fact appears once the plan loads.
- Error: draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back." under the field. If the plan cannot load, the "holds up" fact is left out, as today.
- Empty: never empty: it exists only for a task.

### components/home/TaskCard.tsx

- Designed in: Items.dc.html, states A, B, C
- What it shows: "Task for you · PANEL-6 · at the bench · holds up step 3, settle the enclosure · filed by panel-widgets", the title, the body, "Frees PANEL-4 Print the wall mount"; then "What to send back" with its fields and "1 of 2 filled · saved as you type"; then Done and "Can't do it".
- Changes from today:
  - "What to send back" heads the fields; the count line reads "1 of 2 filled · saved as you type" (today "1 of 2 filled, saved").
  - Can't do it (B): "Why PANEL-6 cannot be done", then "Close it" and "Back" (today "Cancel").
  - A task of your own (C) is one row: "Your task · LIFE-1 · at home", the title, Done and "Can't".
- Loading: Done shows its busy word while it sends (Primitives Button).
- Error: a Done or Close it that fails follows Question-States E ("Not sent. The tracker did not answer.") and the Primitives pattern: said under the buttons, what was filled in kept, with Send again.
- Empty: Done is off until the named fields are filled, with the count saying how many are.

### components/home/OutcomeFields.tsx

- Designed in: Items.dc.html, state A
- What it shows: one labelled field per thing to send back ("Inner depth (mm)", "Measured at"), then "Note".
- Changes from today: none in words.
- Loading: never loads on its own: given its values by TaskCard.
- Error: a field that cannot be saved follows the Primitives Field "not saved" state.
- Empty: empty fields show their placeholders ("where you measured").

### components/home/TaskClosed.tsx

- Designed in: Items.dc.html, state D
- What it shows: one read-only row: "Done · PANEL-6 · by you, 2h ago", the title, then what was sent back ("Inner depth 26.5 mm, measured at the back wall.").
- Changes from today: how it ended leads the row with who and when; the other endings read "Could not be done: the enclosure is at the office" and "Withdrawn by panel-widgets".
- Loading: never loads on its own: given the task and its history by IssuePanel.
- Error: cannot fail on its own.
- Empty: nothing sent back: the result line is left out.

### components/home/LineProposalCard.tsx

- Designed in: Items.dc.html, states E, F
- What it shows: is it done (E): "Proposed as done · by infra", the line's title, "Done when" and its text, "Its case" and the case, then Done and "Not yet". Done when changed (F): "Done when changed · by chores, while it waited", "Was" and "Proposed" side by side, "Why: …", then Accept and Keep current.
- Changes from today: the title is the line's title (today it is the done when or the new text); Done when and the case are labelled; Not yet opens a box "What it still needs", then Send (today "Not yet" submits); the old and new done when sit side by side.
- Loading: never loads on its own: given the proposal by ForYouItem.
- Error: a request that fails follows the Primitives pattern: said under the buttons, with Try again; the "What it still needs" words are kept.
- Empty: never empty: it exists only for a proposal.

### components/home/DoneWhenChanged.tsx

- Designed in: Items.dc.html, state F
- What it shows: in the Start sheet, "Done when changed · by chores, while it waited", "Was" and "Proposed" side by side, "Why: …", then Accept and Keep current.
- Changes from today: "Was: …" as a note under the proposal becomes the two side by side; who changed it and when is said.
- Loading: never loads on its own: given the proposal by StartSheetView.
- Error: cannot fail on its own; the Start sheet reports a failed answer.
- Empty: no why: the Why line is left out.

### components/home/StepIn.tsx

- Designed in: Items.dc.html, state G; Line-States.dc.html, state D
- What it shows: one sentence of what went wrong, its detail, then the action that fits, then "I'll own it" and "Table it". The kinds: "Nothing can start a session. No start command is set for TTUBE." Try now; "A start keeps failing. Three tries, each exits at once (exit 127)." Try now; "Every session is busy. 1 of 1 allowed is running." Start one anyway; "Its checkout could not be made. gh repo clone failed: not logged in." Set its checkout; "It names no repo. No agent can take it; own it or give it a repo." I'll own it; "The runner is only watching. It logs what it would start; turn it on in agent-setup.json." I'll own it.
- Changes from today: each kind says what happened and its cause in two short sentences; I'll own it and Table it always follow the kind's own action (today Table it comes before I'll own it).
- Loading: the action shows its busy word (Primitives Button: "Trying…").
- Error: a request that fails follows the Primitives pattern: said under the actions, with Try again.
- Empty: never empty: it exists only while a line needs stepping in.

### components/home/CheckoutForm.tsx

- Designed in: Items.dc.html, state G (caption); Primitives.dc.html, Field (invalid)
- What it shows: a path field "Checkout of hydra", Set and Cancel.
- Changes from today: Set stays off until the path starts with /, and the field says so under it: "A full path, starting with /" (today Set is off with no reason).
- Loading: Set shows its busy word while it sends (Primitives Button).
- Error: a request that fails follows the Primitives pattern: said under the field, path kept, with Try again.
- Empty: Set is off and the hint shows under the empty field.

### components/home/AnswerStatus.tsx

- Designed in: Items.dc.html, state H
- What it shows: "D-20 Uninstall it · picked up by funnel-session, 9d ago" and Change; "not picked up yet"; "ttube could not be woken; finding an owner".
- Changes from today: "Change answer" becomes "Change"; the age says "ago" ("9d ago").
- Loading: never loads on its own: given the answer by WorkingLine.
- Error: cannot fail on its own; Change opens the question.
- Empty: never empty: it exists only for an answer.
