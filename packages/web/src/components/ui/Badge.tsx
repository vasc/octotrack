import type { ReactNode } from "react";
import { humanize, markOf, type Tone, toneOf } from "../../lib/format.ts";
import { Icon, type IconName } from "./Icon.tsx";

/**
 * A state in small words with its mark, never a pill and never colour alone: check for good news, cross for something
 * broke, a triangle for stuck or waiting, a half circle for moving, a dot for needs you, a dash for ended, an empty
 * circle for not started.
 */
export function Badge({
  tone = "neutral",
  mark,
  children,
}: {
  tone?: Tone;
  mark?: IconName;
  children: ReactNode;
}) {
  if (children === "" || children === null || children === undefined) return null;
  return (
    <span className="ui-tag" data-tone={tone}>
      {mark === undefined ? null : <Mark tone={tone} icon={mark} />}
      {children}
    </span>
  );
}

/** A value whose tone and mark follow from what it means: failing is a cross, merged a check. */
export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge tone={toneOf(value)} mark={markOf(value)}>
      {humanize(value)}
    </Badge>
  );
}

/** A state's mark alone, in its tone, before words that say the same: a dot before "running, on its line". */
export function Mark({ tone = "neutral", icon }: { tone?: Tone; icon: IconName }) {
  return (
    <span className="ui-mark" data-tone={tone} aria-hidden="true">
      <Icon name={icon} />
    </span>
  );
}
