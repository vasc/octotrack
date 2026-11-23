import { readFileSync } from "node:fs";
import { DEFAULT_HOSTS } from "./app.ts";

/**
 * The names this server answers to: loopback, plus one name per line in the file, for reaching it through a proxy such as
 * `tailscale serve`. A file rather than an environment variable, because any `octo` command can start the server, and
 * that command's environment says nothing about how the developer reaches the dashboard. See docs/DESIGN.md, D10.
 */
export function loadAllowedHosts(path: string): readonly string[] {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return [...DEFAULT_HOSTS];
  }
  const listed = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  return [...DEFAULT_HOSTS, ...listed];
}
