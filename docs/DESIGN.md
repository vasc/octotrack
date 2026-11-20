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
- **Durable on answer:** locally the database runs in WAL mode with `synchronous = FULL` and `fullfsync`, so a write the
  tracker has answered as done survives the machine stopping. Under `NORMAL` a restart on 15 November took back a
  quarter of an hour of agents' writes that had each been acknowledged. Writes are few, so the cost of a full sync per
  commit does not show.
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
back later one at a time, retroactively (`decision record`), or in bulk (`decision batch`, or Record answers, behind
`r` on home), with a line format simple enough to type from memory: `D-3 a Went with postgres`.

~~The queue is ordered by a score.~~ Replaced by D14: the developer's own line order decides what reaches them first,
since a computed score competed with their priorities. A question still shows its reasons (agents waiting, work it
blocks, priority), as facts rather than as a rank. Questions from before lines are oldest first.

### D9. Dashboard speed

- Local SQLite, a cached bootstrap payload requested by `<link rel="preload">` so data is in flight before JS
  parses, and an in-memory query cache so navigating back is instant.
- SSE pushes changes. The client invalidates only what changed and shows previous data while refetching, so a
  filter change never flashes a spinner.
- No component library, no CSS framework. The dashboard's own primitives in `packages/web/src/components/ui` (Row,
  List, Section, Sheet, Button and the rest) are the only things with a look, styled in `ui.css`; screens only compose
  them, and `packages/web/test/primitives-only.test.ts` fails on a screen that gives an element a class or a style. A
  hand-styled button per screen is how the dashboard stopped looking like one product; one primitive per shape is how
  a change of look reaches every screen at once. See `design/log.md`.
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

A background loop in the local server, and `octo pr sync`, which asks the server to run it now, shell out to `gh`, reuse
the developer's existing login and push results through the `pr.sync` operation, which only the server and the
developer may call. A ref like `OCT-12` in a PR's branch name, or after a closing keyword in its title or body ("Fixes
OCT-12", "Closes OCT-3, OCT-4"), becomes an `implements` link automatically; a bare mention does not.

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
proposal: that it should not overfit to the one agent tool then in use (paraphrased here, since the quote named that tool),
"letting the session decide if it want to be reawaken", and that it would be great if "we can avoid having the session
actively hang on octo".

- **An inbox any tool can use.** `octo inbox`, `decision pickup` and `decision report` are plain CLI commands keyed on the
  agent's name. An answer moves through not picked up, picked up, and carried out or partly carried out. An agent that answers
  its own question skips this. A changed answer is delivered again.
