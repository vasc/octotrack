# UI inventory: entity panel (`?ref=`) and decisions components

Everything was read in full: all 23 entity and 9 decisions `.tsx` files, plus the hooks and libs they import (`useOp`, `useChoices`, `useDraft`, `useHome`, `useIssueTell`, `usePlanStep`, `useLineChoices`, `useMarkSeen`, `useDecisionForm`, `useResolveDecision`, `useLinePlace`, `useHotkeys`, `lib/router`, `lines`, `links`, `tasks`, `focus`, `format`, `log`, `said`), the ui primitives they render, `ui.css` media queries, and the core `EntityDetail` / ref schemas. No files were edited.

Paths are relative to `/Users/vasco/projs/octotrack-build/packages/web/src/`.

## How strings and states are produced

**Shared primitives:**

- `LoadingState` renders `"{label}…"`, default `"Loading…"`.
- `ErrorState` renders `error.message`, raw, with role=alert. The server's `hint` is never shown.
- `StaleNote` renders `"Out of date: {message}"`.
- `NotKept` renders `"Not saved: {error}"`.
- `Loaded` shows `LoadingState(label)` until data arrives. If it fails before any data arrives, it shows `ErrorState`. Once loaded, a failed refresh adds a `StaleNote` above the content and keeps the content.
- `Panel` renders a header with the crumbs and a quiet `"Close"` button (aria-label "Close"), then an optional `h1` title, then the body.

**Queries:** queries retry once (`main.tsx` `retry: 1`). So a not-found ref shows `"Loading…"` through one retry before the error appears.

**Errors that can reach the screen:**

- Not found: `"Nothing found for {ref}"`.
- Network down: the browser's fetch message, e.g. "Failed to fetch" or "Load failed".
- Non-JSON server error: a raw JSON parse message.
- Schema mismatch: a raw Zod message.

**Mutation errors are per hook instance.** Every `useChoices()` call creates its own `choiceMake` mutation. A `failure` is visible only where the same instance's `.failure` is rendered, which matters for the Gaps below.

**Undo:** "waits with Undo" means the action becomes a pending choice. It shows in the Undo bar (`layout/PendingChoices`, out of scope), and a refusal at effect time is reported there.

**Keys:** the shell maps `Esc` to `backEntity`: it returns to the `from` ref if the panel was opened from another panel, otherwise it closes the panel.

## Ref kinds and what renders for each

The router is `EntityPanel`, which reads `entityShow`. The panel is mounted by `layout/AppShell.tsx` inside `<Side label={ref}>` whenever `?ref=` is present, and it re-mounts per ref.

| Ref form (core `refs.ts`)                        | Entity returned    | What renders                                                                                             |
| ------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `L-n`                                            | Line               | `LinePanelItem` (own panel)                                                                              |
| `M-n` / `I-n` whose milestone/idea became a line | the Line it became | `LinePanelItem`                                                                                          |
| `M-n` (milestone, not migrated)                  | Milestone          | Generic panel + `EntityBody` fallback: Project / Horizon / Target, then description                      |
| `I-n` (idea, not migrated)                       | Idea               | Generic panel + `EntityBody` idea branch: Project / Horizon / Promoted to / Labels, then body            |
| `KEY-n` (e.g. `OCT-12`)                          | Issue              | `IssuePanel` (own panel). It is a task when `assignee === "dev" && outcome !== null`, otherwise an issue |
| `D-n`                                            | Decision           | Generic panel + `DecisionPanel`: open-in-queue, open-held, or closed                                     |
| `PR-n` or `owner/repo#n`                         | PullRequest        | Generic panel + `PrPanel`                                                                                |
| `DR-n`                                           | Drift              | Generic panel + `EntityBody` drift branch (Rule pairs + suggestion)                                      |
| `U-n`                                            | StatusUpdate       | Generic panel + `EntityBody` markdown body                                                               |
| `KEY` (2–6 chars, e.g. `OCT`)                    | Project            | Generic panel + `EntityBody` fallback: Repo / Horizon / Target, then description                         |
| anything else / missing                          | —                  | Panel with `ErrorState` `"Nothing found for {ref}"`                                                      |

Generic-panel crumbs show `summary.status` as a status badge. The status per kind:

- line: `state`
- project: `planned/active/paused/done/archived`
- issue: `backlog/todo/in progress/in review/blocked/done/cancelled`
- decision: `open/decided/withdrawn/superseded`
- pr: `open/draft/merged/closed`
- milestone: `planned/active/done/cancelled`
- idea: `captured/exploring/planned/promoted/rejected`
- update: `info/progress/warning/blocker/done`
- drift: `open/updated/verified/auto resolved`

The title shown in the generic panel:

- project: its `name`
- update: the first line of its body
- drift: its `message`
- every other kind: its `title`

---

### EntityPanel — components/entity/EntityPanel.tsx

- Kind: panel
- Shown when: URL has `?ref=<ref>`, on any page (AppShell `<Side label={ref}>`).
- Used by: `layout/AppShell.tsx`
- Purpose: loads `entityShow({ref})` and routes to the line panel, the issue panel, or the generic item panel.
- Data shown (generic branch, in order):
  1. Crumbs (`EntityCrumbs`)
  2. `h1` = `summary.title`
  3. `StaleNote`
  4. `EntityBody`
  5. `OpenDrift` (drift excluding the item itself)
  6. `LinkList` "Connections"
  7. `UpdatesSection` "Updates"
  8. `EventList` "History"
- Actions:
  - `"Close"` (quiet) → `closeEntity()`. This clears `ref`, `act` and `from`, closing everything even when opened from another panel.
  - `Esc` (shell) → `backEntity()`.
- States:
  - `detail.data === undefined && error === null`: Panel with an empty crumbs area and `"Close"`, then `"Loading…"`. No title.
  - `detail.data === undefined && error !== null`: Panel with `"Close"` and `ErrorState`, e.g. `"Nothing found for X-9"`.
  - Entity has `doneWhen` (a Line): returns `<LinePanelItem line drift stale/>`.
  - Entity has `priority` and `outcome` (an Issue): returns `<IssuePanel issue detail stale/>`.
  - Otherwise: the generic panel.
  - `stale !== null` (a refresh failed after the first load): `"Out of date: {message}"` at the top of the body.
- Loading: `"Loading…"` inside a bare panel.
- Error: as above; no retry control.
- Empty: n/a (each sub-section hides itself when empty, except Updates, which always shows its box).
- Phone / touch differences:
  - `.ui-side` is fixed to the right at `min(--panel-width, 100%)`, so it is full-screen on narrow screens.
  - At ≤720px, `.ui-panel` padding shrinks to `space-5 / space-8`.
  - Close is a `.ui-button`, so it gets min-height `--touch-target` on a coarse pointer.

