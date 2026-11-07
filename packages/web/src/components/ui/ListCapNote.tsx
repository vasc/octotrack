/** Says when a list stopped at its limit, so that a short list is not mistaken for the whole story. */
export function ListCapNote({ shown, cap }: { shown: number; cap: number }) {
  if (shown < cap) return null;
  return <p className="muted">Showing the first {cap}. Narrow the filter to see the rest.</p>;
}
