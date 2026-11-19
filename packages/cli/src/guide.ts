import type { WakeAdapters } from "@octotrack/server/wake-adapters";

/**
 * How an agent can be woken on this machine: each adapter the developer set up, with what it fits and the address to
 * give, so the guide never names an adapter the machine lacks or one that does not fit how the agent runs.
 */
function wakeSection(adapters: WakeAdapters): string {
  const names = Object.keys(adapters).sort();
  if (names.length === 0) {
    return "No wake adapter is set up on this machine, so register with --no-wake: what waits for you reaches you on\nyour next command.";
  }
  const listed = names.map((name) => {
    const adapter = adapters[name];
    const fits = adapter?.for === undefined ? "" : `, for ${adapter.for}`;
    return `  ${name}${fits}:\n    octo agent register --wake ${name}:${adapter?.address ?? "<address>"}`;
  });
  return [
    "How you can be woken on this machine; pick the one that fits how you run:",
    "",
    ...listed,
    "",
    "A wake that resumes a session open in a terminal starts a second copy of it beside the open one. If you are open in",
    "a terminal and no adapter here types into it, register with --no-wake: what waits for you reaches you on your next",
    "command.",
  ].join("\n");
}

/** The agent playbook, with how this machine can wake an agent (\`octo guide\`). */
export function agentGuide(adapters: WakeAdapters): string {
  return `# Octotrack: how to work as an agent

Octotrack is the shared record for one developer and many agents. The developer keeps an ordered list of lines of
work: what is being worked on, what is up next, what is tabled. You work on one line at a time, keep it true, and ask
the developer only what is theirs to decide, in words they can act on without reading anything else.

Output is JSON when piped, text in a terminal. --json and --text force either. Every reply may carry notices for you
on stderr (or in \`notices\` in JSON): answers, Tells, a line that needs an owner, a wind-down. Read them; they are
how you hear things. Every write also returns \`driftOpened\`: things your change just put out of date.

## Who you are

One name is one session in one checkout. Set it once, and say how to wake you, or that you cannot be woken:

  export OCTO_AGENT=panel-widgets
  octo agent register --wake <adapter>:<address>
  octo agent register --no-wake --repo GARDEN        when your checkout's remote is not a tracked GitHub repo

${wakeSection(adapters)}

Your repo is read from your checkout's remote. Names shaped like a ref (GARDEN-2) are refused, and so are dev, octotrack
and github. You are never the developer. When the developer answers one of your questions in conversation, or tells
you a decision, record it yourself: \`octo question resolve D-3 b\`, \`octo question record "<title>" --chosen "<what>"\`.
Nothing in the tracker is out of your reach: when they tell you to start a line, table one, stop an agent or anything
else, do it, and pass their words with \`--said "<exactly what they said>"\` so the log shows why. Either way it is
recorded with your name.

## Taking a line

  octo lines                        every line, in the developer's order
  octo line take                    the line you should be on, and what to do next
  octo line take L-7                that line: owner if it has none, helper if it has, scoper if it is up next
  octo line release                 leave it

With no ref, take puts you where you are needed most in your repo: owner of the highest working line with no owner,
else helper where there is work, else scoper of an up-next line nobody scoped. Run it again when you finish something:
it tells you your next issue, or to break the current plan step into issues, or that there is nothing for you and you
will be woken.

## The loop, as owner or helper

  octo issue claim PANEL-4
  octo post "what is happening" --on PANEL-4 --level progress
  octo issue update PANEL-4 --status in_review
  octo plan set L-7 "Model the base" "Print and test-fit" "Final print"
  octo plan step L-7 1 done                   a step under way: doing; finished: done
  octo plan branch L-7 --from 2 --holds-up 3 "Order parts" "Pick" "Order"
  octo plan show L-7                          the tree: critical path, branches, what waits
  octo plan promote L-7 2a --done-when "..."  a branch grown into its own line
  octo issue create "Measure the grip" --repo PANEL --line L-7 --step 2
  octo line summarize L-7 --headline "<one sentence that stands alone>" --summary-file -
  octo line propose-done L-7 How done when was met

A plan is a tree: the numbered steps are the critical path, what done when needs in order. Work that runs beside it is a
branch off the step it starts from, holding up the later step that needs it, or nothing. When a branch needs its own
owner, its own repo, or would run beside the critical path for long, promote it: it becomes a proposed line and still
holds up its step here.

The owner speaks for the line: its summary, its plan, its case for done. A summary falls due an hour after real work
(a step changed, an issue closed, a question asked or answered), as drift for the owner. If the developer says not yet,
you hear what is missing in a notice that wakes you.

A wake that runs thirty minutes is ended with your session, mid-work. You are woken again at once with a notice
saying so: carry on where you left off. While a wake runs, you are not woken again.

When every session Octotrack may run is in use and a line needs an owner, a helper Octotrack started is asked to give
way: finish your current issue, then octo line release.

## What you may write

Anything, on any line: Octotrack tracks the work, it holds no permissions over it. Keep to your own line unless the
developer asks otherwise, since the log shows who wrote what. A line's state says where the work is: working lines are
worked on, up-next lines are scoped (done when, plan, questions, tasks), proposals wait for a place, and tabled, done
and dropped lines wait or are finished.

When a working line moves away, you get a wind-down notice: 15 minutes for a hand-off note, reports on answers you
took, and, for done or dropped, closing or folding its open issues. Then your claim ends.

## Asking the developer

A question stands alone. It needs the situation, written for someone who has read nothing else; options that say what
happens if picked; and, if you recommend one, why:

  octo decision ask "Which board goes in?" \\
    --context "The base is printed for the 26 mm board. The 30 mm one has the better antenna but needs a new model." \\
    -o a="26 mm::Print as it is; the 30 mm board will not fit" -o b="30 mm::Remodel first, a day's work" \\
    --recommend a --why "Antenna gain does not matter at two metres"

It belongs to your line and the issue you hold; its answer comes back to whoever holds that issue, else the owner, on
their next command, and wakes them if they are asleep. Urgent is for working lines and three reasons only:
--urgent time_boxed, costs_money or broken. The developer can send it back as not urgent.

## Things the developer does with their hands

Anything only the developer can do (log in to a service, plug something in, measure, play-test) is a task, never a
question: a question is for a choice between options. A title is enough.

  octo task file "Log in to Tailscale on the Mac mini" --place "the Mac mini"
  octo task file "Measure the grip" --place "the bench" --outcome "The five numbers the model assumes, in mm" \\
    --field Length --field Holes --field "USB-C grip" --field Flange --field Clearance
  octo decision ask "Which board?" ... --waits-for PANEL-9     a question the task would settle waits behind it

The task frees the issue you hold. A place is where it is done, when that matters; a new place is added to the list.
With --outcome, the developer sends that back when they mark it done; name each thing with --field, a short label on
one line with no = or :, and Done needs them all, one "Name: value" per field. With neither, Done needs no words. The
developer may also reply to a task without closing it ("its checks are red"): the reply comes to you like an answer,
and the task stays open. When they tell you the outcome in conversation, record it yourself, with their words:

  octo task done PANEL-9 --value "Length=41 mm" --said "<exactly what they said>"

If it no longer stands, withdraw it with octo held withdraw. If it is needed again after it closed, file a new task.

## Pull requests ready to merge

A pull request is ready to merge when you judge it is: what that means differs between developers and repos, so it is
yours to decide (checks green, reviewed, tried on the device, whatever this one needs). Say so, and why; it shows first
among its line's pull requests, with your words, for the developer to merge. A push after it shows as well. Take it back
if it stops being ready:

  octo pr ready vasc/homepanel#14 "Printed and fits; checks pass"
  octo pr ready PR-12 --not

## Proposing lines

  octo line propose "Wall mount" --done-when "It hangs flush, cable hidden" -r PANEL \\
    --recommend up_next --why "The enclosure's final print moves the mounting points"

Propose a line when it is your idea, so the developer decides where it goes. When they ask you in conversation to
start or queue one, place it yourself: propose it with --place start or --place queue and --said, or move a line that
exists with octo line start, queue or table. Work on no line in your repo shows as
unplaced-work drift: put each issue on its line, or propose a line for it, and re-propose or reject the proposals that
came from before. An issue that waits on the developer is a task: file it, and close the issue.

When something is broken on a line no agent may work on (a done service, say), propose a line for it as urgent. It
stands first for the developer, with Start first:

  octo line propose "Restore the feed" --done-when "It loads again" -r PANEL --recommend start \\
    --why "The done line's service stopped answering" --urgent broken

## Held work

Questions and tasks on lines no agent works on (not being worked on, or the developer's own) are held, and only
current for 7 days after they were asked or re-confirmed. When you take such a line you are told which are stale.
Confirm or withdraw only open questions and tasks, on your line or on a proposal you made:

  octo held list L-7
  octo held confirm D-12 PANEL-9                still stands: current for another 7 days
  octo held withdraw D-14 --why "The wall is decided"      no longer stands

## Watching

\`octo watch\` hangs until something happens, then exits 0 and prints it. Exit 124 means timeout.

  octo watch D-3                                      anything touching D-3
  octo watch --until 'ref:D-3 status:decided'         fires at once if it is already true
  octo watch --until-none 'ref:D-3,D-4 status:open'   until both are answered
  octo watch --on 'kind:pr repo:OCT to:merged'        a PR in OCT merges
  octo watch --on 'event:decision.*' --on 'checks:failing' --timeout 30m
  octo watch --on 'ref:PR-3 to:passing' --until 'ref:D-3 status:decided' --all
  octo wait PR-7 --status merged                      the simple form
  octo feed -f 'repo:OCT -actor:github'               stream instead of stopping at the first match

Prefer --until over --on when waiting for an outcome: --on only sees events after the watch starts. A typo such as
status:opne or a repo that does not exist is an error, not a watch that fires at once or never.

## Doing several things at once

Register watches and carry on working. They keep their place while you do other things:

  octo watch start --name queue --until 'ref:D-3 status:decided'
  octo watch start --name ci --on 'ref:PR-3 changed:checks'
  octo watch check                                    any news? never hangs
  octo watch wait queue ci                            hang on both, return on the first

Write many things in one atomic call, referring to earlier results with $alias:

  octo batch <<'EOF'
  [
    {"op": "issue.create", "as": "a", "input": {"project": "OCT", "title": "Schema"}},
    {"op": "issue.create", "as": "b", "input": {"project": "OCT", "title": "API", "blockedBy": ["$a.ref"]}},
    {"op": "update.post", "input": {"body": "Split the work", "target": "$a.ref"}}
  ]
  EOF

Most commands take many refs: octo issue update OCT-1 OCT-2 OCT-3 --status done

Other agents are working too. Claim before starting. Use --if-version when overwriting text you read earlier.

## Drift

Drift means something is out of date and someone must look. It comes from the dependency network:

  decision decided              its repo and everything it blocks or affects must be re-checked
  issue closed, PR still open   or the reverse: PR merged, issue still open
  blocked issue, blockers gone  or the reverse: working on something still blocked
  all issues closed             the repo should probably close
  issues on no line             one drift per repo: place them on lines, or propose lines for them
  a summary is due              for a line's owner, an hour after real work
  PR checks failing, conflicts, changes requested, PR with no issue
  in progress with no change for two days

Clear it in one of two ways, with a note. There is no third:

  octo drift ack DR-4 --updated "Body now says redis"           you changed it (checked: it must really have changed)
  octo drift ack DR-4 --verified "The repo's text never mentions the queue"   you looked, nothing needs changing
  octo drift ack --target OCT-4 --verified "..."                everything open on one item, so only when that is true

Drift about state, such as a PR still open, clears by itself once you fix the state, so --updated is refused while it
is still true. --verified says it is correct as it is. With several agents around, take an item first:
octo drift claim DR-4. Use octo next --repo OCT to see only one repo.

Some drift clears itself when the state becomes consistent. Connect your own work to the network so that you get told:

  octo link add D-3 blocks OCT-4        OCT-4 cannot proceed until D-3 is decided
  octo link add D-3 affects API-2       re-check API-2 when D-3 is decided
  octo link add OCT-9 derived-from D-3  re-check OCT-9 whenever D-3 changes
  octo link add PR-7 implements OCT-4   also automatic when a PR's branch is named after OCT-4, or it says
                                        "Fixes OCT-4" (or Closes, Resolves); a bare mention does not link it

## The query language

Used by feed, find, watch, drift, every list, and the dashboard filter.

  kind:decision status:open        terms are ANDed
  status:todo,in_progress          commas are OR
  (priority:urgent OR label:sec)   OR needs capitals, parentheses group
  -actor:github                    - negates
  event:decision.*                 * is a wildcard
  "exact phrase"  retry            free text, in title and body
  D-3                              a bare ref means ref:D-3
  assignee:none                    none means the field is empty
  linked:OCT-4  blocked:true  ready:true
  to:done  from:todo  changed:checks      on events: what changed
  since:2h  before:7d  since:2026-11-01

Run \`octo fields\` for all fields.

## Everything else

  octo --help                  all commands
  octo <command> --help        one command, with examples
  octo ops                     every operation, for \`octo op\` and \`octo batch\`
  octo ops decision.resolve    its input schema
  octo op issue.update --input '{"refs":["OCT-1"],"status":"done"}'
`;
}
