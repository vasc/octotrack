/** A draft the server could not keep: the words are still on this screen, but on no other device. */
export function NotKept({ error }: { error: string | null }) {
  if (error === null) return null;
  return (
    <p className="error-text" role="alert">
      Not saved: {error}. What you typed is still here; it is kept as soon as saving works again.
    </p>
  );
}
