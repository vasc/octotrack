# Log

What the developer has not seen, line by line, and with a search the whole log. Designed on `Log.dc.html` (the unseen
log, then states A to G: searching, a search not understood, completions, nothing to show, loading and failed, pull
request status stale, rule breaks), in the canvas at https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU.

### components/feed/FeedPage.tsx

- Designed in: Log.dc.html, the board and states A–G
- What it shows: "Log" with "what you have not seen, line by line" under it; the search box and "Mark all seen"; stale pull request status; then the unseen log or the search results.
- Changes from today: a subtitle says what the page shows; the search placeholder is an example query ("Search: line:L-56 since:2d actor:ttube", today "Search").
- Loading: as FeedSection.
- Error: a failed "Mark all seen" follows the Primitives pattern: said under the button, with Try again (today not shown); a refusal at effect time goes to the Undo bar.
- Empty: as UnseenLog and FeedSection.

### components/feed/FilterBox.tsx

- Designed in: Log.dc.html, states A, B, C
- What it shows: the search box with completions from the tracker's fields and values.
- Changes from today: as FilterBar.
- Loading: completions for names (actors, projects) arrive once loaded; until then the field names still complete, as today.
- Error: as FilterBar.
- Empty: as FilterBar.

### components/feed/FilterBar.tsx

- Designed in: Log.dc.html, states B, C; Primitives.dc.html, Field
- What it shows: the box, then completions while typing a field, each a term and what it means ("actor: who did it", "assignee: who holds it", "since: on or after a time: 2h, 7d").
- Changes from today:
  - A search not understood is said in plain words under the box with what to type, and the last results stay: "“yesterday” is not a time. Use 2h, 7d or a date like 2026-11-15." (today "… at position {n} in: {input}").
  - Hints are short ("who did it", today "Who caused an event").
  - The invalid box is marked (Primitives Field invalid).
- Loading: never loads on its own: given its completions by FilterBox.
- Error: the message under the box, as above; the last good results stay below.
- Empty: no completions: no list.

### components/feed/FeedSection.tsx

- Designed in: Log.dc.html, states A, D, E
- What it shows: the unseen log, or search results by day, then Older.
- Changes from today: while a search scans back it says how far: "Nothing in the last 500 events yet; searching older ones…".
- Loading: "Loading the log…"; scanning further back: "Nothing in the last 500 events yet; searching older ones…".
- Error: "Could not load the log. The tracker did not answer." with Try again; a later page that fails is said under the rows already shown, with Try again in place of Older.
- Empty: "Nothing matches this search / Searched the whole log. Try fewer words, or a longer since:."

### components/feed/UnseenLog.tsx

- Designed in: Log.dc.html, the board and states D, G
- What it shows: "Rule breaks" first, never folded; then each line with unseen changes; then "On no line" (changes to things that belong to no line) and "Elsewhere" (changes on lines not listed); then "Up next and tabled lines are left out." with Include them.
- Changes from today: "Up next and tabled: {n} more" with Show becomes "Up next and tabled lines are left out." with "Include them", and is not shown when there is nothing to include.
- Loading: never loads on its own: given the events by FeedSection. Until Lines loads, events are grouped by Elsewhere; follows the Primitives pattern and says so ("Loading your lines…") instead of silently.
- Error: cannot fail on its own.
- Empty: "Nothing new / You have seen everything on your lines. Search to look further back."

### components/feed/LineLog.tsx

- Designed in: Log.dc.html, the board
- What it shows: one line's group: "Sendspin enclosure printed and assembled · L-56 · proposed" with "2 unseen".
- Changes from today: the line's state follows its ref ("· proposed"); no number lead is drawn.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: as LogGroup.

### components/feed/LooseSection.tsx

- Designed in: Log.dc.html, the board ("On no line" and "Elsewhere" as two groups)
- What it shows: "On no line · changes to things that belong to no line" or "Elsewhere · on lines not listed above", with its counts, as a LogGroup.
- Changes from today: each group says what it holds, in a short note after its name.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: no events renders nothing.

### components/feed/LogGroup.tsx

- Designed in: Log.dc.html, the board
- What it shows: the group's head with "2 unseen", or "2 drift confirmations, all routine"; its changes; then "Also routine: 5 drift confirmations." with Show.
- Changes from today: the routine changes can be shown with "Show" (today only counted).
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: only routine changes: the head says "…, all routine" and has no body.

### components/feed/LogRow.tsx

- Designed in: Log.dc.html, the board and state G
- What it shows: the time in the lead ("Sun 20:59", "14:02"), then the sentence with its refs, then who: "D-34 no longer affects PANEL-5 · homepanel".
- Changes from today: the actor follows the sentence; earlier days show day and time ("Sun 20:59", today "Sun").
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty: it exists only for an event.

### components/feed/FeedList.tsx

- Designed in: Log.dc.html, state A
- What it shows: results by day ("Yesterday"), one line each.
- Changes from today: none in its own words.
- Loading: never loads on its own: given results by FeedSection.
- Error: cannot fail on its own.
- Empty: never empty: FeedSection shows "Nothing matches this search" instead.

### components/feed/FeedItem.tsx

- Designed in: Log.dc.html, state A
- What it shows: the sentence, then who and when: "D-75 took over from D-24: How should pacing work · ttube · 20:58". Every ref and name narrows the search.
- Changes from today: the time is a clock time within the day (today "2h"); the project is not drawn.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty: it exists only for an event.

### components/prs/SyncFailures.tsx

- Designed in: Log.dc.html, state F; Panels.dc.html, state B (caption)
- What it shows: "Pull request status is stale for vasc/stack" then "gh is not logged in. Run gh auth login; it picks up again within two minutes."
- Changes from today: one sentence per repo naming it (today a section "PR status is stale" with the repo as a row); the fix is a command and says when it recovers.
- Loading: never loads on its own: given the failures with the page's first data.
- Error: cannot fail on its own; it is itself the error.
- Empty: nothing stale renders nothing.
