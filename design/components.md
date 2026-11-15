# Components

Every component in `packages/web/src/components`. A test fails if one is missing from this page.

**Pure** components get everything from their properties, so they appear on the `/design` specimen and can be changed
in isolation. **Structural** ones load data and pass it on to pure ones, so they hold no look of their own.

## The primitives: `ui/`

Every look belongs to one of these, and only these have classes: a screen composes them and never styles anything, so
a button, a row or a sheet looks the same everywhere. `packages/web/test/primitives-only.test.ts` fails on a screen that
gives an element a class or an inline style, and on a class in `ui.css` that is not a primitive's.

| Component      | What it is                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppBar`       | The one bar over every page: the name and the pages, what waits (`Counts`, `Count`), and the actions. `BarLink` is a page in it; `Only` shows something only on a phone or only wider                                      |
| `Page`         | A page under the bar: its title and, beside it, what acts on the whole page. Lines hides its title                                                                                                                         |
| `Section`      | A part of a page or a panel: a small title, its count, and what acts on all of it at the right                                                                                                                             |
| `Fold`         | A section folded to one row: title, count, a few names; opened, its rows. Held open while one of its items has focus                                                                                                       |
| `List`         | Rows divided by hairlines, one sheet; named when its rows are choices. Inside a row or a sheet it is no box of its own                                                                                                     |
| `Row`          | The one shape a list's item takes: what it is after a dot, its title and facts, a quiet note, a lead column (a number or a time), what acts on it, a chevron or a check, and what it holds under it                        |
| `Item`         | Something opened in place, a question or a task: what it is, its title, what it holds. No box: its row is its sheet                                                                                                        |
| `Focusable`    | An item in a page's focus order, where the keys act: a band of tint across the sheet while it has focus                                                                                                                    |
| `Facts`        | Small grey facts in a row with dots between; `Fact` makes one stronger, or warm when something is stuck                                                                                                                    |
| `Note`         | One quiet line that is not the item itself; `Label` a small grey heading; `Code` monospace words                                                                                                                           |
| `Button`       | The one button: primary (filled, the one way forward), plain (a word that acts) or quiet (a word that steps back). `choice` gives it a key number; `icon` makes it an icon alone on a phone. `IconButton` is an icon alone |
| `Actions`      | A place's buttons in one row that wraps                                                                                                                                                                                    |
| `Options`      | A question's answers, one row each, saying what happens, the recommended one marked, numbered for the keys                                                                                                                 |
| `Field`        | A labelled box to type into: one line, several that grow, or a date. `FieldRow` puts short ones side by side                                                                                                               |
| `TextBox`      | A `Field` of several lines whose label is for a screen reader only                                                                                                                                                         |
| `LineBox`      | A `Field` of one line whose label is for a screen reader only                                                                                                                                                              |
| `SearchField`  | A search box with completions dropping down under it, taken with the arrows and Tab or Enter                                                                                                                               |
| `Menu`         | A button opening a short menu: `MenuItem` a choice, `MenuGroup` a group's name, `MenuAction` a thing it does, `Swatch` a theme's colours. A row's number can be the button                                                 |
| `Sheet`        | A task of its own over the whole page and its bar: title and Cancel, content, actions; from the bottom on a phone. New line, Table, Start, Keys, Record answers                                                            |
| `Panel`        | An item opened by its ref: crumbs, title, Close, its sections. `Side` is where it is drawn: over the right of the page, the whole screen on a phone                                                                        |
| `Toast`        | A choice waiting to take effect, or one that failed, with Undo or Dismiss; `Toasts` holds them over the foot of every page                                                                                                 |
| `Pairs`        | Names and values in two columns; `Columns` two columns on a wide screen; `Stack` things one under another                                                                                                                  |
| `Badge`        | A state in small words, never a pill. `StatusBadge` picks its tone from what the word means                                                                                                                                |
| `RefLink`      | A ref such as `D-3` in small monospace, opening the item in the panel; `TextLink` words that open something; `Link` a link to a page or outside, which Cmd opens in a new tab                                              |
| `RefText`      | Running text in which every ref is a `RefLink`                                                                                                                                                                             |
| `TimeAgo`      | `now`, `5m`, `3h`, `2d`, then a date; the full time under the pointer                                                                                                                                                      |
| `Icon`         | The few icons, drawn in the text's colour                                                                                                                                                                                  |
| `states`       | `LoadingState`, `EmptyState` (with the command that would change it) and `ErrorState`                                                                                                                                      |
| `Loaded`       | A part of the page while it loads or failed to, then the part, marked out of date by `StaleNote` when a refresh fails                                                                                                      |
| `NotKept`      | A draft the server could not keep, until a save works                                                                                                                                                                      |
| `Markdown`     | What agents and the developer write. `inline` for a sentence inside a line; `links={false}` inside something clicked                                                                                                       |
| `MarkdownView` | The renderer behind `Markdown`; only `Markdown` imports it                                                                                                                                                                 |

## Screens

Every screen is a composition of the primitives above, and nothing else. **Pure** ones get everything from their
properties and appear on the `/design` specimen; **structural** ones load data and pass it on.

### The frame: `layout/`

| Component        | Kind       | What it is                                                                                                                 |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AppShell`       | Structural | The bar, the page, an opened ref in a `Side`, New line as a sheet over any page, and the keys every page shares            |
| `TopBar`         | Pure       | `AppBar`: the name (home), Log and Agents beside it, what waits (urgent first), I'm at, New line, the theme, keys or pages |
| `AtMenu`         | Pure       | I'm at, a `Menu` of the developer's places                                                                                 |
| `AppearanceMenu` | Pure       | The theme and mode, a `Menu` of eight themes in their own colours and three modes                                          |
| `PagesMenu`      | Pure       | Lines, Log and Agents behind one icon, on a phone                                                                          |
| `UndoBar`        | Pure       | `Toasts`: each choice waiting, with Undo and, for a line's owner, Pause the line instead; failed ones with Dismiss         |
| `PendingChoices` | Structural | The Undo bar on every page, with u undoing the newest                                                                      |

