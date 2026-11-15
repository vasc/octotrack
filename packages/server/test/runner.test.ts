import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contracts as c, Tracker } from "@octotrack/core";
import {
  createRunner,
  loadRunnerConfig,
  processShell,
  RunnerConfig,
  type RunnerShell,
} from "../src/runner.ts";
import { openSqlite } from "../src/sqlite.ts";

const DEV = { actor: "dev", channel: "dashboard" } as const;
const RUNNER_CALLER = { actor: "octotrack", channel: "cli", system: true } as const;
const GITHUB = { actor: "github", channel: "cli", system: true } as const;

interface Scripted {
  [command: string]: { code: number; stdout?: string; stderr?: string; hold?: Promise<void> };
}

function fakeShell(scripted: Scripted = {}, existing: readonly string[] = []) {
  const ran: string[] = [];
  const deadlines = new Map<string, number | undefined>();
  const started: { argv: string[]; cwd: string; env: Record<string, string> }[] = [];
  const finish: ((result: { code: number; output: string }) => void)[] = [];
  /** Process groups ended, by process id. */
  const ended: number[] = [];
  /** Processes alive, by process id: sessions from before a restart. */
  const living = new Set<number>();
  const files = new Set(existing);
  let nextPid = 1000;
  const shell: RunnerShell = {
    async run(argv, _cwd, deadlineMs) {
      const command = argv.join(" ");
      ran.push(command);
      deadlines.set(command, deadlineMs);
      const match = Object.entries(scripted).find(([prefix]) => command.startsWith(prefix))?.[1];
      if (match?.hold !== undefined) await match.hold;
      return { code: match?.code ?? 0, stdout: match?.stdout ?? "", stderr: match?.stderr ?? "" };
    },
    start(argv, options) {
      started.push({ argv: [...argv], cwd: options.cwd, env: options.env });
      nextPid += 1;
      return { pid: nextPid, exited: new Promise((resolve) => finish.push(resolve)) };
    },
    end(pid) {
      ended.push(pid);
    },
    async alive(pid) {
      return living.has(pid);
    },
    exists: (path) => files.has(path),
    move(from, to) {
      ran.push(`move ${from} ${to}`);
      files.delete(from);
      files.add(to);
    },
    remove(path) {
      ran.push(`remove ${path}`);
      files.delete(path);
    },
  };
  return { shell, ran, started, finish, deadlines, ended, living };
}

function world(
  config: Partial<RunnerConfig> = {},
  scripted: Scripted = {},
  options: {
    existing?: readonly string[];
    before?: (tracker: Tracker) => void;
    living?: readonly number[];
  } = {},
) {
  let now = "2026-11-14T09:00:00.000Z";
  const driver = openSqlite(":memory:");
  const tracker = new Tracker(driver, () => now);
  tracker.call(c.projectCreate, { key: "PANEL", name: "Panel", repo: "vasc/homepanel" }, DEV);
  const line = tracker.call(
    c.lineAdd,
    { title: "Enclosure", doneWhen: "Done.", repos: ["PANEL"], where: "working" },
    DEV,
  );
  now = "2026-11-14T09:01:00.000Z";
  options.before?.(tracker);
  const fake = fakeShell(scripted, options.existing);
  for (const pid of options.living ?? []) fake.living.add(pid);
  const runner = createRunner({
    tracker,
    shell: fake.shell,
    config: {
      start: ["claude", "--name", "{name}", "octo line take {line}"],
      cap: 1,
      dryRun: false,
      worktrees: "/wt",
      clones: "/src",
      logs: "/logs",
      repos: { PANEL: { checkout: "/src/homepanel", setup: [["bun", "install"]] } },
      ...config,
    },
  });
  const later = (minutes: number) => {
    now = new Date(Date.parse(now) + minutes * 60_000).toISOString();
  };
  const now_ = () => now;
  /** One tick, then every start it began, made ready and spawned or given up on. */
  const tick = async () => {
    await runner.tick();
    await runner.prepared();
  };
  return { tracker, driver, line, runner, later, now: now_, tick, ...fake };
}

