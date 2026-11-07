# Patterns

How components combine, and why.

## The frame

Three columns: navigation, the page, and a rail. The middle is what you are working on. The rail is what should stay
in view whatever that is. It shows PR status, waiting agents and drift, and becomes the inspector when you open something.

Below 1180px the rail goes away, the inspector slides over the page, and `PrStrip` keeps PR status in view. Below 720px
there is one column.

## The feed page

From top to bottom, in order of how much it needs you:

1. **Filter.** Always on top, always the same language.
2. **Views.** Saved filters.
3. **Needs you.** One decision open, the rest one line each. It follows the filter, so filtering to a project narrows
   the queue too.
4. **The feed.** Newest first, one line each, in sentences.

Keeping one card open is what keeps the feed on screen. Three open cards fill a laptop.

## Deciding

| Step                         | Mouse          | Keyboard        |
| ---------------------------- | -------------- | --------------- |
| Move to a decision           | Click its line | `j` `k`         |
| Pick an option               | Click it       | `1`-`9`         |
| Say why, optional            | Type           | Focus the field |
| Say it was decided elsewhere | Tick the box   | Focus it        |
| Confirm                      | `Decide`       | `Enter`         |

It always takes two steps, which is the protection against a stray key. A number alone does nothing irreversible.

The card that is open stays open, and stays first, until it is answered, whatever the ranking does around it. Staying
first is what keeps a re-rank from moving the field being typed in. Moving away keeps what you typed, and not being
optimistic means a refusal can show on the card itself.

The keys answer one decision at a time. With the inspector open on a decision, they answer that one, and the queue stands
down. When the open card goes away, because it was answered or an agent withdrew it, the next one opens but the keys do
nothing until you press `j`. A key pressed for one decision must never land on another.

## Ranking, and showing the reason

The queue is ordered by a score, but what you see is the reasons: "2 agents waiting", "blocks 3 open items". A ranking
you cannot question is one you cannot trust.

## Filtering

Text you type is the source of truth, and everything else writes to it. Clicking a chip adds a term, and a saved view
is a named query. A half-typed or invalid query shows why under the box while the previous results stay up. The filter
lives in the URL.

## The inspector

Anything with a ref can open here, from anywhere, and it does not lose your place in the page behind it. `Esc` closes
it. From top to bottom: what it is, what to do about it, what is out of date, what it connects to, then its history.

## Answering in place

Decisions, drift, issue status, ideas and posting an update can all be done where you see them. A status changes through
a select in the row. Nothing needs a separate form or a modal. There are no modals in this product.

## Live updates

The page never asks you to refresh, and never moves what you are on. New items appear in the feed, counts change, and a
decision that someone else answered leaves the queue. The `live` dot in the sidebar turns to `offline` if the connection
drops, and everything catches up when it returns.

## Loading, empty, error

| State                                | Rule                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Loading a new page                   | Nothing, for the few milliseconds it takes                              |
| Loading while something is on screen | Keep what is on screen                                                  |
| Loading that really takes a while    | `LoadingState`, saying what it is doing                                 |
| Empty, first use                     | Say how to fill it, with the command                                    |
| Empty, because of a filter           | Say that it is the filter                                               |
| Failed                               | `ErrorState`, with the server's own words. Keep what was already loaded |
| Stale                                | Say so where the stale thing is shown, as `SyncFailures` does           |

## Color in a screen

Most of a screen should be ink on ground. Marks and badges carry status in small doses. Amber is reserved for what needs
you. If a screen looks colorful, something is overusing tones.
