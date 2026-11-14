/** The GitHub repo, owner/name, a remote URL points at; null for anything not on GitHub. */
export function githubSlug(url: string): string | null {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match === null ? null : `${match[1]}/${match[2]}`;
}

/**
 * Reads a checkout's origin remote with git, the server's own look at where an agent works. Remembered per checkout:
 * a remote rarely changes, and git costs a process per call.
 */
export function cachedRemoteOf(
  run: (checkout: string) => string | null = (checkout) => {
    const result = Bun.spawnSync(["git", "-C", checkout, "remote", "get-url", "origin"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    return result.exitCode === 0 ? result.stdout.toString() : null;
  },
): (checkout: string) => string | null {
  const known = new Map<string, string | null>();
  return (checkout) => {
    if (!known.has(checkout)) {
      const url = run(checkout);
      known.set(checkout, url === null ? null : githubSlug(url));
    }
    return known.get(checkout) ?? null;
  };
}
