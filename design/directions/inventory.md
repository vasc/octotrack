# Octotrack web UI: inventory of every user-facing surface

Taken before the dashboard was rebuilt from primitives, as the list of what each screen held. The structure it
describes (classes, cards, the prose in section 7) is gone; the surfaces themselves remain, and are the list each
screen's design goes through.

Source root: /Users/vasco/projs/octotrack-build/packages/web/src. I read every component under `components/` plus the hooks and libs that produce UI strings. That includes the Undo-bar summaries in `hooks/useHome.ts`, `hooks/useLineChoices.ts`, `hooks/useDecisionForm.ts`, `lib/said.ts` and `lib/tasks.ts`, and the labels in `lib/lines.ts`, `hooks/useTopBar.ts` and `lib/focus.ts`.

**Phone mode:** `useNarrow()` is `(max-width: 720px)`. The same breakpoint is used in `styles.css` at lines 1126 and 2499. Touch devices (`pointer: coarse`) also differ, and are flagged below.

**Notation:**

- **[P]** marks prose where the UI explains itself. All of them are gathered again in section 7.
- Ellipses (…) in quoted strings stand for dynamic values.

---

## 1. Global shell (every route except /design)

### 1.1 AppShell — `components/layout/AppShell.tsx`

- **Layout:** TopBar, then `<main>`, then the entity panel as a fixed right-side `<aside class="panel">` whenever `?ref=` is set.
  - The panel is `width: min(--panel-width, 100%)`, so on a phone it covers the full width.
- **Contents of `<main>`, in order:**
  1. Live note (when live updates are offline): **[P]** "Not live: reconnecting. What is shown may be out of date." (`role=status`, class `live-note`)
  2. KeyHelp dialog, when `?` is pressed.
  3. ErrorState if setting "I'm at" failed.
  4. The page itself, or an ErrorState if the bootstrap fails. Nothing is drawn while the bootstrap is pending.
  5. PendingChoices (the Undo bar).
- **Keys:**
  - `?` opens the key list (or closes it if open).
  - `g p` focuses the "I'm at" button.
  - `/` goes to `/log?find=1` (from any page other than the Log).
  - `Esc` closes the top-most thing: first the key list, then the panel (back to the previous ref), then "I'm at".
- **Unknown route** (`App.tsx`): EmptyState "Nothing lives at {path}."

### 1.2 TopBar — `components/layout/TopBar.tsx`

Elements, in order:

1. **Brand link "Octotrack"**
   - Goes to `/`. It is `aria-current` on `/` and `/lines`.
   - Hidden on phone.
2. **Nav links "Log" and "Agents"** (NavItem)
   - NavItem can show a count badge, but none is passed.
   - The whole nav is hidden on phone.
3. **Waiting counts** (`role=status`, aria-label "Waiting on you")
   - Urgent is drawn apart, in front. The rest form one quiet group.
   - Each count reads `<b>{n}</b> {label}`. Labels, in order: "urgent", "to answer", "to do", "to accept", "to step in".
   - Zeros are left out. With no counts the region is not rendered.
   - Each count links to `/?focus={first item}`, i.e. the first matching item in focus order.
   - On phone the counts sit in their own column and wrap.
4. **AtMenu ("I'm at")**
   - Only shown if the developer has defined places.
   - Button: pin icon + "{place}" or "All places" + chevron. aria-label "I'm at: {shown}".
   - On phone it spans the full width on its own row.
5. **New line button**
   - Plus icon + "New line". On phone the words are hidden and only the plus shows.
   - aria-label/title "New line". Navigates to `/?new=1`.
6. **AppearanceMenu**: palette icon, title "Appearance".
7. **PagesMenu**: "more" icon, title "Pages". Only shown on phone.
8. **Keys button**
   - Keyboard icon. aria-label "Keyboard shortcuts", title "Keyboard shortcuts (?)". Opens KeyHelp.
   - Hidden on phone.

### 1.3 Menus in the bar

- **AtMenu** (`role=menu` "I'm at")
  - Items: "All places", then each place, as `menuitemradio` with the current one checked and autofocused.
  - Picking one sets the place (op `at`).
  - Arrow keys move through items. Esc closes and returns focus. Blur closes.
- **AppearanceMenu**
  - Section label "Theme": "Paper", "Solarized", "Gruvbox", "Catppuccin", "Rosé Pine", "Nord", "Everforest", "High contrast". Each item has a swatch.
  - Section label "Mode": "As the system", "Light", "Dark".
  - The current choice in each is checked.
  - Button aria-label: "Appearance: {theme}, {mode lowercased}".
- **PagesMenu** (phone only)
  - Items: "Lines", "Log", "Agents". The current page is checked.
  - aria-label: "Pages: {name}".

### 1.4 PendingChoices / UndoBar — `layout/PendingChoices.tsx`, `layout/UndoBar.tsx`

Present on every page (`role=status`, `aria-live=polite`). Lists pending choices newest first.

- **Pending choice row**
  - Text: "{summary} in {N} second(s)". The countdown is aria-hidden.
  - If the choice stops a line's owner, it appends one of:
    - **[P]** ". {Line} waits on you, so no new session starts until you answer."
    - **[P]** ". {Line} then looks for another owner."
  - Newest row only: muted "u to undo".
  - "Pause the line instead" button, when the choice is tied to a line. It undoes the choice and queues the line instead, with summary "Pausing {title}: up next".
  - "Undo" button.
- **Failed choice row**
  - Text: "{summary} did not happen: {error or 'no reason was given'}" (`role=alert`).
  - "Dismiss" button.
- **Below the bar:** ErrorState if `choices.failure` is set.
- **Key:** `u` undoes the newest pending choice.

**Summary strings that appear in the Undo bar**, grouped by where the choice comes from:

- **Lines:**
  - "Starting {title}"
  - "Moving {title} to up next"
  - "Closing {title} as done"
  - "Dropping {title}"
  - "Turning down {title}: not a line"
  - "Taking {title} as yours"
  - "Tabling {title}"
  - "Adding {title} to up next"
  - "Folding {a} into {b}"
  - "Telling {title}'s owner it is not done yet"
  - "Accepting the new done when for {title}" / "Keeping {title}'s done when"
  - "Placing N proposal(s) where their agents recommend"
- **Step in / runner:**
  - "Trying {title} again"
  - "Starting one anyway for {title}"
  - "Setting {repo}'s checkout to {path}, then trying {title} again"
- **Questions:**
  - "Sending \"{label}\" to {line title or ref}"
  - "Sending your words to {…}"
  - "Putting D-x off until later" / "Bringing back D-x"
  - "Returning D-x to its line, not urgent"
  - "Withdrawing D-x"
  - "Reopening D-x to change its answer"
- **Tasks:**
  - "Marking \"{title}\" done"
  - "Sending \"{outcome}\" to {line}" / "… for {ref}"
  - "Closing {ref} as not done: {why}"
