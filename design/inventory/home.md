# UI inventory: packages/web/src/components/home

Repo: /Users/vasco/projs/octotrack-build. I read all 41 non-test .tsx files in full, plus the hooks, lib files and ui primitives they rely on: useHome, useChoices, useOp, useDraft, useOutcomeDraft, usePlanStep, useLinePlace, useResolveDecision, useDragOrder, useLineHandles, useHomeFocus, useHomeFocusOnPage, useHomeKeys, useNarrow, useClock and usePush; lib/lines, lib/focus, lib/tasks, lib/format and lib/said; Row, Fold, Section, Sheet, Item, Menu, Button, Field, Options, Focusable, Note, Facts, states and NotKept; and ui.css.

Three components sit outside this scope and are named but not inventoried: DecisionCardItem (components/decisions), BatchPanel (components/decisions) and TableForm (components/lines).

## Shared behaviour

**ui primitives**

- `LoadingState` renders `"Loading…"` (`<p role=status>`).
- `ErrorState` renders the raw `error.message` (`<p role=alert>`). It has no retry button.
- `EmptyState` renders its text, plus an optional monospace command.
- `NotKept` renders `"Not saved: {error}"`.

**Row**

- Has an optional small "kind" line with a tone dot: `needs` (default), `stuck` (warm) or `none`.
- Then the title and its facts (small grey, dot-separated), an optional note line, and an optional lead on the left (a number or handle).
- At the end it shows `trailing` content; if it has none and the row opens, it shows a chevron `›`.
- A row with `current` gets a quiet tint. A row with `onOpen` is one big button.

**Fold**

- One button with: title, count, an optional summary of names, and a chevron.
- Toggles open and closed.
- Held open while one of its items has focus. While held, the button is disabled and the chevron is hidden.

**Section**: an h2 title with a count, an optional aside on the right, then its content.

**Sheet**

- Rendered through a portal as a modal, with a dimmed scrim behind it.
- Header: title and a quiet `"Cancel"` button. Footer: actions.
- Esc, a tap on the scrim, or Cancel closes it.
- On a phone (≤720px) it rises from the bottom, at most 88vh tall, with only the top corners rounded. On a wide screen it is a centred panel.

**Numbered choices** (`data-choice`)

- The number is drawn before a button's label only under `@media (pointer: fine)`, and only inside the item that has focus (`[data-current="true"]`).
- Number keys press the drawn button. A disabled button does nothing, silently.

**Touch** (`@media (pointer: coarse)`)

- Buttons and menu items get a minimum height of `--touch-target`.
- `.ui-link`, `.ui-ref` and `.ui-lead` get an invisible hit area that extends `--space-5` past their edges.
- Text inputs use a larger font size so iOS does not zoom.
- Menu items show no focus ring.

**Phone** (`max-width: 720px`; `useNarrow` uses the same breakpoint)

- Row facts wrap to their own line below the title.
- The body of a row that has a lead takes the full width.
- `.ui-fold-summary` is hidden.
- Page padding changes.

**Hover only**: row-head tint, underline on `.ui-link`, `.ui-ref` and `.ui-lead`, and `cursor: grab` on the line number.

**Choices with Undo**

- Most actions call `choices.make(...)`. The choice waits a few seconds and shows in the Undo bar, which lives in components/layout and is out of scope.
- While a choice waits, home marks its item "held": that item's number keys are disarmed (`armed=false`).
- Reordering (`lineOrder`) and I'm at (`at`) run immediately, with no Undo.

---

### HomePage — components/home/HomePage.tsx

- **Kind:** screen
- **Shown when:** route `/` or `/lines` (App.tsx). `?focus=<ref>` focuses that item (from a notification or a header count) and is then cleared. `?ref=` (a panel open) makes home "inspecting": its keys stand down.
- **Used by:** App.tsx
- **Purpose:** every line in the developer's order, with what each needs from them, in place.
- **Data shown, in order:**
  1. RecordAnswers overlay
  2. mutation failure
  3. Loading
  4. query error
  5. FirstRun or NothingNeedsYou
  6. AtSection
  7. QuestionList `"Urgent"`
  8. WorkingSection
  9. AtUpNext
  10. WaitingSections
  11. QuestionList `"On no line"`

  The page has a hidden h1, `"Lines"`.
- **Actions (keys; none apply while a `?ref` panel or a Start sheet is open):**
  - `j` / `k`: next / previous item
  - `J` / `K`: next / previous line
  - `1`–`9`: presses the focused item's numbered button. Not on questions, which number their own options, and not on lines.
  - `o` or `Enter`: open the focused item's line panel
  - `t`: open the line panel on Tell
  - `Alt+↑` / `Alt+↓`: move the line
  - `g u`: focus the first urgent item
  - `r`: open Record answers
  - `?`, `g p`, `Esc` and `/` belong to the shell.