describe("the local runner", () => {
  test("starts a session for a line nobody took, in a fresh worktree, passing only the line's ref and the name", async () => {
    const w = world();
    await w.tick();
    expect(w.ran).toEqual(["git -C /src/homepanel worktree add -b octo/panel.1 /wt/panel.1", "bun install"]);
    expect(w.started).toEqual([
      {
        argv: ["claude", "--name", "panel.1", `octo line take ${w.line.ref}`],
        cwd: "/wt/panel.1",
        env: { OCTO_AGENT: "panel.1" },
      },
    ]);
    await w.tick();
    expect(w.started).toHaveLength(1);
  });

  test("in watch mode it only records what it would have started", async () => {
    const w = world({ dryRun: true });
    await w.tick();
    expect(w.ran).toEqual([]);
    expect(w.started).toEqual([]);
    expect(w.tracker.call(c.feedList, { query: "event:runner.would_start" }, DEV).events).toHaveLength(1);
  });

  test("a start that exits at once is recorded with its output, for Step in to show", async () => {
    const w = world();
    await w.tick();
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
    await w.tick();
    expect(w.started).toEqual([]);
    const start = w.tracker.call(c.homeShow, {}, DEV).lines[w.line.ref]?.start;
    expect(start).toMatchObject({ state: "failed", output: "fatal: not a git repository" });
  });

  test("with no checkout of the repo, it clones it first", async () => {
    const w = world({ repos: {} });
    await w.tick();
    // Cloned beside its place and moved there only once whole, so a clone cut short is never taken for a checkout.
    expect(w.ran.slice(0, 3)).toEqual([
      "gh repo clone vasc/homepanel /src/panel.partial",
      "move /src/panel.partial /src/panel",
      "git -C /src/panel worktree add -b octo/panel.1 /wt/panel.1",
    ]);
  });

  test("closes pull requests left open on a line that is done, with a comment naming the line", async () => {
    const w = world({ repos: {}, cap: 0 });
    const issue = w.tracker.call(c.issueCreate, { project: "PANEL", title: "Base", line: w.line.ref }, DEV);
    w.tracker.call(
      c.prSync,
      {
        prs: [
          { repo: "vasc/homepanel", number: 14, title: "Base", state: "open", body: `Fixes ${issue.ref}` },
        ],
      },
      GITHUB,
    );
    w.tracker.call(c.lineDone, { ref: w.line.ref }, DEV);
    await w.tick();
    expect(w.ran.filter((command) => command.startsWith("gh pr close"))).toEqual([]);
    w.later(16);
    w.tracker.sweep();
    await w.tick();
    await w.tick();
    expect(w.ran.filter((command) => command.startsWith("gh pr close"))).toEqual([
      `gh pr close 14 --repo vasc/homepanel --comment Closed with ${w.line.ref}, which is done in Octotrack.`,
    ]);
  });

  test("removes a worktree it made once nobody uses it and it is clean and pushed", async () => {
    const w = world(
      {},
      { "git -C /wt/panel.1 rev-list --count HEAD --not --remotes": { code: 0, stdout: "0\n" } },
    );
    await w.tick();
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    await w.tick();
    expect(w.ran).toContain("git -C /src/homepanel worktree remove /wt/panel.1");
  });

  test("keeps a worktree with uncommitted work", async () => {
    const w = world({}, { "git -C /wt/panel.1 status --porcelain": { code: 0, stdout: " M base.scad\n" } });
    await w.tick();
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    await w.tick();
    expect(w.ran.some((command) => command.includes("worktree remove"))).toBe(false);
  });

  test("keeps a worktree with commits on no remote, even when its branch has no upstream", async () => {
    const w = world(
      {},
      { "git -C /wt/panel.1 rev-list --count HEAD --not --remotes": { code: 0, stdout: "2\n" } },
    );
    await w.tick();
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    await w.tick();
    expect(w.ran.some((command) => command.includes("worktree remove"))).toBe(false);
  });

  test("in watch mode it closes no pull request and removes no worktree, and notes the close it would make once", async () => {
    const w = world({ repos: {}, cap: 0, dryRun: true });
    const issue = w.tracker.call(c.issueCreate, { project: "PANEL", title: "Base", line: w.line.ref }, DEV);
    w.tracker.call(
      c.prSync,
      {
        prs: [
          { repo: "vasc/homepanel", number: 14, title: "Base", state: "open", body: `Fixes ${issue.ref}` },
        ],
      },
      GITHUB,
    );
    w.tracker.call(c.lineDone, { ref: w.line.ref }, DEV);
    w.later(16);
    w.tracker.sweep();
    await w.tick();
    await w.tick();
    expect(w.ran).toEqual([]);
    expect(w.tracker.call(c.feedList, { query: "event:runner.would_close" }, DEV).events).toHaveLength(1);
  });

  test("on start it settles sessions from before the server restarted, whose end it can no longer see", async () => {
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
    await w.tick();
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
        "git -C /src/homepanel remote get-url origin": {
          code: 0,
          stdout: "https://github.com/vasc/homepanel.git\n",
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
    await w.tick();
    expect(w.ran).toContain("git -C /src/homepanel worktree add -b octo/panel.1 /wt/panel.1");
  });

  test("a clone already in place is used only if it is of the same GitHub repo", async () => {
    const w = world(
      { repos: {} },
      { "git -C /src/panel remote get-url origin": { code: 0, stdout: "git@github.com:someone/else.git\n" } },
      { existing: ["/src/panel"] },
    );
    await w.tick();
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
    await w.tick();
    expect(w.ran).toContain("git -C /src/panel worktree add -b octo/panel.1 /wt/panel.1");
  });

  test("runs the developer's stop command for an agent they stopped, once, with only its name filled in", async () => {
    const w = world({ stop: ["tmux", "kill-session", "-t", "{name}"] });
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, { actor: "panel-a", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "panel-a" }, DEV);
    await w.tick();
    await w.tick();
    expect(w.ran.filter((command) => command.startsWith("tmux"))).toEqual(["tmux kill-session -t panel-a"]);
  });

  test("starts the next session for a line in the worktree a gone session left on it", async () => {
    const w = world(
      {},
      { "git -C /wt/panel.1 rev-list --count HEAD --not --remotes": { code: 0, stdout: "3\n" } },
    );
    await w.tick();
    // It took the line, left no way to wake it, and exited: gone, with its unpushed work in the worktree.
    const session = { actor: "panel.1", channel: "cli" } as const;
    w.tracker.call(c.agentRegister, {}, session);
    w.tracker.call(c.lineTake, { ref: w.line.ref }, session);
    w.finish[0]?.({ code: 0, output: "" });
    await w.runner.settled();
    w.later(15);
    await w.tick();
    expect(w.started.map((session) => [session.argv[2], session.cwd])).toEqual([
      ["panel.1", "/wt/panel.1"],
      ["panel.2", "/wt/panel.1"],
    ]);
    expect(w.ran.filter((command) => command.includes("worktree add"))).toHaveLength(1);
  });

  test("makes worktrees from the checkout the developer set for the repo", async () => {
    const w = world({ repos: {} });
    w.tracker.call(c.repoCheckout, { repo: "PANEL", path: "/code/homepanel" }, DEV);
    await w.tick();
    expect(w.ran).toContain("git -C /code/homepanel worktree add -b octo/panel.1 /wt/panel.1");
  });
});

