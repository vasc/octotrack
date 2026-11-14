import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** What a line of text may hold: emphasis, code and links, never blocks such as headings or lists. */
const INLINE = ["p", "strong", "em", "del", "code", "a"];

/**
 * Markdown as React elements: no HTML in the text is ever rendered as HTML, so whatever an agent writes cannot inject
 * anything. Links open outside the dashboard. Inline text keeps only what fits in a sentence, inside its own line;
 * without links, for text inside something that is itself clicked, such as an option.
 */
export default function MarkdownView({
  text,
  inline = false,
  links = true,
}: {
  text: string;
  inline?: boolean;
  links?: boolean;
}) {
  const allowed = links ? INLINE : INLINE.filter((element) => element !== "a");
  const view = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      {...(inline ? { allowedElements: allowed, unwrapDisallowed: true } : {})}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        ...(inline ? { p: ({ children }) => <>{children}</> } : {}),
      }}
    >
      {text}
    </ReactMarkdown>
  );
  return inline ? <span className="markdown-inline">{view}</span> : <div className="markdown">{view}</div>;
}
