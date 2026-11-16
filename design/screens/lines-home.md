# Lines (home)

The home screen: every line in the developer's order, with what each needs from them in place. Designed on
`Home-FirstRun.dc.html` (nothing placed yet), `Home.dc.html` (in daily use) and `Home-States.dc.html` (states A to I:
empty tracker, nothing needs you, at a place, first load, tracker not answering, lost connection, new version, a move
failed, phone), with the question opened under its line on `Main.dc.html`, in the canvas at
https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU.

### components/home/HomePage.tsx

- Designed in: Home-FirstRun.dc.html; Home.dc.html; Home-States.dc.html, states A–I; Main.dc.html
- What it shows: Urgent, Working on, Up next, Proposed, then the Tabled and Done lately folds; at a place, that place's banner first. On first run the proposals grouped by what their agents recommend.
- Changes from today:
  - First run (Home-FirstRun) groups proposals under "Recommended to start", "Recommended for up next", "Recommended to table", "Recommended to fold into another" and "No recommendation", each with a line saying what that placement means; the first group is open with "Show 6 more", the rest are folded with "Show" and a sample ("Includes Put the Telegram CLI on a safe footing, and 25 more.").
  - Failures of moves are said beside the line that moved (H), not at the top of the page.
  - Phone (I): lines from the third on fold to one row each, and Up next folds to "Up next 3 · Finish removing the H1 switch and 2 more".
- Loading: first load (D): the bar at once, rows drawn as outlines, "Working on" with "Loading your lines…".
- Error: the tracker not answering on first load (E): "The tracker is not answering / Nothing answered at 127.0.0.1:4747. Any octo command starts it again; this page tries again every 30 seconds." with the command `octo server status` and Try now. After loading, a lost connection is AppShell's strip (F); a failed move is said next to the line (H).
- Empty: no lines and no proposals (A) is FirstRun's empty state; nothing waiting is NothingNeedsYou (B).

### components/home/FirstRun.tsx

- Designed in: Home-FirstRun.dc.html; Home-States.dc.html, state A
- What it shows: "Nothing is placed yet", then "Your agents proposed 67 lines. 51 carry a recommendation: 10 to start, 26 for up next, 14 to table and 1 to fold. 16 have none." and the primary "Accept 51 recommendations".
- Changes from today: a heading and a paragraph that break the count down by placement replace the row "Nothing placed yet" with facts "51 of 67 proposed carry a recommendation"; the button names the count ("Accept 51 recommendations", today "Accept recommended placements").
- Loading: never loads on its own: given the proposals by HomePage.
- Error: Accept waits with Undo; a request that fails follows the Primitives pattern: said under the button, with Try again. Refusals at effect time go to the Undo bar.
- Empty: no proposals (A): "No lines yet / Add one with New line, or point an agent at the guide: it proposes lines for its repo, and they arrive here to place." with `octo guide` and a New line button.

### components/home/NothingNeedsYou.tsx

- Designed in: Home-States.dc.html, state B
- What it shows: "Nothing needs you" then "2 agents working · the next ask likely comes from Mac mini keeps enough free disk, step 2"; the lines follow as usual and the bar shows no counts.
- Changes from today: "next ask likely on {title}" becomes "the next ask likely comes from {title}, {step}".
- Loading: never loads on its own: given the counts by HomePage.
- Error: cannot fail on its own.
- Empty: it is itself the empty state for "nothing waiting"; with no line working the second fact is left out.

### components/home/NotAnswering.tsx

- Designed in: Home-States.dc.html, state E
- What it shows: "The tracker is not answering", "Nothing answered at 127.0.0.1:4747. Any octo command starts it again.", the command `octo server status`, and Try now.
- Changes from today: new; a first load that failed showed the raw error.
- Loading: never loads on its own: Try now asks again.
- Error: it is itself the error.
- Empty: never empty.

### components/home/AtSection.tsx

- Designed in: Home-States.dc.html, state C
- What it shows: "At home · ends by itself in 3h" and Leave.
- Changes from today: "ends in 3h" becomes "ends by itself in 3h".
- Loading: Leave shows its busy word while it runs (Primitives Button: "Leaving…").
- Error: a failed Leave follows the Primitives pattern: said under the banner, with Try again (today it shows at the top of the page).
- Empty: never empty: shown only while at a place.

### components/home/AtPlaceItems.tsx

