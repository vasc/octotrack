import type { Line } from "@octotrack/core/schemas";
import { whenText } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { TextLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";

/** A tabled or finished line: why it waits, when to look again, and how to bring it back. */
export function QuietRow({
  line,
  onStart,
  onQueue,
}: {
  line: Line;
  onStart?: (ref: string) => void;
  onQueue?: (ref: string) => void;
}) {
  const hasNote = line.tabledReason !== null || line.lookAgainAt !== null;
  return (
    <Row
      label={line.title}
      title={<TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
      {...(hasNote
        ? {
            note: (
              <Facts>
                {line.tabledReason}
                {line.lookAgainAt === null ? null : `look again ${whenText(line.lookAgainAt)}`}
              </Facts>
            ),
          }
        : {})}
      {...(onQueue === undefined && onStart === undefined
        ? {}
        : {
            trailing: (
              <>
                {onQueue === undefined ? null : (
                  <Button aria-label={`Up next ${line.title}`} onClick={() => onQueue(line.ref)}>
                    Up next
                  </Button>
                )}
                {onStart === undefined ? null : (
                  <Button aria-label={`Start ${line.title}`} onClick={() => onStart(line.ref)}>
                    Start
                  </Button>
                )}
              </>
            ),
          })}
    />
  );
}
