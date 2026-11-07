import { contracts } from "@octotrack/core/contracts";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { QueueSection } from "../decisions/QueueSection.tsx";
import { FeedSection } from "../feed/FeedSection.tsx";
import { IssueGroups } from "../issues/IssueGroups.tsx";
import { PrRow } from "../prs/PrRow.tsx";
import { StatusBadge } from "../ui/Badge.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { Progress } from "../ui/Progress.tsx";
import { Section } from "../ui/Section.tsx";
import { EmptyState } from "../ui/states.tsx";
import { MilestoneList } from "./MilestoneList.tsx";

/** One project: its decisions, milestones, PRs, issues and activity, all scoped by the same query. */
export function ProjectDetailPage({ projectKey }: { projectKey: string }) {
  const { data } = useBootstrap();
  const card = data?.projects.find((item) => item.project.ref === projectKey);
  const scope = `project:${projectKey}`;
  const filter = useFilter();
  const roadmap = useOpQuery(
    contracts.roadmapGenerate,
    { project: projectKey },
    { enabled: card !== undefined },
  );
  const prs = useOpQuery(contracts.prList, { query: `${scope} state:open,draft` });
  const issues = useOpQuery(contracts.issueList, { query: scope, limit: 1000 });
  const update = useOpMutation(contracts.issueUpdate);

  if (data !== undefined && card === undefined) {
    return (
      <div className="page">
        <EmptyState>No project named {projectKey}.</EmptyState>
      </div>
    );
  }
  const milestones =
    roadmap.data?.lanes.flatMap((lane) => lane.items).filter((item) => item.kind === "milestone") ?? [];
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
      {milestones.length === 0 ? null : (
        <Section title="Milestones">
          <MilestoneList items={milestones} />
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
