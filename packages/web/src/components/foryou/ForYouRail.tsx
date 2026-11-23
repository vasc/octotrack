import { FILTERS, type Filter, forYouPath } from "../../lib/forYou.ts";
import { navigate } from "../../lib/router.ts";
import { FilterRail } from "../ui/FilterRail.tsx";

/** The views of For you, each with how many it holds, the one you are in marked. */
export function ForYouRail({ counts, filter }: { counts: Readonly<Record<Filter, number>>; filter: Filter }) {
  return (
    <FilterRail
      label="Waiting on you"
      current={filter}
      onGo={navigate}
      views={FILTERS.map((view) => ({
        key: view.key,
        label: view.label,
        count: counts[view.key],
        href: forYouPath(view.key),
        urgent: view.key === "urgent",
      }))}
    />
  );
}
