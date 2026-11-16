import { navigate } from "../../lib/router.ts";
import { Button } from "../ui/Button.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Page } from "../ui/Page.tsx";

/** An address that leads nowhere: what lives here instead, and the way back to Lines. */
export function NotFoundPage({ path }: { path: string }) {
  return (
    <Page title="Not found" hideTitle>
      <Notice
        title={`Nothing lives at ${path}`}
        action={
          <Button variant="primary" onClick={() => navigate("/")}>
            Go to Lines
          </Button>
        }
      >
        The dashboard has three pages: Lines, the Log and Agents. Anything you open by its ref, like L-24,
        opens over the page you are on.
      </Notice>
    </Page>
  );
}
