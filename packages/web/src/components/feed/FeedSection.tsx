import { contracts } from "@octotrack/core/contracts";
import { DEFAULT_VIEW, useFeed } from "../../hooks/useFeed.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { StaleNote } from "../ui/Loaded.tsx";
import { Note } from "../ui/Note.tsx";
import { Notice } from "../ui/Notice.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { FeedList } from "./FeedList.tsx";
import { UnseenLog } from "./UnseenLog.tsx";
import { logLines } from "../../lib/lines.ts";
import { scanningText } from "../../lib/log.ts";

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
  if (feed.error !== null && feed.events.length === 0) {
    return (
      <ErrorState title="Could not load the log." error={feed.error} onRetry={() => void feed.refetch()} />
    );
  }
  if (feed.isPending) return <LoadingState label="Loading the log" />;
  if (feed.stillSearching) return <Note>{scanningText(feed.scanned)}</Note>;
  // Shown once and could not refresh since: what is shown stays, marked with when it is from.
  const stale =
    feed.error !== null && !feed.isFetchNextPageError ? <StaleNote at={feed.dataUpdatedAt} /> : null;
  if (unseen) {
    const lines = logLines(home.data);
    return (
      <>
        {stale}
        <UnseenLog
          events={feed.events}
          lines={lines}
          linesLoading={home.data === undefined && home.error === null}
          includeWaiting={includeWaiting}
          onShowWaiting={onShowWaiting}
        />
        <Older feed={feed} />
      </>
    );
  }
  if (feed.events.length === 0) {
    return (
      <Notice title="Nothing matches this search">
        Searched the whole log. Try fewer words, or a longer since:.
      </Notice>
    );
  }
  return (
    <>
      {stale}
      <FeedList events={feed.events} onFilter={onFilter} />
      <Older feed={feed} />
    </>
  );
}

/** More of the log than one page: what is not seen pages like a search does, so nothing past the first page is lost. */
function Older({ feed }: { feed: ReturnType<typeof useFeed> }) {
  // A page that failed after the first says why under what was already shown, which stays, with Try again in place
  // of Older.
  if (feed.error !== null && feed.isFetchNextPageError) {
    return (
      <ErrorState
        title="Could not load older events."
        error={feed.error}
        onRetry={() => void feed.fetchNextPage()}
      />
    );
  }
  if (!feed.hasNextPage) return null;
  return (
    <Actions>
      <Button
        busy={feed.isFetchingNextPage ? "Loading…" : undefined}
        onClick={() => void feed.fetchNextPage()}
      >
        Older
      </Button>
    </Actions>
  );
}
