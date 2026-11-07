import { contracts } from "@octotrack/core/contracts";
import type { FeedEvent, FeedPage } from "@octotrack/core/schemas";
import { type InfiniteData, keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { callOp } from "../api/client.ts";
import { useBootstrapSnapshot } from "./useBootstrap.ts";

const PAGE_SIZE = 50;
export const DEFAULT_VIEW = "Feed";

type PageParam = number | null;

export function useFeed(view: string, query: string) {
  const bootstrap = useBootstrapSnapshot();
  const seed = view === DEFAULT_VIEW && query === "" ? bootstrap?.feed : undefined;
  const result = useInfiniteQuery<FeedPage, Error, InfiniteData<FeedPage, PageParam>, string[], PageParam>({
    queryKey: ["feed", view, query],
    queryFn: ({ pageParam }) =>
      callOp(contracts.feedList, {
        view,
        limit: PAGE_SIZE,
        ...(query === "" ? {} : { query }),
        ...(pageParam === null ? {} : { before: pageParam }),
      }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextBefore,
    placeholderData: keepPreviousData,
    ...(seed === undefined ? {} : { initialData: { pages: [seed], pageParams: [null] } }),
  });
  const events: FeedEvent[] = result.data?.pages.flatMap((page) => page.events) ?? [];
  // One request scans a bounded stretch of the log. A rare filter can come back short with more still to search, which
  // must not read as "nothing matches". So keep going until the page is full or the log has run out.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = result;
  const needsMore = events.length < PAGE_SIZE && hasNextPage && !isFetchingNextPage;
  useEffect(() => {
    if (needsMore) void fetchNextPage();
  }, [needsMore, fetchNextPage]);
  return { ...result, events, stillSearching: events.length === 0 && hasNextPage };
}
