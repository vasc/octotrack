# Design log

Decisions, newest first, and what is still open. All of these were made while building the product and can be
revisited. Nothing here is a settled requirement unless it quotes one.

## Open questions

The real starting points for iterating.

### Is amber right?

Amber was picked because it reads as "needs attention" without reading as "broken". It is close to `--warn`, the yellow
used for pending and review-requested. Side by side they are easy to confuse, especially in light mode, and that weakens
[principle 1](principles.md#1-attention-is-the-scarce-thing-and-it-has-one-color). Options: move attention to a color no
status uses, or make `--warn` more neutral.

### There is no identity

The design is deliberately quiet, but it also has no point of view: system fonts, a neutral stone palette. That is a fine
default and also what many tools look like. A distinctive monospace for refs, or a sharper accent, might give it character
at no cost in speed.

### Is density right for long sessions?

Body text is 13px and metadata is 11px. Both pass contrast, but 11px is small for hours of reading. Try `--space-unit` and
`--text-md` one step up and see what is lost.

### Should the rail hold something other than PRs first?

It shows PR status, then waiting agents, then drift. An agent hanging right now is arguably more urgent than PR status, and
is the least visible of the three.

### Icons

There are none. Status is words, and PR glyphs are characters. It keeps things fast and honest, but a row of words takes
longer to scan than a row of shapes, and `A`, `C` and `R` for review have to be learned.

### Feed marks are color alone

The mark beside a feed row carries tone with no shape. The sentence says the same thing, so nothing is lost, but scanning
the marks is harder with color blindness. Shapes would fix it.

### Keyboard reach

Keys drive the decision queue, but not the feed, the rail or other pages. There is no way to move through feed rows, open
one, or go to another page from the keyboard.

### What does a project look like at a glance?

`ProjectCardView` is a list of counts. Whether a project is healthy has to be worked out by reading them.

### States not on the specimen

Hover and focus can only be seen by hovering and tabbing. The specimen does not show them side by side.

## Decisions

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

- **One decision open at a time.** Three open cards pushed the feed off the screen.
- **The open card does not follow the ranking.** A live re-rank could otherwise make a keypress decide the wrong thing.
- **Deciding is not optimistic.** A round trip takes milliseconds locally, and removing the card early would unmount the
  form that has to show a refusal.
- **Two steps to decide.** Pick, then confirm. A stray key cannot answer anything on its own.
- **No modals.** Everything is answered in place or in the inspector.
- **No animation.** Nothing should look slower than it is.
- **System fonts.** A web font is a wait.
- **Drift about state only offers "Nothing to update".** It clears by itself when fixed, so "Updated" could only be false.
- **`PrStrip` below 1180px.** PR status should not disappear because the window is narrower.
- **No component library.** The product needs a small vocabulary, and a library brings a large one with its own look.
