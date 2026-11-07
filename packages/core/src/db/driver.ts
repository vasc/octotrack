export type SqlValue = string | number | null;

/**
 * The only thing core knows about storage. Deliberately synchronous: it maps directly onto bun:sqlite locally
 * and onto a SQLite-backed Durable Object (`storage.sql.exec`, `transactionSync`) if this moves to Cloudflare.
 * See docs/DESIGN.md, D3.
 */
export interface SqlDriver {
  all(sql: string, params?: readonly SqlValue[]): unknown[];
  run(sql: string, params?: readonly SqlValue[]): { changes: number };
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
}
