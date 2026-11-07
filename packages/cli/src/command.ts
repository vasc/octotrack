import type { Drift } from "@octotrack/core";
import type { Args, OptionSpecs } from "./args.ts";
import type { OctoClient, OpSuccess } from "./client.ts";
import { renderDriftNotice } from "./render.ts";

export interface Output {
  json: boolean;
  /** One result. In JSON mode, prints the whole envelope. In text mode, prints the rendered text. */
  result(outcome: OpSuccess, text: () => string, ok?: boolean): void;
  /** Raw data that has no envelope. */
  data(value: unknown, text: () => string): void;
  /** A line of a stream. */
  line(value: unknown, text: () => string): void;
}

export function makeOutput(json: boolean): Output {
  const printDrift = (drifts: readonly Drift[]) => {
    const notice = renderDriftNotice(drifts);
    if (notice !== "") console.error(notice);
  };
  return {
    json,
    result(outcome, text, ok = true) {
      if (json) {
        console.log(JSON.stringify({ ok, ...outcome }));
        return;
      }
      console.log(text());
      printDrift(outcome.driftOpened);
    },
    data(value, text) {
      if (json) console.log(JSON.stringify({ ok: true, data: value }));
      else console.log(text());
    },
    line(value, text) {
      if (json) console.log(JSON.stringify(value));
      else console.log(text());
    },
  };
}

export interface RunContext {
  client: OctoClient;
  out: Output;
  mainScript: string;
}

export interface Command {
  /** For example ["issue", "create"]. */
  path: readonly string[];
  summary: string;
  /** Positional part of the usage line, such as "<title>". */
  usage?: string;
  options?: OptionSpecs;
  examples?: readonly string[];
  /** The operations this command reaches. A test checks that every operation appears somewhere. */
  ops: readonly string[];
  /** Returns the exit code, 0 when omitted. */
  run(ctx: RunContext, args: Args): Promise<number | undefined> | Promise<void>;
}
