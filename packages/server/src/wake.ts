import { readFileSync } from "node:fs";
import { type Caller, contracts, type Decision, type Tracker } from "@octotrack/core";
import { z } from "zod";

const WakeAdapter = z.object({ command: z.array(z.string().min(1)).min(1) });
const WakeAdapters = z.record(z.string(), WakeAdapter);
export type WakeAdapters = z.infer<typeof WakeAdapters>;

export interface WakeResult {
  exitCode: number;
  stderr: string;
}

export type WakeRunner = (argv: readonly string[]) => Promise<WakeResult>;

const DISPATCHER: Caller = { actor: "octotrack", channel: "cli" };
const STDERR_KEPT = 300;
// A woken agent may work for a while before its command returns, and must not hold a process forever.
const WAKE_DEADLINE_MS = 30 * 60 * 1000;

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

/** No shell is involved, so that nothing in an address or a message can be read as a command. */
export const spawnWake: WakeRunner = async (argv) => {
  const child = Bun.spawn([...argv], { stdin: "ignore", stdout: "ignore", stderr: "pipe" });
  const deadline = setTimeout(() => child.kill("SIGKILL"), WAKE_DEADLINE_MS);
  try {
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    return { exitCode, stderr };
  } finally {
    clearTimeout(deadline);
  }
};

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
      const { exitCode, stderr } = await run(argv);
      if (exitCode !== 0) {
        record(decision.ref, `Exit ${exitCode}: ${stderr.trim().slice(0, STDERR_KEPT)}`);
      }
    } catch (error) {
      record(decision.ref, error instanceof Error ? error.message : String(error));
    }
  };

  const dispatch = async (): Promise<void> => {
    const due = tracker.call(contracts.decisionWakes, {}, DISPATCHER);
    await Promise.all(
      due.map((decision) => {
        const task = wake(decision).finally(() => running.delete(task));
        running.add(task);
        return task;
      }),
    );
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
