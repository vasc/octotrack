# Agents

The roster of agents and whether this device buzzes. Designed on `Agents.dc.html` (the roster, then states A to D:
every state an agent can be in, no agents yet, loading and failed, Buzz this device in every state), in the canvas at
https://claude.ai/artifact/5K8LVERx26A5pNU1s6PGRU.

### components/agents/AgentsPage.tsx

- Designed in: Agents.dc.html, the board and states B, C
- What it shows: "Agents" with "1 running · 24 quiet" and Buzz this device; then a table with Agent, Repo, Now and Last seen; quiet agents fold after the first few into "21 more quiet: mediarr, stack, roadtrip, chores and 17 more".
- Changes from today: a summary of how many run; a table with column headings instead of rows of facts; quiet agents fold, while running, stopped and failed ones always show.
- Loading: "Loading agents…".
- Error: "Could not load agents. The tracker did not answer." with Try again (today the raw message). A refresh that fails keeps the roster, marked "Could not refresh agents; as of 14:20." with Try again (Primitives). Stop, Lift and Release are said by the Undo bar if they fail (see AgentRosterRow).
- Empty: "No agent has checked in yet / An agent appears here the first time it runs an octo command with its name." with `export OCTO_AGENT=feature-x`.

### components/agents/AgentRoster.tsx

- Designed in: Agents.dc.html
- What it shows: every agent that may need the developer, then the first three quiet ones, then "21 more quiet: mediarr, stack, roadtrip, chores and 17 more", which shows the rest.
- Changes from today: new; every quiet agent was a row.
- Loading: never loads on its own: given the roster by AgentsPage.
- Error: cannot fail on its own.
- Empty: no agents: AgentsPage says so instead.

### components/agents/AgentRosterRow.tsx

- Designed in: Agents.dc.html, the board and state A
- What it shows: a row of the roster's Table: name, repo key, what it is doing now with its mark, last seen ("3h", or "never" for a session that ran no command), and its one action. Now reads: "[dot] running, owner of L-59; its line waits on you", "[half] asleep, owner of L-24 · wakes by tmux", "[ring] quiet, still holding L-24", "[dot] idle: nothing to take or scope in its repo", "[square] stopped by you at 14:02: “wrong repo”", "[square] stopped by Octotrack at 14:02, after 3 writes a line's state forbids", "[triangle] started for L-46; exits at once (exit 127), retried since today", "[triangle] started for L-46; ran but never took its line", "[cross] gone: its wake failed (tmux: no session “ttube”)", "[cross] gone, last owner of L-9". The agent's own note sits under Now.
- Changes from today: a table row under headings, not a row of facts; every state has a mark as well as words, and a failed start is [triangle]; the line's role is in the sentence ("owner of L-59") and the line is its ref alone, as drawn; the wake method is said ("wakes by tmux"); after Stop, Lift or Release the button reads "Stopping…" with Undo below until it takes effect.
- Loading: never loads on its own: given the agent by AgentsPage; "Stopping…" while a choice waits.
- Error: Stop, Lift and Release wait with Undo like every choice; a request the tracker never took, or a refusal when it takes effect, is said in the Undo bar ("Did not happen: …") with Dismiss.
- Empty: never empty: it exists only for an agent.

### components/home/PushToggle.tsx

- Designed in: Agents.dc.html, state D
- What it shows: "Buzz this device", then "Turning on…", then "[check] Buzzing this device · Stop".
- Changes from today: Stop turns buzzing off (today there is no way back); every refusal is said with what to do: "Notifications are blocked for this site. Allow them in the browser's site settings, then press again.", "You dismissed the browser's question; press again to be asked once more.", "This browser cannot buzz. On iPhone, add Octotrack to the home screen first." (today nothing is shown), "This tracker does not send notifications: it has no push key."
- Loading: "Turning on…".
- Error: the sentences above, in place of the button.
- Empty: never empty: it always shows a state, including on a browser that cannot buzz.
