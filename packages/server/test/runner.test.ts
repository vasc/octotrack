import { describe, expect, test } from "bun:test";
import { contracts as c, Tracker } from "@octotrack/core";
import { createRunner, type RunnerConfig, type RunnerShell } from "../src/runner.ts";
import { openSqlite } from "../src/sqlite.ts";

const DEV = { actor: "dev", channel: "dashboard" } as const;
const RUNNER_CALLER = { actor: "octotrack", channel: "cli", system: true } as const;

interface Scripted {
  [command: string]: { code: number; stdout?: string; stderr?: string };
}

function fakeShell(scripted: Scripted = {}, existing: readonly string[] = []) {
  const ran: string[] = [];
  const started: { argv: string[]; cwd: string; env: Record<string, string> }[] = [];
  const finish: ((result: { code: number; output: string }) => void)[] = [];
  const shell: RunnerShell = {
    async run(argv) {
      const command = argv.join(" ");
      ran.push(command);
      const match = Object.entries(scripted).find(([prefix]) => command.startsWith(prefix))?.[1];
      return { code: match?.code ?? 0, stdout: match?.stdout ?? "", stderr: match?.stderr ?? "" };
    },
    start(argv, options) {
      started.push({ argv: [...argv], cwd: options.cwd, env: options.env });
      return { exited: new Promise((resolve) => finish.push(resolve)) };
    },
    exists: (path) => existing.includes(path),
  };
  return { shell, ran, started, finish };
}

function world(
  config: Partial<RunnerConfig> = {},
  scripted: Scripted = {},
  options: { existing?: readonly string[]; before?: (tracker: Tracker) => void } = {},
) {
  let now = "2026-11-14T09:00:00.000Z";
  const tracker = new Tracker(openSqlite(":memory:"), () => now);
  tracker.call(c.projectCreate, { key: "PANEL", name: "Panel", repo: "vasc/homepanel" }, DEV);
  const line = tracker.call(
    c.lineAdd,
    { title: "Enclosure", doneWhen: "Done.", repos: ["PANEL"], where: "working" },
    DEV,
  );
  now = "2026-11-14T09:01:00.000Z";
  options.before?.(tracker);
  const fake = fakeShell(scripted, options.existing);
  const runner = createRunner({
    tracker,
    shell: fake.shell,
    config: {
      start: ["claude", "--name", "{name}", "octo line take {line}"],
      cap: 1,
      dryRun: false,
      worktrees: "/wt",
      clones: "/src",
      repos: { PANEL: { checkout: "/src/homepanel", setup: [["bun", "install"]] } },
      ...config,
    },
  });
  const later = (minutes: number) => {
    now = new Date(Date.parse(now) + minutes * 60_000).toISOString();
  };
  return { tracker, line, runner, later, ...fake };
}

