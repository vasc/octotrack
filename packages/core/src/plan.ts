/**
 * A line's plan as a tree (D15): the critical path, and branches that fork from a step, may hold up a later one, and
 * may become lines. Pure, so the server and the dashboard read the tree the same way.
 */
import type { LineState, PlanBranch, PlanBranchState, PlanStep, PlanStepStatus } from "./schemas.ts";

interface StepLike {
  id: number;
  branch: number | null;
  position: number;
  status: PlanStepStatus;
}

interface BranchLike {
  id: number;
  fromStep: number;
  position: number;
}

/** A branch's letter by its place among the branches off one step: a to z, then aa, ab and on. */
export function branchLetter(place: number): string {
  let rest = place;
  let letters = "";
  while (rest > 0) {
    const index = (rest - 1) % 26;
    letters = String.fromCharCode(97 + index) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
}

/** Where everything sits: each step's and branch's address, each step's sequence, and the steps in tree order. */
export interface PlanLayout {
  stepAddress: ReadonlyMap<number, string>;
  branchAddress: ReadonlyMap<number, string>;
  /** Step ids read top to bottom: each step, then the branches forking from it, each in full. */
  order: readonly number[];
}

/** Works out every address: the critical path 1, 2, 3; branches off step 2 are 2a, 2b; their steps 2a.1, 2a.2. */
export function layOut(steps: readonly StepLike[], branches: readonly BranchLike[]): PlanLayout {
  const stepAddress = new Map<number, string>();
  const branchAddress = new Map<number, string>();
  const order: number[] = [];
  const sequence = (branch: number | null) =>
    steps.filter((step) => step.branch === branch).sort((a, b) => a.position - b.position);
  const forks = (step: number) =>
    branches.filter((branch) => branch.fromStep === step).sort((a, b) => a.position - b.position);
  const walk = (branch: number | null, prefix: string, seen: ReadonlySet<number>) => {
    sequence(branch).forEach((step, index) => {
      const address = prefix === "" ? `${index + 1}` : `${prefix}.${index + 1}`;
      stepAddress.set(step.id, address);
      order.push(step.id);
      forks(step.id).forEach((fork, place) => {
        // A branch that forks from its own steps would never end; it is left out rather than walked forever.
        if (seen.has(fork.id)) return;
        const forkAddress = `${address}${branchLetter(place + 1)}`;
        branchAddress.set(fork.id, forkAddress);
        walk(fork.id, forkAddress, new Set([...seen, fork.id]));
      });
    });
  };
  walk(null, "", new Set());
  return { stepAddress, branchAddress, order };
}

/**
 * A branch's state: one that became a line follows it, done with it, ended if it was dropped; otherwise done once it has
 * steps and every one of them is done.
 */
export function branchState(
  ownSteps: readonly { status: PlanStepStatus }[],
  became: LineState | null,
): PlanBranchState {
  if (became !== null) return became === "done" ? "done" : became === "dropped" ? "ended" : "open";
  return ownSteps.length > 0 && ownSteps.every((step) => step.status === "done") ? "done" : "open";
}

/**
 * What a step waits on: each open branch that holds it up, by the ref of the line it became, else its address. A step
 * already done waits on nothing.
 */
export function waitsOn(
  step: { address: string; status: PlanStepStatus },
  branches: readonly PlanBranch[],
): string[] {
  if (step.status === "done") return [];
  return branches
    .filter((branch) => branch.holdsUp === step.address && branch.state === "open")
    .map((branch) => branch.became?.ref ?? branch.address);
}

/**
 * A branch and every branch under it, at any depth, the branch itself first: the branches forking from its steps, and
 * from theirs.
 */
export function branchFamily(
  steps: readonly { id: number; branch: number | null }[],
  branches: readonly { id: number; fromStep: number }[],
  root: number,
): number[] {
  const family = [root];
  for (let index = 0; index < family.length; index += 1) {
    const current = family[index];
    const own = new Set(steps.filter((step) => step.branch === current).map((step) => step.id));
    for (const child of branches) {
      if (own.has(child.fromStep) && !family.includes(child.id)) family.push(child.id);
    }
  }
  return family;
}

/** A step as the plan draws it: what it waits on, and the branches forking from it. */
export interface PlanNode {
  step: PlanStep;
  waitsOn: string[];
  branches: PlanBranchNode[];
}

/** A branch as the plan draws it, its own steps under it; none once it became a line. */
export interface PlanBranchNode {
  branch: PlanBranch;
  steps: PlanNode[];
}

/** The plan as a tree from its flat steps and branches, as `line.show` gives them: the critical path at the top. */
export function planTree(steps: readonly PlanStep[], branches: readonly PlanBranch[]): PlanNode[] {
  const sequence = (branch: number | null) =>
    steps.filter((step) => step.branch === branch).sort((a, b) => a.position - b.position);
  const node = (step: PlanStep, seen: ReadonlySet<number>): PlanNode => ({
    step,
    waitsOn: waitsOn(step, branches),
    branches: branches
      .filter((branch) => branch.fromStep === step.id && !seen.has(branch.id))
      .sort((a, b) => a.position - b.position)
      .map((branch) => ({
        branch,
        steps: sequence(branch.id).map((child) => node(child, new Set([...seen, branch.id]))),
      })),
  });
  return sequence(null).map((step) => node(step, new Set()));
}
