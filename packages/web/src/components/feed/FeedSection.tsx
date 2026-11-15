import { contracts } from "@octotrack/core/contracts";
import { DEFAULT_VIEW, useFeed } from "../../hooks/useFeed.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { FeedList } from "./FeedList.tsx";
import { UnseenLog } from "./UnseenLog.tsx";
import { logLines } from "../../lib/lines.ts";

export interface FeedSectionProps {
  view?: string;
  query: string;
  /** Only what changed on a line since the developer last looked at it, line by line. */
  unseen?: boolean;
  /** With unseen: up-next and tabled lines too. */
  includeWaiting?: boolean;
  onShowWaiting?: () => void;
  onFilter(term: string): void;
}

/** Loads the log for a view and a query, and pages through it. */
export function FeedSection({
  view = DEFAULT_VIEW,
  query,
  unseen = false,
  includeWaiting = false,
  onShowWaiting = () => {},
  onFilter,
}: FeedSectionProps) {
  const feed = useFeed(view, query, unseen);
  const home = useOpQuery(contracts.homeShow, {});
  if (feed.error !== null && feed.events.length === 0) return <ErrorState error={feed.error} />;
  if (feed.isPending) return <LoadingState label="Loading the log" />;
  if (feed.stillSearching) return <LoadingState label="Searching older events" />;
  if (unseen) {
    const lines = logLines(home.data);
    return (
      <>
        <UnseenLog
          events={feed.events}
          lines={lines}
          includeWaiting={includeWaiting}
          onShowWaiting={onShowWaiting}
        />
        <Older feed={feed} />
      </>
    );
  }
  if (feed.events.length === 0) return <EmptyState>Nothing matches this search.</EmptyState>;
  return (
    <>
      <FeedList events={feed.events} onFilter={onFilter} />
      <Older feed={feed} />
    </>
  );
}

/** More of the log than one page: what is not seen pages like a search does, so nothing past the first page is lost. */
function Older({ feed }: { feed: ReturnType<typeof useFeed> }) {
  // A page that failed after the first says why under what was already shown, which stays.
  const failed = feed.error === null ? null : <ErrorState error={feed.error} />;
  if (!feed.hasNextPage) return failed;
  return (
    <>
      {failed}
      <Actions>
        <Button disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
          {feed.isFetchingNextPage ? "Loading" : "Older"}
        </Button>
      </Actions>
    </>
  );
}