- **Line panel (Tell, owned lines):**
  - "Telling {to}: {words}" / "Nudging {to}"
  - "Handing {title} to the agents"
  - "Adding a task to {title}: {t}"
  - "Adding a note to {title}"
- **Notes and drift:**
  - "Posting a note on {ref}: {words}"
  - "Marking {ref} updated: {note}" / "Marking {ref} as needing no update: {note}"
- **Agents:**
  - "Stopping {name}"
  - "Lifting {name}'s stop"
  - "Releasing {name} from its line"
- **Log:** "Marking everything seen"

### 1.5 KeyHelp (keyboard dialog) — `components/home/KeyHelp.tsx`

- Modal `<dialog>` (class `start-sheet`, aria-label "Keys"). Opened with `?` or the bar's keys button.
- A `<dl>` of key / meaning pairs:

| Keys      | Meaning                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| "j k"     | "next and previous thing for you, across lines"                                                                                                      |
| "J K"     | "next and previous line, Working on then Up next"                                                                                                    |
| "1–9"     | "the focused item's numbered choice: an option, a step-in action, a proposal's choice, Done or Can't do it, Accept or Keep current, Done or Not yet" |
| "w"       | "answer in my own words"                                                                                                                             |
| "l"       | "later"                                                                                                                                              |
| "u"       | "undo the last choice, while it waits"                                                                                                               |
| "o ↵"     | "open the line of whatever is focused"                                                                                                               |
| "t"       | "tell the focused line's owner"                                                                                                                      |
| "alt ↑ ↓" | "move the focused line in the order"                                                                                                                 |
| "g p"     | "choose where I'm at"                                                                                                                                |
| "esc"     | "leave I'm at, close a line"                                                                                                                         |
| "g u"     | "go to an urgent question"                                                                                                                           |
| "/"       | "search"                                                                                                                                             |
| "r"       | "record answers given elsewhere, in a batch: D-3 a Went with postgres"                                                                               |

- Button "Close" (autofocused). Esc or `?` also close it.
- While open, no other keys act.
- Separately, CSS draws hints that are not in this dialog:
  - On wide screens (≥1360px, fine pointer), a "k ↑ j ↓" hint sits beside the focused item.
  - With a fine pointer, numbered buttons in the focused item get a "N · " prefix from `data-choice`.

---

## 2. Lines home ("/" and "/lines") — `components/home/HomePage.tsx`

The page has a visually hidden h1 "Lines". Order of what renders:

1. `NewLineCard`, when `?new=1`.
2. `RecordAnswers`, when `r` is pressed.
3. ErrorState for `h.failure`, which covers reorder, "I'm at" and choice failures.
4. LoadingState "Loading..." while home loads, or an ErrorState if it fails.
5. Then exactly one of these, or neither:
   - `FirstRun`, if nothing is working and nothing is up next.
   - `NothingNeedsYou`, if every count is 0.
6. `AtSection`, if "I'm at" is set.
7. `QuestionList` titled "Urgent".
8. `WorkingSection`, with `SpreadThin` in its header.
9. `AtUpNext`, if "I'm at" is set.
10. `WaitingSections`: Up next, Proposed, Tabled, Done lately.
11. `QuestionList` titled "On no line".

**Keys on home** (`hooks/useHomeKeys.ts`, `useHomeFocusOnPage`):

- `j`/`k` move between items; `J`/`K` move between lines.
- `1–9` press the focused item's numbered button. Questions use their own option keys.
- `o`/Enter open the line in the panel; `t` opens the panel with Tell focused (`?act=tell`).
- Alt+↑/↓ move the line; `g u` goes to the urgent question; `r` opens Record answers.
- Home stands its keys down while a panel or a Start sheet is open.
- `?focus=` (from a count link or a notification) focuses that item.

**Phone differences:**

- Working lines after the 2nd fold to one row (`PHONE_OPEN_LINES = 2`).
- Up next and Proposed become folded tiles, and the tiles show no names.
- "On no line" folds to a tile.

**At a place:**

- Lines fold to "at" mode.
- Up next and Proposed fold into tiles, but tiles keep their names unless on a phone.

### 2.1 FirstRun — `home/FirstRun.tsx`

Three variants:

- **No proposals at all:** EmptyState **[P]** "No lines yet. Add one above, or point an agent at the guide and it will propose lines from its repo." followed by a `<pre>` block containing `octo guide`.
- **Proposals, none placeable:** **[P]** "Nothing is placed yet. The {N proposed lines | proposed line} came from before lines, with no recommendation: place {each|it} yourself, or wait for {their agents|its agent} to propose a real line."
- **Some placeable:** **[P]** "{X} of the {N} proposed line(s) {carries|carry} a recommended placement. Accept {it|them} at once, then change any you disagree with."
  - Primary button "Accept recommended placements".
  - Muted "with Undo" beside it.
  - The whole block is a `role=note` box, aria-label "First run".

### 2.2 NothingNeedsYou — `home/NothingNeedsYou.tsx`

- Heading: "Nothing needs you."
- Muted text, built from two parts:
  - Who is working: "No agent is working right now." / "{One…Ten} agent(s) {is|are} working."
  - Where the next ask is: " The likely next ask is on {line}[, at its step: {step}]."

### 2.3 AtSection ("I'm at a place") — `home/AtSection.tsx`

- Heading "At {place}."
- **[P]** muted "Everything else is folded. Ends by itself in {N} hour(s)."
- Button "Leave", which clears "I'm at". Esc also leaves.

### 2.4 QuestionList — `home/QuestionList.tsx`

Two instances on home:

- **"Urgent":** never folds.
- **"On no line":** note **[P]** "from before lines; their agents should put each on its line". On phone it folds to a tile showing just "On no line · N". The tile is held open (no Show/Hide) while one of its questions has focus.

Behaviour:

- Rendered as a HomeSection: title + count + note, then a sheet of rows.
- Each question shows as a ForYouRow until focused. Focused, it opens as a DecisionCardItem.
- Hidden entirely when empty.

### 2.5 HomeSection (section header) — `home/HomeSection.tsx`

- `h2` "{title} {count}", followed by a note and/or actions.
- "Working on" uses the larger `data-main` style.

### 2.6 WorkingSection — `home/WorkingSection.tsx`

- Title "Working on {n}". Note **[P]** "Your order is everyone's order". SpreadThin sits in the header too.
- Empty: muted "Nothing is being worked on."
- Otherwise an `<ol>` of WorkingLine cards. Each card contains:
  - LineStepIn
  - then either AtPlaceItems (at a place) or LineForYou.

#### SpreadThin — `home/SpreadThin.tsx`

- Only shown when more than 6 lines are being worked on.
- Shows "{n} with no owner" in the bad tone and "{n} waiting on you" in the attention tone.
- Hidden prose: **[P]** aria-label "{n} lines are being worked on: … . Tabling some gives the rest their agents back."

