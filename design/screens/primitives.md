# Primitives

The parts every screen is built from, in every interaction state. Designed on `Primitives.dc.html` (sections: Button;
Field; Choice; Row; Fold; Status; Messages in place; Refs, links, keys, counts; Dark), with the bar, menus and Undo on
`Shell.dc.html`, sheets on `Sheets.dc.html` and panels on `Panels.dc.html` and `Line-States.dc.html`, in the canvas at
https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU. The rules that hold for all of them: one focus treatment, a grey
edge with a soft halo outside the element, keyboard only; one selected treatment, the accent-soft fill; pressed darkens one step;
disabled is one pale grey look for every kind of button, never just faded, and says why next to it when the reason is not obvious;
every control is at least 32 px tall on a pointer, 44 px on touch. Primitives hold no data of their own, so most never
load and cannot fail on their own; where they draw a state for their owner, it is said below.

### components/ui/Actions.tsx

- Designed in: Sheets.dc.html (every foot); Line-States.dc.html, states A–E
- What it shows: a place's buttons in one row that wraps, the main one first.
- Changes from today: on a phone, actions go full width (Line-States J, Sheets G).
- Loading: never loads on its own: its buttons show their own busy state.
- Error: cannot fail on its own: failures are said under it by its owner (Primitives, Messages in place).
- Empty: no buttons renders nothing.

### components/ui/AppBar.tsx

- Designed in: Shell.dc.html, state A; Home-States.dc.html, state I
- What it shows: the name and pages, what waits on you, then the controls.
- Changes from today: the current page is bold and underlined (today ink colour only); counts and page links get 44 px targets on touch (Refs, links, keys, counts); the urgent count's mark follows Status ("▲ urgent").
- Loading: never loads on its own: TopBar leaves the counts out while loading.
- Error: cannot fail on its own.
- Empty: no counts: the counts area is left out.

### components/ui/Badge.tsx

- Designed in: Primitives.dc.html, Status
- What it shows: a state in small words with its glyph: "● needs you", "▲ urgent, stuck, step in", "✓ done, passing, merged", "✗ failing, conflict, refused", "◐ running, in progress", "○ quiet, next, not started", "– dropped, closed, withdrawn".
- Changes from today: always a glyph and a word, never colour alone (today colour and word only, and "bad" is drawn in the warn colour).
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: no state renders nothing (today an empty span).

### components/ui/Button.tsx

- Designed in: Primitives.dc.html, Button; Dark
- What it shows: primary, plain, quiet and icon buttons in default, hover, focus, pressed, disabled and busy.
- Changes from today:
  - Pressed darkens one step (today not drawn).
  - Disabled is one look for every kind (primary, plain, quiet, icon): a pale grey fill, a faint edge and grey text, not 50% opacity; it says why next to it when not obvious.
  - Busy keeps the width and swaps the verb for its -ing form ("Starting…", "Tabling…"); the icon button's fourth state is open, while its menu shows.
  - No button carries a key hint; keys are listed in the Keys sheet, and a choice's number is its key.
- Loading: the busy state above.
- Error: cannot fail on its own: what it started reports in place.
- Empty: never empty: a button always has a verb or an icon with a name.

### components/ui/Facts.tsx

- Designed in: Primitives.dc.html, Row; Home.dc.html (line facts)
- What it shows: small grey facts separated by " · ".
- Changes from today: an empty fact is left out (today an empty string draws a stray "·").
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: no facts renders nothing.

### components/ui/Field.tsx

- Designed in: Primitives.dc.html, Field
- What it shows: a label over a box, in empty, focus, filled, invalid, disabled and not saved.
- Changes from today:
  - Focus is the grey focus edge with its soft halo (today a 1 px accent border).
  - Invalid says why under the box: "A full path, starting with /".
  - Disabled has its own look.
  - Not saved is said under the box: "Not saved: the tracker did not answer. Kept here; saves when it is back."
  - Labels are 13 px medium ink (today 12 px grey).
- Loading: never loads on its own: a draft that loads into it does not replace what is being typed (as today).
- Error: the invalid and not saved states above.
- Empty: the placeholder shows an example ("A reason").

### components/ui/Focusable.tsx

- Designed in: Primitives.dc.html, Row (focused item); Main.dc.html
- What it shows: the item the keys act on: the fill plus the 1 px grey focus edge, drawn inside so it never overlaps its neighbours.
- Changes from today: the focused item gets the ring as well as the fill, so it reads without colour (today only a tint, and no ring).
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty: it wraps an item.

