# Foundations

What each token in [tokens.css](tokens.css) means. The values live there, so they are not repeated here. See them on
real components at `/design`.

## Color

Each color is `light-dark(light, dark)`, so one line covers both themes. The theme follows the operating system.
`[data-theme]` forces one on part of a page, which is how the specimen shows both.

### Ground

From furthest back to nearest. Separation comes from lines and these small steps, not from shadows.

| Token           | Use for                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `--bg`          | The page                                                                      |
| `--surface`     | Things that sit on the page: cards, inputs                                    |
| `--surface-2`   | Things inside those, and hover: options, default badges, the current nav item |
| `--line`        | Dividers between rows, and card edges                                         |
| `--line-strong` | Edges that have to be noticed: inputs, hovered cards, a neutral mark          |

### Ink

| Token     | Use for                                      |
| --------- | -------------------------------------------- |
| `--ink`   | What is being read: titles, summaries        |
| `--ink-2` | Supporting text: context, descriptions, refs |
| `--ink-3` | Metadata: who, when, counts, hints           |

### Attention

Means "this needs you". See [principle 1](principles.md#1-attention-is-the-scarce-thing-and-it-has-one-color).

| Token              | Use for                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `--attention`      | Text and focus rings                                                                              |
| `--attention-soft` | Behind attention text, and a chosen option                                                        |
| `--attention-line` | The edge of a decision card, a mark in the feed. Decorative only: it does not reach text contrast |

### Status

Each has a strong and a soft version: the strong one for text and marks, and the soft one behind that text.

| Tokens                  | Means                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `--good`, `--good-soft` | Finished or fine: merged, passing, decided, done              |
| `--bad`, `--bad-soft`   | Broken, and someone has to act: failing, conflicting, blocked |
| `--warn`, `--warn-soft` | Not finished yet, or worth a look: pending, review requested  |
| `--info`, `--info-soft` | Moving along: in progress, active                             |

### Tones

A tone is how a component takes on a meaning. Setting `data-tone="bad"` on an element gives it `--tone`, `--tone-soft`
and `--tone-mark`, and badges, glyphs and feed marks all read those. Add a tone in one place and all of them get it.
`toneOf` in `packages/web/src/lib/format.ts` says which status gets which tone.

## Type

| Token               | Size is for                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| `--font`            | Everything, from the system's own fonts, so that nothing waits on a download |
| `--mono`            | Refs, queries, commands: anything that could be typed                        |
| `--text-xs`         | Metadata, badges, hints                                                      |
| `--text-sm`         | Refs, queries, secondary rows                                                |
| `--text-md`         | Body. Nearly everything                                                      |
| `--text-lg`         | The title of what you are deciding or inspecting                             |
| `--text-xl`         | Page titles, sparingly                                                       |
| `--weight-regular`  | Body                                                                         |
| `--weight-medium`   | Option labels, agent names, the current nav item                             |
| `--weight-semibold` | Titles and section headings                                                  |
| `--leading-body`    | Running text                                                                 |
| `--leading-tight`   | Titles that may wrap                                                         |

Hierarchy comes from weight and color first, then size. The scale is narrow on purpose: 11 to 15.

## Space

| Token          | Size is for                                              |
| -------------- | -------------------------------------------------------- |
| `--space-unit` | The base unit. Changing it scales everything below       |
| `--space-1`    | Hairline gaps, between stacked nav items                 |
| `--space-2`    | Inside compact things, and between a label and its value |
| `--space-3`    | Between closely related things                           |
| `--space-4`    | The default gap between things in a row                  |
| `--space-5`    | Padding inside inputs and cards, horizontally            |
| `--space-6`    | Between sections of a page                               |
| `--space-8`    | Between sections of the rail                             |
| `--space-10`   | Page margins                                             |
| `--space-14`   | Padding around an empty state                            |
| `--space-24`   | The room left at the end of a scroll                     |

The names are multiples of the unit: `--space-4` is four units.

## Shape

| Token           | Use for                       |
| --------------- | ----------------------------- |
| `--radius-sm`   | Small marks, progress bars    |
| `--radius-md`   | Badges, glyphs, small selects |
| `--radius-lg`   | Cards, inputs, buttons        |
| `--radius-full` | Dots                          |

## Elevation

Only what floats over content gets a shadow. Everything else is separated by a line.

| Token              | Use for                                                       |
| ------------------ | ------------------------------------------------------------- |
| `--shadow-popover` | The filter's suggestions                                      |
| `--shadow-panel`   | The inspector, when it slides over the page on narrow screens |
| `--z-popover`      | Above the page                                                |
| `--z-panel`        | Above popovers                                                |

## Layout

Three columns: navigation, the feed, and a rail for what should stay in view.

| Token                    | Use for                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `--sidebar-width`        | Navigation                                                             |
| `--sidebar-width-narrow` | Navigation, below the first breakpoint                                 |
| `--rail-width`           | The rail: PR status, drift, the inspector                              |
| `--page-width`           | How wide a column of reading gets                                      |
| `--page-width-wide`      | Pages laid out in columns, such as the roadmap                         |
| `--touch-target`         | The least height of anything tapped on a touch screen                  |
| `--text-input-touch`     | Text fields on a touch screen. Below 16px, iOS zooms the page on focus |

CSS custom properties cannot be used in media queries, so the breakpoints live in `packages/web/src/styles.css`:

| Below  | What changes                                                                                 |
| ------ | -------------------------------------------------------------------------------------------- |
| 1180px | The rail goes away and the inspector slides over the page. `PrStrip` keeps PR status in view |
| 720px  | One column. Navigation and tabs become scrolling strips, and rows are allowed to wrap        |

Size and input are separate questions, so touch has its own rule rather than a width: `@media (pointer: coarse)` raises
the type scale, gives controls `--touch-target`, and hides what only a keyboard can act on. A phone on its side, wider than
720px, still gets these.

## Motion

There is none, and so there are no tokens for it. Things appear. See
[principle 4](principles.md#4-fast-is-a-feature-so-nothing-waits).

## Focus

`:focus-visible` draws a 2px ring in `--attention` everywhere. This product is meant to be driven by keyboard, so focus
must always be visible. Inputs also shift their edge to `--ink-3` on focus.
