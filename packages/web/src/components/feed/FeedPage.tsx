import { useRef } from "react";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { DEFAULT_VIEW } from "../../hooks/useFeed.ts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useMarkAllSeen } from "../../hooks/useMarkSeen.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { SyncFailures } from "../prs/SyncFailures.tsx";
import { FeedSection } from "./FeedSection.tsx";
import { FilterBox } from "./FilterBox.tsx";

/**
 * The log, as E-Feed draws it: what the developer has not seen, line by line in their order. A search goes through
 * the whole log instead.
 */
export function FeedPage() {
  const { params } = useRoute();
  const filter = useFilter();
  const seen = useMarkAllSeen();
  const includeWaiting = params.get("waiting") === "yes";
  const input = useRef<HTMLInputElement>(null);
  useHotkeys({ "/": () => input.current?.focus() });
  const searching = filter.query !== "";
  const { data: bootstrap } = useBootstrap();
  return (
    <div className="page page--narrow">
      <div className="log-head">
        <div>
          <h1 className="panel-title">Log</h1>
          <p className="log-sub">
            {searching
              ? "Everything that matches, newest first."
              : "What you have not seen, line by line, in your order. A line counts as seen once you open it, and what you did yourself is never unseen."}
          </p>
        </div>
        <div className="question-actions">
          <FilterBox
            filter={filter}
            inputRef={input}
            placeholder="Search"
            autoFocus={params.get("find") === "1"}
          />
          <button type="button" className="btn" onClick={seen.markAll}>
            Mark all seen
          </button>
        </div>
      </div>
      <SyncFailures failures={bootstrap?.syncFailures ?? []} />
      <FeedSection
        view={DEFAULT_VIEW}
        query={filter.query}
        unseen={!searching}
        includeWaiting={includeWaiting}
        onShowWaiting={() => setParams({ waiting: "yes" })}
        onFilter={filter.addTerm}
      />
    </div>
  );
}