### EntityCrumbs — components/entity/EntityCrumbs.tsx

- Kind: primitive-use (crumb strip)
- Shown when: generic `EntityPanel` branch, once loaded.
- Used by: EntityPanel
- Purpose: where the item sits: its ref, kind and state.
- Data shown:
  1. `<code>{summary.ref}</code>`
  2. Badge `{summary.kind}`, raw: `project | issue | decision | pr | milestone | idea | update | drift`
  3. StatusBadge of `summary.status`, humanized (`_` → space)
- StatusBadge tones:
  - good: done, decided, merged, passing, approved, clean, promoted, verified, updated
  - info: active, in_progress, in_review, now
  - attention: open
  - bad: failing, conflicting, changes_requested, blocked, blocker, urgent
  - warn: warning, pending, requested, high
  - neutral: everything else
- Actions: none
- States: single render.
- Loading / Error / Empty: none
- Phone / touch differences: none (`.ui-facts` wraps).

### EntityBody — components/entity/EntityBody.tsx

- Kind: panel (the kind-specific body)
- Shown when: generic EntityPanel branch.
- Used by: EntityPanel
- Purpose: the part of the panel that differs by kind.
- Data shown / States (checked in this order):
  - **Line** (`doneWhen` in entity): `null`. Unreachable, because EntityPanel routes lines away first.
  - **Decision** (`options` in entity): `<DecisionPanel decision waitsFor>`. `waitsFor` is the `fromRef` of every `blocks` link whose `toRef` is this decision.
  - **PR** (`number` in entity): `<PrPanel pr>`.
  - **Issue** (`priority` in entity): `null`. Unreachable via EntityPanel.
  - **Drift** (`rule` in entity): a Pairs list, then Markdown `suggestion`. Null or empty pairs are dropped. Pairs:
    - `"Rule"` = rule
    - `"Target"` = target, as plain text, not a link
    - `"Caused by"` = cause
    - `"Assigned"` = assignee
    - `"Resolved by"` = resolvedBy
    - `"Note"` = note
  - **StatusUpdate** (`level` in entity): Markdown `body`.
  - **Idea** (`promotedTo` in entity): Pairs, then Markdown body when body ≠ "". Pairs:
    - `"Project"`
    - `"Horizon"`: now/next/later/none; `"none"` is shown literally
    - `"Promoted to"`: plain text
    - `"Labels"`: joined `", "`; the pair is dropped when there are no labels
  - **Fallback (Project or Milestone)**: Pairs, then Markdown description when ≠ "". Pairs:
    - `"Project"`: only a milestone has one
    - `"Repo"`: only a project has one
    - `"Horizon"`
    - `"Target"` (targetDate)
- Actions: none in this file (drift has no answer controls here; see Gaps).
- Loading / Error: none
- Empty: an empty `description`/`body` hides the Markdown; null pairs are dropped. For a project with no repo and no target, only `Horizon` remains.
- Phone / touch differences: none specific.

### DecisionPanel — components/entity/DecisionPanel.tsx

- Kind: panel section
- Shown when: `?ref=D-n` (generic EntityPanel, then EntityBody).
- Used by: EntityBody
- Purpose: a question opened by its ref. It is answerable while it is in the queue, otherwise read-only with how it was settled.
- States:
  - `decision.status === "open"`: `OpenDecision`.
  - status `decided` / `withdrawn` / `superseded`: `ClosedDecision`.

#### OpenDecision (internal) — same file

- Purpose: an open question, answered here when it is in the queue.
- Data shown, in a Stack:
  1. `Loaded` (label `"Loading the question"`) around:
     - `card === undefined` (not in the queue): `HeldDecision`
     - otherwise: `DecisionCardItem card active armed={!waiting}`
  2. Actions: `"Withdraw"`.
- Data: `decisionQueue({query:"ref:D-n"})`, and `choices.pending` to compute `waiting`.
- Actions:
  - `"Withdraw"` → choice `decisionWithdraw`, Undo text `"Withdrawing D-n"`. No confirmation.
  - Inside the card: keys `1..n`, `w`, `l` (see DecisionCardItem).
- States:
  - Queue loading: `"Loading the question…"`, with `"Withdraw"` still shown below it.
  - Queue error before load: `ErrorState` message, with Withdraw still shown.
  - Queue refresh error: `"Out of date: …"` above the card.
  - Queue returns `[]`: `HeldDecision`.
  - The answer is pending with Undo: the card's keys are disarmed.
- Loading: `"Loading the question…"`
- Error: queue error as above. A failed Withdraw has no UI (see Gaps).
- Empty: the held view.
- Phone / touch differences: Withdraw button touch height on a coarse pointer.

#### ClosedDecision (internal) — same file

- Data shown, in order:
  1. `DecisionMeta`
  2. Markdown `context` (when ≠ "")
  3. Pairs (null ones dropped):
     - `"Outcome"` = chosen option's label; absent when answered in own words or with no matching key
     - `"Note"` = resolutionNote
     - `"Decided by"`
     - `"When"` = `whenText(decidedAt)` with the leading "at "/"on " removed, e.g. `"07:20"`, `"Tuesday"`, `"1 February"`, `"1 February 2025"`
     - `"How"` = channel humanized: `dashboard | cli | out of band`
     - `"Source"` = external link showing the sourceUrl text
     - `"Superseded by"` = a RefLink
  4. `DecisionOptions` marked `"chosen"`
  5. A single button.
- Actions:
  - status `decided`: `"Change answer"`.
  - otherwise: `"Reopen"`.
  - Either → choice `decisionReopen`, Undo text `"Reopening D-n to change its answer"`, used for both labels.
- States: the button label varies by status; the options section is hidden when there are no options.
- Loading: none. Error: unhandled (Gaps). Empty: options hidden.
- Phone / touch differences: none specific.

### DecisionOptions — components/entity/DecisionOptions.tsx

- Kind: widget (read-only list)
- Shown when: a closed decision (`mark="chosen"`) or a held decision (`mark="recommended"`).
- Used by: DecisionPanel/ClosedDecision, decisions/HeldDecision
- Purpose: a question's options, read only.
- Data shown: Section `"Options"` with a count. One Row per option:
  - lead = option key
  - title = label
  - facts = `"chosen"` or `"recommended"` on the marked key only
  - note = description, when ≠ ""
- Actions: none
- States: `options.length === 0` → `null`.
- Loading / Error: none
- Empty: renders nothing.
- Phone / touch differences: at ≤720px the row facts wrap under the title and the row body is full width.

### PrPanel — components/entity/PrPanel.tsx

