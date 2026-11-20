import type { ReactNode, Ref } from "react";

/**
 * The one item open on For you, lifted among the rows of its list on a sheet of its own: what it is, in large type, and
 * what you do about it. What it holds is drawn by the item's own components; the card gives them room and size.
 */
export function Card({
  label,
  ref,
  children,
}: {
  label: string;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section className="ui-card" aria-label={label} ref={ref}>
      {children}
    </section>
  );
}
