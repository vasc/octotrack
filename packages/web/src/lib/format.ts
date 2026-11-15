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

export function dayLabel(iso: string, now: number = Date.now()): string {
  const day = iso.slice(0, 10);
  if (day === new Date(now).toISOString().slice(0, 10)) return "Today";
  if (day === new Date(now - DAY).toISOString().slice(0, 10)) return "Yesterday";
  return day;
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
  if (now - at.getTime() < 6 * DAY) return WEEKDAYS[at.getDay()] ?? iso.slice(0, 10);
  return iso.slice(0, 10);
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
  conflicting: "bad",
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
