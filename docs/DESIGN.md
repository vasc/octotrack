# Octotrack design

## The problem

One developer directs many AI agents across many projects, acting as senior developer, architect and
product manager. The bottleneck is no longer typing code. It is the human making decisions fast enough that
agents stay unblocked, and knowing the shared record is still true after many agents have written to it.

Off-the-shelf trackers assume humans write and humans read. Octotrack assumes **AIs write through a CLI and
one human reads a feed and decides**.

## What was asked for

Quoted from the request that started the project. Everything in the next section is derived from it and is
a decision made during implementation, not a directive.

- "the system is aimed at a single developer organizing many ai agents, across multiple project"
- "the dev will assume the role of senior developer, architect and product manager"
- "a space to track issues, to track projects, to review architectural decisions, to track pr status, to
  capture future ideas and generate road maps"
- "every single thing that can be done must be done in a cli"
- "the point of the dashbaord is to place the most important decisions in front of the developer, for
  unblocking developemnt"
- "those decisions can be done inplace and tracked in place or done out of band and tracked back in batch"
- "its important that the cli allows watch mode so that an ai waiting on a decision will run the cli and the
  cli will hang until theres a change"
- "a rich way to specify what the ai is watching needs to exist"
- "the primary interface should be a feed of status and decisions fully filterable"
- "status of prs should be easily visible"
- "ui must be very fast, no slow loading"
- "primarely be run in one machine with a local sqlite db with the idea that maybe one day it will run on
  cloud flare workers"
- "no authentication for now"
- "create a network of dependencies that require the ai to update or at least check to say 'this is correct
  nothing to update'"
- "the ai should eb able to do several tigns at once"

## Architecture decisions

### D1. One operation registry behind every interface

Every capability is an **operation** (`issue.create`, `decision.resolve`, ...) with a zod input and output
contract. HTTP exposes all of them generically at `POST /api/ops/:name`; the dashboard and CLI are both
clients of that.

- **Why:** the requirement is that the CLI can do everything. Making parity structural beats policing it.
  `octo op <name>` reaches any operation even without a dedicated command, and a test fails if an operation
  has no CLI command.
- **Trade-off:** one generic POST endpoint gives up REST niceties such as HTTP caching. Those do not matter
  on loopback, and uniformity makes batching trivial.

### D2. The CLI is a thin HTTP client and auto-starts the server

- **Why:** many agents run concurrently. A single server process serialises writes and can wake watchers
  instantly from memory, whereas CLI processes writing SQLite directly could only discover changes by polling
  the file. It is also the shape that survives a move to the cloud: only the URL changes.
- **Trade-off:** there is a daemon to manage. The CLI starts it on demand when pointed at a local URL so that
  nobody has to think about it. Direct-to-SQLite would have had no daemon but no instant wakeups.

### D3. Synchronous SQL driver; Cloudflare target is Durable Objects, not D1

`packages/core` talks to a small synchronous `SqlDriver` and imports no `bun:` or `node:` modules (enforced by
a test). The Hono app is runtime-neutral.

- **Why:** D1 has no interactive transactions, and the drift engine needs read-then-write inside one
  transaction. A SQLite-backed Durable Object offers a synchronous SQL API and `transactionSync`, and it is a
  single-threaded single writer that can hold waiters in memory. That is exactly this process model.
- **Trade-off:** synchronous core means a port to D1 would be a rewrite of the storage layer. Accepted because
  an asynchronous driver would have forced mutexes around every transaction locally, for a target that fits
  worse anyway.
- **Not done:** no Worker entry exists yet. Only the seams are in place.

### D4. A single query language for feed, lists and watches

`kind:decision status:open project:OCT,API -actor:bot (priority:urgent OR label:security) "free text"`

- **Why:** the dashboard filter, `octo feed`, `octo find`, list commands and `octo watch` should not each have
  their own filter dialect. An agent that learns one has learned them all, and the human can paste a dashboard
  filter into a watch.
- **Trade-off:** the query is matched in JS after loading candidates, not compiled to SQL. It is simpler and
  fast at the scale of one developer's tracker (thousands of rows). If that ever hurts, push `kind`/`project`
  predicates down to SQL first.

### D5. Watches have event clauses and state clauses

