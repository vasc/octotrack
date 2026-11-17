import { type DragEvent, type ReactNode, useId } from "react";
import { KindText } from "./Item.tsx";
import { Icon } from "./Icon.tsx";

/** The tone of the word that says what a row is: what needs you, what is stuck, or nothing in particular. */
export type Tone = "needs" | "stuck" | "none";

type RowProps = {
  title: ReactNode;
  /** What it is, in small grey words after a dot: Question · D-24. */
  kind?: ReactNode;
  tone?: Tone;
  /** Facts after the title, small and grey: who is on it, its step. They wrap under it on a phone. */
  facts?: ReactNode;
  /** A few quiet words under the title. */
  note?: ReactNode;
  /** A narrow column before it: its number in an order, or its handle. */
  lead?: ReactNode;
  /** The lead is a time or a date, which needs a wider column. */
  wideLead?: boolean;
  /** One of many alike, such as a change in the log: its title in plain weight, so a run of them reads as text. */
  quiet?: boolean;
  /** What acts on it, at its end. */
  trailing?: ReactNode;
  /** What it holds, under it, in line with its title. */
  children?: ReactNode;
  /** Names it for a screen reader when its title alone would not. */
  label?: string;
  /** What opening it does, as its button's name, such as Open D-24; its words then describe it. */
  openLabel?: string;
  /** The keys act on it: a quiet tint. */
  current?: boolean;
  /** Where the keys find it. */
  focusRef?: string;
  /** Another row dragged onto it lands before it. */
  drop?: { onDragOver(event: DragEvent): void; onDrop(event: DragEvent): void };
} & (
  | { onOpen?: never; checked?: never; onToggle?: never }
  | { onOpen(): void; checked?: never; onToggle?: never }
  | { checked: boolean; onToggle(): void; onOpen?: never }
);

/**
 * One row of a list, the one shape everything in a list takes: what it is, its title and its facts, a quiet note, and
 * at its end what acts on it, a chevron when the row opens, or a check when it is a choice. What it holds sits under
 * it, in line with its title, with no box of its own.
 */
export function Row(props: RowProps) {
  const {
    title,
    kind,
    tone = "needs",
    facts,
    note,
    lead,
    wideLead = false,
    quiet = false,
    trailing,
    children,
    label,
    openLabel,
    current,
    focusRef,
    drop,
  } = props;
  const textId = useId();
  const text = (
    <span className="ui-row-text" id={textId}>
      {kind === undefined ? null : (
        <span className="ui-row-kind">
          <KindText kind={kind} {...(tone === undefined ? {} : { tone })} />
        </span>
      )}
      <span>
        <span className="ui-row-title">{title}</span>
        {facts === undefined ? null : <span className="ui-row-facts">{facts}</span>}
      </span>
      {note === undefined ? null : <span className="ui-row-note">{note}</span>}
    </span>
  );
  const head =
    props.onToggle !== undefined ? (
      <label className="ui-row-head" data-action="toggle">
        {lead === undefined ? null : <span className="ui-row-lead">{lead}</span>}
        <input type="checkbox" className="ui-row-input" checked={props.checked} onChange={props.onToggle} />
        {text}
        <span className="ui-row-check" aria-hidden="true">
          {props.checked ? <Icon name="check" /> : null}
        </span>
      </label>
    ) : (
      <div className="ui-row-head" data-action={props.onOpen === undefined ? undefined : "open"}>
        {lead === undefined ? null : <span className="ui-row-lead">{lead}</span>}
        {props.onOpen === undefined ? (
          text
        ) : (
          <button
            type="button"
            className="ui-row-open"
            aria-label={openLabel}
            aria-describedby={openLabel === undefined ? undefined : textId}
            onClick={props.onOpen}
          >
            {text}
          </button>
        )}
        {trailing === undefined ? (
          props.onOpen === undefined ? null : (
            <span className="ui-row-chevron" aria-hidden="true">
              <Icon name="forward" />
            </span>
          )
        ) : (
          <span className="ui-row-trailing">{trailing}</span>
        )}
      </div>
    );
  const shared = {
    className: "ui-row",
    "aria-current": current === true ? ("true" as const) : undefined,
    "data-current": current === true ? "true" : undefined,
    "data-lead": wideLead ? "wide" : undefined,
    "data-quiet": quiet ? "true" : undefined,
    "data-focus-ref": focusRef,
    tabIndex: focusRef === undefined ? undefined : -1,
    ...drop,
  };
  const body =
    children === undefined || children === null || children === false ? null : (
      <div className="ui-row-body">{children}</div>
    );
  // A named row is a thing of its own, such as a line of work or an agent; an unnamed one is a row of a list.
  return label === undefined ? (
    <div {...shared}>
      {head}
      {body}
    </div>
  ) : (
    <article aria-label={label} {...shared}>
      {head}
      {body}
    </article>
  );
}
