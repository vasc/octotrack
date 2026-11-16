import type { ReactNode } from "react";

/**
 * A sheet that says where things stand for the whole page: a heading, a few words, a command to run when there is
 * one, and the one thing to do, at its end on a wide screen. First run, an empty tracker, nothing needing you.
 */
export function Notice({
  title,
  children,
  command,
  action,
  tone,
}: {
  title: string;
  children?: ReactNode;
  /** A command that changes this, set in monospace. */
  command?: string;
  action?: ReactNode;
  /** A failure, such as the tracker not answering: its heading in the bad tone. */
  tone?: "bad";
}) {
  return (
    <section
      className="ui-notice"
      aria-label={title}
      data-tone={tone}
      role={tone === "bad" ? "alert" : undefined}
    >
      <div className="ui-notice-words">
        <h2 className="ui-notice-title">{title}</h2>
        {children === undefined ? null : <div className="ui-notice-text">{children}</div>}
        {command === undefined ? null : <pre className="ui-command">{command}</pre>}
      </div>
      {action === undefined ? null : <div className="ui-notice-action">{action}</div>}
    </section>
  );
}