const homes: string[] = [];
afterEach(() => {
  for (const dir of homes.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fresh folder for session logs, removed after the test. */
function logsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "octo-runner-logs-"));
  homes.push(dir);
  return dir;
}

/** Runs with these set in the server's own environment, then puts back what was there. */
async function withEnv(values: Record<string, string>, body: () => Promise<void> | void): Promise<void> {
  const saved = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    await body();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("what the runner audit found", () => {
  test("commands and sessions it runs never inherit an agent's name or the developer's presence from the server", async () => {
    const print = ["sh", "-c", 'echo "[$OCTO_AGENT][$OCTO_DEVELOPER]"'];
    await withEnv({ OCTO_AGENT: "someone-else", OCTO_DEVELOPER: "1" }, async () => {
      expect((await processShell.run(print)).stdout.trim()).toBe("[][]");
      const session = processShell.start(print, {
        cwd: tmpdir(),
        env: { OCTO_AGENT: "panel.1" },
        log: join(logsDir(), "panel.1.log"),
      });
      expect((await session.exited).output.trim()).toBe("[panel.1][]");
    });
  });

  test("a checkout an agent works in is used only if its origin is the repo", async () => {
    const w = world(
      { repos: {} },
      {
        "git -C /work/elsewhere rev-parse --path-format=absolute --git-common-dir": {
          code: 0,
          stdout: "/work/elsewhere/.git\n",
        },
        "git -C /work/elsewhere remote get-url origin": {
          code: 0,
          stdout: "git@github.com:someone/else.git\n",
        },
      },
      {
        before: (tracker) => {
          tracker.call(
            c.agentRegister,
            { repo: "PANEL" },
            { actor: "liar", channel: "cli", checkout: "/work/elsewhere" },
          );
        },
      },
    );
    await w.tick();
    expect(w.ran.some((command) => command.startsWith("git -C /work/elsewhere worktree add"))).toBe(false);
    expect(w.ran).toContain("gh repo clone vasc/homepanel /src/panel.partial");
  });

  test("worktrees go under the install's own home by default, so a test install never touches the live one's", async () => {
    const home = mkdtempSync(join(tmpdir(), "octo-runner-home-"));
    homes.push(home);
    await withEnv({ OCTO_HOME: home }, () => {
      expect(RunnerConfig.parse({ start: ["claude"] }).worktrees).toBe(join(home, "worktrees"));
    });
  });

  test("a name that is not safe to pass to the stop command is never passed to it", async () => {
    const w = world({ stop: ["tmux", "kill-session", "-t", "{name}"] });
    for (const name of ["*", "-rf"]) {
      w.driver.run("INSERT INTO agents (name, firstSeenAt, lastSeenAt, stoppedAt) VALUES (?, ?, ?, ?)", [
        name,
        w.now(),
        w.now(),
        w.now(),
      ]);
    }
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, { actor: "panel-a", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "panel-a" }, DEV);
    await w.tick();
    await w.tick();
    expect(w.ran.filter((command) => command.startsWith("tmux"))).toEqual(["tmux kill-session -t panel-a"]);
    expect(w.tracker.call(c.runnerStops, {}, RUNNER_CALLER)).toEqual([]);
  });

  test("setup commands get their own, longer deadline than git and gh", async () => {
    const w = world();
    await w.tick();
    expect(w.deadlines.get("bun install") ?? 0).toBeGreaterThan(
      w.deadlines.get("git -C /src/homepanel worktree add -b octo/panel.1 /wt/panel.1") ?? 0,
    );
  });

  test("a command past its deadline is killed and reported, not waited on", async () => {
    const begun = Date.now();
    const ran = await processShell.run(["sleep", "5"], undefined, 200);
    expect(Date.now() - begun).toBeLessThan(3000);
    expect(ran.code).not.toBe(0);
    expect(ran.stderr).toContain("deadline");
  });

  test("a command whose own child keeps its output open is still answered once it exits", async () => {
    const begun = Date.now();
    const ran = await processShell.run(["sh", "-c", "sleep 8 & echo hi"]);
    expect([ran.code, ran.stdout.trim()]).toEqual([0, "hi"]);
    const session = processShell.start(["sh", "-c", "sleep 8 & echo started; exit 3"], {
      cwd: tmpdir(),
      env: {},
      log: join(logsDir(), "child.log"),
    });
    expect(await session.exited).toEqual({ code: 3, output: "started\n" });
    expect(Date.now() - begun).toBeLessThan(4000);
  });

  test("in watch mode it does not run the stop command, and notes once that it would", async () => {
    const w = world({ dryRun: true, stop: ["tmux", "kill-session", "-t", "{name}"] });
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, { actor: "panel-a", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "panel-a" }, DEV);
    await w.tick();
    await w.tick();
    expect(w.ran).toEqual([]);
    expect(w.tracker.call(c.feedList, { query: "event:runner.would_stop" }, DEV).events).toHaveLength(1);
  });

  test("a retry whose worktree was removed makes it again on the branch its first attempt left", async () => {
    const exists = { code: 255, stderr: "fatal: a branch named 'octo/panel.1' already exists" };
    // Its first attempt made the branch and failed; its worktree was removed since; Try now made it due.
    const again = world(
      {},
      { "git -C /src/homepanel worktree add -b octo/panel.1": exists },
      {
        before: (tracker) => {
          const first = tracker.call(c.runnerStart, { line: "L-1", repo: "PANEL" }, RUNNER_CALLER);
          tracker.call(
            c.runnerWorktree,
            {
              path: "/wt/panel.1",
              repo: "PANEL",
              checkout: "/src/homepanel",
              branch: "octo/panel.1",
              agent: first.name,
            },
            RUNNER_CALLER,
          );
          tracker.call(
            c.runnerExited,
            { name: first.name, code: 1, output: "lockfile is broken" },
            RUNNER_CALLER,
          );
          tracker.call(c.runnerRemoved, { path: "/wt/panel.1" }, RUNNER_CALLER);
          tracker.call(c.runnerRetry, { line: "L-1" }, DEV);
        },
      },
    );
    await again.tick();
    expect(again.ran).toContain("git -C /src/homepanel worktree add /wt/panel.1 octo/panel.1");
    expect(again.started.map((session) => session.cwd)).toEqual(["/wt/panel.1"]);
  });

  test("a new session never takes over a branch Octotrack did not make for it", async () => {
    const w = world(
      {},
      {
        "git -C /src/homepanel worktree add -b octo/panel.1": {
          code: 255,
          stderr: "fatal: a branch named 'octo/panel.1' already exists",
        },
      },
    );
    await w.tick();
    expect(w.ran.filter((command) => command.includes("worktree add"))).toEqual([
      "git -C /src/homepanel worktree add -b octo/panel.1 /wt/panel.1",
    ]);
    expect(w.started).toEqual([]);
    expect(w.tracker.call(c.homeShow, {}, DEV).lines[w.line.ref]?.start?.output).toContain("did not make");
  });

  test("once the line has an owner, a spare session is started as a helper for its unclaimed work", async () => {
    const w = world({ cap: 2 });
    await w.tick();
    const owner = { actor: "panel.1", channel: "cli" } as const;
    w.tracker.call(c.lineTake, { ref: w.line.ref }, owner);
    for (const title of ["Base", "Lid"]) {
      w.tracker.call(c.issueCreate, { project: "PANEL", title, line: w.line.ref }, DEV);
    }
    await w.tick();
    expect(w.started.map((session) => session.argv[2])).toEqual(["panel.1", "panel.2"]);
    const started = w.tracker.call(c.feedList, { query: "event:runner.started" }, DEV).events;
    expect(started.some((event) => event.summary.includes("panel.2 as a helper"))).toBe(true);
  });
});

