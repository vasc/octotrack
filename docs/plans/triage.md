# Plan: build Triage, the agreed redesign of the dashboard

## The problem

The dashboard puts everything on one page, Lines. Each working line holds what it needs from the developer in place,
and the bar's counts ("1 urgent", "3 to answer") jump to the next such item somewhere down that page. In review, the
developer said:

> lets design then implement a feed view for the N [action] buttons / right now pressing that jumps around semi
> randomly, it would be good to desing a feed that shows those actions in order, especially that when I press later it
> goes to the bottom of the feed

Ten different directions were drawn. The developer chose one:

> triage is the way, I think one thing that is missing is contextual information / if im in for you and I want to peek
> at the line, I should be able to click a link and see it without jumping to another screen / sheets is one thing that
> the current app does well, can also be dialogue, but yeah inspecing in place is importatn

After the peek screens were drawn they said "good, the moving left is a great choice", and then "lets implement this
redesign".

## What was drawn and agreed

The Triage page of the design canvas (https://claude.ai/artifact/JSt9awRkVko2hzaKCy5ayF), whose sources are copied
into `design/canvas/triage/`:

- **Main, T-Task, T-Accept, T-StepIn, T-OwnWords, T-Undo, T-Done:** For you. A rail on the left (All, Urgent, To
  answer, To do, To accept, To step in, each with its count). In the middle, one item open as a card, under a strip
  saying where you are ("To answer · 1 of 3"). On the right, Next: the following two items, then what comes after
  them. Later moves an item to the bottom. When nothing is left: "Nothing waits on you", who is working, where the
  next ask will likely come from, and what was cleared today.
- **T-Lines:** Lines as a numbered list in sections (Working on, Up next, Proposed to you, Tabled). Each working line
  says how it stands and how much waits on you ("5 for you", "Step in"), instead of holding the items.
- **T-Line:** a line as a page of its own: crumbs, title, headline, its actions, the plan, and beside it For you here,
  the summary and what happened recently.
- **T-NewLine, T-Table, T-Keys:** New line, Table and the keys as dialogs in the middle of the screen.
- **T-More:** the bar's More menu: Log, Agents, Appearance and Keyboard shortcuts.
- **T-Peek-Line, T-Peek-PR, T-Peek-Stack:** a ref clicked on For you opens in a sheet on the right. The rail and Next
  fold away and the card moves left, so the card and the sheet are both whole. A peek opened from a peek stacks, with
  the way back named.
- **T-Task-Phone, T-Line-Phone, T-NewLine-Phone, T-Peek-Phone, Triage-Phone:** the same on a phone, peeks as bottom
  sheets.

Earlier feedback this builds on, in the developer's words: "double height it too tall, its a no for me" (one bar,
one row); "agents and log are very unused, these can definitely be behind a click"; "we might consider one feed page
possibly filtered down to these items"; "lets do current one open other closed"; "I never want yo tell you about
mislignment".

## Decisions I made, with reasons

1. **`/` opens For you; Lines moves to `/lines`.** The developer chose Triage, whose point is working through what
   waits on them, so that is what opening Octotrack shows. Lines keeps its own address. _Trade-off:_ a bookmark of `/`
   that meant Lines now opens For you; the bar's first link is Lines, one click away.
2. **A filter is in the address: `/for-you/urgent`, `/for-you/to-answer`, and so on; the open item is `?item=D-4`.**
   So Back works, a notification can open an item (it already sends `?focus=`, which keeps working), and a reload keeps
   your place. The rail's links are real links.
3. **The order of For you is the order of lines, then what is on no line, with what was put off (Later) at the
   bottom, the last put off last.** That is the order the counts already use, and it answers "when I press later it
   goes to the bottom of the feed". All is urgent first, then each line's items in order, then proposals.
4. **The cards reuse today's item components** (the question form, the task form, the proposal choices, Step in, the
   done-when proposals) inside a new card frame. Their behaviour, drafts, keys and Undo are tested and right; what
   changes is the frame, the spacing and the type. _Trade-off:_ a card's inside keeps today's primitives, restyled where
   the drawing differs, rather than being drawn afresh.
5. **Peeks are today's panel (`?ref=`), redrawn as the sheet in the drawings**, with the stack drawn from the existing
   `from` (Esc already goes back to the ref a panel was opened from). The page under a sheet folds its rail and Next on
   For you, and the card moves left.
6. **A line's full page is `/lines/L-1`**, built from the parts the line's panel already uses (head, plan, summary,
   what is new, owner, Tell), laid out as T-Line. The peek of a line stays the short version, with "Open the full page".
7. **Look: the drawings' layout, type and spacing become tokens; colour stays each theme's own.** The card's title
   size, the lead sentence, the card's radius and shadow, the three columns and the gaps between them come from the
   drawings as new tokens. The drawings were made in a light Paper with a blue accent, but the design language already
   decided that a highlight is blue only in a theme whose own colour is blue (`bun test design` enforces it), and the
   developer uses eight themes in light and dark; so what the drawings colour blue takes each theme's accent, and what
   needs you takes its attention colour. The rule that screens compose primitives and never style themselves stays,
   so the new looks are new primitives (`Triage`, `Card`, `Queue`, `FilterRail`, `NextList`, `PeekLink`, `Cleared`)
   in `ui/`. _Trade-off:_ in Paper the selection is ink, not the drawings' blue; every theme reads as itself.
8. **I'm at leaves the bar.** It is not in the drawings, and the live install has never used it (no places, never
   set). The CLI's `place` and `at` stay. The "on the go" idea the developer described is not designed yet, so nothing
   replaces it now.
9. **Ship in slices, each one committed, pushed and installed when green:**
   1. The bar (Lines, For you with its total, New line, More) and the For you page with its rail, cards, Next, Later,
      the Done state and the keys.
   2. Peeks: the sheet redrawn, the page moving left, the stack with its way back.
   3. Lines as T-Lines.
   4. The line's own page.
   5. New line, Table and Keys as dialogs.
   6. Phone layouts throughout.

   Each slice leaves the product whole. _Trade-off:_ between slices, parts drawn in the old style sit beside parts in
   the new.
10. **Tests:** integration tests first for each slice's behaviour (what the rail counts, which item opens, Later,
    Undo, a peek opening and stacking), then presentational tests for each new pure component, then the code. Old tests
    for what changes are rewritten to the new design, never deleted to make things pass.

## After building: every item on the page

With For you live on the real tracker, the developer said: "this might need a bit more rethinking, I need all those 66
to show up in the page". Two layouts were drawn with their real proposals (T-List-A, one list with the open item in
place; T-List-B, the list beside the open card), and they chose "A: one list".

So For you is one list beside the rail: every entry the view holds, a row each, the one you are on opened in place
as the card. The Next column and the progress strip are gone, since the list shows what comes next and where you are
("22 of 64 open"). _My decision:_ a proposal's row carries its agent's recommended move when that move needs nothing
more (Start or Up next), so many proposals are placed without opening each; Table and Fold ask for a reason or a line,
so they stay in the open card.

## Done when

Every Triage screen is in the product and matches its drawing at desktop and phone widths, checked in the browser.
`bun run check` and the dashboard's own tests pass. `docs/DESIGN.md` and `design/` describe what was built. The audit
agent's findings are fixed. All of it is committed, pushed and installed.