### Lines: `home/` and `lines/`

| Component          | Kind       | What it is                                                                                                            |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `HomePage`         | Structural | Every line in the developer's order, with what each needs in place; the keys                                          |
| `WorkingSection`   | Structural | Working on: a `Section` holding one `List` of lines                                                                   |
| `WorkingLine`      | Pure       | A working line as one `Row`: its number (the handle), title, facts, headline, its answers, and under it what it needs |
| `LineMeta`         | Pure       | A line's facts: who is on it, waiting on you, re-confirming, held, its step                                           |
| `LineHandle`       | Pure       | A line's number as a `Menu`: drag it, or open it for Move to top, Up, Down, To up next                                |
| `AnswerStatus`     | Pure       | An answer given lately and what became of it, with Change answer                                                      |
| `LineForYou`       | Pure       | What a line needs: the first item and the rest one row away, or on a phone one row saying how many                    |
| `LineForYouItem`   | Structural | One of those items, opened in place while it has focus                                                                |
| `ForYouRow`        | Pure       | An item as a `Row` that opens it, or, with focus, the item itself in a `Focusable`                                    |
| `ForYouItem`       | Pure       | The opened item: a question, a task, or a proposal about its line                                                     |
| `MoreForYou`       | Pure       | The rest of a line's items, one row that shows them                                                                   |
| `FoldedItems`      | Pure       | At a place, what is not for that place, one row that opens the first                                                  |
| `AtPlaceItems`     | Pure       | At a place, that place's tasks opened on their line                                                                   |
| `AtSection`        | Pure       | I'm at: where, when it ends, Leave                                                                                    |
| `AtUpNext`         | Pure       | At a place, its tasks from lines up next                                                                              |
| `TaskCard`         | Pure       | A task opened as an `Item`: what to send back, Done and Can't do it, numbered                                         |
| `TaskItem`         | Structural | A task with what is typed kept as a draft                                                                             |
| `OutcomeFields`    | Pure       | A task's named outcomes side by side, then a note                                                                     |
| `TaskClosed`       | Pure       | A closed task: how and when, and what was sent back                                                                   |
| `LineProposalCard` | Pure       | A case that the line is done, or a changed done when: Done or Not yet, Accept or Keep current                         |
| `StepIn`           | Pure       | A line no agent took: why, and the action that fits, filled, with Table it and I'll own it                            |
| `LineStepIn`       | Pure       | A working line's Step in, or at a place one row saying why                                                            |
| `CheckoutForm`     | Pure       | Set its checkout: a path, Set, Cancel                                                                                 |
| `SpreadThin`       | Pure       | Past six working lines, the cost in two facts                                                                         |
| `QuestionList`     | Pure       | Urgent at the top, On no line at the bottom: rows that open in place; on a phone On no line folds                     |
| `WaitingSections`  | Structural | Up next, Proposed, Tabled and Done lately; folds on a phone or at a place; the Start sheet                            |
| `UpNextRow`        | Pure       | A line up next as a `Row`: its number, what it holds, how scoped, done when, Start                                    |
| `QuietRow`         | Pure       | A tabled or finished line: why it waits, when to look again, Up next and Start                                        |
| `ProposalCard`     | Pure       | A proposal as a `Row`: who proposed it, its repos, done when, the case, and its choices                               |
| `ProposalCase`     | Pure       | Where its agent recommends it goes and why, or why it was tabled                                                      |
| `ProposalChoices`  | Pure       | Start, Up next, Table, Fold into, Not a line or Drop: the recommended one filled, numbered                            |
| `FoldPicker`       | Pure       | The lines a proposal could fold into, one button each, numbered                                                       |
| `StartSheet`       | Structural | Loads what a waiting line holds and answers its questions in place; its number keys                                   |
| `StartSheetView`   | Pure       | Start, as a `Sheet`: a changed done when, held questions, its tasks, then Start                                       |
| `DoneWhenChanged`  | Pure       | A done when sharpened while the line waited: Accept or Keep current                                                   |
| `HeldQuestion`     | Pure       | A held question answered in the Start sheet, its answers numbered in the sheet's one run                              |
| `FirstRun`         | Pure       | Before anything is placed: the command, or Accept recommended placements                                              |
| `NothingNeedsYou`  | Pure       | Nothing waits: who is working, and where the next ask likely is                                                       |
| `KeyHelp`          | Pure       | The keys, as a `Sheet`                                                                                                |
| `RecordAnswers`    | Structural | Record answers, behind r                                                                                              |
| `PushToggle`       | Structural | Buzz this device, or how buzzing stands                                                                               |
| `NewLineSheet`     | Pure       | New line, as a `Sheet`: what it is, done when, its repos or that it is yours; up next, start, or table                |
| `TableForm`        | Pure       | Tabling, as a `Sheet`: why it waits, when to look again, what it holds and who winds down                             |