#### WorkingLine (line card) — `home/WorkingLine.tsx`

Head row:

- Gutter with the LineHandle.
- Number (its position in the order).
- Title (`h3`), a button that opens `?ref=L-x`.
- " · yours" if the developer owns it.
- LineMeta facts.
- Headline in markdown, plus a link "{n} change(s) since the summary" that opens the panel.

Below the head:

- AnswerStatus rows, one per recent answer.
- Children: Step in and the items for you.

States:

- Focused (`data-selected`, reached with J/K).
- Drop target (while dragging).
- **Fold "phone":** keeps facts and headline but no answers, and items collapse to "{n} for you".
- **Fold "at":** title only. No "yours", facts, headline or answers.

#### LineMeta facts — `home/LineMeta.tsx` + `crewText`

Facts are dot-separated by CSS, in this order:

1. Crew:
   - "owner {name}, {state}", or one of "no owner: step in" (red) / "no owner yet" / "finding an owner".
   - "+N helper(s)"
   - "{name} is scoping it"
2. "waiting on you" or "agents on it" (only when something waits for the developer)
3. "{n} re-confirming"
4. "{n} held for an agent" (owned lines)
5. "step {p} of {of}, {title}"

#### AnswerStatus / change answer — `home/AnswerStatus.tsx`

- Text: "{D-ref link} answered: {answer} · {status}". Status is one of:
  - "not picked up yet"
  - "picked up" / "picked up by {agent}, {time}"
  - "✓ carried out" / "✓ carried out: {note}"
  - "{agent|its agent} could not be woken; finding an owner"
- Button "Change answer" (aria "Change answer D-x") opens the decision in the panel.

#### LineHandle (reorder menu) — `home/LineHandle.tsx`

- Grip button. aria "Move {title}", title **[P]** "Drag to reorder, or click to move".
- Draggable onto another line (it lands before that line).
- Menu items: "Move to top", "Up", "Down", plus "To up next" on working lines only.
- Items are disabled at the ends of the list.
- Also present on phone, where it is the only way to reorder.

#### LineForYou / MoreForYou — `home/LineForYou.tsx`, `home/MoreForYou.tsx`

- The first item is shown; the rest collapse into the link "+{n} more for you: {described}". Clicking it expands them.
  - `described` for one item: "a question" / "a task" / "a task at {place}" / "a proposal".
  - For several: "N questions and N tasks and N proposals".
- Folded on phone: one link "{n} for you" that focuses the first item.

#### ForYouRow (collapsed item row) — `home/ForYouRow.tsx`

- A button with aria "Open {ref}" and a "›" marker. Text depends on the kind:
  - **Question:** "Question · D-x" or "Urgent · {something broken|time-boxed|costs money} · D-x", then **title**, then "Recommended {label}: {why}".
  - **Task:** "Task · T-x[ · at {place}]", then **title**, then "Frees {ref}: {title}." or "Report: {outcome}".
  - **Done / done when:** "Proposed done · L-x" or "Proposed done when · L-x", then the text.
- Urgent questions are styled with `data-urgent`.

#### ForYouItem (opened item)

When focused it renders one of: DecisionCardItem (question), TaskItem/TaskCard (task), or LineProposalCard (done / done_when). Each is wrapped in a FocusTarget fieldset whose aria label is one of:

- "Question D-x, title"
- "Task T-x, title"
- "Proposed as done: {line}"
- "A new done when proposed: {line}"

#### DecisionCard (question opened) — `decisions/DecisionCardItem.tsx`, `DecisionCardView.tsx`, `QuestionStrip.tsx`, `QuestionOptions.tsx`, `OwnWords.tsx`

- **QuestionStrip**, in order:
  - Kind: "Question", or "Urgent" plus the capitalised reason ("Something broken" / "Time-boxed" / "Costs money").
  - For an urgent question with a known line: "{n} · {line title} · D-x". Otherwise just the D-x link.
  - "asked by {agent}", or "holds up {refs}" when it holds up open work (non-urgent only).
  - "later" if postponed.
  - Any server `card.reasons`.
- **Title** (`h3`) and **context** (markdown).
- **Options**
  - Up to three columns of buttons. Each shows "{n} · {label}" (the number is hidden on touch devices), a "recommended" tag on the recommended option, and the option's description.
  - One press answers.
  - Under the options: "**Why {n}:** {recommendationWhy}". If the recommended key matches no option: muted "Recommendation: {key}".
- **Actions**
  - "In my own words"
  - "Later" (or "Bring back" when already postponed)
  - "Background" (only inside the line panel; opens the decision on its own)
  - "Not urgent" (urgent questions not already marked)
- **OwnWords** (replaces the actions)
  - TextBox, aria "Your answer to D-x", placeholder "In your own words", autofocused. Cmd/Ctrl+Enter sends.
  - "Send" (reads "Sending" while waiting; disabled when empty).
  - "Cancel" (clears the draft).
- **Errors:** the resolve error, or "Not saved: {err}" (`role=alert`).
- **Keys** (when active and armed): 1–n answer, `w` opens own words, `l` Later. Disarmed while its answer waits with Undo.
- **States:** selected, urgent, postponed, writing own words, sending.

#### TaskCard / TaskItem / OutcomeFields / Can't do it — `home/TaskCard.tsx`, `home/TaskItem.tsx`, `home/OutcomeFields.tsx`

- **Kind line:** "Task for you · T-x[ · at {place}][ · holds up {step title}][ · filed by {agent}]"
- **Title**, then "Frees {ref}: {title}.", then the body (markdown).
- **Form** (aria "Report the outcome" or "Say why it cannot be done"):
  - Label "What to send back" (attention tone), then the agent's outcome prompt (markdown).
  - With no named fields: one TextBox, aria "What T-x found", placeholder = the outcome prompt or "What you found".
  - With named fields (OutcomeFields): a one-line LineBox per field name, then "Note, if anything surprised you" with a TextBox.
  - Buttons: "Done" (choice 1, attention tone, disabled until ready or while sending) and "Can't do it" (choice 2).
  - Footer: **[P]** "{X of N filled, saved | Saved} as you type, so you can finish on another day or device. Done sends {them all|it}; Can't do it asks why and closes the task as not done."
- **Can't do it mode:**
  - Label "Why it cannot be done".
  - TextBox, aria "Why T-x cannot be done", placeholder "Why not".
  - "Close it" (primary, disabled when empty) and "Cancel".
- **Own task** (outcome is ""): there is no send-back field and no footer; only Done / Can't do it.
- **Under the card:** NotKept **[P]** "Not saved: {error}. What you typed is still here; it is kept as soon as saving works again."

#### LineProposalCard (done / done when) — `home/LineProposalCard.tsx`

