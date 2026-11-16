import type { ReactNode } from "react";

/**
 * Rows of the same few facts under column headings, one sheet with hairlines between rows, for a roster read across
 * as much as down. What follows the rows, such as a fold's "21 more", sits inside the sheet under them. On a phone the
 * headings step away and each row wraps: its lead and what acts on it, then its main cell, then its facts.
 */
export function Table({
  label,
  columns,
  foot,
  children,
}: {
  /** Names it for a screen reader. */
  label: string;
  /** The headings, in order; an empty one heads a column of actions. */
  columns: readonly string[];
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ui-table-sheet">
      <table className="ui-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              // A heading's place is its key: an empty heading has no words to key on.
              // biome-ignore lint/suspicious/noArrayIndexKey: the columns are fixed for the table's life
              <th key={index} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {foot === undefined ? null : <div className="ui-table-foot">{foot}</div>}
    </div>
  );
}

/**
 * One cell of a row, by the part it plays: the lead names the row, the main cell says the most, a fact is small and
 * grey, and trailing is what acts on it.
 */
export function Cell({
  place,
  children,
}: {
  place: "lead" | "main" | "fact" | "trailing";
  children?: ReactNode;
}) {
  return (
    <td className="ui-cell" data-place={place}>
      {children}
    </td>
  );
}
