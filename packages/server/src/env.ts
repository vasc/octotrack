/**
 * Who a process is, as the CLI reads it: an agent's name, or the developer present at a terminal. A process the server
 * or the CLI starts never inherits these from whoever happened to start the server, or a woken session would act as
 * another agent (docs/DESIGN.md, D13). Whoever starts it says who it is instead.
 */
const IDENTITY: ReadonlySet<string> = new Set(["OCTO_AGENT", "OCTO_DEVELOPER"]);

/** An environment with no identity in it, from one that may carry some. */
export function withoutIdentity(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && !IDENTITY.has(key)) clean[key] = value;
  }
  return clean;
}

/** The environment for a child of this process: its own, without identity, plus what the caller says it is. */
export function childEnv(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  return { ...withoutIdentity(process.env), ...extra };
}
