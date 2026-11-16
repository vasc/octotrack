# Octotrack dashboard: UI inventory (shell, Log, Agents, PRs, drift, lines, routing)

Repo: /Users/vasco/projs/octotrack-build/packages/web/src. I read every file in scope in full. I also read the primitives and server code these components depend on, so the strings below are exact: ui/*, home/KeyHelp, home/PushToggle, entity/EntityPanel, entity/OpenDrift, design/DesignPage, api/client.ts, server app.ts, core schemas and the query parser.

On the shared building blocks:

- **`LoadingState label`** renders as `"{label}…"` (role=status).
- **`ErrorState`** renders `error.message`, in red, with role=alert.
- **`EmptyState`** renders `<p>{children}</p>`, plus an optional monospace command block.
- **`StaleNote`** renders `"Out of date: {message}"`.
- **Undo window:** every "choice" waits 5 s with Undo (server `DEFAULT_CHOICE_DELAY_MS = 5000`).

---

## Routing

Paths are read in `lib/router.ts` with `useRoute()` (pathname plus search). `App.tsx` switches on the path.

| URL            | Screen                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/`            | AppShell + HomePage (Lines)                                                                                                    |
| `/lines`       | Same as `/`. The brand link is "current" and PagesMenu checks "Lines".                                                         |
| `/log`         | AppShell + FeedPage                                                                                                            |
| `/agents`      | AppShell + AgentsPage                                                                                                          |
| `/design`      | DesignPage (lazy), **without** AppShell: no bar, no live updates, no Undo bar. While its chunk loads: "Loading the specimen…". |
| any other path | AppShell + `<div className="page"><EmptyState>Nothing lives at {path}.</EmptyState></div>`                                     |

| Query param          | Where                                     | Effect                                                                                                                                                                |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?ref=X`             | AppShell.tsx:37                           | Opens `<Side label=X>` with `<EntityPanel>` over the right of the page (full screen on a phone). Set by every RefLink, TextLink to a line, etc. through `openEntity`. |
| `?from=Y`            | router.ts:54-67                           | The ref the panel was opened from. Esc goes back to Y instead of closing.                                                                                             |
| `?act=tell`          | LinePanelItem.tsx:58                      | A line panel opens straight into its Tell box.                                                                                                                        |
| `?new=1`             | AppShell.tsx:42                           | NewLineSheet. Set by the bar's "New line" button, cleared on add or cancel.                                                                                           |
| `?focus=REF`         | HomePage.tsx:34, useHomeFocusOnPage.ts:22 | Focuses that item on Lines, then the param is removed (replace). Set by the bar's counts and by push-notification taps.                                               |
| `?q=…`               | useFilter.ts:26                           | The Log search text (written with replaceState on every keystroke).                                                                                                   |
| `?find=1`            | FeedPage.tsx:35                           | Search box autofocuses. Set by the `/` key from any other page (`navigate("/log?find=1")`, which drops every other param). Never cleared.                             |
| `?waiting=yes`       | FeedPage.tsx:22                           | The unseen Log also shows up-next and tabled lines. Set by "Show".                                                                                                    |
| `?theme=light\|dark` | DesignPage.tsx:26                         | The design specimen shows one theme; otherwise "Both".                                                                                                                |

There are no tabs as such. Lines, Log and Agents are separate paths, reached through the bar links or the phone Pages menu.

---

## Components

### App — App.tsx

- **Kind:** screen (router root)
- **Shown when:** always, mounted by main.tsx inside StrictMode and QueryClientProvider. Query defaults: gcTime 30 min, retry 1, refetchOnWindowFocus.
- **Used by:** main.tsx
- **Purpose:** picks DesignPage, or AppShell around the page for the path.
- **Data shown:** none of its own.
- **Actions:** none.
- **States:**
  - `path === "/design"`: `<Suspense fallback="Loading the specimen…"><DesignPage/></Suspense>`, with no shell.
  - `/` or `/lines`: HomePage.
  - `/log`: FeedPage.
  - `/agents`: AgentsPage.
  - default: "Nothing lives at {path}." The wrapper class `page` has no CSS, so the message has no page padding.
- **Loading:** only the /design chunk: "Loading the specimen…".
- **Error:** no error boundary. A failed lazy chunk or any render throw unmounts the whole app to a blank page.
- **Empty:** the 404 text above.
- **Phone / touch:** none.

### Page (internal 404 wrapper) — App.tsx:14

- **Kind:** screen
- Covered under App above. It renders only the EmptyState, with no link home.

### main.tsx root

- **Kind:** primitive-use
- **Purpose:** mounts the app.
- **Error:** if `#root` is missing it throws `"index.html has no #root"`, which only reaches the console.
- **index.html:**
  - applies the stored theme before first paint;
  - paints Paper's ground (#f6f6f4 light, #121212 dark);
  - preloads `/api/bootstrap`;
  - `<title>Octotrack</title>`.

### AppShell — components/layout/AppShell.tsx

- **Kind:** screen frame
- **Shown when:** every path except /design.
- **Used by:** App
- **Purpose:**
  - draws the bar, the page, the Undo bar, the open ref panel and the New line sheet;
  - owns the global keys, the live stream, reload on a new build, push "seen" pings and the theme.
- **Data shown, in render order:**
  1. TopBar
  2. `<main>`:
     - offline note
     - KeyHelp sheet (portal)
     - I'm-at error
     - page or bootstrap error
     - PendingChoices
  3. `<Side>` with EntityPanel when `?ref`
  4. NewLineSheet when `?new=1`
- **Actions:**
  - Keys (AppShell.tsx:45-64):
    - `?` opens the key list; with it open, `?` closes it.
    - `g p` focuses the I'm-at button (does nothing when there are no places).
    - `/` goes to `/log?find=1` (not bound on /log).
    - `Escape` closes what is on top, in order: key list, then panel (back to `?from` or closed), then "leave I'm at" (`setAt(null)`).
    - With the key list open, only `?` and `Escape` work. The KeysHeld context stands down every other key map.
  - Bar callbacks:
    - New line: `setParams({new:"1"})`.
    - Keys button: opens KeyHelp.
- **States:**
  - `live === "offline"`: `<Note>Not live: reconnecting</Note>`.
  - `keysOpen`: `<KeyHelp>` sheet.
  - `bar.error !== null` (the I'm-at mutation failed): `<ErrorState>` with the message.
  - Bootstrap `isPending`: renders **nothing** in place of the page.
  - Bootstrap error with no data: `<ErrorState>` replaces the whole page.
  - Otherwise the page (children).
  - `<PendingChoices/>` always.
  - `entity !== null`: `<aside class="ui-side" aria-label={ref} tabIndex=-1>` with EntityPanel.
  - `adding`: NewLineSheet.
- **Loading:** none. Blank under the bar until bootstrap arrives.
- **Error:**
  - Bootstrap failure:
    - network down gives the browser's fetch message, e.g. "Failed to fetch" (Chrome), "Load failed" (Safari) or "NetworkError when attempting to fetch resource." (Firefox);
    - server error gives the server message;
    - a non-JSON body gives a raw JSON SyntaxError;
    - a schema mismatch gives raw ZodError JSON.
  - A refresh failure after the first load: unhandled. Old data stays with no stale note.
  - I'm-at failure: ErrorState with the message. It stays until the next I'm-at attempt.
- **Empty:** n/a.
- **Phone / touch:**
  - `<main>` and its notes are unstyled: no gutter or max-width (they sit outside `.ui-page`).
  - The Side panel is `width:min(820px,100%)`, so it covers the full screen on a phone. It is fixed on the right with z-index 20.

### TopBar — components/layout/TopBar.tsx

- **Kind:** panel (app bar)
- **Shown when:** every AppShell page. Sticky at the top, z-index 20.
- **Used by:** AppShell
- **Purpose:** the name and pages, counts of what waits on the developer, I'm at, New line, the theme, and keys or pages.
- **Data shown, in render order:**
  1. Nav (`aria-label="Main"`): "Octotrack" (brand), "Log", "Agents".
  2. Counts region `aria-label="Waiting on you"`, each **n** + label, urgent first: "urgent", "to answer", "to do", "to accept", "to step in". Zero counts are left out.
  3. Actions: AtMenu, "New line", AppearanceMenu, Keyboard-shortcuts icon (wide only), PagesMenu (phone only).
- **Actions:**
  - **Octotrack** link goes to `/`. It is `aria-current=page` on `/` or `/lines`.
  - **Log** link goes to `/log`; **Agents** link goes to `/agents`.
  - Cmd/Ctrl-click on any link is left to the browser.
  - Each **count** link goes to `/?focus={first item}`, or `/` when there is none.
  - **New line**: primary button with a plus icon. Sets `?new=1`.
  - Icon button `aria-label/title "Keyboard shortcuts"`: opens KeyHelp.
- **States:**
  - `ordered.length === 0` (home not loaded, failed, or all zeros): no counts region.
  - `places.length === 0`: no AtMenu.
  - An urgent count gets a warm dot before it (`data-urgent`).
- **Loading:** counts and I'm at are absent until the home and place queries load.
- **Error:** home or places query errors are unhandled; counts and I'm at just vanish.
- **Empty:** a bar with only links, New line, Appearance and Keys/Pages.
- **Phone / touch (≤720px):**
  - The bar wraps.
  - "Log" and "Agents" links are hidden (brand only).
  - Counts move to their own full-width row under the bar.
  - "New line" is icon-only (still `aria-label "New line"`).
  - The Keyboard-shortcuts button is hidden; PagesMenu shows instead.
  - pointer:coarse: icon buttons are 44px wide and buttons have a 44px min-height.

### AtMenu — components/layout/AtMenu.tsx

- **Kind:** widget (menu)
- **Shown when:** in the TopBar when the developer has at least one place.
- **Used by:** TopBar
- **Purpose:** say which place the developer is at.
- **Data shown:**
  - Button: pin icon + `{at ?? "All places"}` + chevron; `aria-label "I'm at: {shown}"`.
  - Menu `aria-label "I'm at"`: "All places", then each place name. A ✓ marks the one in force.
- **Actions:**
  - Click toggles the menu.
  - Picking an item closes it and refocuses the button; a different place calls the `at` mutation, which acts at once with no Undo.
  - ArrowUp/ArrowDown move between items; Esc closes and refocuses.
  - A tap outside, or focus leaving, closes it.
  - `g p` focuses the button.
- **States:** closed or open. The checked item autofocuses when it opens.
- **Loading:** n/a (hidden until places load).
- **Error:** a failed mutation shows in AppShell as ErrorState (message).
- **Empty:** not rendered.
- **Phone / touch:**
  - The text label is not wrapped in `ui-button-words`, so it keeps its full text on a phone.
  - Menu items are 44px tall on coarse pointers, with no focus ring.

### AppearanceMenu — components/layout/AppearanceMenu.tsx

- **Kind:** widget (menu)
- **Shown when:** always in the TopBar.
- **Used by:** TopBar
- **Purpose:** pick theme and mode, kept in localStorage `octotrack.appearance`.
- **Data shown:**
  - Icon button (palette) with `aria-label "Appearance: {Theme}, {mode lowercased}"` (e.g. "Appearance: Paper, as the system") and tooltip "Appearance".
  - Menu "Appearance":
    - group label "Theme", then swatch + name for each of: Paper, Solarized, Gruvbox, Catppuccin, Rosé Pine, Nord, Everforest, High contrast;
    - group label "Mode", then: As the system, Light, Dark.
  - A ✓ marks the current choice in each group.
- **Actions:** picking any item closes the menu and applies the choice, setting the `data-palette`/`data-mode` attributes and tinting the phone browser bar `theme-color`.
- **States:** open or closed. An unknown stored value falls back to Paper and "As the system". Storage refusal is silent; the choice is still applied for the session.
- **Loading / Error / Empty:** none.
- **Phone / touch:** same as AtMenu.

### PagesMenu — components/layout/PagesMenu.tsx

- **Kind:** widget (menu)
- **Shown when:** phone only (`<Only on="phone">`, hidden at ≥721px).
- **Used by:** TopBar
- **Purpose:** the pages behind one icon.
- **Data shown:**
  - Icon button "more" with `aria-label "Pages: {Lines|Log|Agents}"` and tooltip "Pages".
  - Menu "Pages": Lines, Log, Agents, with a ✓ on the current one. `/lines` and unknown paths count as Lines.
- **Actions:** an item navigates to `/`, `/log` or `/agents`.
- **States / Loading / Error / Empty:** none beyond open or closed.
- **Phone / touch:** exists only on phones.

### PendingChoices — components/layout/PendingChoices.tsx

- **Kind:** widget (global Undo bar host)
- **Shown when:** always, inside `<main>` on every AppShell page.
- **Used by:** AppShell
- **Purpose:**
  - feeds UndoBar from `choice.list`;
  - binds `u` to undo the newest pending choice;
  - runs a 1-second clock while anything is pending.
- **Data shown:** UndoBar, then this instance's own mutation failure.
- **Actions:**
  - key `u` undoes the newest pending choice (only when one exists, and not while the key list is open);
  - Undo, Dismiss and "Pause the line instead" (see UndoBar).
  - Pause = undo the Stop, then make `line.queue` with the summary `"Pausing {line title or ref}: up next"`.
- **States:** `choices.failure !== null` (an undo/now/make from _this_ instance failed) gives `<ErrorState>` with the message. Example: Undo after the choice already took effect gives "It already took effect" or "It already was undone".
- **Loading:** none. The toast area is empty.
- **Error:**
  - Undo or pause failures: the ErrorState above.
  - A `choice.list` query error is unhandled (no toasts).
  - A home query error drops the "looks for another owner" sentence silently.
- **Empty:** the live region stays mounted and empty.
- **Phone / touch:** none of its own.

### UndoBar — components/layout/UndoBar.tsx

- **Kind:** widget (toast stack)
- **Shown when:** at least one choice is pending or failed. The container is always mounted.
- **Used by:** PendingChoices (and the design specimen)
- **Purpose:** each choice waiting to take effect, with a countdown and Undo; each failed one with its reason and Dismiss.
- **Data shown:** toasts, newest first. Container `role=status aria-live=polite`, fixed bottom-centre, width min(480px, 100% minus gutters), z-index 30.
- **Actions:**
  - Pending: "Pause the line instead" (only when `choice.line` is set: a Stop of a line's owner), then "Undo".
  - Failed: "Dismiss" (quiet), which calls undo on the failed row.
- **States:**
  - `state === "failed"`: text `"{summary} did not happen: {error}"`, or `"{summary} did not happen: no reason was given"`. Red text, role=alert.
  - Pending, no line: `"{summary} in {N} seconds"` (`"in 1 second"` when singular; the countdown is aria-hidden and floors at 1).
  - Pending with a known line: appends `". {Title} waits on you."` when all of the line's open work waits on the developer, else `". {Title} looks for another owner."`.
  - Pending with `choice.line` not among working or up-next lines: no sentence, but the Pause button still shows.
- **Summaries that reach it from this scope:**
  - **Agents:** "Stopping {name}", "Lifting {name}'s stop", "Releasing {name} from its line".
  - **Log:** "Marking everything seen".
  - **New line:** "Adding {title} to up next", "Starting {title}", "Tabling {title}".
  - **Drift:** "Marking {ref} updated: {note}", "Marking {ref} as needing no update: {note}".
  - **Pause:** "Pausing {title}: up next".
- **Loading / Empty:** empty container.
- **Error:** the failed toast above.
- **Phone / touch:** same position on a phone, above the safe-area inset. Buttons are 44px on coarse pointers. Toasts sit _under_ sheets (z 30 < 40).

### FeedPage — components/feed/FeedPage.tsx

- **Kind:** screen (`/log`)
- **Shown when:** path `/log`.
- **Used by:** App
- **Purpose:** by default what the developer has not seen, line by line; with a search, the whole log.
- **Data shown:**
  1. Header: h1 "Log", then aside with FilterBox (placeholder "Search", hidden label "Filter") and the quiet button "Mark all seen".
  2. SyncFailures (from bootstrap).
  3. FeedSection: unseen mode when the parsed query is "", otherwise search.
- **Actions:**
  - "Mark all seen" makes the choice "Marking everything seen" (Undo).
  - Key `/` focuses the search box.
  - "Show" (via UnseenLog) sets `?waiting=yes`.
  - Fact chips add filter terms.
- **States:**
  - `?find=1`: the box autofocuses.
  - An invalid query keeps the last good query for results, and shows the error under the box.
- **Loading / Error / Empty:** see FeedSection.
- **Error:** "Mark all seen" request failure is unhandled (that hook's failure is never rendered).
- **Phone / touch:**
  - The page head wraps; the search box flexes up to 10× control height.
  - Search input font enlarged on coarse pointers.
  - "Mark all seen" has no icon, so its words stay visible.

### FilterBox — components/feed/FilterBox.tsx

- **Kind:** widget
- **Shown when:** the FeedPage aside.
- **Used by:** FeedPage
- **Purpose:** wires FilterBar to `useFilter` (the `?q` param) and to suggestions from bootstrap facets.
- **Data shown / Actions / States:** as FilterBar.
- **Loading:** suggestions for project, actor, assignee, label and event are empty until bootstrap loads; the static ones still work.
- **Error / Empty:** as FilterBar.
- **Phone / touch:** as FilterBar.

### FilterBar — components/feed/FilterBar.tsx (renders ui/SearchField)

- **Kind:** widget (combobox)
- **Shown when:** inside FilterBox, and in the design specimen.
- **Used by:** FilterBox, ActivityGallery
- **Purpose:** query box with completions of field names and values.
- **Data shown:**
  - Hidden label "Filter".
  - Input placeholder: the given one (on the Log: "Search"), otherwise default "Filter: kind:decision project:OCT -actor:github since:1d".
  - Error line under the box.
  - Dropdown `role=listbox` of up to 8 options, each a monospace term plus a hint (the field description, e.g. "Who caused an event", "Project key", "On or after a time: since:2h, since:7d, since:2026-11-01"; values have no hint).
- **Actions:**
  - Typing updates `?q` (replace).
  - ArrowDown/ArrowUp move the highlight; Tab or Enter take the highlighted option; clicking an option takes it.
  - A field name completes to `field:` (waiting for its value); a value completes with a trailing space.
  - Esc blurs the box and closes the list.
  - A tap outside closes the list.
- **States:**
  - The list is open when the box has focus and there are completions; otherwise closed.
  - `error !== null`: red text, role=alert, input `aria-invalid`. Messages come from the core parser, in the form `"{message} at position {n} in: {input}"`, with these messages:
    - `Unterminated quote`
    - `"{v}" is not a time for {field}. Use 2h, 7d or a date`
    - `"{v}" is not a value of {field}. Expected one of: …`
    - `Unknown field "{f}". Put text with a colon in quotes`
    - `Field "{f}" has no value`
    - `Field "{f}" has an empty value`
    - `Unexpected token`
    - `Unexpected end of query`
    - `Unclosed parenthesis`
- **Loading:** none.
- **Error:** the above.
- **Empty:** no suggestions means no dropdown.
- **Phone / touch:** options are 44px on coarse pointers; the input font is enlarged so iOS does not zoom.

### FeedSection — components/feed/FeedSection.tsx

- **Kind:** panel
- **Shown when:** FeedPage body.
- **Used by:** FeedPage
- **Purpose:** loads the log, unseen or search, 50 per page. It keeps fetching until a page is full or the log runs out.
- **Data shown:** UnseenLog + Older (unseen mode), or FeedList + Older (search mode).
- **Actions:** via its children.
- **States, in order:**
  1. Error and no events: `<ErrorState>` with the message.
  2. `isPending` (first load): "Loading the log…".
  3. `stillSearching` (no events yet but more to scan): "Searching older events…".
  4. Unseen: UnseenLog + Older.
  5. Search with no events: "Nothing matches this search."
  6. Search: FeedList + Older.
- **Loading:** "Loading the log…". When the query changes, the old results stay with no indicator (keepPreviousData).
- **Error:**
  - First page fails: ErrorState.
  - A later page fails: ErrorState under the rows already shown (in Older).
  - The home query used for line grouping: pending or error is unhandled. Until home loads, every line's events fall under "Elsewhere".
- **Empty:** search: "Nothing matches this search."; unseen: see UnseenLog.
- **Phone / touch:** none of its own.

### Older (internal) — components/feed/FeedSection.tsx:60

- **Kind:** widget
- **Shown when:** after the unseen log or the search list.
- **Used by:** FeedSection
- **Purpose:** paging and later-page errors.
- **States:**
  - `feed.error`: `<ErrorState>` with the message (shown with or without a next page).
  - `!hasNextPage`: only that error, or nothing.
  - Otherwise button "Older", or "Loading" while fetching (disabled while fetching).
- **Actions:** "Older" fetches the next page.
- **Loading:** "Loading" on the button.
- **Error:** above.
- **Empty:** renders nothing.
- **Phone / touch:** button 44px on coarse pointers.

### UnseenLog — components/feed/UnseenLog.tsx

- **Kind:** panel
- **Shown when:** Log with an empty query.
- **Used by:** FeedSection
- **Purpose:** what the developer has not seen. Rule breaks first, then line by line in the developer's order (working, proposed, done lately, up next, tabled), then loose events.
- **Data shown:**
  1. Section "Rule breaks": LogRows for event types `write.refused`, `agent.would_stop`, `agent.stopped`, `pr.after_wind_down`.
  2. List: a LineLog per shown line, numbered 1… in shown order; then LooseSection "On no line"; then LooseSection "Elsewhere".
  3. Actions row: Note "Up next and tabled: {n} more" + quiet button "Show".
- **Which lines show:**
  - Proposed, done and dropped lines only when they have unseen events.
  - Up-next and tabled lines only with `?waiting=yes`.
- **Actions:** "Show" sets `?waiting=yes`. Line titles open the line panel.
- **States:**
  - No refused events: no Rule breaks section.
  - Something to list: the list.
  - Nothing to list and no rule breaks: `EmptyState` "Nothing new".
  - Nothing to list but rule breaks present: nothing more.
  - `includeWaiting` or no waiting lines: no "Up next and tabled" row.
  - Otherwise "Up next and tabled: {leftOut} more" + "Show". This can read "0 more" when waiting lines have no unseen events.
- **Loading / Error:** handled in FeedSection.
- **Empty:** "Nothing new".
- **Phone / touch:** none.

### LineLog — components/feed/LineLog.tsx

- **Kind:** row
- **Shown when:** each shown line in UnseenLog.
- **Used by:** UnseenLog
- **Purpose:** one line's unseen changes.
- **Data shown:** a LogGroup with:
  - lead = number;
  - title = TextLink with the line title;
  - refText = the line ref;
  - headline = the line headline;
  - `aria-label` = the title.
- **Actions:** the title link calls `openEntity(line.ref)` (sets `?ref`).
- **States:** as LogGroup.
- **Loading / Error / Empty:** n/a.
- **Phone / touch:** the link has an enlarged hit area on coarse pointers.

### LooseSection — components/feed/LooseSection.tsx

- **Kind:** row
- **Shown when:** "On no line" or "Elsewhere" has events.
- **Used by:** UnseenLog
- **Purpose:** changes not on a listed line.
- **Data shown:** LogGroup with lead "·" (aria-hidden), and title and label "On no line" or "Elsewhere".
- **States:** `events.length === 0` renders nothing.
- **Other:** none.

### LogGroup — components/feed/LogGroup.tsx

- **Kind:** row
- **Shown when:** each line or loose group in the unseen log.
- **Used by:** LineLog, LooseSection
- **Purpose:** a header row with counts, then its non-routine changes.
- **Data shown:**
  - lead, then title;
  - facts: ref, then "nothing new" or "{routine sentence}, all routine", then **"{n} unseen"** (strong);
  - note: inline-markdown headline;
  - body: a List of LogRows, then Note "Also routine: {sentence}.".
  - Routine sentence = counts of "check change(s)", "drift confirmation(s)", "re-confirmation(s)", e.g. "2 check changes, 1 re-confirmation".
- **Actions:** none (refs inside rows open panels).
- **States:**
  - No events: fact "nothing new", no body.
  - Only routine events: fact "{sentence}, all routine", no body, no headline.
  - Some non-routine events: "{n} unseen", the headline (if any), the rows, and the "Also routine: …" note if there are routine ones too.
- **Loading / Error / Empty:** n/a.
- **Phone / touch:** facts wrap under the title at ≤720px.

### LogRow — components/feed/LogRow.tsx

- **Kind:** row
- **Shown when:** each non-routine change, and each rule break.
- **Used by:** LogGroup, UnseenLog
- **Purpose:** one change.
- **Data shown:**
  - Wide lead with the time: "HH:MM" today, a weekday ("Tue") within 6 days, "3 Nov" this year, "Nov 2025" otherwise.
  - Quiet title: the summary, with refs (`D-3`, `OCT-12`, etc.) as clickable RefLinks.
- **Actions:** each ref opens its panel.
- **States / Loading / Error / Empty:** none.
- **Phone / touch:** refs have an enlarged hit area on coarse pointers.

### FeedList — components/feed/FeedList.tsx

- **Kind:** panel
- **Shown when:** Log search with results.
- **Used by:** FeedSection
- **Purpose:** results grouped by consecutive day.
- **Data shown:** one Section per day, titled "Today", "Yesterday" or "YYYY-MM-DD", each with a List of FeedItems.
- **Actions:** via FeedItem.
- **States:** a map over days. An empty list never reaches here.
- **Loading / Error / Empty:** n/a.
- **Phone / touch:** none.

### FeedItem — components/feed/FeedItem.tsx

- **Kind:** row
- **Shown when:** each search result.
- **Used by:** FeedList
- **Purpose:** one event, with chips to narrow the search.
- **Data shown:**
  - title: the summary with clickable refs;
  - facts: RefLink of `event.ref` (only when the summary doesn't contain it), project chip (when not null), actor chip, and TimeAgo ("now", "5m", "2h", "3d" or "YYYY-MM-DD", with the full ISO time in the tooltip).
- **Actions:**
  - Project chip adds `project:{p}`.
  - Actor chip adds `actor:{a}` (quoted when the name has spaces, brackets or quotes). Already-present terms are not added twice.
  - The ref opens its panel.
- **States:** ref fact present or absent; project fact present or absent.
- **Loading / Error / Empty:** n/a.
- **Phone / touch:** facts wrap under the title; chips have enlarged hit areas.

### SyncFailures — components/prs/SyncFailures.tsx

- **Kind:** panel
- **Shown when:** on the Log, when `bootstrap.syncFailures` is non-empty.
- **Used by:** FeedPage (and the design specimen)
- **Purpose:** warn that PR status has stopped updating.
- **Data shown:** Section "PR status is stale", one Row per repo: title = repo, note = error text (e.g. "gh is not logged in").
- **Actions:** none.
- **States:** an empty list renders nothing.
- **Loading:** nothing until bootstrap loads.
- **Error:** n/a.
- **Empty:** nothing.
- **Phone / touch:** none.

### AgentsPage — components/agents/AgentsPage.tsx

- **Kind:** screen (`/agents`)
- **Shown when:** path `/agents`.
- **Used by:** App
- **Purpose:** the roster of agents, plus push opt-in.
- **Data shown:**
  1. Header: h1 "Agents"; aside: PushToggle.
  2. Choices failure ErrorState.
  3. Roster List of AgentRosterRows, each with repo (GitHub name once projects load, otherwise the key), line title, and whether its line waits on the developer.
- **Actions:** Stop, Lift and Release per row, each made as a choice with Undo. Push: "Buzz this device".
- **States:**
  - `choices.failure` (a make failed): `<ErrorState>` with the message, e.g. "Only the developer's own choices wait with Undo", or a network message.
  - Agents not loaded, no error: "Loading agents…".
  - Agents not loaded, with error: `<ErrorState>` with the message.
  - Loaded, refresh failed: "Out of date: {message}" above the roster.
  - Empty roster: "No agents yet" + command block `export OCTO_AGENT=feature-x`.
  - Otherwise the list.
- **Loading:** "Loading agents…".
- **Error:**
  - Above.
  - Home and project query errors (`useHome`) are unhandled: titles, repo names and waits-on-you just go missing.
  - `h.failure` is not rendered here.
- **Empty:** "No agents yet" / `export OCTO_AGENT=feature-x`.
- **Phone / touch:** the aside wraps under the title.

### PushToggle — components/home/PushToggle.tsx (used here)

- **Kind:** widget
- **Shown when:** AgentsPage header aside.
- **Used by:** AgentsPage
- **Purpose:** whether this device gets push notifications, and turning them on.
- **States:**
  - `unsupported` (no service worker or PushManager): renders nothing.
  - `off`: button "Buzz this device".
  - `on`: Note "Buzzing this device".
  - `blocked`: Note "Notifications blocked".
  - `turning-on`: Note "Turning on…".
  - Plus an error Note (red), e.g.:
    - "This server does not send notifications" (no VAPID key);
    - a fetch, JSON or service-worker failure message.
- **Actions:** "Buzz this device" fetches `/api/push/key`, asks the browser permission, registers `/sw.js`, subscribes, then calls `push.subscribe`.
- **Loading:** "Turning on…".
- **Error:**
  - Error note as above.
  - Permission dismissed ("default") silently returns to "Buzz this device".
- **Empty:** n/a.
- **Phone / touch:** on iOS outside an installed web app it is "unsupported", so it renders nothing.

### AgentRosterRow — components/agents/AgentRosterRow.tsx

- **Kind:** row (`<article aria-label={name}>`)
- **Shown when:** each agent on the Agents page.
- **Used by:** AgentsPage
- **Purpose:** an agent's repo, line, last seen, wake method and current state, with its one action.
- **Data shown:**
  - title: the agent name.
  - facts:
    1. repo (GitHub name or key; omitted when none);
    2. either "no line", or RefLink(line) + " {line title}" + relation (", {role}" when on the line, e.g. ", owner"; ", started for it"; ", last owner");
    3. TimeAgo(lastSeenAt), or "never" for an Octotrack-started session that has run no command;
    4. wake scheme (the part of `wakeAddress` before ":"), when set.
  - note: the "now" text (below).
  - body: Note `{agent.note}` when set.
- **Actions** (trailing button; none when `gone`):
  - quiet and holding a line: "Release" (`aria-label "Release {name} from {line}"`);
  - stopped: "Lift" (`aria-label "Lift {name}"`);
  - otherwise "Stop" (`aria-label "Stop {name}"`);
  - the line ref opens its panel.
- **States, when `start === null` (note text):**
  - Line waits on the developer, agent on a line and running or asleep: "running; its line waits on you" / "asleep; its line waits on you".
  - stopped by Octotrack: "stopped by Octotrack{ when}, after 3 writes a line's state forbids". `when` = " at HH:MM" today, " on {Weekday}" within 6 days, otherwise " on {d Month}[ yyyy]".
  - stopped by you: "stopped by you{ when}" + optional ": {reason}".
  - gone: "gone", or "gone: its wake failed ({wakeError})".
  - quiet: "quiet", or "quiet, still holding its line".
  - running with no line: "idle: nothing to take or scope in its repo".
  - asleep with no line: "asleep, on no line".
  - running or asleep on a line: "running, on its line" / "asleep, on its line".
- **States, when `start !== null` (note text):**
  - starting or running: "starting".
  - failed, more than one attempt: "retried since {today|yesterday|Weekday|YYYY-MM-DD}, each exits at once{ (exit N)}".
  - failed, one attempt: "exited at once{ (exit N)}".
  - never_took: "ran but never took its line".
  - exited: "exited{ (exit N)}".
- **No line at all:** fact "no line".
- **Loading / Error / Empty:** n/a.
- **Other:** there is no held/pending state, so the button stays live during the 5-second Undo window.
- **Phone / touch:** facts wrap under the name; the button is 44px on coarse pointers.

### AgentAction (internal) — AgentRosterRow.tsx:62

- **Kind:** widget
- Covered in the Actions bullet of AgentRosterRow. It returns null for `gone`.

### DriftItem — components/drift/DriftItem.tsx

- **Kind:** row (`<article aria-label={drift.ref}>`)
- **Shown when:**
  - In the product: in the entity panel's Section "Out of date" ({count}), via OpenDrift, which shows only **open** drift.
  - In the specimen: also non-open ones.
- **Used by:** OpenDrift, ActivityGallery
- **Purpose:** something out of date, cleared only with a note.
- **Data shown:**
  - title: the rule, with dashes and underscores turned into spaces (e.g. "issue closed pr open").
  - facts:
    1. RefLink(drift.ref);
    2. status badge when not open ("updated", "verified", "auto resolved");
    3. "on {RefLink target}";
    4. "for {assignee}";
    5. TimeAgo.
  - note: the message, with clickable refs.
  - body: see States.
- **Actions** (open drift only):
  - "Updated" (only when `drift.edge`) acks with mode "updated".
  - "Nothing to update" acks with mode "verified".
  - Both stay disabled until the note has text.
  - Undo summaries: "Marking {ref} updated: {note}" / "Marking {ref} as needing no update: {note}".
- **States:**
  - Open: suggestion (markdown); a note field (hidden label "Note for {ref}", placeholder "Note"); the action buttons; red Note `{error}` when the `error` prop is set (never passed in the product).
  - Not open, with a note: Note "{resolvedBy}: {note}", or "{note}".
  - Not open, no note: nothing.
- **Loading / Empty:** n/a.
- **Error:** inline error only in the specimen; real refusals arrive as a failed toast.
- **Phone / touch:** facts wrap; buttons are 44px.

### On (internal) — DriftItem.tsx:74

- **Kind:** primitive-use
- Renders "on " + RefLink(target).

### NewLineSheet — components/lines/NewLineSheet.tsx

- **Kind:** sheet (modal dialog, portal to body, z-index 40)
- **Shown when:** `?new=1` on any AppShell page.
- **Used by:** AppShell
- **Purpose:** add a line, to up next, started, or tabled.
- **Data shown:**
  - Head: h2 "New line" + quiet "Cancel".
  - Step 1 body:
    - Field "What it is" (autofocus);
    - Field "Done when" (multiline, grows);
    - List labelled "Repos": a checkbox row per repo key, then "None: it's mine".
  - Step 1 foot: "Add to up next" (primary), "Start", "Table".
  - Step 2 (tabling) body: Field "Why it waits" (autofocus); Field "Look again on" (date picker).
  - Step 2 foot: "Table it" (primary), "Back" (quiet).
- **Actions:**
  - Cancel, Esc (inside the sheet) and a tap on the scrim: close and discard.
  - "Add to up next", "Start" and "Table" are disabled until the title, Done when and (mine or at least one repo) are filled.
  - "Add to up next" and "Start" add the line and close; Undo shows "Adding {title} to up next" / "Starting {title}".
  - "Table" goes to step 2.
  - "Table it" is disabled until a reason is typed; it adds with `where:"tabled"`, the reason and an optional date. Undo: "Tabling {title}".
  - "Back" returns to step 1 with the values kept.
  - Ticking a repo unticks "None: it's mine"; ticking "None" hides the repo ticks.
- **States:** step 1 or step 2; each button enabled or disabled.
- **Loading:** none. The repo list shows only "None: it's mine" until projects load.
- **Error:**
  - Project list error: unhandled.
  - The add request failure is unhandled (`useNewLine`'s failure is never rendered); the sheet closes regardless.
- **Empty:** no repos means only the "None: it's mine" row.
- **Phone / touch:**
  - ≤720px: a bottom sheet, full width, max-height 88vh, rounded top, safe-area padding.
  - Wide: a centred panel 480px wide at 12vh, max-height 76vh.
  - Input font enlarged on coarse pointers.

### TableForm — components/lines/TableForm.tsx

- **Kind:** sheet
- **Shown when:** "Table" chosen on:
  - a proposal (home ProposalCard);
  - a Step-in item (home StepIn);
  - the line panel (entity LineActions);
  - and in the specimen.
- **Used by:** ProposalCard, StepIn, LineActions, PrimitivesGallery
- **Purpose:** table a line, with a reason and an optional look-again date.
- **Data shown:**
  - Head: "Table {title}" + "Cancel".
  - Field "Why it waits" (autofocus; Cmd/Ctrl+Enter submits).
  - Field "Look again on" (date).
  - Note with the consequences, e.g. "Holds 1 question and 2 tasks · panel-widgets winds down" ("question(s)" and "task(s)" pluralised; each part only when non-zero or when there is an owner).
  - Foot: "Table it" (primary).
- **Actions:** "Table it" (disabled until a reason is typed) calls `onTable(reason, date|null)`. Cancel, Esc and the scrim close it.
- **States:**
  - Consequence note present or absent (absent when nothing is held and there is no owner: home callers pass neither).
  - Button enabled or disabled.
- **Loading / Error / Empty:** none.
- **Phone / touch:** as NewLineSheet.

### useLineHandles (rendering hook) — hooks/useLineHandles.tsx

- **Kind:** primitive-use (returns `<LineHandle>`)
- **Shown when:** on Lines, in the working and up-next rows.
- **Used by:** HomePage
- **Purpose:** each line's number as a drag handle and menu.
- **Detail:** builds LineHandle with:
  - `canMoveUp` = index > 0;
  - `canMoveDown` = index < count−1;
  - `canQueue` only in working.
- Moves are "top", "up", "down" or "up_next". Top, up and down act at once (`line.order`); up_next is a choice "Moving {title} to up next".
- The LineHandle UI itself is in home scope.

### DesignPage — design/DesignPage.tsx (route target only)

- **Kind:** screen (`/design`)
- **Data shown:**
  - h1 "Octotrack design language";
  - buttons "Both", "Light", "Dark" (`aria-pressed`; the current one is primary);
  - columns per theme: Primitives, Foundations, Status, Decision, Lines and Activity galleries.
- **Actions:** buttons set `?theme=light|dark`, or remove it for Both.
- **States:** `theme` light or dark shows one column; anything else shows both, and "Both" is pressed only when the param is absent.
- **Loading:** "Loading the specimen…".
- **Error:** a chunk failure blanks the app (no boundary).
- **Data:** no network.

---

## Global states

- **Server unreachable:**
  - On the first load (bootstrap fails, after 1 retry): AppShell replaces the page with ErrorState showing the browser's fetch message, e.g. "Failed to fetch" / "Load failed" / "NetworkError when attempting to fetch resource." (AppShell.tsx:86).
    - Bootstrap keeps polling every 30 s (useBootstrap.ts:8) and on window focus, so the page recovers without a reload.
  - After a successful load: data stays with no stale marker, except where `Loaded` is used (Agents roster: "Out of date: {message}").
  - The SSE stream error sets `<Note>Not live: reconnecting</Note>` at the top of `<main>` (useLiveUpdates.ts:64, AppShell.tsx:83). It clears on the next "hello".
  - A hidden tab closes the stream (state "connecting", no UI) and refreshes everything when it is shown again.
- **Server from another build:**
  - The dashboard never reads `x-octo-build`. `useReloadOnNewBuild` (hooks/useReloadOnNewBuild.ts) re-fetches `/` on visibilitychange, pageshow and focus. If the served page names `/assets/…` files this page did not load, it reloads silently, unless an input, textarea or contentEditable has focus (then nothing happens, with no notice).
  - Failures are swallowed (line 44).
  - The CLI-side warning is not in the web app (cli/src/client.ts:86).
  - A schema mismatch surfaces as raw ZodError JSON in whatever ErrorState catches it.
- **Dashboard not built:** server only. Any non-API GET returns plain text "The dashboard has not been built. Run: bun run build" (HTTP 503; server/src/app.ts:274). Unknown API routes return `No such endpoint: {METHOD} {path}`.
- **Offline:** same as server unreachable. In addition:
  - pending toasts keep counting down and floor at "in 1 second";
  - mutations fail with the browser fetch message shown in the relevant ErrorState;
  - `push.seen` and draft-flush failures are swallowed.
- **First run with an empty tracker:**
  - Lines (HomePage → FirstRun):
    - with no proposals: "No lines yet" + command `octo guide`;
    - with proposals: row "Nothing placed yet", facts "{k} of {n} proposed carry a recommendation", button "Accept recommended placements" (only when k > 0). Undo: "Placing {k} proposal(s) where their agents recommend".
  - Log: "Nothing new".
  - Agents: "No agents yet" / `export OCTO_AGENT=feature-x`.
  - Bar: no counts, no I'm at.
  - New line: only "None: it's mine" when no projects exist.
- **Push permission:** see PushToggle.
  - Only on the Agents page.
  - States: unsupported (nothing), "Buzz this device", "Turning on…", "Buzzing this device", "Notifications blocked", and an error note.
  - Notifications show the title (default "Octotrack") and body. A tap opens or navigates to the notification's URL (public/sw.js).
  - There is no control to turn push off.
- **Theme / mode menu:** AppearanceMenu above.
  - Stored in localStorage `octotrack.appearance`, and applied pre-paint by index.html.
  - Eight themes × As the system / Light / Dark.
- **Keyboard shortcuts sheet:** KeyHelp (components/home/KeyHelp.tsx), a Sheet titled "Keys" with "Cancel" and two columns:
  - `j k` next, previous item
  - `J K` next, previous line
  - `1–9` the focused item's numbered choice
  - `w` answer in my own words
  - `l` later
  - `u` undo
  - `o ↵` open the line
  - `t` tell the line's owner
  - `alt ↑ ↓` move the line
  - `g p` I'm at
  - `esc` close, leave I'm at
  - `g u` urgent question
  - `/` search
  - `r` record answers
  - It opens with `?` or the bar's Keyboard-shortcuts button (wide screens only). It closes with `?`, Esc, Cancel or a scrim tap.
  - Every other key map stands down while it is open (KeysHeldProvider).
  - It is listed the same on every page, although most keys act only on Lines.
- **Toasts:** UndoBar above, the only toast system.
  - Pending choices show "{summary} in N seconds" + Undo (+ "Pause the line instead").
  - Failed ones show "{summary} did not happen: {error|no reason was given}" + Dismiss.
  - `u` undoes the newest.
- **Focus model:**
  - Hotkeys (hooks/useHotkeys.ts) are ignored with Cmd or Ctrl, while typing in input, textarea or select, and for Enter on a button or link. `g` starts a 1-second two-key sequence.
  - Ref panel (usePanelFocus.ts): opening moves focus to the `<aside tabIndex=-1>`; closing returns it to the opener when focus was lost; moving between panels keeps the first opener.
  - Menus: the checked item autofocuses; arrows cycle through items; Esc closes and returns to the button; a tap outside or focus leaving closes the menu (Safari-safe).
  - SearchField: Esc blurs.
  - Sheets: Esc and the scrim close them.
    - No focus trap, and the sheet doesn't move focus into itself (KeyHelp leaves focus behind the scrim).
    - NewLineSheet and TableForm autofocus their first field.
  - Lines page focus (j/k, `?focus=`) mirrors the browser focus (useBrowserFocus.ts).
  - Number-key hints are drawn only on the current item, and only with `pointer:fine` (ui.css:259).
  - Focus ring: `:focus-visible` uses the accent outline; menu items on coarse pointers have no ring.
- **Not found / forbidden / conflict:** all reach the UI only as server message text in ErrorState or a failed toast. Examples:
  - "Only the developer can {what}"
  - "It already took effect"
  - "{ref} is at version {n}, not {m}"
  - `ApiError.hint` and `.code` are never displayed (api/client.ts:7-12). Hints such as "Someone else changed it. Read it again and retry." and the query "Fields: … Example: …" are lost.

---

## Gaps

1. AppShell.tsx:86 — while bootstrap is pending the page area renders nothing: no loading state on any page's first paint.
2. AppShell.tsx:86 — a bootstrap refresh failure after the first load has no UI (no StaleNote), so a dead server looks current except for the SSE note.
3. App.tsx:25 — the 404 uses `className="page"`, which has no CSS, so it has no gutter. It also has no way home except the bar.
4. AppShell.tsx:83,85,86 and PendingChoices.tsx:46 — the offline Note, I'm-at error, bootstrap error and Undo error render in unstyled `<main>`, outside `.ui-page`, so they have no padding or max-width.
5. useTopBar.ts:18-19 — `home.show` and `place.list` errors have no UI. Counts and I'm at silently disappear.
6. useChoices.ts:6 — a `choice.list` error has no UI. Pending choices become invisible and `u` does nothing.
7. useNewLine.ts:9 — a `project.list` loading or error state has no UI. The New line repo list shows only "None: it's mine".
8. AppShell.tsx:97-99 / useNewLine.ts:14 — a failed New line `choice.make` is never rendered, and the sheet has already closed, so the typed words are lost.
9. useMarkSeen.ts:24-26 / FeedPage.tsx:37 — a failed "Mark all seen" request is never rendered. The comment claims the Undo bar, but only failures at apply time reach it.
10. FeedSection.tsx:32,37 — `home.show` pending or error has no UI. Every line's unseen changes are grouped under "Elsewhere" until home loads.
11. AgentsPage.tsx:22-25 — home and project query errors are unhandled: line titles, GitHub repo names and "its line waits on you" go missing silently. `h.failure` is ignored.
12. PendingChoices.tsx:16 — a home error drops the "{Title} looks for another owner." sentence silently. The Pause toast then names the raw ref.
13. UnseenLog.tsx:91-97 — "Up next and tabled: 0 more" + "Show" renders when waiting lines exist but nothing on them is unseen.
14. UndoBar.tsx:13 — the countdown floors at "in 1 second". An overdue or offline choice has no "taking effect…" state.
15. useReloadOnNewBuild.ts:17,44 — a new build detected while typing gives no reload and no notice. There is no "new version available" UI anywhere.
16. useLiveUpdates.ts:64 — "Not live: reconnecting" is shown even when EventSource has given up (an HTTP error status closes it permanently), so the note can claim reconnection that never happens. There is no "connecting" UI.
17. App.tsx:10, components/ui/Markdown.tsx:4 — no error boundary anywhere. A failed lazy chunk (offline, or an old chunk removed by a deploy) or any render exception blanks the whole app.
18. api/client.ts:32,37 — a non-JSON response surfaces a raw SyntaxError message, and a contract mismatch surfaces raw ZodError JSON, as user-facing error text.
19. api/client.ts:7-12 — `ApiError.hint` and `.code` are never shown, so the server's remediation hints never reach the UI.
20. usePush.ts:65-67 — a dismissed permission prompt silently returns to "Buzz this device". There is no control to turn push off once on.
21. OpenDrift.tsx:20 / DriftItem.tsx:20 — DriftItem's inline `error` branch is never reachable in the product. After an ack the drift stays with its buttons enabled for 5 s, so a duplicate ack is possible. No held state.
22. AgentRosterRow.tsx:73-93 — no held state while Stop, Lift or Release waits with Undo. The button can be pressed again, making a second choice.
23. AppShell.tsx:80 / HomePage.tsx:43 — KeysHeld is true only for the key list. With NewLineSheet (`?new=1`) open and focus on a sheet button, page keys behind it (home's j/k/1–9/w/l, `u`, `g p`, `?`) still act.
24. components/ui/Sheet.tsx:27-55 — no focus trap, and no initial focus for sheets without an autofocus field (KeyHelp). Tab can walk into the dimmed page behind.
25. tokens z-index (--z-undo 30 < --z-sheet 40) — toasts sit under any open sheet's scrim, so they cannot be undone while a TableForm or KeyHelp is open, despite ui.css:997 saying "Over everything".
26. FeedPage.tsx:35 — `?find=1` is never cleared. Every return to that URL autofocuses the search, which on a phone opens the keyboard.
27. useFeed.ts:28 — a search changing keeps the previous results (keepPreviousData) with no "searching" indicator.
28. NewLineSheet.tsx:31-37 — the typed fields are local state with no draft. Cancel, Esc, a scrim tap or a build reload loses them, unlike the server-kept drafts used elsewhere.
29. AppShell.tsx:85 / useTopBar.ts:39 — the I'm-at error has no dismiss and stays until the next I'm-at attempt.
30. useSeen.ts:12 — `push.seen` failures are swallowed (intentional, but no UI).
31. main.tsx:20 — a missing `#root` throws to the console only.
