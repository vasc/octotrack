import { lazy, Suspense } from "react";
import { AgentsPage } from "./components/agents/AgentsPage.tsx";
import { FeedPage } from "./components/feed/FeedPage.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import { HomePage } from "./components/home/HomePage.tsx";
import { LoadingState } from "./components/ui/states.tsx";
import { useRoute } from "./lib/router.ts";
import { NotFoundPage } from "./components/layout/NotFoundPage.tsx";

/** Loaded on its own, so that the dashboard's bundle does not carry the specimen. */
const DesignPage = lazy(() =>
  import("./design/DesignPage.tsx").then((module) => ({ default: module.DesignPage })),
);

function Page({ path }: { path: string }) {
  switch (path) {
    case "/":
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
