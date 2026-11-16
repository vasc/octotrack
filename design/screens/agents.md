# Agents

The roster of agents and whether this device buzzes. Designed on `Agents.dc.html` (the roster, then states A to D:
every state an agent can be in, no agents yet, loading and failed, Buzz this device in every state), in the canvas at
https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU.

### components/agents/AgentsPage.tsx

- Designed in: Agents.dc.html, the board and states B, C
- What it shows: "Agents" with "1 running · 24 quiet" and Buzz this device; then a table with Agent, Repo, Now and Last seen; quiet agents fold after the first few into "21 more quiet: mediarr, stack, roadtrip, chores and 17 more".
- Changes from today: a summary of how many run; a table with column headings instead of rows of facts; quiet agents fold, while running, stopped and failed ones always show.
- Loading: "Loading agents…".
- Error: "Could not load agents. The tracker did not answer." with Try again (today the raw message). A refresh that fails keeps the roster, marked "As of 14:20; could not refresh." (Primitives). A failed Stop, Lift or Release is said in its row (see AgentRosterRow).
- Empty: "No agent has checked in yet / An agent appears here the first time it runs an octo command with its name." with `export OCTO_AGENT=feature-x`.

### components/agents/AgentRoster.tsx

- Designed in: Agents.dc.html
- What it shows: every agent that may need the developer, then the first three quiet ones, then "21 more quiet: mediarr, stack, roadtrip and 18 more", which shows the rest.
- Changes from today: new; every quiet agent was a row.
- Loading: never loads on its own: given the roster by AgentsPage.
- Error: cannot fail on its own.
- Empty: no agents: AgentsPage says so instead.

### components/agents/AgentRosterRow.tsx

- Designed in: Agents.dc.html, the board and state A
- What it shows: name, repo key, what it is doing now with a glyph, last seen, and its one action. Now reads: "● running, owner of L-59; its line waits on you", "◐ asleep, on its line · wakes by tmux", "○ quiet, still holding L-24", "● idle: nothing to take or scope in its repo", "■ stopped by you at 14:02: “wrong repo”", "■ stopped by Octotrack after 3 writes a line's state forbids", "▲ started for L-46; exits at once (exit 127), retried since today", "▲ ran but never took its line", "✕ gone: its wake failed (tmux: no session “ttube”)".
- Changes from today: every state has a glyph as well as words; the line's role is in the sentence ("owner of L-59"); the wake method is said ("wakes by tmux"); after Stop, Lift or Release the button reads "Stopping…" with Undo below until it takes effect (today it stays live).
- Loading: never loads on its own: given the agent by AgentsPage; "Stopping…" while a choice waits.
- Error: a request that fails follows the Primitives pattern: said in the row, with Try again; a refusal at effect time goes to the Undo bar.
- Empty: never empty: it exists only for an agent.

### components/home/PushToggle.tsx

- Designed in: Agents.dc.html, state D
- What it shows: "Buzz this device", then "Turning on…", then "✓ Buzzing this device · Stop".
- Changes from today: Stop turns buzzing off (today there is no way back); every refusal is said with what to do: "Notifications are blocked for this site. Allow them in the browser's site settings, then press again.", "You dismissed the browser's question; press again to be asked once more.", "This browser cannot buzz. On iPhone, add Octotrack to the home screen first." (today nothing is shown), "This tracker does not send notifications: it has no push key."
- Loading: "Turning on…".
- Error: the sentences above, in place of the button.
- Empty: never empty: it always shows a state, including on a browser that cannot buzz.
