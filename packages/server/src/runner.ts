import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type Caller, contracts, type RunnerDue, type Tracker } from "@octotrack/core";
import { z } from "zod";

/**
 * The developer's own setup for starting sessions, in `~/.octotrack/agent-setup.json`, edited only on this machine and
 * never by an operation (docs/DESIGN.md, D12). Commands carry only `{line}` and `{name}`, so tracker text never
 * becomes a prompt.
 */
export const RunnerConfig = z.object({
  /** The start command, such as ["claude", "-p", "You are {name}. Run octo line take {line}."]. */
  start: z.array(z.string().min(1)).min(1),
  /** How many sessions Octotrack may have running at once. */
  cap: z.number().int().min(0).default(1),
  /** Watch mode: record what would be started, start nothing. On until the developer turns it off. */
  dryRun: z.boolean().default(true),
  /** Where new worktrees go. */
  worktrees: z.string().default(join(homedir(), ".octotrack", "worktrees")),
  /** Where a repo with no checkout here is cloned. */
  clones: z.string().default(join(homedir(), "src")),
  repos: z
    .record(
      z.string(),
      z.object({
        checkout: z.string().optional(),
        start: z.array(z.string().min(1)).min(1).optional(),
        setup: z.array(z.array(z.string().min(1)).min(1)).optional(),
      }),
    )
    .default({}),
});
export type RunnerConfig = z.output<typeof RunnerConfig>;

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Everything the runner does outside the tracker. Injected, so tests never run git, gh or a real session. */
export interface RunnerShell {
  run(argv: readonly string[], cwd?: string): Promise<RunResult>;
  start(
    argv: readonly string[],
    options: { cwd: string; env: Record<string, string> },
  ): { exited: Promise<{ code: number; output: string }> };
  exists(path: string): boolean;
}

const RUNNER: Caller = { actor: "octotrack", channel: "cli", system: true };
/** git and gh answer in seconds; this is generous, then the command is given up on. */
const COMMAND_DEADLINE_MS = 120_000;
const OUTPUT_KEPT = 4000;

