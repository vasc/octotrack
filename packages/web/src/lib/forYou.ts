import type { DecisionCard, ForYou, HomeView, Line, StepInKind } from "@octotrack/core/schemas";
import { refOf, stepInRef } from "./focus.ts";
import { STEP_IN_SHORT } from "./lines.ts";

/** A view of For you: everything, or one kind of what waits. */
export type Filter = "all" | "urgent" | "toAnswer" | "toDo" | "toAccept" | "toStepIn";

/** The rail, top to bottom: each view, its words, and where it lives. */
export const FILTERS: readonly { key: Filter; label: string; slug: string }[] = [
  { key: "all", label: "All", slug: "" },
  { key: "urgent", label: "Urgent", slug: "urgent" },
  { key: "toAnswer", label: "To answer", slug: "to-answer" },
  { key: "toDo", label: "To do", slug: "to-do" },
  { key: "toAccept", label: "To accept", slug: "to-accept" },
  { key: "toStepIn", label: "To step in", slug: "to-step-in" },
];

/** What an entry holds: an item a line keeps for the developer, a proposed line, or a line to step in on. */
export type EntryItem =
  | ForYou
  | { kind: "proposal" }
  | { kind: "stepin"; reason: string; stepKind: StepInKind };

/** One thing waiting on the developer, with the line it is on, if any. */
export interface Entry {
  ref: string;
  /** The line it is on, or for a proposal or Step in, the line it is about. */
  line: Line | null;
  item: EntryItem;
  /** When it was put off with Later; such entries wait at the bottom. */
  laterAt: string | null;
}

/** The address of a view of For you, with the item open in it. */
export function forYouPath(filter: Filter, item: string | null = null): string {
  const slug = FILTERS.find((entry) => entry.key === filter)?.slug ?? "";
  const path = slug === "" ? "/" : `/for-you/${slug}`;
  return item === null ? path : `${path}?item=${encodeURIComponent(item)}`;
}

/** The view an address shows, or null when it is not For you. */
export function filterAt(path: string): Filter | null {
  if (path === "/" || path === "/for-you" || path === "/for-you/") return "all";
  const slug = /^\/for-you\/([a-z-]+)\/?$/.exec(path)?.[1];
  return FILTERS.find((entry) => entry.slug !== "" && entry.slug === slug)?.key ?? null;
}

function question(card: DecisionCard, line: Line | null): Entry {
  return {
    ref: card.decision.ref,
    line,
    item: { kind: "question", card },
    laterAt: card.decision.postponedAt,
  };
}

/** Which views an entry is in, besides All. An urgent proposal is also one to accept. */
function inFilter(entry: Entry, filter: Filter, urgent: ReadonlySet<string>): boolean {
  switch (filter) {
    case "all":
      return true;
    case "urgent":
      return urgent.has(entry.ref);
    case "toAnswer":
      return entry.item.kind === "question" && !urgent.has(entry.ref);
    case "toDo":
      return entry.item.kind === "task";
    case "toAccept":
      return entry.item.kind === "proposal" || entry.item.kind === "done" || entry.item.kind === "done_when";
    case "toStepIn":
      return entry.item.kind === "stepin";
  }
}

/**
 * Everything waiting on the developer that a view holds, in the order they work through it: urgent first; then each
 * working line in their order, its Step in and then what it holds for them; then proposed lines; then questions on no
 * line. What was put off with Later goes to the bottom of the whole list, the last put off last.
 */
