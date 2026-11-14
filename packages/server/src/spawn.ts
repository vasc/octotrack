/** How long output is still read once a command has exited: a child it left behind may hold the pipes open forever. */
const OUTPUT_GRACE_MS = 1000;
/** Enough of each stream to judge a command by and to show its last lines; the rest is let go as it arrives. */
const STREAM_KEPT = 64 * 1024;
/** What a command killed at its deadline exits with, as timeout(1) says it. */
export const TIMED_OUT = 124;
/** What a command that could not be started at all exits with, as a shell says it. */
export const NOT_STARTED = 127;

export interface Finished {
  code: number;
  stdout: string;
  stderr: string;
  /** Killed at its deadline, rather than exiting by itself. */
  timedOut: boolean;
}

/** Reads a stream as it comes, keeping its tail, so what arrived is there even if the stream never closes. */
function gather(
  stream: ReadableStream<Uint8Array>,
  kept: number,
): { done: Promise<void>; text: () => string } {
  const decoder = new TextDecoder();
  let text = "";
  const done = (async () => {
    for await (const chunk of stream) {
      text = `${text}${decoder.decode(chunk, { stream: true })}`.slice(-kept);
    }
    text = `${text}${decoder.decode()}`.slice(-kept);
  })().catch(() => undefined);
  return { done, text: () => text };
}

/** The promise's value, or null once the time is up. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs a command with no shell, so nothing in a name or a path can be read as a command. It is killed at its deadline,
 * if it has one, and answered once it exits even when something it started keeps its output open: the pipes are raced,
 * never waited on, as in gh.ts.
 */
export async function runProcess(
  argv: readonly string[],
  options: {
    cwd?: string;
    env: Record<string, string>;
    deadlineMs: number | null;
    /** How much of each stream to keep, for a command whose whole output is read, such as gh's JSON. */
    keep?: number;
    /** In its own process group, which it leads, so that ending the group ends everything it started. */
    detached?: boolean;
    /** Told the process id as soon as it is spawned, before it exits. */
    onSpawn?: (pid: number) => void;
  },
): Promise<Finished> {
  let child: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    child = Bun.spawn([...argv], {
      cwd: options.cwd,
      env: options.env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      detached: options.detached === true,
    });
    options.onSpawn?.(child.pid);
  } catch (error) {
    return {
      code: NOT_STARTED,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      timedOut: false,
    };
  }
  const stdout = gather(child.stdout, options.keep ?? STREAM_KEPT);
  const stderr = gather(child.stderr, STREAM_KEPT);
  const code =
    options.deadlineMs === null ? await child.exited : await within(child.exited, options.deadlineMs);
  if (code === null) child.kill("SIGKILL");
  await within(Promise.all([stdout.done, stderr.done]), OUTPUT_GRACE_MS);
  if (code === null) {
    const seconds = Math.round((options.deadlineMs ?? 0) / 1000);
    return {
      code: TIMED_OUT,
      stdout: stdout.text(),
      stderr: `${stderr.text()}\nKilled: ${argv[0] ?? "the command"} ran past its deadline of ${seconds}s`,
      timedOut: true,
    };
  }
  return { code, stdout: stdout.text(), stderr: stderr.text(), timedOut: false };
}