### components/ui/Fold.tsx

- Designed in: Primitives.dc.html, Fold; Home.dc.html
- What it shows: closed ("Tabled 4 · Labyrinth level editor and 3 more ›"), open ("Tabled 4 ⌄" then its rows), and held open while an item inside has focus ("stays open while you are in it").
- Changes from today: the held state says why it stays open instead of only disabling the head.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: a fold with nothing in it is not drawn (owners leave it out).

### components/ui/Icon.tsx

- Designed in: Primitives.dc.html, Button (icon); Shell.dc.html, state A
- What it shows: the small icons in buttons and menus: plus, more ("⋯"), appearance ("◐"), pages ("☰").
- Changes from today: a pages icon for the phone bar ("☰").
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty.

### components/ui/Item.tsx

- Designed in: Main.dc.html; Items.dc.html, states A–F
- What it shows: something opened in place: its kind and facts in one small row, its title, then what it holds in three zones: what it is, what you do, other ways out, a hairline between reading and deciding.
- Changes from today: a hairline and space separate reading from deciding; the kind word ("Question", "Task for you") is in the attention colour instead of following a dot.
- Loading: never loads on its own.
- Error: cannot fail on its own: its owner says failures inside it.
- Empty: never empty: it always has a kind and a title.

### components/ui/LineBox.tsx

- Designed in: Primitives.dc.html, Field (one line, label hidden)
- What it shows: a one-line Field whose label is for a screen reader only.
- Changes from today: as Field. Nothing uses it today.
- Loading: as Field.
- Error: as Field.
- Empty: as Field.

### components/ui/Link.tsx

- Designed in: Primitives.dc.html, Refs, links, keys, counts
- What it shows: a link in running text: "This line in the log →" stays in the app, "vasc/stack#4 ↗" leaves it.
- Changes from today: links in text are underlined in a light rule that darkens on hover (today no underline until hover); → or ↗ says where it goes; 44 px hit area on touch.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty.

### components/ui/List.tsx

- Designed in: Primitives.dc.html, Row; Home.dc.html
- What it shows: rows divided by hairlines.
- Changes from today: an empty list is not drawn as an empty box; its owner says why it is empty in one sentence.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: renders nothing; the owner's sentence stands in its place.

### components/ui/Loaded.tsx

- Designed in: Primitives.dc.html, Messages in place; Line-States.dc.html, states G, H
- What it shows: loading words until the data has come once, a failure with Try again if it never came, then the content; a later refresh that fails keeps the content and marks it stale.
- Changes from today: the failure has Try again and the tracker's hint under it; stale reads "As of 14:20; could not refresh." (today "Out of date: {message}").
- Loading: "Loading the plan…" (the owner names what loads).
- Error: "Could not load the plan. The tracker did not answer." with Try again; stale as above.
- Empty: never empty on its own: the owner draws its empty sentence.

### components/ui/Markdown.tsx

- Designed in: Main.dc.html (question context); Line-States.dc.html, state A (summary)
- What it shows: agent- or developer-written text as prose.
- Changes from today: links in prose are underlined in the light rule and carry ↗ when they leave the app (today indistinguishable from text).
- Loading: the plain text shows while the renderer loads, as today.
- Error: cannot fail on its own: if the renderer cannot load, the plain text stays.
- Empty: empty text renders nothing.

### components/ui/MarkdownView.tsx

- Designed in: Main.dc.html; Line-States.dc.html, state A
- What it shows: the renderer behind Markdown.
- Changes from today: as Markdown.
- Loading: never loads on its own: Markdown loads it.
- Error: cannot fail on its own.
- Empty: empty text renders nothing.

### components/ui/Menu.tsx

- Designed in: Shell.dc.html, states B, C, E; Primitives.dc.html, Button (icon, open)
- What it shows: a button opening a short menu: group labels, ticked choices, actions.
- Changes from today: ticks, swatches and item text each start at one x position, and group labels line up with the item text; the button shows it is open; keyboard focus is the ink ring, not the hover fill; a menu can end with a quiet line saying how to add to it ("Places are added with octo place add").
- Loading: never loads on its own.
- Error: cannot fail on its own: its owner says a failed choice under the button ("Not changed: …").
- Empty: never empty: owners do not draw a menu with nothing in it.

### components/ui/NotKept.tsx

- Designed in: Primitives.dc.html, Field (not saved); Messages in place
- What it shows: "Not saved: the tracker did not answer. Kept here; saves when it is back." under the box, in the warn colour.
- Changes from today: says the words are kept and will save (today "Not saved: {error}" in red).
- Loading: never loads on its own.
- Error: it is itself the error.
- Empty: nothing to say renders nothing.

