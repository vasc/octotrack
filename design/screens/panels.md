# Panels

Everything else opened by its ref in the side panel: an issue, a pull request, drift, a repo, and old refs from before
lines. Designed on `Panels.dc.html` (states A to F: an issue, a pull request, something out of date, a repo, from before
lines, opened from another panel), in `design/canvas/`. Every panel has
the line panel's head: a crumb that says where it sits, the title, its facts, then sections in order of
importance. Loading, a failed part and not found follow `Line-States.dc.html` states G, H and I.

### components/entity/EntityPanel.tsx

- Designed in: Panels.dc.html, states B, C, D, E, F; Line-States.dc.html, states G, H, I
- What it shows: loads the ref and draws the line panel, the issue panel, or the panel for any other kind: crumb, title, facts, then that kind's body.
- Changes from today:
  - Opened from another panel (F): "[back] Speaker enclosure", the previous peek's title (named "Back to Speaker enclosure" for a screen reader), and Close; Esc and Back go one step back, Close shuts the panel. The same in every panel kind.
  - An old ref (an idea or milestone that became a line) opens what it became; only one that became nothing shows its old fields, labelled "from before lines" (E).
  - The status moves from the crumb to the row of facts under the title (B: "Open").
- Loading: follows Line-States G: the crumb and Close at once, then "Loading…" naming what loads, never a bare panel.
- Error: follows Line-States H: "Could not load {ref}. The tracker did not answer." with Try again; a refresh that fails keeps what was shown, marked "as of 14:20" (today "Out of date: {message}"). Not found follows Line-States I: "No {kind} {ref}" with why it may be gone, "Search the log for {ref}" and Close (today "Nothing found for {ref}").
- Empty: never empty: every item has a title; empty sections are left out or say why in one sentence.

### components/entity/EntityCrumbs.tsx

- Designed in: Panels.dc.html, states B, C, D, E
- What it shows: where the item sits, in words: "PR-1 · STACK", "DR-55 · out of date · on INFRA · since 7 Nov", "PANEL · repo", "I-7 · idea, from before lines".
- Changes from today: the raw kind badge ("pr", "drift") becomes words, and the project key joins it; the status leaves the crumb for the row of facts under the title.
- Loading: never loads on its own: drawn once EntityPanel has the item.
- Error: cannot fail on its own.
- Empty: never empty: every item has a ref.

### components/entity/EntityBody.tsx

- Designed in: Panels.dc.html, states B, C, D, E
- What it shows: the part that differs by kind: a pull request (B), drift with its note and answers (C), a repo's GitHub name, checkout here and its lines (D), an old idea or milestone and what it became (E); an update's body.
- Changes from today:
  - Drift opened by its own ref can be answered here: "Note · required: what changed, or why nothing had to", Updated and Nothing to update (today no controls).
  - A repo shows "GitHub", "Checkout" ("none on this machine") and "Lines" (its lines, each with its state) instead of Repo, Horizon and Target.
  - An old idea says what it became: "Became L-6 test devices via TestFlight. Opening I-7 opens L-6."
- Loading: never loads on its own: given the item by EntityPanel.
- Error: cannot fail on its own; drift answers report as DriftItem does.
- Empty: a field with no value is left out; an empty body is left out.

### components/entity/IssuePanel.tsx

- Designed in: Panels.dc.html, state A; Items.dc.html, states A, B, D (a task opened by its ref)
- What it shows: the crumb "L-57 Wall mount for the 4-inch square [forward] PANEL-4", the title, "Blocked · nobody holds it · acme/homepanel", the body, a note when it waits on you, Pull requests, Activity, then "Tell whoever takes L-57". A task shows TaskCard or TaskClosed instead.
- Changes from today:
  - The status is a word in the row of facts ("Blocked"), not after "Issue".
  - The crumb uses [forward], and the repo is its GitHub name.
- Loading: follows Line-States G: crumb and title at once; Pull requests says "Loading pull requests…". While Lines loads, the line crumb and Tell's recipient follow the Primitives pattern instead of silently changing.
- Error: follows Line-States H per part, with Try again. A failed Tell, Done or Can't is said where it was made (TellBox, TaskCard); today it is not shown here.
- Empty: no pull requests: "None yet."; no activity: the section is left out; no line: no Tell.

### components/entity/TaskFrees.tsx

- Designed in: More-States.dc.html, state I; Items.dc.html, state A (the one row on the task)
- What it shows: what the task frees, in the task: "Frees PANEL-4 Print the wall mount".
- Changes from today: a "What it frees" section in the task's panel (More-States I), and one row in the task card (Items A); who holds the freed issue is not drawn.
- Loading: never loads on its own: given the linked issues by IssuePanel.
- Error: cannot fail on its own.
- Empty: frees nothing: renders nothing.

### components/entity/PullRequestBox.tsx

- Designed in: Panels.dc.html, state A; Line-States.dc.html, state A (a pull request under its issue)
- What it shows: "Pull requests", then each: its number, state and checks ("#418 open · [cross] checks failing").
- Changes from today: each pull request is one row of number, state and checks; size and age are not drawn.
- Loading: "Loading pull requests…" under the heading.
- Error: follows Line-States H: "Could not load the pull requests. The tracker did not answer." with Try again; earlier ones kept, marked "as of 14:20".
- Empty: "None yet."

### components/entity/PrPanel.tsx

