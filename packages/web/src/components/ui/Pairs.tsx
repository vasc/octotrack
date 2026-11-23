import type { ReactNode } from "react";

/** Names and what they hold, two columns: a key and what it does, a field and its value. Empty values are left out. */
export function Pairs({ pairs }: { pairs: readonly (readonly [ReactNode, ReactNode | null | undefined])[] }) {
  const shown = pairs.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="ui-pairs">
      {shown.map(([name, value], index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pairs keep their order
        <div key={index} className="ui-pair">
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Two columns side by side on a wide screen, one under the other on a phone. */
export function Columns({ children }: { children: ReactNode }) {
  return <div className="ui-columns">{children}</div>;
}

/** Things stacked with the room between sections, such as a panel's parts. */
export function Stack({ children }: { children: ReactNode }) {
  return <div className="ui-stack">{children}</div>;
}