export function entriesOf(home: HomeView, filter: Filter): Entry[] {
  const lines = new Map([...home.working, ...home.upNext, ...home.proposed].map((line) => [line.ref, line]));
  const lineOf = (ref: string | null) => (ref === null ? null : (lines.get(ref) ?? null));
  const urgentProposals = home.proposed.filter((line) => line.urgentReason !== null);
  const urgent = new Set([
    ...home.urgent.map((card) => card.decision.ref),
    ...urgentProposals.map((line) => line.ref),
  ]);
  const proposal = (line: Line): Entry => ({
    ref: line.ref,
    line,
    item: { kind: "proposal" },
    laterAt: null,
  });
  const all: Entry[] = [
    ...home.urgent.map((card) => question(card, lineOf(card.decision.line))),
    ...urgentProposals.map(proposal),
    ...home.working.flatMap((line) => {
      const details = home.lines[line.ref];
      if (details === undefined) return [];
      const stepIn: Entry[] =
        details.stepIn && details.stepInReason !== null && details.stepInKind !== null
          ? [
              {
                ref: stepInRef(line.ref),
                line,
                item: { kind: "stepin", reason: details.stepInReason, stepKind: details.stepInKind },
                laterAt: null,
              },
            ]
          : [];
      return [
        ...stepIn,
        ...details.forYou.map(
          (item): Entry =>
            item.kind === "question"
              ? question(item.card, line)
              : { ref: refOf(item), line, item, laterAt: null },
        ),
      ];
    }),
    ...home.proposed.filter((line) => line.urgentReason === null).map(proposal),
    ...home.noLine.map((card) => question(card, null)),
  ];
  const held = all.filter((entry) => inFilter(entry, filter, urgent));
  const later = held
    .filter((entry) => entry.laterAt !== null)
    .sort((a, b) => (a.laterAt ?? "").localeCompare(b.laterAt ?? ""));
  return [...held.filter((entry) => entry.laterAt === null), ...later];
}

/** How many entries each view holds, for the rail and the bar. */
export function filterCounts(home: HomeView): Record<Filter, number> {
  return {
    all: entriesOf(home, "all").length,
    urgent: entriesOf(home, "urgent").length,
    toAnswer: entriesOf(home, "toAnswer").length,
    toDo: entriesOf(home, "toDo").length,
    toAccept: entriesOf(home, "toAccept").length,
    toStepIn: entriesOf(home, "toStepIn").length,
  };
}

/**
 * The entry a view opens: the one asked for while it is still there; else, when the one that was open has gone (it
 * was answered, or put off), the one that took its place; else the first.
 */
export function openEntry(
  entries: readonly Entry[],
  asked: string | null,
  before: readonly string[] = [],
): Entry | null {
  const found = asked === null ? undefined : entries.find((entry) => entry.ref === asked);
  if (found !== undefined) return found;
  if (asked !== null) {
    const at = before.indexOf(asked);
    const after = new Set(entries.map((entry) => entry.ref));
    const next = at === -1 ? undefined : before.slice(at + 1).find((ref) => after.has(ref));
    const replacement = next === undefined ? undefined : entries.find((entry) => entry.ref === next);
    if (replacement !== undefined) return replacement;
  }
  return entries[0] ?? null;
}

/** The view that comes after this one on the rail and still holds something, for when this one is done. */
export function nextFilter(counts: Record<Filter, number>, filter: Filter): Filter | null {
  if (filter === "all") return null;
  const order = FILTERS.map((entry) => entry.key).filter((key) => key !== "all");
  const at = order.indexOf(filter);
  return [...order.slice(at + 1), ...order.slice(0, at)].find((key) => counts[key] > 0) ?? null;
}

/** How an entry is named where it is not open, as in Next: where it sits, its title, and one more fact. */
export function entryText(entry: Entry): { where: string; title: string; note: string | null } {
  const line = entry.line?.title ?? "On no line";
  switch (entry.item.kind) {
    case "question": {
      const { decision } = entry.item.card;
      const recommended = decision.options.find((option) => option.key === decision.recommendation);
      return {
        where: `${line} · ${decision.ref}`,
        title: decision.title,
        note: recommended === undefined ? null : `Recommended: ${recommended.label}`,
      };
    }
    case "task": {
      const { task } = entry.item;
      return {
        where: `${line} · ${task.ref}`,
        title: task.title,
        note: task.place === null ? null : `At ${task.place}`,
      };
    }
    case "done":
      return { where: `${line} · proposed done`, title: `Is ${line} done?`, note: null };
    case "done_when":
      return { where: `${line} · new done when`, title: `A new done when for ${line}`, note: null };
    case "proposal":
      return {
        where: [entry.ref, ...(entry.line?.repos ?? [])].join(" · "),
        title: entry.line?.title ?? entry.ref,
        note: entry.line?.proposedBy == null ? null : `From ${entry.line.proposedBy}`,
      };
    case "stepin":
      return {
        where: entry.line?.ref ?? "",
        title: line,
        note: `No agent: ${STEP_IN_SHORT[entry.item.stepKind]}`,
      };
  }
}
