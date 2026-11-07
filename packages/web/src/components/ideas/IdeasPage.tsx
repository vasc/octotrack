import { contracts } from "@octotrack/core/contracts";
import { useState } from "react";
import { useFilter } from "../../hooks/useFilter.ts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { FilterBox } from "../feed/FilterBox.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { IdeaRow } from "./IdeaRow.tsx";

export function IdeasPage() {
  const filter = useFilter();
  const [title, setTitle] = useState("");
  const ideas = useOpQuery(contracts.ideaList, filter.query === "" ? {} : { query: filter.query });
  const capture = useOpMutation(contracts.ideaCapture);
  const update = useOpMutation(contracts.ideaUpdate);
  const promote = useOpMutation(contracts.ideaPromote);
  const failure = capture.error ?? update.error ?? promote.error;
  return (
    <div className="page">
      <PageHead title="Ideas" />
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() === "") return;
          capture.mutate({ title: title.trim() });
          setTitle("");
        }}
      >
        <input
          className="field"
          aria-label="New idea"
          placeholder="Capture an idea"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" className="btn" disabled={title.trim() === ""}>
          Capture
        </button>
      </form>
      <FilterBox filter={filter} placeholder="Filter: status:captured project:OCT" />
      {failure === null ? null : <ErrorState error={failure} />}
      {ideas.isPending ? <LoadingState /> : null}
      {ideas.error === null ? null : <ErrorState error={ideas.error} />}
      {ideas.data?.length === 0 ? <EmptyState>No ideas here.</EmptyState> : null}
      <div className="rows">
        {ideas.data?.map((idea) => (
          <IdeaRow
            key={idea.ref}
            idea={idea}
            onHorizon={(ref, horizon) => update.mutate({ ref, horizon })}
            onPromote={(ref) => promote.mutate({ ref })}
            onReject={(ref) => update.mutate({ ref, status: "rejected" })}
          />
        ))}
      </div>
    </div>
  );
}
