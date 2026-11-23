# Patterns

How components combine, and why.

## The frame

One bar on top: the mark and the name Octotrack, which opens For you; Lines; For you with how much waits on you;
New line; and More, which holds the Log, Agents, Appearance and the keys. Under it, the page. Any ref opens in a peek
over the right of the page (from the bottom on a phone), so the page keeps its place behind it.

Lines and For you are the app; the Log and Agents are places to look now and then, so they wait in More rather than
standing as tabs of equal weight. A phone keeps the same bar, Lines and For you with New line and More.

A menu or a list of suggestions closes when focus moves out of it or on a tap elsewhere, never on a blur that moves
focus nowhere: Safari gives a tapped button no focus, so that blur comes under every tap on an item.

A tab left open picks up a deploy by itself when it comes back into view, unless a box has focus, so a phone never keeps
running yesterday's code.

## For you and Lines

For you, at `/`, is everything that waits on the developer as one list: questions, tasks, proposed lines and lines to
step in on. The item you are on is open in place, as a card among the rows; the rest are one row each, numbered, and a
press opens one. Views down the side narrow the list (Urgent, To answer, To do, To accept, To step in); on a phone they
are one menu. Later sends an item to the bottom.

Lines, at `/lines`, is every line of work in the developer's order: working on, up next, proposed, then tabled and done
lately folded to one row each. A working line shows who is on it, how far along its plan is and its headline, and how
much waits on you there, which leads to For you. A working line no agent could be found for shows Step in, in the warm
tone. A line opens on its own page, where it is placed, tabled, finished and owned, and where its plan is changed. The
order changes from each line's handle: drag it, or open it for its moves.

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
takes it. With a ref open in a peek, the peek takes the keys and the page stands down.

## Ordering, and showing the reason

The developer's order is everyone's order, and there is no score: questions follow their line, then the plan step they
hold up, and Later moves one to the bottom of its line. What a line needs from you says why where it stands: "holds up
the build", "waiting on you".

## Filtering

The Log shows what has not been seen, line by line in the developer's order, and Mark all seen, which waits with Undo,
empties it. A search goes through the whole log instead. Text you type is the source of truth: clicking a chip adds a
term, a half-typed or invalid query shows why under the box while the previous results stay up, and the search lives in
the URL.

## The peek

Anything with a ref opens here, from anywhere, and the page behind keeps its place. `Esc` closes it, and "Open the full
page" leads to the rest. A line shows itself in short: who is on it, what finishes it, what else is for you there, its
pull requests, what happened, and Tell at its foot. A task shows what to send back; an issue its pull requests and what
happened lately.

## Answering in place

Questions, tasks, proposals, Step in and drift are all answered where you see them. State changes are buttons or a step's mark, never a
select an arrow key could change. Nothing needs a separate form;
the Start sheet opens in place, and the key list is the one modal, so that no key acts behind it.

## Live updates

The page never asks you to refresh, and never moves what you are on. New items appear on their lines, counts change, and
a question someone else answered leaves. Drafts follow between devices, but a box with focus keeps what it shows.
While the connection is lost, a strip under the bar says "Not live. Showing what was true at 14:20; reconnecting.",
with Try now, and everything catches up when
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

Most of a screen should be ink on ground. Marks and badges carry status in small doses. Attention is reserved for what needs
you, and the accent for what you are acting on. If a screen looks colorful, something is overusing tones.

Nothing urges with red. Red is for real errors: a bad query, a failed save, failing checks, a refused write. What is
urgent, has no owner or is stuck reads in the warm tone, as words and a small dot, never a red pill, fill or edge.

## Sheets, not cards

Each section is one sheet, its lines rows divided by hairlines. Nothing inside a line is a box of its own: a task, a
question, Step in or a proposal sits on its line as text and buttons. Focus is a band of quiet tint across the sheet, edge to edge,
on the row or item the keys act on; in the panel, where the opened item is the only one, it needs none. Corners are small, 4 to 8px, and no coloured bar runs down the side of anything.

A list of waiting items reads as rows: what it is in small grey words after a dot, the title at reading weight, the
case for it in a quiet line, a chevron to open it. Opening one keeps it in its section, aligned with the rows around it,
its options a plain list rather than boxes. Buttons speak at the size of the text around them.

An item's choices are one light row: the way forward filled, the rest words that act, never a grid of bordered
buttons. The numbers a key would press show beside them only where there is a keyboard and a pointer.

## A task of its own is a sheet

New line, tabling, starting a line that waited, Record answers and the keys each open a `Sheet` over the whole page and
its bar, so nothing behind it seems to apply: from the bottom on a phone, a panel in the middle on a wide screen, its
title and Cancel at the top and its one way forward at the foot. A short form that belongs to an item, such as an answer
in your own words or a checkout path, stays in place under it.
