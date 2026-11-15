import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { type Caller, contracts, type RunnerDue, type Tracker } from "@octotrack/core";
import { z } from "zod";
import { childEnv } from "./env.ts";
import { octoHome } from "./paths.ts";
import { githubSlug } from "./remotes.ts";
import { NOT_STARTED, runProcess } from "./spawn.ts";

/**
 * The developer's own setup for starting sessions, in `~/.octotrack/agent-setup.json`, edited only on this machine and
 * never by an operation (docs/DESIGN.md, D12). Commands carry only `{line}` and `{name}`, so tracker text never
 * becomes a prompt.
 */
export const RunnerConfig = z.object({
  /** The start command, such as ["claude", "-p", "You are {name}. Run octo line take {line}."]. */
  start: z.array(z.string().min(1)).min(1),
  /** Run when the developer stops an agent, with only `{name}` filled in, such as ["tmux", "kill-session", "-t", "{name}"]. */
  stop: z.array(z.string().min(1)).min(1).optional(),
  /** How many sessions Octotrack may have running at once. */
  cap: z.number().int().min(0).default(1),
  /** Watch mode: record what would be started, start nothing. On until the developer turns it off. */
  dryRun: z.boolean().default(true),
  /** Where new worktrees go: under this install's own home, so a test install never works in the live one's. */
  worktrees: z.string().default(() => join(octoHome(), "worktrees")),
  /** Where a repo with no checkout here is cloned: under this install's own home, as worktrees are. */
  clones: z.string().default(() => join(octoHome(), "clones")),
  /** Where each session's output is kept, so a session outlives a server restart and its last words are still read. */
  logs: z.string().default(() => join(octoHome(), "sessions")),
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
  /** Runs a command to its end, or kills it at its deadline (by default, the one for git and gh). */
  run(argv: readonly string[], cwd?: string, deadlineMs?: number): Promise<RunResult>;
  /**
   * Starts a session in a process group of its own, its output going to `log`, so that Stop ends all of it and it
   * outlives a server restart. Its process id is null when it could not be started.
   */
  start(
    argv: readonly string[],
    options: { cwd: string; env: Record<string, string>; log: string },
  ): { pid: number | null; exited: Promise<{ code: number; output: string }> };
  /** Ends a session's whole process group: what Stop does to a session the runner started. */
  end(pid: number): void;
  /**
   * Whether the process a session was spawned as still runs: how one from before a server restart is watched. A
   * process with that id that started later is another one, the id reused.
   */
  alive(pid: number, spawnedAt: string): Promise<boolean>;
  exists(path: string): boolean;
  /** Moves a finished clone into place, so that a clone cut short is never found where a checkout is looked for. */
  move(from: string, to: string): void;
  remove(path: string): void;
}

const RUNNER: Caller = { actor: "octotrack", channel: "cli", system: true };
/** git and gh answer in seconds; this is generous, then the command is given up on. */
const COMMAND_DEADLINE_MS = 120_000;
/** A repo's setup, such as installing its dependencies, can take minutes on a cold cache; so can a first clone. */
const SETUP_DEADLINE_MS = 30 * 60_000;
/** The developer's stop command ends a session; one still going after this is not going to. */
const STOP_DEADLINE_MS = 10 * 60_000;
/** How long a session's process group has to end after SIGTERM before it is killed. */
const END_GRACE_MS = 10_000;
/** A process that started this much after a session was spawned is another one, with its id reused. */
const PID_REUSED_AFTER_MS = 120_000;
const OUTPUT_KEPT = 4000;
/**
 * The only names and refs filled into the developer's commands: an agent's narrow name, letters and digits of any
 * language, dots, dashes and underscores, from a letter or digit. A name such as `*` or `-rf` would be read by the
 * command as a pattern or an option.
 */
const SAFE_NAME = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;

export function loadRunnerConfig(path: string): RunnerConfig | null {
  if (!existsSync(path)) return null;
  try {
    return RunnerConfig.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    console.error(`[runner] ignoring ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** The last of a session's output, from its log. */
async function tailOf(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) return "";
  const size = file.size;
  // Four bytes a character at most: enough bytes for the characters kept, cut at a character's start or not.
  const text = await file.slice(Math.max(0, size - OUTPUT_KEPT * 4)).text();
  return text.slice(-OUTPUT_KEPT);
}

/** Seconds from ps's elapsed time, [[dd-]hh:]mm:ss. */
function elapsedSeconds(etime: string): number | null {
  const match = /^(?:(?:(\d+)-)?(\d+):)?(\d+):(\d+)$/.exec(etime.trim());
  if (match === null) return null;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds);
}

/**
 * Runs commands with no shell, so nothing in a name or a path can be read as a command, and with no agent's name or the
 * developer's presence from the server's own environment: a session is told only its own name.
 */
export const processShell: RunnerShell = {
  run(argv, cwd, deadlineMs = COMMAND_DEADLINE_MS) {
    return runProcess(argv, { ...(cwd === undefined ? {} : { cwd }), env: childEnv(), deadlineMs });
  },
  start(argv, options) {
    // A session runs as long as its work takes: only the developer's Stop ends it early. Its output goes to a file, not
    // a pipe, so that it can outlive this server without being cut off when it next writes.
    mkdirSync(dirname(options.log), { recursive: true });
    const fd = openSync(options.log, "a");
    try {
      const child = Bun.spawn([...argv], {
        cwd: options.cwd,
        env: childEnv(options.env),
        stdin: "ignore",
        stdout: fd,
        stderr: fd,
        detached: true,
      });
      const exited = child.exited.then(async (code) => ({ code, output: await tailOf(options.log) }));
      return { pid: child.pid, exited };
    } catch (error) {
      return {
        pid: null,
        exited: Promise.resolve({
          code: NOT_STARTED,
          output: error instanceof Error ? error.message : String(error),
        }),
      };
    } finally {
      closeSync(fd);
    }
  },
  end(pid) {
    const signal = (name: "SIGTERM" | "SIGKILL") => {
      try {
        process.kill(-pid, name);
        return true;
      } catch {
        return false;
      }
    };
    if (!signal("SIGTERM")) return;
    // Whatever ignores SIGTERM is killed once the grace is over.
    setTimeout(() => signal("SIGKILL"), END_GRACE_MS).unref();
  },
  async alive(pid, spawnedAt) {
    const ps = await runProcess(["ps", "-o", "etime=", "-p", String(pid)], {
      env: childEnv(),
      deadlineMs: 10_000,
    });
    const seconds = ps.code === 0 ? elapsedSeconds(ps.stdout) : null;
    if (seconds === null) return false;
    return Date.now() - seconds * 1000 <= Date.parse(spawnedAt) + PID_REUSED_AFTER_MS;
  },
  exists: existsSync,
  move: renameSync,
  remove(path) {
    rmSync(path, { recursive: true, force: true });
  },
};

/** Whether a path is a folder or inside it: `/wt-panel` is not inside `/wt`. */
function isInside(path: string, folder: string): boolean {
  const base = folder.endsWith(sep) ? folder.slice(0, -1) : folder;
  return path === base || path.startsWith(`${base}${sep}`);
}

function fill(command: readonly string[], line: string, name: string): string[] {
  return command.map((part) => part.replaceAll("{line}", line).replaceAll("{name}", name));
}

export interface Runner {
  /**
   * Begins what is due, ends what was stopped, closes what ended, removes what nobody uses. Never runs twice at once,
   * and never waits on a start's worktree or setup, which go on in the background.
   */
  tick(): Promise<void>;
  /** Resolves when every start begun so far has spawned its session or given up. */
  prepared(): Promise<void>;
  /** Resolves when every start begun so far has been prepared, and every session spawned has exited and been recorded. */
  settled(): Promise<void>;
}

/** Runs one thing after another per key: two starts in one repo never clone it, or add worktrees to it, at once. */
function serialized(): <T>(key: string, task: () => Promise<T>) => Promise<T> {
  const tails = new Map<string, Promise<unknown>>();
  return (key, task) => {
    const run = (tails.get(key) ?? Promise.resolve()).then(task, task);
    tails.set(
      key,
      run.catch(() => undefined),
    );
    return run;
  };
}

export function createRunner(options: {
  tracker: Tracker;
  config: RunnerConfig;
  shell?: RunnerShell;
}): Runner {
  const { tracker, config, shell = processShell } = options;
  /** Sessions this runner spawned and is watching, by name, with their process ids. */
  const spawned = new Map<string, number>();
  const sessions = new Set<Promise<void>>();
  const preparing = new Set<Promise<void>>();
  const inTurn = serialized();
  let busy = false;

  tracker.call(contracts.runnerReport, { configured: true, cap: config.cap, dryRun: config.dryRun }, RUNNER);

  /** Sessions this runner did not spawn but whose process may run: from before a restart, watched by process id. */
  const unwatched = () =>
    tracker
      .call(contracts.runnerLive, {}, RUNNER)
      .flatMap((live) =>
        spawned.has(live.name) || live.pid === null || live.spawnedAt === null
          ? []
          : [{ name: live.name, pid: live.pid, spawnedAt: live.spawnedAt }],
      );

  /**
   * Sessions started before this server did are settled, unless their process still runs: those keep their line, their
   * worktree and their slot, and are watched by process id until they end (third audit, N10).
   */
  const restarted = (async () => {
    const alive: string[] = [];
    for (const live of tracker.call(contracts.runnerLive, {}, RUNNER)) {
      if (live.pid !== null && live.spawnedAt !== null && (await shell.alive(live.pid, live.spawnedAt))) {
        alive.push(live.name);
      }
    }
    tracker.call(contracts.runnerRestarted, { alive }, RUNNER);
  })();

  const ended = (name: string, code: number, output: string) =>
    tracker.call(contracts.runnerExited, { name, code, output }, RUNNER);

  /** The GitHub repo a checkout's origin points at, to compare with the one a repo names. */
  const originOf = async (path: string): Promise<string | null> => {
    const remote = await shell.run(["git", "-C", path, "remote", "get-url", "origin"]);
    return remote.code === 0 ? githubSlug(remote.stdout) : null;
  };
  const sameRepo = (found: string | null, slug: string | null) =>
    slug !== null && found !== null && found.toLowerCase() === slug.toLowerCase();

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
    const project = tracker.call(contracts.entityShow, { ref: repo }, RUNNER).entity;
    // The checkout the developer set, from Step in or octo repo checkout.
    if ("checkout" in project && typeof project.checkout === "string") return { path: project.checkout };
    const slug = "repo" in project && typeof project.repo === "string" ? project.repo : null;
    // One an agent works in, only if its origin is this repo: an agent says which repo it serves, and could be wrong.
    const known = tracker
      .call(contracts.agentList, {}, RUNNER)
      .flatMap((agent) =>
        agent.repo === repo && agent.checkout !== null && !isInside(agent.checkout, config.worktrees)
          ? [agent.checkout]
          : [],
      );
    for (const checkout of new Set(known)) {
      const main = await mainCheckout(checkout);
      if (sameRepo(await originOf(main), slug)) return { path: main };
    }
    const target = join(config.clones, repo.toLowerCase());
    if (shell.exists(target)) {
      // Something else may live at that path; only a whole clone of this repo will do.
      const found = await originOf(target);
      if (!sameRepo(found, slug)) {
        return {
          error: `${target} is not a clone of ${slug ?? repo}${found === null ? "" : ` (it is ${found})`}; set a checkout for ${repo} in agent-setup.json`,
        };
      }
      const head = await shell.run(["git", "-C", target, "rev-parse", "--verify", "HEAD"]);
      if (head.code !== 0) {
        return {
          error: `${target} is not a whole clone of ${slug ?? repo}; remove it, or set a checkout for ${repo} in agent-setup.json`,
        };
      }
      return { path: target };
    }
    if (slug === null) return { error: `${repo} has no GitHub repo to clone, and no checkout is set for it` };
    // Cloned beside its place, and moved there only once whole: a clone cut short is cleared away, never used.
    const partial = `${target}.partial`;
    if (shell.exists(partial)) shell.remove(partial);
    const cloned = await shell.run(["gh", "repo", "clone", slug, partial], undefined, SETUP_DEADLINE_MS);
    if (cloned.code !== 0) {
      shell.remove(partial);
      return { error: `Cloning ${slug} failed: ${cloned.stderr.trim()}` };
    }
    shell.move(partial, target);
    return { path: target };
  };

  /** The worktree a session starts in: handed on, or made now on its branch. Null when it could not be made. */
  const worktreeFor = async (
    started: { name: string; worktree: string | null; ownBranch: boolean },
    due: RunnerDue,
    checkout: string,
  ): Promise<string | null> => {
    // A gone session's worktree, handed on for this line, or the one a retry had, else a new one named after it.
    const worktree = started.worktree ?? join(config.worktrees, started.name);
    if (started.worktree !== null || shell.exists(worktree)) return worktree;
    const branch = `octo/${started.name}`;
    let added = await shell.run(["git", "-C", checkout, "worktree", "add", "-b", branch, worktree]);
    if (added.code !== 0 && added.stderr.includes("already exists")) {
      // A retry whose worktree was removed meanwhile: its branch is still there, with whatever it had. A branch of that
      // name that Octotrack did not make for this session is someone else's, and is never taken over.
      if (!started.ownBranch) {
        ended(
          started.name,
          added.code,
          `${branch} already exists, and Octotrack did not make it for ${started.name}: a new session never takes over a branch. Rename or delete it.`,
        );
        return null;
      }
      added = await shell.run(["git", "-C", checkout, "worktree", "add", worktree, branch]);
    }
    if (added.code !== 0) {
      ended(started.name, added.code, added.stderr.trim());
      return null;
    }
    tracker.call(
      contracts.runnerWorktree,
      { path: worktree, repo: due.repo, checkout, branch, agent: started.name },
      RUNNER,
    );
    return worktree;
  };

  /** Everything between reserving a start and its process running: checkout, worktree, setup, spawn. */
  const prepare = async (
    due: RunnerDue,
    started: { name: string; worktree: string | null; ownBranch: boolean },
  ): Promise<void> => {
    if (!SAFE_NAME.test(started.name) || !SAFE_NAME.test(due.line)) {
      ended(started.name, 1, `${started.name} for ${due.line} is not safe to fill into the start command`);
      return;
    }
    const checkout = await inTurn(`repo:${due.repo}`, () => checkoutFor(due.repo));
    if ("error" in checkout) {
      ended(started.name, 1, checkout.error);
      return;
    }
    const worktree = await inTurn(`checkout:${checkout.path}`, () =>
      worktreeFor(started, due, checkout.path),
    );
    if (worktree === null) return;
    for (const step of config.repos[due.repo]?.setup ?? []) {
      const ran = await shell.run(step, worktree, SETUP_DEADLINE_MS);
      if (ran.code !== 0) {
        ended(started.name, ran.code, `${step.join(" ")}: ${ran.stderr.trim()}`);
        return;
      }
    }
    const command = config.repos[due.repo]?.start ?? config.start;
    const session = shell.start(fill(command, due.line, started.name), {
      cwd: worktree,
      env: { OCTO_AGENT: started.name },
      log: join(config.logs, `${started.name}.log`),
    });
    if (session.pid !== null) {
      spawned.set(started.name, session.pid);
      // Its check-in starts now. Its line may have been tabled, or found an owner, while it was set up.
      const verdict = tracker.call(contracts.runnerSpawned, { name: started.name, pid: session.pid }, RUNNER);
      if (!verdict.go) shell.end(session.pid);
    }
    const recorded: Promise<void> = session.exited
      .then(({ code, output }) => {
        ended(started.name, code, output);
      })
      .catch((error) => console.error("[runner]", error))
      .finally(() => {
        spawned.delete(started.name);
        sessions.delete(recorded);
      });
    sessions.add(recorded);
  };

  /** Reserves the start at once, so no later tick starts the line again, then prepares it in the background. */
  const begin = (due: RunnerDue): void => {
    if (config.dryRun) {
      tracker.call(contracts.runnerDry, { line: due.line, repo: due.repo, role: due.role }, RUNNER);
      return;
    }
    const name = due.name ?? null;
    const planned = name === null ? null : join(config.worktrees, name);
    const started = tracker.call(
      contracts.runnerStart,
      { line: due.line, repo: due.repo, role: due.role, ...(planned === null ? {} : { worktree: planned }) },
      RUNNER,
    );
    const task: Promise<void> = prepare(due, started)
      .catch((error) => {
        console.error("[runner]", error);
        ended(started.name, 1, error instanceof Error ? error.message : String(error));
      })
      .finally(() => preparing.delete(task));
    preparing.add(task);
  };

  /** Sessions from before a restart whose process has ended since are recorded as exited. */
  const watchUnwatched = async () => {
    for (const live of unwatched()) {
      if (!(await shell.alive(live.pid, live.spawnedAt))) {
        ended(live.name, -1, "Its process ended while the server was not watching it.");
      }
    }
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

  /**
   * Stop, for each agent the developer stopped, once: the process group of a session the runner started is ended, or
   * else the developer's stop command, if one is set, is run for what the runner cannot see. Never both: the command is
   * for sessions the runner did not start (D13). Watch mode only notes it, and a name the command could misread is
   * never given to it.
   */
  const runStops = async () => {
    const before = new Map(unwatched().map((live) => [live.name, live]));
    for (const { name } of tracker.call(contracts.runnerStops, {}, RUNNER)) {
      if (config.dryRun) {
        tracker.call(contracts.runnerStopRan, { name, code: 0, output: "", dry: true }, RUNNER);
        continue;
      }
      let ended = false;
      const pid = spawned.get(name);
      const old = before.get(name);
      if (pid !== undefined) {
        shell.end(pid);
        ended = true;
      } else if (old !== undefined && (await shell.alive(old.pid, old.spawnedAt))) {
        shell.end(old.pid);
        ended = true;
      }
      // The stop command is only for what the runner cannot end itself (D13): a session it ended needs nothing more.
      if (config.stop === undefined || ended) {
        // Nothing more for a session the runner did not start and no command is set for: Stop refuses its writes.
        if (ended) {
          tracker.call(contracts.runnerStopRan, { name, code: 0, output: "", ended, command: false }, RUNNER);
        }
        continue;
      }
      if (!SAFE_NAME.test(name)) {
        tracker.call(
          contracts.runnerStopRan,
          { name, code: -1, output: `${name} is not a name the stop command can be given safely`, ended },
          RUNNER,
        );
        continue;
      }
      const ran = await shell.run(
        config.stop.map((part) => part.replaceAll("{name}", name)),
        undefined,
        STOP_DEADLINE_MS,
      );
      tracker.call(
        contracts.runnerStopRan,
        { name, code: ran.code, output: `${ran.stdout}${ran.stderr}`.slice(-OUTPUT_KEPT), ended },
        RUNNER,
      );
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

  const prepared = async () => {
    while (preparing.size > 0) await Promise.all(preparing);
  };

  return {
    async tick() {
      await restarted;
      if (busy) return;
      busy = true;
      try {
        for (const due of tracker.call(contracts.runnerDue, {}, RUNNER)) begin(due);
        await watchUnwatched();
        await runStops();
        await closeEnded();
        // Watch mode touches nothing on disk.
        if (!config.dryRun) await removeUnused();
      } finally {
        busy = false;
      }
    },
    prepared,
    async settled() {
      await prepared();
      while (sessions.size > 0) await Promise.all(sessions);
    },
  };
}
