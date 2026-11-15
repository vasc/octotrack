# Patterns

How components combine, and why.

## The frame

One bar on top: Octotrack, Lines, Log and Agents; what waits on you, as one quiet group of counts with urgent apart in
red; I'm at, New line and the keys. Under it, the page. Any ref opens as a panel over the right of the page, so the
page keeps its place behind it. Below 720px the pages become tabs at the bottom and the counts four cells across.

## Home: one list of lines

Home, at `/`, is every line of work in the developer's order: working on, up next, proposed, then tabled and done lately
folded to one row each. A working line shows who is on it, its plan step and its headline, then the first thing
waiting on the developer; the rest are one row away (`+2 more for you`). Only the focused item opens in full: a
question as its card, a task with Done and Can't do it. Focus starts on an urgent question, else on the first thing
waiting, and moves when a row is opened. A working line no agent could be found for shows Step in, in red, on its own
line, so the line is read once. Placing a line, tabling it, finishing it and owning it happen from its panel, which
opens in place from its title. The order changes from each line's handle: drag it, or open it for its moves.

## Answering

| Step                     | Mouse                      | Keyboard                     |
| ------------------------ | -------------------------- | ---------------------------- |
| Move to a question       | Click its row              | `j` `k`                      |
| Answer                   | Click an option            | `1`-`9`                      |
| Answer in your own words | In my own words, then Send | `w`, type, Cmd or Ctrl Enter |
| Put it off               | Later                      | `l`                          |
| Take it back             | Undo, in the bar           | `u`                          |

One press answers, and every answer waits a few seconds with Undo, which is the protection against a stray key: it costs
nothing. While it waits, its keys stand down, so a second press sends nothing. Only the focused item takes the keys,
and focus moves only when the developer moves it or its item goes; a question arriving, even an urgent one, never
takes it. With a ref open in the panel, the panel takes the keys and home stands down.

## Ordering, and showing the reason

The developer's order is everyone's order, and there is no score: questions follow their line, then the plan step they
hold up, and Later moves one to the bottom of its line. What a line needs from you says why where it stands: "holds up
the build", "waiting on you".

## Filtering

The Log shows what has not been seen, line by line in the developer's order, and Mark all seen, which waits with Undo,
empties it. A search goes through the whole log instead. Text you type is the source of truth: clicking a chip adds a
term, a half-typed or invalid query shows why under the box while the previous results stay up, and the search lives in
the URL.

## The panel

Anything with a ref opens here, from anywhere, and the page behind keeps its place. `Esc` closes it. A line shows where
it stands and how to move it, its summary, what it needs from you, its plan beside what is new, who owns it, and Tell.
A task shows what to send back; an issue its pull requests and what happened lately.

## Answering in place

Questions, tasks, proposals, Step in and drift are all answered where you see them. State changes are buttons, never a
select an arrow key could change, and I'm at is a menu of places for the same reason. Nothing needs a separate form;
the Start sheet opens in place, and the key list is the one modal, so that no key acts behind it.

## Live updates

The page never asks you to refresh, and never moves what you are on. New items appear on their lines, counts change, and
a question someone else answered leaves. Drafts follow between devices, but a box with focus keeps what it shows.
While the connection is lost, a quiet line under the bar says "Not live: reconnecting", and everything catches up when
it returns.

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
