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
| `Focusable`    | An item in a page's focus order, where the keys act: tinted across the sheet, with an edge inside, while it has focus                                                                                                      |
| `Facts`        | Small grey facts in a row with dots between; `Fact` makes one stronger, or warm when something is stuck                                                                                                                    |
| `Note`         | A few quiet words that are not the item itself, or a failure with the tracker's hint; `Code` monospace words                                                                                                               |
| `Button`       | The one button: primary (filled, the one way forward), plain (a word that acts) or quiet (a word that steps back). `choice` gives it a key number; `icon` makes it an icon alone on a phone. `IconButton` is an icon alone |
| `Actions`      | A place's buttons in one row that wraps                                                                                                                                                                                    |
| `Options`      | A question's answers, one row each, saying what happens, the recommended one marked, numbered for the keys                                                                                                                 |
| `Field`        | A labelled box to type into: one line, several that grow, or a date. `FieldRow` puts short ones side by side                                                                                                               |
| `TextBox`      | A `Field` that grows as words are typed, whose label is for a screen reader only                                                                                                                                           |
| `SearchField`  | A search box with completions dropping down under it, taken with the arrows and Tab or Enter                                                                                                                               |
| `Menu`         | A button opening a short menu: `MenuItem` a choice, `MenuGroup` a named group, `MenuAction` a thing it does, `MenuNote` a closing line, `Swatch` a theme's colours                                                         |
| `Sheet`        | A task of its own over the whole page and its bar: title and Cancel, content, actions; from the bottom on a phone. New line, Table, Start, Keys, Record answers                                                            |
| `Panel`        | An item opened by its ref: crumbs, title, Close, its sections. `Side` is where it is drawn: over the right of the page, the whole screen on a phone                                                                        |
| `Toast`        | A choice waiting to take effect, or one that failed, with Undo or Dismiss; `Toasts` holds them over the foot of every page                                                                                                 |
| `Pairs`        | Names and values in two columns; `Columns` two columns on a wide screen; `Stack` things one under another                                                                                                                  |
| `Notice`       | A sheet that says where things stand for the page: a heading, a few words, a command, the one thing to do                                                                                                                  |
| `Chips`        | Choices that can each be on or off, as pills that wrap: the first few, then the rest a press away                                                                                                                          |
| `Labelled`     | One fact on its own: a small grey label stacked over its sentence, such as Done when                                                                                                                                       |
| `Callout`      | A few words set apart on a soft ground in a tone: what an agent recommends, why to step in                                                                                                                                 |
| `Waiting`      | A choice made here waiting to take effect, said where it was made with its countdown, and Undo beside it                                                                                                                   |
| `Table`        | Rows of the same few facts under column headings, one sheet; `Cell` is one by the part it plays. On a phone each row wraps                                                                                                 |
| `Badge`        | A state in small words after its mark, never a pill. `StatusBadge` picks its tone and mark from what the word means; `Mark` is a state's icon alone, in its tone                                                           |
| `RefLink`      | A ref such as `D-3` in small monospace, opening the item in the panel; `TextLink` words that open something; `Link` a link to a page or outside, which Cmd opens in a new tab                                              |
| `RefText`      | Running text in which every ref is a `RefLink`                                                                                                                                                                             |
| `TimeAgo`      | `now`, `5m`, `3h`, `2d`, then a date; the full time under the pointer                                                                                                                                                      |
| `Keys`         | A key or chord as the Keys sheet lists it, with Return, the arrows and Option as icons                                                                                                                                     |
| `Triage`       | For you's page: the rail of views and the list; folded to the list alone, moved left, while a peek is open                                                                                                                 |
| `Card`         | The one item open on For you, lifted among the rows of its list and edged in the accent, its title said large                                                                                                              |
| `Queue`        | Everything a view holds as one list: its name and where you are over it, a row each, the open one in place                                                                                                                 |
| `FilterRail`   | The views of what waits on you, one under another with their counts, the one you are in raised; real links                                                                                                                 |
| `NextList`     | Items named as tiles, each a link that opens it, then a closing sentence: what is for you on a line's page                                                                                                                 |
| `PeekLink`     | Words naming something that opens in place beside what you are doing, a real link to its own page; tinted while its peek is open                                                                                           |
| `DetailPage`   | One thing on a page of its own: crumbs, its title, lead and facts with its moves, then a lifted sheet and a column beside it                                                                                               |
| `Waits`        | What waits on a line, a pill at its row's end that leads there: "5 for you", "Step in"                                                                                                                                     |
| `Cleared`      | Nothing left in a view: a check, what is true, a few words on what comes, where to go instead                                                                                                                              |
| `Rail`         | A branch of a plan on a rail under the row it forks from, a group named for the branch                                                                                                                                     |
| `Icon`         | Every icon, from Lucide, drawn in the text's colour; no font character stands in for one                                                                                                                                   |
| `states`       | `LoadingState`, `EmptyState` (with the command that would change it) and `ErrorState`                                                                                                                                      |
| `Loaded`       | A part of the page while it loads or failed to, then the part, marked out of date by `StaleNote` when a refresh fails                                                                                                      |
| `NotKept`      | A draft the server could not keep, until a save works                                                                                                                                                                      |
| `Markdown`     | What agents and the developer write. `inline` for a sentence among other words; `links={false}` inside something clicked                                                                                                   |
| `MarkdownView` | The renderer behind `Markdown`; only `Markdown` imports it                                                                                                                                                                 |