- Designed in: Home-States.dc.html, state C
- What it shows: under each line at a place, that place's tasks open ("Task · TRIP-2 · at home / Call Hotel Jasmin about a third bed"), then the rest folded to one line.
- Changes from today: none beyond FoldedItems' words.
- Loading: never loads on its own: given its items by WorkingSection.
- Error: cannot fail on its own; each task's failures are its own.
- Empty: a line with nothing at the place shows only FoldedItems' line; with no items at all nothing is drawn (today an empty box).

### components/home/FoldedItems.tsx

- Designed in: Home-States.dc.html, state C
- What it shows: one quiet line: "Also on this line: 1 question".
- Changes from today: prefixed "Also on this line:" (today the bare counts "1 question").
- Loading: never loads on its own: given the items by AtPlaceItems.
- Error: cannot fail on its own.
- Empty: nothing folded renders nothing.

### components/home/AtUpNext.tsx

- Designed in: More-States.dc.html, state A
- What it shows: at a place, that place's tasks whose lines are up next, each under its line's number and title, open with its choices.
- Changes from today: none drawn; follows state C's task rows and the Primitives pattern.
- Loading: never loads on its own: given its tasks by HomePage.
- Error: cannot fail on its own; each task's failures are its own.
- Empty: no such tasks renders nothing.

### components/home/QuestionList.tsx

- Designed in: Home.dc.html (Urgent); Question-States.dc.html, state B; More-States.dc.html, state C (On no line)
- What it shows: "Urgent" with its count, first on the page, each question a row; the focused one opens in place.
- Changes from today: the urgent row names the line it is on ("Something broken · on 1 · The home worker fetches new videos again · D-75"). "On no line" is not drawn; it follows the same rows.
- Loading: never loads on its own: given its questions by HomePage.
- Error: cannot fail on its own; each question's failures are its own (Question-States E).
- Empty: no questions renders nothing.

### components/home/WorkingSection.tsx

- Designed in: Home.dc.html; Home-States.dc.html, states C, D, I
- What it shows: "Working on 3", then each line, with no caption under the heading.
- Changes from today: the aside explains the order; on a phone lines from the third on fold to one row each ("3 · Mac mini keeps enough free disk · agents on it").
- Loading: on first load the rows are outlines under "Working on" (D).
- Error: cannot fail on its own; a failed move is said beside the line (H).
- Empty: follows the Primitives pattern: one line saying nothing is being worked on.

### components/home/SpreadThin.tsx

- Designed in: More-States.dc.html, state B
- What it shows: in the "Working on" head, with more than six lines working: "{n} with no owner", "{n} waiting on you".
- Changes from today: none drawn.
- Loading: never loads on its own: given counts by WorkingSection.
- Error: cannot fail on its own.
- Empty: renders nothing unless lines are spread thin.

### components/home/WorkingLine.tsx

- Designed in: Home.dc.html; Main.dc.html; Home-States.dc.html, states C, H, I
- What it shows: the line's number, title, its facts, the headline as a note, verbatim as its owner wrote it with the summary (`line.summarize`), so it never refers to the page ("Docker disk capped at 60 GB; 41 GB free after the last deploy."), then what it needs from you.
- Changes from today: a failed move is said under the line: "Not moved. The tracker did not answer; it is back where it was." (H); the "N changes since" link is not drawn.
- Loading: never loads on its own: given its line by WorkingSection.
- Error: a move that fails (H), as above.
- Empty: no headline: the note is left out.

### components/home/LineHandle.tsx

- Designed in: Home.dc.html; Home-States.dc.html, state H; Primitives.dc.html, Row
- What it shows: a six-dot grip in quiet grey beside the line's number, the two one button ("Move The home worker fetches new videos again") on every Working on and Up next row; it drags, and pressed it opens Move to top, Up, Down, To up next.
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

### components/home/LineForYou.tsx

- Designed in: Main.dc.html; Home.dc.html (line 2); Home-States.dc.html, state I
- What it shows: the first thing waiting on you under the line, then "1 more for you: a task at home".
- Changes from today: on a phone the line's first item stays as a short row ("Question · Which South Tyrol base?") instead of folding to "{N} for you".
- Loading: never loads on its own: given its items by WorkingSection.
- Error: cannot fail on its own.
- Empty: nothing for you renders nothing.

### components/home/LineForYouItem.tsx

