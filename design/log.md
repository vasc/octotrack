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

## Decisions

### Taken when every screen was drawn

The developer asked to "design every screen and every widget, every error state and every empty state", and to
"Always view the canvas rendering". Every component's states were first inventoried from the code
([inventory/](inventory/)), then each screen was drawn on the canvas ([canvas/](canvas/)) and looked at rendered. These
are design decisions taken there, open to change:

- **Draw first, build after.** A screen is drawn and agreed on the canvas before its code changes, and the code then
  matches the drawing. The earlier screens were composed in code, which is how cards inside cards and then a page with no
  separation between text and controls each shipped.
- **Every opened item has three zones, in this order:** what it is (read), what you do (act), other ways out. A hairline
  and space separate reading from acting. A choice's number sits on its label's baseline, at the label's size, and the
  reason for a recommendation lives inside the recommended option.
- **One column in panels.** A panel reads top to bottom in order of importance; a section with nothing in it says why in
  one sentence instead of a bare heading or an empty column.
- **One focus treatment:** a 1 px mid-grey edge (`--ink-3`, each theme's own) with a 3 px soft halo, outside a control, and the edge
  alone inside a row; on the dark primary button the edge sits 2 px off it. The developer found the first drawing's
  2 px ink ring "too strong", so it was softened; the edge still has 4.5:1 contrast on white, so it passes for
  keyboard users. A chosen answer is a quiet grey edge, a faint fill and its [check], not a heavy border. One selected
  treatment: the accent-soft fill. Pressed darkens a step. Disabled is one pale grey look for every kind of
  button, never only faded. Nothing gets a coloured side bar.
- **A failure is said where it happened,** with what to do and Try again, and the tracker's own hint when it sends one.
  Raw error text never reaches the page. Data that could not refresh stays, marked with the time it is from.
- **Illustrative content is labelled.** Where no real data exists for a state, the drawing says so on the board.
- **No button carries a key hint.** "Close esc", "Undo u" and "Later l" were drawn on some buttons and not others,
  and the developer found "Close esc" "a strange way of specifying the short cut, no other buttons have it". Keys are
  listed once, in the Keys sheet (`?`), and a choice's number is its own key.
- **A lone fact is a label over its sentence.** "Done when" was a one-row two-column table whose gutter the developer
  called "weird"; a single fact is a small grey label stacked over its sentence, and only several facts together
  (Waits for, Look again, Held) form a table.
- **No captions narrate the screen.** "Your order: what reaches you first, and what agents take on" and its kind were
  removed after the developer called it "screen naration", in keeping with "The UI does not explain itself" below.
  The crumb no longer says a line's position ("3rd of 10"): the developer asked "3rd out of 10 what", and the
  number on its home row already says it.
- **The accent is for what you answer or do,** questions and tasks. Proposed is a heading like the others, and a
  proposal's advice reads "Recommends Start:" in ink.
- **Red is for what broke.** A merge conflict is ordinary work: it is a fact row with the warm mark, after the
  developer found the red box "way too strong for a merge conflict".
- **Disabled is one look for every kind of button.** The developer: "I think disabled buttons are good, they just
  should look disabled", and "a main button and a secondary button do not need separate disabled states". A disabled
  primary had been drawn darker than a disabled plain one, so it read as another design; now primary, plain, quiet and
  icon all disable to the same pale fill, faint edge and grey text.
- **Reordering shows itself.** Every row that can move carries a six-dot grip beside its number, always drawn: the
  developer found "there is no discoverability on reordeing" once only the number and a grab cursor were left.
- **A choice the tracker never took is said in the Undo bar,** "Did not happen: {what}. {why}" with Dismiss, the
  same place a choice refused when it takes effect is said; before, most were silent and the rest showed at the top
  of the page. A move that fails is the exception the drawing makes: said under the line that moved.
- **Loading is drawn, not said.** Outlines of the rows show something loads; the words are for screen readers only.

These answer the open question "States not on the specimen": hover, focus, pressed, disabled and busy are drawn side by
side on the Primitives board.

### Taken with lines of work

The dashboard was rebuilt to the E · One list boards (docs/DESIGN.md, D13 and D14). These replaced several decisions
further down, each marked _Replaced_ there.

- **Three pages: Lines, Log and Agents.** The decisions, pull requests, drift, issues and repos pages went, and with
  them the rail. A question is answered on its line, a pull request shows on its issue, drift on what it is about.
- **One focus on home, a border in the accent with a quiet `k [up] j [down]` beside it.** The word Focused, which the boards drew, was
  left out at the developer's word; the hint shows only with a mouse or trackpad, where there is room.
- **One press answers, and every choice waits with Undo.** A stray key costs nothing, so there is no confirm step.
  Reordering, I'm at and Record answers act at once.
- **One control height** (`--control-height`) for every desktop control, a few inline icons, and no ellipsis on a
  button that asks first.
- **A theme chooses every colour, each picked by hand.** The generated themes were dropped. Paper became monochrome,
  its accent the ink, after the developer said its blue pill belonged in 2008. Six themes are editor palettes people
  already love (Solarized, Gruvbox, Catppuccin, Rosé Pine, Nord, Everforest), with High contrast. Each value was chosen
  looking at the dashboard; contrast tests are the floor. What agents propose wears the accent; attention is blue only
  in a blue theme.
- **The phone fills the page you are on with the accent,** as a wide screen does.
- **Sheets, not cards; warm words, not red.** The look follows direction B, Instrument (`design/directions/`): one sheet
  per section with hairline rows, nothing boxed inside a line, focus as a tint, small corners, no side bars, red only for
  real errors.
- **A phone's bar names no page, and a tap in Safari reaches its menu item.** The tab says where you are; the bar is one
  row of what waits beside a plus and the theme; the tab bar sits on the browser's own bar. Menus close on focus moving
  out or a tap elsewhere, not on a blur to nowhere, which is what Safari does under every tap.
- **I'm at is a menu of places, never a select,** so no arrow key changes where you are.
- **The key list is the one modal,** so no key acts behind it. The Start sheet opens in place.
- **A lost connection is said in a strip under the bar:** "Not live. Showing what was true at 14:20; reconnecting. Answers you give wait until it is back." with Try now, until it returns.

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
- **No modals.** Everything is answered in place or in the inspector. _Replaced:_ a task of its own (New line, Table,
  Start, Record answers, the keys) is a sheet over the whole page and its bar, so the page's actions never seem to
  apply to it; a short answer that belongs to an item stays in place under it.
- **No animation.** Nothing should look slower than it is.
- **System fonts.** A web font is a wait.
- **Drift about state only offers "Nothing to update".** It clears by itself when fixed, so "Updated" could only be false.
- **`PrStrip` below 1180px.** PR status should not disappear because the window is narrower. _Replaced:_ the strip is
  gone; a pull request's status shows on its issue and in its line's plan.
- **No component library.** The product needs a small vocabulary, and a library brings a large one with its own look.
- **Screens are made only of primitives.** The dashboard had grown a 2,800-line stylesheet and a hand-rolled button on
  every screen, so no two looked alike. Now every look belongs to a primitive in `components/ui` (Row, List, Section,
  Sheet, Button and the rest, styled in `ui.css`), screens only compose them, and a test fails on a screen that gives
  an element a class or a style. A change to how something looks is a change to one primitive, everywhere at once.
- **The UI does not explain itself.** Sentences telling the developer how the product works (what tabling does, how
  owners are found, what a box accepts) are gone from the screens; the docs and `octo guide` say it once. What stays
  are names, facts and actions.
- **For you, one at a time (D16).** What waits on the developer is its own page, one entry open on a card, the views
  on a rail, what comes next beside it; the bar's counts are gone. A line named on the card peeks in place, and the
  page folds its rail and Next so the card and the peek are both whole. Drawn as Triage, in `canvas/triage/`.
