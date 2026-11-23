/** Where Bun puts the code of a compiled binary: a virtual file system, under a different root on Windows. */
const EMBEDDED_ROOTS = ["/$bunfs/", "B:/~BUN/", "B:\\~BUN\\"];

/**
 * The command that runs octo again, for starting the server. A compiled binary is its own program, and its script
 * path is virtual, so passing that path would read as an unknown command; run as a script, Bun needs the path.
 */
export function selfCommand(script: string, execPath: string): string[] {
  return EMBEDDED_ROOTS.some((root) => script.startsWith(root)) ? [execPath] : [execPath, script];
}
