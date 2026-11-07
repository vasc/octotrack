# Components

Every component in `packages/web/src/components`. A test fails if one is missing from this page.

**Pure** components get everything from their properties, so they appear on the `/design` specimen and can be changed
in isolation. **Structural** ones load data and pass it on to pure ones, so they hold no look of their own.

## The small vocabulary: `ui/`

| Component     | What it is                                                                       | Notes                                                  |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `Badge`       | A short label with a tone. `StatusBadge` picks the tone from what the word means | Always has words in it                                 |
| `RefLink`     | A ref such as `D-3`, opening that item in the inspector                          | Monospace. Available wherever a ref appears            |
| `RefText`     | Running text in which every ref is a `RefLink`                                   | Use for anything that could mention a ref              |
| `TimeAgo`     | `now`, `5m`, `3h`, `2d`, then a date                                             | The full time is its tooltip                           |
| `Progress`    | A 3px bar                                                                        | Has a text alternative: "1 of 4 done"                  |
| `Section`     | A small heading, with an optional count and link                                 | The unit a page is made of                             |
| `PageHead`    | A page's title, with room for actions                                            |                                                        |
| `ListCapNote` | Says that a list stopped at its limit                                            | A short list must not read as the whole story          |
| `states`      | `LoadingState`, `EmptyState` and `ErrorState`                                    | Empty can show a command to run. See [voice](voice.md) |

## Decisions: `decisions/`

The loudest thing in the product.

| Component          | Kind       | What it is                                                                     |
| ------------------ | ---------- | ------------------------------------------------------------------------------ |
| `DecisionCardView` | Pure       | A whole decision, with its form. An amber left edge means it is waiting on you |
| `DecisionMeta`     | Pure       | The top line: ref, type, priority, project, who asked, how long ago            |
| `DecisionOptions`  | Pure       | The choices, numbered for the keyboard, with the recommendation marked         |
| `QueueRest`        | Pure       | A closed decision: one line with its strongest reason                          |
| `DecisionRow`      | Pure       | A finished decision in the log: outcome, and how it was made                   |
| `BatchPanelView`   | Pure       | Logging decisions made elsewhere, one per line                                 |
| `DecisionCardItem` | Structural | A card with its form state and, when active, its keys                          |
| `QueueSection`     | Structural | The ranked queue, keeping one card open                                        |
| `BatchPanel`       | Structural | The batch panel's parsing and sending                                          |
| `DecisionsPage`    | Structural | The queue, the batch panel and the log                                         |

`DecisionCardView` states:

| State         | Looks like                                                             |
| ------------- | ---------------------------------------------------------------------- |
| Open          | An amber edge. `Decide` is disabled until there is something to send   |
| Active        | Also an amber outline. Number keys and `Enter` act on this card        |
| Option chosen | That option in amber, with `aria-pressed`. Choosing it again clears it |
| Sending       | `Decide` is disabled                                                   |
| Refused       | The card stays, with the server's reason underneath                    |
| Decided       | It leaves the queue                                                    |

## The feed: `feed/`

