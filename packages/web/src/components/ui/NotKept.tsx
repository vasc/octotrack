/** A draft the server could not keep: the words are still on this screen, but on no other device. */
export function NotKept({ error }: { error: string | null }) {
  if (error === null) return null;
  return (
    <p className="ui-note" data-error="true" role="alert">
      Not saved: {error}
    </p>
  );
}
