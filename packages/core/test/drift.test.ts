import { beforeEach, describe, expect, test } from "bun:test";
import { contracts as c } from "../src/contracts.ts";
import { type Harness, harness } from "./helpers.ts";

let h: Harness;

function openDrift(query = ""): { ref: string; rule: string; target: string }[] {
  return h.call(c.driftList, { query }).map(({ ref, rule, target }) => ({ ref, rule, target }));
}

function rules(): string[] {
  return openDrift().map((drift) => drift.rule);
}

function pr(number: number, state: "open" | "merged" | "closed" | "draft", issues: string[] = []) {
  return h.call(c.prUpsert, { repo: "acme/app", number, title: `PR ${number}`, state, issues });
}

beforeEach(() => {
  h = harness();
  h.call(c.projectCreate, { key: "OCT", name: "Octotrack", repo: "acme/app" });
});

describe("drift from pull requests and issues", () => {
  test("closing an issue while its PR is open flags the PR, and merging clears it", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Do the thing" });
    const created = pr(1, "open", [issue.ref]);
    expect(rules()).toEqual([]);

    h.call(c.issueUpdate, { refs: [issue.ref], status: "done" });
    expect(openDrift()).toContainEqual(
      expect.objectContaining({ rule: "issue-closed-pr-open", target: created.ref }),
    );

    pr(1, "merged", [issue.ref]);
    expect(rules()).not.toContain("issue-closed-pr-open");
    const resolved = h.call(c.driftList, { query: "status:auto_resolved rule:issue-closed-pr-open" });
    expect(resolved).toHaveLength(1);
  });

  test("merging a PR flags an issue that is still open", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Do the thing", status: "in_progress" });
    pr(1, "merged", [issue.ref]);
    expect(rules()).toEqual(["pr-merged-issue-open"]);
    h.call(c.issueUpdate, { refs: [issue.ref], status: "done" });
    expect(rules()).toEqual(["project-work-complete"]);
  });

  test("a PR closed without merging flags an in-review issue, unless another PR is live", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing", status: "in_review" });
    pr(1, "closed", [issue.ref]);
    expect(rules()).toContain("pr-closed-issue-in-review");
    pr(2, "open", [issue.ref]);
    expect(rules()).not.toContain("pr-closed-issue-in-review");
  });

  test("PR refs in titles and branches link automatically", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const created = h.call(c.prUpsert, {
      repo: "acme/app",
      number: 9,
      title: `Fix ${issue.ref.toLowerCase()}`,
      state: "open",
      body: "Mentions UTF-8 which is not an issue",
    });
    expect(h.call(c.linkList, { ref: created.ref }).map((link) => link.toRef)).toEqual([issue.ref]);
    expect(rules()).not.toContain("pr-without-issue");
  });

  test("failing checks flag the PR, clear when passing, and return on a new commit after attestation", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const base = { repo: "acme/app", number: 1, title: "PR", state: "open" as const, issues: [issue.ref] };
    h.call(c.prUpsert, { ...base, checks: "failing", headSha: "aaa" });
    expect(rules()).toContain("pr-checks-failing");

    h.call(c.driftAck, { target: "PR-1", mode: "verified", note: "flaky, known" });
    expect(rules()).not.toContain("pr-checks-failing");

    // Same commit, same failure: the attestation stands.
    h.call(c.prUpsert, { ...base, checks: "failing", headSha: "aaa", title: "PR renamed" });
    expect(rules()).not.toContain("pr-checks-failing");

    // A new commit that fails is a new situation.
    h.call(c.prUpsert, { ...base, checks: "failing", headSha: "bbb" });
    expect(rules()).toContain("pr-checks-failing");

    h.call(c.prUpsert, { ...base, checks: "passing", headSha: "bbb" });
    expect(rules()).not.toContain("pr-checks-failing");
  });
});

