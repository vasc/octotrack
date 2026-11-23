import { lazy, Suspense } from "react";

/** Loaded on first use, so that the dashboard's first paint does not wait for the markdown parser. */
const MarkdownView = lazy(() => import("./MarkdownView.tsx"));

/**
 * Text that agents and the developer write, rendered as markdown. Until the renderer loads, the plain text shows.
 * `inline` is for a sentence among other words: a reason, a headline, an option's description. Empty text is nothing.
 */
export function Markdown({
  text,
  inline = false,
  links = true,
}: {
  text: string;
  inline?: boolean;
  links?: boolean;
}) {
  if (text.trim() === "") return null;
  return (
    <Suspense fallback={inline ? <span>{text}</span> : <p className="ui-prose">{text}</p>}>
      <MarkdownView text={text} inline={inline} links={links} />
    </Suspense>
  );
}
