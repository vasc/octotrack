import type { Line, LineWork, PlanStep } from "@octotrack/core/schemas";
import { Fragment } from "react";
import { humanize } from "../../lib/format.ts";
import { Fact, Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Code, Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";

type Checks = LineWork["prs"][number]["checks"];

/** A pull request's checks in a few words; failing ones in the warm tone, since they hold the work up. */
function ChecksWord({ checks }: { checks: Checks }) {
  if (checks === "failing") return <Fact tone="stuck">✗ checks failing</Fact>;
  if (checks === "passing") return "✓ checks";
  if (checks === "pending") return "checks running";
  return null;
}

/** The plan: each step done, now or next, with its issues and their pull requests under the step it belongs to. */
export function PlanList({
  steps,
  work,
  state = "working",
}: {
  steps: readonly PlanStep[];
  work: readonly LineWork[];
  /** How the line stands, which says who writes its plan and when. */
  state?: Line["state"];
}) {
  const current = steps.find((step) => step.status !== "done")?.position ?? null;
  const unplaced = work.filter((item) => item.step === null);
  const aside =
    steps.length === 0
      ? work.length === 0
        ? null
        : `not scoped yet · ${work.length} issue${work.length === 1 ? "" : "s"} already on it`
      : current === null
        ? null
        : `step ${current} of ${steps.length}`;
  return (
    <Section title="Plan" {...(aside === null ? {} : { aside })}>
      {steps.length === 0 && unplaced.length === 0 ? (
        <Note>
          {state === "done" || state === "dropped"
            ? "No plan was written."
            : state === "working"
              ? "No plan yet. Its owner writes one."
              : "No plan yet. Its owner writes one once it starts."}
        </Note>
      ) : (
        <List>
          {steps.map((step) => {
            const done = step.status === "done";
            const now = step.position === current;
            const under = work.filter((item) => item.step === step.position);
            return (
              <Row
                key={step.position}
                lead={done ? "✓" : now ? "→" : "○"}
                title={step.title}
                facts={now ? <Fact tone="strong">now</Fact> : done ? "done" : "next"}
              >
                {under.length === 0 ? null : <WorkList items={under} />}
              </Row>
            );
          })}
          {unplaced.length === 0 ? null : (
            <Row title="Not on a step yet">
              <WorkList items={unplaced} />
            </Row>
          )}
        </List>
      )}
    </Section>
  );
}

/** The issues under a step, one row each: its ref and state, and each of its pull requests with its checks. */
function WorkList({ items }: { items: readonly LineWork[] }) {
  return (
    <List>
      {items.map((item) => (
        <Row
          key={item.ref}
          title={item.title}
          facts={
            <Facts>
              <RefLink value={item.ref} />
              {humanize(item.status)}
              {item.prs.map((pr) => (
                <Fragment key={pr.ref}>
                  <Code>{`${pr.repo.split("/").at(-1) ?? pr.repo}#${pr.number}`}</Code> {pr.state}{" "}
                  <ChecksWord checks={pr.checks} />
                </Fragment>
              ))}
            </Facts>
          }
        />
      ))}
    </List>
  );
}
