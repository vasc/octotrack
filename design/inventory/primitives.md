# UI primitive inventory: packages/web/src/components/ui

## How to read this

- Paths are relative to `packages/web/src`. Line numbers are `file:line`.
- Every value comes from `design/tokens.css`. Each token is given with its pixel value.
  - Space (unit 2px): s1=2, s2=4, s3=6, s4=8, s5=10, s6=12, s7=14, s8=16, s10=20, s12=24, s14=28, s16=32, s32=64.
  - Fixed sizes: `--row-inset`=16, `--lead-width`=24, `--lead-width-wide`=48, `--control-height`=32, `--touch-target`=44, `--icon-size`=16, `--dot-size`=6, `--sheet-width`=480, `--panel-width`=820, `--page-width`=1180, `--page-width-narrow`=900, `--field-narrow`=128, `--text-input-touch`=16.
  - Radius: sm=4, md=6, lg=8, xl=8 (xl is the same as lg), pill=999.
  - Type: xs=12, sm=13, md=14 (15 on `pointer: coarse`), lg=15, heading=20. Weights are 400, 500 and 600. Leading is tight 1.3 and body 1.5.
  - Opacity: hint 0.6, disabled 0.5, hover 0.88.
  - Z-index: popover 10, panel 20, undo 30, sheet 40.
- Global styles in `styles.css` apply to every primitive:
  - **Focus ring.** `:focus-visible { outline: 2px (--border-focus) solid --accent; outline-offset: 1px }` (styles.css:59-62). Wherever this report says "global ring", it means this rule.
  - **Links.** `a { color: inherit; text-decoration: none }` (styles.css:39-42).
  - **Form controls.** `button, input, select, textarea { font: inherit; color: inherit }`.
  - **Root.** `accent-color` and `caret-color` are `--accent`. `::selection` is `--accent-soft` with `--ink` text. The touch tap flash is `--accent` mixed at 22% (styles.css:24). On a touch screen this flash is the only pressed feedback anywhere.
  - **Body.** `--text-md` / 1.5 `--font`.
- No rule in `ui.css` uses `:active`, transitions, `prefers-reduced-motion` or `forced-colors`.
- Every colour token has light and dark values through `light-dark()`. `[data-palette]` swaps in one of 8 palettes. The shadows and the scrim are the same in both modes.

---

### Actions — components/ui/Actions.tsx

- **Purpose:** a place's buttons in one row that wraps. The primary comes first; the others are words beside it.
- **Props:**
  - `children: ReactNode`: the buttons.
- **Variants:** none. Styles are at ui.css:247-256.
  - `.ui-actions` is a flex row that wraps, align-items center, gap s2 (4px).
  - If the first child is a `.ui-button` that is not primary, it gets `margin-left: -s5` (-10px), so a word button's text lines up with the text above it.
- **Interaction states:** none of its own.
- **Keyboard and screen reader:** a plain `div` with no role.
- **Phone / touch:** no rule of its own. Child buttons grow to 44px tall on coarse pointers. On ≤720px, an icon-bearing button collapses to 32px wide while keeping the -10px pull (see Button).
- **Content edge cases:**
  - Many buttons wrap onto new lines with a 4px gap.
  - Buttons are `nowrap`, so one very long label overflows instead of wrapping.
  - An empty Actions renders an empty div with no height.
- **Used by:** decisions/BatchPanelView, decisions/DecisionCardView, decisions/OwnWords, drift/DriftItem, entity/DecisionPanel, entity/LineActions, entity/OwnWorkBox, entity/OwnerBox, entity/TellBox, entity/UpdatesSection, feed/FeedSection, feed/UnseenLog, home/CheckoutForm, home/DoneWhenChanged, home/FirstRun, home/FoldPicker, home/LineProposalCard, home/ProposalChoices, home/StartSheetView, home/StepIn, home/TaskCard, lines/NewLineSheet, lines/TableForm. Design gallery: design/DesignPage, design/Example, design/PrimitivesGallery.

### AppBar (with BarLink, Counts, Count, Only) — components/ui/AppBar.tsx

- **Purpose:** the one sticky bar over every page.
  - The left holds the name and page links (`nav`).
  - The middle holds what waits on the developer (`status`).
  - The end holds the actions.
- **Props:**
  - `AppBar`:
    - `nav: ReactNode`: goes in `<nav aria-label="Main" class="ui-bar-nav">`.
    - `status?: ReactNode`: rendered bare between nav and actions; in practice a `<Counts>`.
    - `actions: ReactNode`: goes in `span.ui-bar-actions`.
  - `BarLink`:
    - `href: string`
    - `current: boolean`: sets `aria-current="page"`, which colours the link ink.
    - `brand?: boolean`: sets `data-brand="true"`, giving semibold ink with an 8px right margin.
    - `onGo(href)`: in-app navigation. Cmd or Ctrl click falls through to the browser.
    - `children`
  - `Counts`:
    - `label: string`: becomes `aria-label`.
    - `children`
  - `Count`:
    - `n: number`: shown bold in ink.
    - `label: string`: the words after the number, in ink-3.
    - `href`
    - `urgent?: boolean`: sets `data-urgent`, which adds a 6px dot in `--warn` before the number.
    - `onGo`
  - `Only`:
    - `on: "phone" | "wide"`: shows its children only on that size of screen.
- **Variants:** ui.css:1046-1129 and 1272-1292.
  - **`.ui-bar`**
    - Sticky at top 0, z `--z-panel` (20).
    - Background `--bg`, with a 1px `--line` bottom border.
  - **`.ui-bar-inner`**
    - Flex, align center, gap s8 (16).
    - max-width `--page-width` (1180), centred.
    - min-height `control-height + 2*s4` (48).
    - Padding s3 s10 (6px 20px).
  - **`.ui-bar-nav`**
    - Flex, baseline-aligned, gap s8 (16).
  - **`.ui-bar-link`**
    - `--text-sm` (13) in `--ink-3`, no underline.
    - The brand variant is semibold `--ink` with margin-right s4 (8).
  - **`.ui-bar-actions`**
    - Flex, align center, gap s2 (4).
    - `margin-left: auto`, which pushes it to the end.
  - **`.ui-counts`**
    - Flex that wraps, baseline-aligned, gap s2 by s8 (4 by 16), `--text-sm`.
  - **`.ui-count`**
    - `--ink-3`, nowrap, no underline.
    - Its `b` has margin-right s2 (4), `--weight-medium`, `--ink`, tabular figures.
    - Urgent adds a `::before` dot: 6x6, pill radius, `--warn` fill, margin-right s3 (6), nudged up 1px.
  - **`.ui-only`**
    - `display: contents`.
- **Interaction states:**
  - BarLink:
    - Hover: colour `--ink` (1076-1079).
    - Current: same as hover, ink colour only. There is no underline, weight change or indicator bar.
    - Focus-visible: global ring.
    - Active and disabled: not styled.
  - Count:
    - Hover: the words turn `--ink` (1116-1118).
    - Focus: global ring.
    - Active and current: not styled.
  - Brand link: hover makes no visible change because it is already ink.
- **Keyboard and screen reader:**
  - The bar is a `header` landmark containing a `nav` labelled "Main".
  - BarLink is an `<a>` with `aria-current="page"`.
  - Counts has `role="status"` with an `aria-label`, so it is a live region.
  - Each Count is an `<a>`. The screen reader reads "{n}{label}" with no space in between: `<b>` and the text are adjacent. A space reaches the screen reader only if the label itself carries one.
  - No keys are handled. Cmd and Ctrl clicks are passed to the browser.
- **Phone / touch:**
  - On ≤720px (1209-1225):
    - The bar wraps, with gap s4 (8) and padding 6 8 6 16.
    - Every non-brand BarLink is `display: none`.
    - Counts moves to its own line (`order: 3; flex-basis: 100%`) with gap s1 by s6 (2 by 12) and padding-bottom s2 (4).
  - `Only[data-on=wide]` is hidden on ≤720px. `Only[data-on=phone]` is hidden on ≥721px.
  - On `pointer: coarse` there is no target enlargement for `.ui-bar-link` or `.ui-count`: they stay 13px text targets.
- **Content edge cases:**
  - On a wide screen the inner bar does not wrap, so many nav links or counts with long labels squeeze or overflow. Only Counts wraps internally.
  - Each count is `nowrap`.
  - The bar is 1180px wide while `.ui-page` is 900px, so the bar's edges do not line up with page content.
- **Used by:** layout/TopBar. TopBar imports all five exports.

### Badge / StatusBadge — components/ui/Badge.tsx

- **Purpose:** a state in small words, with no pill or background.
- **Props:**
  - `Badge`:
    - `tone?: "neutral"|"good"|"bad"|"warn"|"attention"|"info"`, default neutral. Written to `data-tone`.
    - `children`
  - `StatusBadge`:
    - `value: string`: the tone comes from `toneOf(value)` (lib/format.ts:113-142) and the text from `humanize`, which replaces `_` with a space.
- **Variants:** `.ui-tag`, ui.css:86-98.
  - The base is `--text-xs` (12) in `--ink-3`, nowrap.
  - `bad` and `warn` both use `--warn`. `bad` is not drawn in `--bad`.
  - `good` uses `--ink-2`.
  - `neutral`, `info` and `attention` have no rule and stay `--ink-3`.
  - Value-to-tone mapping in `toneOf`:
    - good: done, merged, passing and similar.
    - info: active, in_progress, in_review, now.
    - attention: open.
    - bad: failing, conflicting, changes_requested, blocked, blocker, urgent.
    - warn: warning, pending, requested, high.
  - `data-tone` also sets `--tone`, `--tone-soft` and `--tone-mark` (tokens.css:137-181), but ui.css never reads them.
- **Interaction states:** non-interactive, so not styled.
- **Keyboard and screen reader:** a plain span. Tone is conveyed by colour only, alongside the words.
- **Phone / touch:** none.
- **Content edge cases:**
  - `nowrap` means a long status never wraps and can overflow its container.
  - Empty text renders an empty span.
- **Used by:**
  - Badge: entity/EntityCrumbs, design/StatusGallery.
  - StatusBadge: drift/DriftItem, entity/EntityCrumbs, entity/LinkList, entity/PrPanel, entity/UpdatesSection, design/StatusGallery.

### Button / IconButton — components/ui/Button.tsx

- **Purpose:** the one button. Primary is filled; plain is a word that acts; quiet is a word that steps back; icon is a square around an icon.
- **Props:**
  - `Button`:
    - `variant?: "primary"|"plain"|"quiet"`, default plain. Written to `data-variant`.
    - `type?: "button"|"submit"`
    - `choice?: number|string`: written to `data-choice`. The number shows before the label only when an ancestor has `data-current="true"` and the pointer is fine.
    - `icon?: IconName`: a 16px icon before the words. The words are wrapped in `.ui-button-words`, and `aria-label` is set to the children when they are a string.
    - `children`
    - All native button attributes except `className`, `style`, `type` and `children`; this includes `disabled`, `onClick`, `aria-*` and `ref`.
  - `IconButton`:
    - `icon: IconName`
    - `label: string`: becomes `aria-label` and `title` (a tooltip).
    - Native attributes, with `type="button"` and `data-variant="icon"`.
