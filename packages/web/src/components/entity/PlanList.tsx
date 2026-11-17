import { currentStep, type Line, type LineWork, type PlanStep } from "@octotrack/core/schemas";
import type { PlanStatus } from "../../hooks/usePlanStatus.ts";
import { humanize } from "../../lib/format.ts";
import { Fact, Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { Mark } from "../ui/Badge.tsx";
import { Icon } from "../ui/Icon.tsx";
import { StepStatusMenu } from "./StepStatusMenu.tsx";

type Pr = LineWork["prs"][number];

/** A pull request's checks in a word or two; failing ones in the warm tone, since they hold the work up. */
function ChecksWord({ checks }: { checks: Pr["checks"] }) {
  if (checks === "failing")
    return (
      <Fact tone="stuck">
        <Mark tone="bad" icon="cross" />
        checks failing
      </Fact>
    );
  if (checks === "passing") return <Mark tone="good" icon="check" />;
  if (checks === "pending") return "checks running";
  return null;
}

/** An issue's state in words: "to do", "in progress". */
function statusWords(status: LineWork["status"]): string {
  return status === "todo" ? "to do" : humanize(status);
}

/** One pull request by its number, its state and its checks: "#418 open · checks failing", the last after a cross. */
function PrFact({ pr }: { pr: Pr }) {
  return (
    <>
      #{pr.number} {pr.state}
      {pr.checks === "none" ? null : (
        <>
          {" · "}
          <ChecksWord checks={pr.checks} />
        </>
      )}
    </>
  );
}

/**
 * The plan: each step done, now or next, with its issues and their pull requests under the step it belongs to. On a
 * line that has not ended, each step ends in a menu that sets it to do, under way or done.
 */
export function PlanList({
  steps,
  work,
  state = "working",
  foldMerged = false,
  status,
}: {
  steps: readonly PlanStep[];
  work: readonly LineWork[];
  /** How the line stands, which says who writes its plan and when. */
  state?: Line["state"];
  /** On a phone, several merged pull requests fold to one fact so the open work stands out. */
  foldMerged?: boolean;
  /** Setting a step's status; without it, or once the line has ended, each step only says how it stands. */
  status?: Pick<PlanStatus, "onStatus"> & Partial<Pick<PlanStatus, "busy" | "failed">>;
}) {
  const current = currentStep(steps)?.position ?? null;
  const settable = status !== undefined && state !== "done" && state !== "dropped";
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
                lead={<Icon name={done ? "check" : now ? "arrow" : "ring"} />}
                title={step.title}
                // With its menu, the step's status is the menu's words, so only now is said beside the title.
                facts={now ? <Fact tone="strong">now</Fact> : settable ? undefined : done ? "done" : "next"}
                trailing={
                  settable ? (
                    <StepStatusMenu
                      step={step}
                      onStatus={(next) => status.onStatus(step.position, next)}
                      busy={status.busy === step.position}
                      failed={status.failed?.step === step.position ? status.failed.message : undefined}
                    />
                  ) : undefined
                }
              >
                {under.length === 0 ? null : <WorkList items={under} foldMerged={foldMerged} />}
              </Row>
            );
          })}
          {unplaced.length === 0 ? null : (
            <Row title="Not on a step yet">
              <WorkList items={unplaced} foldMerged={foldMerged} />
            </Row>
          )}
        </List>
      )}
    </Section>
  );
}

/**
 * The issues under a step, one row each: its ref and state, then its pull requests; on a phone several merged ones fold
 * to one fact, "4 pull requests merged" and a check, so the open work stands out.
 */
function WorkList({ items, foldMerged }: { items: readonly LineWork[]; foldMerged: boolean }) {
  return (
    <List>
      {items.map((item) => {
        const merged = item.prs.filter((pr) => pr.state === "merged");
        const folded = foldMerged && merged.length > 1;
        const shown = folded ? item.prs.filter((pr) => pr.state !== "merged") : item.prs;
        return (
          <Row
            key={item.ref}
            title={item.title}
            facts={
              <Facts>
                <RefLink value={item.ref} />
                {statusWords(item.status)}
                {shown.map((pr) => (
                  <PrFact key={pr.ref} pr={pr} />
                ))}
                {folded ? (
                  <>
                    {`${merged.length} pull requests merged`}
                    <Mark tone="good" icon="check" />
                  </>
                ) : (
                  ""
                )}
              </Facts>
            }
          />
        );
      })}
    </List>
  );
}
