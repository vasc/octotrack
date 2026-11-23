# Line

One line of work, opened. On its own page (`triage/T-Line.dc.html`): its head and moves, then on a lifted sheet its
plan, pull requests, owner and Tell, and beside it what is for you, the summary and what happened. In a peek
(`triage/T-Peek-Line.dc.html`) the line in short: its head with who is on it and what finishes it, what else is for you,
its pull requests, what happened, and Tell at its foot; its plan, owner's box and moves are on its page, one press away.
The states (working with an owner, proposed, tabled, working with no owner, yours, done, loading, one part failed, not
found, phone) are on `Line-States.dc.html`, in `design/canvas/`. A section
with nothing in it says why in one sentence instead of showing a bare heading.

### components/entity/LinePanelItem.tsx

- Designed in: triage/T-Peek-Line.dc.html
- What it shows: the line in short. LinePanelHead, then "Also for you here" (or "For you" when nothing of it is open on For you), its pull requests, what is out of date, what happened, and Tell pinned at its foot. Its plan, its owner's box and its moves are on its own page, one press away through "Open the full page".
- Loading: the head comes from Lines at once; "For you" says Loading in place while Lines loads; its pull requests say Loading where they go.
- Error: a part that fails says so in its place with Try again; a refresh that fails marks the peek out of date and keeps it drawn.
- Empty: a part with nothing in it is left out; Tell is always there.

### components/entity/homeStatus.tsx

- Designed in: Line-States.dc.html, state G (loading) and H (one part failed)
- What it shows: until Lines has loaded once, in place of what only Lines knows (who owns a line, what it needs from you): "Loading the owner…" for a screen reader with the part's outline, or "Could not load the owner. The tracker did not answer." with Try again. Nothing once Lines is here.
- Loading: this is the loading state of the parts that use it.
- Error: this is their error state, with Try again.
- Empty: draws nothing once Lines has loaded.

### components/entity/LinePanelHead.tsx

- Designed in: triage/T-Peek-Line.dc.html; Line-States.dc.html, states A–F, J
- What it shows: crumbs (state, ref, repo), "Open the full page", Close; the title; its headline; who is on it after a dot, green while its owner runs ("web-agent is working on step 2, Payments and tax"; "No owner yet: looking for one"); why it waits when tabled, a proposal's recommendation; then "Done when" in an Inset, its label small and uppercase over its sentence. No moves: they are on the line's own page.
- Changes from today:
  - Crumbs read "Up next · L-3 · acme/hydra": the state, no position (the number on its home row already shows that) (today "Up next · Line 3 of 10 · L-3 · hydra"); owned lines add "yours" (E); the repo is its GitHub name.
  - Close is a cross with no key hint (Esc is in the Keys sheet), on every width; "Open the full page" before it leads to the line's own page.
  - Opened from another peek (triage/T-Peek-Stack): the way back is named by what that one is, "[back] Speaker enclosure", and the one under it shows as an edge to its left; Esc and the way back go one step back, Close shuts the peek.
  - Proposed (B): "Proposed by video-agent, 2d ago · L-59 · VIDEO", then "Recommended: start it." with its reason; its moves are on its page.
  - Tabled (C): "Waits for", "Look again" and "Held: 1 question, 2 tasks, released when it starts" at the top.
  - Done (F): "Done · closed Tue 14:02 · L-19". Who closed it is not drawn: the tracker does not record it on the line.
  - "Done when" is a small grey label stacked over its sentence at body size, not a one-row two-column table.
- Loading: never loads on its own: the head comes from Lines at once (G).
- Error: cannot fail on its own: it only draws what it is given.
- Empty: no done when: the pair is left out.

### components/entity/LineActions.tsx

- Designed in: triage/T-Line.dc.html; Line-States.dc.html, states A, B, C, D, J
- What it shows: the moves the line's state allows, the main one first, rarer ones under "More [caret]".
- Changes from today:
  - Working (A): Done, Move to up next, Table, More (Done is first; today it is last).
  - Proposed (B): Start, Up next, Table, "Fold into…", Not a line.
  - Up next: Start, Table, More, with nothing explaining them beside them.
  - Working with no owner (D): Try now, I'll own it, Table it.
  - Phone (J): the More button is "[more]".
- Loading: never loads on its own: given the line by the line's page. A move that is waiting holds in the Undo bar until it takes effect.
- Error: each move it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss; a move refused when it takes effect reads "Did not happen: moving L-24 to up next. It changed meanwhile. Look again."
- Empty: done or dropped lines offer Start, Up next and Table, like any line not being worked on; the head says how it closed (F).

### components/entity/SummaryBox.tsx

