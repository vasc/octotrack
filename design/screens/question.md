# Question

A question is one thing only the developer can answer. Designed on `Main.dc.html` (the question opened under its line,
wide screen, keys on) and `Question-States.dc.html` (states A to L: not focused, urgent, answered with Undo, own words,
could not send, later, no recommendation, no options, held, answered and closed, phone, dark), in the canvas at
https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU. Three zones, always in this order: what is asked, your answer, other
ways out. A hairline separates reading from deciding.

### components/decisions/DecisionCardItem.tsx

- Designed in: Main.dc.html; Question-States.dc.html, states B, C, D, E, G, H, K
- What it shows: DecisionCardView wired to the question's form and keys: `1`–`9` pick, `w` own words, `l` later, `u` undo while it waits.
- Changes from today: no button carries a key hint (the keys are in the Keys sheet; an option's number is its key); while an answer waits, Undo sits inside the card (C), so `u` and the button act on the same thing. "Background" is not drawn on any state.
- Loading: never loads on its own: it is given the question by QuestionList, ForYouItem or DecisionPanel.
- Error: as DecisionCardView: an answer the tracker never took is said in the Undo bar with Dismiss (E).
- Empty: never empty: it exists only for an open question; a question with no options is DecisionCardView's state H.

### components/decisions/DecisionCardView.tsx

- Designed in: Main.dc.html; Question-States.dc.html, states B, C, D, E, G, H, K, L
- What it shows: QuestionStrip, the question as title, its context; a hairline; "Your answer" over the options; then "In my own words" and "Later" (plus "Not urgent" when urgent).
- Changes from today:
  - A visible "Your answer" label heads the options; with no recommendation it reads "Your answer · roadtrip makes no recommendation" (G).
  - Answered (C): the pick is marked [check], the other options step back, and "Sending to roadtrip in 4 s" with Undo shows in the card, not only in the Undo bar.
  - Phone (K): no key numbers, every target 44 px, options full width; the buttons keep their wide-screen words, so each has one name for a screen reader.
- Loading: never loads on its own: given its question by DecisionCardItem.
- Error: could not send (E): said in the Undo bar, as every choice the tracker never took is: "Did not happen: Sending … The tracker did not answer." with Dismiss (design log, "A choice the tracker never took"). A draft that cannot be saved follows the Primitives pattern: "Not saved: the tracker did not answer. Kept here; saves when it is back." Later, Bring back and Not urgent failures follow the Primitives pattern: said under the actions, with Try again.
- Empty: no options (H): the own-words box is already open with placeholder "Write your answer", and Send and Later under it. No context: the context paragraph is left out.

### components/decisions/QuestionStrip.tsx

- Designed in: Main.dc.html; Question-States.dc.html, states B, C, F, I, J
- What it shows: kind, ref, who asked, age: "Question · D-65 · asked by roadtrip · 2d"; urgent: "Urgent · something broken · L-59 Home worker · D-75 · asked by ttube · 3h".
- Changes from today: the age is always drawn at the end (`2d`, `3h`); urgent keeps "asked by" (today it is dropped); the kind word carries the state: "Later · D-65 · put off 1h ago" (F). A held or answered question is not a card, so "Held · D-65" (I) and "Answered · D-20 · by you on the dashboard · 7 Nov" (J) are DecisionMeta's. The kind word is in the attention colour.
- Loading: never loads on its own: given the question by DecisionCardView.
- Error: cannot fail on its own: it only draws facts it is given.
- Empty: never empty: every question has a kind and a ref.

### components/decisions/QuestionOptions.tsx

- Designed in: Main.dc.html; Question-States.dc.html, states B, C, G, K, L; Primitives.dc.html, Choice
- What it shows: one option per row: its number on the label's baseline at the label's size, the label, then the description.
- Changes from today: the recommended option says "Recommended" (capital, beside the label) and its reason lives inside it as "Why: …", not in a note under the list. Each option is a real control with hover, focus, chosen ([check]) and stepped-back states (Primitives Choice). With no recommendation nothing is marked and the label above says so (G).
- Loading: never loads on its own: given the options by DecisionCardView.
- Error: cannot fail on its own: a failed send is shown by DecisionCardView (E).
- Empty: no options renders nothing; DecisionCardView then opens the own-words box (H).

### components/decisions/OwnWords.tsx

- Designed in: Question-States.dc.html, states D, H
- What it shows: label "Your answer, in your own words", the box, "Saved as you type, on every device" beside it, then "Send" and "Back to the options".
- Changes from today: visible label instead of a hidden one; the saving note is shown; "Cancel" becomes "Back to the options" and keeps the draft (today it clears it); Cmd+Enter sends, as the Keys sheet says; no hint is on Send. With no options (H) the placeholder is "Write your answer" and the buttons are Send and Later.
- Loading: the draft is fetched from the tracker; while it loads the box follows the Primitives pattern: the box stays usable and is not cleared when the draft arrives.
- Error: a draft not saved follows the Primitives pattern: "Not saved: the tracker did not answer. Kept here; saves when it is back." under the box. A send that fails is DecisionCardView's state E.
- Empty: Send is off while the box is empty.

### components/decisions/HeldDecision.tsx

- Designed in: Question-States.dc.html, state I
- What it shows: "Held · D-65 · asked by roadtrip · 9d", the title, then "Held until L-24 New Year trip starts. It is proposed; start it to answer this." then Open L-24 and Withdraw.
- Changes from today: the reason is a sentence naming the line, its state and what to do (today "held until its line starts" or "not in your queue"); "Open L-24" is a new action; the read-only options list and why are not drawn on the held state.
- Loading: never loads on its own: given the question by DecisionPanel.
- Error: cannot fail on its own; a failed Withdraw is DecisionPanel's.
- Empty: never empty: a held question always has a reason it is held.

### components/decisions/DecisionMeta.tsx

- Designed in: Question-States.dc.html, states I, J
- What it shows: the state word, the ref, who asked or who answered and how, and when: "Answered · D-20 · by you on the dashboard · 7 Nov".
- Changes from today: leads with the state word ("Held", "Answered"); kind, priority and project are not drawn; the answered form names who answered and on which channel.
- Loading: never loads on its own: given its question by HeldDecision and DecisionPanel.
- Error: cannot fail on its own: it only draws facts.
- Empty: never empty: every question has a ref and an asker.

### components/entity/DecisionPanel.tsx

- Designed in: Question-States.dc.html, states I, J; Panels.dc.html (panel frame and its G, H, I by reference)
- What it shows: an open question in the queue as DecisionCardView; a held one as HeldDecision (I); a closed one as its strip, the title, "Answer" (the chosen option), "Then" (what became of it), and Change answer (J).
- Changes from today: closed questions show "Then: Picked up by funnel-session; not reported as carried out yet" (pick-up and report are not shown today); the Outcome/Note/Decided by/When/How/Source pairs and the read-only options list give way to "Answer" and "Then"; Withdraw moves into the held state beside Open L-24.
- Loading: follows Line-States G: the panel head shows at once and the body says "Loading the question…".
- Error: follows Line-States H: "Could not load the question. The tracker did not answer." with Try again, in the body. A failed Withdraw or Change answer follows the Primitives pattern: said under its button, with Try again.
- Empty: never empty: a question always has a title; with no options the closed view shows only "Answer" in the developer's own words.

### components/decisions/AnsweredDecision.tsx

- Designed in: Question-States.dc.html, state J
- What it shows: "Answered · D-20 · by you on the dashboard · 7 Nov", "Answer" (the option chosen, or the developer's own words, with any note), "Then" ("Picked up by funnel-session; not reported as carried out yet", "[check] Carried out: …", or "Not picked up yet"), then Change answer.
- Changes from today: new; replaces the Outcome, Note, Decided by, When, How and Source pairs and the read-only options list. What it was superseded by and where it was decided stay, as quiet notes.
- Loading: never loads on its own: given the question by DecisionPanel.
- Error: a failed Change answer is said by the Undo bar.
- Empty: never empty: a closed question always has a state; with no answer recorded only "Then" shows.
### components/home/ForYouRow.tsx

- Designed in: Question-States.dc.html, states A, F; Home.dc.html (Urgent, line 2); Home-States.dc.html, state C
- What it shows: one closed row ending in [forward]: kind, title, then the recommendation. "Question · D-65 / Which South Tyrol base…? / Recommended: Keep the cap in Merano: Hotel Jasmin". Focused, the opened item in its place.
- Changes from today:
  - Urgent rows read "Something broken · on 1 · The home worker fetches new videos again · D-75" (the line's number and title) instead of "Urgent · something broken · D-75".
  - A question put off reads "Later · D-65 · put off 1h ago" with Bring back at the end, and sinks below the rest (F).
  - The note shows the recommendation only, not its why.
  - Task rows read "Task · TRIP-2 · at home" (unchanged).
- Loading: never loads on its own: given its item by its list.
- Error: cannot fail on its own; Bring back waits with Undo like every choice, and one the tracker never took is said in the Undo bar.
- Empty: never empty: it exists only for an item.
