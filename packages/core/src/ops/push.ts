import { z } from "zod";
import { crewOf } from "../agents/claims.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import { shouldBuzz } from "../push/buzz.ts";
import type { Line, PushNote, UrgentReason } from "../schemas.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { allLines } from "../store/entities.ts";
import type { DecisionRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { requireDeveloper, requireDeveloperInPerson } from "./developer.ts";
import { buildQueue } from "./decisions.ts";
import { stepInFor } from "./runner.ts";

const SubscriptionRow = z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() });

function requireServer(ctx: Ctx): void {
  if (!ctx.system) throw new OctoError("forbidden", "Only the server sends notifications");
}

function lastOpenedAt(ctx: Ctx): string | null {
  return (
    one(ctx, z.object({ value: z.string() }), "SELECT value FROM developer_state WHERE key = 'lastOpenedAt'")
      ?.value ?? null
  );
}

function buzzedAt(ctx: Ctx, line: string): string | null {
  return (
    one(ctx, z.object({ buzzedAt: z.string() }), "SELECT buzzedAt FROM push_lines WHERE line = ?", [line])
      ?.buzzedAt ?? null
  );
}

function sent(ctx: Ctx, key: string): boolean {
  return one(ctx, z.object({ key: z.string() }), "SELECT key FROM push_sent WHERE key = ?", [key]) !== null;
}

const URGENT_WORDS: Readonly<Record<UrgentReason, string>> = {
  broken: "something broken",
  time_boxed: "time-boxed",
  costs_money: "costs money",
};

/**
 * What a notification says, as E-States draws it: the question as the title; under it, the line by its number and,
 * when there is one, the recommendation and why. Never more of the tracker than that.
 */
function questionNote(
  line: Line,
  number: number,
  decision: z.infer<typeof DecisionRow>,
  urgent: boolean,
): PushNote {
  const recommended = decision.options.find((option) => option.key === decision.recommendation);
  const where = `Line ${number}, ${line.title}`;
  const why =
    recommended === undefined
      ? (decision.context.split("\n")[0] ?? "")
      : `Recommended ${recommended.label}${decision.recommendationWhy === null ? "" : `: ${decision.recommendationWhy}`}`;
  const reason = decision.urgentReason === null ? "" : `, ${URGENT_WORDS[decision.urgentReason]}`;
  return {
    key: `${urgent ? "urgent" : "question"}:${line.ref}:${decision.ref}`,
    line: line.ref,
    title: decision.title,
    body: `${urgent ? `Urgent${reason} · ` : ""}${where} · ${why}`,
    url: `/?focus=${decision.ref}`,
  };
}

export const pushOps = [
  bind(contracts.pushSubscribe, (ctx, input) => {
    requireDeveloperInPerson(ctx, "turn on notifications");
    ctx.sql.run(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, createdAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
      [input.endpoint, input.keys.p256dh, input.keys.auth, ctx.now],
    );
    return { endpoint: input.endpoint };
  }),

  bind(contracts.pushUnsubscribe, (ctx, input) => {
    if (!ctx.system) requireDeveloper(ctx, "turn off notifications");
    ctx.sql.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [input.endpoint]);
    return { endpoint: input.endpoint };
  }),

  bind(contracts.pushSubscriptions, (ctx) => {
    requireServer(ctx);
    return rows(ctx, SubscriptionRow, "SELECT * FROM push_subscriptions ORDER BY createdAt").map((row) => ({
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }));
  }),

  bind(contracts.pushSeen, (ctx) => {
    // Only the developer opening the app resets the buzz: an agent saying they looked would silence the phone.
    requireDeveloperInPerson(ctx, "say the app was opened");
    ctx.sql.run(
      "INSERT INTO developer_state (key, value) VALUES ('lastOpenedAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [ctx.now],
    );
    return { at: ctx.now };
  }),

  bind(contracts.pushDue, (ctx) => {
    requireServer(ctx);
    const opened = lastOpenedAt(ctx);
    const working = allLines(ctx, "WHERE state = 'working'");
    // The queue's own rules: questions behind a task, held ones gone stale and Later all stay out of the way.
    const open = buildQueue(ctx, undefined)
      .map((card) => card.decision)
      .filter((decision) => decision.line !== null && decision.postponedAt === null);
    const notes: PushNote[] = [];
    working.forEach((line, lineIndex) => {
      const lineBuzzedAt = buzzedAt(ctx, line.ref);
      for (const decision of open.filter((item) => item.line === line.ref)) {
        const urgent = decision.urgentReason !== null && decision.notUrgentAt === null;
        const note = questionNote(line, lineIndex + 1, decision, urgent);
        if (sent(ctx, note.key)) continue;
        // One notification per line until the app is opened: the first unsent question carries it.
        const buzzedLine = notes.some((other) => other.line === line.ref && !other.key.startsWith("urgent:"));
        if (!urgent && buzzedLine) continue;
        if (shouldBuzz({ urgent, lineIndex, lineBuzzedAt, lastOpenedAt: opened })) notes.push(note);
      }
      const crew = crewOf(ctx, line);
      if (stepInFor(ctx, line) && crew.search !== null) {
        const key = `stepin:${line.ref}:${crew.search.since}`;
        const buzzedLine = notes.some((other) => other.line === line.ref);
        if (
          !sent(ctx, key) &&
          !buzzedLine &&
          shouldBuzz({ urgent: false, lineIndex, lineBuzzedAt, lastOpenedAt: opened })
        ) {
          notes.push({
            key,
            line: line.ref,
            title: `Step in: ${line.title}`,
            body: "No agent took it, and none could be started for it.",
            url: `/?ref=${line.ref}`,
          });
        }
      }
    });
    return notes;
  }),

  bind(contracts.pushSent, (ctx, input) => {
    requireServer(ctx);
    for (const key of input.keys) {
      const line = key.split(":")[1] ?? "";
      ctx.sql.run("INSERT OR IGNORE INTO push_sent (key, line, sentAt) VALUES (?, ?, ?)", [
        key,
        line,
        ctx.now,
      ]);
      ctx.sql.run(
        "INSERT INTO push_lines (line, buzzedAt) VALUES (?, ?) ON CONFLICT(line) DO UPDATE SET buzzedAt = excluded.buzzedAt",
        [line, ctx.now],
      );
    }
    return { sent: input.keys.length };
  }),
];