- Kind: panel section
- Shown when: `?ref=PR-n` or `?ref=owner/repo#n`.
- Used by: EntityBody
- Purpose: a pull request: where it lives, its checks, review and size, then its body.
- Data shown: Pairs (null ones dropped), then Markdown body when ≠ "". Pairs:
  - `"GitHub"` = link `"{repo}#{number}"`, opens in a new tab
  - `"Checks"` = badge: `none | pending | passing | failing`
  - `"Review"` = badge: `none | requested | approved | changes requested`
  - `"Mergeable"`: `unknown | clean | conflicting`
  - `"Branch"` = `"{head} → {base}"`, or just head when base is ""
  - `"Size"` = `"+{additions} -{deletions}"`
  - `"Author"`
  - `"Synced"` = `whenText`, e.g. `"at 07:20"`, `"on Tuesday"`, `"on 1 February"`
- Actions: the GitHub link (external).
- States: `syncedAt === null` → no Synced pair. `body === ""` → no body.
- Loading / Error: none (comes with its parent).
- Empty: n/a
- Phone / touch differences: `.ui-link` gets an enlarged hit area on a coarse pointer.

### IssuePanel — components/entity/IssuePanel.tsx

- Kind: panel
- Shown when: `?ref=KEY-n` resolves to an Issue.
- Used by: EntityPanel
- Purpose: a task or an issue opened in place. A task shows what to send back and what it frees. An issue shows what it is, its PRs, its activity, and Tell.
- Data:
  - `useHome()`: line lookup, crews, repo names, `taskDone` / `taskCant`
  - `prList({query:"linked:REF kind:pr"})`
  - `useIssueTell`
  - `usePlanStep(line, step)`
  - `issueLinks` → `frees` (this issue blocks) and `waitsOn` (blocks this issue)
- Data shown:
  - Crumbs, in `<nav aria-label="Where this is">`:
    1. The line title as a TextLink, only if the line is in home
    2. `"step {n}"` or `"step {n} of {m}"` once the plan loads
    3. `<code>{ref}</code>`
  - Title `h1` = issue title, for an issue only. A task has no panel title; TaskItem draws its own.
  - Body: see States.
