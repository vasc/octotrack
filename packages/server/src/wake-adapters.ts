import { readFileSync } from "node:fs";
import { z } from "zod";

/**
 * One way to wake an agent on this machine: the command it runs, and, for agents choosing one, what it fits and what
 * address to give it (`for` and `address`, plain words). See docs/DESIGN.md, D12.
 */
const WakeAdapter = z.object({
  command: z.array(z.string().min(1)).min(1),
  /** When an agent should use it, in plain words, such as "inside GNU screen". */
  for: z.string().optional(),
  /** What an agent gives after the colon, such as $STY; an agent reads its own value. */
  address: z.string().optional(),
});
export const WakeAdapters = z.record(z.string(), WakeAdapter);
export type WakeAdapters = z.infer<typeof WakeAdapters>;

/**
 * What a wake can run comes only from this file on the machine. With no authentication, a request naming its own command
 * would let any device that can reach the server run anything. See docs/DESIGN.md, D12.
 */
export function loadWakeAdapters(path: string): WakeAdapters {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  try {
    return WakeAdapters.parse(JSON.parse(content));
  } catch (error) {
    console.error(`[wake] ignoring ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}
