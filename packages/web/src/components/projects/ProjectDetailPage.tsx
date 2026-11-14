import { contracts } from "@octotrack/core/contracts";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { QueueSection } from "../decisions/QueueSection.tsx";
import { FeedSection } from "../feed/FeedSection.tsx";
import { IssueGroups } from "../issues/IssueGroups.tsx";
import { PrRow } from "../prs/PrRow.tsx";
import { StatusBadge } from "../ui/Badge.tsx";
import { ListCapNote } from "../ui/ListCapNote.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { Progress } from "../ui/Progress.tsx";
import { Section } from "../ui/Section.tsx";
import { EmptyState } from "../ui/states.tsx";
import { QuietRow } from "../home/QuietRow.tsx";

const ISSUE_LIMIT = 1000;

/** One repo: its questions, the lines it serves, its PRs, issues and activity, all scoped by the same query. */
export function ProjectDetailPage({ projectKey }: { projectKey: string }) {
  const { data } = useBootstrap();
  const card = data?.projects.find((item) => item.project.ref === projectKey);
  const scope = `project:${projectKey}`;
  const filter = useFilter();
  const lines = useOpQuery(contracts.lineList, { query: `project:${projectKey} -status:dropped` });
  const prs = useOpQuery(contracts.prList, { query: `${scope} state:open,draft` });
  const issues = useOpQuery(contracts.issueList, { query: scope, limit: ISSUE_LIMIT });
  const update = useOpMutation(contracts.issueUpdate);

  if (data !== undefined && card === undefined) {
    return (
      <div className="page">
        <EmptyState>No project named {projectKey}.</EmptyState>
      </div>
    );
  }
  return (
    <div className="page">
      <PageHead title={card === undefined ? projectKey : `${projectKey} ${card.project.name}`}>
        {card === undefined ? null : <StatusBadge value={card.project.status} />}
      </PageHead>
      {card === undefined || card.project.description === "" ? null : (
        <p className="muted">{card.project.description}</p>
      )}
      {card === undefined ? null : <Progress done={card.stats.issuesClosed} total={card.stats.issuesTotal} />}
      <QueueSection query={scope} isDefault={false} />
      {lines.data === undefined || lines.data.length === 0 ? null : (
        <Section title="Lines in this repo" note={String(lines.data.length)}>
          <div className="rows">
            {lines.data.map((line) => (
              <QuietRow key={line.ref} line={line} />
            ))}
          </div>
        </Section>
      )}
      {prs.data === undefined || prs.data.length === 0 ? null : (
        <Section title="Open pull requests">
          <div className="rows">
            {prs.data.map((item) => (
              <PrRow key={item.pr.ref} card={item} wide />
            ))}
          </div>
        </Section>
      )}
      {issues.data === undefined || issues.data.length === 0 ? null : (
        <Section title="Issues">
          <IssueGroups
            cards={issues.data}
            onStatus={(ref, status) => update.mutate({ refs: [ref], status })}
          />
          <ListCapNote shown={issues.data.length} cap={ISSUE_LIMIT} />
        </Section>
      )}
      <Section title="Activity">
        <FeedSection
          view="Everything"
          query={filter.query === "" ? scope : `${scope} ${filter.query}`}
          onFilter={filter.addTerm}
        />
      </Section>
    </div>
  );
}