## Screens

Every screen is a composition of the primitives above, and nothing else. **Pure** ones get everything from their
properties and appear on the `/design` specimen; **structural** ones load data and pass it on.

### The frame: `layout/`

| Component        | Kind       | What it is                                                                                                         |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `AppShell`       | Structural | The bar, the page, an opened ref in a `Side`, New line as a sheet over any page, and the keys every page shares    |
| `TopBar`         | Pure       | `AppBar`, one row: the name, Lines, For you with how much waits, then New line and More                            |
| `MoreMenu`       | Pure       | What is used less, behind one button: the Log, Agents, Appearance (the themes in its place) and the keys           |
| `AppearanceMenu` | Pure       | The theme and mode in `MoreMenu`: eight themes in their own colours and three modes                                |
| `UndoBar`        | Pure       | `Toasts`: each choice waiting, with Undo and, for a line's owner, Pause the line instead; failed ones with Dismiss |
| `NotFoundPage`   | Pure       | An address that leads nowhere: what lives here instead, and Go to Lines                                            |
| `PendingChoices` | Structural | The Undo bar on every page, with u undoing the newest                                                              |
| `AppStrips`      | Pure       | What is true of the whole app, under the bar: not live with Try now, a new version with Load it now                |
| `PartBoundary`   | Structural | Catches a bug in one part of the page, so the rest keeps working                                                   |
| `PartFailed`     | Pure       | A part that broke: a bug, not your data; drafts kept; the error to report and Reload                               |

### For you: `foryou/`