describe("the local runner", () => {
  test("starts a session for a line nobody took, in a fresh worktree, passing only the line's ref and the name", async () => {
    const w = world();
    await w.runner.tick();
    expect(w.ran).toEqual(["git -C /src/homepanel worktree add -b octo/panel.1 /wt/panel.1", "bun install"]);
    expect(w.started).toEqual([
      {
        argv: ["claude", "--name", "panel.1", `octo line take ${w.line.ref}`],
        cwd: "/wt/panel.1",
        env: { OCTO_AGENT: "panel.1" },
      },
    ]);
    await w.runner.tick();
    expect(w.started).toHaveLength(1);
  });

  test("in watch mode it only records what it would have started", async () => {
    const w = world({ dryRun: true });
    await w.runner.tick();
    expect(w.ran).toEqual([]);
    expect(w.started).toEqual([]);
    expect(w.tracker.call(c.feedList, { query: "event:runner.would_start" }, DEV).events).toHaveLength(1);
  });

  test("a start that exits at once is recorded with its output, for Step in to show", async () => {
    const w = world();
    await w.runner.tick();
    w.finish[0]?.({ code: 1, output: "claude: not logged in" });
    await w.runner.settled();
    const home = w.tracker.call(c.homeShow, {}, DEV);
    expect(home.lines[w.line.ref]?.start).toMatchObject({ state: "failed", output: "claude: not logged in" });
  });

  test("a worktree that cannot be made is a failed start, not a session", async () => {
    const w = world(
      {},
      { "git -C /src/homepanel worktree add": { code: 128, stderr: "fatal: not a git repository" } },
    );
    await w.runner.tick();
    expect(w.started).toEqual([]);
    const start = w.tracker.call(c.homeShow, {}, DEV).lines[w.line.ref]?.start;
    expect(start).toMatchObject({ state: "failed", output: "fatal: not a git repository" });
  });

  test("with no checkout of the repo, it clones it first", async () => {
    const w = world({ repos: {} });
    await w.runner.tick();
    expect(w.ran.slice(0, 2)).toEqual([
      "gh repo clone vasc/homepanel /src/panel",
      "git -C /src/panel worktree add -b octo/panel.1 /wt/panel.1",
    ]);
  });

  test("closes pull requests left open on a line that is done, with a comment naming the line", async () => {
    const w = world({ repos: {}, cap: 0 });
    const issue = w.tracker.call(c.issueCreate, { project: "PANEL", title: "Base", line: w.line.ref }, DEV);
    w.tracker.call(
      c.prUpsert,
      { repo: "vasc/homepanel", number: 14, title: "Base", state: "open", body: `Fixes ${issue.ref}` },
      { actor: "github", channel: "cli", system: true },
    );
    w.tracker.call(c.lineDone, { ref: w.line.ref }, DEV);
    await w.runner.tick();
    expect(w.ran.filter((command) => command.startsWith("gh pr close"))).toEqual([]);
    w.later(16);
    w.tracker.sweep();
    await w.runner.tick();
    await w.runner.tick();
    expect(w.ran.filter((command) => command.startsWith("gh pr close"))).toEqual([
      `gh pr close 14 --repo vasc/homepanel --comment Closed with ${w.line.ref}, which is done in Octotrack.`,
    ]);
  });

  test("removes a worktree it made once nobody uses it and it is clean and pushed", async () => {
    const w = world(
      {},
      { "git -C /wt/panel.1 rev-list --count HEAD --not --remotes": { code: 0, stdout: "0\n" } },
    );
    await w.runner.tick();
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    await w.runner.tick();
    expect(w.ran).toContain("git -C /src/homepanel worktree remove /wt/panel.1");
  });

  test("keeps a worktree with uncommitted work", async () => {
    const w = world({}, { "git -C /wt/panel.1 status --porcelain": { code: 0, stdout: " M base.scad\n" } });
    await w.runner.tick();
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    await w.runner.tick();
    expect(w.ran.some((command) => command.includes("worktree remove"))).toBe(false);
  });

  test("keeps a worktree with commits on no remote, even when its branch has no upstream", async () => {
    const w = world(
      {},
      { "git -C /wt/panel.1 rev-list --count HEAD --not --remotes": { code: 0, stdout: "2\n" } },
    );
    await w.runner.tick();
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    await w.runner.tick();
    expect(w.ran.some((command) => command.includes("worktree remove"))).toBe(false);
  });

  test("in watch mode it closes no pull request and removes no worktree, and notes the close it would make once", async () => {
    const w = world({ repos: {}, cap: 0, dryRun: true });
    const issue = w.tracker.call(c.issueCreate, { project: "PANEL", title: "Base", line: w.line.ref }, DEV);
    w.tracker.call(
      c.prUpsert,
      { repo: "vasc/homepanel", number: 14, title: "Base", state: "open", body: `Fixes ${issue.ref}` },
      { actor: "github", channel: "cli", system: true },
    );
    w.tracker.call(c.lineDone, { ref: w.line.ref }, DEV);
    w.later(16);
    w.tracker.sweep();
    await w.runner.tick();
    await w.runner.tick();
    expect(w.ran).toEqual([]);
    expect(w.tracker.call(c.feedList, { query: "event:runner.would_close" }, DEV).events).toHaveLength(1);
  });

  test("on start it settles sessions from before the server restarted, whose end it can no longer see", () => {
    const w = world(
      {},
      {},
      {
        before: (tracker) => {
          tracker.call(c.runnerReport, { configured: true, cap: 1, dryRun: false }, RUNNER_CALLER);
          tracker.call(c.runnerStart, { line: "L-1", repo: "PANEL" }, RUNNER_CALLER);
        },
      },
    );
    expect(w.tracker.call(c.homeShow, {}, DEV).lines[w.line.ref]?.start?.state).toBe("failed");
  });

  test("a worktree is made from the main checkout, even when the known checkout is itself a worktree", async () => {
    const w = world(
      { repos: {} },
      {
        "git -C /work/panel-feature rev-parse --path-format=absolute --git-common-dir": {
          code: 0,
          stdout: "/src/homepanel/.git\n",
        },
      },
      {
        before: (tracker) => {
          tracker.call(
            c.agentRegister,
            { repo: "PANEL" },
            { actor: "dev-session", channel: "cli", checkout: "/work/panel-feature" },
          );
        },
      },
    );
    await w.runner.tick();
    expect(w.ran).toContain("git -C /src/homepanel worktree add -b octo/panel.1 /wt/panel.1");
  });

  test("a clone already in place is used only if it is of the same GitHub repo", async () => {
    const w = world(
      { repos: {} },
      { "git -C /src/panel remote get-url origin": { code: 0, stdout: "git@github.com:someone/else.git\n" } },
      { existing: ["/src/panel"] },
    );
    await w.runner.tick();
    expect(w.started).toEqual([]);
    expect(w.tracker.call(c.homeShow, {}, DEV).lines[w.line.ref]?.start?.output).toContain("someone/else");
  });

  test("a clone already in place of the same repo is used", async () => {
    const w = world(
      { repos: {} },
      {
        "git -C /src/panel remote get-url origin": {
          code: 0,
          stdout: "https://github.com/vasc/homepanel.git\n",
        },
      },
      { existing: ["/src/panel"] },
    );
    await w.runner.tick();
    expect(w.ran).toContain("git -C /src/panel worktree add -b octo/panel.1 /wt/panel.1");
  });

  test("runs the developer's stop command for an agent they stopped, once, with only its name filled in", async () => {
    const w = world({ stop: ["tmux", "kill-session", "-t", "{name}"] });
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, { actor: "panel-a", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "panel-a" }, DEV);
    await w.runner.tick();
    await w.runner.tick();
    expect(w.ran.filter((command) => command.startsWith("tmux"))).toEqual(["tmux kill-session -t panel-a"]);
  });

  test("starts the next session for a line in the worktree a gone session left on it", async () => {
    const w = world(
      {},
      { "git -C /wt/panel.1 rev-list --count HEAD --not --remotes": { code: 0, stdout: "3\n" } },
    );
    await w.runner.tick();
    // It took the line, left no way to wake it, and exited: gone, with its unpushed work in the worktree.
    const session = { actor: "panel.1", channel: "cli" } as const;
    w.tracker.call(c.agentRegister, {}, session);
    w.tracker.call(c.lineTake, { ref: w.line.ref }, session);
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    w.later(15);
    await w.runner.tick();
    expect(w.started.map((session) => [session.argv[2], session.cwd])).toEqual([
      ["panel.1", "/wt/panel.1"],
      ["panel.2", "/wt/panel.1"],
    ]);
    expect(w.ran.filter((command) => command.includes("worktree add"))).toHaveLength(1);
  });

  test("makes worktrees from the checkout the developer set for the repo", async () => {
    const w = world({ repos: {} });
    w.tracker.call(c.repoCheckout, { repo: "PANEL", path: "/code/homepanel" }, DEV);
    await w.runner.tick();
    expect(w.ran).toContain("git -C /code/homepanel worktree add -b octo/panel.1 /wt/panel.1");
  });
});
