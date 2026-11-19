# Sheets

A sheet is a task of its own over the whole page. Designed on `Sheets.dc.html` (states A to G: new line, table a line,
start, fold into another line, record answers, keys, phone), in the canvas at
https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU. Every sheet has a title that says what it does, the fields, then the
actions at the foot with the main one first. Cancel and Esc always close it. A sheet takes the focus and keeps it until
closed; the page behind does not react to keys. On a phone it rises from the bottom, with 44 px targets.

### components/lines/NewLineSheet.tsx

- Designed in: Sheets.dc.html, states A, B
- What it shows: "New line" and Cancel; "What it is" (placeholder "Back up the Home Assistant host nightly"), "Done when", "Repos" as checkable chips by key (four, then "+ 11 more") and "None: it's mine"; "Saved as you type, so closing loses nothing."; then "Add to up next", "Start", "Table". Table goes to the Table sheet's fields as a second step.
- Changes from today: the words are kept as a draft, so closing loses nothing; repos are chips that wrap instead of a list of rows, and long lists fold after four ("+ 11 more"); Table asks for its reason as a second step, with no ellipsis, as no button that asks first has one; while the actions are off, the words under them say what is missing; focus stays in the sheet.
- Loading: the repo list loads from the tracker; follows the Primitives pattern: "Loading…" in the Repos list, with "None: it's mine" usable.
- Error: adding is a choice that waits with Undo, so a refusal is said in the Undo bar, and the words stay in the draft until the line is added. A repo list that cannot load follows the Primitives pattern in the Repos list, with Try again. A draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back."
- Empty: until a title, a done when and a repo (or None) are given, the three actions are off and the words under them say which is missing. No repos: only "None: it's mine".

### components/lines/TableForm.tsx

- Designed in: Sheets.dc.html, states B, G
- What it shows: "Table Buzz speed follow-ups" and Cancel; "Why it waits · optional"; "Look again on · optional"; "Tabling holds 1 question and 2 tasks until it starts again; buzz winds down."; "Table it".
- Changes from today: the date says it is optional; the consequence is one sentence (today "Holds 1 question and 2 tasks · panel-widgets winds down").
- Loading: never loads on its own: given what the line holds by its opener; tabling waits with Undo from the Undo bar, so there is no busy word in the sheet.
- Error: tabling it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss; the sheet closes as the choice is made.
- Empty: with no reason typed it tables all the same, and the line says "No reason given"; with nothing held and no owner, the consequence sentence is left out.

### components/lines/PromoteSheet.tsx

