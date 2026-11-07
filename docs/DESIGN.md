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

### D11. PR status comes from `gh`

`octo pr sync` and a background loop in the local server shell out to `gh`, reuse the developer's existing login and
push results through the `pr.sync` operation. References like `OCT-12` in a PR's title, branch or body become
`implements` links automatically.

- **Trade-off:** polling (default 60 seconds) rather than webhooks, since there is no public endpoint on a laptop.
  `pr.upsert` remains available for anything else that wants to report.
- **Bounded requests:** up to 50 open, 20 merged and 10 closed PRs, as separate calls. Asking for 100 PRs with their
  check rollups got a 504 from GitHub on a busy repo. A tracked open PR missing from those lists is looked up on its
  own, so that one merged while the laptop slept does not stay open forever. A repo with more than 50 open PRs only
  shows the 50 most recent.
- **Noise on busy repos:** `pr-without-issue` and friends flag every matching PR, which suits repos where agents open
  the PRs. On a large shared repo that is a lot of drift. Rules cannot be switched off per project yet.

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
- Lists stop at their limit with no paging: the dashboard says so, and the CLI allows `--limit` up to 1000.
- A decision's `--recommend` may be free text, so a mistyped option key is shown as text rather than refused.
- PR status is only as fresh as the sync interval.
- No Worker entry yet; D3 keeps the seam, not the implementation.