describe("drift from decisions", () => {
  test("a decision flags its project and everything it affects, and needs an explicit answer", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Build on the database" });
    const decision = h.call(c.decisionAsk, {
      title: "Which database?",
      project: "OCT",
      options: [{ key: "pg", label: "Postgres" }],
      affects: [issue.ref],
    });
    expect(rules()).toEqual([]);

    h.call(c.decisionResolve, { ref: decision.ref, option: "pg" });
    const open = openDrift();
    expect(open.map((drift) => drift.target).sort()).toEqual([issue.ref, "OCT"].sort());
    expect(open.map((drift) => drift.rule).sort()).toEqual(["decision-outcome", "decision-project-sync"]);

    // Editing the issue does not clear it: edge drift waits for a deliberate answer.
    h.call(c.issueUpdate, { refs: [issue.ref], body: "Use postgres" });
    expect(openDrift()).toHaveLength(2);

    h.call(c.driftAck, { target: issue.ref, mode: "updated", note: "body now says postgres" });
    h.call(c.driftAck, { target: "OCT", mode: "verified", note: "project description unaffected" });
    expect(openDrift()).toEqual([]);

    const history = h.call(c.driftList, { query: "status:updated,verified" });
    expect(history.map((drift) => drift.note).sort()).toEqual([
      "body now says postgres",
      "project description unaffected",
    ]);
  });

  test("claiming updated without changing anything is refused", () => {
    const decision = h.call(c.decisionAsk, { title: "Q", project: "OCT" });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    expect(() => h.call(c.driftAck, { target: "OCT", mode: "updated", note: "done" })).toThrow(
      "has not changed",
    );
    h.call(c.updatePost, { body: "Recorded the outcome", target: "OCT" });
    expect(h.call(c.driftAck, { target: "OCT", mode: "updated", note: "posted" }).acknowledged).toHaveLength(
      1,
    );
  });

  test("changing an outcome flags things again", () => {
    const decision = h.call(c.decisionAsk, {
      title: "Q",
      project: "OCT",
      options: [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
    });
    h.call(c.decisionResolve, { ref: decision.ref, option: "a" });
    h.call(c.driftAck, { target: "OCT", mode: "verified", note: "fine" });
    expect(openDrift()).toEqual([]);
    h.call(c.decisionResolve, { ref: decision.ref, option: "b", force: true });
    expect(rules()).toEqual(["decision-project-sync"]);
  });

  test("removing the link clears link-derived drift", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    const decision = h.call(c.decisionAsk, { title: "Q", affects: [issue.ref] });
    h.call(c.decisionResolve, { ref: decision.ref, note: "Yes" });
    expect(rules()).toEqual(["decision-outcome"]);
    h.call(c.linkRemove, { from: decision.ref, rel: "affects", to: issue.ref });
    expect(rules()).toEqual([]);
  });

  test("the writer is told what its change put out of date", () => {
    const decision = h.call(c.decisionAsk, { title: "Q", project: "OCT" });
    const outcome = h.tracker.execute(c.decisionResolve.name, { ref: decision.ref, note: "Yes" }, h.as);
    expect(outcome.driftOpened.map((drift) => drift.rule)).toEqual(["decision-project-sync"]);
  });
});

describe("drift from the wider network", () => {
  test("derived_from flags dependents when the source meaningfully changes", () => {
    const spec = h.call(c.issueCreate, { project: "OCT", title: "Spec" });
    const impl = h.call(c.issueCreate, { project: "OCT", title: "Impl", derivedFrom: [spec.ref] });

    h.call(c.issueUpdate, { refs: [spec.ref], priority: "high" });
    expect(rules()).toEqual([]);

    h.call(c.issueUpdate, { refs: [spec.ref], body: "New requirement" });
    expect(openDrift()).toEqual([expect.objectContaining({ rule: "dependency-changed", target: impl.ref })]);

    // A second change while it is still open does not pile up.
    h.call(c.issueUpdate, { refs: [spec.ref], body: "Another requirement" });
    expect(openDrift()).toHaveLength(1);
  });

  test("a blocked issue whose blockers are resolved is flagged", () => {
    const blocker = h.call(c.issueCreate, { project: "OCT", title: "First" });
    const blocked = h.call(c.issueCreate, {
      project: "OCT",
      title: "Second",
      status: "blocked",
      blockedBy: [blocker.ref],
    });
    expect(rules()).toEqual([]);
    h.call(c.issueUpdate, { refs: [blocker.ref], status: "done" });
    expect(openDrift()).toEqual([
      expect.objectContaining({ rule: "blocked-issue-unblocked", target: blocked.ref }),
    ]);
    h.call(c.issueUpdate, { refs: [blocked.ref], status: "todo" });
    expect(rules()).toEqual([]);
  });

  test("an open decision can block work, and starting anyway is flagged", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    h.call(c.decisionAsk, { title: "Q", blocks: [issue.ref] });
    h.call(c.issueUpdate, { refs: [issue.ref], status: "in_progress" });
    expect(rules()).toEqual(["working-while-blocked"]);
  });

  test("a finished milestone and a finished project are flagged", () => {
    const milestone = h.call(c.milestoneCreate, { project: "OCT", title: "v1" });
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing", milestone: milestone.ref });
    h.call(c.issueUpdate, { refs: [issue.ref], status: "done" });
    expect(rules().sort()).toEqual(["milestone-complete", "project-work-complete"]);
    h.call(c.milestoneUpdate, { ref: milestone.ref, status: "done" });
    expect(rules()).toEqual(["project-work-complete"]);
    h.call(c.projectUpdate, { ref: "OCT", status: "done" });
    expect(rules()).toEqual([]);
  });

  test("time based rules fire on a sweep", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing", status: "in_progress" });
    expect(rules()).toEqual([]);
    h.setNow("2026-11-10T12:00:00.000Z");
    h.tracker.sweep();
    expect(openDrift()).toEqual([expect.objectContaining({ rule: "stale-in-progress", target: issue.ref })]);
    h.call(c.issueUpdate, { refs: [issue.ref], body: "still on it" });
    expect(rules()).toEqual([]);
  });

  test("attesting a level rule holds until the situation changes", () => {
    const issue = h.call(c.issueCreate, { project: "OCT", title: "Thing" });
    pr(1, "open", [issue.ref]);
    h.call(c.issueUpdate, { refs: [issue.ref], status: "done" });
    h.call(c.driftAck, {
      refs: openDrift().map((drift) => drift.ref),
      mode: "verified",
      note: "keeping open for now",
    });
    expect(rules()).toEqual([]);
    h.call(c.projectUpdate, { ref: "OCT", description: "Unrelated change" });
    expect(rules()).toEqual([]);
    h.call(c.issueUpdate, { refs: [issue.ref], status: "cancelled" });
    expect(rules()).toEqual(["issue-closed-pr-open"]);
  });
});
