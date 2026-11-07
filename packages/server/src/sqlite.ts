import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { SqlDriver, SqlValue } from "@octotrack/core";

function bindings(params: readonly SqlValue[]): SQLQueryBindings[] {
  return [...params];
}

/** The local SqlDriver. Nested transactions become savepoints, so operations can compose. */
export function openSqlite(path: string): SqlDriver {
  const db = new Database(path, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  let depth = 0;
  return {
    all: (sql, params = []) => db.query(sql).all(...bindings(params)),
    run: (sql, params = []) => {
      const result = db.query(sql).run(...bindings(params));
      return { changes: result.changes };
    },
    exec: (sql) => {
      db.exec(sql);
    },
    transaction: (fn) => {
      const savepoint = `sp_${depth}`;
      db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
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