- Designed in: triage/T-Line.dc.html; Line-States.dc.html, state A
- What it shows: "Summary" and when it was written ("2h ago"); who wrote it is not drawn, as the tracker does not record it, the headline in bold, then the summary.
- Changes from today: the aside names the writer and a relative age instead of "at HH:MM" (which today is UTC); the empty state is a sentence.
- Loading: never loads on its own: it comes with the line's head.
- Error: cannot fail on its own.
- Empty: "No summary yet. Its owner writes one once the line starts."

### components/entity/PanelForYou.tsx

- Designed in: Line-States.dc.html, state A
- What it shows: "For you" with its count, then each item as a row ("Question · D-91 / Cut production UK over this week or wait for the IAM clean-up? [forward]"); a pressed row opens in place.
- Changes from today: none drawn beyond the closed row; the opened item follows Question and Items.
- Loading: while Lines loads, follows the Primitives pattern: "Loading…" under "For you", instead of hiding the section.
- Error: if Lines fails to load, follows the Primitives pattern: "Could not load what needs you. The tracker did not answer." with Try again. Each item's own failures are its own (Question-States E).
- Empty: nothing for you: the section is left out.

### components/entity/PlanList.tsx

- Designed in: triage/T-Line.dc.html, the Plan; Line-States.dc.html, states G, H, J
- What it shows: "Plan" with, beside it, "Done when: …" on the line's own page, with "step 2 of 4 · 2 branches open" at its foot beside Edit the plan; then the critical path as PlanStepItems on the plan's own sheet with no box round them, each branch hanging from the step it forks from (D15), the work on no step under "Not on a step yet", and "Edit the plan" at the foot, which opens PlanEditSheet.
- Changes from today:
  - Not scoped: the aside reads "not scoped yet · 4 issues already on it", and the unplaced work sits under "Not on a step yet".
  - Pull requests are listed with their check: "#405 merged · [check]".
  - Phone (J): an issue reads "Build the worker's ECS image in the pull request / KECS-1 · to do"; several merged PRs fold to "4 pull requests merged [check]".
  - Branches: the count of open ones joins the aside; an issue whose step is gone shows under "Not on a step yet".
