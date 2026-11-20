# Lines (home)

Lines, at `/lines`: every line in the developer's order, each saying how much waits on them there, which they answer
on For you. Designed on `triage/T-Lines.dc.html`, with the states still drawn on `Home-FirstRun.dc.html` (nothing placed
yet) and `Home-States.dc.html` (empty tracker, first load, tracker not answering, lost connection, new version, a move
failed, phone), in the canvas at https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU.

### components/home/HomePage.tsx

- Designed in: triage/T-Lines.dc.html; Home-FirstRun.dc.html; Home-States.dc.html, states A–I
- What it shows: "Lines" and "4 working on · 2 up next · 2 proposed · 1 tabled"; Working on, each line one row with what waits there as a pill; Up next, Proposed, then the Tabled and Done lately folds. Questions and tasks are on For you, not here. On first run the proposals grouped by what their agents recommend.
- Changes from today:
  - First run (Home-FirstRun) groups proposals under "Recommended to start", "Recommended for up next", "Recommended to table", "Recommended to fold into another" and "No recommendation", each folded to a sentence: what the placement means where that says more than a sample ("Old milestones and ideas from before lines existed."), else its first title and how many more; the first group is open with "Show 6 more", the rest are folded with "Show" and a sample ("Includes Put the Telegram CLI on a safe footing, and 25 more.").
  - Failures of moves are said beside the line that moved (H), not at the top of the page.
  - A line opens on its own page; j and k move between lines, o opens one, Alt with the arrows moves it.
  - Phone (I): Up next folds to "Up next 3 · Finish removing the H1 switch and 2 more".
- Loading: first load (D): the bar at once, rows drawn as outlines, "Working on" over the outlines; "Loading your lines…" is for screen readers only.
- Error: the tracker not answering on first load (E): "The tracker is not answering / Nothing answered at 127.0.0.1:4747. Any octo command starts it again; this page tries again every 30 seconds." with the command `octo server status` and Try now. After loading, a lost connection is AppShell's strip (F); a failed move is said next to the line (H).
- Empty: no lines and no proposals (A) is FirstRun's empty state; with nothing being worked on, Working on says so.

### components/home/FirstRun.tsx

- Designed in: Home-FirstRun.dc.html; Home-States.dc.html, state A
- What it shows: "Nothing is placed yet", then "Your agents proposed 67 lines. 51 carry a recommendation: 10 to start, 26 for up next, 14 to table and 1 to fold. 16 have none. The 1 to fold waits for you to pick the line it goes into." and the primary "Accept 50 recommendations": a proposal records only that it should fold, not into which line, so a fold is placed by hand.
- Changes from today: a heading and a paragraph that break the count down by placement replace the row "Nothing placed yet" with facts "51 of 67 proposed carry a recommendation"; the button names the count ("Accept 51 recommendations", today "Accept recommended placements").
- Loading: never loads on its own: given the proposals by HomePage.
- Error: Accept it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss.
- Empty: no proposals (A): "No lines yet / Add one with New line, or point an agent at the guide: it proposes lines for its repo, and they arrive here to place." with `octo guide` and a New line button.

### components/home/NotAnswering.tsx

- Designed in: Home-States.dc.html, state E
- What it shows: "The tracker is not answering", "Nothing answered at 127.0.0.1:4747. Any octo command starts it again; this page tries again every 30 seconds.", the command `octo server status`, and Try now; it asks again by itself every 30 seconds while shown.
- Changes from today: new; a first load that failed showed the raw error.
- Loading: never loads on its own: Try now asks again.
- Error: it is itself the error.
- Empty: never empty.

### components/home/WorkingSection.tsx

- Designed in: Home.dc.html; Home-States.dc.html, states C, D, I
- What it shows: "Working on 3", then each line, with no caption under the heading.
- Changes from today: on a phone lines from the third on fold to one row each ("3 · Mac mini keeps enough free disk · agents on it").
- Loading: on first load the rows are outlines under "Working on" (D).
- Error: cannot fail on its own; a failed move is said beside the line (H).
- Empty: follows the Primitives pattern: one sentence saying nothing is being worked on.

### components/home/SpreadThin.tsx

- Designed in: More-States.dc.html, state B
- What it shows: in the "Working on" head, with more than six lines working: "{n} with no owner", "{n} waiting on you".
- Changes from today: none drawn.
- Loading: never loads on its own: given counts by WorkingSection.
- Error: cannot fail on its own.
- Empty: renders nothing unless lines are spread thin.

### components/home/WorkingLine.tsx

- Designed in: Home.dc.html; Main.dc.html; Home-States.dc.html, states C, H, I
- What it shows: the line's number, title, its facts, the headline as a note, verbatim as its owner wrote it with the summary (`line.summarize`), so it never refers to the page ("Docker disk capped at 60 GB; 41 GB free after the last deploy."), then what it needs from you. One press anywhere on the line, off its handle and its controls, opens its panel, as its title does; there is no selecting step.
- Changes from today: a failed move is said under the line: "Not moved. The tracker did not answer; it is back where it was." (H); the "N changes since" link is not drawn.
- Loading: never loads on its own: given its line by WorkingSection.
- Error: a move that fails (H), as above.
- Empty: no headline: the note is left out.

### components/home/LineHandle.tsx

