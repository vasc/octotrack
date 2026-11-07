# Principles

These come from what Octotrack is for. The brief behind them, quoted from the request that started the project:

> "the point of the dashbaord is to place the most important decisions in front of the developer, for unblocking
> developemnt"

> "the primary interface should be a feed of status and decisions fully filterable"

> "status of prs should be easily visible"

> "ui must be very fast, no slow loading"

The principles below are how that was interpreted while building it. They are design decisions, open to change. When
two pull against each other, the earlier one wins.

## 1. Attention is the scarce thing, and it has one color

One person reads what many agents write. The design's job is to make clear what needs that person, and the rest can
recede. So amber means exactly one thing: this needs you. A new decision, an open card, a count in the sidebar. It is
never decoration, never a brand color and never just emphasis, because the first time it means something else it stops
working.

_In practice:_ a screen with nothing waiting should have almost no color at all.

## 2. Decide here

A decision should take seconds, and should not take a trip anywhere. The question, the context, the options, the
recommendation and why it ranks where it does are all on the card, and so is the answer.

_In practice:_ no separate decision page is needed to decide. `1`, `Enter`, done.

## 3. What is under your hands stays put

Agents change things constantly, and the page updates live. That must never move what you are reading or typing. A
re-rank does not swap your open card, and half-typed text survives moving away and back. A keypress should land where
you aimed it, because here it can unblock an agent on the wrong answer.

_In practice:_ new things appear around what you are doing, not instead of it.

## 4. Fast is a feature, so nothing waits

No web fonts, no animation, no spinners between pages. System fonts are on screen at once. Previous results stay up
while new ones load, so a filter never flashes empty. A loading state exists, but it should almost never be seen.

_In practice:_ if a change adds a visible wait, that is a reason not to make it.

## 5. Dense, because the reader is expert

This is a tool for someone who is in it all day. It shows more per screen than a typical app, with small type, tight
rows, and hierarchy from weight and position more than from size or space. Density is not clutter: the feed is quiet
so that it can be long.

_In practice:_ prefer one line over a card, and a card over a page.

## 6. The keyboard goes first, and everything can also be clicked

`/` filter, `j` `k` move, `1`-`9` pick, `Enter` decide, `Esc` close. Every one of these also has a visible control, so
that nothing is only reachable by knowing the shortcut.

## 7. State is never only a color

Failing is red, and it also says "failing" or shows a ✕. Everything must survive color blindness, a bad monitor and a
screen reader. The one exception is the mark beside a feed row, whose sentence says the same thing in words.

## 8. Say what is true, and what to do about it

An empty page says how to fill it, with the command. An error says what happened and, where it can, what to do next.
PR status that has stopped updating says so instead of looking current. See [voice.md](voice.md).

## 9. The same words and the same grammar everywhere

The CLI and the dashboard are two views of one thing. `D-3` is `D-3` everywhere and is clickable wherever it appears.
What you type in the filter box is what an agent types in `octo watch`.
