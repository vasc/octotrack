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
  Nothing sits above lines. A line names the repos it touches; one repo can serve several lines, and looking at one repo
  is a filter, not a layer. _Trade-off:_ no grouping to fold many lines under. A filter covers that until a long list
  shows it is needed.
- **One order drives everything.** The developer orders the lines by drag handle, by a Reorder mode (to top, up, down,
  to up next), or with alt and the arrow keys. That order decides what reaches the developer first, which line an agent
  takes on, and the order of the log. Within a line, questions and tasks follow the plan step they hold up, and Later
  moves one to the bottom of its own line. _Why:_ a computed score competed with the developer's own priorities and had
  to be second-guessed. _Trade-off:_ a pressing question on a low line waits, so urgent jumps the order. Urgent needs a
  reason from a fixed set (time-boxed, costs money, something broken), and the developer can send it back with Not
  urgent, which counts against the agent.
- **The home screen is one list.** Each working line shows its summary and the first thing waiting on the developer,
  with the rest one row away ("+2 more for you"); only the focused item opens fully. That keeps five lines on about one
  screen. An urgent question sits above line 1, in red, distinct from focus, with its options. A "Step in" section above
  the list holds what is going wrong: an agent breaking the order, a line with work and no owner for 12 hours, a wake
  that failed. The header counts what is waiting: to answer, to do, to accept, to step in. _Why:_ the first drafts
  stacked a queue above the list, so the same lines were read twice and the lines were not at the centre.
- **The developer orders, answers, does, tells, stops and accepts.** Everything else belongs to the agents: issues,
  plans, pull requests, and keeping each line's summary true.
- **Each working line has one owner.** An agent is one named session. The owner writes the summary, files questions and
  tasks, proposes done, and is the one a Tell reaches. Helpers may work under it but never write the summary. The owner
  keeps the line while its session runs, asleep waiting on the developer included; the claim lapses when the session
  ends or cannot be woken, and moving the line to up next or tabled ends it. Agents take only working lines: one asking
  what to do gets the highest working line that has work it can do, in a repo it has, and no owner. The developer can
  own a line too ("I'll own it"); it then shows only their tasks and no summary falls due. _Why:_ "the top line first"
  would pile every idle agent onto line one, and two writers would fight over one summary.
- **A line without an owner is normal.** It reaches Step in only when it has work and no agent has taken it for 12
  hours, offering Start a session, Table it… and I'll own it. Start a session runs the start command from the
  developer's local agent setup in the repo's checkout; without one configured, it gives the command to copy. _Why:_
  showing every unowned line would fill Step in each morning, after sessions ended overnight.
- **What agents may write depends on the state.** Working on: anything. Up next: scoping only (done when, plan, held
  questions and tasks), no code, by an agent the developer sends there or the one that proposed the line, without a
  claim. Tabled, done and dropped: nothing. A refused write is recorded and always shown in the log, and an agent that
  keeps trying appears under Step in with Stop.
- **Questions stand alone.** Asking requires a summary written for someone who has read nothing else, options that say
  what happens if picked, and the reason behind any recommendation, which is shown on every surface, phone included.
  Background stays folded. _Why:_ "the operator needs to read millions of lines of text to get context on one decision".
- **Things only the developer can do are tasks, not questions.** A question has options; a task has an outcome to
  report: a measurement, a login, a play-test. In the tracker today most blocked issues are tasks in disguise ("waiting
  on Vasco"), and nobody is told. A task is an issue assigned to the developer, with a place and an outcome, so it
  always has a ref, and it waits on its line in the developer's order. Places are a fixed list the developer owns (the
  bench, the Mac, the phone, the house), and the CLI refuses any other. "I'm at" keeps the same list and order, folds
  tasks for other places, adds tasks held on lines not running for that place, and ends by itself after a few hours.
  Marking one done frees the work and wakes the owner. Drift asks agents to turn blocked-on-the-developer issues into
  tasks.
- **Up-next and tabled lines hold their questions and tasks.** Starting a line shows its held questions first, so it
  starts with them answered. Tabling asks for a reason and an optional date to look again, tells the owner to stop, and
  refuses its writes. When a line comes back, its held questions go to whichever agent owns it next, to re-confirm or
  withdraw before they reach the developer. _Trade-off:_ a question can wait a long time, which is why it is
  re-confirmed rather than trusted.
- **An answer closes a question; Tell closes nothing.** Answering, by an option or in the developer's own words, closes
  one question, can be undone, and shows its status. Tell is a free message to the owner, delivered to its inbox and
  waking it; empty, it is a nudge.
- **Answers can be undone, and say what became of them.** An answer waits a few seconds with Undo before it is sent.
  Then the line shows one status sentence: not picked up, picked up, carried out. A failed wake, or an answer not picked
  up within an hour, comes back under Step in.
- **Summaries stay true without anyone reading history.** The owner rewrites the summary at the end of a session. It
  falls due an hour after significant work. Significance is decided by what happened, not by the agent: a plan step
  changed, an issue closed, a question asked or answered, a pull request merged. Until it is rewritten, the line lists
  what changed since, one line each.
- **Agents propose, the developer accepts.** Agents propose a line when they find work with none, or when the developer
  starts something new in conversation. Every proposed line offers the same five choices: Start, Up next, Table…
  (which asks why), Fold into…, Not a line. Agents also propose a line as done, with how "done when" was met; that
  proposal is the line's first item, on its own row, with Done and Not yet…. Both kinds count in the header as "to
  accept". A line the developer adds names its repo, or says it is theirs, so that an agent can take it. Nothing joins
  or leaves the list without the developer's yes. On first run, agents propose lines from the tracker's existing
  projects, splitting where one project held several, and the developer sorts each once.
- **The log shows what has not been seen,** line by line in order. A line counts as seen once opened, or with Mark all
  seen. Routine changes fold into one sentence. Up-next and tabled lines are left out unless asked for; refused writes
  never are.
- **State changes are buttons, never radio buttons,** so no arrow key can table a line. Reorder buttons are at least
  30px tall, 44px on the phone.
- **Keys reach every choice.** j and k visit, in order, an urgent question, Step in, the lines, then Proposed. Every
  item there numbers its choices, so 1–9 picks an option, a step-in action, a proposal's choice, or Done and Not yet;
  everything else is in Tab order. Keys act only on the focused item, marked with a dark outline and the word Focused,
  never while typing, and are listed behind "?".
- **Interruptions are rare.** The phone is interrupted only for urgent questions and questions on the top two lines,
  with a one-tap answer that still has Undo. Tasks never buzz: they wait for "I'm at".
- **One vocabulary:** line, working on, up next, tabled, done, dropped, proposed; summary, done when, owner, helper,
  agent; plan, step, issue, ref; question, situation, task, place, held, later, urgent; for you, step in, tell, stop;
  log, seen. Contracts and the CLI use the same words. Refs keep their prefixes (D-34 is a question), because a ref
  never changes once written.
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