- **States:**
  - `recording` true → `<RecordAnswers>` (BatchPanel).
  - `h.failure` non-null → ErrorState with the message. Sources: a failed `lineOrder` or `at` mutation, or a failed choiceMake / choiceUndo / choiceNow made through useHome's own `useChoices` instance.
  - `h.home.isPending` → `"Loading…"`.
  - `h.home.error` → ErrorState with the message. Because queries use keepPreviousData, this can show together with the stale home below it.
  - `home === undefined` → nothing below.
  - `working.length === 0 && upNext.length === 0` → FirstRun.
  - Otherwise, if every count is 0 → NothingNeedsYou.
  - Otherwise → neither.
  - `at !== null` → AtSection and AtUpNext. AtUpNext gets only the place's tasks whose line is up next.
  - narrow → `"On no line"` folds; lines from the third on fold; WaitingSections folds.
  - `at !== null` → WaitingSections folds as well (`narrow || at`).
- **Loading:** `"Loading…"`
- **Error:** ErrorState (raw message) for the home query, and separately for mutation and choice failures. None has a dismiss or retry.
- **Empty:** delegated to FirstRun (`"No lines yet"` + `octo guide`), WorkingSection (`"Nothing is being worked on"`) and WaitingSections (`"Nothing is up next"`).
- **Phone / touch:** `useNarrow`, see the States above. The minute clock (`useClock` at 60s) runs only while at a place.

### AnswerStatus — components/home/AnswerStatus.tsx

- **Kind:** row
- **Shown when:** a working line's `details.answers` is non-empty and the line is not folded (`fold === null`).
- **Used by:** WorkingLine
- **Purpose:** an answer given lately on the line, and what became of it.
- **Data shown:**
  - kind: the answer's ref as a RefLink (monospace, opens its panel)
  - tone: none
  - title: `answer.answer`
  - note: its status
- **Actions:** quiet button `"Change answer"` (aria-label `"Change answer {ref}"`) opens the question in the panel (`openEntity`). The ref link also opens it.
- **States (the note):**
  - `not_picked_up` → `"not picked up yet"`
  - `picked_up` with no `by` → `"picked up"`
  - `picked_up` with `by` → `"picked up by {by}"`, plus `", {timeAgo}"` when `at` is set. timeAgo gives `now`, `5m`, `2h`, `3d` or `YYYY-MM-DD`, with no "ago".
  - `carried_out` with no note → `"✓ carried out"`
  - `carried_out` with a note → `"✓ carried out: {note}"`
  - `wake_failed` → `"{unwoken ?? "its agent"} could not be woken; finding an owner"`
- **Loading / Error / Empty:** none (pure)
- **Phone / touch:** touch extends the ref's hit area.

### AtPlaceItems — components/home/AtPlaceItems.tsx

- **Kind:** panel (the body of a working line)
- **Shown when:** I'm at a place (`at !== null`), under each working line.
- **Used by:** WorkingSection
- **Purpose:** at a place, that place's tasks open with their choices, the focused item opens, and everything else folds to one sentence.
- **Data shown, per item in order:**
  - A task whose `place === at` → a Focusable (label `"Task {ref}, {title}"`) holding the TaskItem, open.
  - The item that has focus → LineForYouItem, rendered open.
  - Anything else → not drawn individually.
  - Then FoldedItems for the rest.
- **Actions:** the FoldedItems row focuses the first folded item.
- **States:** a list with nothing at the place and nothing focused shows only the FoldedItems row. A line with no items renders an empty List, which is an empty bordered box. See Gaps.
- **Loading / Error / Empty:** none

### AtSection — components/home/AtSection.tsx

- **Kind:** row (banner)
- **Shown when:** `home.at !== null`
- **Used by:** HomePage
- **Purpose:** where I am, how long until it ends by itself, and Leave.
- **Data shown:**
  - title `"At {place}"`
  - facts `"ends in {N}h"`: whole hours, rounded, at least 1
- **Actions:** `"Leave"` (plain) → `h.at(null)`, an immediate `at` mutation.
- **States:** a single branch. A `until` already in the past still shows `"ends in 1h"`.
- **Loading:** none. The button shows no pending state.
- **Error:** a failed Leave shows in HomePage's top ErrorState.
- **Empty:** none

### AtUpNext — components/home/AtUpNext.tsx

- **Kind:** panel (section)
- **Shown when:** at a place, and some of its tasks belong to up-next lines.
- **Used by:** HomePage
- **Purpose:** this place's tasks that wait on lines up next, each with its choices.
- **Data shown:**
  - Section `"Here, from up next"` with its count.
  - Per task, a Focusable holding:
    - a Note `"{lineNumber} {line title} · "` followed by `"asked {sinceText}"`, or `"re-confirmed {sinceText}"` when re-confirmed later. sinceText gives `just now`, `5m ago`, `2d ago` or `on YYYY-MM-DD`.
    - then the TaskItem
- **States:**
  - `tasks.length === 0` → null.
  - Line not found → the prefix is `""`.
- **Loading / Error / Empty:** none (renders nothing)

### CheckoutForm — components/home/CheckoutForm.tsx