- **Variants:** ui.css:193-244.
  - **Base `.ui-button`**
    - `inline-flex`, items centred, gap s3 (6).
    - min-height `--control-height` (32), padding 0 s5 (0 10px), no border, radius md (6), transparent background.
    - Text is `--text-sm` (13), weight medium (500), colour `--ink`, nowrap, pointer cursor.
  - **primary**
    - Background `--accent`, text `--on-accent`.
  - **plain**
    - The base style: ink text, no background.
  - **quiet**
    - Colour `--ink-3`.
  - **icon**
    - Width 32, padding 0, colour `--ink-2`. The result is a 32x32 square.
  - **Choice hint** (259-267, `pointer: fine` only)
    - A `::before` showing `attr(data-choice)` in `--mono`, `--text-xs`, regular weight, opacity 0.6.
    - It sits before the icon and words, 6px apart through the gap.
- **Interaction states:**
  - **Hover**
    - Not disabled: background `--surface-2` (211-213), for plain, quiet and icon.
    - Primary: keeps `--accent` at opacity 0.88 (220-223).
  - **Focus-visible:** global ring, 2px `--accent` at offset 1px. Nothing button-specific.
  - **Active / pressed:** not styled.
  - **Disabled:** opacity 0.5 with the default cursor (241-244); hover is suppressed.
  - **Current / selected, checked, open:** not styled. `aria-pressed` and `aria-expanded` have no rules on `.ui-button`.
  - **Loading / busy:** none.
- **Keyboard and screen reader:**
  - A native `<button>`.
  - An icon-plus-words button gets `aria-label` equal to its words, so on a phone, where the words are hidden, it is still named.
  - IconButton has `aria-label` and `title`.
  - `choice` only draws a number. Key handling is elsewhere.
- **Phone / touch:**
  - On `pointer: coarse` (1233-1237, 1254-1256):
    - min-height 44.
    - An icon button becomes 44 wide, so 44x44.
  - On ≤720px (1276-1286):
    - `.ui-button-words` is hidden.
    - An icon-bearing button becomes `width: 32px; padding: 0`.
    - With both coarse pointer and ≤720px, an icon+words button such as "New line" in TopBar is therefore 32 wide by 44 tall, while a true IconButton is 44x44.
- **Content edge cases:**
  - `white-space: nowrap`: long labels never wrap and overflow their container. There is no max-width and no ellipsis.
  - Empty children give a 32px-tall button that is 20px wide from padding alone.
- **Used by:**
  - Button: agents/AgentRosterRow, decisions/BatchPanelView, decisions/DecisionCardView, decisions/OwnWords, drift/DriftItem, entity/DecisionPanel, entity/LineActions, entity/OwnWorkBox, entity/OwnerBox, entity/TellBox, entity/UpdatesSection, feed/FeedPage, feed/FeedSection, feed/UnseenLog, home/AnswerStatus, home/AtSection, home/CheckoutForm, home/DoneWhenChanged, home/FirstRun, home/FoldPicker, home/LineProposalCard, home/ProposalChoices, home/PushToggle, home/QuietRow, home/StartSheetView, home/StepIn, home/TaskCard, home/UpNextRow, layout/TopBar, layout/UndoBar, lines/NewLineSheet, lines/TableForm, ui/Sheet. Design gallery: DesignPage, Example, PrimitivesGallery.
  - IconButton: layout/TopBar.
  - The `.ui-button` class is also used directly by Menu's trigger and Panel's Close button.
  - Button is called with `choice` from home/DoneWhenChanged, TaskCard, ProposalChoices, StepIn, LineProposalCard and FoldPicker.
  - Only TopBar's "New line" passes `icon`.

### Facts / Fact — components/ui/Facts.tsx

- **Purpose:** small grey facts in a row, separated by middle dots. A single Fact can be emphasised.
- **Props:**
  - `Facts`:
    - `children`: each child is wrapped in `span.ui-fact`.
  - `Fact`:
    - `tone: "strong"|"stuck"`: written to `data-tone`.
    - `children`
- **Variants:** ui.css:100-118.
  - `.ui-facts` is `--text-sm` (13), regular weight, `--ink-3`.
  - A dot "·" goes between facts, with margin 0 s3 (0 6px), in `--ink-3`.
  - `strong` is `--ink-2`. `stuck` is `--warn`.
- **Interaction states:** none, except child RefLinks and TimeAgo.
- **Keyboard and screen reader:** plain spans. The separator dots are CSS content and may be read by some screen readers.
- **Phone / touch:** none directly. Inside a Row on ≤720px, the `.ui-row-facts` wrapper becomes a block under the title.
- **Content edge cases:**
  - Text flows inline and wraps anywhere, so a separator dot can start a line.
  - `Children.toArray` drops `null`, `undefined` and booleans, but not `""`. An empty-string child still renders as a fact with a leading "·", despite the doc comment saying "empty ones are left out".
  - There is no truncation.
- **Used by:**
  - Facts: agents/AgentRosterRow, decisions/DecisionMeta, decisions/QuestionStrip, drift/DriftItem, entity/EntityCrumbs, entity/EventList, entity/IssuePanel, entity/LinePanelHead, entity/LinkList, entity/OwnerBox, entity/PlanList, entity/PullRequestBox, entity/SinceSummary, entity/TaskFrees, entity/UpdatesSection, feed/FeedItem, feed/LogGroup, home/AtSection, home/LineMeta, home/NothingNeedsYou, home/ProposalCard, home/QuietRow, home/SpreadThin, home/TaskCard, home/TaskClosed, home/UpNextRow.
  - Fact: entity/PlanList, entity/PullRequestBox, feed/LogGroup, home/LineMeta, home/SpreadThin.

### Field / FieldRow — components/ui/Field.tsx

- **Purpose:** a labelled box to type into, either one line or several lines that grow with the text. While it has focus it keeps what was typed (useHeldValue), so a draft synced from another device never changes the text under the cursor.
- **Props:**
  - `label: string`: a visible `label.ui-label` above the box.
  - `value`
  - `onChange`
  - `hideLabel?: boolean`: the label becomes visually hidden but stays for screen readers.
  - `placeholder?`
  - `multiline?: boolean`: renders a `<textarea rows=1>` that grows with its content.
  - `type?: "text"|"date"`: the native date picker. Ignored when multiline.
  - `onSubmit?`: called on Cmd+Enter or Ctrl+Enter.
  - `autoFocus?`
  - `replaced?: number`: increments to push a deliberate replacement through while the box is focused.
  - `FieldRow`:
    - `children`: short fields side by side.
- **Variants:** ui.css:524-557 and 1315-1319.
  - **`.ui-field`**
    - Flex column, gap s2 (4), `min-width: 0`.
  - **Label**
    - `--text-xs` (12), regular weight, `--ink-3` (19-24).
    - Hidden variant: 1px absolute with clip-path (9-17).
  - **Input and textarea**
    - Width 100%, min-height 32, padding s3 s5 (6px 10px).
    - Border 1px `--line-strong`, radius md (6), background `--surface`.
    - Text `--text-md` (14), line-height 1.5, colour `--ink`, `resize: none`.
  - **Textarea**
    - `overflow: hidden; field-sizing: content`, plus JS that sets `height = scrollHeight` (Field.tsx:44-50).
  - **Placeholder**
    - `--ink-3`, the same colour as the label.
  - **FieldRow**
    - Grid of `repeat(auto-fill, minmax(--field-narrow 128px, 1fr))`, gap s5 (10).
- **Interaction states:**
  - Hover: not styled.
  - Focus: `outline: none` and the border turns `--accent` (554-557). The ring stays 1px and the border does not thicken. Because `:focus` is used rather than `:focus-visible`, a mouse click also shows it. The caret is `--accent` (styles.css).
  - Active: not styled.
  - Disabled: no prop and no style.
  - Read-only: not styled.
  - Error or invalid: no prop and no style. Errors are shown separately through NotKept or Note.
  - Filled vs empty: not distinguished.
  - Date input: browser default chrome, with `accent-color: --accent`.
- **Keyboard and screen reader:**
  - The label is tied by `htmlFor` and `useId`.
  - Cmd or Ctrl+Enter calls `onSubmit` with `preventDefault`.
  - There is no `aria-invalid`, `aria-describedby`, `required` or hint slot.
- **Phone / touch:**
  - On `pointer: coarse`, input and textarea text is 16px (`--text-input-touch`, 1258-1262), which prevents iOS zoom.
  - There is no height change on coarse. min-height stays 32, but the actual height is about 35px: 6+21+6+2.
- **Content edge cases:**
  - A single-line input scrolls horizontally, natively.
  - A textarea grows without limit. It has no max-height, so pasting a long text makes it as tall as the text, with `overflow: hidden`.
  - Inside `.ui-page-aside` the field is `flex:1` with a max-width of 320 (684-687).
  - With an empty value the placeholder shows; there is no special empty treatment.
- **Used by:**
  - Field: decisions/BatchPanelView, drift/DriftItem, home/CheckoutForm, home/OutcomeFields, home/TaskCard, lines/NewLineSheet, lines/TableForm, ui/LineBox, ui/TextBox.
  - FieldRow: home/OutcomeFields.

### Focusable — components/ui/Focusable.tsx

- **Purpose:** one item in the page's keyboard focus order. When focused it is tinted and its numbered choices show their keys.
- **Props:**
  - `focusRef: string`: written to `data-focus-ref`, which the page keys use to find it.
  - `label: string`: `aria-label`.
  - `focused: boolean`: sets `data-current="true"` and `aria-current="true"`.
  - `children`
- **Variants:** ui.css:302-310 and 494-520.
  - A `<fieldset class="ui-focusable">` with margin, padding and border all reset to 0, and `min-width: 0`.
  - **As a direct child of `.ui-list`**
    - Padding s7 `--row-inset` (14px 16px).
  - **Inside a row body (`.ui-row-body >` or `.ui-row-body > .ui-list >`)**
    - Negative margins pull it to the sheet's edges: `0 -row-inset 0 -body-inset`.
    - Padding s7 `row-inset` s7 `body-inset`, so the tint runs edge to edge while the text stays aligned.
  - **Nested two row bodies deep**
    - margin 0, padding s7 0.
- **Interaction states:**
  - Current: background `--accent-soft`.
  - The tint is removed when the Focusable is inside a current `.ui-row`, or anywhere inside `.ui-panel` (517-520).
  - Focus: `outline: none` (307-310). Real keyboard focus has no visible ring; only the `data-current` tint shows it.
  - Hover, active and disabled: not styled.
- **Keyboard and screen reader:**
  - A fieldset, so the group role is announced with its `aria-label`.
  - `tabIndex=-1`, so it is focusable from script but not reachable by Tab.
  - `aria-current="true"`.
  - It handles no keys itself.
  - When the parent sets `data-current`, `[data-choice]` descendants show their numbers on fine pointers.
- **Phone / touch:** no specific rule. Choice numbers never show on coarse pointers.
- **Content edge cases:** none of its own. Content wraps according to its children.
- **Used by:** home/AtPlaceItems, home/AtUpNext, home/ForYouRow, home/StepIn.

### Fold — components/ui/Fold.tsx