- `--on QUERY` fires on a **new event** matching the query.
- `--until QUERY` fires when **current state** matches, including immediately.
- `--until-none QUERY` fires when nothing matches any more.

Clauses combine with `--any` (default) or `--all`.

- **Why:** an event-only watch has a race. If the human answers between `decision ask` and `watch`, the agent
  hangs forever. A state clause is checked against current state, so it fires at once if the answer is already in.
  Events are still needed for "tell me when anything happens". A hanging watch sees every change. A registered one is
  only evaluated when polled, so something that became true and stopped being true in between goes unseen by a state
  clause.
- **Typos are errors:** closed fields such as `status` and `kind` reject unknown values, and a watch rejects refs and
  projects that do not exist. Otherwise `--until-none 'status:opne'` would match nothing and fire at once, which looks
  exactly like success.
- Watches can be **registered and checked later** (`watch start`, `watch check`, `watch wait a b`), which is how
  one agent keeps several things in flight without being stuck on any of them.
- Long-poll rather than a stream: holds are capped at 25 seconds and the CLI re-polls with its cursor. A server
  restart is invisible to a waiting agent. Each poll also serves as the heartbeat behind "2 agents waiting on
  this" in the dashboard.
- Exit code 124 on timeout, matching `timeout(1)`, so scripts can distinguish it from a failure.

### D6. Drift: the dependency network that keeps the record honest

**Drift** is a tracked claim that something is out of date. An agent clears it by saying either "I updated it"
or "I checked, nothing to update". A note is mandatory either way.

There are two kinds of rules:

| Kind  | Trigger                                                    | Clears when                                      |
| ----- | ---------------------------------------------------------- | ------------------------------------------------ |
| Edge  | Something happened (decision resolved, dependency changed) | An agent acknowledges it                         |
| Level | State is inconsistent (issue done, PR still open)          | State becomes consistent, or an agent attests it |

Level rules are recomputed from scratch at the end of every write transaction rather than tracked
incrementally.

- **Why full recomputation:** idempotent and impossible to get out of sync. Incremental triggers would be faster
  and much easier to get wrong. Each rule is one indexed query.
- **Why attestation fingerprints:** "PR stays open on purpose" must not nag forever, but must nag again if the
  situation changes. Each rule declares a semantic fingerprint (for example `head sha` for failing checks); an
  attestation holds until the fingerprint changes.
- **Why registered watches are not "waiting":** a watch only counts as an agent waiting once it is actually being
  polled. An agent that registered a watch and went off to do other work is not blocked, and should not raise a
  decision's rank.
- **Why `--updated` is checked:** it means the target really changed since the drift opened. Labels, priority and
  assignee do not count, a status update on the item does. On drift about state it is refused outright: that clears by
  itself the moment the state is right, so while it is open the claim would be false. The agent must either fix it or
  honestly say `--verified`.
- **Why every write returns `driftOpened`:** the agent that caused the drift learns about it in the same response,
  which is the cheapest moment to fix it.

### D7. "Several things at once"

The request does not define this, so it is interpreted as all of the following:

- `octo batch`: many operations in one atomic transaction, with `$alias.field` references to earlier results.
- Bulk arguments: `octo issue update OCT-1 OCT-2 --status done`.
- Several registered watches in flight from one agent.
- Claims and `--if-version` so several agents can work concurrently without clobbering each other.

### D8. Decisions are first class, with channels

Every decision records how it was made: `dashboard`, `cli` or `out_of_band`. Out-of-band decisions can be logged
back later one at a time, retroactively (`decision record`), or in bulk (`decision batch`, or the dashboard's
batch panel), with a line format simple enough to type from memory: `D-3 a Went with postgres`.

The queue is ordered by a score: priority, agents currently waiting, open work blocked, age and overdue status.
The reasons are displayed so the ranking is not a black box.

### D9. Dashboard speed

- Local SQLite, a cached bootstrap payload requested by `<link rel="preload">` so data is in flight before JS
  parses, and an in-memory query cache so navigating back is instant.
- SSE pushes changes. The client invalidates only what changed and shows previous data while refetching, so a
  filter change never flashes a spinner.
