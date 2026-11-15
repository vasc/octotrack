# Foundations

What each token in [tokens.css](tokens.css) means. The values live there, so they are not repeated here. See them on
real components at `/design`.

## Color

Each color is `light-dark(light, dark)`, so one line covers both modes. The mode follows the operating system unless the
developer picks light or dark (`data-mode` on the page). `[data-theme]` forces one on part of a page, which is how the
specimen shows both.

### Themes

There are eight themes, each in light and dark: Paper (the tokens below), Slate, Sand, Forest, Ocean, Plum, Rose and High
contrast. A theme chooses every colour: `[data-palette="…"]` in `tokens.css` redefines the ground, its lines, the ink, the
accent, attention and the statuses. What a colour means never changes with the theme, only its hue: attention is still
the one colour for what needs you, good is still a green and bad a red, each tuned to sit in that theme, and no two
themes share an accent or an attention colour. The accent is the theme's own colour, and what agents propose (info)
wears it too, so the cards that wait for your yes are the theme's colour and not a blue every theme shares. Attention
is a second hue that stands apart from the accent, from bad's red and from good's green, and it is blue only in a
theme whose own colour is blue. Paper's accent is a blue and its attention a fuchsia; Slate is indigo with teal, Sand
terracotta with plum, Forest moss with magenta, Ocean sea blue with violet, Plum violet with teal, Rose raspberry with
teal, and High contrast pure blue with purple in light, cyan with yellow in dark. Where attention is teal, good is an
olive green so the two never read alike. In dark, each theme's ground is a deep shade of its own hue (Slate blue-grey,
Sand brown, Forest green, Ocean navy, Plum aubergine, Rose wine), so a theme still shows at night; only Paper's is a
neutral black, and High contrast's a pure one.

The colours are not picked by hand one by one. `scripts/themes.ts` holds each theme's seeds (its ground, ink, accent,
attention, good, bad and warn, in each mode), mixes the lines, the quieter inks, the tints and the edges from them, moves
every colour that is read as text toward the ink until it reaches its contrast on every ground and tint it sits on,
and writes the result into `tokens.css`. To change a theme, change its seeds and run `bun scripts/themes.ts`; to add
one, add its seeds there and an entry in `packages/web/src/lib/appearance.ts`. `bun test design` checks every pairing
in every theme and both modes, that each theme defines every colour, that the themes stay distinct, that info is the
accent, that no theme but a blue one has a blue highlight, and that every hued theme's dark ground carries its hue.

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
| `--line-field`  | The edge of a box you type into, and of a dashed tile             |

### Ink

| Token     | Use for                                      |
| --------- | -------------------------------------------- |
| `--ink`   | What is being read: titles, summaries        |
| `--ink-2` | Supporting text: context, descriptions, refs |
| `--ink-3` | Metadata: who, when, counts, hints           |

### Accent

The theme's own colour, for what the developer is acting on. It never says that something needs them: that is
attention.

| Token           | Use for                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `--accent`      | The primary button, the page you are on, focus rings and the focused item's edge, links, the chosen item in a menu, a field being typed in |
| `--accent-soft` | Behind an item under the pointer in a menu, a pressed tab, selected text                                                                   |
| `--on-accent`   | Text on a filled accent: the primary button, the page you are on                                                                           |

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
| `--bad-line`            | The edge of a Step in box. Decorative only                                                 |
| `--warn`, `--warn-soft` | Not finished yet, or worth a look: pending, review requested                               |
| `--info`, `--info-soft` | What agents propose and wait for your yes on; in progress. The accent's hue in every theme |
| `--info-line`           | The edge of a proposal. Decorative only                                                    |

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
| `--text-xl`         | A line's title, a question's title, the smaller section headings                                    |
| `--text-heading`    | Working on, and a page's own title                                                                  |
| `--text-title`      | The title of a line, task or issue opened in the panel                                              |
| `--weight-regular`  | Body                                                                                                |
| `--weight-medium`   | Navigation, counts beside a heading                                                                 |
| `--weight-semibold` | Titles, the counts in the bar                                                                       |
| `--weight-bold`     | Section headings, small capitals labels, a line's number                                            |
| `--leading-body`    | Running text                                                                                        |
| `--leading-tight`   | Titles that may wrap                                                                                |
| `--label-spacing`   | The letter spacing of small capitals labels: SUMMARY, FOR YOU, PLAN                                 |

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
| `--space-9`    | A line card's padding, horizontally; a handle's column   |
| `--space-10`   | A phone page's margins                                   |
| `--space-11`   | A number's column; the page's top margin                 |
| `--space-12`   | Between sections of home                                 |
| `--space-14`   | Padding around an empty state                            |
| `--space-16`   | The page's side margins                                  |
| `--space-24`   | How far a line's items sit under its title               |
| `--space-32`   | The room left at the end of a scroll                     |

