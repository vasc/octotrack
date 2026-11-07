import { OctoError } from "./errors.ts";
import { normalizeRef } from "./refs.ts";

export interface DecisionLine {
  ref: string;
  option: string | null;
  note: string | null;
}

/**
 * Parses the shorthand for logging decisions made elsewhere, one per line:
 *
 *   D-3 a Went with postgres after the call
 *   D-4 b
 *   D-5 - No option fit, we are doing neither
 *
 * Blank lines and lines starting with # are ignored. `-` means no listed option was chosen.
 */
export function parseDecisionLines(text: string): DecisionLine[] {
  const parsed: DecisionLine[] = [];
  for (const [index, rawLine] of text.split("\n").entries()) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = /^(D-\d+)\s+(\S+)(?:\s+(.+))?$/i.exec(line);
    const ref = match?.[1];
    const option = match?.[2];
    if (ref === undefined || option === undefined) {
      throw new OctoError(
        "invalid_input",
        `Line ${index + 1} is not understood: ${line}`,
        "Expected: D-3 <option-key> [note], or D-3 - <note> when no option applies.",
      );
    }
    parsed.push({
      ref: normalizeRef(ref),
      option: option === "-" ? null : option,
      note: match?.[3] ?? null,
    });
  }
  return parsed;
}