| Component       | Kind                                                                                                          | What it is                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ForYouPage`    | Structural                                                                                                    | For you, at `/` and `/for-you/…`: the rail, then every entry as one list, the one you are on open in place; the keys |
| `ForYouRail`    | Pure                                                                                                          | The views as a `FilterRail`, each with its count                                                                     |
| `ForYouCard`    | Pure                                                                                                          | The open entry in a `Card`, in place in its list: the line it is on, which peeks, then the entry; scrolled into view |
| `ForYouEntry`   | Structural                                                                                                    | What the open entry holds, by kind: a question, a task, a proposal, a case for done or a new done when, Step in      |
| `ProposalItem`  | Pure                                                                                                          | A proposed line opened: who proposed it, done when and why now, then its moves numbered, the recommended first       |
| `ForYouListRow` | An entry not open, one row: number, what it is, title, where it sits; a proposal carries its recommended move |
| `ForYouEmpty`   | Pure                                                                                                          | A view with nothing in it, as `Cleared`: who is at work and where the next ask comes from, or the next view          |

### Lines: `home/` and `lines/`

| Component          | Kind       | What it is                                                                                                                                         |
| ------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LinePage`         | Structural | A line on a page of its own, at `/lines/L-1`: its standing and moves, plan, and what is for you beside it                                          |
| `LineForYouHere`   | Pure       | What waits on the developer on one line, as a `NextList` opening each on For you                                                                   |
| `HomePage`         | Structural | Lines: every line in the developer's order, each one row saying how much waits there, which leads to For you; the keys                             |
| `WorkingSection`   | Structural | Working on: a `Section` holding one `List` of lines                                                                                                |
| `WorkingLine`      | Pure       | A working line as one `Row` that opens its page: number (the handle), title, facts, headline, its answers, and `Waits` at its end                  |
| `LineMeta`         | Pure       | A line's facts: who is on it, waiting on you, re-confirming, held, its step                                                                        |
| `LineHandle`       | Pure       | A line's number as a `Menu`: drag it, or open it for Move to top, Up, Down, To up next                                                             |
| `AnswerStatus`     | Pure       | An answer given lately and what became of it, with Change answer                                                                                   |
| `ForYouRow`        | Pure       | An item as a `Row` that opens it, or, with focus, the item itself in a `Focusable`                                                                 |
| `ForYouItem`       | Pure       | The opened item: a question, a task, or a proposal about its line                                                                                  |
| `TaskCard`         | Pure       | A task opened as an `Item`: what to send back, Done, Can't do it and Reply, numbered                                                               |
| `TaskItem`         | Structural | A task with what is typed kept as a draft                                                                                                          |
| `OutcomeFields`    | Pure       | A task's named outcomes side by side, then a note                                                                                                  |
| `TaskClosed`       | Pure       | A closed task: how and when, and what was sent back                                                                                                |
| `LineProposalCard` | Pure       | A case that the line is done, or a changed done when: Done or Not yet, Accept or Keep current                                                      |
| `StepIn`           | Pure       | A line no agent took: why, and the action that fits, filled, with Table it and I'll own it                                                         |
| `LineStepIn`       | Pure       | A working line's Step in, or at a place one row saying why                                                                                         |
| `CheckoutForm`     | Pure       | Set its checkout: a path, Set, Cancel                                                                                                              |
| `SpreadThin`       | Pure       | Past six working lines, the cost in two facts                                                                                                      |
| `WaitingSections`  | Structural | Up next, Proposed, Tabled and Done lately; folds on a phone or at a place; the Start sheet                                                         |
| `UpNextRow`        | Pure       | A line up next as a `Row`: its number, what it holds, how scoped, done when, Start                                                                 |
| `QuietRow`         | Pure       | A tabled or finished line: why it waits, when to look again, Up next and Start                                                                     |
| `ProposalCard`     | Pure       | A proposal as a `Row`: its ref, repos and proposer, what is recommended and why, then that move and Other                                          |
| `ProposalGroups`   | Pure       | Proposals before anything is placed, grouped by what their agents recommend: the first group open with a few, the rest folded to a sample and Show |
| `ProposalCase`     | Pure       | Where its agent recommends it goes and why, or why it was tabled                                                                                   |
| `ProposalChoices`  | Pure       | Start, Up next, Table, Fold into, Not a line or Drop: the recommended one filled, numbered                                                         |
| `FoldPicker`       | Pure       | The lines a proposal could fold into, one button each, numbered                                                                                    |
| `StartSheet`       | Structural | Loads what a waiting line holds and answers its questions in place; its number keys                                                                |
| `StartSheetView`   | Pure       | Start, as a `Sheet`: a changed done when, held questions, its tasks, then Start                                                                    |
| `DoneWhenChanged`  | Pure       | A done when sharpened while the line waited: Accept or Keep current                                                                                |
| `HeldQuestion`     | Pure       | A held question answered in the Start sheet, its answers numbered in the sheet's one run                                                           |
| `FirstRun`         | Pure       | Before anything is placed: the command, or Accept recommended placements                                                                           |
| `NotAnswering`     | Pure       | Lines on first load with the tracker not answering: where, the command to check it, and Try now                                                    |
| `KeyHelp`          | Pure       | The keys, as a `Sheet`                                                                                                                             |
| `RecordAnswers`    | Structural | Record answers, behind r                                                                                                                           |
| `PushToggle`       | Structural | Buzz this device, or how buzzing stands                                                                                                            |
| `NewLineSheet`     | Pure       | New line, as a `Sheet`: what it is, done when, its repos or that it is yours; up next, start, or table                                             |
| `TableForm`        | Pure       | Tabling, as a `Sheet`: why it waits, when to look again, what it holds and who winds down                                                          |
| `PromoteSheet`     | Pure       | Making a branch its own line, as a `Sheet`: title, done when, what moves; up next or start it                                                      |
| `BranchEditSheet`  | Pure       | Changing a branch, as a `Sheet`: its title and its steps, one per line                                                                             |

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

