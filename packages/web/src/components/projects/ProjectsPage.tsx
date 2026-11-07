import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { PageHead } from "../ui/PageHead.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { ProjectCardView } from "./ProjectCardView.tsx";

export function ProjectsPage() {
  const { data, error, isPending } = useBootstrap();
  return (
    <div className="page">
      <PageHead title="Projects" />
      {isPending ? <LoadingState /> : null}
      {error === null ? null : <ErrorState error={error} />}
      {data?.projects.length === 0 ? (
        <EmptyState command="octo project create OCT Octotrack --repo owner/name">
          No projects yet.
        </EmptyState>
      ) : null}
      <div className="card-grid">
        {data?.projects.map((card) => (
          <ProjectCardView key={card.project.ref} card={card} />
        ))}
      </div>
    </div>
  );
}
