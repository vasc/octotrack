# Line

One line of work, opened in the side panel. Designed on `Line.dc.html` (an up-next line, not scoped, opened) and
`Line-States.dc.html` (states A to J: working with an owner, proposed, tabled, working with no owner, yours, done,
loading, one part failed, not found, phone), in the canvas at https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU. One
column, read top to bottom in order of importance: the head, what needs you, the summary, the plan, what happened, the
owner, then Tell. A section with nothing in it says why in one line instead of showing a bare heading.

### components/entity/LinePanelItem.tsx

- Designed in: Line.dc.html; Line-States.dc.html, states A–J
- What it shows: LinePanelHead, For you, Summary, Plan, What happened (or "New since the summary"), Owner, then Tell (or "Add a task or a note" when yours), in one column.
- Changes from today:
  - One column on every screen: the plan is no longer beside What's new and Owner.
  - Owner shows for every live line, saying who will own it when there is none yet (today it shows only while working).
  - Done or dropped (F): read only, with "Plan, summary and history stay below, as they were when it closed."
  - Working with no owner (D): the step-in sentence and its actions sit at the head, not in the owner's note.
  - Phone (J): the panel is the whole screen, "‹ Lines" replaces Close, actions full width.
- Loading: the head comes from Lines at once; only the slow parts wait and say what: "Loading the plan…", and the same for what happened (G). While Lines itself is still loading, Owner and For you follow the Primitives pattern ("Loading…" in that section) instead of showing "no owner".
- Error: one part failed (H): said in that part, "Could not load the plan. The tracker did not answer." with Try again; the rest still works. What was shown before is kept below it, marked "as of 14:20". Not found (I): "No line L-312 / It may have been folded into another line or never existed. Search the log for it to see what happened." with "Search the log for L-312" and Close. Failed moves, tells and adds are said where they were made (see LineActions, TellBox, OwnWorkBox).
- Empty: never empty: a line always has a head; each empty section says why in one line.

### components/entity/LinePanelHead.tsx

- Designed in: Line.dc.html; Line-States.dc.html, states A–F, J
- What it shows: crumbs (state and place in order, ref, repo), Close with its key, the title, "Done when …", then the line's moves.
- Changes from today:
  - Crumbs read "Up next, 3rd of 10 · L-3 · LimbicAI/hydra" (today "Up next · Line 3 of 10 · L-3 · hydra"); owned lines add "yours" (E); the repo is its GitHub name.
  - Close shows its key: "Close esc"; on a phone it is "‹ Lines" (J).
  - Opened from another panel (Panels F): "‹ Back to L-57" beside Close; Esc and Back go one step back, Close shuts the panel (today Close goes back).
  - Proposed (B): "Proposed by ttube, 2d ago · L-59 · TTUBE", then "Recommended: start it." with its reason, above the moves.
  - Tabled (C): "Waits for", "Look again" and "Held: 1 question, 2 tasks, released when it starts" at the top.
  - Done (F): "Done · closed by you, Tue 14:02 · L-19".
  - "Done when" is a labelled pair, not a sentence.
- Loading: never loads on its own: the head comes from Lines at once (G).
- Error: cannot fail on its own: it only draws what it is given.
- Empty: no done when: the pair is left out.

### components/entity/LineActions.tsx

- Designed in: Line.dc.html; Line-States.dc.html, states A, B, C, D, J
- What it shows: the moves the line's state allows, the main one first, rarer ones under "More ▾".
- Changes from today:
  - Working (A): Done, Move to up next, Table, More (Done is first; today it is last).
  - Proposed (B): Start, Up next, Table, "Fold into…", Not a line.
  - Up next: Start, Table, More, with "Up next lines are scoped by idle agents, not built" beside them.
  - Working with no owner (D): Try now, I'll own it, Table it.
  - Phone (J): the More button is "⋯".
- Loading: never loads on its own: given the line by LinePanelHead. A move that is waiting shows its busy word in the button (Primitives Button: "Starting…").
- Error: a move whose request fails follows the Primitives pattern and Lines state H: said under the moves ("Not moved. The tracker did not answer.") with Try again. A move refused when it takes effect is said in the Undo bar: "Did not happen: moving L-24 to up next. It changed meanwhile; look again." with Dismiss.
- Empty: done or dropped lines have no moves; the head says how it closed (F).

### components/entity/SummaryBox.tsx

- Designed in: Line.dc.html; Line-States.dc.html, state A
- What it shows: "Summary", who wrote it and when ("by kore-ecs · 2h ago"), the headline in bold, then the summary.
- Changes from today: the aside names the writer and a relative age instead of "at HH:MM" (which today is UTC); the empty state is a sentence.
- Loading: never loads on its own: it comes with the line's head.
- Error: cannot fail on its own.
- Empty: "No summary yet. Its owner writes one once the line starts."