- **Purpose:** a section folded to one row: title, count, and a short summary of what it holds. Opened, it shows its rows. It is held open while one of its items has focus.
- **Props:**
  - `title: string`: the head title and the section's `aria-label`.
  - `count: number`: shown in `.ui-section-count`.
  - `summary?: string`: a one-line, ellipsed summary of the contents.
  - `held?: boolean`: forces it open, disables the head button and hides the chevron.
  - `children`: shown when open.
- **Variants:** ui.css:730-783.
  - **`.ui-fold`**
    - Background `--surface`, 1px `--line` border, radius lg (8), `overflow: hidden`.
  - **`.ui-fold-head`**
    - Flex, baseline-aligned, gap s4 (8), full width.
    - Padding s6 `row-inset` (12px 16px), no border or background, left-aligned text.
  - **`.ui-fold-title`**
    - `--text-sm` (13), semibold, `--ink`.
  - **Count**
    - `.ui-section-count`: sm, regular weight, `--ink-3`, tabular figures.
  - **`.ui-fold-summary`**
    - `flex: 1`, `min-width: 0`, sm, `--ink-3`, single line with ellipsis.
  - **Chevron**
    - `.ui-row-chevron` "›" in `--ink-3`, pushed right with `margin-left: auto`.
    - Rotated 90° when open (`data-open`).
  - **Open state**
    - `data-open="true"` on the section has no rule of its own.
    - A `.ui-list` inside a Fold loses its border and radius and gets a 1px `--line` top border (779-783).
- **Interaction states:**
  - Hover when not disabled: `--surface-2` (751-753).
  - Focus-visible: global ring. Its 1px outset is clipped by `.ui-fold { overflow: hidden }` at the left, right and top edges.
  - Active: not styled.
  - Disabled (held): default cursor only (755-757). No colour or opacity change, and the chevron is removed.
  - Open: chevron rotates 90° instantly, with no transition.
- **Keyboard and screen reader:**
  - A `<section aria-label>`.
  - The head is a `<button aria-expanded>`; Enter and Space toggle it.
  - When held, `disabled` removes it from the Tab order and announces it as dimmed or unavailable.
- **Phone / touch:**
  - On ≤720px the summary is hidden (1227-1229).
  - No coarse target rule: the head is about 12+20+12 = 44px tall from padding.
- **Content edge cases:**
  - The summary is truncated with an ellipsis.
  - The title has no wrap or truncate rule, so a long title wraps within the flex item and can push the count.
  - A count of 0 shows "0".
  - Open with many children: no max-height, so it grows.
- **Used by:** home/QuestionList, home/WaitingSections, design/LinesGallery.

### Icon — components/ui/Icon.tsx

- **Purpose:** an inline SVG icon on a 24-unit grid that strokes `currentColor`. Shapes follow Lucide.
- **Props:**
  - `name: "plus"|"pin"|"keyboard"|"grip"|"chevron"|"more"|"palette"`.
- **Variants:**
  - `.ui-icon` is 16x16 (`--icon-size`) and `flex: none` (ui.css:235-239).
  - Stroke width 2, round caps and joins, `fill: none`. The palette icon's four dots are filled with `currentColor`.
  - The `grip` icon is defined but used nowhere.
- **Interaction states:** inherits the parent's colour; no states of its own.
- **Keyboard and screen reader:** `aria-hidden="true"` and `focusable="false"`. It is never announced; the parent control must name itself.
- **Phone / touch:** none.
- **Content edge cases:** not applicable. The size is fixed and does not scale with text.
- **Used by:** ui/Button and ui/Menu. Through them: TopBar ("plus", "keyboard"), LineActions ("more"), PagesMenu ("more"), AppearanceMenu ("palette"), AtMenu ("pin"), and Menu's own "chevron" after its text.

### Item — components/ui/Item.tsx

- **Purpose:** something opened in place, such as a question or a task. It shows its kind after a dot, then its title, then what it holds. It has no box of its own.
- **Props:**
  - `kind: ReactNode`: rendered in `.ui-row-kind` with a dot.
  - `tone?: "needs"|"stuck"|"none"`, default "needs": the dot's colour.
  - `title?: ReactNode`: an `h3.ui-item-title`.
  - `label?: string`: the article's `aria-label`.
  - `children`
- **Variants:** ui.css:1296-1313 and 379-402.
  - **`.ui-item`**
    - Flex column, gap s5 (10), `min-width: 0`.
  - **Kind**
    - `inline-flex`, gap s3 (6), xs (12), `--ink-3`.
    - The dot is 6px, pill-shaped. needs is `--attention`, stuck is `--warn`, none is `--line-strong`.
    - `margin-bottom: -s3` (-6), so the gap between kind and title is 4.
  - **Title**
    - lg (15), semibold, line-height tight (1.3), `--ink`.
- **Interaction states:** none.
- **Keyboard and screen reader:**
  - An `<article>` with an optional `aria-label`.
  - The title is an `h3`.
  - The dot is CSS-only; the tone is not announced.
- **Phone / touch:** none.
- **Content edge cases:**
  - The title has no `overflow-wrap`, so a long unbroken ref or path overflows.
  - Without a title the gap still applies between kind and children.
- **Used by:** decisions/DecisionCardView, home/DoneWhenChanged, home/HeldQuestion, home/LineProposalCard, home/StepIn, home/TaskCard, home/TaskClosed.

### LineBox — components/ui/LineBox.tsx

- **Purpose:** a one-line Field with its label hidden.
- **Props:**
  - `label`
  - `value`
  - `onChange`
  - `placeholder?`
- **Variants and states:** identical to Field with `hideLabel`.
- **Keyboard and screen reader:** as Field. The label is screen-reader only.
- **Phone / touch:** as Field.
- **Content edge cases:** as Field.
- **Used by:** nothing. No file under components/ or design/ imports it, so it is dead code.

### Link — components/ui/Link.tsx

- **Purpose:** an `<a>` within running words, either to GitHub in a new tab or to an in-app page that Cmd-click can open in another tab. It is underlined only under the pointer.
- **Props:**
  - `href`
  - `external?: boolean`: adds `target="_blank" rel="noreferrer"`.
  - `onGo?`: in-app navigation. Without it, the link is native.
  - `children`
- **Variants:** `.ui-link`, ui.css:61-77.
  - Padding 0, no border or background, font and colour inherited, `text-align: inherit`, pointer cursor.
- **Interaction states:**
  - Hover: `--ink`, underlined, with decoration colour `--line-strong` at offset 3px.
  - Focus-visible: global ring.
  - Active and visited: not styled.
  - At rest it looks like the surrounding text: no colour change and no underline.
- **Keyboard and screen reader:**
  - A native anchor.
  - There is no "opens in new tab" cue for external links: no icon and no screen-reader text.
- **Phone / touch:** on `pointer: coarse`, `position: relative` plus `::after { inset: -s5 }` extends the hit area by 10px on every side (1240-1252).
- **Content edge cases:** wraps as inline text, with no truncation.
- **Used by:** entity/DecisionPanel, entity/PrPanel, entity/PullRequestBox, entity/SinceSummary.

### List — components/ui/List.tsx

- **Purpose:** rows separated by hairlines. With a label, it becomes a named group of choices.
- **Props:**
  - `label?: string`: renders a `.ui-group` with a visible `span.ui-label` over a `div.ui-list role="group" aria-labelledby`.
  - `children`
- **Variants:** ui.css:272-290.
  - **Contexts**
    - **Default `.ui-list`:** flex column, background `--surface`, 1px `--line` border, radius lg (8), `overflow: hidden`. Siblings are separated by a 1px `--line` top border.
    - **`.ui-group`:** flex column, gap s2 (4), with the label in xs `--ink-3`.
    - **Inside a `.ui-row-body`** (469-478): no background, border or radius, overflow visible; separators become `--line-faint`.
    - **Inside a `.ui-fold`:** a top border only (779-783).
    - **Inside `.ui-sheet-body`** (953-959): pulled to the sheet's edges with `margin-inline: -row-inset`; top and bottom 1px `--line`; no radius or background.
- **Interaction states:** none of its own; rows carry them.
- **Keyboard and screen reader:** a `role="group"` labelled by the label span when labelled, otherwise a plain div. There is no `list` or `listitem` semantics.
- **Phone / touch:** none.
- **Content edge cases:**
  - Many items: no max-height or scroll, so it grows with the page.
  - With no children it renders an empty bordered 2px box; there is no built-in empty state.
  - `overflow: hidden` clips any child that pokes past it, such as an outset focus ring.
- **Used by:** agents/AgentsPage, decisions/BatchPanelView, entity/DecisionOptions, entity/EventList, entity/LinkList, entity/OpenDrift, entity/OwnerBox, entity/PanelForYou, entity/PlanList, entity/PullRequestBox, entity/SinceSummary, entity/TaskFrees, entity/UpdatesSection, feed/FeedList, feed/LogGroup, feed/UnseenLog, home/AtPlaceItems, home/AtSection, home/AtUpNext, home/FirstRun, home/LineForYou, home/NothingNeedsYou, home/QuestionList, home/StartSheetView, home/WaitingSections, home/WorkingLine, home/WorkingSection, lines/NewLineSheet, prs/SyncFailures. Design gallery: LinesGallery, PrimitivesGallery.

### Loaded / StaleNote — components/ui/Loaded.tsx

- **Purpose:** a region that shows LoadingState or ErrorState until its data has loaded once. After that it shows its children, plus a "stale" note when a later refresh fails.
- **Props:**
  - `Loaded`:
    - `loaded: boolean`
    - `error: Error|null`
    - `label: string`: the loading words.
    - `children`
  - `StaleNote`:
    - `error: Error`
- **Variants:** four states.
  - Not loaded and no error: `LoadingState` with "{label}…".
  - Not loaded with an error: `ErrorState`.
  - Loaded with no error: the children.
  - Loaded with an error: `StaleNote`, then the children.
  - StaleNote is `p.ui-note`: sm (13), `--ink-3`, text "Out of date: {message}".
- **Interaction states:** none.
- **Keyboard and screen reader:** StaleNote has `role="status"`, which is polite.
- **Phone / touch:** none.
- **Content edge cases:**
  - The error message wraps normally.
  - The stale note looks exactly like an ordinary quiet note, with no warn colour or icon.
- **Used by:**
  - Loaded: agents/AgentsPage, entity/DecisionPanel, entity/EntityPanel, entity/IssuePanel, entity/LinePanelItem.
  - StaleNote: entity/EntityPanel, entity/IssuePanel, entity/LinePanelItem.

### Markdown — components/ui/Markdown.tsx

- **Purpose:** agent- or developer-written markdown. The renderer is lazy-loaded; the plain text shows until it arrives.
- **Props:**
  - `text: string`
  - `inline?: boolean`: limits output to p, strong, em, del, code and a, unwrapped into a span.
  - `links?: boolean`, default true: when false, `a` is dropped. Used for text inside clickable things.
- **Variants:** the fallback while loading is `p.ui-prose` or a plain `span` with the raw text, including raw `**` and other markdown characters. The final rendering is described under MarkdownView.
- **Interaction states, keyboard and screen reader, phone / touch, content edge cases:** see MarkdownView.
- **Used by:** decisions/DecisionCardView, decisions/HeldDecision, decisions/QuestionOptions, drift/DriftItem, entity/DecisionPanel, entity/EntityBody, entity/IssuePanel, entity/LinePanelHead, entity/PrPanel, entity/SummaryBox, feed/LogGroup, home/DoneWhenChanged, home/ForYouRow, home/HeldQuestion, home/LineProposalCard, home/ProposalCard, home/ProposalCase, home/StepIn, home/TaskCard, home/TaskClosed, home/UpNextRow, home/WorkingLine, design/LinesGallery.

