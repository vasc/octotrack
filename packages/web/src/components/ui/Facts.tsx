import { Children, type ReactNode } from "react";

/** Small grey facts in a row, a dot between each; empty ones are left out. */
export function Facts({ children }: { children: ReactNode }) {
  const facts = Children.toArray(children).filter((fact) => fact !== "");
  return (
    <span className="ui-facts">
      {facts.map((fact, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: facts keep their order; toArray already keys each
        <span key={index} className="ui-fact">
          {fact}
        </span>
      ))}
    </span>
  );
}

/** A fact that matters more than the rest: in ink, or in the warm tone for what is stuck. */
export function Fact({ tone, children }: { tone: "strong" | "stuck"; children: ReactNode }) {
  return (
    <span className="ui-fact-tone" data-tone={tone}>
      {children}
    </span>
  );
}
