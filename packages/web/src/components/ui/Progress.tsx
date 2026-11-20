/** Past this many, the strip is left out: a segment each would be too thin to see, and the words say it. */
const MOST_SEGMENTS = 12;

/**
 * Where you are in a view: its name and "2 of 4", then a strip with a segment for each item, yours filled. Urgent
 * draws its strip in the warning tone.
 */
export function Progress({
  name,
  at,
  of,
  urgent = false,
}: {
  name: string;
  /** Which one is open, from 1. */
  at: number;
  of: number;
  urgent?: boolean;
}) {
  return (
    <div className="ui-progress" data-tone={urgent ? "warn" : undefined}>
      <span className="ui-progress-words">
        {name} · {at} of {of}
      </span>
      {of > MOST_SEGMENTS ? null : (
        <span className="ui-progress-strip" aria-hidden="true">
          {Array.from({ length: of }, (_, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a segment is only its place in the strip
              key={index}
              className="ui-progress-segment"
              data-current={index + 1 === at ? "true" : undefined}
            />
          ))}
        </span>
      )}
    </div>
  );
}
