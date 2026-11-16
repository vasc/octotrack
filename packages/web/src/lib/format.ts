const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string, now: number = Date.now()): string {
  const elapsed = now - Date.parse(iso);
  if (elapsed < MINUTE) return "now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / DAY)}d`;
  return iso.slice(0, 10);
}

/** How long ago, as words that stand after a verb: "just now", "5m ago", "2d ago", or "on 2026-10-01". */
export function sinceText(iso: string, now: number = Date.now()): string {
  const ago = timeAgo(iso, now);
  if (ago === "now") return "just now";
  return ago === iso.slice(0, 10) ? `on ${ago}` : `${ago} ago`;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A day in words that stand after "since" or "on": today, yesterday, a weekday within the week, else the date. */
export function dayWord(iso: string, now: number = Date.now()): string {
  const label = dayLabel(iso, now);
  if (label === "Today" || label === "Yesterday") return label.toLowerCase();
  return now - Date.parse(iso) < 7 * DAY ? (WEEKDAY_NAMES[new Date(iso).getDay()] ?? label) : label;
}

/** A date as the viewer's own calendar has it. */
function localDay(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

/** The day a heading in the log stands for, in the viewer's own time, as the times beside it are. */
export function dayLabel(iso: string, now: number = Date.now()): string {
  const day = localDay(new Date(iso));
  const today = new Date(now);
  if (day === localDay(today)) return "Today";
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (day === localDay(yesterday)) return "Yesterday";
  return day;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A date alone, such as a look-again date, means that day where the viewer is, not midnight in London. */
function parseWhen(iso: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return dateOnly === null
    ? new Date(iso)
    : new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
}

/**
 * When, as the boards write it after a verb: "at 07:20" today, "on Tuesday" within a week either way, else "on 1
 * February", with the year when it is not this one. In the viewer's own time.
 */
export function whenText(iso: string, now: number = Date.now()): string {
  const at = parseWhen(iso);
  const today = new Date(now);
  if (localDay(at) === localDay(today)) {
    return `at ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  }
  if (Math.abs(now - at.getTime()) < 6 * DAY) return `on ${WEEKDAY_NAMES[at.getDay()] ?? localDay(at)}`;
  const year = at.getFullYear() === today.getFullYear() ? "" : ` ${at.getFullYear()}`;
  return `on ${at.getDate()} ${MONTHS[at.getMonth()] ?? ""}${year}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * When something happened, as the boards write it beside a row: the time today, the weekday this past week, else the
 * date. In the viewer's own time.
 */
export function timeLabel(iso: string, now: number = Date.now()): string {
  const at = new Date(iso);
  const today = new Date(now);
  if (at.toDateString() === today.toDateString()) {
    return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  }
  const clock = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  if (now - at.getTime() < 6 * DAY) return `${WEEKDAYS[at.getDay()] ?? iso.slice(0, 10)} ${clock}`;
  const month = (MONTHS[at.getMonth()] ?? "").slice(0, 3);
  return at.getFullYear() === today.getFullYear()
    ? `${at.getDate()} ${month}`
    : `${month} ${at.getFullYear()}`;
}

const ROSTER_ORDER = ["running", "asleep", "quiet", "stopped", "gone"] as const;

/** How the roster stands, as the Agents page says under its title: "1 running · 24 quiet". */
export function rosterSummary(states: readonly string[]): string {
  return ROSTER_ORDER.map((state) => [state, states.filter((other) => other === state).length] as const)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${count} ${state}`)
    .join(" · ");
}

/** A filter term that survives names with spaces or brackets in them. */
export function filterTerm(field: string, value: string): string {
  return /[\s(),"]/.test(value) ? `${field}:"${value.replaceAll('"', '\\"')}"` : `${field}:${value}`;
}

export function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export type Tone = "neutral" | "good" | "bad" | "warn" | "attention" | "info";

const TONES: Readonly<Record<string, Tone>> = {
  done: "good",
  decided: "good",
  merged: "good",
  passing: "good",
  approved: "good",
  clean: "good",
  promoted: "good",
  verified: "good",
  updated: "good",
  active: "info",
  in_progress: "info",
  in_review: "info",
  now: "info",
  open: "attention",
  failing: "bad",
  conflicting: "warn",
  changes_requested: "bad",
  blocked: "bad",
  blocker: "bad",
  urgent: "bad",
  warning: "warn",
  pending: "warn",
  requested: "warn",
  high: "warn",
};

export function toneOf(value: string): Tone {
  return TONES[value] ?? "neutral";
}

/** States that have ended without being done: drawn with a dash. */
const ENDED = new Set(["dropped", "closed", "withdrawn", "rejected", "folded", "superseded"]);

const GLYPHS: Readonly<Record<Tone, string>> = {
  good: "✓",
  bad: "✗",
  warn: "▲",
  attention: "●",
  info: "◐",
  neutral: "○",
};

/** The glyph a state carries beside its word, so that it never rests on colour alone. */
export function glyphOf(value: string): string {
  return ENDED.has(value) ? "–" : GLYPHS[toneOf(value)];
}

/** Splits text around refs such as D-3 or OCT-12, so that they can be made clickable. */
export function splitRefs(text: string): { text: string; isRef: boolean }[] {
  const pieces: { text: string; isRef: boolean }[] = [];
  const pattern = /\b(?:[A-Z][A-Z0-9]{1,5}-\d+|[DMIU]-\d+)\b/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > last) pieces.push({ text: text.slice(last, index), isRef: false });
    pieces.push({ text: match[0], isRef: true });
    last = index + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), isRef: false });
  return pieces;
}