### MarkdownView — components/ui/MarkdownView.tsx

- **Purpose:** the lazy-loaded renderer behind Markdown: react-markdown with GFM and no raw HTML. Links open in a new tab.
- **Props:** the same as Markdown.
- **Variants:** block mode renders `div.ui-prose`; inline mode renders `span.ui-prose-inline`. Prose styles are at ui.css:121-188.
  - **Block (`.ui-prose`)**
    - Colour `--ink-2`, line-height 1.5, `overflow-wrap: anywhere`.
    - The first child has no top margin and the last child no bottom margin.
    - p, ul, ol, pre, blockquote and table have margin-bottom s4 (8).
    - Lists have padding-left s10 (20).
  - **Headings**
    - h1 to h4 are all the same: md (14), semibold, `--ink`, margin s6 0 s2 (12 top, 4 bottom).
    - h5 and h6 are not styled.
  - **Code**
    - Mono, `--text-sm` (13). Note that `.ui-code` elsewhere is xs (12).
    - Inline code has padding 0 s1 (2), background `--surface-2`, radius sm (4).
    - `pre` has padding s4 s5 (8 10), background `--surface-2`, radius md (6), `overflow-x: auto`.
  - **Blockquote**
    - padding-left s5 (10), a 1px `--line-strong` left border, colour `--ink-3`.
  - **Links**
    - `color: inherit`, decoration colour `--line-strong`, offset 3px.
  - **strong**
    - `--ink`, semibold.
  - **Not styled:** tables, th and td, hr, img, li spacing, GFM task-list checkboxes, del, and em beyond browser defaults.
  - **Inline mode** gets only the code, link and strong rules. There is no `.ui-prose-inline` rule for colour or line-height, so it inherits from its parent.
- **Interaction states:**
  - Links have no hover or visited style.
  - Because of the global `a { text-decoration: none }` (styles.css:39-42), and since `.ui-prose a` never re-enables the underline, prose links are neither underlined nor coloured. They cannot be told apart from body text.
  - Link focus is the global ring.
- **Keyboard and screen reader:**
  - Semantic markdown elements.
  - Links have `target="_blank"` with no new-tab cue.
- **Phone / touch:** none. Prose links get no hit-area expansion, unlike `.ui-link`.
- **Content edge cases:**
  - `overflow-wrap: anywhere` breaks long words and URLs.
  - Code blocks scroll horizontally.
  - Wide tables are unstyled and overflow, since nothing sets `overflow-x` on table.
  - Empty text gives an empty div.
- **Used by:** ui/Markdown only, through `lazy()`.

### Menu / MenuGroup / MenuItem / MenuAction / Swatch — components/ui/Menu.tsx

- **Purpose:** a button that opens a short dropdown menu of radio choices or actions.
- **Props:**
  - `Menu`:
    - `label: string`: the trigger's `aria-label`, which states the current choice.
    - `icon?: IconName`: an icon in the trigger.
    - `text?: ReactNode`: words on the trigger, followed by a chevron-down icon; makes it a plain button.
    - `menuLabel: string`: the `aria-label` of the menu, and the trigger's `title` when the trigger is icon-only.
    - `buttonRef?`
    - `lead?: string`: makes the trigger a row lead (`.ui-lead`): a small grey number with no button chrome.
    - `drag?: {onDragStart, onDragEnd}`: makes the trigger draggable.
    - `align?: "start"|"end"`, default end: which edge the list lines up with.
    - `children(close)`
  - `MenuGroup`:
    - `label`: a group heading.
  - `MenuItem`:
    - `checked: boolean`
    - `onSelect`
    - `children`
  - `MenuAction`:
    - `onSelect`
    - `disabled?`
    - `autoFocus?`
    - `children`
  - `Swatch`:
    - `palette: string`: written to `data-palette`.
- **Variants:** ui.css:561-647 and 1132-1152.
  - **Trigger**
    - Icon only: `.ui-button[data-variant=icon]`, a 32x32 square in `--ink-2`.
    - Icon and text: `.ui-button[data-variant=plain]` showing icon, words and a 16px chevron.
    - Lead: `.ui-lead`, which has `min-width: --lead-width` (24), no padding or border, radius sm, inherited font and colour (mono xs `--ink-3` from `.ui-row-lead`), left-aligned text, and `cursor: grab` whether or not `drag` is passed.
  - **`.ui-menu`**
    - `position: relative; display: inline-flex`.
  - **`.ui-menu-list`**
    - Absolute, top `100% + s2` (4px below the trigger), `right: 0`. With `align=start` it is `left: 0`.
    - z 10, flex column, `min-width: 6*control-height` (192), padding s2 (4).
    - Background `--surface`, 1px `--line` border, radius lg (8), `--shadow-popover`.
    - Its own type: `--font`, sm (13), left-aligned.
  - **`.ui-menu-group`**
    - Padding s4 s5 s2 (8 10 4), xs (12), `--ink-3`.
  - **`.ui-menu-item`**
    - Flex, align center, gap s4 (8), min-height 32.
    - Padding 0 s5 0 s3 (6 left, 10 right), no border, radius sm (4).
    - sm (13), `--ink`, nowrap, pointer cursor.
  - **`.ui-menu-check`**
    - Width 16, `--ink-2`, centred. Shows "✓" when checked and is empty otherwise.
    - MenuAction has no check column, so its text starts 24px further left than a MenuItem's text in the same menu.
  - **Swatch**
    - `inline-flex`, gap s1 (2).
    - Two 10px circles (`--space-5`). The first is filled with the palette's `--bg` and has a 1px `--line-strong` border. The second is filled with the palette's `--attention`.
- **Interaction states:**
  - **Trigger**
    - Hover, focus and disabled are as Button.
    - Open (`aria-expanded=true`) is not styled on `.ui-button`; an open icon menu looks the same as a closed one.
    - A lead trigger has hover and open styles: `--ink`, underlined at offset 3px, with the decoration colour inherited (603-608).
    - Lead focus is the global ring.
    - Lead disabled and dragging are not styled.
  - **Menu item**
    - Hover and focus-visible look the same: background `--surface-2` and `outline: none` (633-636). Keyboard focus therefore looks exactly like hover.
    - Active is not styled.
    - Disabled: `--ink-3` with the default cursor (638-641). There is no opacity change, unlike Button's 0.5.
  - **Checked:** only the ✓ glyph in `--ink-2`, with no tint or weight change.
  - **Swatch:** no states.
- **Keyboard and screen reader:**
  - The trigger has `aria-haspopup="menu"` and `aria-expanded`.
  - The list has `role="menu"` with an `aria-label`.
  - MenuItem is `role="menuitemradio"` with `aria-checked`. The checked item is `autoFocus`ed when the menu opens.
  - MenuAction is `role="menuitem"` and is `autoFocus`ed when its prop is set.
  - Keys, from hooks/useMenu.ts:34-48:
    - ArrowDown and ArrowUp cycle through enabled items, wrapping around.
    - Esc closes the menu and returns focus to the trigger, with `stopPropagation`.
    - Home, End, type-ahead and Tab trapping are not handled. Tab moves focus out, which closes the menu.
  - Focus leaving, or a pointerdown outside, closes the menu (useCloseOnOutsideTap).
  - MenuGroup is `aria-hidden`, so groups are not exposed to screen readers: there is no `role="group"` or `aria-labelledby`.
  - The icon trigger's `title` (menuLabel) differs from its `aria-label` (label).
- **Phone / touch:**
  - `pointer: coarse`: menu items are min-height 44 (1233-1237), and `.ui-menu-item:focus-visible { outline: none }` (1265-1267).
  - The lead gets a 10px invisible hit-area extension (1240-1252).
  - The trigger follows Button.
  - The menu text is not `.ui-button-words`, so a text menu such as AtMenu keeps its words on a phone.
- **Content edge cases:**
  - Items are `nowrap`, so long item text widens the menu without limit. It has no max-width and can overflow the viewport, especially with `align=end` near the left edge or `align=start` near the right edge.
  - The list has no max-height and no scroll, so many items run off-screen.
  - A long trigger text such as AtMenu's place name is nowrap with no truncation.
- **Used by:**
  - Menu: entity/LineActions, home/LineHandle (lead + drag + align start), layout/AppearanceMenu, layout/AtMenu (icon + text), layout/PagesMenu.
  - MenuGroup: layout/AppearanceMenu.
  - MenuItem: layout/AppearanceMenu, layout/AtMenu, layout/PagesMenu.
  - MenuAction: entity/LineActions, home/LineHandle.
  - Swatch: layout/AppearanceMenu.

### NotKept — components/ui/NotKept.tsx

- **Purpose:** an inline error saying a draft could not be saved on the server.
- **Props:**
  - `error: string|null`: when null the component renders nothing.
- **Variants:** `p.ui-note[data-error=true]` in sm (13) `--bad`, with the text "Not saved: {error}".
- **Interaction states:** none.
- **Keyboard and screen reader:** `role="alert"`.
- **Phone / touch:** none.
- **Content edge cases:** wraps normally. There is no icon and no retry action.
- **Used by:** entity/IssuePanel, entity/LinePanelItem, entity/UpdatesSection, home/TaskItem.

### Note / Label / Code — components/ui/Note.tsx

- **Purpose:** quiet supporting words, a small grey heading inside an item, and inline monospace.
- **Props:**
  - `Note`:
    - `error?: boolean`: sets `data-error` and `role="alert"`.
    - `children`
  - `Label`:
    - `children`: rendered as `h3.ui-label`.
  - `Code`:
    - `children`: rendered as `code.ui-code`.
- **Variants:**
  - `.ui-note`: margin 0, sm (13), `--ink-3`. The error variant is `--bad` (26-34).
  - `.ui-label`: xs (12), regular weight, `--ink-3`.
  - `.ui-code`: mono, xs (12), with no background (36-40). Prose code is sm on a `--surface-2` background, so the two differ.
- **Interaction states:** none.
- **Keyboard and screen reader:**
  - An error Note has `role="alert"`.
  - Label is an `h3`, so it enters the heading outline.
- **Phone / touch:** none.
- **Content edge cases:**
  - Note wraps normally.
  - Code has no `overflow-wrap`, so a long path or command overflows its line.
- **Used by:**
  - Note: agents/AgentRosterRow, decisions/BatchPanelView, decisions/DecisionCardView, decisions/HeldDecision, decisions/QuestionOptions, drift/DriftItem, entity/EntityCrumbs, entity/IssuePanel, entity/LineActions, entity/LinePanelHead, entity/LinePanelItem, entity/PlanList, entity/PullRequestBox, entity/SinceSummary, feed/LogGroup, feed/UnseenLog, home/AtUpNext, home/DoneWhenChanged, home/FoldPicker, home/HeldQuestion, home/LineProposalCard, home/ProposalCase, home/PushToggle, home/TaskCard, home/TaskClosed, layout/AppShell, lines/TableForm.
  - Label: home/FoldPicker, home/TaskClosed.
  - Code: entity/EntityCrumbs, entity/IssuePanel, entity/LinePanelHead, entity/PlanList.