/** A promise and the function that settles it: a command that holds until a test lets it go. */
function gate(): { hold: Promise<void>; release: () => void } {
  const resolvers: (() => void)[] = [];
  const hold = new Promise<void>((resolve) => {
    resolvers.push(resolve);
  });
  return {
    hold,
    release: () => {
      for (const resolve of resolvers) resolve();
    },
  };
}

describe("what the third audit found in the local runner", () => {
  test("N6: a line tabled while its session was set up is not left running: its process is ended at once", async () => {
    const setup = gate();
    const w = world({}, { "bun install": { code: 0, hold: setup.hold } });
    await w.runner.tick();
    w.tracker.call(c.lineTable, { ref: w.line.ref, reason: "Not now" }, DEV);
    setup.release();
    await w.runner.prepared();
    expect(w.started).toHaveLength(1);
    expect(w.ended).toEqual([1001]);
    w.finish[0]?.({ code: 143, output: "" });
    await w.runner.settled();
    expect(w.tracker.call(c.feedList, { query: "event:runner.not_started" }, DEV).events).toHaveLength(1);
  });

  test("N9: Stop ends the whole process group of a session the runner started, stop command or not", async () => {
    const w = world();
    await w.tick();
    w.tracker.call(c.lineTake, { ref: w.line.ref }, { actor: "panel.1", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "panel.1" }, DEV);
    await w.tick();
    await w.tick();
    expect(w.ended).toEqual([1001]);
    const ran = w.tracker.call(c.feedList, { query: "event:runner.stop_ran" }, DEV).events;
    expect(ran.map((event) => event.summary)).toEqual(["Ended panel.1's process"]);
  });

  test("N10: a session still running after a restart keeps its worktree, and is watched until its process ends", async () => {
    const w = world(
      {},
      {},
      {
        living: [4242],
        before: (tracker) => {
          tracker.call(c.runnerReport, { configured: true, cap: 2, dryRun: false }, RUNNER_CALLER);
          const first = tracker.call(
            c.runnerStart,
            { line: "L-1", repo: "PANEL", worktree: "/wt/panel.1" },
            RUNNER_CALLER,
          );
          tracker.call(
            c.runnerWorktree,
            {
              path: "/wt/panel.1",
              repo: "PANEL",
              checkout: "/src/homepanel",
              branch: "octo/panel.1",
              agent: first.name,
            },
            RUNNER_CALLER,
          );
          tracker.call(c.runnerSpawned, { name: first.name, pid: 4242 }, RUNNER_CALLER);
          tracker.call(
            c.lineTake,
            { ref: "L-1" },
            { actor: first.name, channel: "cli", checkout: "/wt/panel.1" },
          );
        },
      },
    );
    await w.tick();
    const panel = () => w.tracker.call(c.agentList, {}, DEV).find((agent) => agent.name === "panel.1");
    expect(panel()?.state).toBe("running");
    expect(w.started).toEqual([]);
    w.living.delete(4242);
    await w.tick();
    expect(panel()?.state).toBe("gone");
  });

  test("N10: Stop ends a session from before a restart by its process id", async () => {
    const w = world(
      {},
      {},
      {
        living: [4242],
        before: (tracker) => {
          const first = tracker.call(c.runnerStart, { line: "L-1", repo: "PANEL" }, RUNNER_CALLER);
          tracker.call(c.runnerSpawned, { name: first.name, pid: 4242 }, RUNNER_CALLER);
        },
      },
    );
    await w.tick();
    w.tracker.call(c.agentStop, { name: "panel.1" }, DEV);
    await w.tick();
    expect(w.ended).toEqual([4242]);
  });

  test("N22: a setup that takes long holds up neither stops nor closes", async () => {
    const setup = gate();
    const w = world(
      { stop: ["tmux", "kill-session", "-t", "{name}"] },
      { "bun install": { code: 0, hold: setup.hold } },
    );
    await w.runner.tick();
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, { actor: "panel-a", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "panel-a" }, DEV);
    await w.runner.tick();
    expect(w.ran).toContain("tmux kill-session -t panel-a");
    setup.release();
    await w.runner.prepared();
    expect(w.started).toHaveLength(1);
  });

  test("N22: a name of any language reaches the stop command, as agent names may", async () => {
    const w = world({ stop: ["tmux", "kill-session", "-t", "{name}"] });
    w.tracker.call(c.agentRegister, { repo: "PANEL" }, { actor: "café", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "café" }, DEV);
    await w.tick();
    expect(w.ran).toContain("tmux kill-session -t café");
  });

  test("N22: a clone gets the long deadline, and one cut short is cleared away, never used", async () => {
    const w = world(
      { repos: {} },
      { "gh repo clone": { code: 124, stderr: "Killed" } },
      { existing: ["/src/panel.partial"] },
    );
    await w.tick();
    expect(w.deadlines.get("gh repo clone vasc/homepanel /src/panel.partial") ?? 0).toBeGreaterThan(
      w.deadlines.get("git -C /src/homepanel worktree add -b octo/panel.1 /wt/panel.1") ?? 120_000,
    );
    expect(w.ran.filter((command) => command.startsWith("remove"))).toEqual([
      "remove /src/panel.partial",
      "remove /src/panel.partial",
    ]);
    expect(w.ran.some((command) => command.startsWith("move"))).toBe(false);
    expect(w.started).toEqual([]);
  });

  test("N22: a clone in place that is not whole is not used", async () => {
    const w = world(
      { repos: {} },
      {
        "git -C /src/panel remote get-url origin": {
          code: 0,
          stdout: "https://github.com/vasc/homepanel.git\n",
        },
        "git -C /src/panel rev-parse --verify HEAD": { code: 128, stderr: "fatal: bad revision" },
      },
      { existing: ["/src/panel"] },
    );
    await w.tick();
    expect(w.started).toEqual([]);
    expect(w.tracker.call(c.homeShow, {}, DEV).lines[w.line.ref]?.start?.output).toContain(
      "not a whole clone",
    );
  });

  test("N22: a checkout beside the worktrees folder, not in it, is still an agent's checkout", async () => {
    const w = world(
      { repos: {} },
      {
        "git -C /wt-panel rev-parse --path-format=absolute --git-common-dir": {
          code: 0,
          stdout: "/wt-panel/.git\n",
        },
        "git -C /wt-panel remote get-url origin": {
          code: 0,
          stdout: "https://github.com/vasc/homepanel.git\n",
        },
      },
      {
        before: (tracker) => {
          tracker.call(
            c.agentRegister,
            { repo: "PANEL" },
            { actor: "dev-session", channel: "cli", checkout: "/wt-panel" },
          );
        },
      },
    );
    await w.tick();
    expect(w.ran).toContain("git -C /wt-panel worktree add -b octo/panel.1 /wt/panel.1");
  });

  test("N22: clones default to Octotrack's own home, so a test install never works in the live clone", async () => {
    const home = mkdtempSync(join(tmpdir(), "octo-runner-home-"));
    homes.push(home);
    await withEnv({ OCTO_HOME: home }, () => {
      expect(RunnerConfig.parse({ start: ["claude"] }).clones).toBe(join(home, "clones"));
    });
  });
});

