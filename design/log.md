# Design log

Decisions, newest first, and what is still open. All of these were made while building the product and can be
revisited. Nothing here is a settled requirement unless it quotes one.

## Open questions

The real starting points for iterating.

### There is no identity

The design is deliberately quiet, but it also has little point of view: system fonts, and colour that comes from the
theme the developer picks. That is a fine default and also what many tools look like. A distinctive monospace for refs might give it character
at no cost in speed.

### Is density right for long sessions?

Body text is 13px and metadata is 11px. Both pass contrast, but 11px is small for hours of reading. Try `--space-unit` and
`--text-md` one step up and see what is lost.

### Icons

There are few: plus, pin, keyboard, grip and chevron, inline beside words or alone in a control that names itself.
Status is words, and PR glyphs are characters. It keeps things fast and honest, but a row of words takes longer to scan
than a row of shapes, and `A`, `C` and `R` for review have to be learned.

### Log marks are color alone

The mark beside a log row carries tone with no shape. The sentence says the same thing, so nothing is lost, but scanning
the marks is harder with color blindness. Shapes would fix it.

### Keyboard reach

Keys drive home: items, lines, choices, Undo, I'm at and the urgent question. Elsewhere there is only `/` to search,
`?` and `Esc`. There is no way to move through log rows or the roster, open one, or go to another page from the
keyboard.

### States not on the specimen

Hover and focus can only be seen by hovering and tabbing. The specimen does not show them side by side.

## Decisions

### Taken with lines of work

The dashboard was rebuilt to the E · One list boards (docs/DESIGN.md, D13 and D14). These replaced several decisions
further down, each marked _Replaced_ there.

- **Three pages: Lines, Log and Agents.** The decisions, pull requests, drift, issues and repos pages went, and with
  them the rail. A question is answered on its line, a pull request shows on its issue, drift on what it is about.
- **One focus on home, a border in the accent with a quiet `k ↑ j ↓` beside it.** The word Focused, which the boards drew, was
  left out at the developer's word; the hint shows only with a mouse or trackpad, where there is room.
- **One press answers, and every choice waits with Undo.** A stray key costs nothing, so there is no confirm step.
  Reordering, I'm at and Record answers act at once.
- **One control height** (`--control-height`) for every desktop control, a few inline icons, and no ellipsis on a
  button that asks first.
- **A theme chooses every colour.** Eight themes, each with its own ground, accent, attention and statuses, mixed from
  seeds in `scripts/themes.ts` and checked for contrast. Attention moved off amber in Paper to a fuchsia that neither
  `--warn`'s yellow nor `--bad`'s red can be mistaken for, which settles the old question of whether amber was right.
- **What agents propose wears the theme's own colour.** Info is the accent, attention is blue only in a blue theme, each
  hued theme's dark ground is a deep shade of its hue, dark tints are mixed from a neutral grey so they keep their hue,
  and the phone fills the page you are on with the accent. Before, every theme showed a blue proposal edge and, on a
  phone in dark, looked like every other.
- **I'm at is a menu of places, never a select,** so no arrow key changes where you are.
- **The key list is the one modal,** so no key acts behind it. The Start sheet opens in place.
- **A lost connection is said quietly:** "Not live: reconnecting" under the bar until it returns.

### Taken when this folder was extracted from the implementation

These changed how the product looks, slightly. All of them are visible at `/design`.

- **Tokens became the source of truth.** The dashboard imports `tokens.css`, so the language cannot drift from the product.
- **`light-dark()` for every color.** One line per color instead of two blocks that can fall out of step. It also allows
  both themes on one page. It needs browsers from 2024 on, which is fine for a local tool.
- **`--ink-3` got darker in light mode and lighter in dark mode.** It carries all the 11px metadata, and failed AA at 3.5:1
  and 3.9:1. It now passes on every ground it is used on.
- **Spacing moved to a scale.** There were 15 ad-hoc values. Odd ones were rounded to the 2px grid: 3 and 5 to 4, 7 to 6,
  14 to 12, 18 to 16. Rows got slightly tighter.
- **A narrower type scale.** 10px was dropped, and those uses moved to 11px, since 10px is too small to be useful.
- **Weight 700 was dropped** in favor of 600, leaving three weights.
- **One tone concept.** Badges, marks and glyphs each had their own copy of the tone rules. Now `data-tone` sets variables
  that all of them read.
- **A designed focus ring.** Fields removed their outline and buttons had none of their own. Keyboard users are who this is
  built for, so `:focus-visible` now draws one everywhere.
- **Inline styles replaced with named classes,** apart from a progress bar's width, which is only known at run time.

### Taken while building

- **What became of an answer is visible.** Deciding is not the end of it, so the log says whether anyone picked it up and
  what they did. _Replaced:_ each line now says what became of its recent answers, with Change answer; the decisions page
  is gone.
- **An own answer is one of the choices.** The note field always accepted one, but only a placeholder said so. Options
  written by an agent do not always apply, so In my own words (`w`) sits with them, and the log quotes the words as the
  answer.
- **Postponing moves a decision down and nothing else.** It is called Later now, and moves a question to the bottom of
  its line. It stays open and counted, an agent waiting on it keeps waiting, and it stays down until someone brings it
  back or answers. A snooze timer was left out: it would be one more thing bringing decisions back at a moment nobody
  chose.
- **Postponing moves on without arming the next card,** the same rule as when a card goes away.
- **Touch follows the input, not the width.** `pointer: coarse` raises type, gives controls a 44px height and hides key
  hints, so a phone on its side still gets it.
- **The queue lists five closed decisions beside the feed.** With 25 open, the rows pushed the feed off the screen. The rest
  are one tap away on the decisions page, which lists them all. _Replaced:_ there is no queue or decisions page; questions
  wait on their lines.
- **Project links stay hidden on phones.** The strip would get too long, and the Projects page reaches them.
  _Replaced:_ the strip and the Projects page are gone; a repo is a `repo:` search on the Log.
- **The keys disarm when the open card goes away.** The next card opens, and `j` arms it. It costs a keypress when deciding
  several in a row, and it means a key meant for one decision cannot answer another. _Replaced:_ after a choice, focus
  moves to the line's next item, and while a choice waits with Undo its keys stand down.
- **The open card is always first.** Otherwise a re-rank moves it in the DOM, which takes focus away from the note being
  typed. _Replaced:_ there is no rank; live updates never move home's one focus.
- **One decision open at a time, on every page.** Three open cards pushed the feed off the screen. On home, only the
  focused item opens in full.
- **The open card does not follow the ranking.** A live re-rank could otherwise make a keypress decide the wrong thing.
  _Replaced:_ the developer's line order replaced the ranking.
- **Deciding is not optimistic.** A round trip takes milliseconds locally, and removing the card early would unmount the
  form that has to show a refusal.
- **Two steps to decide.** Pick, then confirm. A stray key cannot answer anything on its own. _Replaced:_ one press,
  with Undo.
- **No modals.** Everything is answered in place or in the inspector. The key list is now the one modal.
- **No animation.** Nothing should look slower than it is.
- **System fonts.** A web font is a wait.
- **Drift about state only offers "Nothing to update".** It clears by itself when fixed, so "Updated" could only be false.
- **`PrStrip` below 1180px.** PR status should not disappear because the window is narrower. _Replaced:_ the strip is
  gone; a pull request's status shows on its issue and in its line's plan.
- **No component library.** The product needs a small vocabulary, and a library brings a large one with its own look.
