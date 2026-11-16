import type { ReactNode } from "react";

/**
 * A few words set apart on a soft ground in a tone: what an agent recommends, in the attention colour; why to step in,
 * in the warm one. Its lead is the word in that tone, the rest in ink.
 */
export function Callout({
  tone = "attention",
  lead,
  children,
}: {
  tone?: "attention" | "warn";
  lead: string;
  children?: ReactNode;
}) {
  return (
    <div className="ui-callout" data-tone={tone}>
      <b>{lead}</b> {children}
    </div>
  );
}
