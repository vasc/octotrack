import { lazy, Suspense } from "react";

/** Loaded on first use, so that the dashboard's first paint does not wait for the markdown parser. */
const MarkdownView = lazy(() => import("./MarkdownView.tsx"));

/** Text that agents and the developer write, rendered as markdown. Until the renderer loads, the plain text shows. */
export function Markdown({ text }: { text: string }) {
  return (
    <Suspense fallback={<p className="prose">{text}</p>}>
      <MarkdownView text={text} />
    </Suspense>
  );
}