describe("the setup file", () => {
  /** A fresh home of its own, so defaults that live in Octotrack's home never touch the live install's. */
  async function inHome(body: (home: string) => void): Promise<void> {
    const home = mkdtempSync(join(tmpdir(), "octo-runner-setup-"));
    homes.push(home);
    await withEnv({ OCTO_HOME: home }, () => body(home));
  }

  test("missing, there is no runner", async () => {
    await inHome((home) => {
      expect(loadRunnerConfig(join(home, "agent-setup.json"))).toBeNull();
    });
  });

  test("not valid, it is ignored", async () => {
    await inHome((home) => {
      const path = join(home, "agent-setup.json");
      for (const content of [
        "{ not json",
        JSON.stringify({ start: [] }),
        JSON.stringify({ start: ["claude"], cap: -1 }),
      ]) {
        writeFileSync(path, content);
        expect(loadRunnerConfig(path)).toBeNull();
      }
    });
  });

  test("valid, it watches only until dryRun is turned off", async () => {
    await inHome((home) => {
      const path = join(home, "agent-setup.json");
      writeFileSync(path, JSON.stringify({ start: ["claude", "-p", "{name}"] }));
      expect(loadRunnerConfig(path)).toMatchObject({ dryRun: true, cap: 1, repos: {} });
      writeFileSync(path, JSON.stringify({ start: ["claude"], dryRun: false, cap: 3 }));
      expect(loadRunnerConfig(path)).toMatchObject({ dryRun: false, cap: 3 });
    });
  });
});