### components/ui/Note.tsx

- Designed in: Primitives.dc.html, Messages in place
- What it shows: one quiet line that is not the item itself; the error form for a failure in place.
- Changes from today: an error note carries the tracker's hint as the line under it when there is one.
- Loading: never loads on its own.
- Error: the error form above.
- Empty: never empty: drawn only with words.

### components/ui/Options.tsx

- Designed in: Primitives.dc.html, Choice; Main.dc.html
- What it shows: each option in default, hover, focus, recommended, chosen and unavailable: number on the label's baseline at the label's size, then label, "Recommended", and the description.
- Changes from today: the number is drawn at the label's size (today 12 px mono); "Recommended" is marked on the option, with its why inside it; chosen shows ✓ in place of the number and the rest step back; 44 px targets on touch (today about 37 px).
- Loading: never loads on its own.
- Error: cannot fail on its own: a failed send is said by its owner (Question-States E).
- Empty: no options renders nothing.

### components/ui/Page.tsx

- Designed in: Log.dc.html; Agents.dc.html
- What it shows: a page's title, a line under it saying what it shows ("what you have not seen, line by line", "1 running · 24 quiet"), and the page's own controls.
- Changes from today: a subtitle line under the title.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty: a page always has a title.

### components/ui/Pairs.tsx

- Designed in: Panels.dc.html, states B, D; Line-States.dc.html, state C; Items.dc.html, state F
- What it shows: names and values in two columns ("Checks / none run", "Waits for / the play-test of v1.3 first").
- Changes from today: none beyond its owners' words.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: pairs with no value are left out; with none left, nothing is drawn (today an empty list).

### components/ui/Panel.tsx

- Designed in: Line.dc.html; Line-States.dc.html, states G, H, I, J; Panels.dc.html, state F
- What it shows: the crumb, Close, the title, then the sections; opened from another panel, "‹ Back to L-57" beside Close; on a phone the whole screen with "‹ Lines".
- Changes from today: Back is its own button; Close always shuts the panel; Close carries no key hint.
- Loading: drawn at once with what is known; sections say what they load (Line-States G).
- Error: not found (Line-States I) and a failed part (H) are drawn inside it by its owner.
- Empty: never empty: it always has its head.

### components/ui/RefLink.tsx

- Designed in: Primitives.dc.html, Refs, links, keys, counts
- What it shows: a ref such as "D-65" in small monospace that opens it; TextLink, words that open something.
- Changes from today: 44 px hit area on touch without changing its look (as today); underlined in the light rule when inside running text.
- Loading: never loads on its own.
- Error: cannot fail on its own: the panel it opens reports not found.
- Empty: never empty.

### components/ui/RefText.tsx

- Designed in: Log.dc.html (event sentences); Panels.dc.html, state A
- What it shows: running text in which every ref is a RefLink.
- Changes from today: none.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: empty text renders nothing.

### components/ui/Row.tsx

- Designed in: Primitives.dc.html, Row
- What it shows: lead, title, facts, note, and at the end the actions or › when it opens something; in default, hover, focused item and opens-a-panel.
- Changes from today: the focused item has the fill plus the 1 px grey focus edge drawn inside the row (today only the fill); nothing ever gets a coloured side bar.
- Loading: never loads on its own; on a first load its owner draws rows as outlines (Home-States D).
- Error: cannot fail on its own: an owner says a failure under the row ("Not moved. …", Home-States H).
- Empty: never empty: it exists only for an entry.

### components/ui/SearchField.tsx

- Designed in: Log.dc.html, states B, C; Primitives.dc.html, Field
- What it shows: the search box, its completions (a term and what it means), and the error under it.
- Changes from today: invalid marks the box (today only the note); the keyboard highlight is the focus treatment, not the hover fill; the box takes the Field focus ring.
- Loading: never loads on its own.
- Error: the message under the box, the last results kept (Log B).
- Empty: no completions: no list.

### components/ui/Section.tsx

- Designed in: Line.dc.html; Line-States.dc.html; Home.dc.html
- What it shows: a small title with its count, an aside, then its content.
- Changes from today: an empty section says why in one sentence instead of a bare heading or a "0" count.
- Loading: never loads on its own: its owner draws "Loading …" inside it.
- Error: cannot fail on its own: a failed part is drawn inside it (Line-States H).
- Empty: the owner's one-sentence reason, or the section is left out.

