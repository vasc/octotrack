# Voice

How Octotrack words things. It is talking to a senior developer who is busy, and to AI agents that take it literally.

## Plain and specific

Say what happened, using the real names.

| Write                                                  | Not                      |
| ------------------------------------------------------ | ------------------------ |
| `D-3 has no option "sqs"`                              | `Invalid selection`      |
| `OCT-4 is done but PR-2 is still open`                 | `Inconsistency detected` |
| `PR status is stale for acme/app: gh is not logged in` | `Sync error`             |

## An error says what to do next

Where there is a next step, name it, and as a command if it is one.

```text
error: PR-3 cannot be marked updated: it is still true that PR-3 has failing checks
Fix it and this clears by itself, or use --verified if it is correct as it is.
```

## An empty state fills itself

Say why it is empty, and how to change that.

| Situation                | Text                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| No projects yet          | `No projects yet.`, then `octo project create OCT Octotrack --repo owner/name` |
| A filter matched nothing | `Nothing matches this filter.`                                                 |
| Everything is fine       | `Nothing is out of date.`                                                      |

Good news can be stated flatly. There is no need to celebrate it.

## Sentences in the feed

A feed entry is a sentence with the ref first, so that the eye can run down the left edge.

```text
D-3 decided: "Redis" on "Which queue?"
PR-7 (acme/app#12) merged: Add retry
OCT-4 moved to done: Add a queue
```

## Words we use

| Use                              | For                                     | Not                        |
| -------------------------------- | --------------------------------------- | -------------------------- |
| Decision                         | Something only the developer can answer | Ticket, request            |
| Drift                            | A record that may be out of date        | Staleness, sync issue      |
| Needs you                        | The queue of decisions                  | Inbox, action items        |
| Agent                            | An AI working through the CLI           | Bot, worker                |
| Waiting                          | An agent hanging on something right now | Blocked, which is for work |
| Blocked                          | Work that cannot move yet               | Stuck                      |
| Out of band, "decided elsewhere" | Decided outside the tracker             | External, offline          |

## Mechanics

- Sentence case everywhere, including buttons and headings.
- Buttons are verbs, or say the state you are declaring: `Decide`, `Promote`, `Updated`, `Nothing to update`.
- No exclamation marks, no "please", no "oops", no emoji.
- No "successfully". If it worked, the page shows it.
- Refs and commands are always written exactly as they are typed.
- Time is short and relative when near: `now`, `5m`, `3h`, `2d`, then a date.
- Counts come first and agree in number: `1 agent waiting`, `2 agents waiting`.

## For the CLI

The same rules apply. Agents read this text and act on it, so it must be exact and say what to run next. `octo guide` is
written in this voice. Output is JSON when piped, and an error always has a code, a message and, where possible, a hint.