### Questions: `decisions/`

| Component          | Kind       | What it is                                                                                                 |
| ------------------ | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `DecisionCardItem` | Structural | A question with its form and its keys: a number per answer, w, l                                           |
| `DecisionCardView` | Pure       | A question opened, as an `Item`: what it is, the situation, its `Options`, the reason, own words and Later |
| `QuestionStrip`    | Pure       | What a question is, in `Facts`: urgent and why, its line, its ref, who asked or what it holds up           |
| `QuestionOptions`  | Pure       | Its answers as `Options`, the reason for the recommendation under them                                     |
| `OwnWords`         | Pure       | An answer in the developer's own words: Send, Cancel                                                       |
| `DecisionMeta`     | Pure       | A question's ref, kind, priority, repo, who asked and when, in `Facts`                                     |
| `HeldDecision`     | Pure       | A question that is not in the queue now, and what holds it                                                 |
| `BatchPanel`       | Structural | Record answers' lines kept as a draft, sent in one go                                                      |
| `BatchPanelView`   | Pure       | Record answers, as a `Sheet`: one answer a line, and what became of each                                   |

### The Log: `feed/` and `prs/`

| Component      | Kind       | What it is                                                                                    |
| -------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `FeedPage`     | Structural | The Log: a `Page` with search and Mark all seen                                               |
| `FeedSection`  | Structural | What is unseen, or what matches a search, with Older                                          |
| `UnseenLog`    | Pure       | Rule breaks first, then each line's changes in the developer's order                          |
| `LogGroup`     | Pure       | A group of changes as one `Row`: its number, title, facts, headline, and its changes under it |
| `LineLog`      | Pure       | A line's changes as a `LogGroup`                                                              |
| `LooseSection` | Pure       | Changes on no line, or elsewhere, as a `LogGroup`                                             |
| `LogRow`       | Pure       | One change: when, in the wide lead, and what it says, a quiet row                             |
| `FeedList`     | Pure       | Search results, a `Section` a day                                                             |
| `FeedItem`     | Pure       | One result: what it says, its ref, repo and actor (which filter), how long ago                |
| `FilterBar`    | Pure       | The search, a `SearchField` completing the tracker's own fields and values                    |
| `FilterBox`    | Structural | The search wired to its filter and completions                                                |
| `SyncFailures` | Pure       | Repos whose pull request status is stale, and why                                             |