- Designed in: Plan-Tree.dc.html, C (title focused, two choices)
- What it shows: "Make 3a its own line" and Cancel; "Its steps and 2 issues move to the new line. Here it stays as a row that opens it, still holding up step 4 until that line is done."; "Title" (the branch's), "Done when"; then "Make it a line, up next" and "Start it now".
- Loading: never loads on its own: the branch and its issue count come from the plan already loaded.
- Error: making it is a choice that waits with Undo; a refusal when it takes effect is said in the Undo bar ("Did not happen: …"); the sheet closes as the choice is made.
- Empty: both actions are off until a title and a done when are given.

### components/lines/BranchEditSheet.tsx

- Designed in: Plan-Tree.dc.html, B
- What it shows: "Change branch 2a" and Cancel; "Title"; "Its steps, one per line", filled with its steps; "A step whose words stay keeps its status and its issues."; "Save".
- Loading: never loads on its own.
- Error: a refusal is said under the branch's More ("Not changed: …") after the sheet closes.
- Empty: Save is off until there is a title and at least one step; blank lines are left out.

### components/home/StartSheet.tsx

- Designed in: Sheets.dc.html, state C
- What it shows: StartSheetView with what waited for the line, loaded from the tracker.
- Changes from today: Start stays on while loading and after a failure (today it is off in both).
- Loading: "Loading what waited for it…", Start on.
- Error: "Could not load what waited for it. Start anyway, or try again." with both buttons (today the raw message, Start off, no retry). An answer waits with Undo like every choice, and one the tracker never took is said in the Undo bar, which stays usable above the sheet.
- Empty: "Nothing waited for it" and Start.

### components/home/StartSheetView.tsx

- Designed in: Sheets.dc.html, state C
- What it shows: "Start Labyrinth level editor" and Cancel; "1 question waited for it. Answer it now, or start and it reaches you on the line."; each held question with its options; "Tasks, once it starts" with each task; then Start.
- Changes from today: a sentence says how many waited and that answering is optional; the done-when change follows Items F.
- Loading: as StartSheet.
- Error: as StartSheet.
- Empty: "Nothing waited for it" and Start, also when every held question has left the open list (today the body is then blank).

### components/home/HeldQuestion.tsx

- Designed in: Sheets.dc.html, state C
- What it shows: "Question · D-42 / Tiles or free placement for walls?" then its options numbered, "Recommended" beside the recommended one.
- Changes from today: "recommended" becomes "Recommended"; the why moves inside the option as in QuestionOptions.
- Loading: never loads on its own: given its question by StartSheetView.
- Error: an answer that fails is said under it, as StartSheet.
- Empty: a question with no options follows Question-States H: the own-words box open.

### components/home/FoldPicker.tsx

- Designed in: Sheets.dc.html, state D
- What it shows: a sheet "Fold Two streams per fetch into…" with Cancel, a "Find a line" box, then the lines numbered.
- Changes from today: a sheet instead of an inline list; a box to find a line. The drawing marks "its agent's pick", but a proposal records only that it should fold, not into which line, so no pick can be marked.
- Loading: never loads on its own: given the lines it can fold into.
- Error: a fold waits with Undo; a request that fails follows the Primitives pattern: said in the sheet, with Try again.
- Empty: with no line to fold into, Fold into is not offered at all. A find that matches nothing follows Log D: "Nothing matches".

### components/home/RecordAnswers.tsx

- Designed in: Sheets.dc.html, state E
- What it shows: the Record answers sheet, opened with `r` on Lines.
- Changes from today: none of its own; see BatchPanelView.
- Loading: never loads on its own: BatchPanel does.
- Error: cannot fail on its own.
- Empty: never empty: it always shows the sheet.

### components/decisions/BatchPanel.tsx

- Designed in: Sheets.dc.html, state E
- What it shows: BatchPanelView with the text kept as a draft across devices, parsed as it is typed.
- Changes from today: a parse error names the line, what is wrong and the options there are; after recording, the results stay and only failed lines are left in the box.
- Loading: the draft loads from the tracker; follows the Primitives pattern: the box stays usable. While sending, "Recording…".
- Error: as BatchPanelView. A request that fails follows the Primitives pattern: said above the foot, words kept, with Try again; it clears once the text changes (today it stays). A draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back." (today not shown).
- Empty: as BatchPanelView.

### components/decisions/BatchPanelView.tsx

- Designed in: Sheets.dc.html, state E
- What it shows: "Record answers" and Cancel; the box labelled "One per row: the question, the option, a note if you like"; the parse error; the results ("D-65 [check] recorded", "D-20 [cross] already answered on 7 Nov"); then "Record 2" with "Fix row 3 first" beside it.
- Changes from today: the label explains the format (today "Answers"); a row that cannot be read says "Row 3 is not understood: …"; an option that does not exist is said in its result, "D-75 has no option “fast start”. Its options are a, b, c, d."; results carry [check] or [cross]; a disabled Record says why beside it; while sending it reads "Recording…".
- Loading: "Recording…" on the button while sending.
- Error: the parse error under the box; each row's failure in the results with [cross] and the reason.
- Empty: the box, a disabled "Record", and the format shown as its placeholder.

### components/home/KeyHelp.tsx

- Designed in: Sheets.dc.html, state F
- What it shows: "Keys" and Close; two groups. Moving: `j k` next, previous item; `J K` next, previous line; `o [Return]` open the line; `g u` urgent question; `/` search the log; `esc` close, go back. Acting: `1–9` pick a numbered choice; `w` answer in your words; `l` later; `u` undo; `t` tell the owner; `[Option][up][down]` move the line; `g p` I'm at; `r` record answers.
- Changes from today: grouped into Moving and Acting; Cancel becomes Close; wording ("answer in your words", "tell the owner", "search the log", "close, go back"); opened from the Log or Agents, keys that only act on Lines say "on Lines"; not offered on touch screens.
- Loading: never loads on its own: the list is fixed.
- Error: cannot fail on its own.
- Empty: never empty: the list is fixed.