| Component     | Kind       | What it is                                                                  |
| ------------- | ---------- | --------------------------------------------------------------------------- |
| `FeedItem`    | Pure       | One line: a tone mark, a sentence, and chips that add a filter              |
| `FeedList`    | Pure       | Items, with a heading where the day changes                                 |
| `FilterBar`   | Pure       | The query box, with suggestions. A bad query shows why, and results stay up |
| `ViewTabs`    | Pure       | Saved filters                                                               |
| `FilterBox`   | Structural | A `FilterBar` given suggestions from the tracker's own data                 |
| `FeedSection` | Structural | Loads and pages through the feed                                            |
| `FeedPage`    | Structural | The primary screen. See [patterns](patterns.md#the-feed-page)               |

## Pull requests: `prs/`

| Component      | Kind       | What it is                                                                       |
| -------------- | ---------- | -------------------------------------------------------------------------------- |
| `PrGlyphs`     | Pure       | Checks and review as two labelled glyphs: ✓ ✕ ● – and A C R –                    |
| `PrRow`        | Pure       | Glyphs, title, repo link, and what it needs. `wide` adds size, author and issues |
| `PrStrip`      | Pure       | One line summing up open PRs, for screens too narrow for the rail                |
| `SyncFailures` | Pure       | Says that PR status has stopped updating, and why                                |
| `PrsPage`      | Structural | All pull requests, problems first                                                |

## Drift: `drift/`

| Component   | Kind       | What it is                                                                 |
| ----------- | ---------- | -------------------------------------------------------------------------- |
| `DriftItem` | Pure       | What is out of date, what to do, and how to answer. Answering needs a note |
| `DriftPage` | Structural | Everything out of date                                                     |

`DriftItem` only offers "Updated" for drift caused by an event. Drift about state clears by itself once the state is
right, so there "Nothing to update" is the only answer on offer.

## Work: `issues/`, `projects/`, `roadmap/`, `ideas/`

| Component           | Kind       | What it is                                                                 |
| ------------------- | ---------- | -------------------------------------------------------------------------- |
| `IssueRow`          | Pure       | Ref, title, what blocks it, its PRs and labels, and a status select        |
| `IssueGroups`       | Pure       | Issues by status, whatever is closest to needing attention first           |
| `ProjectCardView`   | Pure       | Progress, and what needs attention. Counts turn amber only when above zero |
| `MilestoneList`     | Pure       | A project's milestones with progress                                       |
| `RoadmapLaneView`   | Pure       | One of now, next or later                                                  |
| `IdeaRow`           | Pure       | An idea, with where it goes on the roadmap, and promote or reject          |
| `IssuesPage`        | Structural | All issues                                                                 |
| `ProjectsPage`      | Structural | All projects                                                               |
| `ProjectDetailPage` | Structural | One project: decisions, milestones, PRs, issues, activity                  |
| `RoadmapPage`       | Structural | Three lanes, and a copy as markdown                                        |
| `IdeasPage`         | Structural | Quick capture, and the list                                                |

## Agents: `agents/`

| Component    | Kind       | What it is                                                |
| ------------ | ---------- | --------------------------------------------------------- |
| `WatchRow`   | Pure       | Who is watching what, in the query the agent itself wrote |
| `AgentsPage` | Structural | Who is waiting now, what is registered, who has been seen |

## The frame: `layout/`

| Component      | Kind       | What it is                                                                   |
| -------------- | ---------- | ---------------------------------------------------------------------------- |
| `NavItem`      | Pure       | A link with a count. The count turns amber when `hot`, and is hidden at zero |
| `SidebarView`  | Pure       | Navigation, connection state and a reminder of the keys                      |
| `RailOverview` | Structural | PR status, waiting agents and drift, beside the feed                         |
| `AppShell`     | Structural | The three columns. Holds the live connection                                 |

## The inspector: `entity/`

Opens from any ref, in the rail, without leaving the page.

| Component        | Kind       | What it is                                                                     |
| ---------------- | ---------- | ------------------------------------------------------------------------------ |
| `EntityHeader`   | Pure       | Ref, kind, status, title and close                                             |
| `KeyValues`      | Pure       | Label and value pairs. Empty values are left out                               |
| `LinkList`       | Pure       | Connections, worded from this item's point of view: "blocked by", not "blocks" |
| `HistoryList`    | Pure       | What has happened to this item                                                 |
| `PrPanel`        | Pure       | A pull request's details                                                       |
| `EntityBody`     | Pure       | Picks the right body for the kind of item                                      |
| `DecisionPanel`  | Structural | An open decision as a card, or a closed one as its record                      |
| `IssuePanel`     | Structural | An issue's details, with its status select                                     |
| `UpdatesSection` | Structural | Updates on this item, and a box to post one                                    |
| `EntityPanel`    | Structural | Loads it all                                                                   |

## Also in the language, not components

| Class     | What it is                                                                     |
| --------- | ------------------------------------------------------------------------------ |
| `.btn`    | A button. `data-primary` is the one action a form is for. At most one per form |
| `.field`  | A text input                                                                   |
| `.select` | A small select, for changing a value in place                                  |
| `.chip`   | Quiet text that acts: a filter, a link                                         |
| `.tab`    | One of a set of mutually exclusive views, with `aria-pressed`                  |
| `.row`    | One line in a list, divided from the next by `--line`                          |
| `.card`   | Only when something needs to read as an object: a project, a roadmap item      |
