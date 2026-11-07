export const AGENT_GUIDE = `# Octotrack: how to work as an agent

Octotrack is the shared record for one developer and many agents. You write to it through this CLI. The developer
reads a feed and makes decisions. Keep the record true, and ask rather than guess on anything that is theirs to decide.

Set your name once so that your work is attributed and your claims are yours:

  export OCTO_AGENT=claude-feature-x

Output is JSON when piped, text in a terminal. --json and --text force either. Every write returns \`driftOpened\`:
things your change just put out of date. Handle them before moving on.

## The loop

  octo next                          what to do now: drift, your decisions, claimed work, ready issues
  octo issue claim OCT-4             take it, moves it to in_progress
  octo post "what is happening" --on OCT-4 --level progress
  octo issue update OCT-4 --status in_review
  octo drift list                    anything out of date? clear it before stopping

## When you need a decision

Do not guess at architecture or product calls. Ask, with options and your recommendation:

  octo decision ask "Which queue?" -p OCT --kind architecture --priority high \\
    --context "We need at-least-once delivery for ..." \\
    -o sqs="SQS::Managed, more expensive" -o redis="Redis::Already deployed" \\
    --recommend redis --blocks OCT-4 --wait

--wait hangs until it is answered, then prints the outcome. Set your tool's timeout accordingly, or use --timeout 30m
(exit 124 when it runs out; the decision stays open and you can \`octo decision wait D-3\` later).

If you have other work to do in the meantime, do not hang: ask without --wait, keep going, check back.

The developer can answer in their own words instead of picking an option, so read the note as well as the
chosen key. They can also postpone a decision, which only moves it down their queue: it is still open, so keep waiting or
keep working around it.

Log anything decided in conversation instead, so that it is on the record:

  octo decision record "Use SQLite locally" --chosen SQLite -p OCT --kind architecture

## Watching

\`octo watch\` hangs until something happens, then exits 0 and prints it. Exit 124 means timeout.

  octo watch D-3                                      anything touching D-3
  octo watch --until 'ref:D-3 status:decided'         fires at once if it is already true
  octo watch --until-none 'ref:D-3,D-4 status:open'   until both are answered
  octo watch --on 'kind:pr project:OCT to:merged'     a PR in OCT merges
  octo watch --on 'event:decision.*' --on 'checks:failing' --timeout 30m
  octo watch --on 'ref:PR-3 to:passing' --until 'ref:D-3 status:decided' --all
  octo wait PR-7 --status merged                      the simple form
  octo feed -f 'project:OCT -actor:github'            stream instead of stopping at the first match

Prefer --until over --on when waiting for an outcome: --on only sees events after the watch starts. A typo such as
status:opne or a project that does not exist is an error, not a watch that fires at once or never.

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

  decision decided              its project and everything it blocks or affects must be re-checked
  issue closed, PR still open   or the reverse: PR merged, issue still open
  blocked issue, blockers gone  or the reverse: working on something still blocked
  all issues closed             the milestone or project should probably close
  PR checks failing, conflicts, changes requested, PR with no issue
  in progress with no change for two days

Clear it in one of two ways, with a note. There is no third:

  octo drift ack DR-4 --updated "Body now says redis"           you changed it (checked: it must really have changed)
  octo drift ack DR-4 --verified "Project text never mentions the queue"   you looked, nothing needs changing
  octo drift ack --target OCT-4 --verified "..."                everything open on one item, so only when that is true

Drift about state, such as a PR still open, clears by itself once you fix the state, so --updated is refused while it
is still true. --verified says it is correct as it is. With several agents around, take an item first:
octo drift claim DR-4. Use octo next -p OCT to see only one project.

Some drift clears itself when the state becomes consistent. Connect your own work to the network so that you get told:

  octo link add D-3 blocks OCT-4        OCT-4 cannot proceed until D-3 is decided
  octo link add D-3 affects API-2       re-check API-2 when D-3 is decided
  octo link add OCT-9 derived-from D-3  re-check OCT-9 whenever D-3 changes
  octo link add PR-7 implements OCT-4   also automatic when a PR mentions OCT-4

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
