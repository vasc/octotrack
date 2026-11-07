# Octotrack design language

How Octotrack looks, reads and behaves, kept in a form that can be changed. This folder is not a description of the
dashboard: `tokens.css` is imported by it, so a change here is a change in the product.

| File                             | What it holds                                                              |
| -------------------------------- | -------------------------------------------------------------------------- |
| [principles.md](principles.md)   | What the design is trying to do. Start here when a decision is not obvious |
| [tokens.css](tokens.css)         | Every color, type size, space, radius and shadow. The source of truth      |
| [foundations.md](foundations.md) | What each token means and when to use it                                   |
| [components.md](components.md)   | Every component: what it is for, its states, how it behaves                |
| [patterns.md](patterns.md)       | How components combine into the feed, the queue, the inspector             |
| [voice.md](voice.md)             | How the product words things, in the dashboard and the CLI                 |
| [log.md](log.md)                 | Decisions made so far, and the questions still open                        |

## See it

The specimen renders the real components with real tokens, in both themes side by side, and needs no data.

```bash
octo open
```

Then go to `/design` on that address. Add `?theme=dark` or `?theme=light` to look at one theme.

## Change it

For live reload while you work, run the server and the dev build, then open <http://localhost:4748/design>:

```bash
octo serve
```

```bash
bun run dev:web
```

1. Edit `tokens.css` and watch the specimen. For a color, change one line: `light-dark(light value, dark value)`.
2. Check that the language still holds. This fails on contrast below AA, on raw values in the dashboard's CSS, on tokens
   nobody uses, and on tokens or components the docs do not mention:

   ```bash
   bun test design
   ```

3. Run `bun run build` so that `octo serve` picks the change up without the dev build.
4. If it was a decision rather than a tweak, add a line to [log.md](log.md) saying what and why.

## Some changes to try first

These are one-line edits in `tokens.css` that change the whole product:

- **Density:** `--space-unit: 2px`. Try `2.5px` for roomier, or `1.75px` for tighter.
- **Reading size:** `--text-md: 13px`, the size of nearly everything. Change the rest of the scale with it.
- **Corners:** the three `--radius-*` values.
- **The attention color:** `--attention`, `--attention-soft` and `--attention-line`. Amber was chosen, not given.
- **The rail:** `--rail-width`, which decides how much room PR status gets beside the feed.

[log.md](log.md) lists the bigger open questions.

## Rules for the dashboard's code

- Values come from tokens. Add a token before adding a one-off value, and say what it means in `foundations.md`.
- Components have no inline styles, apart from values only known at run time, such as a progress bar's width.
- A new component gets a line in `components.md`, and goes on the specimen in `packages/web/src/design/`.