### components/ui/Sheet.tsx

- Designed in: Sheets.dc.html, states A–G
- What it shows: a title that says what it does with Cancel, the fields, then the actions at the foot, main one first; from the bottom on a phone.
- Changes from today: it takes the focus and keeps it until closed, and the page behind does not react to keys; the Undo bar sits above it; a failure is said above its foot with the words kept ("Not added: …").
- Loading: never loads on its own: its owner says what loads inside it ("Loading what waited for it…").
- Error: the owner's failure above the foot.
- Empty: never empty: it always has its title and Cancel.

### components/ui/TextBox.tsx

- Designed in: Primitives.dc.html, Field; Question-States.dc.html, state D
- What it shows: a growing box of several lines whose label is for a screen reader only.
- Changes from today: as Field.
- Loading: as Field.
- Error: as Field: "Not saved: …" under it.
- Empty: the placeholder ("Leave it empty to nudge", "Write your answer").

### components/ui/TimeAgo.tsx

- Designed in: Question-States.dc.html (strips); Panels.dc.html, state A; Log.dc.html
- What it shows: short relative time ("2d", "3h"), then a date ("7 Nov").
- Changes from today: past 30 days a short date ("7 Nov") rather than YYYY-MM-DD; with "ago" where it ends a sentence ("9d ago", Items H).
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty.

### components/ui/Toast.tsx

- Designed in: Shell.dc.html, state D
- What it shows: one choice waiting, with its countdown and Undo, or one that did not happen, with Dismiss.
- Changes from today: drawn above everything, sheets included (today under sheets); a failure leads with "Did not happen:".
- Loading: "Taking effect…" once the time is up and the tracker has not confirmed.
- Error: the failed form above.
- Empty: nothing waiting: nothing shown.

### components/ui/Chips.tsx

- Designed in: Sheets.dc.html, state A (Repos)
- What it shows: "Repos" over pills that wrap: HASS, INFRA, MEDIA, PANEL, "+ 11 more", then "None: it's mine" set apart with a dashed edge; one on has the accent-soft fill.
- Changes from today: new; repos were a list of rows.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: with no chips, only those set apart show.

### components/ui/Notice.tsx

- Designed in: Home-FirstRun.dc.html; Home-States.dc.html, states A, B, E
- What it shows: "Nothing is placed yet" with its sentence and "Accept 51 recommendations"; "No lines yet" with `octo guide` and New line; "Nothing needs you"; "The tracker is not answering" in the bad tone.
- Changes from today: new; these were rows in a one-row list.
- Loading: never loads on its own.
- Error: its bad form is itself the error (E).
- Empty: never empty: it always has its heading.

### components/ui/Labelled.tsx

- Designed in: Line.dc.html; Line-States.dc.html, states A, B
- What it shows: "Done when" small and grey, its sentence under it at body size.
- Changes from today: new; a lone fact was a one-row two-column table with a wide gutter.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: its owner leaves it out when there is no sentence.

### components/ui/Callout.tsx

- Designed in: Line-States.dc.html, states B, D
- What it shows: "Recommended: start it." in the attention colour with its reason in ink, on the attention tint; the warm form for Step in.
- Changes from today: new.
- Loading: never loads on its own.
- Error: cannot fail on its own.
- Empty: never empty: it always has its lead.

### components/ui/Waiting.tsx

- Designed in: Question-States.dc.html, state C
- What it shows: "Sending to roadtrip in 4 s" with Undo beside it, inside the item where the choice was made.
- Changes from today: new; the Undo bar still shows the same choice, so its Undo is named for a screen reader ("Undo the answer to D-65").
- Loading: never loads on its own.
- Error: cannot fail on its own: a choice that fails is said by the Undo bar.
- Empty: nothing waiting: its owner leaves it out.

### components/ui/states.tsx

- Designed in: Primitives.dc.html, Messages in place; Home-States.dc.html, states A, D, E
- What it shows: LoadingState (outlines of the rows; "Loading the plan…" for screen readers only), ErrorState ("Could not load the plan. The tracker did not answer." with Try again, the tracker's hint as the line under it), EmptyState (why it is empty and how to fill it, with the command: "No lines yet … octo guide").
- Changes from today: ErrorState has Try again and shows the tracker's hint; raw error text (a parse error, a schema mismatch) never shows, it becomes "The tracker sent something this page does not understand. Reload."; the states sit at the row inset, not flush with the edge.
- Loading: LoadingState itself.
- Error: ErrorState itself.
- Empty: EmptyState itself.