- No component library, no CSS framework.
- Deciding is not optimistic. A round trip takes single-digit milliseconds on loopback, so there is nothing to hide,
  and removing a card early would unmount the form that has to show the error if the server refuses.
- One decision is open at a time on the feed, the rest are one line each, with `j` and `k` to move. Three open cards
  filled the screen in testing and pushed the feed, the primary interface, out of view.

Measured on the demo data, in a real browser on this machine: first contentful paint at 48ms, bootstrap data in 8ms.
The JS bundle is 418KB (124KB gzipped), mostly React and zod, which is immaterial on loopback but is the first thing
to look at if this is ever served remotely.

- Immutable hashed assets are cached forever; `index.html` is revalidated.

### D9b. Every write reaches the dashboard

The dashboard must show any CLI change without a reload, so every write notifies the stream, unless it is on a short
list of exceptions. It is this way around so that a new operation cannot silently miss the dashboard, and a test lists
every writing operation by hand to keep it honest.

- **Polling is the one exception:** a waiting agent checks constantly, and a notification per check would wake every
  other waiter. A poll notifies only when something a person can see changed: an agent starting to wait, or a watch
  firing.
- **Every stream connection refreshes on opening,** including the first. A write landing between the page's first load
  and the stream connecting would otherwise stay invisible until the next change.
- **Hidden tabs close their stream,** because browsers allow about six connections to one host. Enough open tabs would
  otherwise make every further request hang. They catch up through that same refresh on return.
- **The open decision does not follow the ranking.** Once live updates re-rank the queue, following it would swap the
  card under the developer's fingers, and a keypress meant for one decision would land on another. It stays open until
  it is answered, and a new urgent decision shows up as a line above it.
- **Trade-off:** the client refetches rather than patching in changes. Simple and always correct, and cheap on loopback.
  With a remote server this would want targeted updates.

### D10. No auth, but not an open door

Auth is out of scope. The server still binds to `127.0.0.1`, rejects unexpected `Host` headers (DNS rebinding) and
requires a JSON content type with no CORS (blocks drive-by POSTs from web pages). Without this, any website the
developer visited could approve decisions. It is cheap and does not get in the way of anything.

To use it from a phone, `tailscale serve` proxies the tailnet name to loopback, so the server still binds to `127.0.0.1`.
That name goes in `~/.octotrack/allowed-hosts`. It is a file rather than an environment variable because any `octo`
command can start the server, and that command's environment says nothing about how the dashboard is reached.

- **Trade-off:** with no auth, every device the tailnet's access rules let through can read and answer decisions. Funnel
  must stay off, since it would put this on the public internet.

### D11. PR status comes from `gh`

`octo pr sync` and a background loop in the local server shell out to `gh`, reuse the developer's existing login and
push results through the `pr.sync` operation. References like `OCT-12` in a PR's title, branch or body become
`implements` links automatically.

- **Trade-off:** polling (default 120 seconds, each repo three requests) rather than webhooks, since there is no public endpoint on a laptop.
  `pr.upsert` remains available for anything else that wants to report.
- **Bounded requests:** up to 50 open, 20 merged and 10 closed PRs, as separate calls. Asking for 100 PRs with their
  check rollups got a 504 from GitHub on a busy repo. A tracked open PR missing from those lists is looked up on its
  own, so that one merged while the laptop slept does not stay open forever. A repo with more than 50 open PRs only
  shows the 50 most recent.
- **Noise on busy repos:** `pr-without-issue` and friends flag every matching PR, which suits repos where agents open
  the PRs. On a large shared repo that is a lot of drift. Rules cannot be switched off per project yet.

### D12. Delivering answers: an inbox, and waking only on request

Answering a decision used to reach an agent only if it was hanging on `--wait` or a watch. In first real use, nine answers
were recorded correctly and no session acted on them until each was messaged by hand. Comments from the developer on the
proposal: "not overfitting to Claude code", "letting the session decide if it want to be reawaken", and that it would be great
if "we can avoid having the session actively hang on octo".

- **An inbox any tool can use.** `octo inbox`, `decision pickup` and `decision report` are plain CLI commands keyed on the
  agent's name. An answer moves through not picked up, picked up, and carried out or partly carried out. An agent that answers
  its own question skips this. A changed answer is delivered again.
