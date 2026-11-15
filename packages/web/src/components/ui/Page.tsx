import type { ReactNode, Ref } from "react";

/**
 * A page under the bar: its title, and beside it anything that acts on the whole page, such as search. Lines is the
 * app, so its title is for a screen reader only.
 */
export function Page({
  title,
  hideTitle = false,
  aside,
  ref,
  children,
}: {
  title: string;
  hideTitle?: boolean;
  aside?: ReactNode;
  /** The page's element, where its keys find what they act on. */
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div className="ui-page" ref={ref}>
      {hideTitle && aside === undefined ? (
        <h1 className="ui-hidden">{title}</h1>
      ) : (
        <header className="ui-page-head">
          <h1 className={hideTitle ? "ui-hidden" : "ui-page-title"}>{title}</h1>
          {aside === undefined ? null : <div className="ui-page-aside">{aside}</div>}
        </header>
      )}
      {children}
    </div>
  );
}
