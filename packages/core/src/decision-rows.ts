import { OctoError } from "./errors.ts";
import { normalizeRef } from "./refs.ts";

export interface DecisionRow {
  ref: string;
  option: string | null;
  note: string | null;
}

/**
 * Parses the shorthand for logging decisions made elsewhere, one per row:
 *
 *   D-3 a Went with postgres after the call
 *   D-4 b
 *   D-5 - No option fit, we are doing neither
 *
 * Blank rows and rows starting with # are ignored. `-` means no listed option was chosen.
 */
export function parseDecisionRows(text: string): DecisionRow[] {
  const parsed: DecisionRow[] = [];
  for (const [index, rawRow] of text.split("\n").entries()) {
    const row = rawRow.trim();
    if (row === "" || row.startsWith("#")) continue;
    const match = /^(D-\d+)\s+(\S+)(?:\s+(.+))?$/i.exec(row);
    const ref = match?.[1];
    const option = match?.[2];
    if (ref === undefined || option === undefined) {
      throw new OctoError(
        "invalid_input",
        `Row ${index + 1} is not understood: ${row}`,
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