The names are multiples of the unit: `--space-4` is four units.

## Shape

| Token           | Use for                                             |
| --------------- | --------------------------------------------------- |
| `--radius-sm`   | Small marks, progress bars, badges                  |
| `--radius-md`   | Buttons, inputs, options, repo chips                |
| `--radius-lg`   | Questions, tasks and rows under a line              |
| `--radius-xl`   | Line cards, the Up next card, proposals             |
| `--radius-2xl`  | Panels and the new line card                        |
| `--radius-pill` | Pills: the header counts, a group read as one thing |

## Elevation

Only what floats over content gets a shadow. Everything else is separated by a line.

| Token                | Use for                                                       |
| -------------------- | ------------------------------------------------------------- |
| `--shadow-popover`   | The filter's suggestions, the Undo bar                        |
| `--shadow-panel`     | A line, task or issue opened over the right of the page       |
| `--shadow-focus`     | The one focus on home: the line or item the keys act on       |
| `--border-focus`     | Edges for focus: the focus ring and the focused item's border |
| `--border-accent`    | An item's accent edge, such as a question's left edge         |
| `--opacity-disabled` | A control that cannot act now                                 |
| `--opacity-hover`    | A filled button under the pointer                             |
| `--z-popover`        | Above the page                                                |
| `--z-panel`          | Above popovers                                                |
| `--z-undo`           | Above an open panel: a choice made there shows its Undo       |

## Layout

One bar on top, one column of reading under it, and any opened ref as a panel over the right of the page, as the
E · One list boards draw it.

| Token                 | Use for                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `--page-width`        | How wide the bar's content and the page get                                                  |
| `--panel-width`       | A line, task or issue opened over the page                                                   |
| `--page-width-narrow` | A page of reading in one column: the log                                                     |
| `--touch-target`      | The least height of anything tapped on a touch screen                                        |
| `--control-height`    | Every control on a desktop: buttons, selects, the bar's pills; one height, so a row lines up |
| `--icon-size`         | The few icons, beside words or alone in a control that names itself                          |
| `--tile-width`        | A tile's width before it grows to fill its row: folded sections' tiles, and swatches at half |
| `--field-narrow`      | A box for one short value, such as a measurement, side by side with others                   |
| `--text-box-tall`     | A box for several lines at once, such as Record answers                                      |
| `--line-gutter`       | The handle's column on a line, before its number                                             |
| `--line-indent`       | Where a line's title starts; what the line holds is indented to it                           |
| `--text-input-touch`  | Text fields on a touch screen. Below 16px, iOS zooms the page on focus                       |

CSS custom properties cannot be used in media queries, so the breakpoint lives in `packages/web/src/styles.css`:

| Below | What changes                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 720px | Lines, Log and Agents become tabs at the bottom, and the bar stops naming the page; a line's items take the full width; choices stack |

Size and input are separate questions, so touch has its own rule rather than a width: `@media (pointer: coarse)` raises
the type scale, gives controls `--touch-target`, and hides what only a keyboard can act on. A phone on its side, wider than
720px, still gets these.

## Motion

There is none, and so there are no tokens for it. Things appear. See
[principle 4](principles.md#4-fast-is-a-feature-so-nothing-waits).

## Focus

`:focus-visible` draws a 2px ring in `--accent` everywhere. This product is meant to be driven by keyboard, so focus
must always be visible. Inputs also shift their edge to `--accent` on focus. The one focus on home is the exception: its
item takes a `--border-focus` edge in `--accent` instead of the ring, and, with a mouse or trackpad and room in the
margin, a quiet "k ↑ j ↓" beside it in `--ink-3`, which a screen reader is not told.