### Options — components/ui/Options.tsx

- **Purpose:** the answers to a question, one button row each. One press answers. A recommended answer says so, and each answer carries its key number where keys apply.
- **Props:**
  - `options: readonly {key, label, description?, recommended?}[]`
  - `onPick(key)`
  - `firstChoice?: number`, default 1: the number on the first answer.
- **Variants:** ui.css:787-838.
  - **`.ui-options`**
    - Flex column with no gap.
  - **`.ui-option`**
    - A grid with columns `auto minmax(0,1fr)`, column-gap s4 (8).
    - Padding s4 s5 (8 10) with margin 0 -s5, so the text lines up with the surrounding text.
    - No border, radius md (6), no background, inherited font and colour, left-aligned, pointer cursor.
  - **Choice number**
    - `::before` spans 2 rows in column 1. It is visible only with `[data-current=true]` above and a fine pointer.
  - **`.ui-option-label`**
    - Flex, baseline-aligned, gap s4 (8), md (14), medium weight, `--ink`.
  - **`.ui-option-recommended`**
    - The word "recommended" in xs (12), regular weight, `--attention`.
    - The `data-recommended` attribute itself has no rule: no tint, border or weight.
  - **`.ui-option-description`**
    - sm (13), `--ink-3`.
- **Interaction states:**
  - Hover: `--surface-2` (807-809).
  - Focus-visible: global ring.
  - Active, disabled (no prop) and selected or answered: not styled.
  - Loading after a pick: not styled.
- **Keyboard and screen reader:**
  - Native buttons.
  - `aria-label={option.label}` overrides the button's content, so the description and the word "recommended" are never announced.
  - The number keys are handled by the page, not here.
- **Phone / touch:**
  - There is no `pointer: coarse` min-height for `.ui-option`. With no description it is about 8+21+8 = 37px tall, under the 44px target.
  - Numbers are hidden on coarse pointers.
- **Content edge cases:**
  - The label row has no wrap or truncation rule, so long text wraps inside its flex item.
  - Descriptions wrap.
  - Column 1 is an explicit grid track, so even when the number is not drawn, the 8px column gap still applies. Option text therefore sits 8px further right than the text above it whenever numbers are hidden: on every touch device and on every non-current item.
- **Used by:** decisions/QuestionOptions, home/HeldQuestion.

### Page — components/ui/Page.tsx

- **Purpose:** a page under the bar: a title, an aside for page-wide actions such as search, and the content.
- **Props:**
  - `title: string`
  - `hideTitle?: boolean`: makes the h1 screen-reader only.
  - `aside?: ReactNode`
  - `ref?`
  - `children`
- **Variants:** ui.css:651-687.
  - **`.ui-page`**
    - Flex column, gap s16 (32), width 100%.
    - max-width `--page-width-narrow` (900), centred.
    - Padding s14 s10 s32 (28 20 64).
  - **`.ui-page-head`**
    - Flex that wraps, align center, gap s5 by s8 (10 by 16).
  - **`.ui-page-title`**
    - `--text-heading` (20), semibold, letter-spacing -0.01em.
    - It has no line-height rule and inherits 1.5. `.ui-panel-title` uses tight (1.3).
  - **`.ui-page-aside`**
    - Flex, `flex: 1`, align center, `justify-content: flex-end`, gap s4 (8), `min-width: 0`.
  - **Head structure**
    - With `hideTitle` and no aside, there is no header element; only a hidden h1 is rendered.
- **Interaction states:** none.
- **Keyboard and screen reader:** an h1 is always present, visible or hidden.
- **Phone / touch:** on ≤720px, gap s12 (24) and padding s8 s4 s32 (16 8 64). The side gutter is only 8px.
- **Content edge cases:**
  - The head wraps, so the aside drops under a long title.
  - The title has no `overflow-wrap`.
- **Used by:** agents/AgentsPage, feed/FeedPage, home/HomePage.

### Pairs / Columns / Stack — components/ui/Pairs.tsx

- **Purpose:**
  - Pairs: a two-column name/value list.
  - Columns: two columns on a wide screen, stacked on a phone.
  - Stack: a vertical stack with section spacing.
- **Props:**
  - `Pairs`:
    - `pairs: readonly [ReactNode, ReactNode|null|undefined][]`: pairs whose value is null, undefined or "" are dropped.
  - `Columns`:
    - `children`
  - `Stack`:
    - `children`
- **Variants:** ui.css:842-875.
  - **`.ui-pairs`**
    - A `<dl>` grid with columns `max-content minmax(0,1fr)`, gap s3 by s8 (6 by 16), margin 0, sm (13).
    - Each pair is `display: contents`.
    - `dt` is `--ink-3`; `dd` is margin 0, `--ink-2`, `overflow-wrap: anywhere`.
  - **`.ui-columns`**
    - A grid of 2 equal columns, gap s12 (24).
  - **`.ui-stack`**
    - Flex column, gap s6 (12), `min-width: 0`.
- **Interaction states:** none.
- **Keyboard and screen reader:** Pairs uses `dl`, `dt` and `dd`. Columns and Stack are plain divs.
- **Phone / touch:**
  - On ≤720px, Columns becomes one column (1195-1197).
  - Pairs keeps two columns on a phone.
- **Content edge cases:**
  - A long `dt` is max-content and does not wrap, so it squeezes the value column; on a narrow screen it can push the value to near-zero width.
  - Values break anywhere.
  - When every pair is filtered out, an empty `<dl>` remains.
- **Used by:**
  - Pairs: decisions/OwnWords, entity/DecisionPanel, entity/EntityBody, entity/IssuePanel, entity/LinePanelHead, entity/LinePanelItem, entity/PrPanel, home/CheckoutForm, home/KeyHelp, home/LineProposalCard, home/TaskCard.
  - Columns: entity/LinePanelItem.
  - Stack: decisions/OwnWords, entity/DecisionPanel, entity/EntityBody, entity/IssuePanel, entity/LinePanelHead, entity/LinePanelItem, entity/PrPanel, home/CheckoutForm, home/LineProposalCard, home/TaskCard.

### Panel / Side — components/ui/Panel.tsx

- **Purpose:**
  - Side: the fixed container on the right of the screen, full-screen on a phone, where an opened ref is drawn.
  - Panel: its content, with crumbs, a Close button, a title and a body.
- **Props:**
  - `Panel`:
    - `crumbs?: ReactNode`
    - `title?: ReactNode`: an h1.
    - `onClose`
    - `children?`
  - `Side`:
    - `label`: `aria-label`.
    - `ref?`
    - `children`
- **Variants:** ui.css:963-997 and 1155-1170.
  - **`.ui-side`**
    - Fixed to top, right and bottom; z `--z-panel` (20), the same z-index as the bar.
    - Width `min(820, 100%)`, `overflow-y: auto`.
    - Background `--surface`, 1px `--line` left border, `--shadow-panel` (a -12px x-offset, 40px blur, 8% black).
    - There is no scrim.
  - **`.ui-panel`**
    - Flex column, gap s4 (8), padding s8 s12 s32 (16 24 64).
  - **`.ui-panel-head`**
    - Flex, align center, gap s5 (10), margin-right -s5 (-10).
  - **`.ui-panel-crumbs`**
    - `flex: 1`, `min-width: 0`, xs (12), `--ink-3`.
  - **Close**
    - A raw `button.ui-button[data-variant=quiet]` with the text "Close".
  - **`.ui-panel-title`**
    - heading (20), semibold, line-height 1.3, letter-spacing -0.01em.
  - **`.ui-panel-body`**
    - Flex column, gap s14 (28), margin-top s8 (16).
  - **Inside `.ui-panel`**
    - A current Focusable loses its tint (517-520).
- **Interaction states:**
  - Side has `outline: none` on focus (1168-1170).
  - The Close button follows Button's states.
  - There is no open or close transition.
- **Keyboard and screen reader:**
  - Side is an `<aside aria-label tabIndex=-1>`; it is a landmark, not a dialog, and there is no focus trap.
  - The Close button has `aria-label="Close"`, which duplicates its own text.
  - No Esc handling is built in.
- **Phone / touch:** on ≤720px, Panel padding is s5 s8 s32 (10 16 64). Side has no specific rule; it becomes full width through `min(...,100%)`.
- **Content edge cases:**
  - Crumbs wrap, with no truncation.
  - The title has no `overflow-wrap`, so long unbroken titles overflow.
  - When crumbs are undefined, an empty flex:1 div still renders.
  - Long content scrolls inside Side.
- **Used by:**
  - Panel: entity/EntityPanel, entity/IssuePanel, entity/LinePanelHead, layout/AppShell.
  - Side: layout/AppShell.

### RefLink / TextLink — components/ui/RefLink.tsx

- **Purpose:**
  - RefLink: a ref such as D-24 in small monospace that opens the item in the panel.
  - TextLink: ink words that open something, as a button.
- **Props:**
  - `RefLink`:
    - `value: string`: calls `openEntity(value)` from lib/router.
  - `TextLink`:
    - `onClick`
    - `children`
- **Variants:**
  - `.ui-ref` (51-59): mono, xs (12), `--ink-3`, no padding, border or background, pointer cursor.
  - `.ui-link`: as Link above.
- **Interaction states:**
  - Hover for both: `--ink`, underlined in `--line-strong` at offset 3px (71-77).
  - Focus: global ring.
  - Active and visited: not styled.
- **Keyboard and screen reader:**
  - Both are native `<button>`s.
  - A ref is announced as a button with its value, such as "D-24", with no "open" verb.
- **Phone / touch:** on `pointer: coarse`, a 10px hit-area extension through `::after` (1240-1252).
- **Content edge cases:** these are buttons, so they do not break across lines. A long TextLink wraps inside its button, since `.ui-link` has no nowrap.
- **Used by:**
  - RefLink: agents/AgentRosterRow, decisions/BatchPanelView, decisions/DecisionMeta, decisions/QuestionStrip, drift/DriftItem, entity/DecisionPanel, entity/IssuePanel, entity/LinkList, entity/PlanList, entity/TaskFrees, feed/FeedItem, feed/LineLog, home/AnswerStatus, home/ProposalCard, home/QuietRow, home/StartSheetView, home/TaskCard, home/TaskClosed, home/UpNextRow, home/WorkingLine, ui/RefText.
  - TextLink: entity/IssuePanel, feed/FeedItem, feed/LineLog, home/ProposalCard, home/QuietRow, home/UpNextRow, home/WorkingLine.

### RefText — components/ui/RefText.tsx

- **Purpose:** plain text in which every ref is a RefLink. Refs match `[A-Z][A-Z0-9]{1,5}-\d+` or `[DMIU]-\d+` (lib/format.ts:145-157).
- **Props:**
  - `text: string`
- **Variants:** the surrounding text inherits its context; refs are styled as `.ui-ref`, mono xs `--ink-3`. A ref in the middle of 14px text therefore drops to 12px grey mono.
- **Interaction states:** as RefLink.
- **Keyboard and screen reader:** every ref is its own Tab stop.
- **Phone / touch:** as RefLink.
- **Content edge cases:** text with many refs creates many buttons. Text without refs renders as plain text.
- **Used by:** decisions/HeldDecision, drift/DriftItem, entity/EventList, entity/UpdatesSection, feed/FeedItem, feed/LogRow, design/StatusGallery.