- Label: "Proposed as done[ · {agent}]" or "Done when changed[ · {agent}]".
- **Done variant:** claim 'Done when "{doneWhen}": met.' followed by the agent's case (markdown). Buttons "Done" (1, primary) and "Not yet" (2).
  - "Not yet" opens a form: TextBox, aria "What L-x still needs", placeholder "What is missing", then "Not yet" (submit) and "Cancel".
- **Done-when variant:** '"{old}" became "{new}". Why: {why}'. Buttons "Accept" (1) and "Keep current" (2).

#### LineStepIn / StepIn / CheckoutForm — `home/LineStepIn.tsx`, `home/StepIn.tsx`, `home/CheckoutForm.tsx`

- Shown only when the server gives a reason. `role=note`, aria "Step in on {title}".
- Text: label "Step in", then the server's reason.
- **Buttons** (numbered in drawn order):
  - "Set its checkout" (clone failed)
  - "Try now" (no_start_command / failing / left / never_took)
  - "Start one anyway" (at_cap)
  - "Table it", which opens TableForm
  - "I'll own it"
- **CheckoutForm:** input, aria "Checkout of {repo}", placeholder "/Users/you/src/repo". "Set" is disabled unless the path starts with "/". "Cancel".
- **Folded at a place:** a link "Step in: {short}". The short forms:
  - "nothing can start a session"
  - "the runner is only watching"
  - "a start keeps failing"
  - "sessions keep leaving"
  - "a session never took it"
  - "its checkout could not be made"
  - "it names no repo"
  - "every session is busy"

#### AtPlaceItems / FoldedItems — `home/AtPlaceItems.tsx`, `home/FoldedItems.tsx`

- At a place, tasks for that place open fully on their line. The focused item also opens.
- Everything else collapses to a link "{1 question · 2 tasks at Mac · 1 proposal}, folded", which focuses the first of them.

### 2.7 AtUpNext — `home/AtUpNext.tsx`

- Only when at a place and up-next lines hold tasks for that place.
- Heading **[P]** "While you're here, from lines up next".
- Per task: muted "{number} {line title}, up next · T-x · {asked 2h ago | re-confirmed …}", then the full TaskCard.

### 2.8 WaitingSections — `home/WaitingSections.tsx`

**Wide screen, not at a place:**

- **"Up next {n}"**
  - Note **[P]** "scoped by idle agents, never built, until you start them".
  - Empty: "Nothing is up next."
  - Otherwise an `<ol>` of UpNextRow. A Start sheet opens inline under its row.
- **"Proposed {n}"**: only when there are proposals. A sheet of ProposalCards.
- **Tiles row:** "Tabled" and "Done lately".

**Narrow (phone or at a place):** all four become FoldedSection tiles: "Up next", "Proposed by agents" (info tone), "Tabled", "Done lately".

#### UpNextRow — `home/UpNextRow.tsx`

- Handle, number, title link.
- Facts:
  - " · {n questions and n tasks held | nothing held}"
  - " · {n} re-confirming"
  - " · {not scoped yet | scoped: n step(s)}"
  - " · done when changed"
  - crew words
- "Done when {doneWhen}".
- Button "Start" (aria "Start {title}"), which opens the Start sheet.
- States: focused, drop target.

#### FoldedSection (tiles) — `home/FoldedSection.tsx`

- Header button: "**{title} · {n}**".
  - Wide screens add " · {up to 3 names}[ and N more][ · {note}]".
  - Tabled's note is "{n questions and n tasks} held".
- Toggle text "Show" / "Hide". When held open it shows no toggle and is disabled.
- Variants: dashed (Tabled), info tone (Proposed), held.
- Not rendered when empty.

#### QuietRow (Tabled / Done lately rows) — `home/QuietRow.tsx`

- Title button (opens the line), then the tabled reason, then "look again {on Tuesday | on 3 March | at 14:00}".
- Tabled rows add buttons "Up next" and "Start". Start opens the Start sheet.
- Done-lately rows have no buttons.

#### ProposalCard / ProposalCase / ProposalChoices / FoldPicker — `home/ProposalCard.tsx`, `ProposalCase.tsx`, `ProposalChoices.tsx`, `FoldPicker.tsx`

- **Urgent banner:** "Urgent: {something is broken | it is time-boxed | waiting costs money}". Note this wording differs from `URGENT_REASON` used elsewhere.
- **Title link**, then facts:
  - "proposed by {agent}, {just now | 2h ago}"
  - repos (mono)
  - "first step: {…}"
  - "from before ({ref})"
  - "done when {…}"
- **ProposalCase:**
  - Normal: "**Recommended: {Start | Up next | Table | Fold into another line}[, after {last up-next}].** {why}"
  - Back from tabled: **[P]** "Back to look at, as you asked: {reason}[ (look again {when})]"
- **ProposalChoices** (numbered):
  - "Start" (1) and "Up next" (2), each with " · recommended" when it is the recommendation.
  - "Table" (3) and "Fold into" (4, only if there are open lines). These get the filled primary style when recommended, but no text suffix.
  - Last: "Not a line" (quiet), or "Drop" when the line is back from tabled.
  - Recommendation is suppressed for a line back from tabled.
- **Table** opens the TableForm inline. **Fold into** opens the FoldPicker:
  - Legend "Fold {title} into".
  - One numbered button per target: "{L-ref} {title}".
  - "Cancel".
- **States:** focused, urgent, from-table.

### 2.9 StartSheet / StartSheetView — `home/StartSheet.tsx`, `home/StartSheetView.tsx`, `DoneWhenChanged.tsx`, `HeldQuestion.tsx`

- Inline `<dialog open>` under the row. Triggered by Start on up-next or tabled lines, on proposals back from tabled, or from the line panel.
- Loading: "Loading...". Error: ErrorState.
- Title: "Start {title}".
- **Intro [P]**, one of:
  - "Nothing has been waiting for this line: it starts clean."
  - "Its done when was sharpened while it waited."
  - "{One question / 2 questions and a task…} {has|have} been waiting for this line[, and its done when was sharpened]."

  followed by: "Settle {it|them} now and the line starts with {it|them}."
- **DoneWhenChanged** (label "Done when changed"): '"{old}" became "{new}". Why: …'. Buttons "Accept" and "Keep current", numbered.
- **HeldQuestion**, per held question:
  - Label "Question · D-x", title, context.
  - Option buttons "{label}[ · recommended]", numbered in one run across the sheet.
  - "**Why {n}:** …".
- **Tasks:** label **[P]** "Tasks, which reach you once it starts", then a list of "T-x title".
- **Closing note [P]:** "It joins the bottom of Working on, and the owner search runs at once: its last owner if it had one, an idle agent with the repo that is running, told in its next reply, else a new session."
- **Buttons:** "Start" (primary) and "Cancel" (quiet).
- **Keys:** digits press numbered buttons; Esc cancels. Disarmed while a panel is open or a choice is pending.

### 2.10 NewLineCard (new line form) — `components/lines/NewLineCard.tsx`

