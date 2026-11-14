import { DEFAULT_VIEW, useFeed } from "../../hooks/useFeed.ts";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { FeedList } from "./FeedList.tsx";

export interface FeedSectionProps {
  view?: string;
  query: string;
  /** Only what changed on a line since the developer last looked at it. */
  unseen?: boolean;
  onFilter(term: string): void;
}

/** Loads the feed for a view and a query, and pages through it. */
export function FeedSection({ view = DEFAULT_VIEW, query, unseen = false, onFilter }: FeedSectionProps) {
  const feed = useFeed(view, query, unseen);
  if (feed.error !== null && feed.events.length === 0) return <ErrorState error={feed.error} />;
  if (feed.isPending) return <LoadingState label="Loading the feed" />;
  if (feed.stillSearching) return <LoadingState label="Searching older events" />;
  if (feed.events.length === 0) {
    return (
      <EmptyState>
        {unseen ? "Nothing new since you last looked." : "Nothing matches this filter."}
      </EmptyState>
    );
  }
  return (
    <>
      <FeedList events={feed.events} onFilter={onFilter} />
      {feed.hasNextPage ? (
        <button
          type="button"
          className="btn"
          disabled={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? "Loading..." : "Older"}
        </button>
      ) : null}
    </>
  );
}
