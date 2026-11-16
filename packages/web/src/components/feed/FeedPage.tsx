import { useRef } from "react";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { DEFAULT_VIEW } from "../../hooks/useFeed.ts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useMarkAllSeen } from "../../hooks/useMarkSeen.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { SyncFailures } from "../prs/SyncFailures.tsx";
import { Button } from "../ui/Button.tsx";
import { Page } from "../ui/Page.tsx";
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
  const { data: bootstrap } = useBootstrap();
  return (
    <Page
      title="Log"
      subtitle="what you have not seen, line by line"
      aside={
        <>
          <FilterBox
            filter={filter}
            inputRef={input}
            placeholder="Search: line:L-56 since:2d actor:ttube"
            autoFocus={params.get("find") === "1"}
          />
          <Button onClick={seen.markAll}>Mark all seen</Button>
        </>
      }
    >
      <SyncFailures failures={bootstrap?.syncFailures ?? []} />
      <FeedSection
        view={DEFAULT_VIEW}
        query={filter.query}
        unseen={filter.query === ""}
        includeWaiting={includeWaiting}
        onShowWaiting={() => setParams({ waiting: "yes" })}
        onFilter={filter.addTerm}
      />
    </Page>
  );
}