- Designed in: Home.dc.html; Home-States.dc.html, state H; Primitives.dc.html, Row
- What it shows: a six-dot grip in quiet grey beside the line's number, one button ("Move The home worker fetches new videos again") on every Working on and Up next row; it drags, with a mouse, a finger or a pen, and pressed without moving it opens Move to top, Up, Down, To up next. While a line is dragged over another in its section, a rule in the accent colour runs along that line's top edge (it lands before it) or its bottom edge (after it), by which half the pointer is in; letting go moves it there. Over itself, the other section or nothing, no rule shows and letting go leaves it where it was.
- Changes from today: the grip is always drawn, so reordering can be found without hovering or knowing a key (today only a bare number with a grab cursor); a failed move is said beside the line (H).
- Loading: never loads on its own.
- Error: "Not moved. The tracker did not answer; it is back where it was." under the line that moved (H).
- Empty: never empty: every placed line has a number.

### components/home/LineMeta.tsx

- Designed in: Home.dc.html; Main.dc.html; Home-States.dc.html, state I
- What it shows: "ttube, running · waiting on you · step 1 of 3, pace the fetches", or "agents on it" when nothing waits on you.
- Changes from today: the owner is named bare ("ttube, running"), without "owner".
- Loading: never loads on its own: given the line by WorkingLine.
- Error: cannot fail on its own.
- Empty: no facts renders nothing.

### components/home/LineStepIn.tsx

- Designed in: Items.dc.html, state G; Line-States.dc.html, state D; triage/T-StepIn.dc.html
- What it shows: on a line nobody can take, StepIn's sentence and its action, on For you's card and at the head of the line.
- Changes from today: as StepIn.
- Loading: never loads on its own: given the line by For you or the line's moves.
- Error: cannot fail on its own; StepIn's actions report their own failures.
- Empty: renders nothing when the line needs no step-in.

### components/home/WaitingSections.tsx

- Designed in: Home.dc.html; Home-FirstRun.dc.html; Home-States.dc.html, states C, I
- What it shows: "Up next 3"; "Proposed 2" in ink like every section heading, each proposal's advice as "Recommends Start: …" in ink; then the folds "Tabled 4 · Labyrinth level editor, Matter binding backend and 2 more · 1 question held [forward]" and "Done lately 1 · Fix the Dinis reminder [forward]", one under the other.
- Changes from today: the Tabled summary ends with what it holds ("· 1 question held", today "· N questions and N tasks held").
- Loading: never loads on its own: given the lines by HomePage.
- Error: cannot fail on its own.
- Empty: follows the Primitives pattern: an empty Up next says so in one sentence under its heading, on a phone too (today the phone shows nothing); empty Proposed, Tabled and Done lately are left out.

### components/home/UpNextRow.tsx

- Designed in: Home.dc.html; Primitives.dc.html, Row
- What it shows: "4 Finish removing the office H1 switch from Home Assistant · 2 steps scoped · 1 question held" and Start.
- Changes from today: held is said per kind present ("1 question held"); "not scoped", "1 step scoped · done when changed" as today; the "Done when" note is not drawn.
- Loading: never loads on its own.
- Error: cannot fail on its own; Start opens the Start sheet.
- Empty: never empty: it exists only for a line.

### components/home/ProposalCard.tsx

- Designed in: Home.dc.html (Proposed); Home-FirstRun.dc.html
- What it shows: the title, "L-20 · MOBS · proposed by mobs", the recommendation with its reason, then the recommended move and "Other [caret]".
- Changes from today: facts are ref, repo key and who proposed it (today "{by}, {age}", repos, first step, from); the "Done when" note is not drawn; the choices are one button plus a menu.
- Loading: never loads on its own.
- Error: each move it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss; the pressed move says it is on its way meanwhile.
- Empty: never empty: it exists only for a proposal.

### components/home/ProposalCase.tsx

- Designed in: Home.dc.html (Proposed); Home-FirstRun.dc.html
- What it shows: the recommendation and why in one sentence: "Recommends Start: the release is built and waits only on a play-test." On first run, under a group, only the why.
- Changes from today: "Recommended: Start · {why}" becomes "Recommends Start: {why}".
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: no recommendation renders nothing.

### components/home/ProposalChoices.tsx

- Designed in: Home.dc.html (Proposed); Home-FirstRun.dc.html; Line-States.dc.html, state B; More-States.dc.html, state E (the Other menu)
- What it shows: the recommended move as the one button ("Start", "Table"), then "Other [caret]" holding the rest.
- Changes from today: on Lines only the recommended move is a button and the others go under "Other [caret]" (today all four or five are buttons); the menu's contents are not drawn and keep today's moves. In the line panel all moves stay buttons (Line-States B).
- Loading: a move waiting shows its busy word (Primitives Button).
- Error: as ProposalCard.
- Empty: never empty: a proposal can always be started.

### components/home/ProposalGroups.tsx

- Designed in: Home-FirstRun.dc.html
- What it shows: on first run, "Recommended to start 10" open with four proposals and "Show 6 more", then "Recommended for up next 26", "Recommended to table 14", "Recommended to fold into another 1" and "No recommendation 16", each folded to "Includes {a title}, and N more." with Show.
- Changes from today: new; first run listed every proposal in one section.
- Loading: never loads on its own: given the proposals by WaitingSections.
- Error: cannot fail on its own; each proposal's moves report their own failures.
- Empty: a group with no proposals is left out.

### components/home/QuietRow.tsx

- Designed in: More-States.dc.html, state D (the folds opened); Home.dc.html (closed)
- What it shows: a tabled or done line in its fold: title, the reason ("No reason given" when there is none) and when to look again; tabled ones offer Up next and Start; a done one says "[check] done Tue". Who closed it is not drawn, as the tracker does not record it on the line.
- Changes from today: none drawn; follows Row.
- Loading: never loads on its own.
- Error: cannot fail on its own; Up next and Start report their own failures.
- Empty: a done line with neither reason nor date has no note (today an empty one); it still says it is done and when.
