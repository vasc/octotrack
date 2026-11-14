import type { Line } from "@octotrack/core/schemas";

/**
 * The choices a proposal has, numbered for the keys, the recommended one filled: Start, Up next, Table, Fold into when
 * there is a line to fold into, and Not a line; or Drop for a line back from tabled, since it was a line.
 */
export function ProposalChoices({
  title,
  recommended,
  canFold,
  fromTable,
  onStart,
  onQueue,
  onTable,
  onFold,
  onReject,
  onDrop,
}: {
  title: string;
  recommended: Line["recommendation"];
  canFold: boolean;
  fromTable: boolean;
  onStart(): void;
  onQueue(): void;
  onTable(): void;
  onFold(): void;
  onReject(): void;
  onDrop(): void;
}) {
  const is = (placement: NonNullable<Line["recommendation"]>) => recommended === placement;
  const last = canFold ? "5" : "4";
  return (
    <div className="proposal-choices">
      <button
        type="button"
        className="btn"
        aria-label={`Start ${title}`}
        data-choice="1"
        data-primary={is("start")}
        onClick={onStart}
      >
        Start{is("start") ? " · recommended" : ""}
      </button>
      <button
        type="button"
        className="btn"
        aria-label={`Up next ${title}`}
        data-choice="2"
        data-primary={is("up_next")}
        onClick={onQueue}
      >
        Up next{is("up_next") ? " · recommended" : ""}
      </button>
      <button
        type="button"
        className="btn"
        aria-label={`Table ${title}`}
        data-choice="3"
        data-primary={is("table")}
        onClick={onTable}
      >
        Table
      </button>
      {canFold ? (
        <button
          type="button"
          className="btn"
          aria-label={`Fold ${title}`}
          data-choice="4"
          data-primary={is("fold")}
          onClick={onFold}
        >
          Fold into
        </button>
      ) : null}
      {fromTable ? (
        <button
          type="button"
          className="btn"
          data-quiet="true"
          aria-label={`Drop ${title}`}
          data-choice={last}
          onClick={onDrop}
        >
          Drop
        </button>
      ) : (
        <button
          type="button"
          className="btn"
          data-quiet="true"
          aria-label={`Not a line: ${title}`}
          data-choice={last}
          onClick={onReject}
        >
          Not a line
        </button>
      )}
    </div>
  );
}
