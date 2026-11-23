/**
 * Whether this CLI and the server it reached come from different builds. They share one binary, so they only differ
 * when the binary was replaced while an old server kept running, and then the server should be restarted.
 */
export function skewWarning(mine: string, server: string | null): string | null {
  if (server === null || server === mine) return null;
  return `warning: the server runs build ${server}, this octo is build ${mine}. Run octo server stop; the next command starts the new one.`;
}