describe("sessions as real processes (third audit, N9 and N10)", () => {
  test("ending a session ends its whole process group, and it is then no longer alive", async () => {
    const log = join(logsDir(), "group.log");
    const session = processShell.start(["sh", "-c", "sleep 30 & echo $! ; wait"], {
      cwd: tmpdir(),
      env: {},
      log,
    });
    const pid = session.pid ?? 0;
    expect(pid).toBeGreaterThan(0);
    const spawnedAt = new Date().toISOString();
    expect(await processShell.alive(pid, spawnedAt)).toBe(true);
    // Wait for the child's pid to be written, with a deadline.
    const deadline = Date.now() + 3000;
    let child = 0;
    while (child === 0 && Date.now() < deadline) {
      child = Number((await Bun.file(log).text()).trim()) || 0;
      if (child === 0) await Bun.sleep(20);
    }
    expect(child).toBeGreaterThan(0);
    const begun = Date.now();
    processShell.end(pid);
    await session.exited;
    expect(Date.now() - begun).toBeLessThan(3000);
    expect(await processShell.alive(pid, spawnedAt)).toBe(false);
    expect(await processShell.alive(child, spawnedAt)).toBe(false);
  });

  test("a process that started long after the session was spawned is another one, its id reused", async () => {
    const log = join(logsDir(), "reused.log");
    const session = processShell.start(["sleep", "5"], { cwd: tmpdir(), env: {}, log });
    const pid = session.pid ?? 0;
    expect(await processShell.alive(pid, "2026-01-01T00:00:00.000Z")).toBe(false);
    processShell.end(pid);
    await session.exited;
  });
});

