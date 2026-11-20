import type { ReactNode, Ref } from "react";

/**
 * The one item open on For you, lifted among the rows of its list on a sheet of its own: what it is, in large type, and
 * what you do about it. It takes the browser's focus when it opens, so Tab starts in it. What it holds is drawn by the item's own components; the card gives them room and size.
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
    <section className="ui-card" aria-label={label} ref={ref} tabIndex={-1}>
      {children}
    </section>
  );
}