- **Waking is opt-in, per decision.** `--wake adapter:address` on asking, or `decision wake` later. The default is the inbox.
- **One dispatcher instead of many waits.** A loop in the server wakes sessions, so nothing hangs. It marks a wake before
  running it, so a crash leaves a session unwoken rather than woken twice, and the answer is still in the inbox.
- **The tracker knows no tool.** It stores an opaque address. An adapter in `~/.octotrack/wake-adapters.json` turns that into
  a command, so another tool needs one more entry and no code.
- **A request can never supply the command.** There is no authentication (D10), so that would let any device that can reach
  the server run anything. Addresses are also narrow enough that they cannot pass for an option or mean anything to a shell, no
  shell is involved, and the wake message holds only the ref, so tracker text never becomes a prompt.
- **Trade-off:** one attempt per answer rather than retries. A retried wake could start a second run of an agent, which is
  worse than an answer waiting in an inbox where the dashboard shows it.

## Proposed, not built: lines of work at the centre

A design proposal, not a description of the code. It is drawn on the design canvas as direction E, "One list", beside
four earlier directions it was built from. Nothing below is implemented on main.

What the developer said, after a week of use. Their words, quoted exactly:

- "ui is a bit unpolished, besids the general unfinished vibe im seeing lack of markdown support, issues having too small of
  a ui, updates not having auto growing input box, and a general database management ui setup, here are all the fields in a
  flat list of tables, instead of properly think through the hierarchy of information and how things connect together"
- "basiclly only the decisions part really worked, the usage was way too much focused on decisions with the integration
  with other features very sparse and not useful"
- "project/roadmaps weren't helpful at all, I want projects to be lines of work and I want to be very clear what we are
  working on whtat is tabled and what we have planned"
- "keeping in mind that this is not for humans with limitid time spans, ais have virtually infinite time to keep it
  uptodate, complexity is expected so that simplicity can be achieved, the agents od the hard work to make everything
  simple and clear so that things can be acted on quickly, right now the operator needs to read millions of lines of text
  to get context on one decision"
- "projects and roadmaps needs to be at the center, feed works well but its it can sometimes get in the way with decisions
  about projects that are currently tabled"
- "One project is a line of work"

The one-project-per-repo layout in the tracker today was set up by an agent, not chosen by the developer, so it is no
evidence of how projects are meant to be used.

Everything below is a design decision made from that, with its reasoning.

- **A line of work is the unit.** A line has a goal ("done when", one sentence), an end, and a state the developer sets:
  working on, up next in order, or tabled with a reason, then done or dropped. Agents can also leave a line proposed.
  Nothing sits above lines. A line names one or more repos; one repo can serve several lines, and looking at one repo is
  a `repo:` filter on the log and in queries, not a layer or a screen. _Trade-off:_ no grouping to fold many lines
  under. A filter covers that until a long list shows it is needed.
- **One order drives everything.** The developer orders the lines by drag handle, by a Reorder mode (to top, up, down,
  to up next), or with alt and the arrow keys. That order decides what reaches the developer first, which line an agent
  takes on, and the order of the log. Within a line, questions and tasks follow the plan step they hold up, and Later
  moves one to the bottom of its own line. _Why:_ a computed score competed with the developer's own priorities and had
  to be second-guessed. _Trade-off:_ a pressing question on a low line waits, so urgent jumps the order. Urgent is for
  questions on working lines only and needs a reason from a fixed set (time-boxed, costs money, something broken); the
  developer can send it back with Not urgent, which is noted in the line's log so a habit shows.
- **The home screen is one list.** Each working line shows its summary's headline and the first thing waiting on the
  developer, with the rest one row away ("+2 more for you"); only the focused item opens fully, with what each option
  does. That keeps five lines on about one screen. An urgent question sits at the very top, in red, distinct from focus.
  Below it, "Step in" holds only two kinds of trouble: an agent writing where it may not, and a working line that has
  work and no owner and could not be given one. Unfocused questions show their title and recommendation as one row that
  opens them; answer buttons appear only on the focused, opened question. Up-next rows show their done when and how far
  scoping got; the tabled row names its lines; done lines stay a few days under Done lately. The header counts what is
  waiting (to answer, to do, to accept, to step in), and each count links to the first such item in focus order. _Why:_
  the first drafts stacked a queue above the list, so the same lines were read twice and the lines were not at the
  centre.
