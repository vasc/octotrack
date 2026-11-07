import { Fragment, type ReactNode } from "react";

/** Pairs with no value are left out, so that callers can list every field without checking each one. */
export function KeyValues({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  const present = items.filter(([, value]) => value !== null && value !== undefined && value !== "");
  return (
    <dl className="kv">
      {present.map(([key, value]) => (
        <Fragment key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
