# Marketing films

Two films about the proposed redesign in `docs/DESIGN.md` ("Proposed, not built: lines of work at the centre"). They
show a design concept, not the shipped product, and say so on the end card.

| File                      | Length | What it is                                                                     |
| ------------------------- | ------ | ------------------------------------------------------------------------------ |
| `octotrack-explainer.mp4` | 86 s   | The problem, then how it works: one list, questions, agents, tabled lines, CLI |
| `octotrack-teaser.mp4`    | 28 s   | The same scenes cut short: the problem, the list, one question, the end card   |

Both are 1920×1080, 30 fps, H.264, silent, with every point on screen as text so they work muted.

## Change and render them

`src/video.html` is the film: each scene is a function of time, so any frame can be drawn on its own. Open it in a
browser and call `render(seconds)` in the console to look at a moment; add `?cut=teaser` for the short cut.

`src/capture.mjs` draws every frame in headless Chrome and pipes them to ffmpeg. It needs Google Chrome and ffmpeg:

```bash
node marketing/src/capture.mjs explainer marketing/octotrack-explainer.mp4
```

```bash
node marketing/src/capture.mjs teaser marketing/octotrack-teaser.mp4
```

A cut is a list of scenes and speeds at the bottom of `video.html`, under `CUTS`.
