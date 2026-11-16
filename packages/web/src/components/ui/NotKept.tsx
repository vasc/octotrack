/**
 * A draft the server could not keep: the words are still on this screen, but on no other device yet. Said in the warm
 * tone, since nothing is lost: the words stay and save once the tracker answers.
 */
export function NotKept({ error }: { error: string | null }) {
  if (error === null) return null;
  return (
    <p className="ui-note" data-tone="warn" role="alert">
      Not saved: the tracker did not answer. Kept here; saves when it is back.
    </p>
  );
}
