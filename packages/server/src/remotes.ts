import { statSync } from "node:fs";
import { isAbsolute } from "node:path";

/** The GitHub repo, owner/name, a remote URL points at; null for anything not on GitHub. */
export function githubSlug(url: string): string | null {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match === null ? null : `${match[1]}/${match[2]}`;
}

/** git answers this from the checkout's own config in milliseconds; past this it is stuck, and a request waits on it. */
const REMOTE_DEADLINE_MS = 5000;
/** How many checkouts' remotes are remembered: each comes from a request header, so the list must not grow forever. */
const REMEMBERED = 1000;

/**
 * A checkout's origin URL, read with git. The path comes from a request header, so git runs only on an absolute path to
 * a folder that exists, with no shell, and is given up on at its deadline.
 */
export function gitRemote(
  checkout: string,
  command: readonly string[] = ["git", "-C", checkout, "remote", "get-url", "origin"],
  timeoutMs = REMOTE_DEADLINE_MS,
): string | null {
  if (!isAbsolute(checkout)) return null;
  try {
    if (!statSync(checkout).isDirectory()) return null;
  } catch {
    return null;
  }
  const result = Bun.spawnSync([...command], {
    stdout: "pipe",
    stderr: "ignore",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
  return result.exitCode === 0 ? result.stdout.toString() : null;
}

/**
 * The server's own look at where an agent works: a checkout's GitHub repo. Remembered per checkout, since a remote
 * rarely changes and git costs a process per call; the oldest is forgotten first once many are remembered.
 */
export function cachedRemoteOf(
  run: (checkout: string) => string | null = (checkout) => gitRemote(checkout),
  limit = REMEMBERED,
): (checkout: string) => string | null {
  const known = new Map<string, string | null>();
  return (checkout) => {
    if (!known.has(checkout)) {
      const url = run(checkout);
      known.set(checkout, url === null ? null : githubSlug(url));
      for (const oldest of known.keys()) {
        if (known.size <= limit) break;
        known.delete(oldest);
      }
    }
    return known.get(checkout) ?? null;
  };
}