- Loading: outlines of the rows in place of the list, under its heading (G); "Loading the plan…" for screen readers only.
- Error: "Could not load the plan. The tracker did not answer." with Try again (H); the plan last loaded stays drawn below it under "As it was at 14:20".
- Empty: with no steps and no issues, follows the Primitives pattern: "No plan yet" in one sentence saying who writes it (the design's empty sections say why, as Summary does).
- Setting a step: on a line that has not ended, each step ends in its StepStatusMenu and each branch in its BranchMenu, and only "now" is said beside the current step's title; the current step of each sequence is the one under way, else the first not done. On a done or dropped line nothing has a menu, and each step says done, now or next.

### components/entity/PlanStepItem.tsx

- Designed in: triage/T-Line.dc.html, the Plan
- What it shows: a Step: its round mark, which is its StepStatusMenu (filled with a check done, an accent ring now, a faint ring next), "2 · Restructure the plan", "now" in the accent, what it waits on after [joins] in the warm tone ("waits on 2a", "waits on L-12, tabled"); the step now on a tint of the accent; the issues on it; then each branch forking from it.
- Loading: never loads on its own: drawn from the plan PlanList has.
- Error: a status refused is said under its menu ("Not changed: Step 3 waits on 2a, Order the breakout"), until the next try.
- Empty: a step with no issues and no branches is its row alone.

### components/entity/PlanBranchItem.tsx

- Designed in: triage/T-Line.dc.html, the Plan; Plan-Tree.dc.html, A and D
- What it shows: a StepBranch on an elbow under its step: "2a · Order the USB-C breakout · open · holds up step 3" (or "holds nothing up", or "done"), "1 of 2 done", its BranchMenu at the end; then its own steps, each a smaller PlanStepItem with the branch's own now. A branch that became a line reads "2b · Wall bracket · became L-12, up next · holds up step 4", L-12 a link to it, with a BranchMenu offering only what it holds up and Remove; one whose line was dropped reads "ended" and has no menu.
- Loading: never loads on its own.
- Error: a change refused is said under its More ("Not changed: …"), until the next try.
- Empty: never empty: a branch is made with at least one step.

### components/entity/BranchMenu.tsx

- Designed in: Plan-Tree.dc.html, A
- What it shows: the three-dot More; opened, "Holds up" with each later step of its sequence and "Nothing", the one in force ticked; then "Rename or change its steps…", "Make it its own line…", "Remove the branch".
- Picking: what it holds up changes at once; Remove waits with Undo, as a line's moves do; the other two open their sheets.
- Loading: none of its own; the button reads "Changing…" while a change is on its way.
- Error: "Not changed: …" under the button, with the tracker's words, until the next try.
- Empty: a branch off the last step has no later step to hold up: "Holds up" lists only Nothing. A branch that became a line offers only "Holds up" and "Remove the branch", whose Undo bar says the line stays ("Removing branch 3a; L-12 stays a line of its own").

### components/lines/LinePrs.tsx

- Designed in: none yet; drawn from Primitives.dc.html, Row, as a list of rows like the plan's work.
- What it shows: a line's pull requests still open, one row each, in the order the server gives: those an agent said are ready to merge first, named "Ready to merge" in the colour for what needs you, with who said so ("by panel-widgets") and why as the note ("Printed and fits; checks pass."); then open ones ("Pull request") and drafts ("Draft"). Facts: owner/repo#number, a link out to GitHub where it is merged; its checks; its review ("approved", "review requested", "changes requested" in the warm tone); "pushed to since" in the warm tone when a commit came after it was said ready. Merged and closed ones are left to the plan's work. On a line's page it is the Pull requests section, after the plan; in its peek, the same section after what else is for you there.
- Changes from today: new; before, a line's pull requests showed only as facts under the plan's issues, and merging one was filed as a task.
- Loading: never loads on its own: home has it with the line; in the panel it comes with the plan, which says Loading and Could not load for both.
- Error: cannot fail on its own.
- Empty: draws nothing: no section, no rows.

### components/lines/PrChecks.tsx

- Designed in: Line-States.dc.html, state A (the checks in WorkList's facts).
- What it shows: a pull request's checks: "checks failing" after a cross in the warm tone, a check when they pass, "checks running", nothing when none ran.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: checks never run draw nothing.

### components/entity/WorkList.tsx

- Designed in: Line-States.dc.html, states A and J
- What it shows: WorkList, the issues on one step, each with its ref, its state in words and its pull requests ("#418 open · [cross] checks failing"); on a phone several merged ones fold to "4 pull requests merged [check]".
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: not drawn for a step with no issues.

### components/entity/StepStatusMenu.tsx

- Designed in: triage/T-Line.dc.html, the Plan
- What it shows: the step's round mark is the menu's button, with no frame, words or caret; opened, "To do", "Under way" and "Done" with [check] beside the one in force. Its name says the step and its status: "Step 2a.1, Pick a board: to do".
- Picking: a different status is sent at once (no Undo, as picking the old one again puts it back); the mark cannot be pressed while it is on its way.
- Loading: none of its own; it is drawn with its plan, which has loaded.
- Error: "Not changed: …" under the button, with the tracker's words, until the next try.
- Empty: none; a plan with no steps draws no menu.
- Who: the developer, from the step's mark on the line's page; an agent on the line uses `octo plan step <LINE> <step> <todo|doing|done>`.

### components/entity/SinceSummary.tsx

- Designed in: triage/T-Line.dc.html; Line-States.dc.html, state A
- What it shows: "New since the summary" with its count (or "What happened" when there is no summary), "This line in the log [arrow]", the unseen events with their time, then "Show the 5 you have seen".
- Changes from today: the heading "So far" becomes "What happened"; each event has its time in the lead ("14:20"); the seen ones are a pressable "Show the 7 you have seen".
- Loading: follows Line-States G: "Loading what happened…".
- Error: follows Line-States H: "Could not load what happened. The tracker did not answer." with Try again; earlier events kept, marked "as of 14:20".
- Empty: "Nothing you have not seen. Show the 7 you have seen"; with no events at all, follows the Primitives pattern: one sentence saying nothing has happened yet.

### components/entity/OwnerBox.tsx

- Designed in: triage/T-Line.dc.html; Line-States.dc.html, states A, D, E
- What it shows: "Owner", the owner with its state and whether it waits on you ("worker-agent · asleep · waits on you"), then "Stop worker-agent" and "I'll own it".
- Changes from today: shown on up-next lines too, saying "None until it starts. An idle agent in acme/hydra may scope it meanwhile."; with no owner on a working line the step-in moves to the head (D); when yours, "Hand to an agent" sits with the add box (E).
- Loading: while Lines loads, follows the Primitives pattern: "Loading…" under "Owner", never "no owner".
- Error: Stop and I'll own it wait with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss. While Lines loads, the box says so instead of naming no owner. Handing to an agent with no repo picked follows the Primitives disabled rule: Hand over off, and why beside it.
- Empty: no owner yet: "None until it starts." with who may scope it.

### components/entity/OwnWorkBox.tsx

- Designed in: Line-States.dc.html, state E
- What it shows: "Add a task or a note", one box, then "Add as a task", "Add as a note" and "Hand to an agent".
- Changes from today: "Hand to an agent" sits here, beside the add buttons, and gives the line back to the agents: one with a checkout of its repo takes it as for any started line, and with no repo named it first asks which; tasks and notes stay; while sending, the button shows its busy word (Primitives Button).
- Loading: the draft loads from the tracker; follows the Primitives pattern: the box stays usable and is not cleared when the draft arrives.
- Error: a draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back." under the box. Adding it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss; the words stay in the draft until it takes effect.
- Empty: both add buttons are off while the box is empty.

### components/entity/TellBox.tsx

- Designed in: Line-States.dc.html, state A; Panels.dc.html, state A
- What it shows: "Tell worker-agent" (or "Tell whoever takes L-57"), the box with placeholder "Leave it empty to nudge", then Nudge (or Tell once there are words).
- Changes from today: the heading is a visible label and the placeholder explains the empty nudge; today the box has no placeholder.
- Loading: the draft loads from the tracker; follows the Primitives pattern: the box stays usable.
- Error: a draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back." Sending it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss; the words stay in the draft until it takes effect.
- Empty: the button reads Nudge.

### components/lines/LinePage.tsx

- Designed in: triage/T-Line.dc.html
- What it shows: "Lines / Working on, 1"; the title at 32, its headline, its facts; its moves at the right; then on a lifted sheet done when, what is out of date, the plan, pull requests, the owner and Tell; beside it For you here, the summary and what is new since it. On a phone (triage/T-Line-Phone) one column, For you here, the summary and what is new before the plan; its moves stay under its title rather than at the foot, where a long plan would push them out of reach; and the bar stays over it rather than giving way to a "[back] Lines" header, since the bar is how every page reaches For you and New line, and the crumbs already lead back to Lines.
- Changes from today: new: a line had only its panel; the panel is now a peek with "Open the full page".
- Loading: a line Lines already knows draws at once; else "Loading L-1".
- Error: could not load, with Try again; a ref that is no line: "No line L-404", why, and a search of the Log for it.
- Empty: a line with no plan says so in the plan, as the panel does.

### components/lines/LineForYouHere.tsx

- Designed in: triage/T-Line.dc.html
- What it shows: "FOR YOU HERE", a tile per item (where, title, one more fact), each opening on For you at that item.
- Changes from today: new.
- Loading: drawn once Lines has loaded.
- Error: cannot fail on its own.
- Empty: nothing for you on the line: not drawn.

### components/entity/LineFacts.tsx

- Designed in: triage/T-Line.dc.html
- What it shows: "Working on · L-1 · MEALS", or "Proposed by video-agent, 2d ago", or "Done · closed 14:20"; "yours" on a line the developer owns.
- Changes from today: split out of LinePanelHead, so the peek and the page say it the same way.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty: a line always has a state and a ref.

### components/entity/LineStanding.tsx

- Designed in: triage/T-Line.dc.html; Line-States.dc.html, states A–F
- What it shows: tabled, why it waits and when to look again; the branch it grew from; "Done when" over its sentence, unless the page says it elsewhere (beside the plan on the line's page, in an Inset in its peek); a proposal's recommendation.
- Changes from today: split out of LinePanelHead.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: a line with nothing but its done when shows only that.

### components/entity/LineMoves.tsx

- Designed in: Line-States.dc.html, states A–F; triage/T-Line.dc.html
- What it shows: Step in with its reason and the fix that fits; else the moves by state (Done, Move to up next, Table, More); Start opens the Start sheet on a line that waited.
- Changes from today: split out of LinePanelItem; the moves are on the line's page alone since the peek became the line in short (D18).
- Loading: the moves show their busy state while a choice waits with Undo.
- Error: a move that fails is said in the Undo bar.
- Empty: a closed line has no moves.

### components/entity/LinePlan.tsx

- Designed in: Plan-Tree.dc.html; triage/T-Line.dc.html
- What it shows: the plan as a tree, with Change and Make it its own line as sheets.
- Changes from today: split out of LinePanelItem.
- Loading: "Loading the plan", in place.
- Error: could not load the plan, with Try again; out of date after a failed refresh.
- Empty: a line with no plan: "No plan yet".

### components/entity/LineSince.tsx

- Designed in: triage/T-Line.dc.html
- What it shows: what happened since the summary, and the line in the Log.
- Changes from today: split out of LinePanelItem.
- Loading: "Loading what happened", in place.
- Error: could not load, with Try again.
- Empty: "Nothing you have not seen."

### components/entity/LineTell.tsx

- Designed in: triage/T-Line.dc.html; Line-States.dc.html, state E
- What it shows: Tell its owner on a working line; on a line the developer owns, add a task or a note.
- Changes from today: split out of LinePanelItem.
- Loading: a message on its way shows the box's busy state.
- Error: a draft the server could not keep says so until a save works.
- Empty: a closed line, or one waiting, has no Tell.
