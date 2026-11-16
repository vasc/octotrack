import { contracts } from "@octotrack/core/contracts";
import type { HomeCounts } from "@octotrack/core/schemas";
import { useMemo } from "react";
import type { CountLink } from "../components/layout/TopBar.tsx";
import { firstOf } from "../lib/focus.ts";
import { useOpMutation, useOpQuery } from "./useOp.ts";

const LABELS: readonly (readonly [keyof HomeCounts, string])[] = [
  ["urgent", "urgent"],
  ["toAnswer", "to answer"],
  ["toDo", "to do"],
  ["toAccept", "to accept"],
  ["toStepIn", "to step in"],
];

/** What the bar on every page shows: the counts from home, each going to its first item, and where the developer is. */
export function useTopBar() {
  const home = useOpQuery(contracts.homeShow, {});
  const places = useOpQuery(contracts.placeList, {});
  const at = useOpMutation(contracts.at);
  const data = home.data;
  const counts = useMemo(
    (): CountLink[] =>
      data === undefined
        ? []
        : LABELS.filter(([key]) => data.counts[key] > 0).map(([key, label]) => ({
            key,
            label,
            count: data.counts[key],
            to: firstOf(data, key),
          })),
    [data],
  );
  return {
    counts,
    places: (places.data ?? []).map((place) => place.name),
    at: data?.at?.place ?? null,
    /** Why saying where the developer is did not work, until the next try. */
    error: at.error,
    /** The places could not load. */
    placesError: places.error,
    retryPlaces: () => void places.refetch(),
    /** A change of place is on its way. */
    atBusy: at.isPending,
    setAt: (place: string | null) => {
      at.reset();
      at.mutate(place === null ? {} : { place });
    },
  };
}