describe("what the fourth audit found in the local runner", () => {
  test("A4: a pull request gh fails to close is said in the Log, and not asked of gh again every tick", async () => {
    const w = world(
      { repos: {}, cap: 0 },
      { "gh pr close": { code: 1, stderr: "GraphQL: Resource not accessible by integration (closePullRequest)" } },
    );
    const issue = w.tracker.call(c.issueCreate, { project: "PANEL", title: "Base", line: w.line.ref }, DEV);
    w.tracker.call(
      c.prSync,
      {
        prs: [
          { repo: "vasc/homepanel", number: 14, title: "Base", state: "open", body: `Fixes ${issue.ref}` },
        ],
      },
      GITHUB,
    );
    w.tracker.call(c.lineDone, { ref: w.line.ref }, DEV);
    w.later(16);
    w.tracker.sweep();
    await w.tick();
    await w.tick();
    const closes = () => w.ran.filter((command) => command.startsWith("gh pr close"));
    expect(closes()).toHaveLength(1);
    const failed = w.tracker.call(c.feedList, { query: "event:runner.pr_close_failed" }, DEV).events;
    expect(failed.map((event) => event.summary)).toEqual([
      `Could not close PR-1 on GitHub with ${w.line.ref}: GraphQL: Resource not accessible by integration (closePullRequest). Trying again later.`,
    ]);
    w.later(2);
    await w.tick();
    expect(closes()).toHaveLength(2);
  });

  test("A23: Stop ends a session the runner started, and does not also run the stop command for it", async () => {
    const w = world({ stop: ["tmux", "kill-session", "-t", "{name}"] });
    await w.tick();
    w.tracker.call(c.lineTake, { ref: w.line.ref }, { actor: "panel.1", channel: "cli" });
    w.tracker.call(c.agentStop, { name: "panel.1" }, DEV);
    await w.tick();
    await w.tick();
    expect(w.ended).toEqual([1001]);
    expect(w.ran.filter((command) => command.startsWith("tmux"))).toEqual([]);
    const ran = w.tracker.call(c.feedList, { query: "event:runner.stop_ran" }, DEV).events;
    expect(ran.map((event) => event.summary)).toEqual(["Ended panel.1's process"]);
  });
});