- Designed in: Main.dc.html; Question-States.dc.html, state A
- What it shows: a row that opens in place while it has focus (Main: the question opened under its line, ringed).
- Changes from today: the focused item is edged with the grey focus edge and its halo (Primitives Row) rather than only tinted.
- Loading: never loads on its own: given its item by LineForYou.
- Error: cannot fail on its own; the opened item's failures are its own.
- Empty: never empty: it exists only for an item.

### components/home/MoreForYou.tsx

- Designed in: Main.dc.html; Home.dc.html (line 2)
- What it shows: "1 more for you: a task at home".
- Changes from today: "1 more: a task at home" becomes "1 more for you: a task at home".
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: nothing more renders nothing.

### components/home/LineStepIn.tsx

- Designed in: Items.dc.html, state G; Line-States.dc.html, state D; More-States.dc.html, state J (folded at a place)
- What it shows: on a line nobody can take, StepIn's sentence and its action; at a place, folded to one row with the short reason.
- Changes from today: as StepIn; folded at a place it is one row, "▲ Step in · {short reason}", that opens it in place (More-States J).
- Loading: never loads on its own: given the line by WorkingSection.
- Error: cannot fail on its own; StepIn's actions report their own failures.
- Empty: renders nothing when the line needs no step-in.

### components/home/WaitingSections.tsx

- Designed in: Home.dc.html; Home-FirstRun.dc.html; Home-States.dc.html, states C, I
- What it shows: "Up next 3"; "Proposed 2" in ink like every section heading, each proposal's advice as "Recommends Start: …" in ink; then the folds "Tabled 4 · Labyrinth level editor, Matter binding backend and 2 more · 1 question held ›" and "Done lately 1 · Fix the Dinis reminder ›", one under the other.
- Changes from today: Up next gains its explaining aside; the Tabled summary ends with what it holds ("· 1 question held", today "· N questions and N tasks held"); at a place Up next, Proposed and Tabled fold shut.
- Loading: never loads on its own: given the lines by HomePage.
- Error: cannot fail on its own.
- Empty: follows the Primitives pattern: an empty Up next says so in one line under its heading, on a phone too (today the phone shows nothing); empty Proposed, Tabled and Done lately are left out.

### components/home/UpNextRow.tsx

- Designed in: Home.dc.html; Primitives.dc.html, Row
- What it shows: "4 Finish removing the office H1 switch from Home Assistant · 2 steps scoped · 1 question held" and Start.
- Changes from today: held is said per kind present ("1 question held"); "not scoped", "1 step scoped · done when changed" as today; the "Done when" note is not drawn.
- Loading: never loads on its own.
- Error: cannot fail on its own; Start opens the Start sheet.
- Empty: never empty: it exists only for a line.

### components/home/ProposalCard.tsx

- Designed in: Home.dc.html (Proposed); Home-FirstRun.dc.html
- What it shows: the title, "L-20 · MOBS · proposed by mobs", the recommendation with its reason, then the recommended move and "Other ▾".
- Changes from today: facts are ref, repo key and who proposed it (today "{by}, {age}", repos, first step, from); the "Done when" note is not drawn; the choices are one button plus a menu.
- Loading: never loads on its own.
- Error: a move whose request fails follows the Primitives pattern: said under the card, with Try again; a refusal at effect time goes to the Undo bar.
- Empty: never empty: it exists only for a proposal.

### components/home/ProposalCase.tsx

- Designed in: Home.dc.html (Proposed); Home-FirstRun.dc.html
- What it shows: the recommendation and why in one sentence: "Start: the release is built and waits only on a play-test." On first run, under a group, only the why.
- Changes from today: "Recommended: Start · {why}" becomes "{Move}: {why}".
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: no recommendation renders nothing.

### components/home/ProposalChoices.tsx

- Designed in: Home.dc.html (Proposed); Home-FirstRun.dc.html; Line-States.dc.html, state B; More-States.dc.html, state E (the Other menu)
- What it shows: the recommended move as the one button ("Start", "Table"), then "Other ▾" holding the rest.
- Changes from today: on Lines only the recommended move is a button and the others go under "Other ▾" (today all four or five are buttons); the menu's contents are not drawn and keep today's moves. In the line panel all moves stay buttons (Line-States B).
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
- What it shows: a tabled or done line in its fold: title, the reason and when to look again; tabled ones offer Up next and Start.
- Changes from today: none drawn; follows Row.
- Loading: never loads on its own.
- Error: cannot fail on its own; Up next and Start report their own failures.
- Empty: a done line with neither reason nor date has no note line (today an empty one).