export function loadRunnerConfig(path: string): RunnerConfig | null {
  if (!existsSync(path)) return null;
  try {
    return RunnerConfig.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    console.error(`[runner] ignoring ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Runs commands with no shell, so nothing in a name or a path can be read as a command. */
export const processShell: RunnerShell = {
  async run(argv, cwd) {
    const child = Bun.spawn([...argv], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const deadline = setTimeout(() => child.kill("SIGKILL"), COMMAND_DEADLINE_MS);
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { code, stdout, stderr };
    } finally {
      clearTimeout(deadline);
    }
  },
  start(argv, options) {
    const child = Bun.spawn([...argv], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const exited = Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]).then(([code, stdout, stderr]) => ({ code, output: `${stdout}${stderr}`.slice(-OUTPUT_KEPT) }));
    return { exited };
  },
  exists: existsSync,
};

/** The owner/name a git remote URL points at on GitHub, or null for anything else. */
export function githubSlug(url: string): string | null {
  const match = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match?.[1] ?? null;
}

function fill(command: readonly string[], line: string, name: string): string[] {
  return command.map((part) => part.replaceAll("{line}", line).replaceAll("{name}", name));
}

export interface Runner {
  /** Starts what is due, closes what ended, removes what nobody uses. Never runs twice at once. */
  tick(): Promise<void>;
  /** Resolves when every session started so far has exited and been recorded. */
  settled(): Promise<void>;
}

export function createRunner(options: {
  tracker: Tracker;
  config: RunnerConfig;
  shell?: RunnerShell;
}): Runner {
  const { tracker, config, shell = processShell } = options;
  const sessions = new Set<Promise<void>>();
  let busy = false;

  tracker.call(contracts.runnerReport, { configured: true, cap: config.cap, dryRun: config.dryRun }, RUNNER);
  // Sessions started before this server did are not watched by anyone now; they are settled, so their lines move on.
  tracker.call(contracts.runnerRestarted, {}, RUNNER);

  const failStart = (due: RunnerDue, worktree: string | undefined, output: string, code = 1) => {
    const started = tracker.call(
      contracts.runnerStart,
      { line: due.line, repo: due.repo, ...(worktree === undefined ? {} : { worktree }) },
      RUNNER,
    );
    tracker.call(contracts.runnerExited, { name: started.name, code, output }, RUNNER);
  };

  /** The main checkout a path belongs to, so that a new worktree never hangs off another session's worktree. */
  const mainCheckout = async (path: string): Promise<string> => {
    const common = await shell.run([
      "git",
      "-C",
      path,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    const dir = common.stdout.trim();
    return common.code === 0 && dir.endsWith("/.git") ? dirname(dir) : path;
  };

  /** A checkout of the repo: the one the developer named, one an agent works in, or a clone of its GitHub repo. */
  const checkoutFor = async (repo: string): Promise<{ path: string } | { error: string }> => {
    const named = config.repos[repo]?.checkout;
    if (named !== undefined) return { path: named };
    const known = tracker
      .call(contracts.agentList, {}, RUNNER)
      .find(
        (agent) =>
          agent.repo === repo && agent.checkout !== null && !agent.checkout.startsWith(config.worktrees),
      );
    if (known !== undefined && known.checkout !== null) return { path: await mainCheckout(known.checkout) };
    const project = tracker.call(contracts.entityShow, { ref: repo }, RUNNER).entity;
    const slug = "repo" in project && typeof project.repo === "string" ? project.repo : null;
    const target = join(config.clones, repo.toLowerCase());
    if (shell.exists(target)) {
      // Something else may live at that path; only a clone of this repo will do.
      const remote = await shell.run(["git", "-C", target, "remote", "get-url", "origin"]);
      const found = remote.code === 0 ? githubSlug(remote.stdout) : null;
      if (slug !== null && found !== null && found.toLowerCase() === slug.toLowerCase())
        return { path: target };
      return {
        error: `${target} is not a clone of ${slug ?? repo}${found === null ? "" : ` (it is ${found})`}; set a checkout for ${repo} in agent-setup.json`,
      };
    }
    if (slug === null) return { error: `${repo} has no GitHub repo to clone, and no checkout is set for it` };
    const cloned = await shell.run(["gh", "repo", "clone", slug, target]);
    return cloned.code === 0
      ? { path: target }
      : { error: `Cloning ${slug} failed: ${cloned.stderr.trim()}` };
  };

  const startOne = async (due: RunnerDue): Promise<void> => {
    if (config.dryRun) {
      tracker.call(contracts.runnerDry, { line: due.line, repo: due.repo }, RUNNER);
      return;
    }
    const checkout = await checkoutFor(due.repo);
    if ("error" in checkout) {
      failStart(due, undefined, checkout.error);
      return;
    }
    const name = due.name ?? null;
    const planned = name === null ? null : join(config.worktrees, name);
    const started = tracker.call(
      contracts.runnerStart,
      { line: due.line, repo: due.repo, ...(planned === null ? {} : { worktree: planned }) },
      RUNNER,
    );
    const worktree = join(config.worktrees, started.name);
    const branch = `octo/${started.name}`;
    if (!shell.exists(worktree)) {
      const added = await shell.run(["git", "-C", checkout.path, "worktree", "add", "-b", branch, worktree]);
      if (added.code !== 0) {
        tracker.call(
          contracts.runnerExited,
          { name: started.name, code: added.code, output: added.stderr.trim() },
          RUNNER,
        );
        return;
      }
      tracker.call(
        contracts.runnerWorktree,
        { path: worktree, repo: due.repo, checkout: checkout.path, branch, agent: started.name },
        RUNNER,
      );
    }
    for (const step of config.repos[due.repo]?.setup ?? []) {
      const ran = await shell.run(step, worktree);
      if (ran.code !== 0) {
        tracker.call(
          contracts.runnerExited,
          { name: started.name, code: ran.code, output: `${step.join(" ")}: ${ran.stderr.trim()}` },
          RUNNER,
        );
        return;
      }
    }
    const command = config.repos[due.repo]?.start ?? config.start;
    const session = shell.start(fill(command, due.line, started.name), {
      cwd: worktree,
      env: { OCTO_AGENT: started.name },
    });
    const recorded: Promise<void> = session.exited
      .then(({ code, output }) => {
        tracker.call(contracts.runnerExited, { name: started.name, code, output }, RUNNER);
      })
      .catch((error) => console.error("[runner]", error))
      .finally(() => sessions.delete(recorded));
    sessions.add(recorded);
  };

  const closeEnded = async () => {
    for (const close of tracker.call(contracts.runnerCloses, {}, RUNNER)) {
      if (config.dryRun) {
        tracker.call(contracts.runnerClosed, { pr: close.pr, dry: true }, RUNNER);
        continue;
      }
      const state = tracker.call(contracts.lineShow, { ref: close.line }, RUNNER).line.state;
      const closed = await shell.run([
        "gh",
        "pr",
        "close",
        String(close.number),
        "--repo",
        close.repo,
        "--comment",
        `Closed with ${close.line}, which is ${state} in Octotrack.`,
      ]);
      if (closed.code === 0) tracker.call(contracts.runnerClosed, { pr: close.pr }, RUNNER);
      else console.error(`[runner] closing ${close.pr}: ${closed.stderr.trim()}`);
    }
  };

  /** Only a worktree Octotrack made, with nothing uncommitted and nothing unpushed, and no session on it. */
  const removeUnused = async () => {
    for (const tree of tracker.call(contracts.runnerCleanups, {}, RUNNER)) {
      const status = await shell.run(["git", "-C", tree.path, "status", "--porcelain"]);
      if (status.code !== 0 || status.stdout.trim() !== "") continue;
      // Commits on no remote at all, which also covers a branch that was never pushed and has no upstream.
      const unpushed = await shell.run([
        "git",
        "-C",
        tree.path,
        "rev-list",
        "--count",
        "HEAD",
        "--not",
        "--remotes",
      ]);
      if (unpushed.code !== 0 || unpushed.stdout.trim() !== "0") continue;
      const removed = await shell.run(["git", "-C", tree.checkout, "worktree", "remove", tree.path]);
      if (removed.code === 0) tracker.call(contracts.runnerRemoved, { path: tree.path }, RUNNER);
    }
  };

  return {
    async tick() {
      if (busy) return;
      busy = true;
      try {
        for (const due of tracker.call(contracts.runnerDue, {}, RUNNER)) await startOne(due);
        await closeEnded();
        // Watch mode touches nothing on disk.
        if (!config.dryRun) await removeUnused();
      } finally {
        busy = false;
      }
    },
    async settled() {
      while (sessions.size > 0) await Promise.all(sessions);
    },
  };
}
