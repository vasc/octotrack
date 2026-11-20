# For you

What waits on the developer, one item at a time. Designed on the Triage page of the canvas at
https://claude.ai/artifact/JSt9awRkVko2hzaKCy5ayF, whose sources are kept in `design/canvas/triage/`: `Main.dc.html` (a
question), `T-Task.dc.html`, `T-Accept.dc.html` (an urgent proposal), `T-StepIn.dc.html`, `T-OwnWords.dc.html`,
`T-Undo.dc.html`, `T-Done.dc.html`, and the peeks `T-Peek-Line.dc.html`, `T-Peek-PR.dc.html`, `T-Peek-Stack.dc.html`.

### components/foryou/ForYouPage.tsx

- Designed in: triage/Main.dc.html, T-Task, T-Accept, T-StepIn, T-OwnWords, T-Undo, T-Done, T-Peek-Line
- What it shows: the rail of views on the left, the one entry open in the middle, Next on the right; a peek folds the rail and Next and moves the card left.
- Changes from today: new. It replaces the bar's counts, which jumped between items on Lines; Later sends an item to the bottom of the list.
- Loading: "Loading what waits on you" in the middle, the rail's counts at zero.
- Error: the tracker not answering on first load: the notice with Try now, as Lines has it.
- Empty: ForYouEmpty.

### components/foryou/ForYouRail.tsx

- Designed in: triage/Main.dc.html
- What it shows: "WAITING ON YOU", then All, Urgent, To answer, To do, To accept, To step in, each with its count; Urgent's in the warning tone above zero.
- Changes from today: new.
- Loading: counts at zero until the list loads.
- Error: cannot fail on its own: the page says why.
- Empty: every view is listed, with 0.

### components/foryou/ForYouCard.tsx

- Designed in: triage/Main.dc.html, T-Task
- What it shows: "To answer · 1 of 3" and its strip, then the card: the line it is on, which peeks in place, and where the line stands ("step 2 of 4, Print the base"); then the entry.
- Changes from today: new.
- Loading: drawn only once the list has loaded.
- Error: cannot fail on its own.
- Empty: never drawn without an entry.

### components/foryou/ForYouEntry.tsx

- Designed in: triage/Main.dc.html, T-Task, T-Accept, T-StepIn
- What it shows: by kind, the question with its numbered answers, the task with what to send back, the proposed line with its moves, a case for done or a new done when, or Step in.
- Changes from today: new; the items are today's, drawn on the card.
- Loading: a task's draft and a question's form load as they do on Lines.
- Error: a choice that fails is said in the Undo bar, as everywhere.
- Empty: never drawn without an entry.

### components/foryou/ProposalItem.tsx

- Designed in: triage/T-Accept.dc.html
- What it shows: "[triangle] Something broken · by garden-sensor · L-5 · PANEL · 6 days ago", the title, Done when and Why now, then "WHERE IT GOES": the recommended move first with its reason, then Start it now, Up next, Fold into a line…, Table it…, Not a line, numbered.
- Changes from today: new on For you; on Lines a proposal stays a row with its one button and Other.
- Loading: never loads on its own.
- Error: cannot fail on its own: a move that fails is said in the Undo bar.
- Empty: with no line to fold into, Fold is left out.

### components/foryou/ForYouNext.tsx

- Designed in: triage/Main.dc.html, T-Task
- What it shows: "NEXT", the next two entries as tiles (where, title, what is recommended), then "Then 4 to do, 2 to accept and 2 to step in."
- Changes from today: new.
- Loading: drawn only once the list has loaded.
- Error: cannot fail on its own.
- Empty: nothing after the open one and nothing in other views: not drawn.

### components/foryou/ForYouEmpty.tsx

- Designed in: triage/T-Done.dc.html
- What it shows: with nothing at all, a check, "Nothing waits on you", who is at work and where the next ask will likely come from, Go to Lines and See what happened in the Log; with one view empty, "Nothing to answer" and the next view that holds something ("To do, 1 waiting").
- Changes from today: new.
- Loading: never drawn while loading.
- Error: cannot fail on its own.
- Empty: this is the empty state.
