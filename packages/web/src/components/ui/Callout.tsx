import type { ReactNode } from "react";

/**
 * A few words set apart on a soft ground in a tone: what an agent recommends, in the attention colour; why to step in,
 * in the warm one, with what to do under it. Its lead is the word in that tone, the rest in ink.
 */
export function Callout({
  tone = "attention",
  glyph,
  lead,
  actions,
  children,
}: {
  tone?: "attention" | "warn";
  /** Status's mark before the lead, so the tone never rests on colour alone: ▲ for stepping in. */
  glyph?: string;
  lead: string;
  /** What to do about it, under the words. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="ui-callout" data-tone={tone}>
      <p className="ui-callout-text">
        {glyph === undefined ? null : (
          <>
            <span aria-hidden="true">{glyph}</span>{" "}
          </>
        )}
        <b>{lead}</b> {children}
      </p>
      {actions}
    </div>
  );
}