- Card label "New line".
- **"What it is"**: text input, autofocused.
- **"Done when"** with hint **[P]** "one sentence; an agent may propose a sharper one, for you to accept". Text input.
- **"Repos"** with hint **[P]** "the owner needs one of them; helpers cover the rest".
  - Repo chips, each with a "×" (aria "Remove {repo}").
  - A select "Add a repo".
  - Checkbox "None: it is mine".
- **Footer note [P]:**
  - Mine: "Yours: no agent takes it, and it counts your tasks in to do."
  - Otherwise: "An agent with one of its repos takes it once it is started, and writes its summary."
- **Buttons:** "Add to up next" (primary), "Start", "Table", "Cancel" (quiet).
  - The first three are disabled until there is a title, a done-when, and repos or "mine".
  - "Table" opens a TableForm titled with the line's title, or "the new line".

### 2.11 TableForm (tabling a line) — `components/lines/TableForm.tsx`

- Heading "Table {title}".
- **"Why"** input: placeholder "Why not now?", autofocused.
- **"Look at it again on (optional)"**: date input.
- **Consequences [P]** (muted):
  - Held work: "Its drift is held." or "Its {n questions and n tasks} {is|are} held, and so is its drift."
  - Without an owner: " Agents with it are told to wind down, then their writes are refused until the line comes back."
  - With an owner: " {owner} and any helpers are told to wind down and have 15 minutes to park: a hand-off summary, reports on answers it already took, a branch note. Then its claim ends and its writes are refused until the line comes back."
- **With a date [P]:** "{On Tuesday} it comes back under Proposed, counted in "to accept", with your reason beside it and the choices any proposal has."
- **Buttons:** "Table it" (disabled until there is a reason) and "Cancel".
- **Used in:** ProposalCard, StepIn, NewLineCard, LineActions.

### 2.12 RecordAnswers + BatchPanel — `home/RecordAnswers.tsx`, `decisions/BatchPanel.tsx`, `BatchPanelView.tsx`

- Opened with `r` on home, as an inline section (aria "Record answers").
- Label "Log decisions made elsewhere".
- Textarea, autofocused. Placeholder:
  - "D-3 redis Agreed on the call"
  - "D-4 a"
  - "D-5 - None of the options, doing this instead"
- Parse or submit error (`role=alert`).
- Results list: "{ref} recorded", or the ref plus an error.
- Footer: **[P]** muted "One per line: ref, option key, then an optional note."
- Buttons: "Record {n}" (disabled when nothing parsed, on error, or while submitting) and "Close". Esc closes.
- The text is a server-side draft. Lines that failed are kept.

---

## 3. Log ("/log") — `components/feed/*`

### 3.1 FeedPage

- **Title:** "Log".
- **Subtitle [P]:**
  - Searching: "Everything that matches, newest first."
  - Otherwise: "What you have not seen, line by line, in your order. A line counts as seen once you open it, and what you did yourself is never unseen."
- **Controls:**
  - FilterBox, placeholder "Search". Autofocused when `?find=1`. `/` focuses it.
  - Button "Mark all seen".
- **SyncFailures** (`prs/SyncFailures.tsx`): one line per repo, "PR status is stale for {repo}: {error}".
- **FeedSection**, in one of these states:
  - Error with nothing loaded: ErrorState.
  - "Loading the log..."
  - "Searching older events..."
  - Not searching: UnseenLog.
  - Searching with no results: EmptyState "Nothing matches this search."
  - Searching with results: FeedList.
  - Pagination: button "Older" ("Loading" while fetching). A page error appears above it.

### 3.2 FilterBar / FilterBox suggestions — `feed/FilterBar.tsx`, `FilterBox.tsx`

- Input aria "Filter". Default placeholder "Filter: kind:decision project:OCT -actor:github since:1d"; the Log overrides it with "Search".
- `aria-invalid` and an error div `filter-error` when the query is invalid.
- **Suggestions dropdown** while focused. Each entry is a `<code>` term plus a hint (the field description, from core `QUERY_FIELDS`).
  - Static values: kind, status, priority, type, channel, checks, review, state, level, horizon, blocked, ready, since.
  - Dynamic values: project, actor, assignee, label, event.
- **Keys:** ↑/↓ move, Tab or Enter accepts, Esc blurs.

### 3.3 UnseenLog — `feed/UnseenLog.tsx`

- **Rule-break strip (log-refused):** at the top, list aria "Rule breaks". Event types: write.refused, agent.would_stop, agent.stopped, pr.after_wind_down. Each is a LogRow.
- **Sheet of LineLog groups:**
  - Working lines first, then proposed, done lately, up next and tabled.
  - Up-next and tabled lines are left out unless `?waiting=yes`.
  - Proposed, done and dropped lines appear only if something changed on them.
- **LooseSection** groups "On no line" and "Elsewhere" (mark "·").
- **Footer** (when waiting lines are hidden): **[P]** "Up next and tabled: {n} change(s) left out. Rule breaks show at the top.", plus a button "Show them" that sets `?waiting=yes`.

### 3.4 LineLog / LogGroup / LogRow — `feed/LineLog.tsx`, `LogGroup.tsx`, `LogRow.tsx`

- **Head:** number, title link, mono L-ref.
- **Head suffixes:**
  - No events: " · nothing new".
  - Only routine events: " · {2 check changes, 1 drift confirmation, 1 re-confirmation}, all routine".
  - Otherwise: the headline, plus a badge "{n} unseen".
- **Rows:** "{HH:MM or weekday/date} {summary with clickable refs}".
- **Last item:** "Also routine: {sentence}."

### 3.5 FeedList / FeedItem (search results) — `feed/FeedList.tsx`, `FeedItem.tsx`

- Day headings: "Today", "Yesterday", or a date.
- Each row:
  - Tone mark (title = the event type).
  - "{ref} " prefix if the summary doesn't contain the ref.
  - Summary.
  - Chips: project, which adds `project:` to the filter; actor, which adds `actor:` to the filter.
  - TimeAgo chip ("now", "5m", "2h", "3d").

---

## 4. Agents ("/agents") — `components/agents/*`

### 4.1 AgentsPage

- **Title:** "Agents".
- **Subtitle [P]:** "Who is out there, and where. The only action here is Stop, which becomes Lift on a stopped agent; what needs you is on Lines."
  - This is inaccurate: Release also exists.
- **PushToggle** (`home/PushToggle.tsx`, used only here):
  - Off: button "Buzz this device".
  - On: **[P]** "Buzzing this device for urgent questions and the top two lines".
  - Blocked: **[P]** "Notifications are blocked for this site in the browser's settings".
  - Turning on: "Turning on…".
  - Unsupported: hidden.
  - Errors are shown inline, e.g. "This server does not send notifications".
- **States:**
  - Loading: "Loading...". Error: ErrorState. Choice failure: ErrorState.
  - Empty: EmptyState "No agent has checked in yet." with `export OCTO_AGENT=feature-x`.