### Row — components/ui/Row.tsx

- **Purpose:** the one shape of every list entry: optional lead, kind with a dot, title, facts, note, a trailing chevron, check or actions, and a body underneath. It can open, toggle or be static.
- **Props:**
  - `title: ReactNode`
  - `kind?`: small text with a dot.
  - `tone?: "needs"|"stuck"|"none"`, default "needs": the dot is `--attention`, `--warn` or `--line-strong`.
  - `facts?`: inline after the title.
  - `note?`: a quiet line under the title.
  - `lead?`: a narrow first column, such as a number or a Menu lead.
  - `wideLead?`: sets `data-lead=wide`, making the lead 48px instead of 24px.
  - `quiet?`: sets `data-quiet`, making the title regular weight in `--ink-2`.
  - `trailing?`: content at the end of the row.
  - `children?`: the body.
  - `label?`: renders `<article aria-label>` instead of a `<div>`.
  - `openLabel?`: the open button's `aria-label`; the row text becomes its `aria-describedby`.
  - `current?`: sets `data-current` and `aria-current`.
  - `focusRef?`: sets `data-focus-ref` and `tabIndex=-1`.
  - `drop?`: drag-over and drop handlers.
  - Mutually exclusive:
    - `onOpen()`: the row opens. The text becomes `button.ui-row-open` and a chevron is added.
    - `checked` + `onToggle()`: the row is a choice. It becomes a `<label>` with a hidden checkbox and a ✓.
    - Neither: a static row.
- **Variants:** ui.css:292-488 and 1199-1207.
  - **`.ui-row`**
    - `--lead: 24px` (48px when wide), `position: relative`, `min-width: 0`.
  - **`.ui-row-head`**
    - Flex, baseline-aligned, gap s5 (10), padding s6 `--row-inset` (12px 16px).
  - **`.ui-row-lead`**
    - `flex: none`, width `--lead`, mono, xs (12), `--ink-3`.
  - **`.ui-row-text`**
    - Flex column, `flex: 1`, gap s1 (2), `min-width: 0`.
  - **`.ui-row-kind`**
    - `inline-flex`, gap s3 (6), xs (12), `--ink-3`, with a 6px pill dot by tone.
  - **`.ui-row-line`**
    - No CSS: the title and facts flow inline.
  - **`.ui-row-title`**
    - md (14), medium weight, `--ink`, `overflow-wrap: anywhere`.
    - Quiet rows use regular weight in `--ink-2`.
  - **`.ui-row-facts`**
    - margin-left s5 (10).
  - **`.ui-row-note`**
    - sm (13), `--ink-3`.
  - **`.ui-row-chevron`**
    - The glyph "›" in `--ink-3`, `flex: none`. It is a text glyph, not the SVG chevron that Menu uses.
  - **`.ui-row-trailing`**
    - Relative, flex, align center, gap s2 (4), aligned to the vertical centre, margin-right -s4 (-8).
  - **`.ui-row-check`**
    - min-width 16, `--accent`, semibold, centred. Shows "✓" when checked, empty otherwise.
  - **`.ui-row-input`**
    - Visually hidden: absolute 1x1, opacity 0.
  - **Open**
    - `.ui-row-open` is unstyled and `flex: 1`.
    - Its `::after { position: absolute; inset: 0 }` stretches the click target over the whole head, because the head is `position: relative` when `data-action` is open or toggle.
  - **`.ui-row-body`**
    - Flex column, gap s6 (12).
    - Padding `0 row-inset s7 body-inset` (0 16 14 16).
    - With a lead, `--body-inset` becomes `row-inset + lead + s5` (16+24+10 = 50, or 74 with a wide lead), so the body lines up with the title.
  - **Nested rows (a row inside a row body)**
    - Head padding-inline 0 and padding-block s4 (8).
    - A nested body has no left or right padding.
    - A nested list has no box and `--line-faint` separators.
- **Interaction states:**
  - **Hover:** a head with `data-action` open or toggle gets `--surface-2` (361-363). A static row has no hover.
  - **Current:** the whole row gets `--accent-soft` (302-305). On a current row, hover is suppressed (`background: none`, 365-367).
  - **Focus**
    - The row element (`tabIndex=-1` via focusRef) has `outline: none` (307-310); the visible indicator is only the `data-current` tint.
    - The open button gets the global ring, around the text span only, not the whole row.
    - A toggle row's checkbox focus-visible draws a 2px `--accent` outline inset on the whole head (`:has`, 450-453).
  - **Active / pressed:** not styled.
  - **Disabled:** no prop and no style.
  - **Checked:** only the ✓ glyph in accent; no tint and no weight change.
  - **Unchecked:** an empty 16px slot with no box drawn, so it is invisible that the row is a choice until something is checked.
  - **Drag-over and dragging:** no styling. The `drop` handlers draw no insertion line.
  - **Open:** a Row has no open state; its chevron never rotates. Only Fold sets `data-open`.
- **Keyboard and screen reader:**
  - The wrapper is a div, or an `article` with `aria-label` when `label` is set; `aria-current="true"` when current.
  - Open rows: a `<button>`, with `aria-label=openLabel` and `aria-describedby` set to the text id.
  - Toggle rows: a native checkbox inside a `<label>`, so Space toggles it.
  - The chevron and check are `aria-hidden`.
  - The kind dot's tone is not announced.
  - The row handles no keys itself.
- **Phone / touch:**
  - On ≤720px:
    - `.ui-row-facts` becomes a block under the title with margin-left 0 (1199-1202).
    - The body inset falls back to `row-inset` even when there is a lead (1205-1207).
  - On coarse pointers, a lead that is a Menu `.ui-lead` gets the 10px hit extension.
  - The row head is about 12+21+12 = 45px tall, which clears 44, but a nested row head at 8px padding is about 37px.
- **Content edge cases:**
  - The title breaks anywhere.
  - Facts wrap inline after the title, or below it on a phone.
  - The note wraps normally and has no `overflow-wrap`.
  - The kind has no wrap rule.
  - Trailing is `flex: none` and never shrinks, so a long title wraps around it.
  - The lead has a fixed width, so a number of 4 or more digits overflows 24px (`.ui-lead` uses min-width and grows; `.ui-row-lead` uses a fixed width).
  - An empty title still leaves the head's padding.
  - `children` that is null, undefined or false skips the body.
- **Used by:** agents/AgentRosterRow, decisions/BatchPanelView, drift/DriftItem, entity/DecisionOptions, entity/EventList, entity/LinkList, entity/OwnerBox, entity/PlanList, entity/PullRequestBox, entity/TaskFrees, entity/UpdatesSection, feed/FeedItem, feed/LogGroup, feed/LogRow, home/AnswerStatus, home/AtSection, home/FirstRun, home/FoldedItems, home/ForYouRow, home/LineForYou, home/LineStepIn, home/MoreForYou, home/NothingNeedsYou, home/ProposalCard, home/QuietRow, home/StartSheetView, home/UpNextRow, home/WorkingLine, lines/NewLineSheet, prs/SyncFailures, design/PrimitivesGallery. ui/Item imports its `Tone` type.
  - wideLead: feed/LogRow.
  - drop: home/WorkingSection, home/WaitingSections, home/HomePage.
  - Toggle (`onToggle`): entity/OwnerBox, lines/NewLineSheet.

### SearchField — components/ui/SearchField.tsx

- **Purpose:** a search box with a dropdown of completions.
- **Props:**
  - `label`: visually hidden, always.
  - `value`
  - `onChange`
  - `placeholder?`
  - `error?: string|null`: shown under the box and sets `aria-invalid`.
  - `completions: readonly {term, hint}[]`
  - `onTake(completion)`
  - `inputRef?`
  - `autoFocus?`
- **Variants:** ui.css:1323-1398.
  - **`.ui-search`**
    - Relative, flex column, `flex: 1`, gap s2 (4), `min-width: 0`, max-width 320 (`10*control-height`).
  - **`.ui-search-input`**
    - The same as the Field input, duplicated: width 100%, min-height 32, padding 6 10, 1px `--line-strong`, radius md, `--surface`, md (14), `--ink`.
    - It has no explicit `line-height`; the Field input does.
    - `type=search` keeps the browser's native appearance, including WebKit's cancel ✕ and rounded search styling. There is no `appearance: none`.
  - **Error**
    - `span.ui-note[data-error]`: sm `--bad`.
  - **`.ui-search-list`**
    - Absolute, 4px below the box, spanning left to right.
    - z 10, flex column, max-height 320, padding s2 (4), `overflow-y: auto`.
    - Background `--surface`, 1px `--line` border, radius lg (8), `--shadow-popover`.
  - **`.ui-search-option`**
    - Flex, baseline-aligned, gap s4 (8), min-height 32.
    - Padding s2 s4 (4 8), no border, radius sm (4), `--ink`, left-aligned.
    - The term is `code.ui-code`: mono xs (12).
    - The hint is `.ui-search-hint`: xs, `--ink-3`, single line with ellipsis.
- **Interaction states:**
  - **Input**
    - Focus: `outline: none` with an `--accent` border (1349-1352).
    - Hover: not styled.
    - Invalid: no border change. Only the note below turns red; `aria-invalid` has no CSS.
    - Disabled: no prop.
  - **Option**
    - Hover and `aria-selected=true` look the same, `--surface-2` (1386-1389). A keyboard highlight cannot be told apart from a mouse hover.
    - Active: not styled.
  - **List**
    - Open when focused and the list of completions is not empty.
    - There is no "no matches" or loading row.
