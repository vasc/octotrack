# Components

Every component in `packages/web/src/components`. A test fails if one is missing from this page.

**Pure** components get everything from their properties, so they appear on the `/design` specimen and can be changed
in isolation. **Structural** ones load data and pass it on to pure ones, so they hold no look of their own.

## The small vocabulary: `ui/`

| Component      | What it is                                                                                                                                                                                                                                                               | Notes                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `Badge`        | A short label with a tone. `StatusBadge` picks the tone from what the word means                                                                                                                                                                                         | Always has words in it                                  |
| `RefLink`      | A ref such as `D-3`, opening that item in the inspector                                                                                                                                                                                                                  | Monospace. Available wherever a ref appears             |
| `RefText`      | Running text in which every ref is a `RefLink`                                                                                                                                                                                                                           | Use for anything that could mention a ref               |
| `LineBox`      | A box for one line, such as a measurement: Enter cannot add a line, and it keeps what it shows while it has focus                                                                                                                                                        | For named outcomes; `TextBox` for anything longer       |
| `Loaded`       | What a part of the page shows while its data loads or if it failed, until it has loaded once; then the part, kept with `StaleNote` ("Could not refresh: … This may be out of date.") when a refresh fails                                                                | In place of the part, so the rest of the page stays     |
| `TimeAgo`      | `now`, `5m`, `3h`, `2d`, then a date                                                                                                                                                                                                                                     | The full time is its tooltip                            |
| `Section`      | A small heading, with an optional count and link                                                                                                                                                                                                                         | The unit a page is made of                              |
| `states`       | `LoadingState`, `EmptyState` and `ErrorState`                                                                                                                                                                                                                            | Empty can show a command to run. See [voice](voice.md)  |
| `Markdown`     | Text agents and the developer write, rendered as markdown. `MarkdownView` does the work. `inline` for a sentence inside a line of words (a reason, a headline, an option's description), keeping only emphasis, code and links; `links={false}` inside something clicked | Loaded on first use. HTML in the text is never rendered |
| `MarkdownView` | The renderer behind `Markdown`, with links opening outside the dashboard                                                                                                                                                                                                 | Only `Markdown` imports it                              |
| `TextBox`      | A box that grows as you type, for anything longer than a few words. While it has focus it keeps what it shows                                                                                                                                                            | Cmd or Ctrl and Enter sends, once                       |
| `NotKept`      | A draft the server could not keep: says so, and that the words are still on this screen                                                                                                                                                                                  | An alert, until a save works                            |

## Questions: `decisions/`

What agents ask, answered in one press where it waits: on its line, or at the top when urgent.

| Component          | Kind       | What it is                                                                                                                                                                                                                                                   |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DecisionCardView` | Pure       | A question opened, as E-Home draws it: a strip saying what it is and what it holds up, the situation, options side by side that answer in one press, the reason for the recommendation under them, In my own words and Later. A quiet tint when it has focus |
| `QuestionStrip`    | Pure       | The line over a question: what it is (urgent with its reason, the line it stands apart from), its ref, and what it holds up or who asked                                                                                                                     |
| `QuestionOptions`  | Pure       | A question's options side by side, each saying what happens, numbered, the recommended one marked, its reason directly under them                                                                                                                            |
| `OwnWords`         | Pure       | An answer in the developer's own words: a box that takes the cursor, Send (Sending while it waits) and Cancel                                                                                                                                                |
| `DecisionMeta`     | Pure       | The top line: ref, type, priority, repo, who asked, how long ago                                                                                                                                                                                             |
| `HeldDecision`     | Pure       | An open question not in the queue, opened by its ref: why it is held (the task it waits for, or its line), then the question read only                                                                                                                       |
| `BatchPanelView`   | Pure       | Logging decisions made elsewhere, one per line                                                                                                                                                                                                               |
| `DecisionCardItem` | Structural | A card with its form state and, when active, its keys                                                                                                                                                                                                        |
| `BatchPanel`       | Structural | The batch panel's parsing and sending                                                                                                                                                                                                                        |

`DecisionCardView` states:

| State     | Looks like                                                                              |
| --------- | --------------------------------------------------------------------------------------- |
| A row     | Unfocused, a question is one row on its line: what it is, its title, the recommendation |
| Focused   | Opened, tinted, with k ↑ j ↓ beside it; its numbers answer it                           |
| Urgent    | Its kind in the warm tone, with its reason and the line it stands apart from            |
| Own words | A box that takes the cursor; Send, which says Sending while the answer waits            |
| Waiting   | Its answer waits with Undo; its keys stand down until it takes effect                   |
| Put off   | Later sends it to the bottom of its line; it then offers Bring back                     |
| Refused   | The Undo bar says why, and the question stays                                           |
| Answered  | It leaves; its line says what became of the answer, with Change answer                  |

## The Log: `feed/`

| Component      | Kind       | What it is                                                                                                                                                               |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FeedItem`     | Pure       | One line: a tone mark, a sentence, and chips that add a filter                                                                                                           |
| `FeedList`     | Pure       | Items, with a heading where the day changes                                                                                                                              |
| `UnseenLog`    | Pure       | Not seen: line by line in the developer's order, checks and drift confirmations folded, waiting lines left out unless asked for, refused writes always in                |
| `LogGroup`     | Pure       | One group of changes not seen: a head with its mark, name and headline, a row per change, routine ones in one sentence; only routine ones, the sentence sits in the head |
| `LineLog`      | Pure       | A line's group in the log: its number, title (opening it), ref and headline                                                                                              |
| `LooseSection` | Pure       | Changes on no line, or on a line the page does not list, as one group, so nothing not seen is dropped                                                                    |
| `LogRow`       | Pure       | One change: when, and what it says, with its refs openable                                                                                                               |
| `FilterBar`    | Pure       | The query box, with suggestions. A bad query shows why, and results stay up                                                                                              |
| `FilterBox`    | Structural | A `FilterBar` given suggestions from the tracker's own data                                                                                                              |
| `FeedSection`  | Structural | Loads and pages through the log: what is not seen, or what a search finds                                                                                                |
| `FeedPage`     | Structural | The Log: what has not been seen, line by line in the developer's order, and a search over everything                                                                     |

## Pull requests: `prs/`

| Component      | Kind | What it is                                        |
| -------------- | ---- | ------------------------------------------------- |
| `SyncFailures` | Pure | Says that PR status has stopped updating, and why |

## Drift: `drift/`

| Component   | Kind | What it is                                                                 |
| ----------- | ---- | -------------------------------------------------------------------------- |
| `DriftItem` | Pure | What is out of date, what to do, and how to answer. Answering needs a note |

`DriftItem` only offers "Updated" for drift caused by an event. Drift about state clears by itself once the state is
right, so there "Nothing to update" is the only answer on offer.

## Home: `home/` and `lines/`

Home is one list: every line in the developer's order, with what each needs from them in place. See
[patterns.md](patterns.md) and the E · One list boards on the design canvas.

| Component          | Kind       | What it is                                                                                                                                                                     |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HomeSection`      | Pure       | A named region of home with its count and what it means                                                                                                                        |
| `WorkingLine`      | Pure       | A line being worked on: its number, title, meta, headline with how many changes came after it (a link to the line), a case for done, and its items                             |
| `LineMeta`         | Pure       | One row of facts: who is on it, waiting on you, held work being re-confirmed, its plan step                                                                                    |
| `ForYouRow`        | Pure       | A question or task as one row that opens it; a task says what it frees                                                                                                         |
| `FocusTarget`      | Pure       | One item in home's focus order that the browser can focus: outlined, its numbered choices drawn                                                                                |
| `ForYouItem`       | Structural | One thing waiting: opened in full with focus, else its row                                                                                                                     |
| `LineForYouItem`   | Structural | A working line's item as a focus target, wired to home's actions                                                                                                               |
| `LineForYou`       | Pure       | What waits on the developer on a working line: the first opened, the rest one row away, or on a phone fold, "N for you"                                                        |
| `AtPlaceItems`     | Pure       | A working line while at a place: that place's tasks open, the focused item open, the rest folded to one sentence                                                               |
| `MoreForYou`       | Pure       | The rest of what a line needs from you, one link away, saying what it is: "+1 more for you: a task at the Mac"                                                                 |
| `LineProposalCard` | Pure       | An agent's proposal about a line, opened: done, with the done when it meets (Done, Not yet), or a changed done when, old and new with why (Accept, Keep current)               |
| `AnswerStatus`     | Pure       | An answer given on a line lately and what became of it, in one sentence, with Change answer                                                                                    |
| `TaskCard`         | Pure       | A task opened: where, what to report (one box, or a box per named outcome and a note, with how many are filled), and Done or Can't do it, each asking for its words            |
| `TaskClosed`       | Pure       | A task that has closed, opened again: done, could not be done, or withdrawn by its agent, when, and what was sent back or why not; nothing to send again                       |
| `OutcomeFields`    | Pure       | A task's named outcomes, a short box for each in a row, then a note for anything that surprised                                                                                |
| `StepIn`           | Pure       | A working line nobody could be found for, in the warm tone: why, and the action that fits, filled (Set its checkout, Try now, Start one anyway), with Table it and I'll own it |
| `LineStepIn`       | Pure       | Step in for a working line, from the server's reason and its kind: the action that fits the kind, or folded at a place to "Step in: a start keeps failing"                     |
| `CheckoutForm`     | Pure       | Set its checkout: where this machine has a repo, after a clone failed                                                                                                          |
| `UpNextRow`        | Pure       | A line up next: what it holds and how much of it is being re-confirmed, how far scoping got, its done when, and Start                                                          |
| `ProposalCard`     | Pure       | A proposed line with the agent's case, and Start, Up next, Table, Fold into (a button per line), Not a line; Drop for a tabled line back to look at                            |
| `ProposalCase`     | Pure       | Why a proposal should go where its agent recommends and where Up next would put it; for a line back from tabled, the developer's reason                                        |
| `ProposalChoices`  | Pure       | A proposal's numbered choices, the recommended one filled: Start, Up next, Table, Fold into, Not a line; or Drop for a line back from tabled                                   |
| `FoldPicker`       | Pure       | Fold into: the open lines as numbered buttons, never a select                                                                                                                  |
| `FoldedSection`    | Pure       | Tabled and done lines folded to one row that names them, until shown                                                                                                           |
| `QuietRow`         | Pure       | A tabled or finished line, opened: why it waits, and Start or Up next                                                                                                          |
| `LineHandle`       | Pure       | The one reorder control on a line: drag it onto another, or open it for Move to top, Up, Down and To up next                                                                   |
| `Icon`             | Pure       | The few icons, inline, in the text's colour: plus, pin, keyboard, grip, chevron                                                                                                |
| `HomePage`         | Structural | Home: the header, the focus, and the sections                                                                                                                                  |
| `QuestionList`     | Structural | Questions apart from the lines: urgent ones at the very top, ones from before lines below every line; a row until focused                                                      |
| `RecordAnswers`    | Structural | Record answers, behind r: answers given elsewhere, one per line, each placed on its question                                                                                   |
| `WorkingSection`   | Structural | Working on: each line with Step in, its first item opened or as a row, the rest one row away, folded on a phone or at a place                                                  |
| `WaitingSections`  | Structural | Up next, Proposed, Tabled and Done lately, with the Start sheet for a line that waited                                                                                         |
| `SpreadThin`       | Pure       | Past six working lines, in Working on's header: how many have no owner and how many wait on you; a nudge, never a cap                                                          |
| `NothingNeedsYou`  | Pure       | The calm state: nothing needs you, who is working, and where the next ask likely comes from                                                                                    |
| `KeyHelp`          | Pure       | Every key on home, as one list behind ?                                                                                                                                        |
| `AtSection`        | Pure       | I'm at a place: where, that everything else is folded, when it ends by itself, and Leave                                                                                       |
| `FoldedItems`      | Pure       | At a place, the rest of a line's items folded to one link: 1 question · 1 task at the Mac, folded                                                                              |
| `AtUpNext`         | Pure       | While you're here, from lines up next: a place's tasks on lines not started yet, each with its choices                                                                         |
| `TaskItem`         | Structural | A task opened, with what is typed kept as a draft                                                                                                                              |
| `StartSheet`       | Structural | Loads what a waiting line holds before it starts                                                                                                                               |
| `StartSheetView`   | Pure       | Starting a line that waited: a changed done when and held questions, numbered in one run and settled here, the tasks it holds, then Start                                      |
| `DoneWhenChanged`  | Pure       | In the Start sheet, a done when an agent sharpened while the line waited: old and new with why, Accept or Keep current                                                         |
| `HeldQuestion`     | Pure       | In the Start sheet, a question held while the line waited: its options numbered in the sheet's one run                                                                         |
| `FirstRun`         | Pure       | Before anything is placed: what the agents are proposing, and accepting their recommended placements in one choice, with Undo                                                  |
| `PushToggle`       | Pure       | Whether this device is buzzed, and Buzz this device to turn it on                                                                                                              |
| `TableForm`        | Pure       | Tabling a line: why, an optional date to look again, and what tabling holds and winds down                                                                                     |
| `NewLineCard`      | Pure       | A line the developer adds, as E-Propose draws it: what it is, done when, its repos or that it is theirs; Add to up next, Start or Table                                        |

## Agents: `agents/`

| Component        | Kind       | What it is                                                                                                                                                                                                                 |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AgentsPage`     | Structural | The roster, Buzz this device, and the agent states and how agents take and keep lines, in brief                                                                                                                            |
| `AgentRosterRow` | Pure       | One agent: repo, its line (or the line it was started for, or last owned), last command, wake, what it is doing (a start that never ran a command: "retried since Tuesday, each exits at once"), and Stop, Release or Lift |

## The frame: `layout/`

| Component        | Kind       | What it is                                                                                                                                                                                                                                                                              |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NavItem`        | Pure       | The Log or Agents in the bar, as quiet words, marked when it is the page you are on                                                                                                                                                                                                     |
| `TopBar`         | Pure       | The bar on every page: the name, which opens Lines; the Log and Agents as quiet words beside it; what waits as plain words, urgent first after a warm dot; I'm at, New line, Appearance and the keys. On a phone it names no page, New is a plus, and the pages wait behind `PagesMenu` |
| `PagesMenu`      | Pure       | On a phone, the pages behind one quiet button: Lines, Log and Agents, the current one checked. No bar of equal tabs, since Lines is the app                                                                                                                                             |
| `AppearanceMenu` | Pure       | Appearance, one quiet button in the bar: the eight themes, each previewed by a swatch carrying its palette: its ground with its accent and attention, then as the system, light or dark; the current ones checked                                                                       |
| `AtMenu`         | Pure       | I'm at: a button with a pin and the place, opening All places and the developer's places, the current one bold; never a select                                                                                                                                                          |
| `AppShell`       | Structural | The bar, the page, and an opened ref as a panel over the right of the page. Holds the live connection and the keys every page has                                                                                                                                                       |
| `UndoBar`        | Pure       | Choices waiting to take effect, newest first, each saying what it does and in how many seconds, with Undo; failed ones say why                                                                                                                                                          |
| `PendingChoices` | Structural | The Undo bar on every page; u undoes the newest choice                                                                                                                                                                                                                                  |

## The inspector: `entity/`

Opens from any ref as a panel over the right of the page, so the list keeps its place behind it.

| Component        | Kind       | What it is                                                                                                                                                       |
| ---------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntityHeader`   | Pure       | Ref, kind, status, title and close                                                                                                                               |
| `KeyValues`      | Pure       | Label and value pairs. Empty values are left out                                                                                                                 |
| `LinkList`       | Pure       | Connections, worded from this item's point of view: "blocked by", not "blocks"                                                                                   |
| `HistoryList`    | Pure       | What has happened to this item                                                                                                                                   |
| `PrPanel`        | Pure       | A pull request's details                                                                                                                                         |
| `LineActions`    | Pure       | What the developer can do with a line: place, table, finish, own, stop its owner, and answer its proposals                                                       |
| `LinePanelItem`  | Structural | A line opened, as E-Line draws it: head, moves, summary, what it needs from you, plan beside what is new and its owner, Tell. Marked seen when it opens          |
| `OwnerBox`       | Pure       | Who speaks for the line, Stop on its owner, I'll own it, or Hand to an agent on a line of yours                                                                  |
| `PlanList`       | Pure       | The plan: each step done, now or next, with its issues and their pull requests and checks                                                                        |
| `PanelForYou`    | Structural | What the line needs from you, in its panel: the first opened, the rest one row each                                                                              |
| `SummaryBox`     | Pure       | The line's summary: the headline that stands alone, the rest, and how fresh it is                                                                                |
| `LinePanelHead`  | Pure       | The top of a line opened: its place in the order, ref and repos, title, done when, and Esc                                                                       |
| `TellBox`        | Pure       | Tell: a free message to the line's owner, named in its label; empty, a nudge                                                                                     |
| `OwnWorkBox`     | Pure       | On a line the developer owns, one growing box that adds a task or a note                                                                                         |
| `SinceSummary`   | Pure       | Until a line's summary is rewritten: everything newer, one row each, with what was seen folded to one row                                                        |
| `EntityBody`     | Structural | Picks the right body for the kind of item, a question's with its queue                                                                                           |
| `DecisionPanel`  | Structural | An open decision as a card, or a closed one as its record                                                                                                        |
| `IssuePanel`     | Structural | A task or an issue opened in place, as E-Issue: a task's form and what it frees, or how it closed; an issue's waits, pull requests, activity and Tell; its drift |
| `OpenDrift`      | Structural | What is out of date about the open line, issue or item, each answered with Undo; a refusal says why in the Undo bar                                              |
| `TaskFrees`      | Pure       | What a task frees: each freed issue, openable, with its title and who Done reaches, now or whoever takes it                                                      |
| `PullRequestBox` | Pure       | An issue's pull requests with their checks, and whose they are to fix and merge                                                                                  |
| `ActivityList`   | Pure       | What happened to an item lately, newest first, one row each                                                                                                      |
| `UpdatesSection` | Structural | Updates on this item, and a box to post one, which waits with Undo                                                                                               |
| `EntityPanel`    | Structural | Loads it all                                                                                                                                                     |

## Also in the language, not components

| Class        | What it is                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| `.btn`       | A button. `data-primary` is the one action a form is for. At most one per form                        |
| `.field`     | A text input                                                                                          |
| `.select`    | A small select, for picking a value to add, such as a repo; never for a change of state               |
| `.chip`      | Quiet text that acts: a filter, a link                                                                |
| `.tab`       | One of a set of mutually exclusive views, with `aria-pressed`: the specimen's themes                  |
| `.row`       | One line in a list, divided from the next by `--line`                                                 |
| `.card`      | A plain box that reads as an object, on the specimen; line cards and proposals have their own classes |
| `.sheet`     | One surface holding a section's rows, divided by hairlines: never a box inside a box                  |
| `.live-note` | "Not live: reconnecting" above the page, in the page's own width and margins                          |