- **Roster table** (aria "Roster"). Columns: Agent, Repo, Line, Last command, Wake, Now, plus a hidden "Action" column.
  - On phone each agent becomes a card. The header, Repo and Wake are hidden, and CSS prefixes Last command with "last command ".
- **Notes block [P]** (`agents-notes`), three paragraphs:
  - "**States.** Running: a command, poll or push in the last 15 minutes. Asleep: not running, with a wake address. Quiet: neither, shown with its last command and Release. Gone: a wake failed, or a session Octotrack started exited with no wake address. Stopped: by you, or by Octotrack after three writes a line's state forbids."
  - "**Taking.** `line take L-7` makes it owner, else helper, else says why; never another line. Bare, it finds the highest working line in its repo with no owner, else a helper's place, else scoping. On its own line it gets its next issue, or is told why there is none."
  - "**Keeping.** Claims end on release, Stop, a failed wake, or the exit of a session Octotrack started; never on a timer, since a line can run for weeks. The full rules are three tables in the design doc."

### 4.2 AgentRosterRow — `agents/AgentRosterRow.tsx`

- **Agent:** the name.
- **Repo:** GitHub name, or "none".
- **Line:**
  - "no line", or
  - mono L-ref link + title + relation. The relation is ", {role}", ", started for it" or ", last owner".
