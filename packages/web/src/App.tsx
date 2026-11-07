import { AgentsPage } from "./components/agents/AgentsPage.tsx";
import { DecisionsPage } from "./components/decisions/DecisionsPage.tsx";
import { DriftPage } from "./components/drift/DriftPage.tsx";
import { FeedPage } from "./components/feed/FeedPage.tsx";
import { IdeasPage } from "./components/ideas/IdeasPage.tsx";
import { IssuesPage } from "./components/issues/IssuesPage.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import { ProjectDetailPage } from "./components/projects/ProjectDetailPage.tsx";
import { ProjectsPage } from "./components/projects/ProjectsPage.tsx";
import { PrsPage } from "./components/prs/PrsPage.tsx";
import { RoadmapPage } from "./components/roadmap/RoadmapPage.tsx";
import { EmptyState } from "./components/ui/states.tsx";
import { useRoute } from "./lib/router.ts";

function Page({ path }: { path: string }) {
  const project = /^\/projects\/([^/]+)$/.exec(path)?.[1];
  if (project !== undefined) return <ProjectDetailPage key={project} projectKey={project.toUpperCase()} />;
  switch (path) {
    case "/":
      return <FeedPage />;
    case "/decisions":
      return <DecisionsPage />;
    case "/prs":
      return <PrsPage />;
    case "/drift":
      return <DriftPage />;
    case "/issues":
      return <IssuesPage />;
    case "/projects":
      return <ProjectsPage />;
    case "/roadmap":
      return <RoadmapPage />;
    case "/ideas":
      return <IdeasPage />;
    case "/agents":
      return <AgentsPage />;
    default:
      return (
        <div className="page">
          <EmptyState>Nothing lives at {path}.</EmptyState>
        </div>
      );
  }
}

export function App() {
  const { path } = useRoute();
  return (
    <AppShell>
      <Page path={path} />
    </AppShell>
  );
}