- **Any ref opens in place.** A task or an issue opens in the same panel as its line, from the list, the log or a
  summary. A task shows what to send back as a form: Done sends what is filled, and Can't do it… asks why and closes it
  as not done. An issue shows its pull request with its checks, and plan steps show them too. Everything written, by
  agents or the developer, is markdown, and every box grows as you type. _Why:_ the developer named "lack of markdown
  support, issues having too small of a ui, updates not having auto growing input box", and pull request status has to
  be visible without leaving the line. Checks are agents' to fix, never the developer's: a failing check counts as work
  on the line, so some agent takes it.
- **The developer orders, answers, does, tells, stops and accepts.** Everything else belongs to the agents: issues,
  plans, pull requests, scoping, and keeping each line's summary true. Agents is a roster (name, repo, line and role,
  last command, wake address, what it is doing) whose only action is Stop, or Lift on a stopped agent: what needs the
  developer is on Lines. A line's panel also offers Stop on its owner and I'll own it, beside the owner.
- **Agents register, take, and release, all through commands.** An agent is one named session. Its first command
  registers its name, its repo from the git remote, its checkout path, and a wake address or none. It is running while
  it has run a command or pushed in the last 15 minutes, and otherwise asleep if it has a wake address, or gone after
  two quiet hours without one; it is idle when it holds no claim, and reachable when it is in a watch poll or has a wake
  address. `line take [REF]` is one atomic step that also claims the issue it hands out: the named line if it is free,
  otherwise the highest working line that has work in the agent's repo and no owner; failing that, a helper's place on
  the highest owned working line with work in its repo; failing that, scoping the highest unscoped up-next line in its
  repo. Work is an open issue on the line, in that repo, not blocked, not the developer's, and not claimed by another
  agent. While all of a line's open work waits on the developer, an owner that can be reached (a wake address, or a
  watch poll) keeps the line and is woken by what the developer sends; one that cannot loses it after two quiet hours
  like any other. While there is agent work, every command, every watch poll, and every push that pull request sync sees
  on an issue it claimed renew its claims; `line release`, two quiet hours, a failed wake, or Stop end them. A last
  owner whose first command comes inside its 10 minutes of first refusal takes the line back without asking; one that
  comes back after another agent took the line is told it is now a helper, and its summary writes are refused. _Why:_
  Octotrack sees only commands and pull request sync, so every rule is stated in those; "the top line first" would pile
  every idle agent onto line one; and a crash, a clean exit and a line waiting on the developer each come out right
  without the developer.
- **Each working line has one owner.** The owner writes the summary, files questions and tasks, proposes done, and is
  the one a Tell is for. Helpers may work under it, never writing the summary.
- **Everything sent goes to the line, not the agent.** Answers, Tells and finished tasks wait in the line's inbox. The
  owner is woken if it left a wake address; a line with no owner gets one as below, and whoever takes it reads the
  inbox. Every reply to an agent's command carries its unread notices (an answer, a Tell, a wind-down, a Stop), so even
  an agent that never checks its inbox hears in time. _Why:_ questions stand alone, so any owner can act on their
  answers, and a dead owner then holds nothing up. The session still decides "if it want to be reawaken", once, by
  leaving a wake address or not.
- **A working line with work always gets an owner, without the developer.** The search starts the moment a working line
  has work and no owner: on a lapse, a release, Stop, Start, or a failed wake. In order: the last owner, woken, with 10
  minutes of first refusal (skipped when the search began with its own failed wake, since D12 never wakes twice); then
  agents with the repo and no claim that can be reached now, the most recently active first (one in a watch poll gets
  the offer in its poll reply, one with a wake address is woken; one with neither is skipped). Each step ends as soon as
  it cannot succeed. When the steps are used up, or 30 minutes after the search began, Octotrack runs the start command
  from the developer's local agent setup, in the checkout, from the repos table, of the repo that holds the line's first
  unclaimed work in plan order, passing only the line's ref so tracker text never becomes a prompt, up to a number of
  sessions the developer sets. Starting a line runs the same steps at once. The line reaches Step in only when no start
  command is set (it then offers the command to copy), the start failed, or the cap is reached, with Table it… and I'll
  own it beside. _Why:_ a line the developer marked working should not sit idle for want of a click the tracker can
  make. _Trade-off:_ sessions are spent without asking each time; the cap bounds that.
