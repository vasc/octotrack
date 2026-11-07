import type { DecisionLine } from "@octotrack/core/decision-lines";

export interface BatchResultLine {
  ref: string;
  ok: boolean;
  error: string | null;
}

export interface BatchPanelViewProps {
  text: string;
  parsed: readonly DecisionLine[];
  parseError: string | null;
  results: readonly BatchResultLine[] | null;
  submitting: boolean;
  onChange(text: string): void;
  onSubmit(): void;
}

/** Decisions made elsewhere, typed in as fast as they can be remembered. */
export function BatchPanelView(props: BatchPanelViewProps) {
  const { text, parsed, parseError, results, submitting, onChange, onSubmit } = props;
  return (
    <form
      className="batch"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="batch-lines" className="section-title">
        Log decisions made elsewhere
      </label>
      <textarea
        id="batch-lines"
        className="field"
        spellCheck={false}
        placeholder={"D-3 redis Agreed on the call\nD-4 a\nD-5 - None of the options, doing this instead"}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
      {parseError === null ? null : (
        <p className="error-text" role="alert">
          {parseError}
        </p>
      )}
      {results === null ? null : (
        <ul className="rows" aria-label="Results">
          {results.map((result) => (
            <li className="row" key={result.ref}>
              <span className="ref">{result.ref}</span>
              {result.ok ? <span>recorded</span> : <span className="error-text">{result.error}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="page-head">
        <span className="muted">One per line: ref, option key, then an optional note.</span>
        <button
          type="submit"
          className="btn"
          data-primary="true"
          disabled={parsed.length === 0 || parseError !== null || submitting}
        >
          Record {parsed.length === 0 ? "" : parsed.length}
        </button>
      </div>
    </form>
  );
}
