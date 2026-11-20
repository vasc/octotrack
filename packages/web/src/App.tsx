import { lazy, Suspense } from "react";
import { AgentsPage } from "./components/agents/AgentsPage.tsx";
import { FeedPage } from "./components/feed/FeedPage.tsx";
import { ForYouPage } from "./components/foryou/ForYouPage.tsx";
import { LinePage } from "./components/lines/LinePage.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import { HomePage } from "./components/home/HomePage.tsx";
import { LoadingState } from "./components/ui/states.tsx";
import { filterAt } from "./lib/forYou.ts";
import { useRoute } from "./lib/router.ts";
import { NotFoundPage } from "./components/layout/NotFoundPage.tsx";

/** Loaded on its own, so that the dashboard's bundle does not carry the specimen. */
const DesignPage = lazy(() =>
  import("./design/DesignPage.tsx").then((module) => ({ default: module.DesignPage })),
);

function Page({ path }: { path: string }) {
  const filter = filterAt(path);
  if (filter !== null) return <ForYouPage filter={filter} />;
  const line = /^\/lines\/(L-\d+)$/.exec(path)?.[1];
  if (line !== undefined) return <LinePage lineRef={line} />;
  switch (path) {
    case "/lines":
      return <HomePage />;
    case "/log":
      return <FeedPage />;
    case "/agents":
      return <AgentsPage />;
    default:
      return <NotFoundPage path={path} />;
  }
}

export function App() {
  const { path } = useRoute();
  if (path === "/design") {
    return (
      <Suspense fallback={<LoadingState label="Loading the specimen" />}>
        <DesignPage />
      </Suspense>
    );
  }
  return (
    <AppShell>
      <Page path={path} />
    </AppShell>
  );
}