- **The developer can own a line.** "I'll own it" makes it theirs: it shows their tasks and notes, added with one
  growing box, and no summary falls due. No agent writes to it until "Hand to an agent…", which asks for its repos.
- **What agents may write depends on the state.** Working on: anything. Up next: scoping only (done when, plan, held
  questions and tasks), never code, by an agent that took it to scope. Tabled, done and dropped: nothing. Moving a
  working line to up next or tabled, or ending it with Done or Drop, gives its owner and helpers 15 minutes to park: a
  hand-off summary, reports on answers already taken, a branch note, and for Done and Drop, closing or folding into
  another line every open issue and pull request, and a closing note. Then the claims end. An ended line's drift is
  discarded, and anything still open is listed once in the log. A write refused after that is recorded and always shown
  in the log, and so is a pull request opened or pushed for an issue on a line that is not working, which pull request
  sync sees even when the agent never calls the tracker; it is put on the issue's claimant, else the line's last owner,
  and when there is neither, Step in shows "pushes to a tabled line" with Close the pull request instead of Stop. Three
  in an hour put the agent under Step in with Stop. Wind-down notices reach helpers too. Stop refuses every write under
  that agent's name, sends it a notice, runs the developer's local stop command if one is set, and marks it stopped on
  Agents until lifted. _Trade-off:_ Octotrack cannot kill a session; refusing its writes and telling it is what it can
  do.
- **Questions stand alone.** Asking requires a situation written for someone who has read nothing else, options that say
  what happens if picked, and the reason behind any recommendation. Both are shown wherever a question is open, phone
  included. Background stays folded. _Why:_ "the operator needs to read millions of lines of text to get context on one
  decision".
- **Things only the developer can do are tasks, not questions.** A question has options; a task has an outcome to
  report: a measurement, a login, a play-test. In the tracker today most blocked issues are tasks in disguise ("waiting
  on Vasco"), and nobody is told. A task is an issue assigned to the developer, with a place and an outcome, so it
  always has a ref, and it waits on its line in the developer's order. Places are a fixed list the developer owns (the
  bench, the Mac, the phone, the house), and the CLI refuses any other. "I'm at" keeps the same list and order, opens
  that place's tasks, folds everything else (questions included) to one row per line, adds tasks for that place held on
  up-next lines (never tabled ones), and ends by itself after a few hours. Drift asks agents to turn
  blocked-on-the-developer issues into tasks.
- **A question a task would settle waits for the task.** When a pending task's outcome would settle a question, the
  question is linked as blocked by the task, held and not shown, and withdrawn if the outcome settles it; the agent
  decides the rest. _Why:_ asking the developer what their own measurement is about to answer is the decision the design
  exists to remove.
- **Up-next and tabled lines hold their questions, tasks and drift.** Tabling asks for a reason and an optional date to
  look again; on that date the line comes back under Proposed, counted as to accept, with the choices any proposal has
  (Drop in place of Not a line). A tabled line can go back to up next. A held question or task is current when it was
  asked or re-confirmed in the last 7 days; any other goes to the agent that takes or scopes the line next, to
  re-confirm or withdraw, before it reaches the developer, and Start shows only current ones. _Trade-off:_ a question
  can wait a long time, which is why age alone decides whether it is trusted.
- **Every choice can be undone, and answers say what became of them.** Every choice, by key or tap, waits a few seconds
  with Undo before it takes effect: an answer, Start, Table, Done, Stop. An answer then shows one status sentence on its
  line: not picked up, picked up, carried out, or that a wake failed. After that, Change answer… reopens the question
  and sends the new answer as replacing the old; if the old one was carried out, the owner reverts or adapts. _Why:_
  state changes are reachable by number keys, so a stray key must cost nothing. An answer closes one question; Tell is a
  free message that closes nothing: to the owner, or, opened from an issue, to the agent holding that issue, and the box
  names who; empty, it is a nudge.
