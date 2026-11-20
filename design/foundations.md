# Foundations

What each token in [tokens.css](tokens.css) means. The values live there, so they are not repeated here. See them on
real components at `/design`.

## Color

Each color is `light-dark(light, dark)`, so one line covers both modes. The mode follows the operating system unless the
developer picks light or dark (`data-mode` on the page). `[data-theme]` forces one on part of a page, which is how the
specimen shows both.

### Themes

There are eight themes, each in light and dark. Paper (the tokens below) is our own quiet neutral, monochrome: its
accent is the ink itself, so the page you are on is a near-black pill and only what needs you has a colour. Six are
well-loved editor palettes, kept close to how their authors drew them: Solarized (blue, magenta for what needs you),
Gruvbox (its faded blue on cream and charcoal, purple), Catppuccin (Latte and Mocha, mauve, peach), Rosé Pine (Dawn
and the main palette, pine, iris), Nord (snow storm and polar night, frost, aurora purple) and Everforest (parchment
and green-grey, its green, purple). High contrast is for sun or low vision.

A theme chooses every colour, and every one is picked by hand, looking at the dashboard in that theme: the ground and
its lines, the inks, the accent and its tint, attention and its tint and edge, the statuses and theirs, and info, which
is the accent, so what agents propose wears the theme's own colour. Nothing is mixed or generated. Each palette's own
named shades come first; a colour is darkened by hand only where it has to read as text on a light ground. What a
colour means never changes with the theme: attention is the one colour for what needs you, good is a green and bad a
red. `bun test design` checks every pairing in every theme and both modes, that each theme defines every colour, that
no two themes share an accent or attention, that info is the accent, that a tint keeps its colour's hue, and that a
highlight is blue only in a theme whose own colour is blue. Passing those is the floor; a change to a theme is looked
at on the dashboard, light and dark, desktop and phone, before it ships.

A palette set on any element applies inside it, which is how the Appearance menu previews each theme: a swatch shows
the theme's ground with its accent and attention side by side. The developer picks a theme and a mode in that menu;
this device keeps the choice, `index.html` applies it before the first paint, the theme's ground covers the whole page
(it is set on `:root`, not only on the body), and the phone's browser bar takes the same ground.

### Ground

From furthest back to nearest. Separation comes from lines and these small steps, not from shadows.

| Token           | Use for                                                           |
| --------------- | ----------------------------------------------------------------- |
| `--bg`          | The page                                                          |
| `--surface`     | Things that sit on the page: line cards, the bar, panels, inputs  |
| `--surface-2`   | Things inside those, and the quiet tiles: Tabled, Done lately     |
| `--line`        | Card edges, and dividers between sections                         |
| `--line-faint`  | Dividers between rows inside one card: the rows of Up next        |
| `--line-strong` | Edges that have to be noticed: buttons, an option not recommended |

### Ink

| Token     | Use for                                      |
| --------- | -------------------------------------------- |
| `--ink`   | What is being read: titles, summaries        |
| `--ink-2` | Supporting text: context, descriptions, refs |
| `--ink-3` | Metadata: who, when, counts, hints           |

### Accent

The theme's own colour, for what the developer is acting on. It never says that something needs them: that is
attention.

| Token           | Use for                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `--accent`      | The primary button, the page you are on, links, the chosen item in a menu, and the soft fill of a selected item; focus is the grey edge |
| `--accent-soft` | Behind an item under the pointer in a menu, a pressed tab, selected text                                                                |
| `--on-accent`   | Text on a filled accent: the primary button, the page you are on                                                                        |

### Attention