| Component        | Kind       | What it is                                                                                                                |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AgentsPage`     | Structural | Agents: a `Page` with Buzz this device, one `List` of agents                                                              |
| `AgentRoster`    | Pure       | The roster: running, asleep, stopped and gone agents always, quiet ones folded after the first few to one row naming them |
| `AgentRosterRow` | Pure       | An agent as a `Row`: its repo, its line, its last command, its wake; what it is doing; Stop, Lift or Release              |

### An opened ref: `entity/` and `drift/`

| Component          | Kind       | What it is                                                                                               |
| ------------------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| `EntityPanel`      | Structural | Any item by ref, in a `Panel`: a line, an issue or task, or anything else                                |
| `EntityCrumbs`     | Pure       | Where an item sits: its ref, its kind, its state                                                         |
| `EntityBody`       | Pure       | What an item says, by its kind: `Pairs` and its body                                                     |
| `LinePanelItem`    | Structural | A line opened: its head and choices, summary, what it needs, drift, plan, what is new, owner, Tell       |
| `LinePanelHead`    | Pure       | The line's `Panel`: where it is, its title, done when, its choices, and Open the full page               |
| `LineFacts`        | Pure       | Where a line stands in `Facts`: its state, who proposed it or how it closed, yours, its ref and repos    |
| `LineStanding`     | Pure       | Under a line's title: why it waits, the branch it grew from, done when, the recommendation, its moves    |
| `LineMoves`        | Structural | A line's moves: Step in when nobody can take it, else its moves, Start through the Start sheet           |
| `LinePlan`         | Structural | Its plan as a tree, with the sheets that change a branch or make it its own line                         |
| `LineSince`        | Structural | What happened since its summary, and the line in the Log                                                 |
| `LineTell`         | Structural | Tell its owner, or on a line the developer owns, add a task or a note                                    |
| `LineActions`      | Pure       | A line's choices by its state, and More for Drop and Fold                                                |
| `SummaryBox`       | Pure       | Its headline and summary, and when it was written                                                        |
| `PanelForYou`      | Structural | What the line needs, the first open                                                                      |
| `LinePrs`          | Pure       | Its open pull requests, ready to merge first, each out to GitHub                                         |
| `PrChecks`         | Pure       | A pull request's checks in a word or two, failing ones warm                                              |
| `PlanList`         | Pure       | The plan as a tree: its critical path, the step it is on, how many branches are open, work on no step    |
| `PlanStepItem`     | Pure       | One step: done, now or next, what it waits on, its status menu, its issues, the branches forking from it |
| `PlanBranchItem`   | Pure       | One branch on a `Rail`: what it holds up, how far along, its More, its own steps; or the line it became  |
| `BranchMenu`       | Pure       | A branch's More: what it holds up, ticked; change it, make it its own line, remove it                    |
| `WorkList`         | Pure       | The issues on a step, each with its state and pull requests                                              |
| `StepStatusMenu`   | Pure       | A step's status as a menu: to do, under way or done, the one in force ticked                             |
| `SinceSummary`     | Pure       | What came after the summary, and the line in the Log                                                     |
| `OwnerBox`         | Pure       | Who owns it and how they are, with Stop, I'll own it or Hand to an agent                                 |
| `OwnWorkBox`       | Pure       | On a line the developer owns: add a task or a note                                                       |
| `TellBox`          | Pure       | A message to whoever owns it                                                                             |
| `IssuePanel`       | Structural | An issue or task opened: where it sits, the task or issue, what it frees, pull requests, activity, Tell  |
| `TaskFrees`        | Pure       | What a task frees, and who holds it                                                                      |
| `PullRequestBox`   | Pure       | An issue's pull requests and their checks                                                                |
| `DecisionPanel`    | Structural | A question opened: in the queue, held, or answered, with Withdraw, Change answer or Reopen               |
| `AnsweredDecision` | Pure       | A closed question: who answered and how, Answer, Then, and Change answer                                 |
| `PrPanel`          | Pure       | A pull request: its checks, review, branch and size                                                      |
| `LinkList`         | Pure       | What an item connects to                                                                                 |
| `UpdatesSection`   | Structural | Notes posted on an item, and a box to post one                                                           |
| `EventList`        | Pure       | What happened to an item, quiet rows, newest first                                                       |
| `OpenDrift`        | Structural | What is out of date about an item                                                                        |
| `DriftItem`        | Pure       | One thing out of date: its rule, what is wrong, the suggestion, Updated or Nothing to update             |
| `DriftAnswer`      | Pure       | How it is cleared: what to check, the required note, Updated or Nothing to update                        |
| `DriftBody`        | Structural | Drift opened by its own ref: what changed, answered in place                                             |
| `RefNotFound`      | Pure       | A ref nothing answers to: why it may be gone, and a search of the log for it                             |
