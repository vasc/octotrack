export interface BuzzInput {
  urgent: boolean;
  /** The line's place in Working on, from 0. */
  lineIndex: number;
  /** When this line last buzzed the phone. */
  lineBuzzedAt: string | null;
  /** When the developer last opened the app. */
  lastOpenedAt: string | null;
}

/** How many lines, from the top of Working on, may interrupt the developer. */
export const BUZZING_LINES = 2;

/**
 * Interruptions are rare (docs/DESIGN.md): urgent questions always buzz; otherwise only the top two lines do, and each
 * at most once until the developer next opens the app. Tasks never reach this: they wait for "I'm at".
 */
export function shouldBuzz(input: BuzzInput): boolean {
  if (input.urgent) return true;
  if (input.lineIndex >= BUZZING_LINES) return false;
  if (input.lineBuzzedAt === null) return true;
  return input.lastOpenedAt !== null && input.lineBuzzedAt <= input.lastOpenedAt;
}