### Agents: `agents/`

| Component        | Kind       | What it is                                                                                                   |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `AgentsPage`     | Structural | Agents: a `Page` with Buzz this device, one `List` of agents                                                 |
| `AgentRosterRow` | Pure       | An agent as a `Row`: its repo, its line, its last command, its wake; what it is doing; Stop, Lift or Release |

### An opened ref: `entity/` and `drift/`

| Component         | Kind       | What it is                                                                                              |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `EntityPanel`     | Structural | Any item by ref, in a `Panel`: a line, an issue or task, or anything else                               |
| `EntityCrumbs`    | Pure       | Where an item sits: its ref, its kind, its state                                                        |
| `EntityBody`      | Pure       | What an item says, by its kind: `Pairs` and its body                                                    |
| `LinePanelItem`   | Structural | A line opened: its head and choices, summary, what it needs, drift, plan, what is new, owner, Tell      |
| `LinePanelHead`   | Pure       | The line's `Panel`: where it is, its title, done when, its choices                                      |
| `LineActions`     | Pure       | A line's choices by its state, and More for Drop and Fold                                               |
| `SummaryBox`      | Pure       | Its headline and summary, and when it was written                                                       |
| `PanelForYou`     | Structural | What the line needs, the first open                                                                     |
| `PlanList`        | Pure       | Its steps, done, now and next, with the work under each                                                 |
| `SinceSummary`    | Pure       | What came after the summary, and the line in the Log                                                    |
| `OwnerBox`        | Pure       | Who owns it and how they are, with Stop, I'll own it or Hand to an agent                                |
| `OwnWorkBox`      | Pure       | On a line the developer owns: add a task or a note                                                      |
| `TellBox`         | Pure       | A message to whoever owns it                                                                            |
| `IssuePanel`      | Structural | An issue or task opened: where it sits, the task or issue, what it frees, pull requests, activity, Tell |
| `TaskFrees`       | Pure       | What a task frees, and who holds it                                                                     |
| `PullRequestBox`  | Pure       | An issue's pull requests and their checks                                                               |
| `DecisionPanel`   | Structural | A question opened: in the queue, held, or answered, with Withdraw, Change answer or Reopen              |
| `DecisionOptions` | Pure       | A question's options as rows, the chosen or recommended one marked                                      |
| `PrPanel`         | Pure       | A pull request: its checks, review, branch and size                                                     |
| `LinkList`        | Pure       | What an item connects to                                                                                |
| `UpdatesSection`  | Structural | Notes posted on an item, and a box to post one                                                          |
| `EventList`       | Pure       | What happened to an item, quiet rows, newest first                                                      |
| `OpenDrift`       | Pure       | What is out of date about an item                                                                       |
| `DriftItem`       | Pure       | One thing out of date: its rule, what is wrong, the suggestion, Updated or Nothing to update            |