- **Keyboard and screen reader:**
  - A `<search>` landmark.
  - The input has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` (only while open) and `aria-invalid`.
  - The list has `role="listbox"` and `aria-label`. Each option is a `button role="option" tabIndex=-1 aria-selected`.
  - The input has no `aria-activedescendant` and the options have no ids, so screen readers are not told which completion is highlighted.
  - The error is `role="alert"` but is not linked through `aria-describedby`.
  - Keys:
    - Esc unfocuses and blurs.
    - ArrowDown and ArrowUp cycle, wrapping around.
    - Tab and Enter take the highlighted option, with `preventDefault`. Tab cannot leave the box while the list is open.
  - A pointerdown outside closes the list.
- **Phone / touch:** on `pointer: coarse`, options are min-height 44 and the input text is 16px (1233-1237, 1258-1262).
- **Content edge cases:**
  - Long hints get an ellipsis.
  - The term has no truncation or wrap rule, so a long term pushes the hint out.
  - Many completions scroll inside the 320px max.
  - The box is capped at 320 wide.
- **Used by:** feed/FilterBar.

### Section — components/ui/Section.tsx

- **Purpose:** a named part of a page or panel: its title and count, an aside at the right end, then its content, usually one List.
- **Props:**
  - `title: string`: the h2 and the section's `aria-label`.
  - `count?: number|string`: a number or a floor such as "50+".
  - `aside?: ReactNode`
  - `children`
- **Variants:** ui.css:689-727.
  - **`.ui-section`**
    - Flex column, gap s5 (10), `min-width: 0`.
  - **`.ui-section-head`**
    - Flex, baseline-aligned, gap s5 (10). It has no `flex-wrap`.
  - **h2**
    - Flex, baseline-aligned, gap s4 (8), margin 0, sm (13), semibold, `--ink`.
  - **`.ui-section-count`**
    - sm, regular weight, `--ink-3`, tabular figures.
  - **`.ui-section-aside`**
    - Flex, align center, gap s4 (8), `margin-left: auto`, sm, `--ink-3`.
- **Interaction states:** none of its own.
- **Keyboard and screen reader:** `<section aria-label>` with an h2. The count is inside the h2, so it is announced as part of the heading, as in "Waiting 3".
- **Phone / touch:** none.
- **Content edge cases:**
  - The head does not wrap: a long title and an aside with buttons squeeze each other, and the aside's buttons are nowrap.
  - The title has no `overflow-wrap`.
  - A count of 0 shows.
  - An empty section depends on its children; there is no empty treatment.
- **Used by:** entity/DecisionOptions, entity/EventList, entity/LinkList, entity/OpenDrift, entity/OwnWorkBox, entity/OwnerBox, entity/PanelForYou, entity/PlanList, entity/PullRequestBox, entity/SinceSummary, entity/SummaryBox, entity/TaskFrees, entity/TellBox, entity/UpdatesSection, feed/FeedList, feed/UnseenLog, home/AtUpNext, home/QuestionList, home/WaitingSections, home/WorkingSection, prs/SyncFailures.

### Sheet — components/ui/Sheet.tsx

- **Purpose:** a modal task over the whole page with a dimmed scrim. It is centred on a wide screen and a bottom sheet on a phone.
- **Props:**
  - `title: string`
  - `onClose`
  - `children`
  - `actions?`: rendered in a footer.
  - `numbered?: boolean`: sets `data-current="true"` on the dialog so choice numbers show.
  - `ref?`
- **Variants:** ui.css:900-959 and 1175-1184.
  - **`.ui-sheet-layer`**
    - Fixed, `inset: 0`, z 40, portalled into the body.
  - **`.ui-sheet-scrim`**
    - Absolute fill, `--scrim` (32% black).
  - **`.ui-sheet` on a wide screen**
    - Absolute, left 50%, top 12vh, width `min(480, 100%)`, max-height 76vh, translated -50% on x.
    - Flex column, `--surface`, radius xl (8), `--shadow-sheet`.
  - **`.ui-sheet-head`**
    - Flex, align center, space-between.
    - Padding s5 s5 s3 `row-inset` (10 10 6 16). It has no gap.
    - The h2 is lg (15), semibold, margin 0.
    - Cancel is a quiet Button.
  - **`.ui-sheet-body`**
    - Flex column, gap s8 (16).
    - Padding s3 `row-inset` s8 (6 16 16).
    - `overflow-y: auto`.
  - **`.ui-sheet-foot`**
    - Padding s5 `row-inset` (10 16), 1px `--line` top border. Its content is usually Actions.
  - **Lists in the body**
    - Edge to edge, as described under List.
- **Interaction states:**
  - Open is the only state; it is mounted when open.
  - There is no enter or exit animation, no loading or submitting state, no error slot and no disabled-scrim state.
  - Focus inside the dialog uses each control's own focus style.
- **Keyboard and screen reader:**
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the h2.
  - Esc calls `onClose` with `stopPropagation`.
  - A click on the scrim closes it. The scrim is `aria-hidden`.
  - The primitive has no focus trap and no initial-focus management.
  - Cancel is a real button.
- **Phone / touch:** on ≤720px it is a bottom sheet:
  - `top: auto; bottom: 0; left: 0`, width 100%, max-height 88vh, no transform.
  - Radius 8 8 0 0.
  - padding-bottom `env(safe-area-inset-bottom)`.
  - The Cancel button is 44px tall on coarse pointers.
- **Content edge cases:**
  - A long title has no gap before Cancel and no wrap or truncate rule, so it can run into Cancel.
  - Tall content scrolls inside the body, while the head and foot stay put.
  - A short sheet sizes to its content.
- **Used by:** decisions/BatchPanelView, home/KeyHelp, home/StartSheetView, lines/NewLineSheet, lines/TableForm.

### TextBox — components/ui/TextBox.tsx

- **Purpose:** a growing multi-line Field with its label hidden.
- **Props:**
  - `label`
  - `value`
  - `onChange`
  - `placeholder?`
  - `onSubmit?`: Cmd or Ctrl+Enter.
  - `autoFocus?`
- **Variants and states:** as Field with `multiline` and `hideLabel`.
- **Keyboard and screen reader:** as Field.
- **Phone / touch:** as Field.
- **Content edge cases:** grows without bound, as Field does.
- **Used by:** decisions/OwnWords, entity/OwnWorkBox, entity/TellBox, entity/UpdatesSection, home/LineProposalCard, design/LinesGallery.

### TimeAgo — components/ui/TimeAgo.tsx

- **Purpose:** a compact relative time ("now", "5m", "2h", "3d", or YYYY-MM-DD after 30 days), with the exact ISO time as a tooltip.
- **Props:**
  - `iso: string`
- **Variants:** `.ui-time` (79-84): xs (12), `--ink-3`, tabular figures, nowrap.
- **Interaction states:** not styled. The tooltip is a native `title`.
- **Keyboard and screen reader:** `<time dateTime>`. A screen reader reads "5m" literally; the `title` is not reliably announced.
- **Phone / touch:** none. The `title` tooltip cannot be reached on touch.
- **Content edge cases:** short by construction; nowrap.
- **Used by:** agents/AgentRosterRow, decisions/DecisionMeta, drift/DriftItem, entity/EventList, entity/UpdatesSection, feed/FeedItem.

### Toast / Toasts — components/ui/Toast.tsx

- **Purpose:** choices waiting to take effect, each with Undo, or one that failed. They float over the foot of the screen.
- **Props:**
  - `Toasts`:
    - `children`
  - `Toast`:
    - `failed?: boolean`: sets `data-failed`; the text gets `role=alert`.
    - `actions: ReactNode`
    - `children`
- **Variants:** ui.css:1002-1042.
  - **`.ui-toasts`**
    - Fixed, left 50%, bottom `s10 + safe-area` (20px + inset), z 30.
    - Flex column, gap s3 (6).
    - Width `min(480, 100% - 2*s8)`, so 16px gutters.
    - Translated -50% on x, `pointer-events: none`.
  - **`.ui-toast`**
    - Flex, align center, gap s5 (10).
    - Padding s3 s3 s3 s8 (6 6 6 16).
    - `--surface`, 1px `--line`, radius lg (8), `--shadow-popover`, sm (13), `pointer-events: auto`.
  - **`.ui-toast-text`**
    - `flex: 1`, `min-width: 0`, `--ink-2`.
    - Failed toasts use `--bad`. Only the text changes: no border, background or icon.
  - **`.ui-toast-actions`**
    - Flex, `flex: none`, gap s1 (2).
- **Interaction states:** the toast has none of its own; its buttons follow Button. There is no entering, leaving or auto-dismiss visual, such as a progress bar.
- **Keyboard and screen reader:**
  - Toasts is `role="status" aria-live="polite"`.
  - A failed toast's text is `role="alert"`.
  - No keys are handled; Undo is reached by Tab.
- **Phone / touch:**
  - No media rule. The width shrinks to the screen minus 32px.
  - On coarse pointers, the buttons inside are 44 tall, making the toast about 56px.
- **Content edge cases:**
  - Long text wraps; the actions never shrink.
  - Many toasts stack upward from the bottom with no max-height, so they can cover the screen.
- **Used by:** layout/UndoBar.

### LoadingState / ErrorState / EmptyState — components/ui/states.tsx

- **Purpose:** the loading, error and empty placeholders for any region.
- **Props:**
  - `LoadingState`:
    - `label?`, default "Loading": rendered as "{label}…".
  - `ErrorState`:
    - `error: Error`: shows `error.message`.
  - `EmptyState`:
    - `children`: the words.
    - `command?: string`: shown in a `pre.ui-command`.
- **Variants:** ui.css:879-895 and 36-49.
  - **`.ui-state`**
    - Flex column, gap s5 (10), margin 0, padding s6 0 (12 top and bottom, no horizontal padding).
    - sm (13), `--ink-3`.
    - The error variant is `--bad`.
  - **`.ui-command`**
    - Mono, xs (12), margin 0, padding s4 s5 (8 10).
    - `--surface-2`, radius md (6), `--ink-2`, `overflow-x: auto`.
- **Interaction states:**
  - Not interactive.
  - There is no spinner, skeleton or animation for loading.
  - The error has no retry action.
  - The command has no copy button.
- **Keyboard and screen reader:**
  - LoadingState is `role="status"`.
  - ErrorState is `role="alert"`.
  - EmptyState has no role.
- **Phone / touch:** none.
- **Content edge cases:**
  - Messages wrap.
  - The command scrolls horizontally.
  - Because the state has no horizontal padding, inside a bordered List or Section it sits flush with the section edge, not at `row-inset`.
- **Used by:**
  - The module: App.tsx, agents/AgentsPage, entity/EntityPanel, entity/IssuePanel, entity/LinePanelItem, entity/PullRequestBox, feed/FeedSection, feed/UnseenLog, home/FirstRun, home/HomePage, home/StartSheet, home/StartSheetView, home/WaitingSections, home/WorkingSection, layout/AppShell, layout/PendingChoices, ui/Loaded, design/StatusGallery.
  - LoadingState: App, EntityPanel, PullRequestBox, FeedSection, HomePage, StartSheet, ui/Loaded, StatusGallery.
  - ErrorState: AgentsPage, EntityPanel, IssuePanel, LinePanelItem, PullRequestBox, FeedSection, HomePage, StartSheet, AppShell, PendingChoices, ui/Loaded, StatusGallery.
  - EmptyState: App, AgentsPage, FeedSection, UnseenLog, FirstRun, StartSheetView, WaitingSections, WorkingSection, StatusGallery.

---

## Gaps

### A. Interaction states with no styling

1. **`:active` / pressed.** No rule in ui.css styles a pressed state for any primitive. The only pressed feedback is the touch tap flash in styles.css:24.
2. **Open state of a Menu trigger.** `.ui-button[aria-expanded="true"]` has no rule, so an open icon or text menu looks closed. Only `.ui-lead` styles open (ui.css:603-608).
3. **Row open state.** Row has no expanded or open state; its chevron is static. Only Fold rotates its chevron (ui.css:430-432).
4. **Drag.** There is no drag-over insertion indicator, no dragging-source style, and no drop-target highlight on Row. The `drop` prop is at Row.tsx:34 and 124; ui.css has no rule. `.ui-lead` shows `cursor: grab` even when it is not draggable (ui.css:600).
5. **Checked / unchecked toggle row.** Unchecked shows nothing; checked shows only a ✓ in accent (ui.css:434-440). There is no selected tint and no visible box.
6. **MenuItem checked.** Only a ✓ in `--ink-2` (ui.css:643-647), with no tint.
7. **Recommended option.** `data-recommended` has no rule (Options.tsx:34); only the inline word "recommended" marks it.
8. **Invalid input.** SearchField's `aria-invalid` has no CSS (SearchField.tsx:70), and Field has no error state at all (Field.tsx:4-20).
9. **Hover** is not styled on Field, the search input, a static Row, Badge, Panel crumbs or EmptyState's command.
10. **Visited links:** not styled.
11. **Prose links** are neither underlined nor coloured, because the global `a { text-decoration: none }` (styles.css:39-42) is not undone by `.ui-prose a` (ui.css:177-182). They also have no hover state.
12. **Keyboard focus.**
    - The row and Focusable containers set `outline: none` (ui.css:307-310) and rely on the `data-current` tint.
    - `.ui-side` sets `outline: none` (ui.css:1168-1170).
    - The fold head's global ring is clipped by `.ui-fold { overflow: hidden }` (ui.css:734).
    - `.ui-row-open`'s ring wraps only the text span, not the row it stretches over (ui.css:337-354).
13. **Focus vs hover.**
    - Menu item focus-visible is identical to hover (ui.css:633-636).
    - The search option's keyboard highlight (`aria-selected`) is identical to hover (ui.css:1386-1389).
14. **Windows High Contrast.** No `forced-colors` handling. Field and search focus rely on border colour, and menu focus and row current rely on background, so all of them vanish in High Contrast mode.

### B. Primitives missing disabled, focus, loading or error treatment

- **Disabled exists only on Button** (opacity 0.5, ui.css:241-244), **MenuAction** (`--ink-3` with no opacity, ui.css:638-641) and **Fold held** (cursor only, ui.css:755-757).
  - No disabled treatment on Field, TextBox, LineBox, SearchField, Options, Row (open or toggle), Link, TextLink, RefLink, BarLink or Count.
- **Loading / busy** is missing everywhere except LoadingState's text.
  - None on Button: no `aria-busy`, spinner or pending label.
  - None on Sheet submission, Options after a pick, Field saving, SearchField fetching completions, or Toast.
  - LoadingState has no spinner or skeleton.
- **Error**
  - Field has no error prop; errors are shown separately with NotKept or Note.
  - SearchField's error is not linked through `aria-describedby`.
  - Sheet has no error slot.
  - Options and Row have no error state.
  - A failed Toast colours only its text (ui.css:1034-1036).
  - StaleNote looks identical to a normal note (Loaded.tsx:5-11).
  - ErrorState has no retry action.
- **Empty**
  - List has no empty state; it renders an empty bordered box.
  - SearchField's dropdown has no "no matches" row.
  - Section and Fold show "0" with no empty treatment.
- **Touch targets below 44px with no coarse rule**
  - `.ui-option` (about 37px), the nested row head (about 37px), `.ui-bar-link`, `.ui-count`, and prose links.
  - The coarse rule at ui.css:1233-1252 lists only `.ui-button`, `.ui-menu-item`, `.ui-search-option`, `.ui-link`, `.ui-ref` and `.ui-lead`.
  - Icon+words buttons collapse to 32 wide by 44 tall on a phone (ui.css:1282-1285), while IconButton is 44x44 (ui.css:1254-1256).

### C. Inconsistencies between primitives

1. **Focus treatment.** There are five different focus treatments:
   - The global 2px accent ring at offset +1 (styles.css:59-62).
   - A 1px accent border on Field and search (ui.css:554-557 and 1349-1352).
   - A surface-2 tint on menu items (ui.css:633-636).
   - An inset 2px ring at offset -2 on toggle rows (ui.css:450-453).
   - An accent-soft tint through `data-current` on Row and Focusable (ui.css:302-305).
2. **Selected / highlighted colours.**
   - Row and Focusable current use `--accent-soft` (ui.css:304).
   - Search option selected uses `--surface-2` (ui.css:1388).
   - Menu item focus uses `--surface-2` (ui.css:634).
3. **Check glyph colour.** Row check is `--accent` semibold (ui.css:437-438); menu check is `--ink-2` regular (ui.css:645).
4. **Chevrons.** Row and Fold use a text glyph "›" (Row.tsx:108, Fold.tsx:37); the Menu trigger uses the SVG `chevron` icon (Menu.tsx:62).
5. **Disabled look.** Button uses opacity 0.5 (ui.css:242); MenuAction uses `--ink-3` with no opacity (ui.css:639); a held Fold head has no visual change (ui.css:755-757).
6. **Hover underline colour.** `.ui-link` and `.ui-ref` use a `--line-strong` decoration (ui.css:75); `.ui-lead` hover uses the current colour (ui.css:603-608). `.ui-bar-link` and `.ui-count` hover change colour with no underline (ui.css:1076-1079, 1116-1118).
7. **Pulling optical edges in.**
   - Actions: -s5 (-10) (ui.css:255).
   - Option: -s5 (ui.css:797).
   - Panel head: -s5 (ui.css:974).
   - Row trailing: -s4 (-8) (ui.css:376).
8. **Popover item padding and radius.**
   - Menu item: 0 10 0 6, radius sm (ui.css:621-623).
   - Search option: 4 8, radius sm (ui.css:1376-1378).
   - Option: 8 10, radius md (ui.css:796-799).
   - Menu group label: left padding 10 (ui.css:611), while the item text starts at 6+16+8 = 30 after the check column. A MenuAction's text starts at 6 (Menu.tsx:131-141). Group labels, radio items and actions therefore start at three different x positions in one menu.
9. **Vertical padding of items in a list.**
   - Row head: s6 (12) (ui.css:317).
   - Fold head: s6 (ui.css:742).
   - Focusable in a list: s7 (14) (ui.css:502, 508, 514).
   - Nested row head: s4 (8) (ui.css:482).
   - Row body bottom: s7 (ui.css:461).
10. **Gaps in action rows.**
    - Actions: s2 (4) (ui.css:251).
    - Toast actions: s1 (2) (ui.css:1041).
    - Bar actions: s2 (ui.css:1090).
    - Row trailing: s2 (ui.css:374).
11. **Page vs Panel vs Bar horizontal insets.**
    - Wide screen: page s10 (20) (ui.css:658), panel s12 (24) (ui.css:967), bar s10 (20) (ui.css:1061).
    - Phone: page s4 (8) (ui.css:1188), panel s8 (16) (ui.css:1192), bar 16 left and 8 right (ui.css:1212).
    - Bar max-width is 1180 (ui.css:1058) while the page is 900 (ui.css:656), so the bar's content does not line up with the page's.
12. **Title line-height.** `.ui-page-title` has no line-height and inherits 1.5 (ui.css:668-673). `.ui-panel-title` (ui.css:988) and `.ui-item-title` (ui.css:1311) use tight 1.3. `.ui-sheet-head h2` (ui.css:933-937) and `.ui-section-head h2` (ui.css:703-711) inherit 1.5.
13. **Two input implementations.** `.ui-field :is(input, textarea)` (ui.css:531-557) and `.ui-search-input` (ui.css:1333-1352) duplicate the same box.
    - The search input lacks `line-height: var(--leading-body)` and `resize`.
    - `type=search` keeps native WebKit chrome, with no `appearance: none`.
14. **Code sizes.** `.ui-code` and `.ui-command` are xs (12) with no background (ui.css:36-40). Prose code is sm (13) on a `--surface-2` background (ui.css:151-162).
15. **Tones.** Three separate tone vocabularies:
    - Badge: neutral, good, bad, warn, attention, info (lib/format.ts:111).
    - Row and Item: needs, stuck, none (Row.tsx:4).
    - Fact: strong, stuck (Facts.tsx:19).
    - Badge's `bad` is drawn in `--warn`, not `--bad` (ui.css:92-94).
    - Badge's `attention` and `info` have no rule and are grey (ui.css:86-98).
    - The `--tone`, `--tone-soft` and `--tone-mark` variables in tokens.css:137-181 are never read by ui.css.
16. **"Urgent" and "needs you" colours.** An urgent Count uses a `--warn` dot (ui.css:1127). Row and Item "needs" use an `--attention` dot (ui.css:393). Recommended options use `--attention` text (ui.css:832). tokens.css:32 reserves attention for "this needs you", so urgent counts are drawn in a different colour from other "needs you" marks.
17. **Radius.** `--radius-xl` equals `--radius-lg`, both 8 (tokens.css:85-86). Sheet uses xl while List, Menu, Toast and Fold use lg; there is no visible difference.
18. **Z-index.** `.ui-side` and `.ui-bar` both use `--z-panel` (20) (ui.css:1049 and 1160), so their stacking depends on DOM order.

### D. Content and structure gaps

- **No `overflow-wrap`** on these titles, so long unbroken refs or paths overflow: `.ui-item-title` (ui.css:1307-1313), `.ui-panel-title` (ui.css:984-990), `.ui-page-title` (ui.css:668-673), `.ui-sheet-head h2` (ui.css:933-937), `.ui-section-head h2` (ui.css:703-711) and `.ui-fold-title` (ui.css:759-763). Of the title classes, only `.ui-row-title` has it (ui.css:408).
- **No gap or wrap where text meets a control.**
  - `.ui-sheet-head` has no gap, so a long title runs into Cancel (ui.css:926-931).
  - `.ui-section-head` has no wrap, so a long title squeezes the aside (ui.css:697-701).
- **Unbounded popovers and inputs.**
  - Menu has no max-height or max-width, and its items are nowrap, so it can overflow the viewport (ui.css:566-583, 629).
  - Button is nowrap with no max-width (ui.css:207).
  - The textarea grows without limit (ui.css:545-548, Field.tsx:44-50).
- **Lead column overflow.** `.ui-row-lead` has a fixed width of 24 (ui.css:322), so lead numbers of three or more digits overflow; `.ui-lead` uses min-width and grows (ui.css:592).
- **Facts keeps empty strings.** Facts does not drop `""` children, which then render with a leading "·" (Facts.tsx:5).
- **Option text indent.** With no number drawn, the empty grid column still adds an 8px indent (ui.css:794-795, 811-813).
- **Prose elements not styled:** tables, hr, img, h5, h6 and task-list checkboxes (ui.css:121-188).
- **States have no horizontal padding.** They sit flush with the edge, not at `row-inset` (ui.css:884).

### E. Accessibility gaps

- **Options:** the `aria-label` hides the description and "recommended" from screen readers (Options.tsx:32).
- **SearchField:** no `aria-activedescendant` and no option ids (SearchField.tsx:61-121). Tab is consumed while the list is open (SearchField.tsx:94).
- **Sheet:** no focus trap or initial focus (Sheet.tsx:31-52).
- **Side:** not modal and has no Esc of its own (Panel.tsx:33-46).
- **MenuGroup** is `aria-hidden` and has no `role="group"` (Menu.tsx:81-87). Menu has no Home, End or type-ahead keys (useMenu.ts:34-48).
- **Count** reads its number and words with no separating space (AppBar.tsx:83-84).
- **External links** have no new-tab cue: Link.tsx:24 and MarkdownView.tsx:27-31.
- **TimeAgo:** the exact time is only in `title`, which touch devices and screen readers cannot reliably reach (TimeAgo.tsx:6).
- **Panel Close** has an `aria-label` that duplicates its visible text (Panel.tsx:22).
- **The icon Menu trigger's** `title` (menuLabel) differs from its `aria-label` (Menu.tsx:49-50).

### F. Dead code

- **LineBox** (components/ui/LineBox.tsx) has no importers.
- The `grip` icon (Icon.tsx:24-33) is used nowhere.
