# Shell

What is around every page: the bar, its menus, Undo, and the states of the whole app. Designed on `Shell.dc.html`
(states A to H: the bar, I'm at, appearance, Undo, the phone's Pages menu, an address that leads nowhere, something
broke in the page, the server's own pages), with the app-wide strips on `Home-States.dc.html` (states D, E, F, G), in
the canvas at https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU.

### components/layout/AppShell.tsx

- Designed in: Shell.dc.html, states A, F, G, H; Home-States.dc.html, states D, E, F, G
- What it shows: the bar, a strip under it when something about the whole app is true, the page, the Undo bar, the open panel and the New line sheet.
- Changes from today:
  - Lost the connection after loading (F): a strip under the bar on every page, never a dialog: "Not live. Showing what was true at 14:20; reconnecting. Answers you give wait until it is back." with Try now (today "Not live: reconnecting").
  - A new version installed while open (G): "A new version of Octotrack is installed. It loads when you next switch to this tab; your drafts are kept." with Load it now (today nothing is said).
  - A part of the page that breaks (G on Shell): "This part of the page failed / A bug in the dashboard, not your data. Your drafts are kept on the tracker. Reloading usually clears it; if not, the error below is what to report." with the error and Reload, caught per area so a broken panel leaves Lines working (today the whole app goes blank).
  - An address that leads nowhere (F on Shell): "Nothing lives at {path}", then "The dashboard has For you and Lines, with the Log and Agents in More. Anything you open by its ref, like L-24, opens beside the page you are on." and Go to Lines.
  - Notes and errors sit in the page's gutter (today they are unstyled).
- Loading: first load (Home-States D): the bar at once and the page drawn as outlines, never a blank page.
- Error: the tracker not answering on first load (Home-States E): "The tracker is not answering / Nothing answered at 127.0.0.1:4747. Any octo command starts it again; this page tries again every 30 seconds." with `octo server status` and Try now. Raw error text never shows; a reply it cannot read becomes "The tracker sent something this page does not understand. Reload." (Primitives). The server's own pages stay plain text (H): "The dashboard is not built into this octo. Run: bun run build, then build/octo install".
- Empty: never empty: every path draws a page or the "Nothing lives at" page.

### components/layout/TopBar.tsx

- Designed in: triage/Main.dc.html, triage/T-Lines.dc.html, triage/T-More.dc.html
- What it shows: one row: "Octotrack"; Lines; For you with how much waits on you in a pill; then "+ New line" and More ("[more]").
- Changes from today: the counts, I'm at, the theme and the keys leave the bar; Log and Agents move into More; the page you are on is raised on a tile instead of underlined. On a phone the name gives way to Lines and For you, and New line is its plus alone (triage/T-Task-Phone).
- Loading: For you is named alone while what waits loads.
- Error: if what waits cannot load, For you is named alone, and For you's page says why.
- Empty: nothing waiting: For you has no pill.

### components/layout/MoreMenu.tsx

- Designed in: triage/T-More.dc.html
- What it shows: "[more]" opening "Log", "Agents", "Appearance Paper", "Keyboard shortcuts ?"; Appearance shows the themes and modes in the menu's place, under "[back] More".
- Changes from today: new; it takes the Log and Agents out of the bar, as they are used less.
- Loading: never loads on its own: the choices are fixed.
- Error: cannot fail on its own.
- Empty: never empty: the choices are fixed. Keyboard shortcuts shows only where there is a keyboard.

### components/layout/AppearanceMenu.tsx

- Designed in: Shell.dc.html, state C; triage/T-More.dc.html
- What it shows: inside More, "Theme" with all eight: [check] Paper, Solarized, Gruvbox, Catppuccin, Rosé Pine, Nord, Everforest, High contrast, each swatch its ground; "Mode" with [check] As the system, Light, Dark.
- Changes from today: ticks, swatches and item text each start at one x position, and group labels line up with the item text (today three different starts); all eight themes are listed, since eight rows fit a menu.
- Loading: never loads on its own: the choices are fixed.
- Error: cannot fail on its own: a choice that cannot be stored still applies for the visit, as today.
- Empty: never empty: the choices are fixed.

### components/layout/AppStrips.tsx

- Designed in: Home-States.dc.html, states F, G
- What it shows: under the bar on every page, never a dialog: "Not live. Showing what was true at 14:20; reconnecting. Answers you give wait until it is back." with Try now; "A new version of Octotrack is installed. It loads when you next switch to this tab; your drafts are kept." with Load it now.
- Changes from today: new; the lost connection was "Not live: reconnecting" with no way to retry, and a new version was never said.
- Loading: never loads on its own: AppShell says what is true.
- Error: the lost connection is its own error state.
- Empty: nothing true of the whole app: nothing drawn.

### components/layout/PartBoundary.tsx

- Designed in: Shell.dc.html, state G
- What it shows: its part of the page, or, when that part breaks, PartFailed in its place; one each for the page and the open panel.
- Changes from today: new; a bug anywhere blanked the whole app.
- Loading: never loads on its own.
- Error: a render error in its part, shown as PartFailed.
- Empty: never empty: it draws its part.

### components/layout/PartFailed.tsx

- Designed in: Shell.dc.html, state G
- What it shows: "This part of the page failed / A bug in the dashboard, not your data. Your drafts are kept on the tracker. Reloading usually clears it; if not, the error below is what to report." with the error and Reload.
- Changes from today: new.
- Loading: never loads on its own.
- Error: it is the error state.
- Empty: never empty: it always has the error.

### components/layout/NotFoundPage.tsx

- Designed in: Shell.dc.html, state F
- What it shows: "Nothing lives at {path}", that the dashboard has For you and Lines, with the Log and Agents in More, and that refs open beside the page you are on, and Go to Lines.
- Changes from today: new; the address that led nowhere was one sentence with no way back.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty: it always names the address.

### components/layout/PendingChoices.tsx

- Designed in: Shell.dc.html, state D
- What it shows: the Undo bar fed from the choices waiting, with `u` undoing the newest.
- Changes from today: an Undo that comes too late is said in the same place, "Too late to undo: it already took effect." (today an error at the top of the page).
- Loading: never loads on its own visibly: with nothing pending the bar is empty.
- Error: as UndoBar. If the list of waiting choices cannot be loaded, follows the Primitives pattern in the bar's place, with Try again (today pending choices silently vanish).
- Empty: nothing waiting: nothing shown.

### components/layout/UndoBar.tsx

- Designed in: Shell.dc.html, state D
- What it shows: at the bottom, above everything, sheets included: "Sending “Keep the cap in Merano” to roadtrip in 4 s" with Undo; "Stopping ttube in 3 s. The home worker line looks for another owner." with Pause the line instead and Undo; "Taking effect…"; "Did not happen: moving L-24 to up next. It changed meanwhile; look again." with Dismiss.
- Changes from today: the countdown is short ("in 4 s", today "in 4 seconds"); "Taking effect…" replaces "in 1 s" once the time is up and the tracker has not confirmed; a failure leads with "Did not happen:" and says what to do; the bar sits above sheets (today under them).
- Loading: "Taking effect…" while the tracker has not confirmed.
- Error: "Did not happen: {what}. {why}; look again." with Dismiss; a late Undo: "Too late to undo: it already took effect."
- Empty: nothing waiting: nothing shown.
