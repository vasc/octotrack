import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { z } from "zod";
import type { Contract } from "../src/contracts.ts";
import type { SqlDriver, SqlValue } from "../src/db/driver.ts";
import type { Caller } from "../src/tracker.ts";
import { Tracker } from "../src/tracker.ts";

function bindings(params: readonly SqlValue[]): SQLQueryBindings[] {
  return [...params];
}

function memoryDriver(): SqlDriver {
  const db = new Database(":memory:", { strict: true });
  db.exec("PRAGMA foreign_keys = ON");
  let depth = 0;
  return {
    all: (sql, params = []) => db.query(sql).all(...bindings(params)),
    run: (sql, params = []) => ({ changes: db.query(sql).run(...bindings(params)).changes }),
    exec: (sql) => {
      db.exec(sql);
    },
    transaction: (fn) => {
      const savepoint = `sp_${depth}`;
      db.exec(depth === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`);
      depth += 1;
      try {
        const result = fn();
        depth -= 1;
        db.exec(depth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        depth -= 1;
        db.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw error;
      }
    },
  };
}

export interface Harness {
  tracker: Tracker;
  /** Moves the clock, for anything time based. */
  setNow(iso: string): void;
  call<I extends z.ZodType, O extends z.ZodType>(
    contract: Contract<I, O>,
    input: z.input<I>,
    actor?: string,
  ): z.output<O>;
  as: Caller;
}

export function harness(start = "2026-11-07T12:00:00.000Z"): Harness {
  let now = start;
  const tracker = new Tracker(memoryDriver(), () => now);
  const as: Caller = { actor: "agent-a", channel: "cli" };
  return {
    tracker,
    as,
    setNow(iso) {
      now = iso;
    },
    call(contract, input, actor = as.actor) {
      return tracker.call(contract, input, { actor, channel: "cli" });
    },
  };
}
