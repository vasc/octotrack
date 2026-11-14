import { useState } from "react";

/** Set its checkout…: where this machine already has a repo, an absolute path, after a clone failed. */
export function CheckoutForm({
  repo,
  onSet,
  onCancel,
}: {
  repo: string;
  onSet(path: string): void;
  onCancel(): void;
}) {
  const [path, setPath] = useState("");
  const valid = path.startsWith("/");
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSet(path);
      }}
    >
      <input
        className="field"
        aria-label={`Checkout of ${repo}`}
        placeholder="/Users/you/src/repo"
        value={path}
        // biome-ignore lint/a11y/noAutofocus: opened by the developer to type this path
        autoFocus
        onChange={(event) => setPath(event.target.value)}
      />
      <button type="submit" className="btn" data-primary="true" disabled={!valid}>
        Set
      </button>
      <button type="button" className="btn" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
