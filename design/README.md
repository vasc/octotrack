# Octotrack design language

How Octotrack looks, reads and behaves, kept in a form that can be changed. This folder is not a description of the
dashboard: `tokens.css` is imported by it, so a change here is a change in the product.

| File                             | What it holds                                                              |
| -------------------------------- | -------------------------------------------------------------------------- |
| [principles.md](principles.md)   | What the design is trying to do. Start here when a decision is not obvious |
| [tokens.css](tokens.css)         | Every color, type size, space, radius and shadow. The source of truth      |
| [foundations.md](foundations.md) | What each token means and when to use it                                   |
| [components.md](components.md)   | Every component: what it is for, its states, how it behaves                |
| [patterns.md](patterns.md)       | How components combine into home, answering, the Log, the panel            |
| [voice.md](voice.md)             | How the product words things, in the dashboard and the CLI                 |
| [log.md](log.md)                 | Decisions made so far, and the questions still open                        |
| [canvas/](canvas/)               | Every screen, sheet and state, drawn: the design the dashboard is built to |
| [screens/](screens/)             | Per component: which drawing designs it, and its loading, error and empty  |
| [inventory/](inventory/)         | What every component did before this design, state by state, and its gaps  |

## The design every screen is built to

Every screen, sheet, widget and state is drawn on the canvas
[Octotrack: every screen](https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU), and its sources are kept in
[canvas/](canvas/). A screen is designed there, and agreed, before it is built; the code then matches the drawing.
`bun test design` fails when a component has no section in [screens/](screens/), or a section that leaves out its
loading, error or empty state.

## See it

The specimen renders the real components with real tokens, in both themes side by side, and needs no data.

```bash
octo open
```

Then go to `/design` on that address. Add `?theme=dark` or `?theme=light` to look at one theme.

## Change it

For live reload while you work, run the dev build, then open <http://localhost:4748/design>. The specimen needs no
data; the rest of the dashboard sends `/api` to the server on 4747, which the installed one already runs.

```bash
bun run dev:web
```

Every look belongs to a primitive in `packages/web/src/components/ui`, styled in `packages/web/src/ui.css` and nowhere
else: screens compose primitives and never give an element a class or a style, so a button, a row or a sheet is the same
everywhere. To change how something looks, change its primitive; if a screen needs something no primitive draws, add
the primitive, its line in [components.md](components.md) and its specimen. `bun run --cwd packages/web test` fails on a
screen that styles itself.

1. Edit `tokens.css` and watch the specimen. For a color, change one line: `light-dark(light value, dark value)`.
2. Check that the language still holds. This fails on contrast below AA, on raw values in the dashboard's CSS, on tokens
   nobody uses, and on tokens or components the docs do not mention:

   ```bash
   bun test design
   ```

3. The installed octo carries the dashboard inside it, so a change reaches it only with
   `bun run build && build/octo install` (see the [README](../README.md#updating)). A server run from the checkout
   serves `packages/web/dist`, which `bun run build` refreshes.
4. If it was a decision rather than a tweak, add a line to [log.md](log.md) saying what and why.

## Some changes to try first

These are one-line edits in `tokens.css` that change the whole product:

- **Density:** `--space-unit: 2px`. Try `2.5px` for roomier, or `1.75px` for tighter.
- **Reading size:** `--text-md: 13px`, the size of nearly everything. Change the rest of the scale with it.
- **Corners:** the three `--radius-*` values.
- **A theme's colours:** its `[data-palette]` block in `tokens.css`, every value picked by hand. Look at the change
  on the dashboard in light and dark before keeping it; `bun test design` checks contrast. Foundations, under Themes.
- **One control height:** `--control-height`, which every button, field and pill on a desktop shares.

[log.md](log.md) lists the bigger open questions.

## Rules for the dashboard's code

- Values come from tokens. Add a token before adding a one-off value, and say what it means in `foundations.md`.
- Components have no inline styles, apart from values only known at run time, such as a progress bar's width.
- A new component gets a line in `components.md`, and goes on the specimen in `packages/web/src/design/`.