- Designed in: Panels.dc.html, state B
- What it shows: "Open · acme/stack#4 [out] · by dana · 9 days · +33 −2"; then its facts, a conflict first among them ("Merge [triangle] conflicts with main; feat/draft-prs needs a rebase", the warm mark, no box and no red), then Checks, Review, Branch and Synced; then the body.
- Changes from today:
  - State, link, author, age and size move into one row of facts; the external link carries [out].
  - What needs attention comes first among its facts, in words: a conflict is the Merge fact with the warm mark, no box and no red.
  - Checks and Review read "none run" and "none asked" (today "none"); Mergeable is said by the Merge fact instead of its own pair; Synced reads "2 min ago".
  - The size uses the same minus as everywhere ("−").
- Loading: never loads on its own: given the pull request by EntityBody.
- Error: when sync has stopped for its repo, Synced says so in place: "stale since 14:20: gh is not logged in".
- Empty: nothing needing attention: the Merge fact is left out; an empty body is left out.

### components/entity/EventList.tsx

- Designed in: Panels.dc.html, state A
- What it shows: "Activity 3", then one row each as the Log draws a change: the time in the lead ("14:20", "Sun 20:59", "7 Nov"), the sentence, then who did it.
- Changes from today: the time leads the row as in the Log, and the row is the Log's own. Who did it stays after the sentence rather than in it: the tracker writes each event as a whole sentence ("OCT-2 created: Base"), so a name cannot be put in front of it.
- Loading: never loads on its own: given the history by its panel.
- Error: cannot fail on its own.
- Empty: no events: the section is left out.

### components/entity/LinkList.tsx

- Designed in: More-States.dc.html, state G
- What it shows: "Connections": each linked item's title, how it relates ("blocks", "blocked by"), its ref and state.
- Changes from today: none drawn; follows Row and the Primitives status rule (a glyph and a word).
- Loading: never loads on its own: given the links by EntityPanel.
- Error: cannot fail on its own.
- Empty: no links: the section is left out.

### components/entity/UpdatesSection.tsx

- Designed in: More-States.dc.html, state H
- What it shows: "Updates" with its count, a box "Post an update", Post, then the updates with level, who and when.
- Changes from today: none drawn. Following the panel rule that an empty section says why in one sentence, an empty list says so instead of "Updates 0".
- Loading: the draft loads from the tracker; the box stays usable.
- Error: a draft not saved: "Not saved: the tracker did not answer. Kept here; saves when it is back." Posting it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss; the words stay in the draft until it takes effect.
- Empty: one sentence saying there are no updates yet, with the box under it.

### components/entity/OpenDrift.tsx

- Designed in: Panels.dc.html, state C
- What it shows: "Out of date" with its count, then each open drift as DriftItem.
- Changes from today: none in its own words.
- Loading: never loads on its own: given the drift by its panel.
- Error: each answer it waits with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss; the note stays in its box.
- Empty: no open drift: the section is left out.

### components/drift/DriftItem.tsx

- Designed in: Panels.dc.html, state C
- What it shows: "DR-55 · out of date · on INFRA · since 7 Nov", "Check INFRA still describes reality", what changed ("D-20 was answered “Uninstall it” on … Does INFRA's description still hold?"), "Note · required: what changed, or why nothing had to", then Updated and Nothing to update.
- Changes from today: a sentence title saying what to check (today the rule's name, "issue closed pr open"); the note field is labelled as required and what to write; while an answer waits with Undo, the pressed button shows its busy word until it takes effect, as Agents A does for Stop (today both stay live and can send twice).
- Loading: the buttons show their busy word while sending (Primitives Button).
- Error: as DriftAnswer.
- Empty: Updated and Nothing to update are disabled until the note has words, both in the one disabled look every button shares.

### components/drift/DriftAnswer.tsx

- Designed in: Panels.dc.html, state C
- What it shows: what to check, "Note · required: what changed, or why nothing had to", then Updated (primary, only where updating can be true) and Nothing to update; once cleared, the note it was cleared with and who cleared it.
- Changes from today: new; split from DriftItem so that drift opened by its own ref answers with the same controls.
- Loading: the buttons stay off while an answer waits with Undo.
- Error: a failed answer is said by the Undo bar; the note is kept.
- Empty: both answers are off until the note has words, in the one disabled look.

### components/entity/DriftBody.tsx

- Designed in: Panels.dc.html, state C
- What it shows: drift opened by its own ref: what changed ("D-20 was answered “Uninstall it” on …"), then DriftAnswer.
- Changes from today: new; drift opened by its own ref showed its rule and fields with no way to answer.
- Loading: never loads on its own: given the drift by EntityPanel.
- Error: as DriftAnswer.
- Empty: never empty: it exists only for a drift.

### components/entity/RefNotFound.tsx

- Designed in: Line-States.dc.html, state I
- What it shows: in a panel titled "No line L-312": "No line was ever made with that ref; check it for a typo. Lines that were done, dropped or folded still open at their ref." and "Search the log for L-312 [arrow]"; other kinds say "No question D-9" and the same in their own word.
- Changes from today: new; a ref nothing answered to was "Could not load L-312" with Try again.
- Loading: never loads on its own: EntityPanel draws it once the tracker says the ref names nothing.
- Error: it is the not-found state.
- Empty: never empty: it always names the ref.
