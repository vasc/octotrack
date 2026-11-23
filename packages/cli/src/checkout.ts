/**
 * The git checkout a command runs in, which the server uses with the agent's name to tell sessions apart and to read
 * which repo it serves. Null outside a checkout.
 */
export function findCheckout(cwd: string): string | null {
  const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
    cwd,
    stdout: "pipe",
    stderr: "ignore",
  });
  if (result.exitCode !== 0) return null;
  const path = result.stdout.toString().trim();
  return path === "" ? null : path;
}
