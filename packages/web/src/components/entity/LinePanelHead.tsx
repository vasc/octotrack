import type { Line } from "@octotrack/core/schemas";
import { closeEntity } from "../../lib/router.ts";
import { Markdown } from "../ui/Markdown.tsx";

/** The top of a line opened: where it sits in the order, its ref and repos, its title, and what finishes it. */
export function LinePanelHead({
  line,
  position,
  repos,
}: {
  line: Line;
  /** "Line 2 of 5", for a line in the order. */
  position: string | null;
  /** Its repos, by GitHub name where one is set. */
  repos: readonly string[];
}) {
  return (
    <div className="panel-head">
      <div className="panel-crumbs">
        <span>
          {position === null ? null : <>{position} · </>}
          <span className="mono">{line.ref}</span>
          {repos.map((repo) => (
            <span key={repo}>
              {" "}
              · <span className="mono">{repo}</span>
            </span>
          ))}
        </span>
        <button type="button" className="btn" aria-label="Close" onClick={closeEntity}>
          Esc
        </button>
      </div>
      <h1 className="panel-title">{line.title}</h1>
      {line.doneWhen === "" ? null : (
        <p className="panel-done-when">
          <span className="muted">Done when</span> <Markdown text={line.doneWhen} inline />
        </p>
      )}
    </div>
  );
}
