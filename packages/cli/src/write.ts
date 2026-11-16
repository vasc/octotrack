import { writeSync } from "node:fs";

/**
 * Every line octo prints goes through here, never through console.log or console.error.
 *
 * In Bun, reading process.stdout or process.stderr makes that pipe non-blocking, and console.log then drops whatever a
 * full pipe cannot take. Under `2>&1` both descriptors are one pipe, so a library that reads process.stderr when it
 * loads is enough for `octo show 2>&1 | jq` to receive half its JSON. Avoiding those reads was the first fix, and a
 * new dependency undid it. Writing to the descriptor and waiting out a full pipe holds whoever touched the streams.
 */
export function print(text: string): void {
  writeAll(1, `${text}\n`);
}

/** A line on standard error: warnings, notices and failures. */
export function printError(text: string): void {
  writeAll(2, `${text}\n`);
}

const pause = new Int32Array(new SharedArrayBuffer(4));

function writeAll(descriptor: number, text: string): void {
  let rest = Buffer.from(text);
  while (rest.length > 0) {
    try {
      rest = rest.subarray(writeSync(descriptor, rest));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EAGAIN")) throw error;
      // The pipe is full and non-blocking: give its reader a millisecond, then offer the rest again.
      Atomics.wait(pause, 0, 0, 1);
    }
  }
}
