export type ErrorCode =
  | "invalid_input"
  | "invalid_query"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "version_mismatch"
  | "unknown_op"
  | "internal";

/** An error an agent can act on: a stable code, a message and, where possible, what to do next. */
export class OctoError extends Error {
  readonly code: ErrorCode;
  readonly hint: string | null;

  constructor(code: ErrorCode, message: string, hint: string | null = null) {
    super(message);
    this.name = "OctoError";
    this.code = code;
    this.hint = hint;
  }
}

/**
 * Input that does not fit an operation's schema: said in full for an agent or the CLI, but not something to show a
 * person as it is, since it is a bug in whatever sent it.
 */
export class InputError extends OctoError {
  constructor(message: string, hint: string | null = null) {
    super("invalid_input", message, hint);
    this.name = "InputError";
  }
}

export function notFound(ref: string): OctoError {
  return new OctoError(
    "not_found",
    `Nothing found for ${ref}`,
    "Use `octo find` to search for the right ref.",
  );
}
