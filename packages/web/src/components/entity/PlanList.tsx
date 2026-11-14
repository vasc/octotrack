import type { LineWork, PlanStep } from "@octotrack/core/schemas";
import { RefLink } from "../ui/RefLink.tsx";

const CHECKS: Readonly<Record<LineWork["prs"][number]["checks"], string>> = {
  none: "",
  pending: "checks running",
  passing: "✓ checks",
  failing: "✗ checks failing",
};

/** The plan: each step done, now or next, with its issues and their pull requests under the step it belongs to. */
export function PlanList({ steps, work }: { steps: readonly PlanStep[]; work: readonly LineWork[] }) {
  const current = steps.find((step) => step.status !== "done")?.position ?? null;
  const unplaced = work.filter((item) => item.step === null);
  return (
    <section className="panel-section" aria-label="Plan">
      <h2 className="panel-label">Plan{current === null ? "" : ` · step ${current} of ${steps.length}`}</h2>
      {steps.length === 0 ? (
        <p className="muted">No plan yet: the owner breaks the line into steps.</p>
      ) : null}
      <ol className="plan-list">
        {steps.map((step) => {
          const now = step.position === current;
          const done = step.status === "done";
          return (
            <li key={step.position} className="plan-step" data-state={done ? "done" : now ? "now" : "next"}>
              <span className="plan-mark" aria-hidden="true">
                {done ? "✓" : now ? "→" : "○"}
              </span>
              <span>
                <span className="plan-title">{step.title}</span>{" "}
                <span className="muted">· {done ? "done" : now ? "now" : "next"}</span>
                <WorkUnder items={work.filter((item) => item.step === step.position)} />
              </span>
            </li>
          );
        })}
      </ol>
      {unplaced.length === 0 ? null : (
        <div className="plan-unplaced">
          <span className="muted">On no step</span>
          <WorkUnder items={unplaced} />
        </div>
      )}
    </section>
  );
}

function WorkUnder({ items }: { items: readonly LineWork[] }) {
  if (items.length === 0) return null;
  return (
    <span className="plan-work">
      {items.map((item) => (
        <span key={item.ref} className="plan-work-item">
          <RefLink value={item.ref} /> {item.title}
          <span className="muted"> · {item.status.replace("_", " ")}</span>
          {item.prs.map((pr) => (
            <span key={pr.ref}>
              {" "}
              · <span className="mono">{`${pr.repo.split("/").at(-1) ?? pr.repo}#${pr.number}`}</span>{" "}
              {pr.state}
              {pr.checks === "none" ? null : (
                <span className="plan-checks" data-checks={pr.checks}>
                  {" "}
                  {CHECKS[pr.checks]}
                </span>
              )}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