Means "this needs you". See [principle 1](principles.md#1-attention-is-the-scarce-thing-and-it-has-one-color).

| Token              | Use for                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `--attention`      | Text; the edge of the recommended option                                                  |
| `--attention-soft` | Behind attention text, and the recommended option                                         |
| `--attention-line` | The edge of a question or task as a row. Decorative only: it does not reach text contrast |

### Status

Each has a strong and a soft version: the strong one for text and marks, and the soft one behind that text.

| Tokens                  | Means                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `--good`, `--good-soft` | Finished or fine: merged, passing, decided, done                                           |
| `--bad`, `--bad-soft`   | Broken, and someone has to act: failing, Step in, no owner                                 |
| `--warn`, `--warn-soft` | Not finished yet, or worth a look: pending, review requested                               |
| `--info`, `--info-soft` | What agents propose and wait for your yes on; in progress. The accent's hue in every theme |

### Tones

A tone is how a component takes on a meaning. Setting `data-tone="bad"` on an element gives it `--tone`, `--tone-soft`
and `--tone-mark`, and badges, glyphs and feed marks all read those. Add a tone in one place and all of them get it.
`toneOf` in `packages/web/src/lib/format.ts` says which status gets which tone.

## Type

| Token               | Size is for                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `--font`            | Everything: Inter where it is installed, else the system's own face, so nothing waits on a download |
| `--mono`            | Refs, repos, commands: anything that could be typed                                                 |
| `--text-xs`         | Small capitals labels (QUESTION, STEP IN), badges                                                   |
| `--text-sm`         | A line's facts, notes under a section, buttons in a row                                             |
| `--text-md`         | Body. Nearly everything                                                                             |
| `--text-lg`         | Running text in a summary or an outcome form                                                        |
| `--text-heading`    | Working on, and a page's own title                                                                  |
| `--weight-regular`  | Body                                                                                                |
| `--weight-medium`   | Navigation, counts beside a heading                                                                 |
| `--weight-semibold` | Titles, the counts in the bar                                                                       |
| `--leading-body`    | Running text                                                                                        |
| `--leading-tight`   | Titles that may wrap                                                                                |

Hierarchy comes from weight and color first, then size. The scale follows the E · One list boards: 12 to 20.

## Space

| Token          | Size is for                                              |
| -------------- | -------------------------------------------------------- |
| `--space-unit` | The base unit. Changing it scales everything below       |
| `--space-1`    | Hairline gaps                                            |
| `--space-2`    | Inside compact things, and between a label and its value |
| `--space-3`    | Between closely related things: buttons in a row         |
| `--space-4`    | The default gap: between lines, between items            |
| `--space-5`    | Between the parts of a card, and in a Step in box        |
| `--space-6`    | Padding of a question; between sections inside a panel   |
| `--space-7`    | A line card's padding, vertically                        |
| `--space-8`    | Padding of a question, horizontally                      |
| `--space-10`   | A phone page's margins                                   |
| `--space-11`   | A number's column; the page's top margin                 |
| `--space-12`   | Between sections of home                                 |
| `--space-14`   | Padding around an empty state                            |
| `--space-16`   | The page's side margins                                  |
| `--space-32`   | The room left at the end of a scroll                     |

The names are multiples of the unit: `--space-4` is four units.

## Shape

| Token            | Use for                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `--radius-none`  | A row reaching its sheet's edges, its tint square                                                       |
| `--radius-sm`    | Small marks, progress bars, badges                                                                      |
| `--radius-md`    | Buttons, inputs, options, repo chips                                                                    |
| `--radius-lg`    | Questions, tasks and rows under a line                                                                  |
| `--radius-xl`    | Line cards, the Up next card, proposals                                                                 |
| `--radius-pill`  | Pills: the header counts, a group read as one thing                                                     |
| `--radius-inner` | A sheet's corner inside its 1px edge: the first and last rows take it, so a highlight follows the curve |

## Elevation

Only what floats over content gets a shadow. Everything else is separated by a line.

| Token                  | Use for                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `--shadow-popover`     | The filter's suggestions, the Undo bar                                              |
| `--shadow-panel`       | A line, task or issue opened over the right of the page                             |
| `--shadow-sheet`       | A sheet lifted over the page and its bar                                            |
| `--scrim`              | What dims the page and its bar behind a sheet                                       |
| `--shadow-focus`       | The halo round a focused control                                                    |
| `--shadow-focus-inset` | The grey edge drawn inside a focused row, item or menu item                         |
| `--shadow-drop-before` | The rule along a line's top edge where a dragged line would land before it          |
| `--shadow-drop-after`  | The rule along a line's bottom edge where a dragged line would land after it        |
| `--shadow-pressed`     | A filled button held down: a step darker                                            |
| `--focus-halo`         | The soft halo round a focused control, outside its grey edge                        |
| `--row-inset`          | How far a sheet's rows sit from its edges: their text and focus tint line up on it  |
| `--lead-width`         | A row's first column, its number in an order: every title in a list starts after it |
| `--lead-width-wide`    | The first column when it holds a time or a date, as the Log's rows do               |
| `--opacity-hover`      | A filled button under the pointer                                                   |
| `--z-popover`          | Above the page                                                                      |
| `--z-panel`            | Above popovers                                                                      |
| `--z-undo`             | Above everything, an open sheet included: a choice made there shows its Undo        |
| `--z-sheet`            | A sheet, over everything, the bar included                                          |

## Layout

One bar on top, one column of reading under it, and any opened ref as a panel over the right of the page, as the
E · One list boards draw it.

| Token                 | Use for                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `--page-width`        | How wide the bar's content and the page get                                                        |
| `--panel-width`       | A line, task or issue opened over the page                                                         |
| `--page-width-narrow` | A page of reading in one column: the log                                                           |
| `--touch-target`      | The least height of anything tapped on a touch screen                                              |
| `--sheet-width`       | A sheet's width on a wide screen                                                                   |
| `--control-height`    | Every control on a desktop: buttons, selects, the bar's pills; one height, so a row lines up       |
| `--icon-size`         | An icon beside a control's words, or alone in a control that names itself                          |
| `--keys-column`       | The keys' column in the Keys sheet, one width for every group, so their meanings line up           |
| `--rail-width`        | The rail a plan branch hangs on, under the step it forks from: the tree drawn as plainly as a list |
| `--icon-inline-size`  | An icon inside running words, as tall as they are: a state's mark, a link's arrow, a key           |
| `--icon-inline-drop`  | How far below the baseline such an icon starts, so it centres on capitals and figures, not "x"     |
| `--swatch-width`      | A theme's swatch in a menu, its ground and accent side by side; menu words start past it           |
| `--tile-width`        | A tile's width before it grows to fill its row: folded sections' tiles, and swatches at half       |
| `--field-narrow`      | A box for one short value, such as a measurement, side by side with others                         |
| `--text-input-touch`  | Text fields on a touch screen. Below 16px, iOS zooms the page on focus                             |

CSS custom properties cannot be used in media queries, so the breakpoint lives in `packages/web/src/styles.css`:

| Below | What changes                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 720px | The Log and Agents move into the pages menu, with no bar of tabs, and the bar names no page; a line's items take the full width; choices stack |

Size and input are separate questions, so touch has its own rule rather than a width: `@media (pointer: coarse)` raises
the type scale, gives controls `--touch-target`, and hides what only a keyboard can act on. A phone on its side, wider than
720px, still gets these.

## Motion

There is none, and so there are no tokens for it. Things appear. See
[principle 4](principles.md#4-fast-is-a-feature-so-nothing-waits).

## Focus

`:focus-visible` draws a 1px edge in `--ink-3` with a `--focus-halo` of `--accent-soft` round it, everywhere: quiet,
but always visible, since this product is meant to be driven by keyboard. Inputs take the same edge and halo. A dark
primary button takes the edge set 2px off it, where a halo would vanish. The one focus on home is the exception: its
item takes the `--accent-soft` fill and a 1px `--ink-3` edge drawn inside it instead of the halo, and, with a mouse or trackpad and room in the
margin, a quiet "k" and "j", each with its up or down arrow icon, beside it in `--ink-3`, which a screen reader is not told.

## Icons

Every icon is drawn by Lucide (`lucide-react`), through the one `Icon` primitive, in the text's own colour. No character
from a font ever stands in for an icon: not a check, a cross, a triangle, a dot, an arrow, a chevron or a key. A state's
mark (check, cross, filled triangle, half circle, filled dot, dash, empty circle, filled square) is an icon in the
state's tone, as tall as the words beside it. Separators between facts ("·"), the ellipsis on a busy word and a range
such as "1–9" are punctuation, not icons, and stay text. A test fails if one of the old characters comes back.

The specs and the log write an icon as its name in brackets: [check], [cross], [triangle], [dot], [half], [ring],
[dash], [square] for the marks; [arrow] for a link to a page here or the step under way, [out] for one that leaves;
[back] and [forward] for chevrons, [caret] for a menu's down chevron; [pages] and [more] for the phone's menus; [Return],
[up], [down] and [Option] for keys.