- **Waking is opt-in, per agent.** First it was per decision (`--wake` on asking, or `decision wake` later); since lines
  (D14, and D13's third audit) it is the wake address an agent registers once. The default is the inbox.
- **One dispatcher instead of many waits.** A loop in the server wakes sessions, so nothing hangs. It marks a wake before
  running it, so a crash leaves a session unwoken rather than woken twice, and the answer is still in the inbox.
- **The tracker knows no tool.** It stores an opaque address. An adapter in `~/.octotrack/wake-adapters.json` turns that into
  a command, so another tool needs one more entry and no code.
- **Each adapter says what it fits, and the guide lists what this machine has.** An entry may carry `for` (when an agent
  should use it, in plain words) and `address` (what to give after the colon), and `octo guide` prints the adapters set
  up here with both, instead of naming one. _Why:_ the guide once told every agent to register one adapter's name with
  its session id, which resumes a session headlessly; the developer's agents run open in GNU screen, where that starts a
  second copy beside the open one, and an agent rewrote the guide for screen instead (vasc/octotrack#1, closed), which
  fitted that machine and no other. What fits depends on the machine and how each agent runs, so the guide reads it from
  the machine. _Decided:_ an adapter does not try to detect a session open in a terminal; nothing it can see tells an
  open interactive session from one that ended, so the guide says which sessions it fits instead.
- **A request can never supply the command.** There is no authentication (D10), so that would let any device that can reach
  the server run anything. Addresses are also narrow enough that they cannot pass for an option or mean anything to a shell, no
  shell is involved, and the wake message holds only the ref, so tracker text never becomes a prompt.
- **Trade-off:** one attempt per answer rather than retries. A retried wake could start a second run of an agent, which is
  worse than an answer waiting in an inbox where the dashboard shows it.
- **2026-11-15: the built-in adapter for one agent tool is removed.** The binary carried one adapter of its own, `octo
  adapter <tool>`, which resumed a session of one agent tool, and a deploy pointed that tool's entry in
  `wake-adapters.json` at it. The developer, in their words, with the tool's name left out at their request: "No one ever
  asked for a [tool] wake adaptor so... no [tool] in the product no [tool] in the commits". _Decided:_ the command is
  gone, so Octotrack carries no adapter and every adapter is a command the developer writes; a deploy now removes any
  entry that runs the binary's `adapter` command, which could only fail, and leaves the rest as written. Nothing in the
  product names an agent tool. _Trade-off:_ a developer whose sessions resume headlessly writes that one entry by hand.

### D13. Building lines of work at the centre

The developer, after twenty review rounds of the design below: "I think in general this is a good direction", then "sounds
good lets build it". While planning, on three open questions:

- On the live install: "id like to package this and investigate is bun compile could work"
- On migrating old ideas and milestones: "I dont care how it migrates you need each agent to clean it up afterwards"
- On a two-hour "silent" rule: "I dont know what silent for 2 hours mean / make good decisions / and line of work might
  be running for weeks without being tables I dont know what 2h signals but my intuition is nothing"

Decisions made from that:

- **Built in phases, each one usable on its own:** repos and lines; agents and claims; questions and the line inbox;
  tasks, places and summaries; the dashboard; the local runner; phone interruptions; then removing what it replaces.
- **The live install stops running from the main checkout: it runs one compiled `octo` binary.** The investigation
  worked: `bun build --compile` carries the CLI, the server, SQLite, the built dashboard (embedded through generated
  `with { type: "file" }` imports, since Bun rebundles HTML and scripts given as entry points). A compiled binary starts
  its own server by running itself, not its virtual script path. Every answer carries the server's build (`x-octo-build`, a hash of
  the sources and the dashboard) and the CLI warns once when it differs from its own. `bun run build` compiles the one
  file, for this system or any Bun target, and the file installs itself: `octo install` rehearses the migration on a copy
  of the real data, backs the database up with SQLite (`VACUUM INTO` from a read-only connection: the database runs in
  WAL mode, so a file copy can lose writes), puts itself in `~/.octotrack/bin`, keeping the one before, restarts the
  server on itself and checks its build answers; `octo rollback` goes back exactly one install and never touches the
  database. Nothing in it knows any operating system's service manager: the server starts itself on the first command,
  and starting it at login is left to whatever the system uses. _Trade-off:_ a build before every update, against a
  merge to main never again changing the CLI under a server still running the old code.
- **Agents and claims, as built.** Deadlines (wind-downs, look-again dates, scoping that lapses) are settled at the start
  of every call and by the minute sweep, so no rule waits on a timer and none needs one to be correct. An agent is
  registered on its first command with its checkout, and its repo is read from that checkout's GitHub remote; an agent
  whose repo has no GitHub remote names it once with `agent register --repo`. Reads with no agent name stay answered,
  since they change nothing; writes with none are refused. Ref-shaped names are refused only for new agents, so no
  existing one is locked out. Owner search step 2 offers a line in the replies of idle agents with its repo for 30
  seconds before the runner may start a session for it; with no runner set up, home asks the developer to step in. There
  is no automatic stop any more: with no permissions over the work (below), nothing is refused for it to count.
- **Questions and the line inbox, as built.** Questions keep their `decision.*` operation names and D- refs; the CLI
  also takes D14's words, `question <word>` for every `decision` command, with `question later` for postpone and
  `question change` for Change answer (answering again, sent as replacing the earlier answer). A
  question asked by an agent on a line belongs to that line and to the issue the agent holds there, and must stand alone
  (situation, options that say what happens, a reason for any recommendation). One from an agent on no line keeps the
  older rules and shows on home under On no line, below every line's questions, until its agent puts it on a line. Answers and Tells wait in
  the line's inbox and reach whoever holds the issue, else the owner, on its next reply; an asleep agent is woken at the
  address it registered, with a message that carries no tracker text, and a failed wake makes it gone. Work on no line
  is one `unplaced-work` drift per repo, which is how the move to lines gets cleaned up by each repo's agents.
- **Tasks, held work, summaries and the developer's own lines, as built.** A task is an issue assigned to `dev` with a
  place from the developer's list and an outcome to report; it blocks the issue it frees, and its Done or Can't do it
  goes through the line inbox to whoever holds that issue. A question filed with `--waits-for` a task is left out of
  the queue until the task closes. Held questions and tasks are current for 7 days from when they were asked or
  re-confirmed; whoever takes the line is told which are not. A summary falling due is a `summary-due` drift for the
  owner, so it reaches the owner the way all drift does. A done when or a case for done that an agent proposes waits
  for the developer: on a working line as an item for them, on a line that waits in its Start sheet, quoting the old
  and the new with the agent's why. An agent writes a done when directly only on a line it proposed and is still
  proposed. _Why:_ an up-next line's done when is usually the developer's own words, and E-States 9 holds a change
  there for the Start sheet.
  "I'll own it" winds the agents down like tabling and leaves the line in Working on; handing it back runs the usual
  owner search, which offers it first to the owner that wound down.
- **The dashboard and the runner, as built.** Home is `/` and the feed is the Log at `/log`. Every choice the developer
  makes, answers included, waits five seconds on the server with Undo (`choice.make`); the tracker applies it on the
  next call or its one-second tick, so closing the tab neither loses nor repeats it, and one that fails stays in the
  Undo bar with why until dismissed. Drafts are kept on the server as they are typed. The local runner reads `~/.octotrack/agent-setup.json`
  and does nothing without it; it starts in watch mode (`dryRun`, on unless the file turns it off), recording
  `runner.would_start`. A start runs in a fresh worktree on branch `octo/<name>`, after the repo's setup commands, with
  only `{line}` and `{name}` filled into the developer's command and `OCTO_AGENT` set. A start that exits at once keeps
  its name and is retried after 2, 10, 60 then 360 minutes; Step in quotes its last line of output and offers Try now.
  Only the server's own runner may record starts, exits and closes.
- **Phone interruptions, as built.** The dashboard installs as an app (manifest and service worker at the root) and
  subscribes with "Buzz this device". `web-push` 4 sends the notifications; it was checked to make its keys, encrypt
  and sign inside the compiled binary. The server makes its VAPID keys once into `~/.octotrack/vapid.json`, readable
  only by the developer, and asks push services to contact `OCTO_PUSH_CONTACT`, by default an address that names no
  one. What buzzes is one pure function (`shouldBuzz`); a line's buzz resets whenever the app is in front of the
  developer, which the dashboard reports on every visit. A tap opens `/?focus=<ref>`.
- **The developer is present, never inferred.** `--me` on the CLI, or `OCTO_DEVELOPER=1` on an interactive terminal; a
  call that names an agent, by `--agent` or `OCTO_AGENT`, is never the developer, and `--me` with one is a usage error.
- **Migration is simple and agents clean up.** Projects become repos with the same keys, so every ref stays valid; old
  ideas and milestones become proposed lines marked "from before"; one drift per repo then asks its agents to turn the
  repo's work into real lines and to re-propose or reject what came from before.
- **No claim ends on a timer.** Silence is not a signal: a line can run for weeks with its owner busy. A claim ends on
  release, Stop, a failed wake, or the exit of a session Octotrack started. _Trade-off:_ a crashed session the developer
  started keeps its line until the developer releases it from Agents, where its last command shows how long it has been.
- **Old names keep working for at least a phase** (`decision.*`, `project:`, M-, I- and U- refs), and the riskiest
  automation, the automatic Stop and the runner, first runs in a mode that only records what it would have done.
- **A task is anything the developer does with their own hands.** Logging in to a service, plugging something in,
  measuring: an agent files a task, never a question, which is for a choice between options. A title is enough: a place
  is optional, and one not on the list yet is added to it; what to send back is optional, and with none Done needs no
  words (any typed go along as a note). The developer marks it done, says it cannot be done, or replies (`task.reply`):
  the words reach the agent like an answer, and the task stays open. _Why:_ the developer: "a concept of a task for the
  operator is missing, sometimes the operator needs to do something like merge a pr or login to a service, now the ai
  has to set that up as a fake question and thats annoying, its a task that can be marked as done or replied to". Tasks
  existed, but demanded a place from a list the developer had left empty, so every one was refused.
- **Ready to merge is the agent's call, and a line shows its pull requests.** An agent says a pull request is ready to
  merge (`pr.ready_to_merge`, `octo pr ready <PR> [why]`, `--not` takes it back), recording who, when, why and the commit
  it was at. A line lists its pull requests still open, those said ready first, then open, then drafts: under a working
  line on home and as Pull requests in its panel, right after For you. A push after it was said ready shows as "pushed
  to since"; nothing takes the mark away on its own. A pull request to merge needs no task: said ready, it is in front of the developer already. An agent marks ready
  through the usual patch, so saying it again keeps when it was first said, and nothing is logged unless something
  changed. The runner never closes a pull request said ready when its line ends: it waits to be merged. _Why:_ the
  developer: "when a line has prs it should show the list of prs prominently, especially the ones ready to merge, ready
  to merge is a decision the agent does, it can mean different things for different people and repos". Keeping the
  mark through a push, and showing the push, is my decision: dropping it would be a rule the developer did not ask for,
  while hiding the push would let a stale judgment pass for a current one.
- **No rule without a reason.** A refusal stays only when it keeps the data whole (a cycle of blocks, an option a
  question does not have, a step that is not in the plan), keeps two hands off one thing at once (an issue another holds,
  without `--force`; an answer waiting out its Undo; a second scoper), or keeps the log readable (agent names). Everything
  else was a constraint without a reason, and is gone: a line moves from any state, a done or dropped one included, and
  folds or is folded either way; its plan is written in any state; a line is tabled with or without a reason ("No reason
  given"); any line is owned; any agent takes any line, whatever its state, its repo or whether it is winding down or
  already scoped (as owner or helper while worked on, else as scoper); a question is answered, refined or withdrawn
  whatever it stands at; the developer's tasks and notes go on any line; a task at a place not on the list adds the
  place; a plan step is marked done while a branch it waits on is open, and then waits on nothing; a branch may hold up
  a step already done. _Why:_ the developer: "a line that is ended stays ended, sounds insane, do not add constraints
  unless theres a justification for it, this is the same crap as the thing where only I can do x or y".
- **No permissions over the work.** Octotrack tracks agents' work; it does not hold permissions over it. An agent writes
  to any line, whether or not it is on it and whatever the line's state: issues filed, claimed, progressed, finished
  or moved; plans and branches; questions asked, refined, answered or withdrawn; links, drift, notes, held work, pull
  requests and their sync; summaries and done whens. Nothing is refused for it, so nothing counts toward an automatic
  stop, which is gone; claims still say who works on what, and a wind-down still gives a crew its notice. Every
  operation on the work is open to agents as to the developer: answering, Later, reopening, replacing and recording questions;
  adding, placing, ordering, moving, folding, rejecting, owning and handing over lines; done whens, Not yet, tasks'
  outcomes and Can't do it, places, notes, Tell; stopping, lifting and releasing agents; repos' GitHub names and
  checkouts; Try now. The log shows who did each, and quotes the developer's words when the agent passes `--said`
  (channel `out_of_band`). _Why:_ the developer, on finding agents refused: "I don't want idiotic permissions", "This
  is about tracking agent work", "No one asked for permissions", "An agent must track and answer I wrote to them", and
  then "Do everything". An agent's own proposals still wait for a placement unless it says where (`--place`), since a
  proposal is how it asks. Only the server records wakes, starts, exits and closes. What stays the developer's in
  person is their own screen and phone, not the work: Undo and waiting choices, drafts, turning notifications on and
  off, `seen`, the app being opened (`push.seen`) and I'm at, since one made by an agent would mark things read for
  the developer or silence the phone. A call that names an agent is never the developer on the server, and no agent
  may be called `dev`, `octotrack` or `github`, the names the log uses for the developer, Octotrack and pull request
  sync. A wake address is the narrow form, an agent names its repo only once, a repo's GitHub name must be owner/name,
  and a clone already in place is used only if its origin is that repo. Withdrawing a question is for the developer,
  its asker or an agent on its line. A decision recorded after the fact is placed like a question (the line named, the
  line of the issue named, or the recording agent's line).
- **Agents write only to the line they are on, as built after the second audit.** _Superseded by "No permissions over
  the work": agents write to any line, in any state, and nothing is refused or counted; what follows is the history._
  On top of what the line's state
  allows, an agent changes something on a line only from that line (or, on a proposal, as its proposer): claiming,
  progressing, finishing or reassigning an issue (through `issue update` and `issue create` as well as `issue claim`),
  links either of whose ends is on a line, a line's drift, notes on its items, re-confirming its held work, and picking
  up or reporting on its answers. A question is refined only while open, by its asker or an agent on its line, never
  while an answer to it waits out its Undo, and must still stand alone afterwards. Things on no line keep the older
  rules. _Trade-off:_ an agent cannot link its issue to one on another line; the developer can, or the agent tells the
  other line's owner.
- **Work follows the line, as built after the audit.** An agent leaving a line returns its open issues to it, noting
  who last held each, and the next holder is told. Not a line cancels the proposer's new issues and returns older work
  to no line, where the issues are recorded as not a line so the `unplaced-work` drift leaves them be until someone puts
  them on a line again; Done or Drop on a line nobody holds closes its issues at once. Folding a line moves its inbox
  with it, and its proposer is told it was folded, and where, or dropped, never that it was not a line.
  Held questions and tasks stay out of the developer's queue until re-confirmed. A session Octotrack started that can
  be woken keeps its line when its process exits, and only starts not yet checked in whose process still runs, or
  agents still running, count against the cap. Every reply carries the agent's notices, batch and watch waits
  included, and the CLI prints each once. Pull request and question events carry their line, so a merged pull
  request, like a question asked or answered, makes the line's summary fall due. An agent's pull request report is
  refused, and counted, on up-next, tabled, done and dropped lines. A pull request opened or pushed to after such a
  line's wind-down is shown on it once (`pr.after_wind_down`, blamed on no agent and always in Not seen), unless the
  developer owns the line; pull requests still open when a held line's wind-down ends are listed on it once
  (`line.prs_held`). A re-confirmed question or task is in the log (`held.confirmed`).
- **The rest of D14, as built.** The CLI takes D14's words beside the older ones: `line retry`, `summary write`,
  `tell`, and `done-when set`, `accept` and `reject`. Not yet reaches the owner through the line's inbox. `line
  propose --urgent` stands
  first under Proposed. `held withdraw`. I'm at lasts three hours. `seen`, and the Log's Not seen, line by line in
  order with checks and drift confirmations folded, waiting lines left out unless asked for, refused writes always in;
  a line also lists what is newer than its summary. `task add` and `note add` on the developer's own lines; tasks on a
  line with no repo go in a repo named ME. Try now retries every line stopped the same way; Start one anyway starts
  one past the cap, once, for the owner search it was asked in (fourth audit, A3: it stayed armed when an agent took
  the line first, or in watch mode, and passed the cap unasked when the line next needed an owner; watch mode now
  spends it as it notes the start); at the cap the lowest running helper Octotrack started is asked to make room before the
  developer is. The developer's stop command runs once per Stop, and only when the runner did not end the session itself
  (fourth audit, A23: it ran for both). A gone session's worktree goes to the next session on its line.
  `repo checkout` sets where worktrees are made from, and the runner otherwise finds the main checkout with
  `--git-common-dir`. Home has the header counts as one group of links, the spread-thin nudge, To top and To up next, the Start
  sheet, I'm at, Tell, Stop on the owner, Change answer, Later and Not urgent, the developer's own box, and every key
  D14 lists, with `?` showing them. A Stop waiting with Undo offers Pause the line instead, and each line says what
  became of its recent answers.
- **The dashboard, rebuilt to the E boards.** The first build of the dashboard kept the old shell, a rail and a feed
  with tabs, and the developer said it did not match the design; it was rebuilt screen by screen to the E · One list
  boards and checked beside each. Later review of the boards themselves, by the developer, changed them and the code
  together: the header counts are one quiet group of number and words with only urgent apart in red; every desktop
  control is one height (`--control-height`) with a few inline icons (a pin for I'm at, a plus for New line, a keyboard
  for the keys); buttons carry no ellipsis; a line's handle is the one way to reorder; what a line holds lines up under
  its title. Choices are worded as they happen in the Undo bar ("Sending "26 mm" to Sendspin enclosure in 5 seconds").
  Drafts follow between devices with a notice naming the draft, and a field with focus keeps what it shows; a choice
  names the draft it was typed in, which Undo keeps and the server deletes once it takes effect.
- **Named outcomes.** A task can name what to send back (`task file --field Length --field Holes`), as E-Issue draws
  it: a box for each, a note for anything that surprised, and how many are filled. _Decided:_ Done needs every named
  outcome and refuses a name the task does not have, and the server writes the result as one list (`- Length: 41 mm`)
  with the note after it, which the line's inbox and the log say on one line, so an agent reads one answer whichever
  way it was given. _Decided:_ the dashboard keeps a task's boxes as one draft, its values and note together, so the
  choice that closes the task deletes all of it at once; a draft written as plain words before is read as the note.
- **Eight themes, each in light and dark.** The developer: "Also at the end build 8 themes light and dark mode each".
  The first themes changed only the ground, its lines and the ink, and the developer said "your these only seem to
  change the background color and poorly, only above the fold, and they dont change the accent colors at all", then
  "the point is to change the gods damn amber, a theme chooses all colors". _Decided:_ a theme chooses every colour:
  the ground, lines, ink, an accent for what the developer acts on (the primary button, the page they are on, focus,
  links), attention and the four statuses. Meaning is kept by family, not by one fixed hue: attention is still the one
  colour for what needs you in its theme, good still a green, bad still a red. (Superseded below: the generated
  colours were replaced by hand-picked ones.) The colours came from seeds in
  `scripts/themes.ts`, which mixes the rest and moves every text colour until it reads, so a theme cannot be made
  unreadable by hand; the ground is set on `:root` so it covers the whole page. The themes are Paper (the boards' own), Slate,
  Sand, Forest, Ocean, Plum, Rose and High contrast; the mode is as the system, light or dark. They are picked in an
  Appearance menu in the bar, each theme previewed in its own colours, and kept per device in browser storage, since a
  phone and a desk may want different ones and nothing else depends on it; `index.html` applies the choice before the
  first paint. `bun test design` holds every theme to the same contrast in both modes.

  Then the developer asked "Why do all themes have a blue highlight" and said "Themes don't change anything on mobile".
  Proposals were edged and tinted in an info colour seeded blue, teal or violet in every theme, attention was blue in
  Sand and Plum, every dark ground was a near-black with a trace of hue, and the phone marked the page you are on with
  coloured text only, so on a phone at night every theme looked the same. _Decided_ (the themes themselves superseded
  below): info is the accent, so what waits
  for your yes is drawn in the theme's own colour; attention is blue only in a theme whose own colour is blue (Sand's is
  plum, Plum's teal), and where attention is teal, good is an olive green so the two never read alike; each hued
  theme's dark ground is a deep shade of its hue (Forest green, Ocean navy, Plum aubergine), with only Paper a neutral
  black; dark tints are mixed from a neutral grey, since a hue mixed into a ground of another hue turns into a third;
  and the phone fills the page you are on with the accent, as a wide screen does. `bun test design` checks each of
  these, and a tap on a phone flashes the accent instead of the browser's blue-grey.

  The developer then said "Themes don't change anything on mobile", "My phone is not in dark mode", and "I told you to
  fix the white space on mobile sizes and stop repeating lines both at the bottom and at the top". In Safari a tapped
  button takes no focus, so the menu's open item blurred with nothing receiving focus, the menu read that as focus
  leaving and closed under the tap, and no theme (nor I'm at) could be picked on an iPhone; Chrome's phone emulation
  focuses the tapped button, which is why it passed there. _Decided:_ menus and the filter's suggestions close when
  focus moves to something outside them or on a tap outside them, never on a blur that moves focus nowhere
  (`useCloseOnOutsideTap`); the phone's bar no longer names the page, which the filled tab already does, and is one row
  of what waits beside a plus for New line and the theme; the tab bar drops its fixed band of padding for the home
  indicator's own inset; and the page's bottom padding is the tab bar's height, not twice it. Checked in Safari in the
  iOS Simulator, not only in a narrowed desktop browser.

  The developer then said "All these themes are hideous any way", "Delete that stupid generator", "It's not the code of
  the generator that's a problem it's the generations", "Pick all variations by hand", "You can't desing without
  seeing, desing is not a math test", and of Paper's filled blue pill, "This blue belong and 2008". _Decided:_ the
  generator is gone and every colour of every theme is picked by hand, looking at the dashboard in light and dark,
  desktop and phone; contrast tests are a floor, not the design. Paper is monochrome, its accent the ink, so only what
  needs you has a colour. The other colour themes are editor palettes people already love, kept close to their
  authors' shades: Solarized, Gruvbox (its faded blue as accent, since its orange read as the red of urgent),
  Catppuccin, Rosé Pine, Nord and Everforest (its green as accent, so it does not read as one more cream-and-blue);
  High contrast stays. A device that kept a theme that no longer exists gets Paper in the mode it kept.

  The fix still did not reach the developer's phone: Safari keeps an open tab's code, so a deploy never reached the page
  they had open, and they kept tapping the old broken menu. _Decided:_ an open tab loads a new build by itself when it
  comes back into view (or Safari restores it from memory): it reads the served page, and if that loads a script or
  stylesheet this page did not (a deploy that changed only styles included), it reloads, unless a box has focus. Drafts are kept on the server as they are typed, so a reload
  loses nothing.

  Then the developer said "I need you to stop treating meaning by color as the most important thing and design colors
  for aesthetics", "All those reds, rounded corners and cards inside cards all scream twitter bootstrap", "Design an app
  not a theme from 2008", "I don't need to be urged to decisions through red colors everywhere", "No ai 2 px left side
  drop shadow", and picked direction B ("Instrument", in `design/directions/`) from two mockups. _Decided:_ each
  section is one sheet whose lines are rows divided by hairlines; nothing inside a line is a box of its own; focus is a
  quiet tint of the row or item the keys act on, not a border or a ring; corners are 4 to 8px; no coloured bar runs
  down the side of anything; red is kept for real errors (a bad query, a failed save, failing checks, a refused write),
  and what is urgent, has no owner, or is stuck reads in the warm tone as words and a small dot, never as a red pill, fill
  or edge; Step in's way forward is the filled main action; the bar's counts are plain words.
  The developer then asked "are agents and log actually the same order or importance of lines" and "If not why the hell
  is there a bottom menu with them at the same level". They are not: Lines is the app, the Log is catch-up reading and
  Agents a roster opened now and then. _Decided:_ the name Octotrack opens Lines; the Log and Agents are quiet words
  beside it on a wide screen and wait behind one pages menu on a phone; there is no bar of equal tabs anywhere.
  _Superseded by D16:_ the bar is Lines and For you, with the Log and Agents in More on every width.
- **Focus is a tint, with the keys beside it, not a word.** (Superseded in part above: the border became a tint.) The developer, looking at the built home: "focused text on
  lines is unnecessary, reminding about j an k shortcuts to the side would be better, in a subtle way". The word
  Focused, which the boards draw over the focused item, is gone; the item keeps its border, in the theme's accent, and out in the margin
  beside it a quiet "k [up] j [down]" says how to move on. _Decided:_ the hint shows only with a mouse or trackpad (keys belong
  to a keyboard) and where the window leaves a margin for it, and a screen reader is not told it, since focus moving
  already says where it is.
- **A number key presses the button that shows the number.** On home, an item's numbered choices are buttons carrying
  `data-choice`, which also draws the number beside them; the key finds the focused item's button by that number and
  clicks it, unless it is disabled. _Decided,_ after an audit asked for handlers registered per item instead: the drawn
  number and the action then come from one element and cannot disagree, a disabled or Sending button is skipped for
  free, and a submit button submits its form as a press would. _Trade-off:_ the keys reach into the page's markup
  rather than React state, against a second registry of numbers that every item would have to keep in step with what
  it draws.
- **The runner, as fixed after its audit.**
  - _Owners first, then helpers._ Once every owner start is placed, spare sessions under the cap go to helpers for the
    unclaimed work on each line, in line order, as D14 says. A line gets as many as it has unclaimed, unblocked issues
    in its repos beyond the agents on it that are running and hold nothing, and the sessions still starting for it; each
    starts in the repo of the first such issue, since a helper works only in its own repo. _Decided:_ no helper starts
    while any working line is still being offered to agents already here (owner search steps 1 and 2), because that line
    may need the slot in seconds and the helper would at once be asked to give it back. _Decided:_ a helper start that ran
    but never took its line is not retried until Try now, as for owners, but raises no Step in, since the line has an
    owner and needs nothing from the developer; the Log shows it.
  - _One rule decides whether a line can be started,_ shared by `runner.due`, making room and Step in, so a helper is
    never asked to give way for a line the runner would not start (one that never took it, waits to retry, or has no
    repo), and only a running helper is asked, since an asleep one holds no session. _Trade-off:_ a few more queries per
    tick, against three copies of the rule drifting apart, which is what the audit found. (Fourth audit, A20:) the
    same rule now also says why: home sends each line's `stepInReason` with `stepIn`, worded in core (no start command,
    watching only, never took it, keeps failing at once, keeps taking it and leaving, no repo, every session busy),
    and its kind as `stepInKind` (`no_start_command`, `watch_only`, `failing`, `left`, `never_took`, `clone_failed`,
    `no_repo`, `at_cap`), so the dashboard picks Step in's fixes without reading the words. `clone_failed` comes from
    the runner, which records on the start (`runner.exited` with `cause: checkout`) that it found no usable checkout
    of the repo: a clone that failed, or something other than a whole clone of it where the clone goes. _Why:_ the
    dashboard worked the reason out again from the runner's status and the last start, had no case for a line with no
    repo, and told it was at the cap instead; it took a failed clone from a regular expression over the session's
    output, so output that mentioned a clone offered Set its checkout instead of Try now.
  - _A start is judged by when it ended._ Only an exit before the five-minute check-in, having run no command, counts as
    failing at once and is retried by itself; one that outlived its check-in ran, whatever its exit code, and waits for
    Try now like any other that never took its line. Each start records when its process exited, so one past its
    check-in whose process still runs keeps counting against the cap, and its worktree is not removed under it. Try now
    on one that never took gives the next session a new name, since that session ran.
  - _Worktrees._ A retry keeps the worktree its first attempt had, made or handed on, so unpushed work is not
    stranded; a gone session's worktree is handed on only once its process has exited and no agent that is not gone
    works in it. A retry whose worktree was removed is made again on the branch it left.
  - _Pull requests are closed only in the GitHub repo of the issues they implement,_ and never while they also
    implement an open issue or one on a line that has not ended. _Why:_ a pull request's row names any repo its writer
    likes, and closing work still wanted cannot be undone from Octotrack. (Fourth audit, A4:) a close that gh refuses
    (no permission, an archived repo, the network) is recorded (`runner.closed` with its error), said in the Log once
    per pull request with gh's last line (`runner.pr_close_failed`), and tried again after 2, 10, 60 then every 360
    minutes, as a failing start is. _Why:_ it was only written to the console and asked of gh again every ten seconds,
    without end, while D14 says the Log says what the runner closed.
  - _No process inherits an identity._ The server the CLI starts drops `OCTO_AGENT` and `OCTO_DEVELOPER`, and every
    command, session and wake the server runs is given only its own: a session its name, a wake the agent woken (or,
    for a question from before lines, its asker). _Why:_ the server is often started by an agent's first command, and a
    woken session would otherwise act as that agent.
  - _Commands are bounded and answered._ The runner's git and gh get two minutes, clones and setup commands thirty, the
    stop command ten, and a wake thirty; pull request sync's gh calls get thirty seconds each (`OCTO_GH_TIMEOUT_MS`),
    since a busy repo answers in about six and a stuck call must not hold every later sync (fourth audit, A25: this
    said two minutes for all gh). Each is killed at its deadline and reported. (Fourth audit, A1:) a command with a
    deadline runs in a process group of its own and is killed with everything it started. A wake killed at its
    deadline reached its session, so it is recorded as ended (`agent.woken` with `ended: deadline`, and
    `agent.wake_ended` in the Log), not as a failed wake: the agent keeps its line, asleep, and is woken again when
    something waits (since the fifth audit, a notice to carry on wakes it at once). While a wake runs, its process id
    is recorded: the cap counts the woken session for as long, however silent it is, until the server records the
    wake's end, and Stop ends the wake's process group as it does a session's (the wake dispatcher does, since the
    fifth audit, whatever the runner's setup).
    _Why:_ the deadline killed only the adapter, so the session it resumed kept working, unseen, while the wake was
    recorded as failed ("Exit 124"): the agent was declared gone, its claim ended, a new session was started for the
    line and handed the orphan's worktree, Stop could not reach it, and the cap stopped counting it after fifteen
    minutes. A clone or setup command cut short likewise left git writing into a folder the runner then removed.
    _Trade-off:_ a session woken for longer than thirty minutes is cut off mid-work, though resumable; the deadline
    is what keeps a wake from holding a process for good. Output is read as it comes and raced once the command
    exits, so a child it leaves holding the pipes cannot hang the runner. Only names and refs of the narrow form are
    filled into the developer's commands. A push service that cannot be reached costs that browser its notification
    and nothing else: the rest are sent and recorded, so a line still buzzes once. (Third audit: unless no browser
    took it, below.)
  - _Watch mode records only, Stop included._ The stop command is noted once per Stop (`runner.would_stop`) and runs
    when the runner may act, if the agent is still stopped then. Worktrees default to `worktrees` in Octotrack's home,
    so a test install with its own `OCTO_HOME` never works in the live install's.
- **What the third audit changed in core, the server and the runner.**
  - _Scoping a line is writing to it, so it too is done only from the line._ An agent sets a plan, files an issue or a
    task, rewrites an issue, moves one on or off a line, and asks a question on a line (named, or through the issue it
    names) only from that line, or on a proposal as its proposer; so is anything filed already linked to work on
    another line (`blocks`, `--blocked-by`, `--derived-from`, `--waits-for`, `affects`). _Why:_ an agent from another
    repo could replace a working line's plan, take its issues off it, or put a question in its queue whose answer went
    to that line's owner, not to the asker.
  - _Only the server's sync, or the developer, reports what GitHub says._ `pr.sync` refuses agents, and `octo pr sync`
    asks the server to run its own sync (`POST /api/github/sync`, optionally for named repos, each an owner/name)
    instead of running `gh` in the agent's shell and reporting the result. _Why:_ any agent could write pull request
    rows through sync, past the line rules `pr upsert` keeps, and say a repo's sync failed or was fine. _Trade-off:_ the
    sync runs with the server's `gh` and environment, not the caller's; on this one machine they are the same login.
    `gh` now runs on the same bounded path as every other command the server runs. (Fourth audit, A24:) a repo named
    in the request is synced only if a project here names it, as D11 says; any other is reported as an error and
    never fetched. A scheduled sync that finds one running waits for it and then runs, once however many intervals
    passed, rather than being dropped. _Why:_ any caller could have the server run `gh` for any owner/name and write
    that repo's pull requests into the tracker, linked to issues by branch or keyword, and a long list held the sync
    while every scheduled sync was dropped with nothing recorded, so pull request status went stale.
  - _A pull request implements an issue by its branch name, a closing keyword, or `--issue`,_ as D14 says; a bare
    mention ("see PANEL-1 for background") no longer links it. Links an earlier mention made stay, but the runner does
    not act on them (below). _Why:_ every link is a reason the runner may close the pull request on GitHub with a line.
  - _The runner closes only the pull requests that were open when the line ended, unchanged since, as GitHub reports
    them._ When a done or dropped line's wind-down ends (or at once, when nobody was on it), Octotrack notes each open
    pull request whose branch or closing keyword, as GitHub last reported them, names one of the line's issues, with
    its head commit (`line_closing_prs`). The runner closes only those, and only while the head commit is the same and
    the row was last written by GitHub sync. Any `pr upsert` marks a row as not confirmed until sync writes it again.
    _Why:_ it closed every open pull request linked to an ended line, including ones opened after the wind-down, which
    D14 holds and shows, and an agent could `pr upsert` any number in the repo with "Fixes PANEL-1" to have it closed.
    _Trade-off:_ a pull request opened just before the deadline but not yet synced is held and shown, not closed;
    closing what is still wanted cannot be undone, and holding costs a click.
  - _Removed: a question's own wake address._ `decision wake`, `question wake` and `--wake` on asking are gone, as D14
    says they give way to the wake address an agent registers. A question on no line wakes its asker at the address
    the asker registered (`agent register --wake`), read when the answer comes, and not at all once its asker is
    stopped; one asked before keeps the address it was asked with if its asker registered none. The old commands
    answer with that pointer instead of "unknown". _Why:_ anyone could change any question's address, so an answer
    resumed whatever session the address named, as the asker, or silenced the asker's wake. Keeping it for questions on
    no line, guarded to the asker and the developer, was the other choice; it was not kept because it is a second
    answer to "where is this agent woken", which the registered address already gives, and questions on no line are
    themselves the older rules going away. _Trade-off:_ an agent on no line that wants to be woken must register an
    address once, which `octo guide` already asks of every agent.
  - _A watch is cancelled only by its own agent,_ the developer or the server. _Why:_ any agent could cancel another's
    watch and so silence its wait.
  - _A session that takes its line and leaves at once waits like a failed start._ One that took its line and exited
    within fifteen minutes of its spawn with no wake address is recorded as failed, with a line saying sessions keep
    leaving: the next start for the line (with a new name, since that one ran) waits 2, 10, 60 then 360 minutes, and the
    second such exit in a row raises Step in. A session that ran longer, or kept its line asleep, resets the count.
    _Why:_ a start command that exits after taking the line, as a headless `--prompt "…octo line take {line}"` start does, was replaced
    every 40 seconds without limit; the cap bounds how many run at once, not how fast they are replaced. _Trade-off:_ a
    session that does a short job and exits is replaced only after the wait. (Fourth audit, A2:) a session the
    developer sent away is not leaving at once: one stopped, released by the developer, or whose line was tabled, done,
    dropped or owned (a wind-down notice) since it started exits as `exited`, says why in the log, and the next start
    neither waits nor counts it. _Why:_ a Stop within the fifteen minutes was logged as failed, made the next start
    wait, and a second one raised Step in blaming the session. An agent's own release still counts: a session that
    takes its line and releases it at once would otherwise be replaced every minute, as N1 found.
  - _Starting a session has two steps._ `runner.start` reserves the name, the worktree and the line's turn; the runner
    then makes the checkout, worktree and setup in the background, spawns the process and records it with
    `runner.spawned`, which starts the five-minute check-in and asks again whether the session should run: a line
    tabled, owned by the developer or taken by another owner meanwhile, or an agent stopped meanwhile, ends the process
    at once (`runner.not_started`), uses up nothing and is not retried. _Why:_ the check-in ran from before a setup that
    may take thirty minutes, so a slow setup was declared never taken and buzzed the phone, and a line tabled during
    setup still got its session.
  - _The cap counts processes, not commands._ A start counts from its reservation until its process is seen to exit,
    however quiet it is; a session Octotrack started that was woken after it exited counts while it is at work (a command
    or the wake within 15 minutes). _Why:_ counting agents with a command in the last 15 minutes held a slot for a
    session that had exited, and dropped one silent for 16 minutes that still ran, so the cap was passed.
  - _Stop ends what the runner started._ Sessions run in a process group of their own; Stop sends it SIGTERM, then
    SIGKILL after ten seconds, and the developer's `stop` command is only for sessions the runner did not start. The log
    says which was done. _Why:_ the runner kept no handle on its children, so a stopped session kept running and
    spending, and the README's headless start and `tmux` stop could never work together. D14's "Octotrack cannot kill
    a session" now holds only for sessions it did not start.
  - _A session outlives a server restart, and is watched by its process id._ Each start records its process id, and
    its output goes to a log file (`sessions/<name>.log` in Octotrack's home) rather than a pipe, so the session is not cut
    off when it next writes. On restart, a start whose process still runs keeps its line, its worktree and its slot,
    and every tick checks it until it ends; one whose process is gone is settled as before. A process with that id that
    started more than two minutes after the spawn is another one, the id reused, and counts as ended. _Why:_ after a
    restart, every unexited start was settled as gone, and the next session was handed a worktree a live one still
    worked in.
  - _The runner's smaller findings._ A tick no longer waits on a start's worktree and setup, so stops, closes and other
    starts go on meanwhile; two starts never clone one repo, or add worktrees to one checkout, at once. Clones go under
    Octotrack's home (`clones`), get the thirty-minute deadline, and are made beside their place and moved there only once
    whole; a clone in place must have a HEAD. A new session never takes over an `octo/<name>` branch Octotrack did not make
    for that name; only a retry takes up its own again. Each helper starts in the repo of the work it is there for. Watch
    mode notes a helper it would start as a helper, once per owner. Names of any language reach the stop command, as
    agent names may. Each start keeps its exit code. gh runs on the bounded spawn path; the server's look at an agent's
    remote runs git only on an absolute path to an existing folder, with a five-second deadline, and remembers at most a
    thousand checkouts; an agent's checkout is tested against the worktrees folder with a path separator, so
    `/wt-panel` is not inside `/wt`.
  - _A push is given up on after thirty seconds, and one no browser took stays due._ Each send has a deadline (web-push's
    own `timeout`, and a race in the dispatcher), so one that never answers no longer holds every later notification
    until a restart. A notification is recorded as sent once some browser's push service took it, or refused it for
    good; one that no browser took, because no service answered, a timeout, a 429 or a 5xx, stays due and is tried on
    the next dispatch. _Why:_ a network error lost the notification for good, against D14's "urgent questions always
    buzz". _Trade-off:_ while every push service is unreachable, each dispatch tries once more, bounded by the deadline.
  - _The developer's own operations, relayed with `--said`, take effect on their own lines._ `task add` and `note add`
    were refused there, as writes to a line no agent may touch, though D14 says every developer operation accepts the
    developer's words.
- **What the fourth audit changed in core and the CLI.**
  - _Agents write only to the line they are on, the rest of it._ _(Superseded by "No permissions over the work".)_ A
    pull request report (`pr upsert`) was refused unless
    every issue it implements (named, linked already, or named by its branch or a closing keyword) is on the
    reporting agent's line, so it can neither link nor rewrite another line's pull request. A decision recorded on no
    line guards both ends of the `blocks` and `affects` links it adds, as asking does. A watch is checked, as it is
    cancelled, only by its own agent, the developer or the server, since a check moves its cursor. A proposer writes
    its proposal's done when only while it is a proposal. Releasing an issue that is not one's own claim is work on its
    line. A question's asker withdraws it only while its line's state allows scoping, unless it relays the developer's
    words. `held confirm` and `held withdraw` take only an open question or an open task, from the line or, on a
    proposal, by its proposer. Drift and notes about a pull request belong to the line of the first issue it
    implements that is on one, and its drift falls to that line's owner when nobody holds the issue. Turning
    notifications off is the developer's in person, as turning them on is. _Why:_ each let an agent change another
    line's work, or the developer's, from outside it.
  - _An open task is the developer's._ An agent may not change an open task's status or assignee through `issue
    update` or take it with `issue claim`, `--force` included; it withdraws one that no longer stands
    (`held withdraw`), and relays the developer's Done with `task done --said`. _Why:_ closing it that way skipped the
    outcome, the report to whoever holds what it frees, and the task's own event, and took it out of to do.
  - _A line the developer owns holds its agents' questions and tasks for an agent,_ as it holds their issues and pull
    requests. I'll own it winds the agents down and holds every open question and every task an agent filed, and one
    asked or filed during the wind-down is held too; none of them is in the developer's queue, in to do, or counted as
    re-confirming, and home counts them as the line's held work (`held`, every one, current or not). The developer's own
    tasks, with no outcome to send anyone, are never held, on any line. Handing the line back runs what any start does:
    current ones reach the developer again, and older ones go to the next agent to re-confirm or withdraw. _Why:_ the
    developer said they will do the line themselves; an answer or a Done there would wait in an inbox no agent reads
    until it is handed back, and asking the developer to answer an agent that is no longer there is the waste D14 exists
    to remove. Showing them was the other choice, as D14's "its tasks counted in to do" could be read; that sentence is
    about the developer's own tasks, which do count. Not counting them as re-confirming follows from no agent being
    allowed to write to the line. _Trade-off:_ an agent's task the developer would still have done while owning the
    line waits until it is handed back, or until they open it by its ref.
  - _A line waits on the developer only for what reaches them._ A held question or task waits on an agent to
    re-confirm it, so it no longer makes a line "waiting on you"; before, a line restarted with only stale held work
    and nothing else open waited for an answer the developer was never shown, and no session started to re-confirm it.
    Taking a line names only held work that waits to be re-confirmed, not an old question that already reaches the
    developer.
  - _Folded questions and tasks take the held state of the line they land on:_ held when no agent works on it, else
    released when current and left to re-confirm when not.
  - _A named outcome is one line, its name and its value._ A name has no line break, `=` or `:`, and a value has no
    line break; the note beside them may have several lines, and the line's inbox and the log say it, like a task's
    words and a Can't do it's why, on one line. Done matches names whatever their case, as filing tells them apart that
    way, and the developer's own task (which sends nothing back) is done without words, recorded as "Done". _Why:_ a
    line break in a value forged rows in the "- Name: value" list, so an agent read a name twice; a name with `=` could
    be filed but never answered from the CLI, which splits `--value` at the first `=`; and one with `:` read as another
    name and value.
  - _An agent withdrawing a task is its own event,_ `task.withdrawn`, naming the agent and its why, and puts nothing in
    the line's inbox; the task closes as cancelled with "Withdrawn: why" as its result. _Why:_ it was recorded and
    delivered as the developer's Can't do it, so the log and the line read as the developer turning down work they
    never saw.
  - _Changes since the summary leave out the developer's own doings and reorders,_ on home's count and in the line's
    panel, which lists them with the same query (`sinceSummaryQuery`: `line:L-n -actor:dev -event:line.reordered`).
    _Why:_ two drags and a nudge showed as "3 changes since the summary"; the developer's own actions are never news to
    them, and a reorder changes only where the line stands.
- **What the fifth audit changed in core, the server and the CLI.**
  - _A wake runs until its end is recorded, and its agent is not woken again meanwhile._ The agent's row keeps when its
    latest wake ended and how (`wakeEndedAt`, `wakeEnd`: exited, deadline, stopped or error); a wake with no recorded end
    runs, and the cap counts it, however silent the woken session is. One whose process was never recorded counts only
    up to its deadline, as a server that died between recording a wake and spawning it left nothing running. _Why:_ an
    agent read as asleep until its woken session ran an octo command, so the next Tell resumed the same session a second
    time, on the same worktree (B1). _Trade-off:_ an end is now something the server must record, so
    the server owns every wake it starts: see the next two.
  - _The wake dispatcher owns the wakes it starts._ It ends a stopped agent's wake itself, whatever the runner's setup,
    in watch mode too, and logs it (`agent.wake_ended`, "ended, as the developer stopped it"). `runner.stops` says only
    whether a wake ran at the Stop (`woken`), and the runner neither ends it nor runs the developer's stop command for
    it, which stays for sessions Octotrack did not start (D13). A wake a restart left behind is listed by
    `agent.waking`, watched by its process id, recorded as ended once its process is gone, and ended at its deadline or
    at a Stop, when the server starts and every ten seconds. _Why:_ only the runner's stop step ended a wake, so with no
    setup file or in watch mode a stopped agent's session kept working, and spending, for up to thirty minutes (B10);
    and after a restart nothing enforced a detached wake's deadline (B1). The dispatcher started the process, so it is
    the one place that knows it; the runner ending it too would be a second owner. _Trade-off:_ in watch mode a Stop
    now ends a running wake rather than only noting it. Watch mode is about what the runner would start; a wake is not
    the runner's, and a stopped agent working on was the harm.
  - _A wake killed at its deadline is followed by one that says to carry on._ Its end leaves the agent a notice
    (`wake_deadline`) that wakes it, and an agent whose wake was killed after its last command is woken at once,
    however recent that command, since the kill ended the session. _Why:_ the session keeps its line, and D13 said it
    "is woken again when something waits", but nothing was made to wait, so the line sat with an asleep owner and no
    owner search (B3). _Trade-off:_ a session that never finishes is resumed every thirty minutes until it does or the
    developer stops it; the alternative, leaving it asleep, stalls its line in silence.
  - _A line the developer owns keeps its agents' work held when it is tabled and started again._ Every start settles
    held work by the line's state, as a fold does, so it is released only when the line is handed back. _Why:_ ownership
    survives table and start, and releasing on every start put an agent's question back in the developer's queue,
    answered into an inbox no agent read (B2).
  - _A closed task stays closed._ An agent may change neither the status nor the assignee of a task the developer
    closed (or it withdrew); a need that comes back is a new task. _Why:_ `issue update --status todo` put a task the
    developer had turned down back in their to do, with its old result, logged only as an update (B12).
  - _A session stopped before it took its line exited; it did not fail to start._ Any Stop, release or wind-down since
    the start makes its exit `exited`, with no retry wait and no attempt counted, taken or not, and the next start has
    a new name. _Why:_ a Stop within the check-in was logged as `runner.failed` and the stopped name was started again
    two minutes later, setup and all (B11).
  - _Reserved names are never agents._ The roster leaves out the agent rows early releases made for `dev`, `octotrack`
    and `github`. _Why:_ early releases recorded every caller as seen, the server's own included, so the roster listed
    Octotrack and GitHub sync as running agents. Nothing since creates such rows. _Decided:_ the rows are kept, not
    deleted by a migration: deleting what the live database holds is never done without the developer, and leaving
    them out where the roster is read is enough.
  - _CLI options say repo._ `--repo` (still `-p`) in every option that took `--project`, which, with `--no-project`,
    keeps working as an alias; `pr list`'s two filters are one, since `repo:` takes a key or an owner/name. _Why:_ D13's
    word is repo, and options were the place it had not reached (B22).
- **Departures, each for a reason.**
  - _The pages from before lines are gone:_ Decisions, Pull requests, Drift, Issues and Repos. Nothing linked to them
    any more, and the issues page changed status through a select with no Undo. Questions are answered on home, a
    pull request shows on the issue it implements, drift on what it is about, and an architecture decision is found
    with a Log search (`type:architecture`); repos are kept with `octo repo`. _Why:_ the boards have only Lines, Log
    and Agents, and a page nothing links to still has to keep every rule.
  - _No rail, no saved views on the Log, no watches on Agents._ The boards have none: the Log is what has not been
    seen, line by line, with a search over everything; Agents is the roster. _Why:_ the boards are the agreed design,
    and each of these repeated something a page already shows. PR sync problems, which the rail showed, head the Log.
  - _The Undo bar has no Now._ The boards and D14 have only Undo. Tests apply a choice through the server instead.
  - _Some moves act at once, without Undo:_ reordering (drag or the handle's menu), I'm at, and Record answers.
    _Why:_ the first two only change what home shows and are undone by doing them again, and none is on a number key;
    Record answers is text sent with a button, which reports each line's result, which a waiting choice could not.
  - _Changes on no line, and rule breaks, are not seen until Mark all seen,_ since there is no line to open; the Log
    shows the first under On no line. _Why:_ otherwise a change on no line would never reach the developer at all.
  - _The roster shows an agent's own note_ under what it is doing. _Why:_ `agent note` is how an agent says what it is
    on, and nothing else shows it.
  - _Inter is not bundled;_ the stack falls back to the system font. _Why:_ no web font is loaded by the dashboard, so
    it starts with nothing fetched from outside the machine.
  - _Repos keep their storage name._ The table, contracts and events still say project; what changed is the words
    people and agents use: `octo repo create`, `list`, `update` and `checkout`, and `repo:` in queries,
    which takes a repo's key as well as a pull request's owner/name. `project:` keeps working, so saved watches and
    views need no rewrite. _Why:_ renaming storage changes no behaviour and would break saved watches, views and every
    agent's habits on the live database at once.
  - _Old refs resolve through the line they became._ An idea's or milestone's ref opens the proposed line made from
    it, which records `fromRef`; U- refs stay read-only updates. _Why:_ the line already records where it came from, so
    an alias table would hold the same fact twice.
  - _Places live in the database,_ edited only through the developer's `place` operations, not in a file beside the
    allowed hosts. _Why:_ they are then in the backups and migration rehearsals with everything else.
  - _Dragging a line follows the pointer, by its handle, and the handle is also a button_ that opens Move to top, Up,
    Down and To up next. The drag is pointer events, not the browser's drag and drop: they work alike for a mouse, a
    finger and a pen, the handle takes no scrolling touch (`touch-action: none`), and the page scrolls when the drag is
    held at the top or bottom of the window. Only the pointer that started it moves or ends it, Esc cancels it, and the
    click a browser sends when it ends is swallowed, so letting go over the line itself opens nothing. A rule along the
    line under the pointer, at its top or bottom edge, shows where it lands. _Why:_ the developer, of the browser's drag
    and drop: "dragging to reorder doesn't work at all"; it never worked on a touch screen. A keyboard and a screen
    reader cannot drag, and a separate Reorder mode was a second control for the same job, so the one handle does both.
  - _A press opens what it lands on, in one go._ The browser gives focus as a press goes down; home moves its own focus,
    which opens an item in place and folds the one open before, only with the press's click, and the item pressed stays
    where it was on the screen while the page above it changes (the page scrolls by what moved, and focus follows without
    scrolling). A press is held until its click or the next key, never timed, since a touch screen sends its click after
    the finger lifts. A press anywhere on a line's head that is not one of its controls opens the line, as its title does.
    _Why:_ the developer: "clicking on a line or question takes an annoying two clicks and often changes the positioning
    of the content, seems to be selecting first, when I press on something I opening it, theres no intermediary step".
  - _A press on the page beside a panel closes it,_ as a tap outside closes a sheet: one that starts and ends outside the
    panel, which is its full height whether loaded, loading or failed. What the panel shows over the page, a sheet, a
    menu's list, the Undo bar, is part of it; a finger scrolling the page ends in no click and leaves it open. _Why:_ the
    developer: "clicking outside a sheet doesn't dismiss the sheet".
  - _An agent's checkout is its own folder_ (`git rev-parse --show-toplevel`, so a linked worktree for an agent working
    in one), since one name is one session in one checkout; only the runner needs a repo's main checkout.
  - _Not a line is attested per issue, not as a closed drift._ D6 attests a drift by its fingerprint, and the
    `unplaced-work` drift's fingerprint is every open issue on no line in the repo, so one new loose issue would undo
    the attestation and ask about the returned work again. _Why:_ a record per returned issue keeps exactly the turned
    down work out, and the drift still rises for anything else.
  - _Notes still take U- refs._ `update.post` writes a new update, as `note add` does on the developer's own lines,
    while U- refs from before stay read only. _Why:_ notes are how agents report progress on an issue, the stale-work
    drift reads them as activity, and the dashboard posts them; only the old status updates became summaries.
  - _New agent names are narrow:_ letters and digits of any language, dots, dashes and underscores, from a letter or
    digit, at most 64; `dev`, `octotrack` and `github` are reserved; names from before keep working, spaces included.
    _Why:_ a name is filled into the developer's start and stop commands and written into queries, where a glob, a
    leading dash or a space would each need care; D14 sets no form for names, so the narrow one costs nothing.
  - _A line the developer owns has two adds, Add as a task and Add as a note,_ where E-States 14 draws one Add. _Why:_
    the same words become a task (open work with an outcome to report) or a note (a record that closes nothing), and the
    board's one button cannot tell which the developer means; guessing from the text would file work as a note or a note
    as work.

## D14. Lines of work at the centre

The design as built, in the phases D13 lists. Where the build departed from what was first agreed, this section says
what was built, marked (D13), and D13 says why. It is drawn on the design canvas as direction E, "One list", beside
four earlier directions it was built from.

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
- **One order drives everything.** The developer orders the lines by each line's handle, dragged or opened for its
  moves (to top, up, down, to up next), or with alt and the arrow keys. That order decides what reaches the developer first, which line an agent
  takes on, and the order of the log. Within a line, questions and tasks follow the plan step they hold up, and Later
  moves one to the bottom of its own line. _Why:_ a computed score competed with the developer's own priorities and had
  to be second-guessed. _Trade-off:_ a pressing question on a low line waits, so urgent jumps the order. Urgent is for
  questions on working lines, and for a line an agent proposes because something is broken on a line no agent may work
  on (a done service, say), which then sits at the top with Start first; either needs a reason from a fixed set
  (time-boxed, costs money, something broken); the developer can send it back with Not urgent, which is noted in the
  line's log so a habit shows.
- **The home screen is one list.** _Superseded by D16:_ what waits on the developer is answered on For you, one list
  of every item with the open one in place, and Lines shows each line as one row with how much waits there; the header
  counts are gone. What follows is how it was. Each working line shows its owner ("owner meals, asleep"), its summary's headline,
  its plan step ("step 3 of 4, settle board and opening", taken from the plan, written by no one) and the first thing
  waiting on the developer, with the rest one row away ("+2 more for you"); only the focused item opens fully, with what
  each option does and, directly under the options, the reason for the recommendation. That keeps five lines on about
  one screen. An urgent question sits at the very top, in red, and stands alone like any open question. It is announced
  to screen readers and counted in the header ("1 urgent"), and `g u` jumps to it, but it takes focus only when the page
  opens or nothing is focused, since a key meant for one question must never answer another (D9b); nothing else sits
  above the list. When a working line has no owner and could not be given one, "Step in" is that line's first item, in
  red, on its own row, so the line is read once and keeps its place in the order. Unfocused questions show their title
  and recommendation as one row that opens them; answer buttons appear only on the focused, opened question, and number
  prefixes only on the focused item. On the phone, the first line's first item is opened, the next line shows its first
  item as one row, and further lines are one row each with how many items wait, except that a Step in item always shows
  on its line. Up-next rows show their done when and how far scoping got, and their names open the line in place like
  any other; the tabled row names its lines; done lines stay a few days under Done lately. The header counts what is
  waiting (to answer, to do, to accept, to step in), and each count goes to the next such item after the one in focus,
  round to the first after the last (`?next=<count>`), or to the first when pressed on another page. To accept counts
  what home shows: proposals, and a case for done or a new done when on a working line. Past
  six working lines, the header also says what spreading thin is costing (lines with no owner, lines waiting on you): a
  nudge to table, never a cap. _Why:_ the first drafts stacked a queue above the list, so the same lines were read twice
  and the lines were not at the centre.
- **Any ref opens in place.** A task or an issue opens in the same panel as its line, from the list, the log or a
  summary. A task shows what to send back as a form, saved as it is typed so it can be finished another day or on
  another device: Done sends it, and Can't do it asks why and closes it as not done. An issue shows its pull request
  with its checks, and plan steps show them too. Everything written, by agents or the developer, is markdown, and every
  box grows as you type. _Why:_ the developer named "lack of markdown support, issues having too small of a ui, updates
  not having auto growing input box", and pull request status has to be visible without leaving the line. Checks are
  agents' to fix, never the developer's: a failing check counts as work on the line, so some agent takes it.
- **The developer orders, answers, does, tells, stops and accepts.** Everything else belongs to the agents: issues,
  plans, pull requests, scoping, and keeping each line's summary true. An agent merges the pull requests for the issues
  it holds once their checks pass and it judges the issue done, and asks a question when it wants the developer's eyes
  first, so no pull request waits on the developer unseen. Agents is a roster (name, repo, line and role, last command,
  wake address, what it is doing) whose only actions are Stop, Lift on a stopped agent and Release on a quiet one: what
  needs the developer is on Lines. A line's panel also offers Stop on its owner and I'll own it, beside the owner.
- **Agents, claims and the owner search are stated in commands, once.** Octotrack sees only commands, watch polls and
  pull request sync, so every rule is written in those, in the three tables below; boards and notes only summarise them.
  An agent is one named session, known by its name plus its checkout, which the CLI sends with every command. Its first
  command registers the name, its repo (the server reads the checkout's git remote itself) and a wake address or none.
  The same name from the same checkout is the same agent resuming; from another checkout, while the first is not gone,
  it is refused with a free name suggested (meals.2). Names shaped like a ref (GARDEN-2) are refused. The developer is
  something present, never something missing: the dashboard, or a CLI call with `--me`, or with a developer setting
  honoured only on an interactive terminal, which agent tools' shells never are; channel `cli`. A call that carries an
  agent name is never the developer. A call with no name from a checkout one agent that is not gone uses is that agent;
  from a checkout two such agents use it is refused with "two agents use this checkout; pass your name"; and any other
  is refused with "set your agent name", which never mentions `--me`. Since "No permissions over the
  work" above, an agent makes what were the developer's operations itself; passing `--said "<the developer's words>"`
  records why (channel `out_of_band`), and the log shows it, never folded, naming the agent and quoting the words. Agent operations need a registered name, and Octotrack numbers the sessions
  it starts upward from the repo's name (octotrack.3), never reusing one. Who holds a line is one table of claims (line,
  agent, and a role of owner, helper or scoper); an agent is on any number of lines, and claims issues only on lines it
  is on: an owner in any repo its line names that has a checkout here, a helper only in its own repo. Taking a line keeps
  the others. A question, a task or a release that names no line goes to the agent's only line; on several it names
  one, since any guess could put the work on the wrong line. Stop, an exit and a session gone end every claim; the
  developer releases an agent from one line or all. A line still has at most one owner and one scoper, since two would
  write over each other's summary and plan. Lines needing an owner are offered to idle agents and helpers, not to an
  owner, which already speaks for a line; it may still take one. _Why, for several lines:_ the developer: "'Octotrack
  lets one agent hold only one line' is again an unjustified restriction" (their quotation marks, as single ones here).
  Work is an open issue on a line, in a repo, not blocked, not the developer's and not claimed. A line is scoped
  once it has a done when and a plan step and its scoper has released it, and unscoped again after eight weeks. _Why:_
  "the top line first" would pile every idle agent onto line one, and a crash, a clean exit and a line waiting on the
  developer must each come out right without the developer.

| Agent state | When                                                                                                  | Its claims                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| running     | a command, watch poll or push in the last 15 minutes                                                  | its replies tell it of lines needing an owner               |
| asleep      | not running, with a wake address, including a session Octotrack started whose process exited          | kept; woken by inbox items and waking notices               |
| quiet       | not running, no wake address                                                                          | kept; Agents shows its last command, with Release beside it |
| gone        | a wake failed, or the runner saw the process of a session Octotrack started exit with no wake address | ended; a worktree Octotrack made goes to the next session   |
| stopped     | Stop, by the developer or an agent                                                                    | ended; every write refused until it is lifted               |

An agent is idle when it is on no line or only scoping, and reachable when it is running or asleep. No claim ends on
a timer: a line can run for weeks with its owner busy and silent, and silence alone says nothing.

| Claim event                                                        | Effect                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `line take L-7`                                                    | on a working line that names its repo: owner if it has none, else helper; on an up-next line: scoper if it is unscoped; otherwise refused with why, and never counted                                                            |
| bare `line take`, on no line                                       | owner of the highest working line in its repo with no owner; else helper on the highest with work in its repo; else scoper of the highest unscoped up-next line in its repo                                                      |
| bare `line take`, on its own line                                  | owner: its next issue, or "break step 3 into issues, or propose done", or "nothing for you; you will be woken", and it stays; helper: its next issue, else released and searching again at once; scoper: working-line work first |
| taking a different line                                            | releases the current one first                                                                                                                                                                                                   |
| `line release`, gone, Stop                                         | ends its claims                                                                                                                                                                                                                  |
| the owner's claim ends while a helper remains                      | the helper becomes owner, with no search                                                                                                                                                                                         |
| an up-next line is tabled, done or dropped while a scoper holds it | the scoper gets a wind-down notice that wakes it; its writes in those 15 minutes are refused but never counted; then its claim ends                                                                                              |
| an up-next line starts while a scoper holds it                     | the scoper becomes owner, with no search                                                                                                                                                                                         |

| Owner search | Offered to                                                                                                                                                                              | The step ends when                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1            | the last owner, woken, when its process exited or on a Start, if it is now idle; never after release, Stop or a failed wake                                                             | it takes the line, 10 minutes pass, or the wake fails |
| 2            | idle agents with the repo, scopers included, and helpers in that repo on other lines, in their replies                                                                                  | one takes it, or 30 seconds pass                      |
| 3            | a session the start command runs, up to the developer's cap; at the cap, the lowest Octotrack-started helper is told to release after its current issue, and the search takes its place | it takes the line within 5 minutes                    |

The search does not reach step 3 while all of a line's open work waits on the developer: the line shows "waiting on
you", answers wait in its inbox, and the next answer, finished task or Tell starts the search again.

- **The owner speaks for the line.** The owner writes the summary, proposes done, and is the one a Tell is for. Any
  agent on the line may file questions and tasks; helpers never write the summary.
- **Everything sent goes to the line, not the agent.** Answers, Tells and finished tasks wait in the line's inbox, each
  for whoever claims the issue it concerns (a question records that issue when asked: the one the asking agent holds, or
  one it names), else the owner; whoever receives an inbox item is woken by it if it is not running and left a wake
  address, and with no owner, whoever takes the line reads the inbox. Line inbox items are answer, tell, task done, task
  can't and not yet. Agent notices go to the agent they name (the proposer, for a proposal's outcome): wind-down and
  proposal placed wake it; stop, not urgent, and done when kept or accepted never wake, and wait for its next command.
  Every reply to an agent's command carries its unread items and notices, so even an agent that never checks its inbox
  hears in time. _Why:_ questions stand alone, so any owner can act on their answers, and a dead owner then holds
  nothing up. The session still decides "if it want to be reawaken", once, by leaving a wake address or not.
- **A plan step's status is set, one step at a time.** Each step is to do, under way or done. The line's owner sets it
  with `octo plan step <LINE> <step> <todo|doing|done>`, and the developer from a menu on the step in the line panel;
  rewriting the plan keeps the status of every step whose title stays. The current step, which home and the owner's
  next job read, is the one under way, else the first not done. _Why:_ the developer found no way to mark a step done;
  a status nobody can set left every line on step 1. Nothing infers it from the issues under a step, since a step can
  be done with no issue on it, or not done with all of them closed.
- **Every working line gets an owner, without the developer.** The search runs the moment a working line that is not the
  developer's has no owner, whether or not it has issues; with none, the owner's job is to break the current step into
  issues or propose done. Once every working line has an owner, spare sessions under the cap go to helpers for unclaimed
  work, in line order, so the developer's order also decides where parallel agents go. Stopped agents are never offered
  a line. An owner whose claim ended and that comes back to a taken line is told it is a helper, with the issues it lost
  and who holds them, and whoever is handed such an issue is told who last held it, when, and its branch. The start command is one
  command in `~/.octotrack/agent-setup.json`, with optional per-repo overrides and setup commands, edited only on the
  developer's machine and never by an operation (D12). It runs in the repo of the current step's first unclaimed issue,
  else the line's first-listed repo (step 2 of the search uses the same repo), in a new git worktree beside that repo's
  main checkout, or in a gone agent's worktree handed on for that line, and passes only the line's ref and the name, so
  tracker text never becomes a prompt. Octotrack touches only worktrees it made, removes one only when it is clean, its
  branch is pushed and no claim uses it, and never touches a checkout the developer started a session in. When this
  machine has no checkout of the repo, Octotrack clones it with `gh` into a folder set in the same file. A start that
  exits at once with an error spent nothing, uses up no name, and is retried by itself, less often each time, with
  Agents showing only the latest attempt; one that ran but never took the line is not retried until the developer acts.
  Octotrack keeps each start's exit code and last lines of output. The line gets a Step in item only when no start
  command is set, a clone failed, a start keeps failing or never checked in, or the cap is reached with every counted
  session an owner; the item shows that output, says what to do ("the agent command is not logged in on this Mac: log it in"), and
  offers the action that fits (the file and line to add, then Try now, when no start command is set; Set its checkout
  when a clone failed; Try now, which retries every line stopped the same way, when a start keeps failing or never
  checked in; Start one anyway at the cap), with Table it and I'll own it beside. _Why:_ a line the developer marked
  working should not sit idle for want of a click the tracker can make. _Trade-off:_ sessions are spent without asking
  each time, and a sleeping agent is not reused; the cap bounds the cost.
- **The developer can own a line.** "I'll own it" makes it theirs, and it stays in Working on, marked yours, its tasks
  counted in to do, after the same 15-minute wind-down as tabling: it shows their tasks and notes, added from one
  growing box as a task or as a note (D13), and no summary falls due. The agents' open issues and pull requests stay on
  the line as held for an agent (pull requests open at the deadline included), and no agent writes to it until "Hand to
  an agent", which asks for repos only when the line has none and then runs the usual owner search, with Undo.
- **What agents may write depends on the state.** Working on: anything. Proposed: scoping only, by the agent that
  proposed it. Up next: scoping only (done when, plan, held questions and tasks), by an agent that took it to scope;
  claiming an issue, moving one to in progress or done, and reporting a pull request are refused there. Tabled, done and
  dropped: nothing. Moving a working line to up next or tabled, ending it with Done or Drop, or I'll own it gives its
  owner, helpers and scoper 15 minutes to wind down: a hand-off summary, reports on answers already taken, a branch note, and
  for Done and Drop, closing, or folding into another line (where they land held if that line is up next or tabled),
  every open issue and pull request, and a closing note. Then the claims end. For Done and Drop, at the deadline
  Octotrack closes the tracker issues still open, as closed with the line, and discards its drift, and the local runner
  closes pull requests still open on GitHub with `gh pr close` and a comment naming the line; the log says so. For up
  next, tabled and I'll own it, issues, pull requests and drift all stay, held. A write refused after that is recorded
  and always shown in the log. So is a pull request opened, or a new head commit pushed, after the wind-down for an
  issue on an up-next, tabled, done or dropped line (a push on a line the developer owns is presumed theirs), when pull
  request sync sees that issue's ref in the branch name or after a closing keyword (Fixes, Closes), counted once per
  pull request; pull requests already open at the deadline are held and listed once in the log. Since every push comes
  through the developer's one GitHub login, these are shown in the log on their line but never blamed on an agent. On
  the third write from one agent in an hour that the line's state forbids, Octotrack was to stop that agent itself
  (_superseded by "No permissions over the work": nothing is refused, so there is no automatic stop_). Wind-down notices reach helpers too. Stop's Undo bar says when another agent will then take the
  line, and offers Pause the line instead, which moves it to up next. Stop refuses every write under that agent's name,
  ends its claims, sends it a notice, runs the developer's local stop command if one is set, and marks it stopped on
  Agents until lifted. _Trade-off:_ Octotrack cannot kill a session; refusing its writes and telling it is what it can
  do. (D13: since the third audit, it does end the process group of a session its own runner started.)
- **Questions stand alone.** Asking requires a situation written for someone who has read nothing else, options that say
  what happens if picked, and the reason behind any recommendation. Both are shown wherever a question is open, phone
  included. Background stays folded. _Why:_ "the operator needs to read millions of lines of text to get context on one
  decision".
- **Things only the developer can do are tasks, not questions.** A question has options; a task has an outcome to
  report: a measurement, a login, a play-test. In the tracker today most blocked issues are tasks in disguise ("waiting
  on Vasco"), and nobody is told. A task is an issue assigned to the developer, with a place, an outcome, and the issue
  it frees (a `blocks` link, by default the filer's claimed issue), so it always has a ref and its Done and Can't do it
  go to whoever holds that issue, else the owner; and it waits on its line in the developer's order. Places are a fixed
  list the developer owns (the bench, the Mac, the phone, the house), and the CLI refuses any other. "I'm at" keeps the
  same list and order, opens that place's tasks, folds everything else (questions included) to one row per line, adds
  current tasks for that place held on up-next lines (asked or re-confirmed in the last 7 days, never on tabled ones),
  and ends by itself after a few hours. Drift asks agents to turn blocked-on-the-developer issues into tasks.
- **Tasks act like questions.** A task's choices are Done (its outcome form) and Can't do it, the same everywhere; on
  home only the focused task shows them, and other tasks are one row that opens them. "I'm at" is the one exception: at
  a place, every task for it shows its choices.
- **A question a task would settle waits for the task.** When a pending task's outcome would settle a question, the
  question is linked as blocked by the task, held and not shown, and withdrawn if the outcome settles it; the agent
  decides the rest. _Why:_ asking the developer what their own measurement is about to answer is the decision the design
  exists to remove.
- **Up-next and tabled lines hold their questions, tasks and drift.** Tabling asks for a reason and an optional date to
  look again; on that date the line comes back under Proposed, counted as to accept, with the developer's own tabling
  reason and date beside it instead of a recommendation, since no agent may write to a tabled line, and the choices any
  proposal has (Drop in place of Not a line). A tabled line can go back to up next, or start at once through the Start
  sheet. A held question or task is current when it was asked or re-confirmed in the last 7 days; any other goes to the
  agent that takes or scopes the line next, to re-confirm or withdraw, before it reaches the developer, and Start shows
  only current ones. _Trade-off:_ a question can wait a long time, which is why age alone decides whether it is trusted.
- **Every choice can be undone, and answers say what became of them.** Every choice, by key or tap, waits a few seconds
  with Undo before it takes effect: an answer, Start, Table, Done, Stop, Mark all seen, a drift answer, a note.
  Reordering, I'm at and Record answers act at once (D13). The Undo bar is a polite live region that says the choice and
  "u to undo". An answer then shows one status sentence on its line: not picked up, picked up, carried out, or that a
  wake failed. After that, Change answer reopens the question and sends the new answer as replacing the old; if the old
  one was carried out, the owner reverts or adapts. _Why:_ state changes are reachable by number keys, so a stray key
  must cost nothing. An answer closes one question; Tell is a free message that closes nothing: to the owner, or, opened
  from an issue, into the line's inbox with that ref, for whoever holds the issue, and the box names who; empty, it is a
  nudge.
- **Summaries stay true without anyone reading history.** A summary opens with a headline written to stand alone; home,
  the log and the phone show only the headline, the line shows the rest. The owner rewrites both at the end of a
  session. They fall due an hour after significant work. Significance is decided by what happened, not by the agent: a
  plan step changed, an issue closed, a question asked or answered, a pull request merged. Until they are rewritten, the
  line lists everything newer than its summary, one line each, with what the developer has already seen folded to one
  row; only the log filters by seen.
- **Agents propose, the developer accepts.** Agents propose a line when they find work with none, or when the developer
  starts something new in conversation. Every proposed line comes with the agent's recommended placement (start; up
  next, and where; table, and why; or fold into a line) and a one-line why, shown like a question's recommendation, and
  offers the same five choices: Start, Up next, Table (which asks why), Fold into, Not a line. Agents also propose a
  line as done, with how "done when" was met; that proposal is the line's first item, on its own row, with Done and Not
  yet…. Done on a line is the developer's own decision and final: the owner closes out, and its closing note says how
  done when was met, or what is not. Both kinds count in the header as "to accept". A line the developer adds names its
  repos, or says it is theirs, and goes to up next, starts, or is tabled with one button each. Nothing joins or leaves
  the list without the developer's yes. On first run, migration makes today's projects into repos only, since the
  one-project-per-repo layout was never the developer's choice. Their open issues become work with no line, and the
  drift that asks for a line has agents with each repo propose real lines from them, each with a recommended placement;
  old milestones arrive as candidate proposals, the nearest thing to a line that existed. The first-run screen shows
  proposals as they arrive, with one Accept recommended placements, with Undo, and drift has agents turn issues waiting
  on the developer into tasks during the first day.
- **Not a line ends new work, and returns old work.** On a proposal for work the proposer created, "Not a line" closes
  its issues, and the local runner closes its pull requests, with the proposer noting the branch; on a proposal made
  from issues that already existed, it returns them to no line. Either way it is recorded as an attestation (D6), so the
  drift that asks for a line for work with none stays satisfied and the same work is not proposed again. "Fold into" is
  how to keep the work.
- **Done when changes only with the developer's yes.** A change to done when is a proposal: the old text stays in force,
  and done is judged against it, until the developer accepts. On a working line it is an item to accept, with Accept and
  Keep current, counted in to accept and never folded in the log. On an up-next line it is held like the line's
  questions: the row says "done when changed" quietly, and Accept or Keep current waits in the Start sheet beside the
  held questions. _Why:_ done when says what the line is and when it ends.
- **The log shows what has not been seen,** line by line in order. A line counts as seen once opened, or with Mark all
  seen, and the developer's own actions are never unseen. Each change is a row, except checks, drift confirmations and
  re-confirmed questions, which fold into one sentence. Up-next and tabled lines are left out unless asked for; refused
  writes never are.
- **State changes are buttons, never radio buttons,** so no arrow key can table a line. Every control on a desktop is
  32px tall; every target on the phone is at least 44px. Buttons say what they do, with no ellipsis for one that asks
  first, and the few icons stand beside words or alone in a control that names itself.
- **Keys move the browser's own focus.** j and k move focus between items, top to bottom as drawn: an urgent question,
  the lines with their items, then Proposed. Tab moves within the focused item, and 1–9 pick its numbered choices,
  numbered in the order drawn, sheets included: an option, a step-in action, a proposal's choice, Done or Can't do it,
  Accept or Keep current, Done or Not yet. There is only one focus, marked with a border in the theme's accent and, where the window has
  room, a quiet "k [up] j [down]" beside it (D13), so a key never acts on an item other than the one in focus. Live updates
  never move it: new items appear without taking focus. After a choice, focus goes to the line's next item for you, then
  the next line; after Later, to the next item. Shift with J and K steps through the lines themselves, Working on then
  Up next, so a line with nothing for the developer can be reached; o, t and alt with the arrows act on the line of
  whatever is focused. Keys never act while typing, u undoes the last choice while it waits, and all of them are listed
  behind "?".
- **Interruptions are rare.** The phone is interrupted only for urgent questions, and questions and Step in items on the
  top two lines, by Web Push to the app installed from the Tailscale HTTPS address. The notification carries the
  question and the recommendation; tapping it opens that question in the app, focused, with its situation and options,
  where one tap answers with the usual Undo. A line buzzes at most once until the developer next opens the app, and
  urgent questions always buzz. Tasks never buzz: they wait for "I'm at". _Why:_ iOS shows no buttons on a web
  notification, and answering from the lock screen would skip the situation. _Trade-off:_ Web Push needs the server to
  reach the browser's push service, an outbound connection D10 did not have; nothing new reaches in.
- **One vocabulary:** line, working on, up next, tabled, done, dropped, proposed; summary, headline, done when, plan,
  step; agent, owner, last owner, helper, scoper, claim, wake address, inbox, running, idle, reachable, asleep, quiet,
  gone; issue, pull request, check, ref; question, situation, task, place, held, later, urgent; for you, step in, tell,
  stop, stopped, lift, scope, take, release, wind-down; log, seen. A line is waiting on you when all its open work waits
  on the developer, agents on it when an agent has work on it, and has no owner when no agent holds the owner role.
  Contracts and the CLI use the same words. Refs keep their prefixes, because a ref never changes once written: L-12 is
  a line, D-34 a question, PANEL-6 an issue in the homepanel repo. A line's ref shows beside its name on the line, the
  log and Agents, so it can be given to an agent in conversation.

What it changed in what was built before:

- **Refs.** Lines get their own refs (L-12). Every existing ref stays valid. Project keys became repo keys, so PANEL-6
  is an issue in vasc/homepanel, on whichever line its line field names, and Fold into moves it without changing its
  ref. Old milestone and idea refs (M-2, I-4) open the proposed line made from them, which records where it came from;
  status-update refs (U-9) stay read-only updates (D13). Issues on a developer's line with no repo take one fixed
  prefix, ME. Of the link kinds, `blocks` now also holds a question behind the task that settles it instead of feeding
  a score.
- **Data.** Projects became repos: key, GitHub repo, and the main checkout (the parent of `git rev-parse
  --git-common-dir`, so a linked worktree never stands in for it), filled from the first agent that runs there, or from
  a clone Octotrack makes. Lines are a new table: state, order, done when, repos, headline and summary with the time
  each was written and falls due, the last owner, the developer as owner, the owner search's start and first-refusal
  deadline, a failed start awaiting the developer and its reason, the tabled reason and look-again date, the wind-down
  deadline, and the developer's last look, which drives seen. First run fills it from the agents' proposals and the old
  milestones. Lines also keep the time they were scoped. Issues gain a line and a plan step. Who holds a line is one
  table, line claims (line, agent, role of owner, helper or scoper, renewed at); owner, helpers, scoper, an agent's line
  and "no owner" are all read from it. Milestones become plan steps: an ordered list per line, which questions and tasks
  name as what they hold up. Questions gain the issue they concern, the urgent reason, any Not urgent and a Later
  position; questions and tasks gain held and the time they were last confirmed; tasks gain a place, outcome fields and
  the issue they free. Agents get a table: name, repo, checkout, wake address, last command, stopped, started by
  Octotrack with the time it must check in, and unread notices. Each line's inbox is a table: kind (as listed above),
  ref, and delivery state. Choices waiting out their Undo, Web Push subscriptions and "I'm at" with its expiry are
  server state. Refused writes are recorded events. Places live in the database, edited only with `octo place` (D13);
  `~/.octotrack/agent-setup.json` holds the start command and its per-repo overrides, one stop command, and the cap,
  which counts sessions Octotrack started whose process is alive, and woken ones at work (D13). Outcome fields and
  drafts of answers and Tells are saved on the server as they are typed, per item, so they follow the developer between
  devices.
- **Operations.** Kept: issue claim and release (take uses them), decisions with pickup and report, `decision batch` for
  answers given elsewhere (on Lines too, as Record answers behind r, each placed on its line), drift (keyed on line
  instead of project, or on repo for work on no line), watches (a poll renews claims and receives offers), pull request
  sync, which stays read only. Changed: projects become repos and lines; the `project:` query key becomes `repo:`,
  `line:` is added, and `project:` keeps working, so existing watches need no rewrite (D13); `next` becomes `line take`;
  milestones become plan steps; ideas become proposed lines; status updates (U-) become summaries with headlines. Added,
  each a contract with a CLI command in the same words, as D1 requires: for the developer, `line add`, `line order`,
  `line start`, `line retry` (with `--anyway` past the cap), `line queue` (to up next), `line table`, `line done`,
  `line drop`, `line fold`, `line reject` (not a line), `line not-yet`, `line own`, `line hand`, `done-when accept` and
  `done-when reject`, `agent stop` and `agent lift`, `tell`, `task done` and `task cant`, `question later`,
  `question not-urgent` and `question change`, `at` (I'm at; with no place it leaves), `draft save`, `choice undo`,
  `line accept-recommended`, `seen`, `place add` and `place remove`, `repo checkout`, `push seen` and `push unsubscribe`
  (Buzz this device subscribes from the dashboard); for agents, `agent register`, `line take` and `line release`,
  `line propose` (with `--urgent` and a reason, for something broken on a line no agent may work on) and
  `line propose-done`, `question resolve` and `question record` for what the developer told them, `done-when set`, `task file` (naming the issue it frees),
  `held confirm` and `held withdraw`, `summary write`; and for the developer on a line of their own, `task add` and
  `note add`. The operations keep their `decision.*` names, and the CLI takes `question` for every `decision` command
  (D13); `decision postpone` is also `question later`, and `decision wake` and `--wake` give way to the wake address an
  agent registers. Draft saves are an exception to D9b: they send a debounced notice that only the developer's other
  devices act on, and no client overwrites a field that has focus. From the CLI a choice takes effect at once, since
  typing the command is the deliberate act; it can be reversed by the opposite command, and answers by
  `question change`. Removed: roadmap generation, since the ordered list is the roadmap.
- **Decisions it replaces.** D8's score gives way to the developer's order. D9's feed as "the primary interface", with
  one decision open on it, gives way to the home list and its one focus. D4's `project:` becomes `repo:`, with `line:`
  beside it. D11 still syncs every repo with a GitHub name (D13), and the local runner now also closes the pull requests
  of ended lines and of work that is not a line. D12's inbox moves from the agent to the line, and its per-decision wake
  becomes a wake address registered once per agent. D3 gains a seam: the server runs and stops sessions, makes
  worktrees and clones, wakes agents and sends Web Push, asking core what is due and recording what happened through
  operations only the server may call, and core reads a checkout's remote through a function the server gives it, so
  core still imports nothing tied to a runtime; on Cloudflare the runner would be a small local companion polling the
  server.
- **A requirement it supersedes.** "the primary interface should be a feed of status and decisions fully filterable"
  came first; "projects and roadmaps needs to be at the center, feed works well but its it can sometimes get in the way
  with decisions about projects that are currently tabled" came after a week of use, and wins. The feed lives on as the
  log.
- **Built only once agreed.** An exploratory branch, `lines-of-work`, tried an earlier version of this model in code. It
  added an "area" layer above projects, which this design drops, so it was research, not the starting point.

## D15. A line's plan is a tree

**What the developer said:** "Linear plans are not reality", "In a line there will be a critical path and there will be
side branches", "If a side branch becomes complex enough it will become its own line", and "Tracking and displaying
this tree must be a part of the tool". Drawn on the canvas as "Line · its plan as a tree" (Plan-Tree.dc.html).

**The problem.** A plan was one ordered list of steps. Real work forks: parts are ordered while the print is tested, a
bracket is designed beside the case, photos are taken whenever. Squeezed into one list, side work either pretends to be
on the critical path (so "step 3 of 5" lies about what holds the line up) or is left out of the plan. Work that grows
into its own effort had no way to leave the plan and become a line while keeping its link to what it holds up.

Everything below is my design, with its reasons.

- **The critical path stays the numbered steps.** It is what done when needs, in order, and "step 2 of 4" counts only
  it. _Why:_ the developer named it; it keeps home's one fact honest. Branches never change the count.
- **A branch forks from any step and may hold up one later step of the sequence it forks from.** It has a title and its
  own ordered steps. A branch off the critical path that holds up step 4 makes step 4 wait for it; one that holds
  nothing up is side work that never keeps the line from done. Branches fork from branch steps too, so the plan is a
  tree of any depth, and a branch off a branch holds up a later step of that branch. _Why:_ the join is what makes a
  branch matter, and it is the one fact a list cannot say. _Trade-off:_ a branch joins at most one step; work that two
  steps need is two branches or belongs on the critical path. A full dependency graph (any step waits on any steps) was
  considered and left out: it needs a graph editor to be readable, and nobody asked for one.
- **Addresses read like the tree, ids stay put.** The critical path is `1`, `2`, `3`; branches off step 2 are `2a`,
  `2b`; their steps `2a.1`, `2a.2`; a branch off `2a.1` is `2a.1a`. Steps and branches have stable ids underneath, so
  an issue stays on its step when steps are inserted or the plan is rewritten; addresses are worked out when shown or
  typed, and a bare number still names a step on the critical path. Each step also keeps its place in the tree read top
  to bottom, so work is picked up in plan order. _Why:_ the CLI and the panel need something short to say, and
  positions alone moved issues before.
- **Rewriting a sequence keeps what stays.** `plan set` and changing a branch's steps match old steps by their words: a
  step whose words stay keeps its id, status, issues and branches. A step taken out leaves its issues on no step (on a
  branch, back on the step it forks from), and its branches move to the step before it.
- **Status is per step; a branch is done when all its steps are.** Each branch has its own current step (the one under
  way, else the first not done). A step that waits on an open branch refuses Done, naming the branch, until the branch
  is finished or set to hold nothing up. _Why:_ marking it done anyway would hide the very thing the join records.
  _Trade-off:_ one more refusal to meet; the message says the two ways out.
- **A branch becomes its own line by promotion.** Its title becomes the line's title (the developer may change it), its
  steps the new line's critical path (its own branches come along), and the issues on them move with it; done when is
  asked for, as for every line. The developer places it up next or starts it, from a sheet, and like a line's other
  moves it waits a few seconds with Undo. An owner's promotion is a proposal with a recommendation (up next unless it
  says otherwise), like every line an agent wants. In the old plan the branch stays as one row that opens the new line
  and still holds up its step; it is done when that line is done. The new line's head says whose branch it is, and its
  row on Lines says "branch of L-1, holds up its step 3". _Why:_ the developer's words; keeping the link means the
  parent's step still waits on the work wherever it now lives. When is "complex enough" is the owner's judgment, guided
  by `octo guide` (it needs its own owner, its own repo, or would run beside the critical path); there is no size or
  time threshold. _Trade-off:_ a branch can grow large before anyone promotes it; the panel shows how far along each
  branch is, so it is seen.
- **Changes name a branch or step by its id as well as its address.** The dashboard sends both, so a change that waits
  in Undo's window, or a sheet left open, reaches the same branch though an earlier one was removed meanwhile and the
  addresses moved; the CLI names them by address, as typed. A branch may hold up only a step not yet done. An owner with
  no issue to pick up is pointed first at the branches its current step waits on, and told what the step waits on when
  nothing is left to break into issues. Changing a step's status or a branch makes the summary due, as rewriting the
  plan does. Removing a branch that a line was made from, or under which one was, leaves that line as it is, no longer
  linked; the Undo bar says so for the branch itself.
- **A line made from a branch that ends without being done stops holding its step up.** Dropped, or turned down as not
  a line, the branch reads ended and the step it held no longer waits; its work went with that line. _Why:_ putting the
  steps back would revive work the developer chose to drop; it reads "ended" in the plan. A tabled one still holds its
  step, which then reads "waits on L-12, tabled" in the warm tone, on the plan and on Lines, so the stall shows. Moving
  a branch's issues to the line it became is in the feed, like a fold; an agent's claim on them is let go and work
  under way goes back to to do, since nobody works on the new line until it starts, and questions about them go along.
- **Shown as an outline with rails (direction A on the canvas).** The critical path runs down the left as before; each
  branch hangs under the step it forks from on a rail, with its own status menus and its More (what it holds up, ticked;
  Rename or change its steps…; Make it its own line…; Remove the branch, with Undo); the step a branch joins carries a
  merge mark and "waits on 2a". Lines adds "2 branches open" to a line's facts, and "waits on 2a" when the current step
  waits. _Why:_ it keeps every step's menu and issues in place and works at phone width. _Trade-off:_ fork and join are
  read from words and the mark, not seen as shapes. The canvas also draws direction E, a map with the critical path as
  a straight rail and branches leaving and rejoining it, which shows the shape at a glance but needs a column per
  parallel branch and leaves no room for menus and issues.
- **Operations.** `line.show` gives the tree as flat steps and branches with their addresses, which `octo plan show`
  draws; `plan.set` (the critical path); `plan.branch` (add: from, holds up, title, steps); `plan.branch.update`
  (title, holds up, steps); `plan.branch.remove` (its issues go back to the step it forked from); `plan.step` (status,
  by address); `plan.promote` (a branch to a line). `issue create --step` and `issue update --step` take an address.
- **Data (schema 26).** `plan_steps` gains an id, a branch (none for the critical path) and its place in the tree; a new
  `plan_branches` holds id, line, the step it forks from, the step it holds up, title, and the line it became. `lines`
  gains the branch it came from. `issues.step` holds a step id. The migration gives every existing step an id on the
  critical path and moves each issue's position to that id; nothing else changes for plans without branches.

## D16. For you: what waits on you, one at a time

**What the developer said:** "right now pressing that jumps around semi randomly, it would be good to desing a feed that
shows those actions in order, especially that when I press later it goes to the bottom of the feed"; of ten directions,
"triage is the way"; "if im in for you and I want to peek at the line, I should be able to click a link and see it
without jumping to another screen"; and of the folding page, "the moving left is a great choice". Drawn on the Triage
page of https://claude.ai/artifact/JSt9awRkVko2hzaKCy5ayF, kept in `design/canvas/triage/`.

**The problem.** Lines held every item in place, and the bar's counts jumped to the next one somewhere down the page.
The developer could not see what came next or keep a place, and Later did not visibly send anything anywhere.

**What was built.** For you is the page at `/`, with Lines at `/lines`. A rail lists the views (All, Urgent, To answer,
To do, To accept, To step in) with their counts; each is its own address, `/for-you/to-answer`. Beside it, every entry
the view holds is one list, the one you are on opened in place as a card, the rest a row each; a proposal's row carries
its agent's recommended move when it needs nothing more. Asked to see all of them at once ("I need all those 66 to
show up in the page"), the developer chose this over a list beside the card. `j` and `k`
move, the open entry is in the address as `?item=`, and when it is answered the one after it opens in its place. The
order is the developer's order of lines, urgent first, proposals after the working lines, questions on no line last;
Later sends an item to the bottom of the whole list, the last put off last. A line named on the card peeks in place:
the rail folds away and the list moves left, so the list and the peek are both whole.

**Decisions.** The bar is one row: Lines, For you with how much waits, New line, and More, which holds the Log, Agents,
the appearance and the keys, since the Log and Agents are used less. I'm at leaves the bar: it was never used, and the
CLI keeps `place` and `at`. The drawings' layout, type and spacing became tokens; colour stays each theme's own, since
the language allows a blue highlight only in a theme whose colour is blue. The plan is in `docs/plans/triage.md`.

## Data model

Everything is addressed by a **ref**: `L-4` (line of work), `OCT` (repo, stored as a project), `OCT-12` (issue or
task), `D-3` (question), `PR-7` or `owner/repo#12` (pull request), `U-9` (status update), `DR-5` (drift), `W-1`
(watch). `M-2` (milestone) and `I-4` (idea) open the proposed line made from them, where there is one, and otherwise
the old record, read-only. A repo keeps its GitHub name and, once set, its main checkout. Lines, their repos and plan
steps, claims, notices, the line inbox, waiting choices, drafts, places, where the developer is, runner starts and
worktrees, and Web Push subscriptions each have their own table. Lines also keep an urgent reason for an urgent
proposal, when the developer last looked at them, and a pending Start one anyway. Links connect any two refs:

| Relation       | Meaning                                | Effect                                   |
| -------------- | -------------------------------------- | ---------------------------------------- |
| `blocks`       | from must finish before to can proceed | readiness, a task frees its issue, drift |
| `implements`   | PR implements issue                    | PR and issue status drift                |
| `affects`      | decision changes what to should say    | drift on resolve                         |
| `derived_from` | from is derived from to                | drift when to changes                    |
| `supersedes`   | decision replaces decision             | history                                  |
| `promoted_to`  | idea became issue/milestone            | history                                  |
| `relates`      | informational                          | none                                     |

The append-only `events` table is the feed and also what event clauses in watches match against.

## Known limits

- Query matching and drift recomputation are linear in tracker size. Fine for thousands of rows, not millions.
- One feed request scans at most 5000 events, so as not to hold up writes. The CLI and dashboard keep asking until they
  have a full page, so a rare filter on a very long log takes several requests.
- Every waiting agent re-evaluates on every write. With 40 agents hanging, a write takes about 290ms instead of 6ms.
- PRs are synced for repos with a GitHub name set. A PR reported by hand for any other repo is never refreshed.
- Octotrack cannot kill a session it did not start, unless the server is running a wake for it; Stop refuses its
  writes and tells it, and runs the developer's stop command if one is set. Stop ends a session's processes only while
  the local runner is set up; it ends a running wake whatever the setup.
- After a reboot, a session's process id may be reused; one that started more than two minutes after the session's
  spawn is taken as another process, which a reuse within those two minutes would defeat.
- Lists stop at their limit with no paging: the dashboard says so, and the CLI allows `--limit` up to 1000.
- A decision's `--recommend` may be free text, so a mistyped option key is shown as text rather than refused.
- PR status is only as fresh as the sync interval.
- No Worker entry yet; D3 keeps the seam, not the implementation.
