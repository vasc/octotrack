import type { Drift, Notice } from "@octotrack/core";
import type { Args, OptionSpecs } from "./args.ts";
import type { OctoClient, OpSuccess } from "./client.ts";
import { renderDriftNotice, renderNotices } from "./render.ts";
import { print, printError } from "./write.ts";

export interface Output {
  json: boolean;
  /** One result. In JSON mode, prints the whole envelope. In text mode, prints the rendered text. */
  result(outcome: OpSuccess, text: () => string, ok?: boolean): void;
  /** Raw data that has no envelope. */
  data(value: unknown, text: () => string): void;
  /** A line of a stream. */
  line(value: unknown, text: () => string): void;
}

/** Whatever tracks the notices a command was handed, so that each is shown exactly once. */
export interface NoticeLedger {
  shown(notices: readonly Notice[]): void;
}

export function makeOutput(json: boolean, ledger: NoticeLedger = { shown: () => undefined }): Output {
  const printDrift = (drifts: readonly Drift[]) => {
    const notice = renderDriftNotice(drifts);
    if (notice !== "") printError(notice);
  };
  return {
    json,
    result(outcome, text, ok = true) {
      ledger.shown(outcome.notices);
      if (json) {
        print(JSON.stringify({ ok, ...outcome }));
        return;
      }
      print(text());
      printDrift(outcome.driftOpened);
      const notices = renderNotices(outcome.notices);
      if (notices !== "") printError(notices);
    },
    data(value, text) {
      if (json) print(JSON.stringify({ ok: true, data: value }));
      else print(text());
    },
    line(value, text) {
      if (json) print(JSON.stringify(value));
      else print(text());
    },
  };
}

/** Shows the notices a command was handed but did not print itself: on stderr, as text or as one JSON line. */
export function printLeftoverNotices(notices: readonly Notice[], json: boolean): void {
  if (notices.length === 0) return;
  if (json) {
    printError(JSON.stringify({ notices }));
    return;
  }
  const text = renderNotices(notices);
  if (text !== "") printError(text);
}

export interface RunContext {
  client: OctoClient;
  out: Output;
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
