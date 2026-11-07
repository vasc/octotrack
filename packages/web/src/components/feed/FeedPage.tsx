import { useRef } from "react";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { DEFAULT_VIEW } from "../../hooks/useFeed.ts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { QueueSection } from "../decisions/QueueSection.tsx";
import { PrStrip } from "../prs/PrStrip.tsx";
import { EmptyState } from "../ui/states.tsx";
import { FeedSection } from "./FeedSection.tsx";
import { FilterBox } from "./FilterBox.tsx";
import { ViewTabs } from "./ViewTabs.tsx";

/** The primary screen: what needs a decision, then what has been happening, all under one filter. */
export function FeedPage() {
  const { data } = useBootstrap();
  const { params } = useRoute();
  const filter = useFilter();
  const view = params.get("view") ?? DEFAULT_VIEW;
  const views = data?.views ?? [];
  const viewQuery = views.find((item) => item.name === view)?.query ?? "";
  const scope = [viewQuery, filter.query]
    .filter((part) => part !== "")
    .map((part) => `(${part})`)
    .join(" ");

  const input = useRef<HTMLInputElement>(null);
  useHotkeys({ "/": () => input.current?.focus() });

  const isEmpty = data !== undefined && data.projects.length === 0 && data.feed.events.length === 0;

  return (
    <div className="page">
      <PrStrip cards={data?.prs ?? []} />
      <FilterBox filter={filter} inputRef={input} />
      <ViewTabs
        views={views}
        active={view}
        onSelect={(name) => setParams({ view: name === DEFAULT_VIEW ? null : name })}
      />
      {isEmpty ? (
        <EmptyState command={"octo guide\nocto project create OCT Octotrack --repo owner/name"}>
          Nothing here yet. Point your agents at the guide, or create a project.
        </EmptyState>
      ) : (
        <>
          <QueueSection query={scope} isDefault={view === DEFAULT_VIEW && filter.query === ""} />
          <FeedSection view={view} query={filter.query} onFilter={filter.addTerm} />
        </>
      )}
    </div>
  );
}