- Actions:
  - Line-title TextLink → `openEntity(line)`, which remembers this issue as `from`.
  - `"Close"` → `backEntity` (back to the panel it was opened from, otherwise closed).
  - A task delegates to TaskItem (Done / Can't via `h.taskDone` / `h.taskCant`).
  - Waiting-on / holds-up refs are RefLinks.
  - TellBox send (useIssueTell → choice `lineTell`, Undo text `"Nudging whoever holds REF"` or `"Telling whoever holds REF: {words}"`).
  - OpenDrift acknowledgements.
- States:
  - `stale` → `"Out of date: {msg}"`.
  - **Task and open** (status not done/cancelled): `<TaskItem>` (home/, out of scope).
  - **Task and closed**: `<TaskClosed closed={howClosed(history)}>` (home/). `howClosed` is done / cant / withdrawn plus who, or null.
  - **Issue**: a Facts row, then Markdown body when ≠ "". Facts:
    1. `"Issue"`
    2. Humanized status, e.g. `"in progress"`
    3. `"nobody holds it"` or `"held by {assignee}"`
    4. `<code>{repoName(project)}</code>`
    5. `"waiting on"` + RefLinks, when any
    6. `"holds up"` + RefLinks, when any
  - **Task**: `TaskFrees` (only issues it frees that exist in `linked`).
  - **Issue**: `PullRequestBox`, then `EventList "Activity"` (history), then `TellBox`, only when `issue.line !== null`.
  - Tell recipient:
    - assignee set: `"{assignee}, who holds {ref}"`
    - otherwise, the line owner is known: `"{owner}, who owns {line}"`
    - otherwise: `null`, so TellBox says `"whoever takes {line}"`
  - Always:
    - `OpenDrift` (all of the entity's open drift)
    - `NotKept` for the tell draft
    - `ErrorState(choices.failure)`. This instance never makes a choice, so it is always null.
  - Not rendered for issues or tasks: Connections, Updates, and History (for tasks).
- Loading: PRs → `"Loading pull requests…"`. The line crumb and owner silently stay absent while home loads.
- Error: PR list error → `ErrorState` inside "Pull requests". Tell draft save failure → `"Not saved: …"`. Failures of Tell, Done or Can't are unhandled here (Gaps).
- Empty: no PRs → `"None yet"`. No history → no Activity section. Nothing freed → no "What it frees". No line → no Tell.
- Phone / touch differences: generic panel/row rules. Coarse pointer enlarges ref and link hit areas.

#### RefList (internal) — IssuePanel.tsx

- Kind: primitive-use
- Shown when: an issue has `waitsOn` or `frees`.
- Used by: IssuePanel
- Purpose: a label followed by refs.
- Data shown: the label (`"waiting on"` / `"holds up"`), then each ref as a RefLink, space-separated.
- Actions: each RefLink opens its ref.
- States: single render.
- Loading / Error / Empty: none (the parent hides it when the list is empty).

### PullRequestBox — components/entity/PullRequestBox.tsx

- Kind: widget (section)
- Shown when: IssuePanel for a non-task issue. Also in the design gallery.
- Used by: IssuePanel, design/StatusGallery
- Purpose: an issue's pull requests with link, checks, size, age and state.
- Data shown: Section `"Pull requests"`. The count is hidden while loading or on error. One Row per PR:
  - title = PR title
  - facts:
    1. External link `"{repo}#{number}"`
    2. Checks: `"no checks"` / `"checks running"` / `"✓ checks pass"` / `"✗ checks failing"` (the failing text uses the stuck tone)
    3. `"+{additions} −{deletions}"`. This uses a U+2212 minus, unlike PrPanel's hyphen.
    4. `"opened {whenText(createdAt)}"`
    5. state: `open | draft | merged | closed`
- Actions: the external GitHub link.
- States:
  - `loading`: `"Loading pull requests…"`
  - `error`: `ErrorState(message)`
  - `prs.length === 0 && !loading && !error`: Note `"None yet"`
  - `prs.length > 0`: the list. It can show together with an error, since a failed refetch keeps previous data; the count is then hidden.
- Loading: `"Loading pull requests…"`
- Error: the error message, no retry.
- Empty: `"None yet"`
- Phone / touch differences: at ≤720px facts wrap under the title.

### EventList / EventRow — components/entity/EventList.tsx

- Kind: widget (section) / row
- Shown when:
  - `"History"`: generic EntityPanel
  - `"Activity"`: IssuePanel, issues only
  - `EventRow` alone: inside SinceSummary
- Used by: EntityPanel, IssuePanel; EventRow by SinceSummary
- Purpose: what happened to an item, newest first as given.
- Data shown: Section `{title}` with count. Each quiet row:
  - title = event summary, with refs clickable (`RefText`, pattern `[A-Z][A-Z0-9]{1,5}-\d+` or `[DMIU]-\d+`)
  - facts = actor, then TimeAgo (`"now"`, `"5m"`, `"2h"`, `"3d"`, or `YYYY-MM-DD`; the full ISO timestamp as tooltip)
- Actions: RefLinks inside summaries.
- States: `events.length === 0` → `null`.
- Loading / Error: none
- Empty: renders nothing.
- Phone / touch differences: facts wrap at ≤720px.

### LinkList — components/entity/LinkList.tsx

- Kind: widget (section)
- Shown when: generic EntityPanel, when links exist.
- Used by: EntityPanel
- Purpose: what the item connects to.
- Data shown: Section `"Connections"` with count. One row per link:
  - title = the other item's title if it is in `linked`; otherwise a RefLink of the other ref
  - facts = relation label, then RefLink, then StatusBadge. The last two only appear when the summary is found.
- Relation labels:
  - Item is the `from` side: humanized rel: `"blocks"`, `"implements"`, `"affects"`, `"derived from"`, `"supersedes"`, `"promoted to"`, `"relates"`
  - Item is the `to` side: `"blocked by"`, `"implemented by"`, `"affected by"`, `"source of"`, `"superseded by"`, `"promoted from"`, `"relates"`
- Actions: RefLinks open the other item.
- States:
  - `links.length === 0` → `null`
  - linked summary missing: title is a RefLink and facts are only the label
- Loading / Error: none
- Empty: renders nothing.
- Phone / touch differences: facts wrap at ≤720px.

### OpenDrift — components/entity/OpenDrift.tsx

- Kind: widget (section)
- Shown when: any item with open drift. Generic panel (excluding the item itself), IssuePanel, LinePanelItem.
- Used by: EntityPanel, IssuePanel, LinePanelItem
- Purpose: what is out of date about the item, each with how to answer it.
- Data shown: Section `"Out of date"` with the count of `status==="open"`. One `DriftItem` (drift/, out of scope) per open drift: rule title, ref, target, `"for {assignee}"`, age, message, suggestion, a `"Note"` box, and `"Updated"` (edge drift only) / verified buttons.
- Actions: acknowledge → choice `driftAck`. Undo text:
  - `"Marking {ref} updated: {note}"`
  - `"Marking {ref} as needing no update: {note}"`
- States: no open drift → `null`.
- Loading: none.
- Error: `DriftItem`'s `error` prop is never passed, and a failed choice request has no UI (Gaps). Refusals at effect time go to the Undo bar.
- Empty: renders nothing.
- Phone / touch differences: row rules; buttons get touch height.

### UpdatesSection — components/entity/UpdatesSection.tsx

- Kind: widget (section with composer)
- Shown when: generic EntityPanel, always: decision, PR, drift, update, idea, milestone, project.
- Used by: EntityPanel
- Purpose: notes on an item; post one, which waits with Undo; list existing ones.
- Data shown, in Section `"Updates"` with count:
  1. Textbox: hidden label `"Post an update on {target}"`, placeholder `"Post an update"`. It is a server draft keyed `update:{ref}`.
  2. Button.
  3. NotKept.
  4. List of updates. Each row: body with refs clickable; facts = level badge (`info | progress | warning | blocker | done`), actor, TimeAgo.
- Actions:
  - `"Post"` (plain), or Cmd/Ctrl+Enter in the box → flush the draft, then choice `updatePost`, Undo text `"Posting a note on {target}: {words}"`.
  - Disabled when the box is empty or a post is pending.
- States:
  - sending: the button reads `"Posting"` and is disabled.
  - draft save failed: `"Not saved: {error}"`.
  - `updates.length === 0`: no list. The section still shows with count `0` and the box.
- Loading: none. The draft fetch is silent and the box starts empty.
- Error: draft save → `"Not saved: …"`. A failed post request → unhandled (Gaps).
- Empty: header `"Updates 0"` plus the box; no message.
- Phone / touch differences: the textarea uses a larger font on a coarse pointer; the button gets touch height.

### LinePanelItem — components/entity/LinePanelItem.tsx

- Kind: panel
- Shown when: `?ref=L-n`, or an `M-n`/`I-n` that became a line. `?act=tell` (from home's `t`) focuses Tell.
- Used by: EntityPanel
- Purpose: a line opened: where it stands, its moves, summary, what it needs from you, plan beside what's new, owner, then Tell or own-work. Opening it marks the line seen.
- Data:
  - `useLineChoices`, `useChoices().waiting`, `useHome()` (home view, crews, repos, failure)
  - `lineShow` (plan)
  - `feedList(sinceSummaryQuery, limit 50)`
  - drafts `tell:L-n` and `own:L-n`
  - `useMarkSeen`; `seenAt` is frozen at mount
- Data shown, in order:
  1. `LinePanelHead`:
     - crumbs: state label, `"Line N of M"` (working / up next only), ref, repos
     - title
     - `"Done when …"`
     - actions: `StartSheet` while starting, otherwise `LineActions`
  2. StaleNote
  3. Mark-seen error
  4. `SummaryBox`
  5. `PanelForYou`
  6. `OpenDrift`
  7. Columns:
     - left: `Loaded("Loading the plan")` around `PlanList`
     - right: Stack of `Loaded("Loading what is new")` around `SinceSummary`, then `OwnerBox`
  8. OwnWorkBox or TellBox
  9. NotKept
  10. `choices.failure`
  11. `h.failure`
- Actions:
  - LineActions:
    - `start` on an up_next or tabled line → opens StartSheet (home/, out of scope). Its onStart → `h.start(ref)`, onCancel closes it.
    - Any other choice → `choices.choose`. Undo texts: `"Starting {title}"`, `"Moving {title} to up next"`, `"Closing {title} as done"`, `"Dropping {title}"`, `"Turning down {title}: not a line"`.
    - Table → `"Tabling {title}"`.
    - Fold → `h.fold`, `"Folding {title} into {other}"`.
  - OwnerBox:
    - Stop → `"Stopping {name}"`
    - I'll own it → `"Taking {title} as yours"`
    - Hand → `"Handing {title} to the agents"`
  - OwnWorkBox:
    - task → `"Adding a task to {title}: {text}"`
    - note → `"Adding a note to {title}"`
  - TellBox → `"Nudging {title}'s owner"` or `"Telling {title}'s owner: {words}"`
  - PanelForYou item actions through `h.*`.
  - `"Close"` / Esc → `backEntity`.
- States:
  - `stale` → `"Out of date: {msg}"`.
  - Mark-seen failed → error Note `"Could not mark {L-n} seen: {message}"`.
  - `starting` → StartSheet replaces LineActions.
  - Bottom box:
    - line `done` or `dropped`: neither box
    - `ownedBy !== null`: `OwnWorkBox`
    - `state === "working"`: `TellBox` (`to` = owner name or null; autoFocus when `act=tell`)
    - up_next / tabled / proposed and not owned: nothing
  - Errors at the bottom:
    - `NotKept(tell.error ?? own.error)`
    - `ErrorState(choices.failure)` for line choices
    - `ErrorState(h.failure)` for home-made choices and line-order/at mutations
  - Home not loaded yet: position is null, `forYou=[]` (PanelForYou hidden), and `crew` is undefined. OwnerBox then shows `"no owner"` for a working line even if it has one (Gaps).
- Loading: `"Loading the plan…"`, `"Loading what is new…"`; the head and summary render immediately.
- Error: plan or feed errors → `ErrorState` in their column; refresh errors → `"Out of date: …"` per column. Plus the mark-seen note, NotKept, and the two ErrorStates above.
- Empty: see PlanList (`"No plan yet"`), SinceSummary (no message), SummaryBox (`"none yet"`).
- Phone / touch differences: `.ui-columns` becomes a single column at ≤720px, so the plan comes first and What's new plus Owner sit under it.

### LinePanelHead — components/entity/LinePanelHead.tsx

- Kind: panel (frame)
- Shown when: every line panel. Also the design gallery.
- Used by: LinePanelItem, design/LinesGallery
- Purpose: the line's head, then its parts.
- Data shown:
  - Crumbs: `LINE_STATE_LABEL` (`"Proposed"`, `"Working on"`, `"Up next"`, `"Tabled"`, `"Done"`, `"Dropped"`), then position (`"Line N of M"` or nothing), then `<code>{ref}</code>`, then one `<code>` per repo name.
  - `h1` = title.
  - Note `"Done when "` + inline markdown doneWhen.
  - `{actions}`, then `{children}`.
- Actions: `"Close"` → `backEntity`.
- States: `doneWhen === ""` → no Done-when note. Position null → omitted.
- Loading / Error / Empty: none
- Phone / touch differences: panel padding at ≤720px.

### LineActions — components/entity/LineActions.tsx

- Kind: widget (action row with modes)
- Shown when: the line panel head, unless starting.
- Used by: LinePanelItem, design/LinesGallery
- Purpose: the moves a line's state allows; Done asks first; rare moves sit under More.
- States:
  - `state` is done or dropped → `null`.
  - `mode==="table"` → `<TableForm title owner held>` (lines/, a sheet, out of scope); submit or cancel returns to the button row.
  - `mode==="fold"` and `onFold` given → `<FoldPicker title targets>` (home/, out of scope).
  - `mode==="done"` → Note `"Done is final."`, then `"Done"` (primary → `onChoose("done")`) and `"Cancel"`.
  - Default row by state:
    - **working**: `"Move to up next"` → queue; `"Table"` → table mode; `"Done"` → done mode; More menu
    - **up_next**: `"Start"` (primary); `"Table"`; More menu
    - **tabled**: `"Start"` (primary); `"Up next"` → queue; More menu (no Table)
    - **proposed**: `"Start"` (primary); `"Up next"`; `"Table"`; `"Fold into"` (only when fold targets exist); `"Not a line"` → reject. No More menu.
  - More menu (not on proposed):
    - icon-only button, aria-label `"More: drop this line, fold it into another"`, tooltip `"More"`, menu label `"More"`
    - `"Drop"` → `onChoose("drop")`, no confirmation
    - `"Fold into another"` → fold mode; disabled when there are no fold targets
- Data shown: buttons only (and the TableForm/FoldPicker sheets).
- Actions: as listed. Menu: arrows move, Esc / tap outside / focus leaving closes.
- Loading / Error: none (failures show at the panel bottom).
- Empty: done or dropped renders nothing.
- Phone / touch differences:
  - On a coarse pointer, the menu icon button is `--touch-target` wide, buttons and menu items get min-height, and menu items have no focus ring.
  - Sheets open from the bottom at ≤720px.

### SummaryBox — components/entity/SummaryBox.tsx

- Kind: widget (section)
- Shown when: every line panel.
- Used by: LinePanelItem, design/LinesGallery
- Purpose: the line's summary and how fresh it is.
- Data shown: Section `"Summary"`. Aside:
  - summary null: `"none yet"`
  - summaryAt null: `"current"`
  - otherwise: `"at HH:MM"`, sliced from the ISO string, so UTC rather than local time

  Body: Markdown headline, then Markdown summary.
- Actions: none
- States: headline null → no headline; summary null → no summary and aside `"none yet"`. Both null → the heading and `"none yet"` only.
- Loading / Error: none
- Empty: `"none yet"` in the aside, empty body.
- Phone / touch differences: none.

### PanelForYou — components/entity/PanelForYou.tsx

- Kind: widget (section)
- Shown when: the line has `forYou` items in `home.lines[ref].forYou`.
- Used by: LinePanelItem
- Purpose: what the line needs from you. The first item is opened and takes the keys; the rest are rows that open in place.
- Data shown: Section `"For you"` with count. One `ForYouRow` per item (home/):
  - collapsed question row: kind `"Question · D-n"` or `"Urgent · {reason} · D-n"`, title, note `"Recommended: {label} · {why}"`
  - the open item: `ForYouItem` (home/), which renders a question via `DecisionCardItem` with a `"Background"` button, or a task / done proposal / done-when proposal
- Actions:
  - Click a row → it becomes the opened item.
  - Opened item: Done / Can't / line Done / Not yet / done-when accept, via `h.*`.
  - A question: options, own words, Later, Background → opens `D-n` in the panel with `from=L-n`.
- States:
  - `items.length === 0` → `null`.
  - The opened one is `armed` unless its choice is pending.
  - If the opened ref disappears, the first item opens.
- Loading: none; hidden until home loads.
- Error: per-item (the card's own error Note).
- Empty: renders nothing.
- Phone / touch differences: the opened item is `data-current`, so option numbers are drawn only on a fine pointer.

### PlanList — components/entity/PlanList.tsx

- Kind: widget (section)
- Shown when: the line panel's left column, after `lineShow` loads.
- Used by: LinePanelItem, design/LinesGallery
- Purpose: the plan's steps (done / now / next), each with its issues and their PRs.
- Data shown: Section `"Plan"`, aside `"step {current} of {n}"` when any step is not done.
  - Step row:
    - lead: `"✓"` done, `"→"` now (first not-done step), `"○"` otherwise
    - title = step title
    - facts: `"now"` (strong tone), `"done"`, or `"next"`
    - children: `WorkList`
  - `"On no step"` row (lead `"·"`, facts = count): unplaced work.
- Actions: RefLinks on issue refs.
- States:
  - No steps and no unplaced work: Note `"No plan yet"`.
  - All steps done: no aside, and every row is `"✓"` / `"done"`.
  - A step with no work: no children.
  - No unplaced work: no "On no step" row.
  - Steps with status `doing` vs `todo` look the same unless the step is the current one.
- Loading: via the parent's `"Loading the plan…"`.
- Error: via the parent.
- Empty: `"No plan yet"`.
- Phone / touch differences: at ≤720px a row body with a lead goes full width, and facts wrap.

#### WorkList / ChecksWord (internal) — PlanList.tsx

- WorkList row:
  - title = issue title
  - facts: RefLink of the issue, humanized status, then for each PR `<code>{repoShort}#{n}</code> {state} {checks}`
- ChecksWord:
  - failing: `"✗ checks failing"` (stuck tone)
  - passing: `"✓ checks"`
  - pending: `"checks running"`
  - none: nothing

### SinceSummary — components/entity/SinceSummary.tsx

- Kind: widget (section)
- Shown when: the line panel's right column, after the feed loads.
- Used by: LinePanelItem
- Purpose: everything newer than the summary, with what was already seen folded to one line.
- Data shown: Section titled `"So far"` (no summaryAt) or `"New since the summary"`. Count = number of newer events. Aside:
  - `"newest only"` when there may be more
  - link `"This line in the log"` → `/log?q=line:L-n` (in-app; Cmd-click opens a new tab)

  Body: unseen `EventRow`s, then Note `"{n} you have seen"`.
- Actions: the log link; RefLinks in summaries.
- States:
  - unseen = 0 → no list
  - seen = 0 → no note
  - nothing newer → heading with count `0` and an empty body
- Loading / Error: via the parent `Loaded`.
- Empty: heading and count 0 only; no message (Gaps).
- Phone / touch differences: facts wrap; the link gets a larger hit area on a coarse pointer.

### OwnerBox — components/entity/OwnerBox.tsx

- Kind: widget (section)
- Shown when: line panel right column; renders only when `line.state === "working"`.
- Used by: LinePanelItem, design/LinesGallery
- Purpose: who speaks for the line, with Stop, I'll own it, or Hand to an agent.
- Data shown: Section `"Owner"`, then one row:
  - `ownedBy !== null`: Row `"You"`
  - no owner: Row `"no owner"`, with note = the step-in reason when the server gives one
  - an owner: Row `{owner.name}`, facts:
    - agent state: `running | asleep | quiet | gone | stopped`
    - `"waits on you"` when waitingOnYou
    - `"helping: {a, b}"`
- Actions:
  - Default:
    - `"Stop {name}"` when there is an owner
    - `"I'll own it"` when the developer does not own the line
    - `"Hand to an agent"` when the developer owns it. If the line names repos, it hands straight away; otherwise it enters the repo picker.
  - Repo picker:
    - List labelled `"Its repos"`, one checkbox row per repo (`h.repos`, project keys), showing `"✓"` when checked
    - `"Hand over"` (primary, disabled until at least one is checked)
    - `"Cancel"`
- States: not working → `null`. The three owner rows and the two action modes above.
- Loading: none. While home loads, `crew` is undefined, so it shows `"no owner"` (Gaps).
- Error: none here.
- Empty: picker with no repos → an empty group and a permanently disabled Hand over (Gaps).
- Phone / touch differences: checkbox rows and buttons get touch height on a coarse pointer.

### OwnWorkBox — components/entity/OwnWorkBox.tsx

- Kind: widget (composer)
- Shown when: a live line (not done or dropped) that the developer owns.
- Used by: LinePanelItem, design/LinesGallery
- Purpose: one box whose words become a task of yours or a note on the line.
- Data shown: Section `"Add a task or a note"`; textbox with hidden label `"Add to {L-n}"` and placeholder `"A task, or a note"`.
- Actions: `"Add as a task"` and `"Add as a note"`, both disabled when empty or sending. No keyboard submit.
- States: `sending` disables both buttons; the labels do not change.
- Loading / Error: none (draft errors via the parent's NotKept).
- Empty: buttons disabled.
- Phone / touch differences: larger textarea font on a coarse pointer.

### TellBox — components/entity/TellBox.tsx

- Kind: widget (composer)
- Shown when:
  - line panel: line is `working` and not owned by you
  - issue panel: a non-task issue with a line
- Used by: LinePanelItem, IssuePanel, design/LinesGallery
- Purpose: a free message to whoever owns the line; empty, it is a nudge.
- Data shown: Section `"Tell {who}"`, where `who` = `to` or `"whoever takes {line}"`. Textbox with hidden label `"Message to {who}"`, no placeholder.
- Actions: one primary button, also Cmd/Ctrl+Enter.
  - `"Tell"` when there is text
  - `"Nudge"` when empty
  - `"Sending"` (disabled) while pending
- States: sending / empty / text; `focus` sets autoFocus.
- Loading / Error: none here.
- Empty: the button reads `"Nudge"`.
- Phone / touch differences: larger textarea font on a coarse pointer.

### TaskFrees — components/entity/TaskFrees.tsx

- Kind: widget (section)
- Shown when: IssuePanel for a task.
- Used by: IssuePanel
- Purpose: what a task frees.
- Data shown: Section `"What it frees"` with count. Each row: title; facts = RefLink, then `"nobody holds it"` or `"held by {assignee}"`.
- Actions: RefLink.
- States: empty → `null`.
- Loading / Error: none
- Empty: renders nothing.
- Phone / touch differences: facts wrap.

---

### BatchPanel — components/decisions/BatchPanel.tsx

- Kind: sheet (container)
- Shown when: on Home, key `r` (useHomeKeys `onRecord`), via `home/RecordAnswers` with `autoFocus`.
- Used by: home/RecordAnswers
- Purpose: record answers given elsewhere, one per line. The text is a server draft (`record-answers`) that follows the developer between devices.
- Data shown: delegates to BatchPanelView. Text is parsed live with `parseDecisionLines`.
- Actions:
  - Typing → draft change (clears the draft when empty) and clears results.
  - Record → `decisionResolveBatch({text, channel:"out_of_band"})`.
  - On success: show the results, keep only the failed lines in the box, and bump `recorded` so the box re-renders even while focused.
- States:
  - `parseError` = the parse message, otherwise `record.error.message`
  - `submitting` = `record.isPending`
- Loading: none (the draft fetch is silent).
- Error:
  - Parse: `"Line {n} is not understood: {line}"`. The hint (`"Expected: D-3 <option-key> [note]…"`) is not shown.
  - Request failure: its message.
  - Per-line failures: in the results list.
  - Draft save failure: unhandled.
- Empty: the Record button is disabled.
- Phone / touch differences: see BatchPanelView.

### BatchPanelView — components/decisions/BatchPanelView.tsx

- Kind: sheet
- Shown when: rendered by BatchPanel. Also the design gallery.
- Used by: BatchPanel, design/DecisionGallery
- Purpose: answers typed one per line: ref, option, optional note.
- Data shown:
  - Sheet titled `"Record answers"`, with a quiet `"Cancel"` in the header.
  - Field, visible label `"Answers"`, multiline, placeholder:
    `"D-3 redis Agreed on the call\nD-4 a\nD-5 - None of the options, doing this instead"`
  - Error Note.
  - List labelled `"Results"`. Each row: kind = RefLink(ref); title `"recorded"`, or the error text, or `"not recorded"`; tone none, or stuck on failure.
- Actions:
  - Foot: primary `"Record {n}"`, or `"Record "` when nothing is parsed. Disabled unless parsed > 0, there is no error, and nothing is submitting.
  - Cmd/Ctrl+Enter submits when ready.
  - `"Cancel"`, Esc, or a tap on the scrim → onClose.
- States:
  - parseError → error Note.
  - results null → no list.
  - submitting → button disabled; no "Recording" label.
- Loading: none
- Error: the Note (error styling, role=alert).
- Empty: disabled `"Record "`.
- Phone / touch differences:
  - At ≤720px the sheet docks to the bottom: full width, max-height 88vh, rounded top, safe-area padding.
  - Wider screens get a centred panel.
  - Coarse pointer: larger textarea font, touch-height buttons.

### DecisionCardItem — components/decisions/DecisionCardItem.tsx

- Kind: widget (stateful card)
- Shown when:
  - entity panel: an open decision that is in the queue
  - home: an urgent / no-line QuestionList item, or a ForYouItem question (also inside PanelForYou)
- Used by: entity/DecisionPanel, home/QuestionList, home/ForYouItem
- Purpose: one question with its form state and number keys.
- Data shown: `DecisionCardView` with `form = useDecisionForm` and `line = useLinePlace(decision.line)`.
- Actions:
  - Keys, only when `active && armed && ownWords===null`: `1..n` → answer option n; `w` → open own words; `l` → Later / Bring back.
  - `"Background"` when the `background` prop is set → `openEntity(D-n)`.
- States: keys are off when inactive, disarmed (answer pending with Undo), or own-words is open.
- Loading / Error / Empty: see DecisionCardView.
- Phone / touch differences: no keys on touch.

### DecisionCardView — components/decisions/DecisionCardView.tsx

- Kind: widget (item)
- Shown when: through DecisionCardItem. Also the gallery.
- Used by: DecisionCardItem, design/DecisionGallery
- Purpose: a question opened: situation, options, the reason for the recommendation, a one-press answer.
- Data shown:
  1. `Item`, tone needs, or stuck when urgent
  2. kind strip = `QuestionStrip`
  3. `h3` title
  4. Markdown context (when ≠ "")
  5. `QuestionOptions`
  6. actions or the OwnWords form
  7. error Note
- Actions:
  - `"In my own words"` → open the box.
  - `"Later"` (not postponed) or `"Bring back"` (postponed) → choice `decisionPostpone`. Undo text `"Putting D-n off until later"` or `"Bringing back D-n"`.
  - `"Background"` when provided.
  - `"Not urgent"` only when urgent and not already sent back → `"Returning D-n to its line, not urgent"`.
  - Picking an option → `"Sending \"{label}\" to {line title or D-n}"`.
- States:
  - `ownWords !== null` (the box is open, or a draft exists from another device): OwnWords replaces the action row.
  - `form.error`: error Note, either the resolve-choice failure message or `"Not saved: {draft error}"`.
- Loading: none
- Error: as above.
- Empty: no options → no option buttons (only own words). Empty context → hidden.
- Phone / touch differences: buttons get touch height.

### QuestionStrip — components/decisions/QuestionStrip.tsx

- Kind: primitive-use (facts strip)
- Shown when: the kind line of every DecisionCardView.
- Used by: DecisionCardView
- Purpose: what the question is, in small facts.
- Data shown:
  1. `"Question"`, or `"Urgent · {something broken | time-boxed | costs money}"`
  2. Urgent with a known line only: `"{n · }{line title}"`
  3. RefLink `D-n`
  4. Not urgent only: `"asked by {requestedBy}"` when it blocks no open work, otherwise `"holds up "` + RefLinks
  5. `"later"` when postponed
  6. each of `card.reasons` as its own fact
- Actions: RefLinks.
- States: as above.
- Loading / Error / Empty: none
- Phone / touch differences: coarse-pointer ref hit area.

### QuestionOptions — components/decisions/QuestionOptions.tsx

- Kind: widget (options)
- Shown when: DecisionCardView.
- Used by: DecisionCardView
- Purpose: answers that say what happens, the recommended one marked, and the why under them.
- Data shown:
  - Option buttons: label, plus a `"recommended"` tag on the recommended one, plus the description as inline markdown with links off.
  - Note `"Why {k}: {why}"`, or `"Why: {why}"` when the recommendation is not among the options.
  - Note `"Recommendation: {key}"` when the recommendation key matches no option.
- Actions: press an option → `onAnswer(key)`.
- States: no options → no buttons; no why → no Note.
- Loading / Error: none
- Empty: no buttons.
- Phone / touch differences: key numbers (`data-choice::before`) are drawn only on a fine pointer, inside a `data-current` container.

### OwnWords — components/decisions/OwnWords.tsx

- Kind: widget (inline form)
- Shown when: DecisionCardView with own-words open.
- Used by: DecisionCardView
- Purpose: answer in your own words.
- Data shown: textbox with hidden label `"Your answer to {D-n}"`, placeholder `"In your own words"`, autofocused.
- Actions:
  - `"Send"` (primary, submit; Cmd/Ctrl+Enter too). Disabled when empty or sending. Undo text `"Sending your words to {line title or D-n}"`.
  - `"Cancel"` (quiet) closes the box and clears the draft.
- States: sending → `"Sending"`.
- Loading / Error: errors show in the parent's Note.
- Empty: Send disabled.
- Phone / touch differences: larger font on a coarse pointer.

### DecisionMeta — components/decisions/DecisionMeta.tsx

- Kind: primitive-use (facts)
- Shown when: held and closed decision views.
- Used by: HeldDecision, entity/DecisionPanel (ClosedDecision)
- Purpose: the question's ref and facts.
- Data shown:
  1. RefLink ref
  2. kind: `technical | architecture | product | approval`
  3. priority, only `urgent | high | low`
  4. project
  5. `"asked by {requestedBy}"`
  6. TimeAgo createdAt
- Actions: RefLink.
- States: priority medium or none → omitted; project null → omitted.
- Loading / Error / Empty: none
- Phone / touch differences: none.

### HeldDecision — components/decisions/HeldDecision.tsx

- Kind: panel section
- Shown when: an open `D-n` that is not in the queue.
- Used by: entity/DecisionPanel
- Purpose: why it is held, then the question read-only.
- Data shown:
  1. DecisionMeta
  2. Note, with refs clickable, giving the reason:
     - blocked: `"held: waits for {A, B}"`
     - `heldAt` set: `"held until its line starts"`
     - otherwise: `"not in your queue"`
  3. Markdown context
  4. DecisionOptions marked `"recommended"`
  5. Note `"Why: {why}"`
- Actions: RefLinks only. It cannot be answered here, though the parent offers `"Withdraw"`.
- States: the three held texts above; context and why each optional.
- Loading / Error: none
- Empty: no options → Options section hidden.
- Phone / touch differences: none specific.

### Out-of-scope children (named, not inventoried)

These belong in their own folders' inventories: `home/TaskItem`, `home/TaskClosed`, `home/StartSheet`, `home/FoldPicker`, `home/ForYouRow`, `home/ForYouItem`, `lines/TableForm`, `drift/DriftItem`, and `layout/PendingChoices` (the Undo bar).

## Gaps

**Errors with no UI**

1. `entity/OpenDrift.tsx:13-31`: a failed `driftAck` request has no UI. Its own `useChoices` failure is never rendered, and `DriftItem`'s `error` prop is never passed.
2. `entity/UpdatesSection.tsx:22-37`: a failed `updatePost` request has no UI.
3. `entity/DecisionPanel.tsx:20,36-41`: a failed Withdraw has no UI.
4. `entity/DecisionPanel.tsx:52,87-94`: a failed Reopen / Change answer has no UI.
5. `hooks/useDecisionForm.ts:35,72-86`: Later, Bring back and Not urgent go through an instance whose failure is never surfaced. `form.error` covers only answer and send-own.
6. `entity/IssuePanel.tsx:45,120`: `choices.failure` belongs to an instance that never makes a choice, so it is always null.
   - A Tell failure (`useIssueTell`'s own instance) has no UI.
   - A task Done / Can't failure (`h.failure`) is not rendered in IssuePanel. LinePanelItem does render it (line 160).
7. `hooks/useChoices.ts:6`: if the pending-choices query fails, `waiting()` silently returns false, so buttons re-enable during a pending send.
8. `hooks/useDraft.ts:18`: a draft fetch failure is silent; the box shows empty.
9. `decisions/BatchPanel.tsx:31,37-41`: a draft save failure (`draft.error`) is never shown.
10. `decisions/BatchPanel.tsx:31`: `record.error` is never reset on edit, so a stale request error stays after the text changes.
11. Every `ErrorState` and Loaded error (`EntityPanel.tsx:22`, `LinePanelItem.tsx:109,113`, `DecisionPanel.tsx:27`, `PullRequestBox.tsx:31`) has no retry control and never shows the server's hint.

**Wrong or misleading content while data loads**
12. `entity/LinePanelItem.tsx:59-64,126-135`: while home loads or fails, OwnerBox shows `"no owner"` with `"I'll own it"` on a working line that may have an owner. Position and For you are blank, with no loading or error indication.
13. `entity/IssuePanel.tsx:48,54`: while home loads or fails, the line crumb disappears and Tell says `"whoever takes L-n"`, with no loading or error indication.

**Missing empty states**
14. `entity/SinceSummary.tsx:47-54`: no new events → only the heading with count 0; no "nothing new" text.
15. `entity/UpdatesSection.tsx:54`: no updates → `"Updates 0"` and the box, no empty text.
16. `entity/OwnerBox.tsx:73-86`: Hand to an agent on a line with no repos and an empty `h.repos` → an empty "Its repos" group and Hand over permanently disabled.

**Interactions with no UI**
17. `entity/EntityPanel.tsx:34-35` + `entity/EntityBody.tsx:25-41`: a drift opened by its own `DR-n` is excluded from "Out of date", but its body has no Updated / verified controls, so it cannot be answered from its own panel.
18. `entity/DecisionPanel.tsx:31` + `ui.css:259-267`: keys 1..n answer the question in the panel, but no `data-current` ancestor exists there, so the numbers are never drawn.
19. `entity/EntityPanel.tsx:21,37`: the generic panel's Close calls `closeEntity`, which ignores `from`. Esc, and Close on line and issue panels, go back to `from`.

**Display bugs and missing feedback**
20. `entity/SummaryBox.tsx:12`: `"at HH:MM"` is sliced from the ISO string, so it shows UTC time, not local.
21. `entity/DecisionPanel.tsx:92`: Reopen on a withdrawn or superseded decision still says `"Reopening D-n to change its answer"`.
22. `entity/EntityPanel.tsx:37` + `decisions/DecisionCardView.tsx:33`: an open in-queue decision shows its title twice (panel `h1` and item `h3`).
23. `decisions/BatchPanelView.tsx:53-55` and `entity/OwnWorkBox.tsx:24-29`: no in-progress label while submitting or sending; buttons only disable.
24. `entity/PullRequestBox.tsx:46` vs `entity/PrPanel.tsx:24`: size uses `−` (U+2212) in one and `-` in the other.

**Data never displayed**
25. Decision `dueAt`, `wakeError` / `wokenAt`, `pickedUpAt` / `pickedUpBy`, `reportStatus` / `reportNote`, `confirmedAt` (`DecisionPanel.tsx`, `HeldDecision.tsx`). There is no UI for "the agent picked up / reported on the answer" or "wake failed".
26. PR `mergedAt`, `closedAt`, `createdAt` (`PrPanel.tsx`).
27. Drift `claimedBy` and `baselineAt` (`EntityBody.tsx:25-41`).
28. Project `checkout` (`EntityBody.tsx:58-69`).
29. Line crew `scoper` and owner-search progress (`OwnerBox.tsx`). OwnerBox is hidden entirely for up_next / tabled / proposed lines (`OwnerBox.tsx:38`).
30. Plan steps with status `doing` look the same as `todo` unless current (`PlanList.tsx:38-40`).
31. A non-task issue shows no Connections and no Updates, and a task shows no history (`IssuePanel.tsx:96-117`).

**Unreachable code**
32. `entity/EntityBody.tsx:16,24`: the line and issue branches are unreachable from EntityPanel; they render `null`.