- **Last command:** TimeAgo, or "never" for a session that was started but has run no command.
- **Wake:** the scheme of the wake address, or "none".
- **Now** (the agent's `note` is appended):
  - "{running|asleep}; its line waits on you"
  - "stopped by Octotrack {when}, after 3 writes a line's state forbids"
  - "stopped by you {when}[: reason]"
  - "gone" / "gone: its wake failed ({err})"
  - "quiet" / "quiet, still holding its line"
  - "idle: nothing to take or scope in its repo"
  - "{state}, on no line" / "{state}, on its line"
- **Now, for sessions Octotrack started:**
  - "starting"
  - "retried since {day}, each exits at once (exit N)"
  - "exited at once (exit N)"
  - "ran but never took its line"
  - "exited (exit N)"
- **Actions:**
  - "Release" (quiet agents holding a line; aria "Release X from L-y")
  - "Lift" (stopped agents)
  - "Stop" (everyone else except gone)
  - Each goes through the Undo bar.

---

## 5. Entity panel (`?ref=` on any route) — `components/entity/EntityPanel.tsx`

Opened by any RefLink (mono ref button), any line title, Change answer, Background, `o`/Enter/`t`, or "since the summary".

- **Loading:** "Loading...". There is no close button in this state.
- **Error:** close button "✕" (aria "Close") plus ErrorState.
- **After first load:** a failed refresh shows StaleNote **[P]** "Could not refresh: {msg}. This may be out of date."

It dispatches to one of three layouts: LinePanelItem (lines), IssuePanel (issues and tasks), or the generic layout (everything else).

### 5.1 Line panel — `entity/LinePanelItem.tsx`

Order of sections:

1. **LinePanelHead**
   - Crumbs: "Line {i} of {n} · L-x · {repo} · {repo}"
   - Button "Esc" (aria "Close"), which goes back to the previous ref.
   - h1 title.
   - "Done when {…}".
2. **Start sheet** (when starting an up-next or tabled line) or **LineActions**.
3. **SummaryBox**
4. **PanelForYou**
5. **OpenDrift**
6. **Mark-seen error [P]:** "Could not mark L-x seen: {msg}. The Log still shows its changes as not seen."
7. **Two-column grid**
   - Left: PlanList, loading "Loading the plan...".
   - Right: SinceSummary (loading "Loading what is new...") above OwnerBox.
8. **OwnWorkBox** (developer-owned live line), or **TellBox** (working line).
9. NotKept, then ErrorStates for choice and home failures.

#### LineActions — `entity/LineActions.tsx`

- **State label:** "Proposed", "Working on", "Up next", "Tabled", "Done" or "Dropped".
- **Buttons by state:**
  - Working: "Move to up next".
  - Up next, tabled or proposed: "Start".
  - Tabled or proposed: "Up next".
  - "Table" (not on tabled or ended lines).
  - Working: "Done".
  - Proposed: "Fold into" and "Not a line".
  - Not ended and not proposed: "More" (aria "More: drop this line, fold it into another"). It expands to "Drop" and "Fold into another".
- **Note [P]** (working line with an owner): "Up next, Table, Done, Drop and I'll own it give {owner} 15 minutes to wind down. Table asks why; Done and Drop also close or fold what is open."
- **Done confirm [P]:** "Done is final: {its open work closes with it | {owner} closes out its open work}." Buttons "Done" (primary) and "Cancel".
- **Table** opens TableForm with held counts and the owner. **Fold** opens FoldPicker.

#### SummaryBox — `entity/SummaryBox.tsx`

- Label "Summary".
- Status:
  - None: "none yet[; {owner} writes it]"
  - Present: "current[ · at HH:MM][ · {owner} keeps it]"
- Bold headline, plus **[P]** "(the headline: home, the log and the phone show only this)".
- The summary itself (markdown).

#### PanelForYou — `entity/PanelForYou.tsx`

- Label "For you · {n questions, n tasks, n proposals}" (attention tone).
- The first item is open. Clicking another row opens it in place.
- Questions offer "Background".

#### PlanList — `entity/PlanList.tsx`

- Label "Plan[ · step {p} of {n}]".
- Empty: **[P]** "No plan yet: the owner breaks the line into steps."
- Steps:
  - Mark "✓", "→" or "○", then the title, then " · done/now/next".
  - Work under each step: "{ref} {title} · {status}", then for each PR " · {repo}#{n} {state} {checks running | ✓ checks | ✗ checks failing}".
- "On no step" group for work not placed on a step.

#### SinceSummary — `entity/SinceSummary.tsx`

- Label: "New since the summary · {n}[+]", or "So far · n" when there is no summary.
- Unseen rows: time + summary.
- "{n} you have seen" (folded).
- **[P]** "Everything newer than the summary; any you have seen fold to one row." When there are more: **[P]** " These are only the newest; the rest are in the Log."
- Link "This line in the log", which goes to `/log?q=line:L-x`.

#### OwnerBox — `entity/OwnerBox.tsx`

Only shown on working lines. Label "Owner". Prose **[P]** depends on who owns the line:

- **Developer owns it:** "**You** own it. No agent writes to it until you hand it back."
- **No owner:** "No agent owns it yet. Octotrack is looking for one." or "No agent owns it yet, and none can be found: {stepIn reason}"
- **Agent owns it:** "**{name}** writes the summary and hears what you tell it.", followed by one of:
  - Asleep: "{All the line's open work waits on you, and it | It} left a wake address, so it keeps the line while it sleeps and is woken by what you send."
  - Running: "All the line's open work waits on you; it is running now." / "It is running now."
  - Quiet: "It has been quiet since its last command and cannot be woken; Release is on Agents."
  - Other: "It is {state}."

  then "Helpers may work under it, never writing the summary; none now." or "Helping: a, b."

Buttons:

- "Stop {owner}".
- "I'll own it" (agent-owned or unowned lines) or "Hand to an agent" (developer-owned lines).
- If the line names no repos, "Hand to an agent" first asks: legend "Its repos, so an agent can take it", repo checkboxes, "Hand over" and "Cancel".

#### OwnWorkBox — `entity/OwnWorkBox.tsx`

- Label "Add a task or a note".
- TextBox, placeholder "A task, or a note".
- "Add as a task" and "Add as a note" (disabled when empty or sending).

#### TellBox — `entity/TellBox.tsx`

Also used in IssuePanel.

- Label "Tell {owner | whoever takes L-x}".
- TextBox; autofocused when opened with `t`. Cmd+Enter sends.
- **[P]** "A message, not an answer: it closes nothing. Markdown works; the box grows as you type. It goes to the line's inbox and wakes the owner; empty, it is a nudge."
- Button "Tell", which reads "Nudge" when empty and "Sending" while waiting.

### 5.2 IssuePanel (issue or task) — `entity/IssuePanel.tsx`

- **Crumbs:** "{line title link} · step {n}[ of {m}] · T-x", with an "Esc" close button.
- **Task, open:** TaskItem (TaskCard as in §2.6).
- **Task, closed:** TaskClosed (`home/TaskClosed.tsx`):
  - "Task · T-x[ · at place]", then the title.
  - Label: "Done" / "Could not be done" / "Withdrawn by {agent | its agent}", plus " {just now / 2h ago}".
  - The result (markdown).
- **Issue:**
  - Strip: "Issue", status, "nobody holds it" or "held by X", repo, "waiting on {refs}", "holds up {refs}".
  - h1 title, then the body.
- **Task only:** TaskFrees (`entity/TaskFrees.tsx`): label "What it frees"; per item the ref + title, then **[P]** "Done goes to the line's inbox for {whoever takes R, and wakes them | whoever holds R, now X, and wakes it}."
- **Issue only:**
  - **PullRequestBox:**
    - Label "Pull request(s)".
    - States: "Loading pull requests...", an error, or "None yet."
    - Per PR: "{repo}#{n}" link, **title**, checks ("no checks" / "checks running" / "✓ checks pass" / "✗ checks failing"), "+a −d · opened {when}", state.
    - **[P]** "Checks are agents' to fix, never yours. {Holder | Whoever takes the issue} merges once they pass, and asks first if it wants your eyes."
  - **ActivityList:** label "Activity · newest first", rows of time + summary.
  - **TellBox**, addressed to "{assignee}, who holds T-x" or "{owner}, who owns L-x". Only shown if the issue is on a line.
- **Then:** OpenDrift, NotKept, ErrorState.

### 5.3 Generic panel (decision, PR, drift, update, idea, project/milestone)

Sections: EntityHeader, then EntityBody, then OpenDrift, then LinkList, then UpdatesSection, then HistoryList.

- **EntityHeader:** ref, kind badge, status badge, close "✕"; h2 title.
- **DecisionPanel** (`entity/DecisionPanel.tsx`)
  - **Open, in queue:** DecisionCardItem (active, keys live). Loading "Loading the question...".
  - **Open, not in queue:** HeldDecision (`decisions/HeldDecision.tsx`):
    - DecisionMeta: ref, kind badge, priority badge (unless medium/none), project, "asked by X", TimeAgo.
    - Attention label **[P]**, one of:
      - "Held: waits for {refs}, which would settle it."
      - "Held while {line|its line} is not being worked on; it reaches you when the line starts and the question is current."
      - "Not in your queue now."
    - Title, context.
    - Options as KeyValues "key (recommended)" → "label: description".
    - "Why: …".
  - **Open:** button "Withdraw".
  - **Closed:**
    - DecisionMeta, context.
    - KeyValues: Outcome, Note, Decided by, When, How, Source (link), Superseded by (ref).
    - Options as "key (chosen)".
    - Button "Change answer" (decided) or "Reopen".
- **PrPanel:** KeyValues: GitHub link "repo#n", Checks badge, Review badge, Mergeable, Branch "head → base", Size "+a -d", Author, Synced. Then the body.
- **Drift entity:** KeyValues Rule, Target, Caused by, Assigned, Resolved by, Note. Then the suggestion.
- **Update (status):** the body (markdown).
- **Idea:** KeyValues Project, Horizon, "Promoted to", Labels. Then the body.
- **Project / milestone / other:** KeyValues Project, Repo, Horizon, Target. Then the description.
- **KeyValues** (`entity/KeyValues.tsx`): a `<dl>` that drops empty pairs.

### 5.4 Shared panel sections

- **OpenDrift / DriftItem** (`entity/OpenDrift.tsx`, `drift/DriftItem.tsx`)
  - Label "Out of date · {n}" (attention tone).
  - Per item:
    - Row: ref, rule badge, status badge if not open, "on {target}", "for {assignee}", TimeAgo.
    - Message.
    - Suggestion box.
    - Note input, placeholder "What changed, or why nothing needs to".
    - Buttons "Updated" (edge drift only) and "Nothing to update", disabled until there is a note.
    - Error.
  - Resolved items show "{resolvedBy}: {note}".
- **LinkList** (`entity/LinkList.tsx`)
  - Section "Connections" with a count note.
  - Rows: relation, ref, title, status badge.
  - Relations: blocks / implements / affects / derived from / supersedes / promoted to / relates, and their inverses: "blocked by", "implemented by", "affected by", "source of", "superseded by", "promoted from", "relates".
- **UpdatesSection** (`entity/UpdatesSection.tsx`)
  - Section "Updates" with a count.
  - TextBox, placeholder **[P]** "Post an update. Markdown works; Cmd+Enter posts".
  - Button "Post" ("Posting" while waiting).
  - NotKept.
  - Rows: level badge, body, actor, TimeAgo.
- **HistoryList** (`entity/HistoryList.tsx`)
  - Section "History", always rendered even when empty.
  - Rows: summary, actor, TimeAgo.
- **ActivityList**: issue-only; see §5.2.
- **Section** (`ui/Section.tsx`): h2 title with a small note. It supports a link chip (default "All"), but nothing uses it.

---

## 6. Global UI states and primitives (`components/ui`)

- **LoadingState** (`ui/states.tsx`): "{label}..." (default "Loading"). Labels in use:
  - "Loading"
  - "Loading the specimen"
  - "Loading the plan"
  - "Loading what is new"
  - "Loading the question"
  - "Loading the log"
  - "Searching older events"
  - "Loading pull requests"
- **ErrorState:** `error.message`, `role=alert`.
- **EmptyState:** text plus an optional `<pre>` command.
- **Loaded** (`ui/Loaded.tsx`): loading or error until the first load; afterwards StaleNote **[P]** "Could not refresh: {msg}. This may be out of date."
- **NotKept** (`ui/NotKept.tsx`): **[P]** "Not saved: {error}. What you typed is still here; it is kept as soon as saving works again."
- **SyncFailures** (`prs/SyncFailures.tsx`): "PR status is stale for {repo}: {error}". Shown on the Log only.
- **AppShell live note:** **[P]** "Not live: reconnecting. What is shown may be out of date."
- **Other primitives:**
  - Badge / StatusBadge: humanized value with a tone.
  - TimeAgo chip: "now" / "5m" / "2h" / "3d", ISO date in the title.
  - RefLink: a mono button that opens the ref.
  - RefText: text with clickable refs.
  - TextBox: grows as you type; Cmd+Enter submits.
  - LineBox: single line.
  - Markdown: inline or block.
  - Icon: plus, pin, keyboard, grip, chevron, more, palette.
- **Also global:** `useReloadOnNewBuild` silently reloads the page when a new build is deployed.

---

## 7. Every place the UI explains itself in prose

1. **AppShell:** "Not live: reconnecting. What is shown may be out of date."
2. **UndoBar:**
   - "{Line} waits on you, so no new session starts until you answer."
   - "{Line} then looks for another owner."
   - "u to undo"
3. **KeyHelp:** every key description, especially the long "1–9" one and "record answers given elsewhere, in a batch: D-3 a Went with postgres".
4. **WorkingSection** note: "Your order is everyone's order".
5. **SpreadThin** aria-label: "…Tabling some gives the rest their agents back."
6. **WaitingSections** Up next note: "scoped by idle agents, never built, until you start them".
7. **QuestionList "On no line"** note: "from before lines; their agents should put each on its line".
8. **FirstRun:** all three texts, plus "with Undo".
9. **NothingNeedsYou:** "No agent is working right now." / "N agents are working. The likely next ask is on…, at its step: …".
10. **AtSection:** "Everything else is folded. Ends by itself in N hours."
11. **AtUpNext** heading: "While you're here, from lines up next".
12. **LineHandle** title: "Drag to reorder, or click to move".
13. **TaskCard** footer: "{n of m filled, saved | Saved} as you type, so you can finish on another day or device. Done sends {them all|it}; Can't do it asks why and closes the task as not done."
14. **OutcomeFields** label: "Note, if anything surprised you".
15. **StartSheetView:**
    - The intro sentences ("Nothing has been waiting for this line: it starts clean.", "… Settle them now and the line starts with them.").
    - "Tasks, which reach you once it starts".
    - The closing paragraph "It joins the bottom of Working on, and the owner search runs at once: …".
16. **ProposalCase:** "Back to look at, as you asked: …".
17. **NewLineCard:**
    - Hint "one sentence; an agent may propose a sharper one, for you to accept".
    - Hint "the owner needs one of them; helpers cover the rest".
    - "Yours: no agent takes it, and it counts your tasks in to do."
    - "An agent with one of its repos takes it once it is started, and writes its summary."
18. **TableForm:**
    - The consequences paragraph (holds, wind-down, "15 minutes to park: a hand-off summary…").
    - "{On X} it comes back under Proposed, counted in "to accept", with your reason beside it and the choices any proposal has."
19. **BatchPanelView:** "One per line: ref, option key, then an optional note."
20. **HeldDecision:** the "Held: waits for…", "Held while … is not being worked on; it reaches you when…" and "Not in your queue now." labels.
21. **FeedPage** subtitle: both variants, especially "What you have not seen, line by line, in your order. A line counts as seen once you open it, and what you did yourself is never unseen."
22. **UnseenLog** footer: "Up next and tabled: N changes left out. Rule breaks show at the top."
23. **AgentsPage:**
    - Subtitle "Who is out there, and where. The only action here is Stop…; what needs you is on Lines."
    - The three notes paragraphs (States / Taking / Keeping).
    - The empty state "No agent has checked in yet." with its command.
24. **PushToggle:**
    - "Buzzing this device for urgent questions and the top two lines"
    - "Notifications are blocked for this site in the browser's settings"
25. **LineActions:**
    - "Up next, Table, Done, Drop and I'll own it give {owner} 15 minutes to wind down. Table asks why; Done and Drop also close or fold what is open."
    - "Done is final: …".
26. **SummaryBox:** "(the headline: home, the log and the phone show only this)", "none yet; {owner} writes it", "{owner} keeps it".
27. **PlanList:** "No plan yet: the owner breaks the line into steps."
28. **SinceSummary:**
    - "Everything newer than the summary; any you have seen fold to one row."
    - "These are only the newest; the rest are in the Log."
29. **OwnerBox:** the whole prose paragraph in every variant ("You own it. No agent writes to it until you hand it back.", "Octotrack is looking for one.", "writes the summary and hears what you tell it", the asleep/running/quiet sentences, "Helpers may work under it, never writing the summary; none now.").
30. **TellBox:** "A message, not an answer: it closes nothing. Markdown works; the box grows as you type. It goes to the line's inbox and wakes the owner; empty, it is a nudge."
31. **TaskFrees:** "Done goes to the line's inbox for whoever …, and wakes them/it."
32. **PullRequestBox:** "Checks are agents' to fix, never yours. … merges once they pass, and asks first if it wants your eyes."
33. **UpdatesSection** placeholder: "Post an update. Markdown works; Cmd+Enter posts".
34. **NotKept:** "Not saved: … What you typed is still here; it is kept as soon as saving works again."
35. **StaleNote:** "Could not refresh: … This may be out of date."
36. **LinePanelItem** mark-seen error: "…The Log still shows its changes as not seen."
37. **AnswerStatus** wake failure: "{agent} could not be woken; finding an owner".

---

## 8. Inconsistencies worth knowing for the redesign

- **Urgent reasons have two vocabularies:**
  - ProposalCard: "something is broken" / "it is time-boxed" / "waiting costs money".
  - `URGENT_REASON` everywhere else: "something broken" / "time-boxed" / "costs money".
- **Close controls differ:**
  - Line and issue panels: an "Esc" text button.
  - Generic panel and error state: "✕".
  - Loading panel: no close at all.
- **"Proposed" vs "Proposed by agents":** the wide section is "Proposed"; the narrow tile is "Proposed by agents".
- **The Agents subtitle** says Stop/Lift are the only actions, but Release also exists.
- **Recommended suffix:** in ProposalChoices only Start and Up next get the " · recommended" text. Table and Fold into get the primary style without the text.
- **HistoryList** always renders its "History" heading, even when there are no events.
- **Phone-hidden elements:**
  - Brand, Log/Agents nav, the keys button and the "New line" words.
  - Agents' Repo and Wake columns.
  - Option number prefixes on touch devices.