- **Summaries stay true without anyone reading history.** A summary opens with a headline written to stand alone; home,
  the log and the phone show only the headline, the line shows the rest. The owner rewrites both at the end of a
  session. They fall due an hour after significant work. Significance is decided by what happened, not by the agent: a
  plan step changed, an issue closed, a question asked or answered, a pull request merged. Until they are rewritten, the
  line lists everything newer than its summary, one line each, with what the developer has already seen folded to one
  row; only the log filters by seen.
- **Agents propose, the developer accepts.** Agents propose a line when they find work with none, or when the developer
  starts something new in conversation. Every proposed line offers the same five choices: Start, Up next, Table… (which
  asks why), Fold into…, Not a line. Agents also propose a line as done, with how "done when" was met; that proposal is
  the line's first item, on its own row, with Done and Not yet…. Done… on a line is the developer's own decision and
  final: the owner closes out, and its closing note says how done when was met, or what is not. Both kinds count in the
  header as "to accept". A line the developer adds names its repos, or says it is theirs, and goes to up next, starts,
  or is tabled with one button each. Nothing joins or leaves the list without the developer's yes. On first run, agents
  propose lines from the tracker's existing projects, splitting where one project held several, and the developer sorts
  each once.
- **Done when changes only with the developer's yes.** Any change to done when after the line exists, by any agent and
  on any state, is an item to accept on that line, with Keep and Revert, counted in to accept, never held, and never
  folded in the log. _Why:_ done when says what the line is and when it ends.
- **The log shows what has not been seen,** line by line in order. A line counts as seen once opened, or with Mark all
  seen. Each change is a row, except checks, drift confirmations and re-confirmed questions, which fold into one
  sentence. Up-next and tabled lines are left out unless asked for; refused writes never are.
- **State changes are buttons, never radio buttons,** so no arrow key can table a line. Reorder buttons are at least
  30px tall; every target on the phone is at least 44px.
- **Keys move the browser's own focus.** j and k move focus between items, top to bottom as drawn: an urgent question,
  Step in, the lines, then Proposed. Tab moves within the focused item, and 1–9 pick its numbered choices: an option, a
  step-in action, a proposal's choice, or Done and Not yet. There is only one focus, marked with a dark outline and the
  word Focused, so a key never acts on an item other than the one in focus. Live updates never move it: new items appear
  without taking focus. After a choice, focus goes to the line's next item for you, then the next line; after Later, to
  the next item. Keys never act while typing, u undoes the last choice while it waits, and all of them are listed behind
  "?".
- **Interruptions are rare.** The phone is interrupted only for urgent questions and questions on the top two lines, by
  Web Push to the app installed from the Tailscale HTTPS address. One tap answers, and a second notification holds Undo
  while the answer waits. Tasks never buzz: they wait for "I'm at". _Trade-off:_ Web Push needs the server to reach the
  browser's push service, an outbound connection D10 did not have; nothing new reaches in.
- **One vocabulary:** line, working on, up next, tabled, done, dropped, proposed; summary, headline, done when, plan,
  step; agent, owner, last owner, helper, claim, wake address, inbox, running, idle, reachable, asleep, gone; issue,
  pull request, check, ref; question, situation, task, place, held, later, urgent; for you, step in, tell, stop,
  stopped, lift, scope, take, release, wind-down; log, seen. A line is waiting on you when all its open work waits on
  the developer, agents on it when an agent has work on it, and has no owner when work is left and no agent holds it.
  Contracts and the CLI use the same words. Refs keep their prefixes, because a ref never changes once written: L-12 is
  a line, D-34 a question, PANEL-6 an issue in the homepanel repo.

What it would change in what is built:

- **Refs.** Lines get their own refs (L-12). Every existing issue ref stays valid, because today's project keys become
  repo keys: PANEL-6 is an issue in vasc/homepanel, on whichever line its line field names, and Fold into… moves it
  without changing its ref. Issues on a developer's line with no repo take one fixed prefix, ME.