### components/entity/PanelForYou.tsx

- Designed in: Line-States.dc.html, state A
- What it shows: "For you" with its count, then each item as a row ("Question · D-91 / Cut production UK over this week or wait for the IAM clean-up? ›"); a pressed row opens in place.
- Changes from today: none drawn beyond the closed row; the opened item follows Question and Items.
- Loading: while Lines loads, follows the Primitives pattern: "Loading…" under "For you", instead of hiding the section.
- Error: if Lines fails to load, follows the Primitives pattern: "Could not load what needs you. The tracker did not answer." with Try again. Each item's own failures are its own (Question-States E).
- Empty: nothing for you: the section is left out.

### components/entity/PlanList.tsx

- Designed in: Line.dc.html; Line-States.dc.html, states A, G, H, J
- What it shows: "Plan" with "step 2 of 3", then each step with ✓ done, → now, ○ next, and under it its issues with their state and pull requests ("#418 open · ✗ checks failing").
- Changes from today:
  - Not scoped: the aside reads "not scoped yet · 4 issues already on it", and the unplaced work sits under "Not on a step yet · these join a step when the plan is set".
  - Pull requests are listed with their check: "#405 merged · ✓".
  - Phone (J): an issue reads "Build kore's ECS image in the pull request / KECS-1 · to do"; several merged PRs fold to "4 pull requests merged ✓".
- Loading: "Loading the plan…" in place of the list, under its heading (G).
- Error: "Could not load the plan. The tracker did not answer." with Try again (H); the plan shown before stays below, marked "as of 14:20".
- Empty: with no steps and no issues, follows the Primitives pattern: "No plan yet" in one line saying who writes it (the design's empty sections say why, as Summary does).

### components/entity/SinceSummary.tsx

- Designed in: Line.dc.html; Line-States.dc.html, state A
- What it shows: "New since the summary" with its count (or "What happened" when there is no summary), "This line in the log →", the unseen events with their time, then "5 you have seen".
- Changes from today: the heading "So far" becomes "What happened"; each event has its time in the lead ("14:20"); the seen ones are a pressable "Show the 7 you have seen".
- Loading: follows Line-States G: "Loading what happened…".
- Error: follows Line-States H: "Could not load what happened. The tracker did not answer." with Try again; earlier events kept, marked "as of 14:20".
- Empty: "Nothing you have not seen. Show the 7 you have seen"; with no events at all, follows the Primitives pattern: one line saying nothing has happened yet.

### components/entity/OwnerBox.tsx

- Designed in: Line.dc.html; Line-States.dc.html, states A, D, E
- What it shows: "Owner", the owner with its state and whether it waits on you ("kore-ecs · asleep · waits on you"), then "Stop kore-ecs" and "I'll own it".
- Changes from today: shown on up-next lines too, saying "None until it starts. An idle agent in LimbicAI/hydra may scope it meanwhile."; with no owner on a working line the step-in moves to the head (D); when yours, "Hand to an agent" sits with the add box (E).
- Loading: while Lines loads, follows the Primitives pattern: "Loading…" under "Owner", never "no owner".
- Error: Stop and I'll own it wait with Undo; a request that fails follows the Primitives pattern under the buttons, with Try again. Handing to an agent with no repo to pick follows the Primitives disabled rule: Hand over off, and why beside it.
- Empty: no owner yet: "None until it starts." with who may scope it.

### components/entity/OwnWorkBox.tsx

- Designed in: Line-States.dc.html, state E
- What it shows: "Add a task or a note", one box, then "Add as a task", "Add as a note" and "Hand to an agent".
- Changes from today: "Hand to an agent" sits here, beside the add buttons; while sending, the button shows its busy word (Primitives Button).
- Loading: the draft loads from the tracker; follows the Primitives pattern: the box stays usable and is not cleared when the draft arrives.
- Error: draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back." under the box. A failed add follows the Primitives pattern: said under the buttons, words kept, with Try again.
- Empty: both add buttons are off while the box is empty.

### components/entity/TellBox.tsx

- Designed in: Line-States.dc.html, state A; Panels.dc.html, state A
- What it shows: "Tell kore-ecs" (or "Tell whoever takes L-57"), the box with placeholder "Leave it empty to nudge", then Nudge (or Tell once there are words).
- Changes from today: the heading is a visible label and the placeholder explains the empty nudge; today the box has no placeholder.
- Loading: the draft loads from the tracker; follows the Primitives pattern: the box stays usable.
- Error: draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back." A failed send follows the Primitives pattern: said under the button, words kept, with Try again.
- Empty: the button reads Nudge.
