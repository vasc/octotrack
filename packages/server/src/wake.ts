import { readFileSync } from "node:fs";
import {
  type AgentWake,
  type Caller,
  contracts,
  type Decision,
  type Tracker,
  WAKE_DEADLINE_MS,
} from "@octotrack/core";
import { z } from "zod";
import { childEnv } from "./env.ts";
import { runProcess } from "./spawn.ts";

const WakeAdapter = z.object({ command: z.array(z.string().min(1)).min(1) });
const WakeAdapters = z.record(z.string(), WakeAdapter);
export type WakeAdapters = z.infer<typeof WakeAdapters>;

export interface WakeResult {
  exitCode: number;
  stderr: string;
  /** Killed at its deadline: it reached the session, which was still at work, so the wake did not fail. */
  timedOut?: boolean;
}

/**
 * Runs a wake command; `env` says who the woken session is, which is all of its identity it gets. `onSpawn` is told
 * its process id once it runs, so that Stop can end it.
 */
export type WakeRunner = (
  argv: readonly string[],
  env: Readonly<Record<string, string>>,
  onSpawn?: (pid: number) => void,
) => Promise<WakeResult>;

const DISPATCHER: Caller = { actor: "octotrack", channel: "cli", system: true };
const STDERR_KEPT = 300;

/**
 * What a wake can run comes only from this file on the machine. With no authentication, a request naming its own command
 * would let any device that can reach the server run anything. See docs/DESIGN.md, D12.
 */
export function loadWakeAdapters(path: string): WakeAdapters {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  try {
    return WakeAdapters.parse(JSON.parse(content));
  } catch (error) {
    console.error(`[wake] ignoring ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * No shell is involved, so that nothing in an address or a message can be read as a command. The woken session gets
 * its own name and never the server's: the server may have been started from another agent's shell. A woken agent may
 * work for a while before its command returns, and must not hold a process forever: at the deadline the wake is killed
 * with everything it started, the session included, which an adapter such as `octo adapter claude` runs as its child.
 */
export function wakeRunner(deadlineMs: number): WakeRunner {
  return async (argv, env, onSpawn) => {
    const { code, stderr, timedOut } = await runProcess(argv, {
      env: childEnv(env),
      deadlineMs,
      ...(onSpawn === undefined ? {} : { onSpawn }),
    });
    return { exitCode: code, stderr, timedOut };
  };
}

export const spawnWake: WakeRunner = wakeRunner(WAKE_DEADLINE_MS);

/** Says only that there is an answer. The agent reads it from the tracker, so tracker text never becomes a prompt. */
function wakeMessage(ref: string): string {
  return `Octotrack: ${ref} has been answered. Read it with: octo inbox --agent <your agent name>`;
}

function argvFor(command: readonly string[], address: string, message: string): string[] {
  return command.map((part) => part.replaceAll("{address}", address).replaceAll("{message}", message));
}

export interface WakeDispatcher {
  /** Wakes every session that is due, and resolves once their commands have returned. */
  dispatch(): Promise<void>;
  /** Dispatches after each change to the tracker. Returns how to stop. */
  listen(): () => void;
  /** Resolves when everything started so far has returned. */
  settled(): Promise<void>;
}

/** One loop for every session, so that no session has to hang on the tracker to hear about an answer. */
export function createWakeDispatcher(options: {
  tracker: Tracker;
  adapters: WakeAdapters;
  run?: WakeRunner;
}): WakeDispatcher {
  const { tracker, adapters, run = spawnWake } = options;
  const running = new Set<Promise<void>>();

  const record = (ref: string, error?: string) =>
    tracker.call(contracts.decisionWoken, { ref, ...(error === undefined ? {} : { error }) }, DISPATCHER);

  const wake = async (decision: Decision): Promise<void> => {
    const address = decision.wakeAddress ?? "";
    const split = address.indexOf(":");
    const name = address.slice(0, split);
    const adapter = adapters[name];
    if (adapter === undefined) {
      record(decision.ref, `No wake adapter named ${name}`);
      return;
    }
    // Recorded first: if this process dies mid-run, a session is left unwoken rather than woken twice.
    record(decision.ref);
    try {
      const argv = argvFor(adapter.command, address.slice(split + 1), wakeMessage(decision.ref));
      const { exitCode, stderr, timedOut } = await run(argv, { OCTO_AGENT: decision.requestedBy });
      // Killed at its deadline, it had reached its asker, which was at work: not a failed wake (fourth audit, A1).
      if (exitCode !== 0 && timedOut !== true) {
        record(decision.ref, `Exit ${exitCode}: ${stderr.trim().slice(0, STDERR_KEPT)}`);
      }
    } catch (error) {
      record(decision.ref, error instanceof Error ? error.message : String(error));
    }
  };

  const recordAgent = (name: string, error?: string) =>
    tracker.call(contracts.agentWoken, { name, ...(error === undefined ? {} : { error }) }, DISPATCHER);

  /** An agent on a line is woken at the address it registered, whatever is waiting for it. */
  const wakeAgent = async (due: AgentWake): Promise<void> => {
    const split = due.address.indexOf(":");
    const name = due.address.slice(0, split);
    const adapter = adapters[name];
    if (adapter === undefined) {
      recordAgent(due.agent, `No wake adapter named ${name}`);
      return;
    }
    // Recorded first: if this process dies mid-run, an agent is left unwoken rather than woken twice.
    recordAgent(due.agent);
    try {
      const { exitCode, stderr, timedOut } = await run(
        argvFor(adapter.command, due.address.slice(split + 1), due.message),
        { OCTO_AGENT: due.agent },
        // Its process is recorded while it runs: the cap counts it, and Stop ends it.
        (pid) => tracker.call(contracts.agentWoken, { name: due.agent, pid }, DISPATCHER),
      );
      // One killed at its deadline reached its session, which was at work: not a failed wake (fourth audit, A1).
      if (timedOut === true) {
        tracker.call(contracts.agentWoken, { name: due.agent, ended: "deadline" }, DISPATCHER);
      } else if (exitCode !== 0) {
        recordAgent(due.agent, `Exit ${exitCode}: ${stderr.trim().slice(0, STDERR_KEPT)}`);
      } else {
        tracker.call(contracts.agentWoken, { name: due.agent, ended: "exited" }, DISPATCHER);
      }
    } catch (error) {
      recordAgent(due.agent, error instanceof Error ? error.message : String(error));
    }
  };

  const track = (task: () => Promise<void>): Promise<void> => {
    const promise = task().finally(() => running.delete(promise));
    running.add(promise);
    return promise;
  };

  const dispatch = async (): Promise<void> => {
    const due = tracker.call(contracts.decisionWakes, {}, DISPATCHER);
    const agents = tracker.call(contracts.agentWakes, {}, DISPATCHER);
    await Promise.all([
      ...due.map((decision) => track(() => wake(decision))),
      ...agents.map((agent) => track(() => wakeAgent(agent))),
    ]);
  };

  return {
    dispatch,
    listen() {
      return tracker.subscribe(() => {
        // Later, because the change that got us here has not finished telling everyone yet.
        const task: Promise<void> = Promise.resolve()
          .then(dispatch)
          .catch((error) => console.error("[wake]", error))
          .finally(() => running.delete(task));
        running.add(task);
      });
    },
    async settled() {
      while (running.size > 0) await Promise.all(running);
    },
  };
}