- **Data.** Today's projects become repos: key, GitHub repo, checkout path, start command. Lines are a new table: state,
  order, done when, repos, headline and summary with the time each was written and falls due, owner and last owner, the
  tabled reason and look-again date, the wind-down deadline, and the developer's last look, which drives seen. First run
  fills it from the agents' proposals, splitting where one project held several. Issues gain a line and a plan step.
  Milestones become plan steps: an ordered list per line, which questions and tasks name as what they hold up. Questions
  gain the urgent reason and any Not urgent; questions and tasks gain held and the time they were last confirmed; tasks
  gain a place and outcome fields. Agents get a table: name, repo, wake address, last command, stopped, started by
  Octotrack, and unread notices. Each line's inbox is a table: kind (answer, tell, task done), ref, and delivery state.
  Choices waiting out their Undo are server state, so the phone's Undo notification can cancel them, as are Web Push
  subscriptions and "I'm at" with its expiry. Refused writes are recorded events. Places live in `~/.octotrack/places`,
  beside the allowed hosts, edited with `octo place`; `~/.octotrack/agent-setup.json` holds one stop command and the
  cap, which counts sessions Octotrack started that ran a command in the last 15 minutes.
- **Operations.** Kept: issue claim and release (take uses them), decisions with pickup and report, drift (keyed on line
  instead of project), watches (a poll renews claims), pull request sync. Changed: projects become repos and lines; the
  `project:` query key becomes `repo:`, `line:` is added, and existing watches are rewritten to `repo:`; `next` becomes
  `line take`; milestones become plan steps; ideas become proposed lines; status updates (U-) become summaries with
  headlines. Added: `pr close`, which writes through `gh` for Step in's Close the pull request, so D11 no longer only
  reads. Removed: roadmap generation, since the ordered list is the roadmap.
- **Decisions it replaces.** D8's score gives way to the developer's order. D9's feed as "the primary interface", with
  one decision open on it, gives way to the home list and its one focus. D4's `project:` becomes `line:`. D11 syncs the
  repos that lines name. D12's inbox moves from the agent to the line, and its per-decision wake becomes a wake address
  registered once per agent.
- **A requirement it supersedes.** "the primary interface should be a feed of status and decisions fully filterable"
  came first; "projects and roadmaps needs to be at the center, feed works well but its it can sometimes get in the way
  with decisions about projects that are currently tabled" came after a week of use, and wins. The feed lives on as the
  log.
- **Built only once agreed.** An exploratory branch, `lines-of-work`, tried an earlier version of this model in code. It
  added an "area" layer above projects, which this proposal drops, so it is research, not the starting point.

## Data model

Everything is addressed by a **ref**: `OCT` (project), `OCT-12` (issue), `D-3` (decision), `PR-7` or
`owner/repo#12` (pull request), `M-2` (milestone), `I-4` (idea), `U-9` (status update), `DR-5` (drift), `W-1`
(watch). Links connect any two refs:

| Relation       | Meaning                                | Effect                                            |
| -------------- | -------------------------------------- | ------------------------------------------------- |
| `blocks`       | from must finish before to can proceed | readiness, score, `blocked-issue-unblocked` drift |
| `implements`   | PR implements issue                    | PR and issue status drift                         |
| `affects`      | decision changes what to should say    | drift on resolve                                  |
| `derived_from` | from is derived from to                | drift when to changes                             |
| `supersedes`   | decision replaces decision             | history                                           |
| `promoted_to`  | idea became issue/milestone            | history                                           |
| `relates`      | informational                          | none                                              |

The append-only `events` table is the feed and also what event clauses in watches match against.

## Known limits

- Query matching and drift recomputation are linear in tracker size. Fine for thousands of rows, not millions.
- One feed request scans at most 5000 events, so as not to hold up writes. The CLI and dashboard keep asking until they
  have a full page, so a rare filter on a very long log takes several requests.
- Every waiting agent re-evaluates on every write. With 40 agents hanging, a write takes about 290ms instead of 6ms.
- PRs are synced for repos that a project names. A PR reported by hand for any other repo is never refreshed.
- Lists stop at their limit with no paging: the dashboard says so, and the CLI allows `--limit` up to 1000.
- A decision's `--recommend` may be free text, so a mistyped option key is shown as text rather than refused.
- PR status is only as fresh as the sync interval.
- No Worker entry yet; D3 keeps the seam, not the implementation.