- **Kind:** widget (inline form)
- **Shown when:** in StepIn, after `"Set its checkout"` is pressed (the line's Step in kind is `clone_failed` and it has a repo).
- **Used by:** StepIn
- **Purpose:** point the line at an existing local checkout after a clone failed.
- **Data shown:** Field labelled `"Checkout of {repo}"` (repo key), placeholder `"/path/to/repo"`, autofocused.
- **Actions:**
  - `"Set"`: primary submit, disabled unless the path starts with `/`.
  - `"Cancel"`: quiet, returns to the Actions.
  - Enter submits.
- **States:** valid / invalid only toggles whether Set is disabled. There is no message.
- **Loading / Error / Empty:** none. A failure surfaces as a choice failure on HomePage.

### DoneWhenChanged — components/home/DoneWhenChanged.tsx

- **Kind:** widget (item)
- **Shown when:** the line in the Start sheet has `doneWhenProposal !== null`.
- **Used by:** StartSheetView
- **Purpose:** a done when an agent sharpened while the line waited.
- **Data shown:**
  - kind `"Done when changed"`
  - title: the proposal (markdown)
  - Note `"Was: {was}"`, plus `" · {why}"` when why is set
- **Actions:**
  - `"Accept"` (number 1) → `onDoneWhen(true)`
  - `"Keep current"` (number 2) → `onDoneWhen(false)`
  - Both are plain buttons; neither is primary.
- **States:** `why` null or set.
- **Loading / Error / Empty:** none

### FirstRun — components/home/FirstRun.tsx

- **Kind:** widget (banner)
- **Shown when:** home has no working and no up-next lines. This holds even when tabled or done lines exist.
- **Used by:** HomePage
- **Purpose:** before anything is placed, offer to accept the agents' recommended placements.
- **States:**
  - `proposals.length === 0` → EmptyState `"No lines yet"` with the command `octo guide`.
  - Otherwise → a Row (label `"First run"`), title `"Nothing placed yet"`, facts `"{placeable} of {total} proposed carry a recommendation"`. Placeable means the recommendation is not null and not `fold`.
  - `placeable > 0` → primary button `"Accept recommended placements"` → `h.acceptRecommended(refs)`. Its Undo text is `"Placing N proposal(s) where their agents recommend"`.
  - `placeable === 0` → no button.
- **Loading:** none. No in-flight state.
- **Error:** choice failure on HomePage.
- **Empty:** `"No lines yet"` / `octo guide`

### FoldPicker — components/home/FoldPicker.tsx

- **Kind:** widget
- **Shown when:** ProposalCard mode is `fold`, after `"Fold into"` is pressed. Also used by entity/LineActions.
- **Used by:** ProposalCard, LineActions
- **Purpose:** pick the open line a proposal joins.
- **Data shown:** label `"Fold into"`, then one button per target with the target's title.
- **Actions:**
  - Each target button: aria-label `"Fold {title} into {target}"`, numbered 1–9 (the 10th and later are unnumbered). The first is autofocused. Press → `h.fold`, Undo text `"Folding X into Y"`.
  - `"Cancel"` (quiet) returns to the choices.
- **States:** with no targets, only the label and Cancel show. ProposalCard never opens it in that case.
- **Loading / Error / Empty:** none

### FoldedItems (and foldedText) — components/home/FoldedItems.tsx

- **Kind:** row
- **Shown when:** at a place, and a working line has items not at that place and not focused.
- **Used by:** AtPlaceItems
- **Purpose:** the rest of a line's items, folded to one row.
- **Data shown:** tone none; title joined with `" · "`, in this order:
  - `"N question(s)"`
  - per place: `"N task(s) at {place}"`, or `"N task(s)"` for tasks with no place
  - `"N proposal(s)"`
- **Actions:** the whole row → focus the first folded item.
- **States:** `items.length === 0` → null.
- **Loading / Error / Empty:** none

### ForYouItem — components/home/ForYouItem.tsx

- **Kind:** widget (switch)
- **Shown when:** a for-you item has focus on home, or is listed in the line panel (PanelForYou, with `background`).
- **Used by:** LineForYouItem, entity/PanelForYou
- **Purpose:** one thing waiting on the developer, opened in full.
- **States:**
  - `question` → DecisionCardItem (active, armed, background, onPostponed). Out of scope.
  - `task` → TaskItem
  - `done` → LineProposalCard. Accept → `h.lineDone` (`"Closing X as done"`). Decline → `h.notYet` (`"Telling X's owner it is not done yet"`).
  - `done_when` → LineProposalCard → `h.doneWhen` (`"Accepting the new done when for X"` / `"Keeping X's done when"`).
- **Loading / Error / Empty:** none

### ForYouRow — components/home/ForYouRow.tsx

- **Kind:** row
- **Shown when:** each for-you item on a working line, each urgent or no-line question, and in PanelForYou.
- **Used by:** LineForYouItem, QuestionList, PanelForYou, LinesGallery
- **Purpose:** a closed one-row summary, or with focus the opened item in place.
- **States:**
  - Focused and has children → a Focusable (labelled by focusLabel) wrapping the children.
  - Otherwise → a Row with open-label `"Open {ref}"`:
    - **question:**
      - kind `"Question · {D-ref}"` (tone needs), or `"Urgent · {something broken|time-boxed|costs money} · {D-ref}"` (tone stuck)
      - title: the decision title
      - note `"Recommended: {option label}"`, plus `" · {recommendationWhy}"` when set; no note when there is no recommendation
    - **task:**
      - kind `"Task · {ref}"`, plus `" · at {place}"`
      - title
      - note `"Frees {ref}: {title}"` when `frees` is set; otherwise the outcome (markdown) when it is non-empty; otherwise none
    - **done:** kind `"Proposed done · {line ref}"`, title: the text (markdown)
    - **done_when:** kind `"Proposed done when · {line ref}"`, title: the text
- **Actions:** clicking the row → focus that ref (`onOpen`).
- **Loading / Error / Empty:** none

### HeldQuestion — components/home/HeldQuestion.tsx

- **Kind:** widget (item)
- **Shown when:** the Start sheet, for each current held question that is still open.
- **Used by:** StartSheetView
- **Purpose:** answer a held question in the Start sheet.
- **Data shown:**
  - kind `"Question · {ref}"`
  - title
  - context (markdown), only when non-empty
  - Options: one button per option. The label is the option label, with a `"recommended"` badge on the recommended one. Numbered from `firstChoice`.
  - Note `"Why {n}: {recommendationWhy}"`, only when both a why and a recommended option exist
- **Actions:** each option → `resolve(...)`. Undo text `Sending "{label}" to {line title}`.
- **States:** context empty or not; why shown or not. With zero options, nothing is clickable.
- **Loading / Error / Empty:** none. A failure has no UI; see Gaps.

### KeyHelp — components/home/KeyHelp.tsx

- **Kind:** sheet
- **Shown when:** `?` is pressed anywhere (AppShell `keysOpen`). `?`, Esc, Cancel or the scrim closes it.
- **Used by:** layout/AppShell, design/PrimitivesGallery
- **Purpose:** every key, in one list.
- **Data shown:** Sheet `"Keys"`, then pairs of `<kbd>` and description:
  - `j k` — next, previous item
  - `J K` — next, previous line
  - `1–9` — the focused item's numbered choice
  - `w` — answer in my own words
  - `l` — later
  - `u` — undo
  - `o ↵` — open the line
  - `t` — tell the line's owner
  - `alt ↑ ↓` — move the line
  - `g p` — I'm at
  - `esc` — close, leave I'm at
  - `g u` — urgent question
  - `/` — search
  - `r` — record answers
- **Actions:** `"Cancel"`
- **States / Loading / Error / Empty:** none
- **Phone:** a bottom sheet. These keys do nothing on touch, yet the sheet is the same.

### LineForYou — components/home/LineForYou.tsx

- **Kind:** panel
- **Shown when:** under each working line, when not at a place.
- **Used by:** WorkingSection
- **Purpose:** the first thing waiting on the developer, with the rest one row away.
- **States:**
  - Empty `forYou` → null.
  - `folded` (phone, line index ≥ 2, nothing of it focused) → a List with one Row, title `"{N} for you"`, chevron; pressing it focuses the first item.
  - Otherwise → the first item (LineForYouItem), then for the rest:
    - nothing, when there are none
    - all of them, when `open`
    - otherwise a MoreForYou row
- **Actions:** the rows (focus / show more)
- **Loading / Error / Empty:** none
- **Phone:** the folded branch is driven by `useNarrow`, via `foldFrom=2`.

### LineForYouItem — components/home/LineForYouItem.tsx

- **Kind:** row
- **Shown when:** each for-you item on a working line.
- **Used by:** WorkingSection (through LineForYou or AtPlaceItems)
- **Purpose:** a row that opens in place while it has focus.
- **States:**
  - Focused → ForYouRow wrapping a ForYouItem, wired to the h actions.
  - Not focused → the ForYouRow summary row.
- **Loading / Error / Empty:** none

### LineHandle — components/home/LineHandle.tsx

- **Kind:** widget (menu)
- **Shown when:** the lead of every working and up-next line (built by `useLineHandles`).
- **Used by:** useLineHandles → WorkingSection and WaitingSections; LinesGallery
- **Purpose:** the line's number, which also drags and moves it.
- **Data shown:** the number (working: index+1; up next: working count + index + 1), drawn as small grey figures. aria-label `"Move {title}"`.
- **Actions:**
  - Click → a menu (`"Move {title}"`) with `"Move to top"`, `"Up"`, `"Down"`, and on working lines only `"To up next"`.
  - Unavailable items stay but are disabled. The first enabled item is autofocused.
  - Top, Up and Down run immediately (`lineOrder`). To up next is a choice with Undo (`"Moving X to up next"`).
  - Drag the number onto another line in the same section → it lands before that line in its top half, after it in its bottom half, shown by a rule. Dropping into the other section does nothing.
  - Esc, a tap elsewhere or blur closes the menu. `Alt+↑/↓` moves the focused line.
- **States:** menu open or closed; up/down/top disabled at the ends.
- **Loading:** none. No pending state.
- **Error:** an order failure shows in HomePage's ErrorState.
- **Phone / touch:** coarse pointers get an extended hit area and touch-height menu items. Drag uses native HTML5 drag-and-drop, which is effectively mouse-only; touch uses the menu.

### LineMeta — components/home/LineMeta.tsx

- **Kind:** widget (facts)
- **Shown when:** the facts of a working line, unless at a place (`fold="at"`).
- **Used by:** WorkingLine
- **Purpose:** who is on the line, whether it waits on you, re-confirming, held, step.
- **Data shown, in order:**
  1. `"yours"`, when the line is owned.
  2. crewText:
     - `"owner {name}, {running|asleep|quiet|gone|stopped}"`
     - or, with no owner and a search under way: `"no owner: step in"` when stepIn, `"no owner yet"` at search step 3, otherwise `"finding an owner"`
     - `"+N helper(s)"`
     - `"{name} is scoping it"`
  3. If forYou is non-empty: `"waiting on you"` or `"agents on it"`.
  4. `"{n} re-confirming"`
  5. `"{n} held for an agent"`, owned lines only
  6. `"step {p} of {n}, {title}"`

  Facts starting with "no owner" use the warm stuck tone.
- **States:** no facts → null.
- **Loading / Error / Empty:** none

### LineProposalCard — components/home/LineProposalCard.tsx

- **Kind:** widget (item)
- **Shown when:** a focused `done` or `done_when` item.
- **Used by:** ForYouItem, LinesGallery
- **Purpose:** an agent's proposal about the line itself.
- **Data shown:**
  - label `"{title} is done?"` or `"New done when for {title}"`
  - kind `"Proposed as done"` or `"Done when changed"`, plus `" · {by}"`
  - title: the done when (done) or the new text (done_when)
  - body:
    - done → the agent's case (markdown)
    - done_when → Note `"Was: {was}"`, plus `" · {why}"`
- **Actions:**
  - done → `"Done"` (primary, 1) → lineDone; `"Not yet"` (2) → opens the why form.
  - done_when → `"Accept"` (primary, 1); `"Keep current"` (2) → declines at once.
  - Why form:
    - a TextBox, hidden label `"What {line ref} still needs"`, placeholder `"What is missing"`, autofocused
    - `"Not yet"` (primary submit) sends the trimmed text. An empty reason is allowed.
    - `"Cancel"` (quiet)
- **States:** `why === null` → buttons; otherwise → the form.
- **Loading / Error / Empty:** none. Failures go to HomePage.

### LineStepIn — components/home/LineStepIn.tsx

- **Kind:** row / widget
- **Shown when:** a working line has `stepInReason` and `stepInKind`.
- **Used by:** WorkingSection
- **Purpose:** Step in, either open or folded at a place.
- **States:**
  - reason or kind null → null.
  - At a place and not focused → Row, kind `"Step in"` (tone stuck), title from STEP_IN_SHORT; pressing it focuses Step in. The short titles:
    - `"nothing can start a session"`
    - `"the runner is only watching"`
    - `"a start keeps failing"`
    - `"sessions keep leaving"`
    - `"a session never took it"`
    - `"its checkout could not be made"`
    - `"it names no repo"`
    - `"every session is busy"`
  - Otherwise → StepIn, with the action for the kind:
    - retry: no_start_command, failing, left, never_took
    - anyway: at_cap
    - checkout: clone_failed, only when the line has a repo
    - none: watch_only, no_repo
- **Loading / Error / Empty:** none

### MoreForYou — components/home/MoreForYou.tsx

- **Kind:** row
- **Shown when:** a working line has more than one item, none of the rest is focused, and it has not been expanded.
- **Used by:** LineForYou
- **Data shown:** tone none; title `"{N} more: {described}"`. For a single item, described is `"a task"`, `"a task at {place}"`, `"a question"` or `"a proposal"`. For several: `"N question(s) and N task(s) and N proposal(s)"`.
- **Actions:** the row → expands that line, for good (it never collapses).
- **Loading / Error / Empty:** none

### NothingNeedsYou — components/home/NothingNeedsYou.tsx

- **Kind:** widget (banner)
- **Shown when:** some line is working or up next, and every header count is 0.
- **Used by:** HomePage
- **Data shown:**
  - title `"Nothing needs you"`
  - facts:
    - `"no agents working"`, `"1 agent working"` or `"N agents working"`
    - `"next ask likely on {title}"`, plus `", {step}"`; omitted when no line is working
- **Loading / Error / Empty:** none

### OutcomeFields — components/home/OutcomeFields.tsx

- **Kind:** primitive-use (form part)
- **Shown when:** a task with named fields, not in Can't mode.
- **Used by:** TaskCard
- **Data shown:** one single-line Field per field name (label = the name), side by side (FieldRow wraps), then a multiline Field `"Note"`.
- **Loading / Error / Empty:** none

### ProposalCard — components/home/ProposalCard.tsx

- **Kind:** row
- **Shown when:** each `home.proposed` line, in WaitingSections.
- **Used by:** WaitingSections, LinesGallery
- **Purpose:** a proposed line with its recommendation and its choices.
- **Data shown:**
  - Optional kind `"Urgent · {something broken|time-boxed|costs money}"` (tone stuck). With no urgent reason there is no kind line.
  - Title: a link that opens the line panel.
  - Facts:
    - `"{proposedBy}, {just now | 2h ago | 3d ago}"`
    - the repos, joined `", "`
    - `"first step: {title}"`
    - `"from {fromRef}"`
  - Note `"Done when {doneWhen}"`, when non-empty.
  - Body: ProposalCase, then ProposalChoices or FoldPicker, then TableForm when tabling.
- **Actions:** see ProposalChoices.
  - Table opens the TableForm sheet: `"Table {title}"`, Fields `"Why it waits"` and `"Look again on"` (date), primary `"Table it"` (disabled until there is a reason), `"Cancel"`.
  - A tabled line that came back: Start opens the Start sheet. A fresh proposal starts at once.
- **States:**
  - mode null → choices
  - `fold` → FoldPicker
  - `table` → choices plus the sheet
  - `focused` → row tint
- **Loading / Error / Empty:** none. Failures go to HomePage.

### ProposalCase — components/home/ProposalCase.tsx

- **Kind:** widget (note)
- **Used by:** ProposalCard
- **States:**
  - A tabled line that came back → `"Tabled: {reason}"`, plus `" · look again {at HH:MM | on Tuesday | on 1 February [YYYY]}"`.
  - No recommendation → null.
  - Otherwise → `"Recommended: {Start|Up next|Table|Fold into another line}"`, plus `", after {lastUpNext}"` for up_next when there is a last up-next line, plus `" · {why}"`.
- **Loading / Error / Empty:** none

### ProposalChoices — components/home/ProposalChoices.tsx

- **Kind:** widget (actions)
- **Used by:** ProposalCard
- **Actions:**
  1. `"Start"` (aria `"Start {title}"`)
  2. `"Up next"` → `"Moving X to up next"`
  3. `"Table"`
  4. `"Fold into"`, only when there are fold targets
  5. Last: quiet `"Not a line"` (aria `"Not a line: {title}"`, Undo `"Turning down X: not a line"`), or for a tabled line that came back, `"Drop"` (`"Dropping X"`). Its number is 5 with Fold into, 4 without.

  The recommended button is primary; the others are plain. A tabled line that came back has no recommended button.
- **States:** canFold yes/no; fromTable yes/no.

### PushToggle — components/home/PushToggle.tsx

- **Kind:** widget
- **Shown when:** the header aside of the Agents page (`/agents`).
- **Used by:** agents/AgentsPage
- **States:**
  - `unsupported` → nothing.
  - `off` → button `"Buzz this device"` → `turnOn`.
  - `on` → Note `"Buzzing this device"`.
  - `blocked` → `"Notifications blocked"`.
  - `turning-on` → `"Turning on…"`.
  - `error` → an error Note: `"This server does not send notifications"`, or the raw message.
- **Loading:** `"Turning on…"`
- **Error:** as above. If the permission prompt is dismissed, it goes back to `"Buzz this device"` silently.

### QuestionList — components/home/QuestionList.tsx

- **Kind:** panel (section)
- **Shown when:** `"Urgent"` (`home.urgent`) at the top; `"On no line"` (`home.noLine`) at the bottom.
- **Used by:** HomePage
- **States:**
  - No cards → null.
  - Each card: focused → ForYouRow wrapping a DecisionCardItem (active unless inspecting); otherwise a summary row.
  - `folded` (phone, On no line only) → Fold `"On no line"` with its count, held open while one of its cards has focus.
  - Otherwise → Section with title and count.
- **Phone:** On no line folds; Urgent never does.

### QuietRow — components/home/QuietRow.tsx

- **Kind:** row
- **Shown when:** each line in the Tabled and Done lately folds.
- **Used by:** WaitingSections, LinesGallery
- **Data shown:** title link; note facts: the tabled reason, `"look again {whenText}"`.
- **Actions:** tabled only:
  - `"Up next"` (aria `"Up next {title}"`)
  - `"Start"` (aria `"Start {title}"`), which opens the Start sheet

  Done lately has no actions.
- **States:** trailing buttons present or absent. A done line with neither reason nor date renders an empty note element.

### RecordAnswers — components/home/RecordAnswers.tsx

- **Kind:** panel
- **Shown when:** `r` is pressed on home.
- **Used by:** HomePage
- **Purpose:** wraps `<BatchPanel autoFocus onClose>`, which records answers given elsewhere. BatchPanel is out of scope.

### SpreadThin — components/home/SpreadThin.tsx

- **Kind:** widget (section aside)
- **Shown when:** the `"Working on"` header, when more than 6 lines are working and some have no owner or wait on you.
- **Data shown:** `"{n} with no owner"` (stuck tone), `"{n} waiting on you"`.
- **States:** otherwise null.

### StartSheet — components/home/StartSheet.tsx

- **Kind:** sheet (container)
- **Shown when:** Start on an up-next row, Start on a tabled row, or Start on a tabled line back under Proposed. Also from entity/LinePanelItem.
- **Used by:** WaitingSections, LinePanelItem
- **Purpose:** loads what the line holds (`heldList` and open decisions), then renders StartSheetView.
- **Actions:** number keys 1–9 press the sheet's numbered buttons. They are off when not armed (a `?ref` panel is open) or while a choice about this line or its questions waits.
- **States:**
  - Either query pending → status `"Loading…"`.
  - Either query failed → status ErrorState with the message.
  - Start is disabled in both cases.
- **Loading:** `"Loading…"`
- **Error:** the raw message; Start disabled; no retry. Answer failures are unhandled; see Gaps.

### StartSheetView — components/home/StartSheetView.tsx

- **Kind:** sheet
- **Used by:** StartSheet, LinesGallery
- **Data shown:**
  - Sheet `"Start {title}"`, with a numbered tint.
  - status, if any.
  - EmptyState `"Nothing waited for it"`, when there is no done-when proposal and no current held items.
  - DoneWhenChanged (numbers 1, 2).
  - HeldQuestions, numbered in one run after it.
  - A List labelled `"Tasks, once it starts"`: rows with a ref link and title.
  - Footer: primary `"Start"` → `h.start` (`"Starting X"`) and the sheet closes.
- **Actions:** `"Cancel"`, Esc, scrim, `"Start"`.
- **States:** status present → only the status and a disabled Start.
- **Phone:** a bottom sheet; the numbers are hidden on touch.

### StepIn — components/home/StepIn.tsx

- **Kind:** widget (item)
- **Used by:** LineStepIn, LinesGallery
- **Data shown:** a Focusable labelled `"Step in on {title}"`; kind `"Step in"` (stuck); the reason (markdown).
- **Actions, numbered in this order:**
  - `"Set its checkout"` → CheckoutForm
  - `"Try now"` → retry (`"Trying X again"`)
  - `"Start one anyway"` → `"Starting one anyway for X"`
  - `"Table it"` → TableForm sheet
  - `"I'll own it"` → `"Taking X as yours"`

  The first offered action is primary, unless it is Table it.
- **States:** mode `checkout` → the form replaces the Actions. Mode `table` → a sheet over the page, with the Actions still underneath.

### TaskCard — components/home/TaskCard.tsx

- **Kind:** widget (item form)
- **Used by:** TaskItem, LinesGallery
- **Data shown:**
  - kind facts: `"Task for you"`, the ref link, `"at {place}"`, `"holds up {step}"`, `"filed by {createdBy}"` (left out when the creator is dev)
  - title
  - Note `"Frees {ref}: {title}"`
  - body (markdown)
  - then the form
- **States:**
  - **A task of my own** (`outcome === ""`): no input; `"Done"` is enabled; no saved note.
  - **Named fields:** the outcome (markdown), then OutcomeFields, then `"{k} of {n} filled, saved"`.
  - **Otherwise:** a multiline Field labelled with the outcome text, or `"What you found"`; then `"Saved as you type"`.
  - **Can't mode:** a Field `"Why {ref} cannot be done"`, placeholder `"Why not"`; `"Close it"` (disabled while empty or sending); `"Cancel"`.
  - **Normal mode:** `"Done"` (primary, 1), disabled until ready and while sending; `"Can't do it"` (2), never disabled.
  - The form's aria-label is `"Report the outcome"`, or `"Say why it cannot be done"` in Can't mode.

### TaskClosed — components/home/TaskClosed.tsx

- **Kind:** widget (item)
- **Shown when:** in the IssuePanel, for a closed task.
- **Data shown:** kind `"Task"`, the ref, `"at {place}"`; title; label `"Done"`, `"Could not be done"` or `"Withdrawn by {by | its agent}"`, followed by sinceText; then the result (markdown) when one was sent.

### TaskItem — components/home/TaskItem.tsx

- **Kind:** widget (container)
- **Purpose:** keeps the draft (`task:{ref}` and `task-why:{ref}`), loads the plan step, and computes `sending`.
- **States:** a draft save failure → `"Not saved: {error}"`. A draft that is still loading or failed to load shows an empty box.

### UpNextRow — components/home/UpNextRow.tsx

- **Kind:** row
- **Data shown:**
  - facts:
    - held: `"N question(s) and N task(s) held"`
    - `"N re-confirming"`
    - `"not scoped"` or `"N step(s) scoped"`
    - `"done when changed"`
    - crew text
  - note `"Done when {doneWhen}"`
- **Actions:** `"Start"` (aria `"Start {title}"`) opens the Start sheet; the line handle; the title link.

### WaitingSections — components/home/WaitingSections.tsx

- **Kind:** panel
- **States:**
  - Wide (not narrow and not at a place):
    - Section `"Up next"` with its count, or `"Nothing is up next"` when empty.
    - Section `"Proposed"`, only when there are proposals.
  - Narrow or at a place:
    - Fold `"Up next"` and Fold `"Proposed"`, hidden when empty, held open while focused.
    - Their summaries are `"A, B, C and N more"`, left out on a phone.
  - Always:
    - Fold `"Tabled"`, with summary names plus `" · N questions and N tasks held"`.
    - Fold `"Done lately"`.
    - StartSheet, when `starting` matches a line.

### WorkingLine — components/home/WorkingLine.tsx

- **Kind:** row
- **States:**
  - **`fold="at"`:** no facts, no headline, no answers.
  - **`fold="phone"`:** facts and headline are kept; the answers are hidden.
  - **Not folded:** everything shows. The headline note reads `"{headline} · N change(s) since"`, where the change count is a link that opens the line.

### WorkingSection — components/home/WorkingSection.tsx

- **Kind:** panel
- **Data shown:** Section `"Working on"` with its count and the SpreadThin aside; `"Nothing is being worked on"` when empty.
- **Per line:** WorkingLine holding LineStepIn, then AtPlaceItems when at a place or LineForYou otherwise.
- **Folding:** on a phone, lines from the third on fold unless one of their items has focus.

---

## Gaps

1. **StartSheet answer failure has no UI.** StartSheet.tsx:36 and :74–81 answer through `useResolveDecision`, which makes the choice through its own `useChoices` instance (useResolveDecision.ts:21). Its `make.error` (exposed as `error`, useResolveDecision.ts:24) is never rendered. HomePage's `h.failure` cannot see it, because each `useChoices` call has its own mutation. The `choices` instance at StartSheet.tsx:37 is used only for `pending`.
2. **The Start sheet can be blank.** StartSheetView.tsx:43–46 drops a current held question that is missing from the open-decisions list. If every held item is like that, the body is empty and no empty state shows, because `held.length > 0` (:69).
3. **Start sheet load error is a dead end.** StartSheet.tsx:63–69 shows the raw message, Start stays disabled, and there is no retry.
4. **Pending-choices query error is ignored.** useChoices.ts:6 and :11, `choiceList` error. Holds and `sending` silently read false, so keys stay armed and Done is not disabled.
5. **Project names fail silently.** useHome.ts:29: a `projectList` error or load leaves repo names as keys. useHome.ts:41: `placeList` is unused on home.
6. **"holds up" fact disappears silently.** usePlanStep.ts:9–16 (TaskItem.tsx:24): a `lineShow` error or load just omits the fact.
7. **Drafts can load blank or fail without notice.**
   - useDraft.ts:18 and :66: while `draftGet` loads, or if it fails, the box is empty with no indication. Typing then replaces the server draft.
   - useDraft.ts:61: a save failure when the box closes is swallowed.
8. **Mutation failures show far from where they happen.** HomePage.tsx:68 shows them at the top of the page, with no dismiss.
9. **Query errors can sit above stale data.** HomePage.tsx:70 with useOp.ts:18: the error and the stale home both show, and there is no retry.
10. **No in-flight state for immediate actions.** Nothing shows while these run:
    - Leave: AtSection.tsx:21
    - Reorder, menu and drag: useHome.ts:126–145; useDragOrder.ts
    - Every `choices.make` button until the pending list refetches, including Can't do it (TaskCard.tsx:127)
11. **Some actions refuse without explanation.**
    - CheckoutForm.tsx:18 and :35: Set is disabled for a relative path, with no message.
    - useDragOrder.ts: a drop across sections is ignored, though no rule shows there.
    - focus.ts:219: a number key on a disabled button does nothing.
12. **Push gives no feedback in two cases.**
    - PushToggle.tsx:21: an unsupported browser renders nothing.
    - usePush.ts:65–67: a dismissed permission prompt quietly returns to off.
13. **Copy bugs.**
    - ProposalCard.tsx:16–19: after 30 days the age reads `"2026-10-01 ago"`.
    - AnswerStatus.tsx:17: `"picked up by X, 2h"` has no "ago".
    - ForYouRow.tsx:40: the open label reads `"Open done:L-3"`.
    - LineProposalCard.tsx:69: the label names the line ref, not its title.
14. **Empty or odd render branches.**
    - QuietRow.tsx:23–28: an empty note element.
    - AtPlaceItems.tsx:32: an empty List box for a line with no items.
    - AtSection.tsx:9: an expired I'm at reads `"ends in 1h"`.
    - HeldQuestion.tsx:22: a question with no options cannot be answered.
    - FirstRun (HomePage.tsx:73): says `"Nothing placed yet"` even when tabled lines exist.
    - WorkingSection.tsx:113: "N more" never collapses.
    - WaitingSections.tsx:117: on a phone, an empty Up next shows no empty-state line.
    - LineStepIn.tsx:50: a clone failure on a line with no repo has no forward action.
15. **No per-item pending state in the Start sheet.** StartSheet.tsx:39–61: after an answer, the item stays as it was until the server applies it, and the keys are silently disarmed.
